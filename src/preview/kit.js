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

  /** Width of `text` in the preview's regular face at `size` px (what the cells size themselves by). */
  measure(text, size, weight = 400) {
    this._canvas ||= document.createElement('canvas').getContext('2d');
    this._canvas.font = `${weight} ${size}px Plex, system-ui, sans-serif`;
    return this._canvas.measureText(text).width;
  }

  /** The kit's chevron icon centred at (cx, cy); the artwork points down, so right and up rotate it. */
  chevron(cx, cy, dir = 'down', color = null) {
    const node = this.icons.el('chevron', 16, { ink: color || this.t.c('text_dim') });
    node.style.cssText += `;position:absolute;left:${px(cx - 8)};top:${px(cy - 8)};transform:rotate(${{ down: 0, right: -90, up: 180, left: 90 }[dir] ?? 0}deg)`;
    return node;
  }

  /** Text followed by the chevron icon, centred on or right-aligned to x (never a text glyph). */
  labelChevron(text, x, cy, className = '', align = 'center') {
    const node = el('div', { class: `pv-lc ${className}` }, el('span', { class: 'pv-t' }, text));
    node.append(this.icons.el('chevron', 14, { ink: this.t.c('text_dim') }));
    node.style.top = px(cy);
    if (align === 'right') { node.style.right = px(x); node.style.transform = 'translateY(-50%)'; }
    else { node.style.left = px(x); node.style.transform = 'translate(-50%,-50%)'; }
    return node;
  }

  /** The application bar: logo, project actions, the open design's tab and the window controls. */
  appBar(r, state) {
    const t = this.t, ink = t.c('app_bar_text'), cy = 17.5;
    const bar = tag(card('appbar', r), 'Application bar', ['app_bar', 'app_bar_text', 'app_bar_tab_active', 'app_bar_separator']);
    bar.append(el('img', { class: 'pv-abs', src: new URL('../../assets/brand/solidcraft-mark.svg', import.meta.url).href, alt: '', style: `left:7px;top:${px(cy - 12)};height:24px;width:21px` }));
    bar.append(textAt('SolidCraft', 33, cy, 'pv-semibold bar pv-fs16'));
    bar.append(this.iconAt('home', 20, 135, cy, { ink }), abs('pv-vrule', rect(158, 7, 1, 24)), textAt('File', 175, cy, 'bar pv-fs15'));
    [229, 267, 305].forEach((x, i) => bar.append(this.iconAt(['save', 'undo', 'redo'][i], 20, x, cy, { ink })));
    const tab = abs('pv-bartab', rect(347, 4, 133, 27));
    tab.append(textAt('Sample Plate', 9, 13.5, 'pv-semibold bar pv-fs15'), this.iconAt('close', 12, 117, 13.5, { ink }));
    bar.append(tab, this.iconAt('plus', 16, 499, cy, { ink }));
    const rx = r.w - 1276;
    [822, 861, 900].forEach((x, i) => bar.append(this.iconAt(['bug_report', 'settings', 'help'][i], 20, x + rx, cy, { ink })));
    const bug = abs('pv-bug', rect(922 + rx, 4, 146, 28));
    bug.append(this.iconAt('bug_report', 16, 15, 14, { ink }), textAt('Report a bug', 32, 14, 'bar pv-fs14'));
    bar.append(bug, textAt('v0.28.0', 1078 + rx, cy, 'dim pv-fs14'));
    const caption = (kind, cx) => svg(14, 14, { min: '<path d="M2 7h10"/>', max: '<rect x="2" y="2" width="10" height="10"/>', close: '<path d="M2 2l10 10M12 2L2 12"/>' }[kind], `left:${px(cx - 7)};top:${px(cy - 7)};fill:none;stroke:${ink};stroke-width:1`);
    bar.append(caption('min', r.w - 114), caption('max', r.w - 76), caption('close', r.w - 24));
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
      node.append(textAt(name, tabWidths[i] / 2, 13.5, `pv-fs14${on ? ' pv-semibold' : ''}`, 'center'));
      host.append(node);
    });
    host.append(this.iconAt('plus', 16, 902 - ox, 62 - oy, { ink: t.c('text_dim') }));
    // Search: a control_fill box (the form scope's field), the zoom icon, dim hint text and an S keycap.
    const searchW = 174, searchLeft = width - 9 - searchW;
    const search = tag(abs('pv-field pv-search', rect(searchLeft, 51 - oy, searchW, 24)), 'Search commands', ['control_fill', 'control_border', 'form_dim']);
    search.append(this.iconAt('zoom', 14, 13.3, 12, { ink: t.c('form_dim') }), textAt('Search commands', 28, 12, 'dim pv-fs15'));
    const key = abs('pv-keycap', rect(searchW - 15, 2.5, 11, 17));
    key.append(textAt('S', 5.5, 8.5, 'dim pv-fs13', 'center'));
    search.append(key);
    host.append(search);
    host.append(abs('pv-sep pv-hsep', rect(0, 78.5 - oy, width - 2, 1)));
    // Commands: every cell is a full-height box (icon and label) with the same gap to its neighbours.
    // Each section ends with a separator, including after the last one.
    const cellGap = 3.5, padRight = [1, 5, 6.5, 4, 4.5, 4.5];
    let x = 114, sectionLeft = 111;
    groups.forEach(([group, tools], g) => {
      const start = x;
      tools.forEach(([icon, label]) => {
        const w = Math.max(62, this.measure(label, 14) + 15), on = label === 'Extrude';
        const cell = tag(abs(`pv-tool${on ? ' on' : ''}`, rect(x - ox, 82 - oy, w, 68)), label, ['icon_palette.solid', 'icon_palette.line', 'selected_bg', 'hover']);
        cell.append(this.iconAt(icon, 27, w / 2, 17.5), textAt(label, w / 2, 45, 'pv-fs14', 'center'));
        host.append(cell);
        x += w + cellGap;
      });
      x -= cellGap;
      const centre = (start + x) / 2;
      const sepX = x + padRight[g];
      const sectionW = sepX - sectionLeft - 4;
      const pill = tag(abs('pv-glabel', rect(sectionLeft + 2 - ox, 151 - oy, sectionW, 22)), group, ['text_dim', 'hover']);
      pill.append(this.labelChevron(group, sectionW / 2, 11, 'dim pv-fs14'));
      host.append(pill);
      host.append(abs('pv-sep', rect(sepX - ox, 86 - oy, 1, 86)));
      x = sepX + 1 + 5;
      sectionLeft = sepX + 1;
    });
  }

  /** The Browser panel: title row and the document tree. */
  browser(host, width, rows, state) {
    host.append(textAt('Browser', 11, 19, 'pv-semibold pv-fs17'), this.labelChevron('1 body', 14, 19, 'dim pv-fs15', 'right'));
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

  /**
   * The signed-axis compass (the app's axis view): a 116 px box, a translucent disc of radius 49.5
   * with the border line, three hollow dimmed negative rings drawn first, the origin dot, then the
   * three positive axis discs with bold letters, and the home chip. Colours are the theme tokens.
   */
  navCube(r) {
    const t = this.t, rgba = (hex, k) => { const v = hex.replace('#', ''); return `rgba(${parseInt(v.slice(0, 2), 16)},${parseInt(v.slice(2, 4), 16)},${parseInt(v.slice(4, 6), 16)},${((v.length >= 8 ? parseInt(v.slice(6, 8), 16) : 255) / 255) * k})`; };
    const c = [r.x + r.w / 2, r.y + r.h / 2 - 4], R = 57;
    // Tip offsets in the default isometric view, with the artwork scaled to 84% of the axis length.
    const tips = [
      ['-x', -25.3, -13.3, 'axis_x', false], ['-y', -25.3, 16, 'axis_y', false], ['-z', 0.3, 30.7, 'axis_z', false],
      ['x', 26.3, 16, 'axis_x', true], ['y', 26.3, -13.5, 'axis_y', true], ['z', 0.3, -29.3, 'axis_z', true]
    ];
    let m = `<circle cx="${c[0]}" cy="${c[1]}" r="${R}" fill="${rgba(t.c('overlay'), 0.35)}" stroke="${rgba(t.c('border'), 0.55)}" stroke-width="1"/>`;
    tips.forEach(([name, dx, dy, key, positive], i) => {
      if (i === 3) m += `<circle cx="${c[0]}" cy="${c[1]}" r="3.4" fill="${rgba(t.c('text'), 0.9)}" stroke="${t.c('panel')}" stroke-width="1.2"/>`;
      const col = t.c(key), ink = positive ? col : rgba(col, 0.55);
      const at = [c[0] + dx, c[1] + dy], len = Math.hypot(dx, dy), radius = positive ? 12.7 : 6.3;
      const end = [at[0] - (dx / len) * (positive ? radius : radius + 1.4), at[1] - (dy / len) * (positive ? radius : radius + 1.4)];
      m += `<line x1="${c[0]}" y1="${c[1]}" x2="${end[0]}" y2="${end[1]}" stroke="${ink}" stroke-width="3.4"/><circle cx="${c[0]}" cy="${c[1]}" r="1.7" fill="${ink}"/>`;
      m += positive
        ? `<circle cx="${at[0]}" cy="${at[1]}" r="12.7" fill="${col}"/><text x="${at[0]}" y="${at[1]}" text-anchor="middle" dominant-baseline="central" font-family="Plex,system-ui,sans-serif" font-size="12.5" font-weight="700" fill="${t.c('on_accent')}">${name.toUpperCase()}</text>`
        : `<circle cx="${at[0]}" cy="${at[1]}" r="6.3" fill="none" stroke="${ink}" stroke-width="2.4"/>`;
    });
    const home = [c[0] - 37.7, c[1] - 41];
    m += `<circle cx="${home[0]}" cy="${home[1]}" r="11.2" fill="${rgba(t.c('overlay'), 0.5)}" stroke="${t.c('border')}" stroke-width="1"/>`;
    const node = svg(r.w, r.h, '', `left:${px(r.x)};top:${px(r.y)};overflow:visible`);
    node.setAttribute('viewBox', `${r.x} ${r.y} ${r.w} ${r.h}`); node.innerHTML = m;
    const wrap = tag(el('div', { class: 'pv-abs' }), 'Navigation compass', ['overlay', 'border', 'panel', 'text', 'axis_x', 'axis_y', 'axis_z', 'on_accent']);
    wrap.style.cssText = 'left:0;top:0;width:0;height:0'; wrap.append(node, this.iconAt('home', 14, home[0], home[1], { ink: t.c('icon') }));
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
    host.append(this.iconAt(icon, 24, 24, 23), textAt(title, 45, 23, 'pv-semibold pv-fs17'), this.iconAt('close', 16, r.w - 23, 23, { ink: this.t.c('text') }), grip);
    host.append(abs('pv-rule full', rect(0, headH - 1, r.w - 2, 1)), abs('pv-rule full', rect(0, r.h - 2 - footH, r.w - 2, 1)));
    return host;
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
    const ox = 4, cy = 21;
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

  /** The history transport glyphs, ported from the app's glyph source (tri/bar geometry around the centre). */
  transport(name) {
    const col = this.t.c('icon'), c = 14;
    const tri = (dir, dx) => `<polygon points="${c + dx - 4 * dir},${c - 5} ${c + dx + 4 * dir},${c} ${c + dx - 4 * dir},${c + 5}" fill="${col}"/>`;
    const bar = dx => `<line x1="${c + dx}" y1="${c - 5}" x2="${c + dx}" y2="${c + 5}" stroke="${col}" stroke-width="1.6"/>`;
    const shapes = {
      first: bar(-5) + tri(-1, 1), back: tri(-1, 0), forward: tri(1, 0), last: tri(1, -1) + bar(5),
      play: `<polygon points="${c - 4.5},${c - 7} ${c + 6.5},${c} ${c - 4.5},${c + 7}" fill="${col}"/>`
    };
    return svg(28, 28, shapes[name], 'left:0;top:0');
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
