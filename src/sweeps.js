// Sweeping changes: relative adjustments to a whole theme or to one part of it.
//
// A sweep never sets an absolute value. It reads each colour as it is now (authored, or the
// foundation's own where the theme leaves it inherited), moves it, and writes it back, so it can run
// before or after any granular edit and be repeated without a ceiling. Colour is moved in OKLab, where
// a step in lightness, tint or hue looks like the same step on every colour, and out-of-gamut results
// are pulled back along chroma rather than clipped.
import { clone, put } from './state.js';

const clamp = (value, lo, hi) => Math.min(hi, Math.max(lo, value));
const linear = c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const gamma = c => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
const HEX = /^#([\da-f]{6})([\da-f]{2})?$/i;

/** `#rrggbb[aa]` to OKLab (+ alpha), or null when it is not a colour. */
export function parse(hex) {
  const match = typeof hex === 'string' ? HEX.exec(hex) : null;
  if (!match) return null;
  const n = parseInt(match[1], 16);
  const r = linear((n >> 16 & 255) / 255), g = linear((n >> 8 & 255) / 255), b = linear((n & 255) / 255);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return {
    L: 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
    alpha: match[2] ? parseInt(match[2], 16) / 255 : 1
  };
}
const rgbOf = ({ L, a, b }) => {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3, m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3, s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3;
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s];
};
const inGamut = rgb => rgb.every(c => c >= -1e-4 && c <= 1 + 1e-4);

/** OKLab to `#rrggbb[aa]`, keeping lightness and hue and giving up chroma until it fits. */
export function format({ L, a, b, alpha = 1 }) {
  L = clamp(L, 0, 1);
  let rgb = rgbOf({ L, a, b });
  if (!inGamut(rgb)) {
    let lo = 0, hi = 1;
    for (let i = 0; i < 18; i++) { const mid = (lo + hi) / 2; if (inGamut(rgbOf({ L, a: a * mid, b: b * mid }))) lo = mid; else hi = mid; }
    rgb = rgbOf({ L, a: a * lo, b: b * lo });
  }
  const byte = c => Math.round(clamp(gamma(clamp(c, 0, 1)), 0, 1) * 255).toString(16).padStart(2, '0');
  const alphaByte = Math.round(clamp(alpha, 0, 1) * 255);
  return `#${rgb.map(byte).join('')}${alphaByte < 255 ? alphaByte.toString(16).padStart(2, '0') : ''}`;
}

const chroma = lab => Math.hypot(lab.a, lab.b);

// One unit of a control is `t` (1 = one wheel-travel). Nothing bounds it: ops that would turn inside out (contrast,
// intensity) stop at their own floor, and colour is gamut-limited by `format`. Each op says what a full-travel drag does. Pivot is the lightness of the
// panel surface, so "contrast" always means distance from the surfaces the theme is built on.
const COLOUR_OPS = {
  brightness: (t) => lab => ({ ...lab, L: lab.L + 0.16 * t }),
  contrast: (t, ctx) => lab => ({ ...lab, L: ctx.pivot + (lab.L - ctx.pivot) * Math.max(0.05, 1 + 0.6 * t) }),
  warmth: (t) => lab => {
    // Tint the greys toward amber (warm) or blue (cool); colours that are already vivid keep their identity.
    const weight = 1 - clamp(chroma(lab) / 0.09, 0, 1);
    return { ...lab, a: lab.a + weight * 0.0145 * t, b: lab.b + weight * 0.026 * t };
  },
  intensity: (t) => lab => { const f = Math.max(0, 1 + 0.7 * t); return { ...lab, a: lab.a * f, b: lab.b * f }; },
  hue: (t) => lab => { const r = (t * 60 * Math.PI) / 180, cos = Math.cos(r), sin = Math.sin(r); return { ...lab, a: lab.a * cos - lab.b * sin, b: lab.a * sin + lab.b * cos }; },
  strength: (t, ctx) => lab => {
    // Lines: a faint, translucent line gets more opaque; an opaque one moves further from the surface it sits on.
    if (lab.alpha < 0.98) return { ...lab, alpha: clamp(lab.alpha * (1 + 0.9 * t), 0.02, 1) };
    return { ...lab, L: lab.L + Math.sign(lab.L - ctx.pivot || 1) * 0.08 * t };
  }
};

// What each control is called, how it reads at either end, and what it says it does.
export const CONTROLS = {
  brightness: { name: 'Brightness', low: 'Darker', high: 'Lighter', help: 'Lightens or darkens colour while keeping every relationship between them.' },
  contrast: { name: 'Contrast', low: 'Softer', high: 'Stronger', help: 'Pushes light and dark further apart, or pulls them together, around the panel surface.' },
  warmth: { name: 'Warmth', low: 'Cooler', high: 'Warmer', help: 'Tints the greys toward blue or amber. Vivid colours keep their identity.' },
  intensity: { name: 'Intensity', low: 'Muted', high: 'Vivid', help: 'Drains or boosts colour. Greys stay grey.' },
  hue: { name: 'Hue', low: 'Rotate back', high: 'Rotate on', help: 'Rotates every colour around the colour wheel.' },
  opacity: { name: 'Surface opacity', low: 'Clear', high: 'Solid', help: 'How solid panels and dialogs are. Lower lets more of the viewport show through.' },
  strength: { name: 'Line strength', low: 'Fainter', high: 'Bolder', help: 'How clearly lines and dividers stand out.' },
  weight: { name: 'Line weight', low: 'Thinner', high: 'Thicker', help: 'The thickness of outlines and dividers.' },
  blur: { name: 'Blur', low: 'Clear', high: 'Frosted', help: 'How strongly glass panels blur what is behind them.' }
};

// ---------------------------------------------------------------------------------------------------------
// Parts: which colours a sweep reaches. Everything in the contract belongs to exactly one part.

const WORKSPACE = /^(surface|mesh|sheet|render)_(fill|ink|soft|accent)$|^sketch_(accent|ink|soft)$|^form_(fill|soft|accent|tab_ink)$|^tab_on_fill_dark$/;
const STATUS = new Set(['error', 'warning', 'form_error', 'form_error_fill', 'form_success', 'form_success_fill', 'agent_ok', 'timeline_item_error']);
const ACCENT = new Set(['accent', 'accent_soft', 'selected_bg', 'selected_ink', 'on_accent', 'form_primary', 'form_primary_fill', 'file_primary', 'file_primary_ink', 'rubber_band', 'box_window', 'box_crossing', 'agent_busy', 'nav_tip', 'logo']);
const VIEWPORT = new Set(['viewport_top', 'viewport_bottom', 'grid', 'grid_major']);
// Colours that carry meaning (red is wrong, green is fine, X is red): a hue rotation leaves them where they are.
const SEMANTIC = new Set(['axis_x', 'axis_y', 'axis_z', 'bend_up', 'bend_down', 'preview_add', 'preview_cut', 'sketch_conflict', 'interference', 'agent_ok']);
const keepHue = key => STATUS.has(key) || SEMANTIC.has(key);
const LINE = /(_border|_rule|_separator)$|^border$/;
const TEXT = /^(text|text_dim|icon)$|(_text|_ink|_dim|_label)$/;
const MODEL = /^(axis_[xyz]|origin_|construction_|body|bend_|continuity|interference|section_cap|sel_|hover_(edge|profile)|profile_fill|manipulator|joint_|preview_|sketch|dimension|glyph_|icons\.)/;

/** Which part a colour role belongs to. */
export function partOf(key) {
  if (WORKSPACE.test(key)) return 'workspaces';
  if (STATUS.has(key)) return 'status';
  if (ACCENT.has(key)) return 'accent';
  if (VIEWPORT.has(key)) return 'background';
  if (LINE.test(key)) return 'lines';
  if (TEXT.test(key) && !MODEL.test(key)) return 'text';
  if (MODEL.test(key)) return 'model';
  return 'surfaces';
}

/** The parts of the app, in the order they are offered, with the controls that make sense for each. */
export const PARTS = [
  { id: 'surfaces', name: 'Panels & windows', blurb: 'The app bar, panels, dialogs, fields and everything they are built from.', controls: ['brightness', 'contrast', 'warmth', 'opacity', 'blur'] },
  { id: 'text', name: 'Text', blurb: 'Labels, values and the default icon ink.', controls: ['brightness', 'contrast', 'warmth'] },
  { id: 'lines', name: 'Lines & dividers', blurb: 'Outlines, separators and borders.', controls: ['strength', 'weight'] },
  { id: 'accent', name: 'Accent & selection', blurb: 'What is selected, hovered or primary.', controls: ['hue', 'intensity', 'brightness'] },
  { id: 'workspaces', name: 'Workspace colours', blurb: 'The colour of each workspace’s tab and tools.', controls: ['hue', 'intensity', 'brightness'] },
  { id: 'status', name: 'Status colours', blurb: 'Errors, warnings and success.', controls: ['intensity', 'brightness'] },
  { id: 'background', name: 'Viewport background', blurb: 'The backdrop gradient and its grid.', controls: ['brightness', 'warmth', 'contrast'] },
  { id: 'model', name: 'Model & sketch', blurb: 'Bodies, selection in 3D, sketch geometry and dimensions.', controls: ['hue', 'intensity', 'brightness'] },
  { id: 'icons', name: 'Icons', blurb: 'The artwork colours, by role and by meaning.', controls: ['hue', 'intensity', 'brightness'] }
];
// What each editing tab sweeps at its top: the parts it covers, the controls that span all of them, and whether it owns corners.
export const SECTION_SWEEPS = {
  interface: { name: 'the interface', parts: ['surfaces', 'lines', 'accent', 'status'], wide: ['brightness', 'contrast', 'warmth', 'intensity', 'hue'], corners: true },
  viewport: { name: 'the viewport', parts: ['background', 'model'], wide: ['brightness', 'contrast', 'warmth', 'intensity', 'hue'] },
  text: { name: 'text & icons', parts: ['text', 'icons'], wide: ['brightness', 'contrast', 'warmth', 'intensity', 'hue'] },
  workspaces: { name: 'the workspaces', parts: ['workspaces'], wide: ['brightness', 'intensity', 'hue'] }
};
// Corner radii, grouped by what they round. The first key of a group is the one shown on its slider.
export const CORNERS = {
  all: ['radius_xl', 'radius_lg', 'radius_md', 'control_radius', 'sketch_mode_radius', 'radius_sm'],
  windows: ['radius_xl', 'radius_lg'],
  controls: ['radius_md', 'control_radius', 'sketch_mode_radius'],
  details: ['radius_sm']
};

/** Everything a sweep needs to read the theme as it currently stands. */
export function context(contract, doc) {
  const base = doc.base === 'light' ? 'light' : 'dark';
  const defaults = contract.baseDefaults?.[base] || {};
  const colours = (key) => doc.colors?.[key] ?? defaults.colors?.[key];
  const panel = parse(Array.isArray(colours('panel')) ? colours('panel')[0] : colours('panel'));
  return { contract, doc, base, defaults, colours, pivot: panel?.L ?? (base === 'dark' ? 0.3 : 0.9) };
}

const mapColour = (value, fn) => {
  if (Array.isArray(value)) return value.map(item => mapColour(item, fn));
  const lab = parse(value);
  return lab ? format(fn(lab)) : value;
};

/** [path, current value] for every colour a part reaches. Icons and authored lines belong to their own parts. */
function targets(ctx, partId) {
  const { contract, doc, defaults } = ctx, out = [];
  const keys = (contract.colorKeys || []).map(item => (typeof item === 'string' ? item : item.key));
  // `partId` is a part, a list of parts (a whole tab), or 'all'.
  const ids = partId === 'all' ? null : new Set([partId].flat()), whole = ids === null;
  for (const key of keys) {
    if (!whole && !ids.has(partOf(key))) continue;
    const value = ctx.colours(key);
    if (value !== undefined) out.push([['colors', key], value]);
  }
  if (whole || ids.has('icons')) {
    const native = contract.iconDefaults?.[ctx.base] || {};
    for (const key of [...(contract.iconRoleKeys || []), ...(contract.iconAccentKeys || [])]) {
      const value = doc.icon_palette?.[key] ?? native[key];
      if (value !== undefined) out.push([['icon_palette', key], value]);
    }
  }
  if (whole || ids.has('lines')) {
    for (const [role, line] of Object.entries(doc.borders || {})) {
      if (!line || typeof line !== 'object') continue;
      for (const field of role === 'bevel' ? ['highlight', 'light', 'shadow', 'dark_shadow'] : ['color']) if (line[field] !== undefined) out.push([['borders', role, field], line[field]]);
    }
  }
  return out;
}

/** The edits (path -> value) a colour control makes at amount `t`, relative to the theme in `ctx`. */
export function colourEdits(ctx, partId, op, t) {
  const fn = COLOUR_OPS[op](t, ctx);
  const edits = [];
  for (const [path, value] of targets(ctx, partId)) {
    if (op === 'hue' && path[0] === 'colors' && keepHue(path[1])) continue;
    // Opaque-only places (icon colours) never take an alpha.
    const next = mapColour(value, lab => { const out = fn(lab); return path[0] === 'icon_palette' ? { ...out, alpha: 1 } : out; });
    if (JSON.stringify(next) !== JSON.stringify(value)) edits.push([path, next]);
  }
  return edits;
}

/**
 * Move the accent toward a chosen colour: rotate the part's hues by the same angle the accent turns, and scale its
 * chroma by the same factor, so soft and selected variants follow and keep their own lightness.
 */
export function retintEdits(ctx, partId, hex) {
  const from = parse(Array.isArray(ctx.colours('accent')) ? ctx.colours('accent')[0] : ctx.colours('accent')), to = parse(hex);
  if (!from || !to) return [];
  const edits = [];
  const angle = Math.atan2(to.b, to.a) - Math.atan2(from.b, from.a), cos = Math.cos(angle), sin = Math.sin(angle);
  const grey = chroma(from) < 0.02, factor = grey ? 1 : chroma(to) / chroma(from), cap = chroma(to);
  for (const [path, value] of targets(ctx, partId)) {
    // The accent itself becomes exactly the chosen colour (keeping its own alpha); the rest follow it.
    if (path[0] === 'colors' && path[1] === 'accent' && !Array.isArray(value)) { const lab = parse(value); edits.push([path, format({ ...to, alpha: lab ? lab.alpha : 1 })]); continue; }
    const next = mapColour(value, lab => {
      if (grey) return { ...lab, a: lab.a + (to.a - from.a) * (lab.L > 0.15 && lab.L < 0.97 ? 1 : 0), b: lab.b + (to.b - from.b) * (lab.L > 0.15 && lab.L < 0.97 ? 1 : 0) };
      const a = (lab.a * cos - lab.b * sin) * factor, b = (lab.a * sin + lab.b * cos) * factor, c = Math.hypot(a, b), k = c > cap ? cap / c : 1;
      return { ...lab, a: a * k, b: b * k };
    });
    if (JSON.stringify(next) !== JSON.stringify(value)) edits.push([path, next]);
  }
  return edits;
}

/** Shift every radius in `keys` by `delta` points, keeping each one's offset from the others. */
export function radiusEdits(ctx, keys, delta) {
  const edits = [];
  for (const key of keys) {
    const spec = (ctx.contract.radiusKeys || []).find(item => item.key === key) || {};
    const current = ctx.doc.radii?.[key] ?? ctx.defaults.radii?.[key];
    if (current === undefined) continue;
    edits.push([['radii', key], clamp(Math.round(current + delta), spec.min ?? 0, spec.max ?? 32)]);
  }
  return edits;
}

/** The current radius a group is showing (its first key). */
export function radiusOf(ctx, group) { return ctx.doc.radii?.[CORNERS[group][0]] ?? ctx.defaults.radii?.[CORNERS[group][0]] ?? 0; }

/** Thicken or thin the panel outline and every line the theme already authors (the fine inset line keeps its own width). */
export function weightEdits(ctx, t) {
  const max = ctx.contract.borderSchema?.stroke?.width?.max ?? 4;
  const edits = [];
  const colour = ctx.colours('border') || '#666666';
  const roles = new Set(['primary', ...Object.keys(ctx.doc.borders || {}).filter(role => role !== 'primary_inset' && role !== 'bevel')]);
  for (const role of roles) {
    const line = ctx.doc.borders?.[role];
    if (line && typeof line !== 'object') continue;
    const width = line?.width ?? 1;
    const next = Math.round(clamp(width + 0.6 * t, 0, max) * 20) / 20;
    if (next === width) continue;
    if (line) edits.push([['borders', role, 'width'], next]);
    else edits.push([['borders', role], { width: next, color: colour, ...(role === 'secondary' ? { pattern: 'solid' } : {}) }]);
  }
  return edits;
}

// The surfaces that carry the app's glass: their alpha is what "opacity" moves.
const GLASS = ['panel', 'panel_header', 'toolbar', 'dialog_bg', 'dialog_body', 'dialog_footer'];

/** How solid the main surface is now, in percent. */
export function opacityOf(ctx) { const lab = parse(ctx.colours('panel')); return Math.round((lab ? lab.alpha : 1) * 100); }

/** Move the alpha of every glass surface by `delta` (a fraction), each by the same amount, never fully clear. */
export function opacityEdits(ctx, delta) {
  const edits = [];
  for (const key of GLASS) {
    const value = ctx.colours(key), lab = parse(value);
    if (!lab) continue;
    const next = format({ ...lab, alpha: clamp(lab.alpha + delta, 0.04, 1) });
    if (next !== value) edits.push([['colors', key], next]);
  }
  return edits;
}

/** The panel outline's thickness now, in points. */
export function weightOf(ctx) { return ctx.doc.borders?.primary?.width ?? 1; }

/** The blur the theme defaults to now, in pixels. */
export function blurOf(ctx) {
  const option = (ctx.doc.options || []).find(item => item.id === 'blur');
  return option ? option.default ?? 0 : (ctx.contract.standardOptions || []).find(item => item.id === 'blur')?.default ?? 0;
}

/** Strengthen or soften the blur of glass panels by moving the theme's default for the standard Blur option. */
export function blurEdits(ctx, t) {
  const standard = (ctx.contract.standardOptions || []).find(item => item.id === 'blur');
  if (!standard) return [];
  const options = ctx.doc.options || [];
  const index = options.findIndex(item => item.id === 'blur');
  const current = index >= 0 ? options[index].default : standard.default ?? 0;
  const min = index >= 0 ? options[index].min ?? standard.min : standard.min, max = index >= 0 ? options[index].max ?? standard.max : standard.max;
  const next = clamp(Math.round(current + 20 * t), min ?? 0, max ?? 60);
  if (next === current) return [];
  if (index >= 0) return [[['options', index, 'default'], next]];
  return [[['options'], [...clone(options), { ...clone(standard), default: next }]]];
}

/** Apply a list of [path, value] edits to a document (mutating it). */
export function apply(doc, edits) { for (const [path, value] of edits) put(doc, path, value); }

/** The colours, as they currently show, that stand for a part: used for the little swatch previews. */
export function samples(ctx, partId, count = 5) {
  const picks = [];
  for (const [path, value] of targets(ctx, partId)) {
    const colour = Array.isArray(value) ? value[0] : value;
    const lab = parse(colour);
    if (lab && lab.alpha > 0.9) picks.push({ colour: colour.slice(0, 7), L: lab.L, C: chroma(lab) });
  }
  if (picks.length <= count) return picks.map(item => item.colour);
  // Spread across lightness so the strip reads as the part's tonal range.
  picks.sort((a, b) => a.L - b.L);
  return Array.from({ length: count }, (_, i) => picks[Math.round((i * (picks.length - 1)) / (count - 1))].colour);
}
