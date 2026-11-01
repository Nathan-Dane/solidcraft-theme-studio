// The component scenes (everything except the full-app view): each is a card of real SolidCraft
// kit parts at their measured sizes, painted from the theme tokens. "All scenes" lays them on a
// board. Contents follow the app's own sample scenes (theme_studio_scenes.rs).
import { el } from '../dom.js';
import { abs, card, rect, tag, textAt } from './kit.js';

const PAD = 12, HEAD = 56;

/** A scene card: title, one-line description and a body the builder fills in card-local coordinates. */
function sceneCard(kit, { id, title, description, w, h, kind = 'panel' }, body) {
  const host = tag(card(kind, rect(0, 0, w, h)), title, ['panel', 'dialog_body', 'border', 'dialog_border', 'text', 'text_dim']);
  host.dataset.scene = id;
  host.append(textAt(title, PAD, 22, 'pv-semibold pv-fs17'), textAt(description, PAD, 43, 'dim pv-fs13'));
  body(host, w - 2 - 2 * PAD);
  return host;
}

const slider = (kit, host, r, fraction, label = 'Slider') => {
  const t = kit.t, node = tag(abs('pv-slider', r), label, ['dialog_rule', 'form_primary', 'control_fill']);
  node.append(abs('pv-track', rect(0, r.h / 2 - 2, r.w, 4)), abs('pv-fill', rect(0, r.h / 2 - 2, r.w * fraction, 4)), abs('pv-thumb', rect(r.w * fraction - 8, r.h / 2 - 8, 16, 16)));
  host.append(node);
  return node;
};

const segmented = (kit, host, r, labels, selected, label) => {
  const node = tag(abs('pv-seg', r), label, ['control_fill', 'control_border', 'form_primary']);
  const w = r.w / labels.length;
  labels.forEach((text, i) => { const seg = abs(`pv-segment${i === selected ? ' on' : ''}`, rect(i * w, 0, w, r.h)); seg.append(textAt(text, w / 2, r.h / 2, 'pv-fs14', 'center')); node.append(seg); });
  host.append(node);
};

// ---- Tools & tabs: the Workspace strip ----
function tools(kit, host) {
  host.append(kit.select('Workspace: MODEL', rect(PAD, HEAD + 6, 220, 30), 'Workspace tab'));
  [['extrude', 'Extrude'], ['hole', 'Hole'], ['fillet', 'Fillet'], ['surface_loft', 'Surface loft'], ['flange', 'Flange']].forEach(([icon, label], i) => {
    const w = Math.max(62, kit.measure(label, 14) + 15);
    const x = PAD + [0, 66, 132, 198, 285][i];
    const cell = tag(abs(`pv-tool${i === 0 ? ' on' : ''}`, rect(x, HEAD + 52, w, 68)), label, ['icon_palette.solid', 'icon_palette.surface', 'icon_palette.line', 'selected_bg']);
    cell.append(kit.iconAt(icon, 27, w / 2, 17.5), textAt(label, w / 2, 45, 'pv-fs14', 'center'));
    host.append(cell);
  });
  const nav = tag(card('nav', rect(PAD, HEAD + 136, 168, 40)), 'Navigation bar', ['nav_viewport', 'dialog_body', 'dialog_border']);
  [['pan', 20, ''], ['fit', 54, ''], ['style_shaded', 104, 'menu']].forEach(([name, cx, kind]) => {
    const b = tag(abs(`pv-nav${name === 'pan' ? ' on' : ''}`, rect(cx - 16, 4, kind ? 56 : 32, 33)), name, ['nav_viewport', 'nav_hover', 'nav_press', 'icon']);
    b.append(kit.iconAt(name, 20, kind ? 24 : 16, 16.5, { ink: kit.t.c('icon') }));
    if (kind) b.append(kit.chevron(43, 17));
    nav.append(b);
  });
  host.append(nav, kit.button('Disabled command', rect(PAD, HEAD + 192, 150, 30), { disabled: true }));
}

// ---- Browser & history ----
function browser(kit, host, inner) {
  const rows = [[0, 'Bodies', 'folder', true, null, false, '3'], [1, 'Mounting plate', 'body', null, true, false], [1, 'Bend flange', 'flange', null, true, false, null, 'warning'], [1, 'Hidden reference', 'sketch', null, false, true]];
  rows.forEach(([depth, text, icon, fold, eye, dim, count, status], i) => {
    const row = tag(abs(`pv-row${i === 1 ? ' on' : ''}`, rect(PAD - 4, HEAD + 4 + i * 30, inner + 8, 28)), text, ['text', 'text_dim', 'selected_bg', 'selected_ink', 'hover', 'warning']);
    const base = 14 + depth * 18;
    if (fold !== null && fold !== undefined) row.append(kit.chevron(base - 2, 14, fold ? 'down' : 'right'));
    row.append(kit.iconAt(icon, 18, base + 17, 14, { opacity: dim ? 0.4 : 1 }), textAt(text, base + 32, 14, `pv-fs15${dim ? ' dim' : ''}`));
    if (count) row.append(textAt(count, 38, 14, 'dim pv-fs14', 'right'));
    if (status) row.append(kit.iconAt('warning', 16, inner - 40, 14));
    if (eye !== null && eye !== undefined) row.append(kit.iconAt(eye ? 'eye' : 'suppress', 18, inner - 10, 14, { opacity: eye ? 1 : 0.5 }));
    host.append(row);
  });
  const y = HEAD + 4 + 4 * 30 + 14;
  host.append(textAt('History', PAD, y, 'pv-semibold pv-fs15'), abs('pv-rule', rect(PAD + 62, y, inner - 62, 1)));
  [['sketch', 0], ['extrude', 1], ['fillet', 2]].forEach(([icon, i]) => host.append(kit.historyChip(icon, rect(PAD + i * 40, y + 20, 36, 38), i === 1)));
  ['first', 'back', 'play', 'forward', 'last'].forEach((name, i) => host.append(abs('pv-transport', rect(PAD + i * 32, y + 70, 28, 28), kit.transport(name))));
}

// ---- Feature controls: the inspector, with the theme's option controls ----
function controls(kit, host, inner, state) {
  const t = kit.t;
  const rows = [['Name', 'Mounting plate', false], ['Distance', '24.0 mm', true]];
  rows.forEach(([label, value, mono], i) => kit.formRow(host, label, HEAD + 4 + i * 38, r => kit.textField(value, r, { mono, label }), { controlX: 100, controlW: inner - 88 }));
  kit.formRow(host, 'Draft', HEAD + 4 + 76, r => slider(kit, host, r, 0.24, 'Slider'), { controlX: 100, controlW: inner - 88 });
  host.append(kit.checkbox('Symmetric', rect(PAD, HEAD + 4 + 114, 150, 20), true));
  host.append(kit.button('Apply', rect(PAD, HEAD + 146, 72, 30), { primary: true }), kit.button('Cancel', rect(PAD + 80, HEAD + 146, 72, 30)), kit.button('Disabled', rect(PAD + 160, HEAD + 146, 80, 30), { disabled: true }));
  let y = HEAD + 196;
  host.append(abs('pv-rule', rect(0, y - 8, inner + 2 * PAD, 1)));
  for (const def of state.options || []) {
    const kind = typeof def.type === 'string' ? def.type : def.kind?.type;
    const label = def.resolvedLabel || (typeof def.label === 'string' ? def.label : def.label?.en || def.id);
    const value = state.optionValues?.[def.id] ?? def.default;
    const active = def.active !== false && def.available !== false;
    const cls = active ? '' : ' disabled';
    host.append(textAt(label, PAD, y + 14, `pv-fs14${active ? '' : ' dim'}`));
    if (kind === 'range') {
      const min = def.min ?? 0, max = def.max ?? 100, f = max > min ? (value - min) / (max - min) : 0;
      const s = slider(kit, host, rect(150, y, inner - 150 - 50 + PAD, 28), Math.min(Math.max(f, 0), 1), label); s.classList.toggle('disabled', !active);
      host.append(textAt(`${value}${def.unit || ''}`, PAD, y + 14, 'dim pv-fs13 pv-mono', 'right'));
    } else if (kind === 'bool') {
      const sw = abs(`pv-toggle${value ? ' on' : ''}${cls}`, rect(150, y + 5, 34, 18)); sw.append(abs('pv-knob', rect(value ? 18 : 2, 2, 14, 14))); host.append(sw);
    } else if (kind === 'choice') {
      const labels = (def.values || []).map(c => typeof c.label === 'string' ? c.label : c.label?.en || c.id);
      const sel = (def.values || []).findIndex(c => c.id === value);
      segmented(kit, host, rect(150, y, Math.min(inner - 150 + PAD, labels.length * 92), 28), labels, sel, label);
    }
    y += 36;
  }
  if (!(state.options || []).length) host.append(textAt('This theme does not declare any options.', PAD, y + 12, 'dim pv-fs14'));
}

// ---- Glass & menus: surfaces over detailed content ----
function glass(kit, host, inner) {
  for (let i = 0; i < 4; i++) {
    const bar = abs('pv-bar', rect(PAD, HEAD + 4 + i * 24, inner, 20));
    bar.style.background = i % 2 === 0 ? kit.t.c('selected_bg') : kit.t.c('panel_header');
    bar.append(kit.iconAt('sketch', 16, 11, 10), textAt(`Detailed content layer ${i + 1}`, 28, 10, 'pv-fs13'));
    host.append(bar);
  }
  host.append(kit.button('Open menu', rect(PAD, HEAD + 112, 110, 30)), kit.button('Open modal', rect(PAD + 118, HEAD + 112, 110, 30)), kit.button('Hover for tooltip', rect(PAD + 236, HEAD + 112, 140, 30)));
  const menu = tag(card('popup', rect(PAD, HEAD + 146, 190, 124)), 'Menu', ['dialog_body', 'form_ink', 'selected_bg', 'hover']);
  [['open', 'Open'], ['copy', 'Copy'], ['delete', 'Delete'], ['advanced', 'Advanced…']].forEach(([icon, text], i) => {
    const item = tag(abs(`pv-mitem${i === 1 ? ' on' : ''}`, rect(4, 4 + i * 28, 180, 26)), text, ['dialog_body', 'form_ink', 'selected_bg', 'hover']);
    item.append(kit.iconAt(icon === 'advanced' ? 'settings' : icon, 16, 16, 13), textAt(text, 32, 13, 'pv-fs14'));
    if (icon === 'advanced') item.append(kit.chevron(168, 13, 'right'));
    menu.append(item);
  });
  const sub = tag(card('popup', rect(PAD + 186, HEAD + 202, 170, 36)), 'Submenu row', ['dialog_body', 'form_ink', 'hover']);
  const sitem = abs('pv-mitem', rect(4, 4, 160, 26)); sitem.append(kit.iconAt('lookat', 16, 16, 13), textAt('Inspect details', 32, 13, 'pv-fs14')); sub.append(sitem);
  const tip = tag(card('popup', rect(PAD + 236, HEAD + 148, 270, 30)), 'Tooltip', ['dialog_body', 'dialog_border', 'text']);
  tip.append(textAt('Production tooltip, including native timing', 10, 15, 'pv-fs13'));
  const nested = tag(card('panel', rect(PAD, HEAD + 290, inner, 52)), 'Nested backing surface', ['panel', 'border', 'text']);
  nested.append(textAt('Nested backing surface', 10, 16, 'pv-fs14'), textAt('The ordered compositor samples the content below each surface.', 10, 36, 'dim pv-fs13'));
  host.append(menu, sub, tip, nested);
}

// ---- Viewport token study: grid, a sketch with dimensions, snap markers and the compass ----
function viewport(kit, host, inner) {
  const t = kit.t, h = 250, w = inner, NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('width', w); svg.setAttribute('height', h);
  svg.style.cssText = `position:absolute;left:${PAD}px;top:${HEAD}px;border-radius:8px;background:linear-gradient(${t.c('viewport_top')},${t.c('viewport_bottom')})`;
  tag(svg, 'Viewport token study', ['grid', 'grid_major', 'axis_x', 'axis_y', 'body_edge', 'sel_edge', 'sketch', 'dimension']);
  const s = Math.min(w / 95, h / 80), o = [w * 0.3, h * 0.68];
  const X = u => o[0] + u * s, Y = u => o[1] - u * s;
  let m = '';
  for (let i = -30; i <= 60; i += 5) {
    const major = i % 25 === 0;
    m += `<line x1="${X(i)}" y1="0" x2="${X(i)}" y2="${h}" stroke="${major ? t.c('grid_major') : t.c('grid')}" stroke-width="${major ? 1.2 : 0.8}"/><line x1="0" y1="${Y(i)}" x2="${w}" y2="${Y(i)}" stroke="${major ? t.c('grid_major') : t.c('grid')}" stroke-width="${major ? 1.2 : 0.8}"/>`;
  }
  m += `<line x1="0" y1="${o[1]}" x2="${w}" y2="${o[1]}" stroke="${t.c('axis_x')}" stroke-width="1.5"/><line x1="${o[0]}" y1="0" x2="${o[0]}" y2="${h}" stroke="${t.c('axis_y')}" stroke-width="1.5"/>`;
  m += `<polygon points="${X(0)},${Y(0)} ${X(40)},${Y(0)} ${X(40)},${Y(25)} ${X(0)},${Y(25)}" fill="${t.c('sel_profile')}" stroke="${t.c('sketch')}" stroke-width="1.5"/>`;
  m += `<line x1="${X(0)}" y1="${Y(0)}" x2="${X(40)}" y2="${Y(0)}" stroke="${t.c('sel_edge_rim')}" stroke-width="4"/><line x1="${X(0)}" y1="${Y(0)}" x2="${X(40)}" y2="${Y(0)}" stroke="${t.c('sel_edge')}" stroke-width="2"/>`;
  m += `<line x1="${X(40)}" y1="${Y(0)}" x2="${X(40)}" y2="${Y(25)}" stroke="${t.c('hover_edge_halo')}" stroke-width="4"/><line x1="${X(40)}" y1="${Y(0)}" x2="${X(40)}" y2="${Y(25)}" stroke="${t.c('hover_edge')}" stroke-width="2"/>`;
  m += `<circle cx="${X(20)}" cy="${Y(12.5)}" r="${7 * s}" fill="none" stroke="${t.c('sketch_fixed')}" stroke-width="1.5"/><line x1="${X(-8)}" y1="${Y(12.5)}" x2="${X(48)}" y2="${Y(12.5)}" stroke="${t.c('sketch_construction')}" stroke-width="1" stroke-dasharray="6 4"/>`;
  [[0, 0], [40, 0], [40, 25], [0, 25]].forEach(([x, y], i) => { m += `<circle cx="${X(x)}" cy="${Y(y)}" r="3" fill="${i === 0 ? t.c('sketch_point') : t.c('sketch_point_free')}"/>`; });
  const dim = (y, text, color) => `<line x1="${X(0)}" y1="${Y(y)}" x2="${X(40)}" y2="${Y(y)}" stroke="${color}" stroke-width="1"/><text x="${X(20)}" y="${Y(y) - 4}" text-anchor="middle" font-size="12" fill="${color}" font-family="Plex,system-ui,sans-serif">${text}</text>`;
  m += dim(-9, '40 mm', t.c('dimension')) + dim(-20, '(40 mm)', t.c('dimension_driven'));
  svg.innerHTML = m;
  host.append(svg, kit.navCube(rect(PAD + w - 120, HEAD + 4, 116, 116)));
}

// ---- Icon lab & file cards ----
function icons(kit, host, inner, state) {
  host.append(textAt('Device pixels · scale ' + (window.devicePixelRatio || 1).toFixed(2) + '×', PAD, HEAD + 2, 'dim pv-fs13'));
  const list = [['extrude', 'solid'], ['surface_loft', 'surface'], ['arc_slot', 'sketch'], ['coil', 'solid'], ['bendtable', 'solid'], ['interference', 'component-orange-1'], ['c_parallel', 'constraint'], ['plane_midplane', 'construction']];
  list.forEach(([id], i) => {
    const y = HEAD + 22 + i * 40, on = i === (state.iconSelected ?? 0);
    const chip = tag(abs(`pv-chip${on ? ' on' : ''}`, rect(PAD, y, 130, 32)), id, ['icon_palette.line', 'icon_palette.ink', 'selected_bg']);
    chip.append(textAt(id, 10, 16, 'pv-fs13'));
    host.append(chip);
    [16, 24, 32, 48].forEach((px, k) => host.append(kit.iconAt(id, px, PAD + 160 + [0, 40, 84, 140][k] + px / 2, y + 16)));
    host.append(kit.iconAt(id, 24, PAD + 160 + 214, y + 16, { opacity: 0.4 }));
  });
  const y = HEAD + 22 + list.length * 40 + 8;
  const tile = tag(abs('pv-filecard', rect(PAD, y, inner, 56)), 'File action card', ['file_primary', 'file_primary_ink', 'file_primary_border', 'file_surface']);
  tile.append(kit.iconAt('new', 28, 30, 28), textAt('New design', 56, 20, 'pv-semibold pv-fs15'), textAt('Actual File-page action card', 56, 40, 'dim pv-fs13'));
  host.append(tile);
}

const SCENES = {
  tools: { title: 'Workspace strip', description: 'Tabs, semantic tool colours and navigation controls', h: 330, build: tools },
  browser: { title: 'Browser & History', description: 'Fold, hide, select and inspect the actual dense rows', h: 420, build: browser },
  controls: { title: 'Feature inspector', description: 'Actual fields, sliders, disabled states and theme options', h: 640, build: controls },
  glass: { title: 'Layered surfaces', description: 'Real menus, submenus, tooltips and a modal over detailed content', h: 410, build: glass },
  viewport: { title: 'Viewport token study', description: 'Analytic geometry with the production grid, dimensions, snap markers and compass', h: 330, build: viewport },
  icons: { title: 'Icon lab & File cards', description: 'Original SVG geometry, knockout, masks and optical variants', h: 470, build: icons }
};
const ORDER = ['tools', 'browser', 'controls', 'glass', 'viewport', 'icons'];

function board(kit, stage, state, ids) {
  const root = el('div', { class: 'pv-board' });
  const gap = 12, two = ids.length > 1 && stage.w >= 840;
  const colW = Math.max(320, two ? Math.floor((stage.w - 3 * gap) / 2) : Math.min(stage.w - 2 * gap, 760));
  const colY = [gap, gap];
  ids.forEach((id, i) => {
    const spec = SCENES[id], col = two ? (colY[0] <= colY[1] ? 0 : 1) : 0;
    const node = sceneCard(kit, { id, title: spec.title, description: spec.description, w: colW, h: spec.h }, (host, inner) => spec.build(kit, host, inner, state));
    node.style.left = `${gap + (two ? col * (colW + gap) : Math.max(0, (stage.w - colW) / 2 - gap))}px`;
    node.style.top = `${colY[col]}px`;
    colY[col] += spec.h + gap;
    root.append(node);
  });
  root.style.height = `${Math.max(...colY)}px`;
  return root;
}

const build = ids => (kit, stage, state) => board(kit, stage, state, ids);
export const scenes = { all: build(ORDER), ...Object.fromEntries(ORDER.map(id => [id, build([id])])) };
