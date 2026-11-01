// The sketch-mode window: the Sketch ribbon, the collapsed Browser, the status line, the sketch
// properties panel, the Top-view compass, navigation toolbar and history over a face-on sketch.
// Geometry is measured from a screenshot of SolidCraft's sketch mode (?ref&scene=sketch overlays
// it); colours, radii, borders and icon palettes are the resolved theme tokens.
import { el } from '../dom.js';
import { abs, card, rect, tag, textAt } from './kit.js';
import { sketchView } from './sketch.js';

export const SKETCH_REFERENCE = { w: 1288, h: 854 };
const M = 7;
const TABS = [['Model', 146, 71], ['Surface', 224, 62], ['Assemble', 314, 78], ['Insert', 399, 62], ['Inspect', 475, 66], ['Manage', 559, 66], ['View', 633, 52], ['Sketch', 711, 75], ['Sheet Metal', 805, 88], ['Weldments', 915, 80]];
// Sections: [name, left edge, separator x, tools]; a tool is [icon, label lines, centre x, width, dropdown?].
const SECTIONS = [
  ['Create', 112, 308, [['line', ['Line'], 138, 66, true], ['rect', ['Rect...'], 209, 76, true], ['circle', ['Circle'], 268, 66, true]]],
  ['Modify', 308, 446, [['trim', ['Trim'], 344, 62], ['offset', ['Offset'], 411, 62]]],
  ['Pattern', 446, 583, [['sketch_mirror', ['Mirror'], 482, 62], ['pattern_circ', ['Circular'], 548, 66]]],
  ['Constrain', 583, 753, [['dimension', ['Dime...'], 620, 62]]],
  ['Reference', 753, 836, [['project', ['Project'], 797, 70]]],
  ['Inspect', 836, 920, [['inspect', ['Sketch', 'Report'], 879, 62]]],
  ['Configure', 920, 1057, [['params', ['Para...'], 956, 62], ['configuration_table', ['Config', 'Table'], 1022, 62]]],
  ['Exit', 1057, 1196, [['finish', ['Finish', 'Sketch'], 1095, 66], ['close', ['Cancel'], 1160, 62]]]
];
const CONSTRAINTS = [['c_perpendicular', 'c_midpoint', 'c_tangent'], ['c_equal', 'c_parallel', 'c_hv']];

export function sketchScene(kit, stage, state, dev, size) {
  const t = kit.t;
  const { zoom, w: W, h: H, tx, ty } = size;
  const root = el('div', { class: 'pv-scene sketch' });
  root.style.cssText = `width:${W}px;height:${H}px;transform:translate(${tx}px,${ty}px) scale(${zoom});transform-origin:0 0`;
  root.append(sketchView(t, W, H, state.pan));
  root.append(kit.appBar(rect(0, 0, W, 38), { ...state, title: 'Sample Plate •' }));

  // Left of the ribbon row: the workspace switcher, as in the full app.
  const rowTop = 38 + M, rowH = 135;
  const workspace = card('chrome', rect(M, rowTop, 101, rowH));
  tag(workspace, 'Workspace switcher', ['panel', 'border']);
  workspace.append(abs('pv-accent-bar', rect(8, 0, 83, 3)), kit.iconAt('ws_design', 36, 49, 36), textAt('Design', 49, 79, 'pv-semibold pv-heading', 'center'), kit.labelChevron('Workspace', 49, 102, 'pv-body dim'));
  const ribbonX = M + 101 + M;
  const ribbon = card('chrome', rect(ribbonX, rowTop, W - M - ribbonX, rowH));
  tag(ribbon, 'Ribbon', ['panel', 'border', 'sketch_accent']);
  sketchRibbon(kit, ribbon, W - M - ribbonX);
  root.append(workspace, ribbon);

  // The browser collapses to one row while sketching.
  const browser = card('panel', rect(M, rowTop + rowH + M, 284, 40));
  tag(browser, 'Browser', ['panel', 'border']);
  browser.append(textAt('Browser', 11, 21, 'pv-semibold pv-fs17'), kit.chevron(266, 20, 'right'), textAt('0 bodies', 40, 20, 'dim pv-fs15', 'right'));
  root.append(browser);
  const status = textAt('Base — fully constrained', 309, rowTop + rowH + M + 24, 'pv-fs15');
  status.style.color = t.c('sketch_accent');
  tag(status, 'Sketch status', ['sketch_accent']);
  root.append(status);

  const dx = W - 1276;
  root.append(kit.navCube(rect(W - 128, rowTop + rowH + 2 * M, 116, 116), 'top'));
  root.append(sketchPanel(kit, rect(W - 276, 322, 261, 424)));
  root.append(kit.navToolbar(rect(598 + dx / 2, H - 114, 378, 43)));

  const historyRect = rect(M, H - M - 44, W - 2 * M, 44);
  const strip = card('panel', historyRect);
  tag(strip, 'History', ['panel', 'border']);
  kit.historyStrip(strip, historyRect, ['sketch', 'extrude', 'body', 'sketch', 'extrude', 'sketch', 'extrude', 'sketch', 'extrude'], { ...state, history: 0, editing: true });
  root.append(strip);
  if (dev?.ref) root.append(el('img', { class: 'pv-ref', src: dev.ref.src, alt: '', style: `left:${dev.ref.x ?? 0}px;top:${dev.ref.y ?? 0}px;width:${dev.ref.w}px;height:${dev.ref.h}px` }));
  return root;
}

/** The Sketch ribbon: tab strip (Sketch active), search, the green rule, then the grouped commands. */
function sketchRibbon(kit, host, width) {
  const t = kit.t, ox = 107, oy = 46; // card origin in screenshot coordinates
  TABS.forEach(([name, cx, w]) => {
    const on = name === 'Sketch';
    const node = tag(abs(`pv-rtab${on ? ' on solid' : ''}`, rect(cx - w / 2 - ox, 52 - oy, w, 24)), name.toUpperCase(), ['sketch_accent', 'on_accent', 'text', 'text_dim', 'hover']);
    node.append(textAt(name, w / 2, 12, `pv-fs14${on ? ' pv-semibold' : ''}`, 'center'));
    host.append(node);
  });
  host.append(kit.iconAt('plus', 16, 983 - ox, 63 - oy, { ink: t.c('text_dim') }));
  const searchW = 174, search = tag(abs('pv-field pv-search', rect(width - 9 - searchW, 51 - oy, searchW, 24)), 'Search commands', ['control_fill', 'control_border', 'form_dim']);
  search.append(kit.iconAt('zoom', 14, 13.3, 12, { ink: t.c('form_dim') }), textAt('Search commands', 28, 12, 'dim pv-fs15'));
  const key = abs('pv-keycap', rect(searchW - 15, 2.5, 11, 17)); key.append(textAt('S', 5.5, 8.5, 'dim pv-fs13', 'center'));
  search.append(key); host.append(search);
  host.append(abs('pv-sep pv-hsep accent', rect(0, 78.5 - oy, width - 2, 1)));

  for (const [group, left, sepX, tools] of SECTIONS) {
    for (const [icon, lines, cx, w, menu] of tools) {
      const cell = tag(abs('pv-tool', rect(cx - w / 2 - ox, 82 - oy, w, 68)), lines.join(' '), ['icon_palette.sketch', 'icon_palette.line', 'hover']);
      cell.append(kit.iconAt(icon, 27, w / 2 - (menu ? 3 : 0), 17.5));
      if (lines.length === 1) {
        if (menu) cell.append(kit.labelChevron(lines[0], w / 2, 45, 'pv-fs14'));
        else cell.append(textAt(lines[0], w / 2, 45, 'pv-fs14', 'center'));
      } else lines.forEach((line, i) => cell.append(textAt(line, w / 2, 44 + i * 16, 'pv-fs14', 'center')));
      host.append(cell);
    }
    if (group === 'Constrain') {
      CONSTRAINTS.forEach((row, r) => row.forEach((icon, c) => {
        const b = tag(abs('pv-cbtn', rect(655 + c * 31 - ox, 88 + r * 27 - oy, 28, 22)), icon, ['control_fill', 'control_border', 'icon_palette.constraint']);
        b.append(kit.iconAt(icon, 17, 14, 11));
        host.append(b);
      }));
    }
    const pill = tag(abs('pv-glabel', rect(left + 2 - ox, 151 - oy, sepX - left - 4, 22)), group, ['text_dim', 'hover']);
    pill.append(group === 'Exit' ? textAt(group, (sepX - left - 4) / 2, 11, 'dim pv-fs14', 'center') : kit.labelChevron(group, (sepX - left - 4) / 2, 11, 'dim pv-fs14'));
    host.append(pill, abs('pv-sep', rect(sepX - ox, 86 - oy, 1, 86)));
  }
}

/** The sketch properties panel: status, line type, display toggles and the exit actions. */
function sketchPanel(kit, r) {
  const t = kit.t, host = tag(card('panel', r), 'Sketch properties', ['panel', 'border', 'control_fill', 'form_primary_fill', 'text']);
  const inner = r.w - 2;
  host.append(kit.iconAt('sketch', 18, 21, 21), textAt('Base', 34, 21, 'pv-semibold pv-fs15'));
  host.append(el('span', { class: 'pv-dot', style: 'left:11px;top:42px' }), textAt('Fully constrained', 28, 48, 'pv-fs14'));
  host.append(abs('pv-progress', rect(12, 61, inner - 24, 8), abs('pv-progress-fill', rect(0, 0, inner - 24, 8))));
  host.append(textAt('Line Type', 11, 100, 'pv-fs14'));
  const types = tag(abs('pv-seg', rect(101, 85, 148, 30)), 'Line type', ['control_fill', 'control_border', 'selected_bg']);
  ['line', 'construction_line', 'centerline', 'infinite'].forEach((icon, i) => {
    const seg = abs(`pv-segment${i === 0 ? ' on' : ''}`, rect(i * 37, 0, 37, 30));
    seg.append(kit.iconAt(icon, 20, 18.5, 15));
    types.append(seg);
  });
  host.append(types, textAt('Normal', 122, 127, 'dim pv-fs13', 'center'));
  [['Constraints', true], ['Dimensions', true], ['Points', true], ['Snap', true], ['Construction mode (X)', false]].forEach(([text, on], i) => {
    const y = 153 + i * 32;
    host.append(textAt(text, 11, y, 'pv-fs14'));
    host.append(el('span', { class: `pv-box${on ? ' on' : ''}`, style: `left:${inner - 24}px;top:${y - 8}px` }));
  });
  kit.sectionHeader(host, 'MORE', 315, false, inner);
  host.append(kit.button('Finish Sketch', rect(12, 343, inner - 24, 32), { primary: true }));
  const look = kit.button('Look At', rect(12, 390, 114, 30)), slice = kit.button('Slice', rect(134, 390, inner - 146, 30));
  look.querySelector('.pv-t').style.left = '60%'; look.append(kit.iconAt('lookat', 16, 22, 15));
  host.append(look, slice);
  return host;
}
