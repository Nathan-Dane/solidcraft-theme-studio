// The full-application scene, laid out like the real window. Positions are measured from a
// screenshot of SolidCraft (1276 x 848 window: 3 px outer margin, 135 px ribbon row, 30 px tree
// pitch) and refined with the difference overlay (?ref&view=diff). Colours, radii and metrics
// come from the codec's resolved tokens.
import { el } from '../dom.js';
import { abs, card, rect, tag, textAt } from './kit.js';
import { part } from './part.js';
import { sketchView } from './sketch.js';

export const REFERENCE = { w: 1276, h: 848 };
export const MIN_SIZE = { w: 1276, h: 848 };
export const MIN_ZOOM = 0.55;

// The shell gap (SHELL_GAP in the app): between panels and from the window edge, on every side.
const M = 7;
const TABS = ['Model', 'Surface', 'Assemble', 'Insert', 'Inspect', 'Manage', 'View', 'Sheet Metal', 'Weldments'];
const GROUPS = [
  ['Sketch', [['sketch', 'New Sketch']]],
  ['Create', [['extrude', 'Extrude'], ['revolve', 'Revolve'], ['hole', 'Hole']]],
  ['Modify', [['fillet', 'Fillet'], ['chamfer', 'Chamfer'], ['shell', 'Shell'], ['presspull', 'Press Pull']]],
  ['Arrange', [['move', 'Move / Copy'], ['mirror', 'Mirror'], ['pattern', 'Pattern']]],
  ['Configure', [['params', 'Parameters'], ['configuration_table', 'Config Table']]],
  ['Construct', [['plane', 'Offset Plane']]]
];
const HISTORY = ['sketch', 'extrude', 'body', 'sketch', 'extrude', 'sketch', 'extrude', 'sketch', 'extrude'];
const TREE = [
  [0, 'Sample Plate', 'component', true, null, false], [1, 'Document Settings', 'gear', false, null, false], [1, 'Named Views', 'folder', false, null, false],
  [1, 'Origin', 'origin', false, true, false], [1, 'Bodies', 'folder', true, true, false], [2, 'Plate', 'body', null, true, false],
  [1, 'Sketches', 'folder', true, true, false], [2, 'Base', 'sketch', null, false, true], [2, 'Holes', 'sketch', null, false, true],
  [2, 'Boss', 'sketch', null, false, true], [2, 'Bore', 'sketch', null, false, true], [1, 'Features', 'folder', false, null, false]
];

/** Window size to lay out in and the transform that fits it to `stage`. */
export function fit(stage, dev) {
  if (dev?.ref) {
    const crop = dev.crop || [0, 0, REFERENCE.w, REFERENCE.h];
    const zoom = Math.min(stage.w / crop[2], stage.h / crop[3]);
    return { zoom, w: REFERENCE.w, h: REFERENCE.h, tx: -crop[0] * zoom, ty: -crop[1] * zoom };
  }
  const zoom = Math.min(Math.max(Math.min(stage.w / MIN_SIZE.w, stage.h / MIN_SIZE.h), MIN_ZOOM), 1);
  return { zoom, w: stage.w / zoom, h: stage.h / zoom, tx: 0, ty: 0 };
}

export function appScene(kit, stage, state, dev, mode = 'app') {
  const t = kit.t;
  const { zoom, w: W, h: H, tx, ty } = fit(stage, dev);
  const root = el('div', { class: 'pv-scene' });
  root.style.cssText = `width:${W}px;height:${H}px;transform:translate(${tx}px,${ty}px) scale(${zoom});transform-origin:0 0`;
  root.append(mode === 'sketch' ? sketchView(t, W, H, state.pan) : part(t, W, H, state.pan));

  root.append(kit.appBar(rect(0, 0, W, 38), state));

  const rowTop = 38 + M, rowH = 135;
  const workspace = card('chrome', rect(M, rowTop, 101, rowH));
  tag(workspace, 'Workspace switcher', ['panel', 'border']);
  workspace.append(abs('pv-accent-bar', rect(8, 0, 83, 3)), kit.iconAt('ws_design', 36, 49, 36), textAt('Design', 49, 79, 'pv-semibold pv-heading', 'center'), kit.labelChevron('Workspace', 49, 102, 'pv-body dim'));
  const ribbonX = M + 101 + M;
  const ribbon = card('chrome', rect(ribbonX, rowTop, W - M - ribbonX, rowH));
  tag(ribbon, 'Ribbon', ['panel', 'border']);
  kit.ribbon(ribbon, W - M - ribbonX, TABS, GROUPS, state);
  root.append(workspace, ribbon);

  const browser = card('panel', rect(M, rowTop + rowH + M, 284, 404));
  tag(browser, 'Browser', ['panel', 'border']);
  kit.browser(browser, 284, TREE, state);
  root.append(browser);

  // Items on the right and bottom edges stay anchored to them as the window grows past the reference size.
  const dx = W - REFERENCE.w, dy = H - REFERENCE.h;
  const compass = rect(W - M - 116, rowTop + rowH + 2 * M, 116, 116);
  root.append(kit.navCube(compass));
  root.append(kit.navToolbar(rect(598 + dx / 2, 740 + dy, 378, 43)));

  // The feature dialog is anchored to the top right, below the compass, and can be dragged.
  const dialogSize = { w: 298, h: 438 }, drag = state.dialog;
  const anchor = { x: W - M - dialogSize.w, y: compass.y + compass.h + M };
  const dialogX = Math.min(Math.max(anchor.x + drag.dx, 0), W - dialogSize.w), dialogY = Math.min(Math.max(anchor.y + drag.dy, 0), H - 60);
  if (mode !== 'sketch') root.append(kit.extrudeDialog(rect(dialogX, dialogY, dialogSize.w, dialogSize.h), state));

  const historyRect = rect(M, H - M - 44, W - 2 * M, 44);
  const strip = card('panel', historyRect);
  tag(strip, 'History', ['panel', 'border']);
  kit.historyStrip(strip, historyRect, HISTORY, state);
  root.append(strip);
  if (dev?.ref) root.append(el('img', { class: 'pv-ref', src: dev.ref.src, alt: '' }));
  return root;
}
