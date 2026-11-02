// The Preferences window on its Appearance page, over the full application. Geometry is measured
// from a screenshot of SolidCraft (?ref&scene=appearance overlays it); colours, radii, borders, blur
// and opacity are the resolved theme tokens. The theme's own options are laid out from the codec's
// option definitions, and every one of those controls writes back to the theme's option values.
import { el } from '../dom.js';
import { abs, card, rect, tag, textAt } from './kit.js';
import { appScene, fit, REFERENCE } from './app-scene.js';

export const APPEARANCE_REFERENCE = { w: 1458, h: 1009 };
const DIALOG = { w: 1006, h: 872 };
const HEAD = 47, FOOT = 55;
// The scrolling page starts here, in dialog coordinates (page coordinates are dialog minus this); its height follows the dialog's.
const PAGE = { x: 215, y: 47, w: 790 };

const NAV = [
  ['General', 'settings'],
  ['LOOK'], ['Appearance', 'settings_palette'], ['Layout', 'settings_monitor'], ['Graphics', 'display'],
  ['WORK'], ['Design', 'ws_design'], ['Sketch', 'sketch'], ['Tools', 'gear'],
  ['INPUT'], ['Navigation', 'nav_settings'], ['3D mouse', 'settings_mouse'], ['Shortcuts', 'settings_keyboard'],
  ['EXTEND'], ['Assistant', 'assistant'], ['Plugins', 'settings_plug']
];
// Centre y of each nav row, in dialog coordinates.
const NAV_Y = [72, 115, 150, 189, 228, 271, 306, 345, 383, 427, 461, 500, 538, 582, 617, 656];

// The built-in themes the carousel offers, with the few colours their thumbnails need.
const THEMES = [
  { name: 'Light', sub: 'Built in', bg: '#eceef1', panel: '#fbfcfd', line: '#c6ccd3', dot: '#3b7bd6', top: '#dfe3e8', left: '#b9bfc7', right: '#cdd2d8' },
  { name: 'Dark', sub: 'Built in', bg: '#1f2631', panel: '#2a323f', line: '#4a5565', dot: '#3b7bd6', top: '#8d97a6', left: '#5c6674', right: '#747e8d' },
  { name: 'System', sub: 'Follows the OS', split: true },
  { name: 'Gruvbox Dark', sub: 'Built in', bg: '#32302f', panel: '#3c3836', line: '#665c54', dot: '#d79921', top: '#bdae93', left: '#7c6f64', right: '#928374' },
  { name: 'Gruvbox Light', sub: 'Built in', bg: '#f2e5bc', panel: '#fbf1c7', line: '#d5c4a1', dot: '#d79921', top: '#bdae93', left: '#a89984', right: '#b8a98f' },
  { name: 'SolidCraft 95', sub: 'Built in', bg: '#008080', panel: '#c0c0c0', line: '#808080', dot: '#000080', top: '#ffffff', left: '#5e9ea0', right: '#9fd3d3' }
];

// Labels the application gives its standard options, where they differ from the theme file's.
const LABELS = { tab_fade_ms: 'Tab transition' };

const text = (value, x, cy, { size = 14, bold = false, dim = false, align = 'left', cls = '' } = {}) => {
  const node = textAt(value, x, cy, `${dim ? 'dim ' : ''}${bold ? 'pv-semibold ' : ''}${cls}`.trim(), align);
  node.style.fontSize = `${size}px`;
  return node;
};

const act = (node, attrs) => { Object.assign(node.dataset, attrs); node.classList.add('pv-act'); return node; };

function thumb(theme) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', 88); svg.setAttribute('height', 54); svg.setAttribute('viewBox', '0 0 88 54');
  const draw = c => `<rect width="88" height="54" rx="4" fill="${c.bg}"/><rect x="0" y="0" width="88" height="8" fill="${c.panel}"/>
    <circle cx="6" cy="4" r="1.6" fill="${c.dot}"/><circle cx="12" cy="4" r="1.6" fill="${c.dot}"/><circle cx="18" cy="4" r="1.6" fill="${c.dot}"/>
    <rect x="3" y="11" width="28" height="40" rx="2" fill="${c.panel}"/>
    ${[17, 23, 29, 35].map(y => `<rect x="6" y="${y}" width="${y % 12 ? 18 : 14}" height="2" rx="1" fill="${c.line}"/>`).join('')}
    <polygon points="58,17 69,23 58,29 47,23" fill="${c.top}"/><polygon points="47,23 58,29 58,42 47,36" fill="${c.left}"/><polygon points="58,29 69,23 69,36 58,42" fill="${c.right}"/>`;
  if (theme.split) {
    const light = THEMES[0], dark = THEMES[1];
    svg.innerHTML = `<defs><clipPath id="pv-half"><rect width="44" height="54"/></clipPath></defs>${draw(dark)}<g clip-path="url(#pv-half)">${draw(light)}</g>`;
  } else svg.innerHTML = draw(theme);
  svg.style.cssText = 'position:absolute;left:5px;top:7px;border-radius:max(0px,calc(var(--m-radius-lg) - 3px))';
  return svg;
}

/** The theme's own colours as a thumbnail, for the selected card. */
function ownTheme(t, name) {
  return { name, sub: 'This theme', bg: t.c('viewport_bottom'), panel: t.c('panel'), line: t.c('text_dim'), dot: t.c('accent'), top: t.c('cube_face'), left: t.c('text_dim'), right: t.c('icon') };
}

/** Group the option definitions into rows of at most two cells; a parent shares its row with its children. */
function optionRows(defs) {
  const kids = new Map(), top = [];
  for (const def of defs) {
    if (def.parent && defs.some(item => item.id === def.parent)) { if (!kids.has(def.parent)) kids.set(def.parent, []); kids.get(def.parent).push(def); } else top.push(def);
  }
  const rows = []; let pending = null;
  for (const def of top) {
    if (kids.has(def.id)) { if (pending) { rows.push([pending]); pending = null; } rows.push([def, ...kids.get(def.id)]); }
    else if (pending) { rows.push([pending, def]); pending = null; } else pending = def;
  }
  if (pending) rows.push([pending]);
  return rows;
}

const kindOf = def => (typeof def.type === 'string' ? def.type : def.kind?.type);
const labelOf = def => LABELS[def.id] || def.resolvedLabel || (typeof def.label === 'string' ? def.label : def.label?.en || def.id);
const choiceLabel = choice => (typeof choice.label === 'string' ? choice.label : choice.label?.en || choice.id);

/** A segmented control over `items` ([label, attrs]); `widths` are fixed, otherwise it splits `r` evenly. */
function segmented(r, items, selected, widths) {
  const node = abs('pv-seg', r);
  const inner = r.w - 2, even = inner / items.length;
  let x = 0;
  items.forEach(([label, attrs], i) => {
    const w = widths ? widths[i] : even;
    const seg = act(abs(`pv-segment${i === selected ? ' on' : ''}`, rect(x, 0, i === items.length - 1 ? inner - x : w, r.h - 2)), attrs);
    seg.append(text(label, w / 2, (r.h - 2) / 2, { bold: i === selected, align: 'center' }));
    node.append(seg); x += w;
  });
  return node;
}

/** A range: track, fill and thumb inside a 20 px-tall hit area. Dragging is handled by the preview. */
function range(def, value, r, active) {
  const min = def.min ?? 0, max = def.max ?? 100, f = max > min ? (value - min) / (max - min) : 0;
  const node = abs(`pv-rng${active ? '' : ' off'}`, rect(r.x, r.y - 10, r.w, 20));
  Object.assign(node.dataset, { opt: def.id, min, max, step: def.step || 1, unit: def.unit || '' });
  node.append(abs('pv-rtrack', rect(0, 8, r.w, 4)), abs('pv-rfill', rect(0, 8, f * r.w, 4)), abs('pv-rthumb', rect(f * r.w - 10, 0, 20, 20)));
  return node;
}

function optionCell(kit, def, values, cell, cy, active, bounds) {
  const t = kit.t, kind = kindOf(def), value = values[def.id] ?? def.default, label = labelOf(def);
  const dim = !active;
  const labelNode = text(label, cell.x, cy, { dim: dim || false });
  if (dim) labelNode.style.opacity = '.45';
  const nodes = [labelNode];
  const labelEnd = cell.x + kit.measure(label, 14);
  if (kind === 'bool') {
    const tog = act(abs(`pv-toggle${value ? ' on' : ''}${active ? '' : ' disabled'}`, rect(labelEnd + 23, cy - 10, 36, 20)), { act: 'opt', opt: def.id, val: JSON.stringify(!value) });
    tog.append(abs('pv-knob', rect(value ? 18 : 3, 3, 14, 14)));
    nodes.push(tog);
  } else if (kind === 'choice') {
    const items = (def.values || []).map(choice => [choiceLabel(choice), { act: 'opt', opt: def.id, val: JSON.stringify(choice.id) }]);
    const selected = Math.max(0, (def.values || []).findIndex(choice => choice.id === value));
    const left = labelEnd + 16;
    nodes.push(segmented(rect(left, cy - 16, bounds.x1 - left, 32), items, selected));
  } else if (kind === 'range') {
    const unit = def.unit || '', valueW = def.id === 'blur' ? 100 : 66;
    const small = cell.child;
    const left = labelEnd + 34;
    const right = small ? left + 37 : bounds.x1 - valueW;
    nodes.push(range(def, value, rect(left, cy, right - left, 20), active));
    const readout = text(`${value}${unit}`, right + (small ? 35 : 23), cy, { dim: dim || small });
    readout.dataset.valueFor = def.id;
    if (dim) readout.style.opacity = '.45';
    nodes.push(readout);
    if (def.id === 'blur') {
      // The strength gauge: five marks that rise and light up with the blur radius.
      const min = def.min ?? 0, max = def.max ?? 60, lit = Math.ceil(((value - min) / (max - min || 1)) * 5);
      const bars = abs('pv-bars', rect(bounds.x1 - 36, cy - 8, 32, 16));
      [2, 5, 8, 11, 14].forEach((h, i) => bars.append(abs(`pv-bar-i${i < lit ? ' on' : ''}`, rect(i * 7, 16 - h, 4, h))));
      nodes.push(bars);
    }
  }
  return nodes;
}

function optionsCard(kit, state, defs, values, y) {
  const t = kit.t, rows = optionRows(defs);
  const h = 76 + Math.max(0, rows.length - 1) * 48 + 26;
  const host = tag(abs('pv-prefcard', rect(26, y, 737, h)), 'Theme options', ['dialog_rule', 'dialog_border', 'control_fill', 'form_primary_fill', 'selected_bg']);
  // The options sit on an opaque surface: the dialog's own colour without its translucency.
  host.style.background = t.c('dialog_body').slice(0, 7);
  const title = text(state.themeName || 'Theme', 15, 28, { size: 14 });
  host.append(title, text(`${defs.length} option${defs.length === 1 ? '' : 's'}`, 15 + kit.measure(state.themeName || 'Theme', 14) + 8, 28, { dim: true, size: 13 }));
  const isActive = def => {
    if (!def.parent) return def.available !== false;
    const parent = defs.find(item => item.id === def.parent);
    const value = values[def.parent] ?? parent?.default;
    return def.available !== false && value === true;
  };
  const cells = [{ x: 15, x1: 359 }, { x: 378, x1: 722 }];
  rows.forEach((row, i) => {
    const cy = 76 + i * 48;
    row.forEach((def, j) => {
      const child = j > 0 && def.parent;
      const cell = child ? { x: 280, x1: 722, child: true } : cells[j] || cells[1];
      host.append(...optionCell(kit, def, values, { ...cell, child }, cy, isActive(def), cell));
    });
  });
  return { host, h };
}

function sectionHead(kit, label, cy, extra) {
  const nodes = [kit.chevron(33, cy, 'down'), text(label, 44, cy, { size: 12.5, bold: true, dim: true, cls: 'sec' })];
  const x = 44 + kit.measure(label, 12.5, 700) + label.length * 0.9 + 12;
  let end = x;
  if (extra) { nodes.push(text(extra, x, cy, { size: 13, dim: true })); end = x + kit.measure(extra, 13) + 14; }
  nodes.push(abs('pv-rule', rect(end, cy, 763 - end, 1)));
  return nodes;
}

function themeCarousel(kit, state, themes, selectedName, y) {
  const nodes = [], per = 6, offset = Math.min(state.prefs.themeOffset, Math.max(0, themes.length - per));
  const arrow = (x, dir, enabled) => {
    const node = act(abs(`pv-arrow${enabled ? '' : ' off'}`, rect(x, y, 30, 108)), { act: 'themes', dir });
    node.append(kit.chevron(15, 54, dir > 0 ? 'right' : 'left', enabled ? null : kit.t.c('text_dim')));
    return node;
  };
  nodes.push(arrow(26, -1, offset > 0), arrow(724, 1, offset + per < themes.length));
  themes.slice(offset, offset + per).forEach((theme, i) => {
    const selected = theme.name === selectedName;
    const c = tag(abs(`pv-theme${selected ? ' on' : ''}`, rect(66 + i * 110, y, 98, 108)), `Theme · ${theme.name}`, ['panel', 'border', 'selected_bg', 'text']);
    c.append(thumb(theme), text(theme.name, 49, 76, { align: 'center' }), text(theme.sub, 49, 93, { dim: true, size: 12, align: 'center' }));
    if (theme.own) c.classList.add('own');
    nodes.push(c);
  });
  return nodes;
}

function page(kit, state, size) {
  const t = kit.t, prefs = state.prefs, defs = state.options || [], values = state.optionValues || {};
  const body = el('div', { class: 'pv-ppage' });
  body.style.cssText = `left:${PAGE.x}px;top:${PAGE.y}px;width:${PAGE.w}px;height:${size.h - 2 - HEAD - FOOT}px`;
  const inner = el('div', { class: 'pv-ppage-in' });
  inner.style.height = '775px';
  body.append(inner);
  inner.append(text('Appearance', 26, 35, { size: 22.5, bold: true }), text('Colours, text and accessibility.', 26, 60, { dim: true, size: 13.5 }));
  const pill = abs('pv-pill', rect(673, 22, 91, 24));
  pill.append(text('In profile', 45.5, 12, { size: 13, dim: true, align: 'center' }));
  inner.append(pill);

  const themes = [...THEMES, { ...ownTheme(t, state.themeName || 'Theme'), own: true }];
  inner.append(...sectionHead(kit, 'THEME', 129, `${themes.length} themes`));
  inner.append(...themeCarousel(kit, state, themes, state.themeName || 'Theme', 158));
  const options = optionsCard(kit, state, defs, values, 285);
  inner.append(options.host);

  const y2 = 285 + options.h + 62;
  inner.append(...sectionHead(kit, 'VIEWPORT AND LOGO', y2));
  const rowY = i => y2 + 46 + i * 48;
  const choose = (key, items, widths, x = 214) => {
    const i = Math.max(0, items.findIndex(([, v]) => v === prefs[key]));
    return segmented(rect(x, 0, widths.reduce((a, b) => a + b, 2), 32), items.map(([label, v]) => [label, { act: 'pref', key, val: v }]), i, widths);
  };
  const place = (node, cy) => { node.style.top = `${cy - 16}px`; return node; };
  inner.append(text('Background', 26, rowY(0)), place(choose('background', [['Theme’s gradient', 'gradient'], ['Colour', 'colour']], [134, 131]), rowY(0)));
  const sw = abs(`pv-swatch${prefs.background === 'colour' ? '' : ' off'}`, rect(488, rowY(0) - 14, 36, 29));
  sw.style.background = prefs.bg;
  const hex = abs(`pv-field pv-hex${prefs.background === 'colour' ? '' : ' off'}`, rect(530, rowY(0) - 15, 109, 30));
  hex.append(text(prefs.bg, 10, 15, { cls: 'pv-mono', dim: prefs.background !== 'colour' }));
  inner.append(sw, hex);
  inner.append(text('3D view colours', 26, rowY(1)), place(choose('view3d', [['Theme’s own', 'own'], ['Light', 'light'], ['Dark', 'dark']], [134, 80, 106]), rowY(1)));
  inner.append(text('Logo', 26, rowY(2)), place(choose('logo', [['Theme’s colours', 'theme'], ['Accent', 'accent']], [128, 126]), rowY(2)));
  return body;
}

function nav(kit, size) {
  const host = abs('pv-pnav', rect(0, 0, PAGE.x, size.h - 2));
  NAV.forEach((entry, i) => {
    const cy = NAV_Y[i];
    if (entry.length === 1) { host.append(text(entry[0], 20, cy, { size: 12, bold: true, dim: true, cls: 'sec' })); return; }
    const on = entry[0] === 'Appearance';
    const row = abs(`pv-nav-row${on ? ' on' : ''}`, rect(9, cy - 18, 198, 37));
    row.append(kit.iconAt(entry[1], 18, 21, 18.5), text(entry[0], 40, 18.5, { size: 13 }));
    host.append(row);
  });
  return host;
}

function profile(kit, size) {
  const box = abs('pv-profile', rect(9, size.h - 2 - 120, 198, 54));
  box.append(text('PROFILE', 40, 17, { size: 11, bold: true, dim: true, cls: 'sec' }), text('None', 40, 35, { bold: true }), kit.chevron(179, 27, 'down'));
  return box;
}

function dialog(kit, state, rectangle) {
  const t = kit.t, values = state.optionValues || {}, defs = state.options || [];
  const host = tag(card('window', rectangle), 'Preferences', ['dialog_body', 'dialog_border', 'dialog_bg', 'dialog_footer', 'dialog_rule']);
  host.classList.add('pv-dialog', 'pv-prefs');
  host.append(abs('pv-dhead', rect(0, 0, rectangle.w - 2, HEAD)), abs('pv-dfoot', rect(0, rectangle.h - 2 - FOOT, rectangle.w - 2, FOOT)));
  host.append(kit.iconAt('settings', 20, 25, 24), text('Preferences', 46, 24, { size: 16, bold: true }));
  const search = tag(abs('pv-field pv-search', rect(693, 8, 264, 32)), 'Search preferences', ['control_fill', 'control_border', 'form_dim']);
  search.append(kit.iconAt('zoom', 14, 17, 16, { ink: t.c('form_dim') }), text('Search preferences', 31, 16, { dim: true }));
  const key = abs('pv-field pv-keycap2', rect(198, 5, 61, 22));
  key.append(text('Ctrl F', 30.5, 11, { size: 12, dim: true, align: 'center', cls: 'pv-mono' }));
  search.append(key);
  host.append(search, kit.iconAt('close', 16, 979, 24, { ink: t.c('text') }));
  host.append(abs('pv-rule full', rect(0, HEAD - 1, rectangle.w - 2, 1)), abs('pv-rule full', rect(0, rectangle.h - 2 - FOOT, rectangle.w - 2, 1)));
  host.append(nav(kit, rectangle), profile(kit, rectangle), page(kit, state, rectangle));
  const dirty = defs.some(def => (values[def.id] ?? def.default) !== def.default);
  host.append(act(text('Restore page defaults', 14, rectangle.h - 2 - FOOT / 2, { size: 14 }), { act: 'defaults' }));
  const footY = rectangle.h - 2 - FOOT + 12;
  const cancel = act(kit.button('Cancel', rect(759, footY, 71, 32)), { act: 'noop' });
  const apply = act(kit.button('Apply', rect(837, footY, 62, 32), { disabled: !dirty }), { act: 'noop' });
  const ok = act(kit.button('OK', rect(908, footY, 82, 32), { primary: true }), { act: 'noop' });
  host.append(cancel, apply, ok);
  return host;
}

export function appearanceScene(kit, stage, state, dev) {
  // The window is laid out and scaled exactly like the other scenes (their minimum size and zoom); only the dev
  // comparison uses the larger window the reference screenshot was taken in.
  const view = { reference: APPEARANCE_REFERENCE, dialog: false };
  const root = appScene(kit, stage, state, dev, 'app', view);
  const { w: W, h: H } = fit(stage, dev, APPEARANCE_REFERENCE);
  // The dialog is its measured size when the window is tall enough, and otherwise gives up height (the page scrolls).
  const h = Math.min(DIALOG.h, Math.max(780, H - 24));
  // Centred, with the small offset the real window shows (232, 62 in a 1458 x 1009 window).
  const rectangle = rect(Math.max(8, Math.round((W - DIALOG.w) / 2) + 6), Math.round((H - h) / 2) - (h === DIALOG.h ? 7 : 0), DIALOG.w, h);
  const ref = root.querySelector('.pv-ref');
  root.append(dialog(kit, state, rectangle));
  if (ref) { ref.style.width = `${APPEARANCE_REFERENCE.w}px`; ref.style.height = `${APPEARANCE_REFERENCE.h}px`; root.append(ref); }
  return root;
}
