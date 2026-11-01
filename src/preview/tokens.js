// The resolved theme as the page paints with it. Every value comes from the Rust codec's
// `evaluate().preview` (layout metrics, colours, tab accent, icon palette); nothing is derived here
// except CSS spellings. There is no JavaScript theme resolver.
const kebab = name => name.replace(/_/g, '-');

export class Tokens {
  constructor() { this.metrics = {}; this.colors = {}; this.tabAccent = {}; this.icons = { accents: {} }; this.blurRadius = 0; this.dark = true; this.borders = {}; }

  /** Replace the tokens with those of a new evaluation. Returns true when anything changed. */
  update(result) {
    const preview = result?.preview;
    if (!preview) return false;
    const next = JSON.stringify([preview, result.resolved?.borders, result.resolved?.radii]);
    if (next === this.signature) return false;
    this.signature = next;
    Object.assign(this, { metrics: preview.metrics, colors: preview.colors, tabAccent: preview.tabAccent, icons: preview.icons, blurRadius: preview.blurRadius, dark: preview.dark, borders: result.resolved?.borders || {} });
    return true;
  }

  get ready() { return Object.keys(this.colors).length > 0; }
  m(name) { return this.metrics[name] ?? 0; }
  c(name) { return this.colors[name] ?? '#ff00ff'; }

  /** The primary border stroke: the themed width and colour, or 1 px in `fallback`. */
  primaryBorder(fallback) {
    const border = this.borders.primary;
    return { width: border?.width ?? 1, color: border?.color ?? fallback };
  }

  /** CSS custom properties for the stage root. */
  cssVariables() {
    const vars = {};
    for (const [name, value] of Object.entries(this.colors)) vars[`--c-${kebab(name)}`] = value;
    for (const [name, value] of Object.entries(this.metrics)) vars[`--m-${kebab(name)}`] = `${value}px`;
    vars['--c-tab'] = this.tabAccent.color; vars['--c-tab-ink'] = this.tabAccent.ink; vars['--c-tab-soft'] = this.tabAccent.soft;
    vars['--blur'] = `${this.blurRadius}px`;
    const border = this.primaryBorder(this.c('border'));
    vars['--border-width'] = `${border.width}px`;
    return vars;
  }
}
