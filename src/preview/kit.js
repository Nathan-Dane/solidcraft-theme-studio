// SolidCraft's widgets as DOM. Geometry and type sizes are measured from the real window (see
// app-scene.js); colours, radii, borders, blur and icon palettes are the resolved theme tokens
// (`--c-*`, `--m-*`) from the Rust codec. Elements the inspector can name carry `data-label` and
// `data-roles`.
import { el } from '../dom.js';

const px = value => `${Math.round(value * 100) / 100}px`;
const NS = 'http://www.w3.org/2000/svg';
export const rect = (x, y, w, h) => ({ x, y, w, h });

/** Tag an element so Inspect can report what it is and which theme roles paint it. */
export function tag(node, label, roles) {
  node.dataset.label = label; node.dataset.roles = roles.join(',');
  return node;
}

function place(node, r) {
  Object.assign(node.style, { left: px(r.x), top: px(r.y), width: px(r.w), height: px(r.h) });
  return node;
}

/** An absolutely positioned child, relative to its parent card. */
export function abs(className, r, ...children) { return place(el('div', { class: className }, ...children), r); }

/** A production surface: fill, themed borders (primary plus the inset line), radius, shadow, blur. */
export function card(kind, r, ...children) { return place(el('div', { class: `pv-card pv-${kind}` }, ...children), r); }

/** A single line of text vertically centred on `cy`, anchored at `x` (left, centre or right edge). */
export function textAt(text, x, cy, className = '', align = 'left') {
  const node = el('span', { class: `pv-t pv-at ${className}` }, text);
  node.style.top = px(cy);
  if (align === 'center') { node.style.left = px(x); node.style.transform = 'translate(-50%,-50%)'; }
  else if (align === 'right') { node.style.right = px(x); node.style.transform = 'translateY(-50%)'; }
  else { node.style.left = px(x); node.style.transform = 'translateY(-50%)'; }
  return node;
}

function svg(width, height, markup, style = '') {
  const node = document.createElementNS(NS, 'svg');
  node.setAttribute('width', width); node.setAttribute('height', height); node.setAttribute('viewBox', `0 0 ${width} ${height}`);
  node.style.cssText = `position:absolute;${style}`; node.innerHTML = markup;
  return node;
}

export class Kit {
  constructor(tokens, icons) { this.t = tokens; this.icons = icons; }

  /** An icon centred at (cx, cy), `size` px square. `ink` paints it in a single colour. */
  iconAt(name, size, cx, cy, options) {
    const node = this.icons.el(name, size, options);
    node.style.position = 'absolute'; node.style.left = px(cx - size / 2); node.style.top = px(cy - size / 2);
    return node;
  }

  chevron(cx, cy, dir = 'down', color = 'var(--c-text-dim)') {
    const node = el('span', { class: `pv-chev ${dir}` });
    node.style.cssText = `left:${px(cx - 3)};top:${px(cy - 3)};border-color:${color}`;
    return node;
  }

  /** The application bar: logo, project actions, the open design's tab and the window controls. */
  appBar(r, state) {
    const t = this.t, ink = t.c('app_bar_text'), cy = 17.5;
    const bar = tag(card('appbar', r), 'Application bar', ['app_bar', 'app_bar_text', 'app_bar_tab_active', 'app_bar_separator']);
    bar.append(svg(22, 22, `<path d="M11 1.5 20 6.5v9L11 20.5 2 15.5v-9z" fill="${t.c('cube_face')}" stroke="${ink}" stroke-width="1.4" stroke-linejoin="round"/><path d="M2 6.5 11 11.5 20 6.5M11 11.5v9" fill="none" stroke="${ink}" stroke-width="1.4"/>`, `left:${px(5)};top:${px(cy - 11)}`));
    bar.append(textAt('SolidCraft', 33, cy, 'pv-semibold bar pv-fs16'));
    bar.append(this.iconAt('home', 20, 135, cy, { ink }), abs('pv-vrule', rect(158, 7, 1, 24)), textAt('File', 175, cy, 'bar pv-fs15'));
    [229, 267, 305].forEach((x, i) => bar.append(this.iconAt(['save', 'undo', 'redo'][i], 20, x, cy, { ink })));
    const tab = abs('pv-bartab', rect(347, 4, 133, 27));
    tab.append(textAt('Sample Plate', 9, 13.5, 'pv-semibold bar pv-fs15'), this.iconAt('close', 12, 117, 13.5, { ink }));
    bar.append(tab, this.iconAt('plus', 16, 499, cy, { ink }));
    [822, 861, 900].forEach((x, i) => bar.append(this.iconAt(['bug_report', 'settings', 'help'][i], 20, x, cy, { ink })));
    const bug = abs('pv-bug', rect(922, 4, 146, 28));
    bug.append(this.iconAt('bug_report', 16, 15, 14, { ink }), textAt('Report a bug', 32, 14, 'bar pv-fs14'));
    bar.append(bug, textAt('v0.28.0', 1078, cy, 'dim pv-fs14'));
    bar.append(abs('pv-wc', rect(1156, 18, 12, 1)), abs('pv-wc box', rect(1195, 13, 11, 11)), svg(14, 14, `<path d="M1 1l12 12M13 1L1 13" stroke="${ink}" stroke-width="1.4"/>`, `left:${px(1245)};top:${px(cy - 7)}`));
    return bar;
  }

  /** Ribbon content: workspace tabs, search, and the grouped command rows. */
  ribbon(host, width, tabs, groups, state) {
    const t = this.t, ox = 110, oy = 46; // the card's padding-box origin in window coordinates
    const tabCentres = [149, 226, 316, 401, 478, 562, 637, 724, 833];
    const tabWidths = [71, 62, 78, 62, 66, 66, 52, 88, 80];
    tabs.forEach((name, i) => {
      const on = name.toUpperCase() === state.tab;
      const node = tag(abs(`pv-rtab${on ? ' on' : ''}`, rect(tabCentres[i] - tabWidths[i] / 2 - ox, 49 - oy, tabWidths[i], 27)), name.toUpperCase(), ['panel_header', 'accent_soft', 'text', 'text_dim', 'hover']);
      node.append(textAt(name, tabWidths[i] / 2, 13.5, 'pv-semibold pv-fs15', 'center'));
      host.append(node);
    });
    host.append(textAt('+', 902 - ox, 62 - oy, 'dim pv-fs17', 'center'));
    const searchLeft = 1091 - ox;
    const search = tag(abs('pv-field pv-search', rect(searchLeft, 51 - oy, Math.max(width - 12 - searchLeft, 120), 24)), 'Search commands', ['field', 'control_border']);
    search.append(svg(14, 14, `<circle cx="6" cy="6" r="4.2" fill="none" stroke="${t.c('text_dim')}" stroke-width="1.5"/><path d="M9.2 9.2L13 13" stroke="${t.c('text_dim')}" stroke-width="1.5"/>`, 'left:7px;top:5px'), textAt('Search commands', 29, 12, 'dim pv-fs14'), textAt('S', 8, 12, 'dim pv-fs14', 'right'));
    host.append(search);
    const centres = [[158], [240, 305, 371], [443, 509, 575, 645], [735, 812, 878], [960, 1048], [1146]];
    const groupCentre = [158, 304, 540, 793, 987, 1139];
    groups.forEach(([group, tools], g) => {
      tools.forEach(([icon, label], k) => {
        const cx = centres[g][k] - ox, on = label === 'Extrude';
        const cell = tag(abs(`pv-tool${on ? ' on' : ''}`, rect(cx - 31, 82 - oy, 62, 68)), label, ['icon_palette.solid', 'icon_palette.line', 'selected_bg', 'hover']);
        cell.append(this.iconAt(icon, 31, 31, 19), textAt(label, 31, 46, 'pv-fs14', 'center'));
        host.append(cell);
      });
      host.append(textAt(`${group} ⌄`, groupCentre[g] - ox, 162 - oy, 'dim pv-fs14', 'center'));
    });
    [406, 687, 913, 1096].forEach(x => host.append(abs('pv-sep', rect(x - ox, 86 - oy, 1, 86))));
  }

  /** The Browser panel: title row and the document tree. */
  browser(host, width, rows, state) {
    host.append(textAt('Browser', 11, 19, 'pv-semibold pv-fs17'), textAt('1 body', 25, 19, 'dim pv-fs15', 'right'), this.chevron(width - 17, 19));
    rows.forEach(([depth, text, icon, fold, eye, dim], i) => {
      if (i === 5 && !state.bodiesOpen) return;
      const cy = 245 - 189 + i * 29.9;
      const row = tag(abs('pv-row', rect(4, cy - 14, width - 10, 28)), text, ['text', 'text_dim', 'selected_bg', 'selected_ink', 'hover']);
      const base = [16, 33, 50][depth];
      if (fold !== null && fold !== undefined) row.append(this.chevron(base - 4, 14, fold ? 'down' : 'right'));
      const iconX = [63, 63, 82][depth] - 4, textX = [78, 78, 98][depth] - 4;
      if (depth === 0) row.append(el('span', { class: 'pv-radio', style: `left:${px(22)};top:${px(6)}` }));
      row.append(this.iconAt(icon, 18, iconX, 14, { opacity: dim ? 0.4 : 1 }), textAt(text, textX, 14, `pv-fs15${dim ? ' dim' : ''}`));
      if (eye !== null && eye !== undefined) row.append(this.iconAt(eye ? 'eye' : 'suppress', 18, width - 22, 14, { opacity: eye ? 1 : 0.5 }));
      host.append(row);
    });
  }

  /** The viewport navigation compass with its home button. */
  navCube(r) {
    const t = this.t, c = [r.x + r.w / 2 + 3, r.y + r.h / 2 + 2], R = r.w / 2 - 1;
    const axes = [['Z', 0, -29, 'axis_z', true], ['Y', 24, -13, 'axis_y', true], ['X', 24, 17, 'axis_x', true], ['', -24, -13, 'axis_x', false], ['', -24, 15, 'axis_y', false], ['', 0, 30, 'axis_z', false]];
    let marks = `<circle cx="${c[0]}" cy="${c[1]}" r="${R}" fill="${t.c('nav_viewport')}" stroke="${t.c('dialog_border')}"/>`;
    marks += `<path d="M${c[0]} ${c[1] - 29}V${c[1] + 30}M${c[0] - 24} ${c[1] - 13}L${c[0] + 24} ${c[1] + 17}M${c[0] - 24} ${c[1] + 15}L${c[0] + 24} ${c[1] - 13}" stroke="${t.c('cube_border')}" stroke-width="2" fill="none"/>`;
    for (const [letter, dx, dy, key, on] of axes) {
      const x = c[0] + dx, y = c[1] + dy;
      marks += on ? `<circle cx="${x}" cy="${y}" r="10" fill="${t.c(key)}"/><text x="${x}" y="${y + 0.5}" text-anchor="middle" dominant-baseline="middle" font-size="13" font-weight="700" fill="#1a1c1e">${letter}</text>`
        : `<circle cx="${x}" cy="${y}" r="7" fill="none" stroke="${t.c(key)}" stroke-width="2"/>`;
    }
    marks += `<circle cx="${r.x + 15}" cy="${r.y + 12}" r="12" fill="${t.c('nav_viewport')}" stroke="${t.c('dialog_border')}"/>`;
    const node = svg(r.w + 8, r.h + 8, '', `left:${px(r.x - 2)};top:${px(r.y - 2)}`);
    node.setAttribute('viewBox', `${r.x - 2} ${r.y - 2} ${r.w + 8} ${r.h + 8}`); node.innerHTML = marks;
    const home = this.iconAt('home', 14, r.x + 15, r.y + 12, { ink: t.c('icon') });
    const wrap = tag(el('div', { class: 'pv-abs' }), 'Navigation cube', ['cube_face', 'cube_border', 'cube_text', 'cube_hover']);
    wrap.style.cssText = 'left:0;top:0;width:0;height:0'; wrap.append(node, home);
    return wrap;
  }

  /** The bottom navigation toolbar. */
  navToolbar(r) {
    const t = this.t, ink = t.c('icon');
    const host = tag(card('nav', r), 'Navigation toolbar', ['nav_viewport', 'dialog_body', 'dialog_border']);
    const items = [['orbit', 619, 'orbit'], ['pan', 658, ''], ['zoom', 697, ''], ['fit', 749, ''], ['lookat', 788, ''], ['home', 827, ''], ['style_shaded', 878, 'menu'], ['display', 936, 'menu']];
    items.forEach(([name, cx, kind]) => {
      const x = cx - 598 - 1, menu = kind === 'menu';
      const button = tag(abs(`pv-nav${kind === 'orbit' ? ' on' : ''}`, rect(x - 16 - (menu ? 8 : 0), 4, menu ? 56 : 32, 33)), name, ['nav_viewport', 'nav_hover', 'nav_press', 'nav_dim', 'icon']);
      button.append(this.iconAt(name, 20, 16 + (menu ? 8 : 0), 16.5, { ink }));
      if (menu) button.append(this.chevron(43, 17));
      host.append(button);
    });
    [722, 849].forEach(x => host.append(abs('pv-vrule', rect(x - 598 - 1, 9, 1, 23))));
    return host;
  }

  /**
   * A feature dialog: header band with icon, title and close (the drag handle), a body the caller
   * fills in dialog-local coordinates, and a footer band. Returns the card.
   */
  dialog({ title, icon, rect: r, label }) {
    const headH = 47, footH = 54;
    const host = tag(card('window', r), label, ['dialog_body', 'dialog_border', 'dialog_bg', 'dialog_footer', 'dialog_rule']);
    host.classList.add('pv-dialog');
    host.append(abs('pv-dhead', rect(0, 0, r.w - 2, headH)), abs('pv-dfoot', rect(0, r.h - 2 - footH, r.w - 2, footH)));
    const grip = abs('pv-drag', rect(0, 0, r.w - 2, headH)); grip.dataset.drag = '1';
    host.append(this.iconAt(icon, 24, 24, 23), textAt(title, 45, 23, 'pv-semibold pv-fs17'), this.closeX(r.w - 23, 23), grip);
    host.append(abs('pv-rule full', rect(0, headH - 1, r.w - 2, 1)), abs('pv-rule full', rect(0, r.h - 2 - footH, r.w - 2, 1)));
    return host;
  }

  closeX(cx, cy) {
    return svg(14, 14, `<path d="M2 2l10 10M12 2L2 12" stroke="${this.t.c('text')}" stroke-width="1.4" stroke-linecap="round"/>`, `left:${px(cx - 7)};top:${px(cy - 7)}`);
  }

  /** A label and its control on one form row: the label is vertically centred on the control. */
  formRow(host, text, y, control, { labelX = 14, controlX = 103, controlW = 180, h = 30 } = {}) {
    host.append(textAt(text, labelX, y + h / 2, 'pv-fs15'));
    host.append(control(rect(controlX, y, controlW, h)));
  }

  /** A text or number field. `mono` uses the monospace face the kit uses for numbers. */
  textField(value, r, { mono = false, focus = false, label = value } = {}) {
    const node = tag(abs(`pv-field${focus ? ' focus' : ''}`, r), label, ['field', 'control_fill', 'form_ink', 'control_border']);
    node.append(textAt(value, 10, r.h / 2, `pv-fs14${mono ? ' pv-mono' : ''}`));
    return node;
  }

  /** A drop-down showing `value`. */
  select(value, r, label = value) {
    const node = this.textField(value, r, { label });
    node.append(this.chevron(r.w - 14, r.h / 2));
    return node;
  }

  /** A collapsible section's header: chevron, caption and a rule to the right edge. */
  sectionHeader(host, text, y, open, width) {
    host.append(this.chevron(19, y, open ? 'down' : 'right'), textAt(text, 31, y, 'pv-semibold pv-fs13 dim sec'));
    const left = 31 + text.length * 8.1 + 13;
    host.append(abs('pv-rule', rect(left, y, width - 16 - left, 1)));
  }

  /** The Extrude feature dialog, in its own coordinates. */
  extrudeDialog(r, state) {
    const host = this.dialog({ title: 'Extrude', icon: 'extrude', rect: r, label: 'Extrude dialog' });
    const rows = [['Profiles', 'Select'], ['Direction', state.form.direction], ['Extent Type', state.form.extent], ['Distance', '10 mm'], ['Operation', state.form.operation]];
    rows.forEach(([label, value], i) => {
      this.formRow(host, label, 66 + i * 38, field => (i === 0 ? this.textField(value, field, { focus: true, label }) : i === 3 ? this.textField(value, field, { mono: true, label }) : this.select(value, field, label)));
    });
    this.sectionHeader(host, 'OPTIONS', 272, true, r.w - 2);
    host.append(this.checkbox('Thin Extrude', rect(14, 299, 130, 20), false), this.checkbox('Reverse Direction', rect(154, 299, 150, 20), false));
    this.sectionHeader(host, 'ADVANCED', 349, false, r.w - 2);
    host.append(this.button('Cancel', rect(124, 396, 72, 30)), this.button('OK', rect(202, 396, 80, 30), { primary: true, disabled: true }));
    return host;
  }

  /** The History strip. */
  historyStrip(host, r, items, state) {
    const ox = r.x + 1, cy = 21;
    for (let i = 0; i < 6; i++) host.append(abs('pv-grip', rect(14 - ox + r.x + (i % 2) * 4, 14 + Math.floor(i / 2) * 4 - 1, 2, 2)));
    host.append(textAt('History', 33 - ox, cy, 'pv-semibold pv-fs17'));
    ['first', 'back', 'play', 'forward', 'last'].forEach((name, i) => {
      const cx = [114, 145, 174, 204, 233][i] - ox;
      host.append(abs('pv-transport', rect(cx - 14, cy - 14, 28, 28), this.transport(name)));
    });
    items.forEach((icon, i) => {
      const cx = 282 + i * 36.5 - ox;
      host.append(this.historyChip(icon, rect(cx - 17, cy - 18, 35, 36), i === state.history));
    });
    host.append(abs('pv-playhead', rect(602 - ox, cy - 16, 2, 34)));
  }

  historyChip(name, r, selected) {
    const node = tag(abs(`pv-chip${selected ? ' on' : ''}`, r), name, ['timeline_item', 'hover', 'selected_bg']);
    node.append(this.iconAt(name, 26, r.w / 2, r.h / 2));
    return node;
  }

  transport(name) {
    const shapes = { first: 'M4 4h2v12H4zM16 4v12L7 10z', back: 'M14 4v12L5 10z', play: 'M5 3l12 7L5 17z', forward: 'M6 4v12l9-6z', last: 'M14 4h2v12h-2zM4 4l9 6-9 6z' };
    return svg(20, 20, `<path d="${shapes[name]}" fill="${this.t.c('text')}"/>`, 'left:4px;top:4px');
  }

  button(text, r, { primary = false, disabled = false } = {}) {
    const node = tag(abs(`pv-btn${primary ? ' primary' : ''}${disabled ? ' disabled' : ''}`, r), text, ['control_fill', 'control_border', 'form_primary_fill']);
    node.append(textAt(text, r.w / 2, r.h / 2, 'pv-fs14', 'center'));
    return node;
  }

  checkbox(text, r, checked) {
    const node = tag(abs('pv-check', r), text, ['control_fill', 'control_border', 'form_primary_fill']);
    node.append(el('span', { class: `pv-box${checked ? ' on' : ''}`, style: `top:${px(r.h / 2 - 8)}` }), textAt(text, 23, r.h / 2, 'pv-fs14'));
    return node;
  }
}
