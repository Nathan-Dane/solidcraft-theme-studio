// SolidCraft's own icon artwork, recoloured by role exactly as the native renderer does: the
// artwork carries stable source colours, the codec says which role each is and what colour that
// role has in the active theme and accent ramp.
const root = new URL('../../runtime/', import.meta.url);
const texts = new Map();
let files = null, index = null;

export async function loadIcons(iconIndex) {
  index = iconIndex;
  const response = await fetch(new URL('icons/index.json', root));
  if (!response.ok) throw new Error('The icon artwork has not been built. Run scripts/build-runtime.ps1.');
  files = await response.json();
}

function text(path) {
  if (!texts.has(path)) texts.set(path, fetch(new URL(`icons/${path}`, root)).then(response => response.ok ? response.text() : ''));
  return texts.get(path);
}

/** Resolve an icon id to its master, default accent ramp and artwork file. */
function resolve(name, size) {
  if (!files) return null;
  // The codec knows the pinned source's ids; artwork supplied later is a master of its own name.
  const entry = index?.icons?.[name] ?? (files.masters[name] ? [name, ''] : null);
  if (!entry) return null;
  const [master, accent] = entry;
  const small = index?.small?.includes(master) && size <= 24 ? files.small[master] : null;
  const path = small || files.masters[master];
  return path ? { path, accent: accent || '' } : null;
}

const hex = /(fill|stroke)="(#[0-9a-fA-F]{6})"/g;

function recolour(svg, roles, accentRamp) {
  const palette = accentRamp || {};
  let out = svg.replace(hex, (match, attr, value) => {
    const role = index.sourceRoles[value.toLowerCase()];
    if (!role) return match;
    if (role === 'gap') return `${attr}="#000" data-gap="1"`;
    return `${attr}="${palette[role] ?? match}"`;
  });
  out = out.replace(/currentColor/g, palette.line || '#ffffff');
  return out;
}

export class Icons {
  constructor(tokens) { this.tokens = tokens; this.pending = new Set(); }

  /** An element showing icon `name` at `size` css px. The artwork arrives asynchronously. */
  el(name, size, { opacity = 1, ink = null, accent } = {}) {
    const span = document.createElement('span');
    span.className = 'ic';
    span.style.cssText = `width:${size}px;height:${size}px;${opacity === 1 ? '' : `opacity:${opacity}`}`;
    span.dataset.icon = name;
    const resolved = resolve(name, Math.round(size * (window.devicePixelRatio || 1)));
    if (!resolved) { span.dataset.missing = '1'; return span; }
    const ramps = this.tokens.icons.accents || {};
    const ramp = ramps[accent ?? resolved.accent] || ramps[''];
    text(resolved.path).then(svg => {
      if (!svg) return;
      let body = recolour(svg, null, ramp);
      if (ink) body = body.replace(/(fill|stroke)="#[0-9a-fA-F]{6}"/g, `$1="${ink}"`);
      span.innerHTML = body;
      const root = span.firstElementChild;
      if (root) { root.setAttribute('width', size); root.setAttribute('height', size); root.setAttribute('aria-hidden', 'true'); }
    });
    return span;
  }
}
