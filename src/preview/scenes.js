// The remaining preview scenes. Until each is rebuilt from the kit it shows a plain notice.
import { el } from '../dom.js';

function pending(kit, stage, state, name) {
  return el('div', { class: 'pv-pending' }, el('strong', {}, 'This scene is being rebuilt in HTML.'), el('span', {}, `“${name}” will return as native-looking components.`));
}

export const scenes = { all: pending, tools: pending, browser: pending, controls: pending, glass: pending, viewport: pending, icons: pending };
