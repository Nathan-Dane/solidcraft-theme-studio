// The icon view: every icon in the app's library on one wall, recoloured by the active theme and
// accent ramp exactly as the app does, with the selected icon shown large and at its real sizes.
import { el } from '../dom.js';
import { abs, card, rect, tag, textAt } from './kit.js';
import { iconGroups } from './icons.js';

const PAD = 14, CELL = 46;

function iconWall(kit, stage, state) {
  const root = el('div', { class: 'pv-board' });
  const W = Math.max(stage.w, 320), inner = W - 2 * PAD;
  const groups = iconGroups();
  const selected = groups.some(g => g.ids.includes(state.iconSelected)) ? state.iconSelected : 'extrude';

  const head = tag(card('panel', rect(PAD, PAD, inner, 112)), `Icon ${selected}`, ['panel', 'border', 'icon_palette.line', 'selected_bg']);
  head.append(textAt(selected, 16, 22, 'pv-semibold pv-fs17'), textAt(`Device pixels · scale ${(window.devicePixelRatio || 1).toFixed(2)}×`, 16, 44, 'dim pv-fs13'));
  let x = 16;
  for (const px of [16, 24, 32, 48]) { head.append(kit.iconAt(selected, px, x + px / 2, 84)); x += px + 22; }
  head.append(kit.iconAt(selected, 24, x + 12, 84, { opacity: 0.4 }));
  head.append(kit.iconAt(selected, 72, inner - 52, 56));
  root.append(head);

  const cols = Math.max(1, Math.floor((inner + 4) / CELL));
  let y = PAD + 112 + 18;
  for (const group of groups) {
    root.append(textAt(`${group.name} · ${group.ids.length}`, PAD + 2, y + 8, 'pv-semibold pv-fs13 dim'));
    y += 24;
    group.ids.forEach((id, i) => {
      const cell = tag(abs(`pv-icell${id === selected ? ' on' : ''}`, rect(PAD + (i % cols) * CELL, y + Math.floor(i / cols) * CELL, CELL - 4, CELL - 4)), id, ['icon_palette.line', 'icon_palette.ink', 'selected_bg']);
      cell.dataset.icon = id; cell.title = id;
      cell.append(kit.iconAt(id, 28, (CELL - 4) / 2, (CELL - 4) / 2));
      root.append(cell);
    });
    y += Math.ceil(group.ids.length / cols) * CELL + 16;
  }
  root.style.height = `${y}px`;
  return root;
}

export const scenes = { icons: iconWall };
