// The HTML preview: renders SolidCraft scenes as DOM from the codec's resolved theme. It replaces
// the old GPU canvas; there is no WebGL or WebGPU requirement.
import { el } from '../dom.js';
import { Tokens } from './tokens.js';
import { Icons, loadIcons } from './icons.js';
import { Kit } from './kit.js';
import { appScene } from './app-scene.js';
import { appearanceScene } from './appearance-scene.js';
import { OVERSCAN } from './part.js';
import { scenes } from './scenes.js';

const hex = value => value;
function withAlpha(color, factor) {
  const v = color.replace('#', '');
  const a = (v.length >= 8 ? parseInt(v.slice(6, 8), 16) : 255) / 255 * factor;
  return `rgba(${parseInt(v.slice(0, 2), 16)},${parseInt(v.slice(2, 4), 16)},${parseInt(v.slice(4, 6), 16)},${a})`;
}

export class HtmlPreview {
  constructor(stage) {
    this.stage = stage;
    this.tokens = new Tokens();
    this.icons = new Icons(this.tokens);
    this.kit = new Kit(this.tokens, this.icons);
    window.__preview = this;
    this.scene = 'app';
    this.state = { tab: 'MODEL', bodiesOpen: true, history: 8, prefs: { themeOffset: 0, background: 'gradient', bg: '#ffffff', view3d: 'own', logo: 'theme' }, dialog: { dx: 0, dy: 0 }, pan: { x: 0, y: 0 }, form: { direction: 'One Side', extent: 'Distance', operation: 'Join' } };
    this.inspect = false; this.locked = null;
    this.root = el('div', { class: 'pv-root', tabindex: '0', 'aria-label': 'SolidCraft interface preview' });
    stage.prepend(this.root);
    this.size = { w: 1, h: 1 };
    new ResizeObserver(entries => {
      const box = entries[0].contentRect;
      if (Math.abs(box.width - this.size.w) < 0.5 && Math.abs(box.height - this.size.h) < 0.5) return;
      this.size = { w: box.width, h: box.height }; this.render();
    }).observe(stage);
    this.root.addEventListener('pointermove', event => this.hover(event));
    this.root.addEventListener('pointerleave', () => this.hover(null));
    this.root.addEventListener('click', event => this.click(event));
    this.root.addEventListener('pointerdown', event => { if (!this.startRange(event) && !this.startPan(event)) this.startDrag(event); });
  }

  /** Development comparison against a screenshot of the real window: ?ref&view=diff|ref|html&crop=x,y,w,h */
  get dev() {
    const params = new URLSearchParams(location.search);
    const sketch = this.scene === 'sketch', appearance = this.scene === 'appearance';
    const sketchRef = { src: new URL('../../mockups/real-sketch.png', import.meta.url).href, w: 1287, h: 859, x: 8, y: 0 };
    const appearanceRef = { src: new URL('../../mockups/real-appearance.webp', import.meta.url).href, w: 1458, h: 1009 };
    return params.has('ref') ? { ref: sketch ? sketchRef : appearance ? appearanceRef : { src: new URL('../../mockups/real-app.webp', import.meta.url).href, w: 1291, h: 858 }, view: params.get('view') || 'diff', crop: params.get('crop')?.split(',').map(Number) } : null;
  }

  async init(contract) { await loadIcons(contract.iconIndex); this.iconsReady = true; this.render(); }

  /** Take a new evaluation from the codec. Returns true when something visible changed. */
  update(result, state) {
    const changed = this.tokens.update(result);
    this.state.tab = state.workspace;
    this.state.themeName = state.document?.name;
    this.state.options = result?.definitions || result?.theme_option_defs || result?.theme?.options || [];
    this.state.optionValues = { ...(result?.effectiveValues || result?.effective_values || result?.theme_option_values || {}), ...(state.preview || {}) };
    if (changed || this.dirtyTab !== state.workspace || this.scene === 'appearance') { this.dirtyTab = state.workspace; this.render(); }
    return changed;
  }

  setScene(scene) { if (scene !== this.scene) { this.scene = scene; this.locked = null; this.render(); } }

  setInspect(on) { this.inspect = on; this.root.classList.toggle('inspecting', on); if (!on) { this.locked = null; this.mark(null); } }

  render() {
    if (!this.tokens.ready || !this.iconsReady) return;
    const t = this.tokens;
    for (const [name, value] of Object.entries(t.cssVariables())) this.root.style.setProperty(name, value);
    if (this.holding) return;
    const border = t.primaryBorder(t.c('border'));
    this.root.style.setProperty('--shadow', withAlpha(t.c('app_bar'), 0.18));
    this.root.style.setProperty('--border-color', border.color);
    const inset = t.borders.primary_inset;
    this.root.style.setProperty('--inset-gap', inset ? `${inset.gap}px` : '0px');
    this.root.style.setProperty('--inset-width', inset ? `${inset.width}px` : '0px');
    this.root.style.setProperty('--inset-color', inset?.color ?? 'transparent');
    this.root.style.setProperty('--border-color-dialog', t.borders.primary?.color ?? t.c('dialog_border'));
    this.root.classList.toggle('dark', t.dark);
    const build = this.scene === 'app' || this.scene === 'sketch' ? (kit, stage, state) => appScene(kit, stage, state, this.dev, this.scene)
      : this.scene === 'appearance' ? (kit, stage, state) => appearanceScene(kit, stage, state, this.dev) : scenes[this.scene];
    this.root.replaceChildren(build(this.kit, this.size, this.state, this.scene));
    this.root.dataset.scene = this.scene;
    if (this.dev) this.root.dataset.refview = this.dev.view; else delete this.root.dataset.refview;
    this.mark(this.locked?.label ?? null);
  }

  /**
   * Click and drag on the viewport pans the view, so panels can be tested over moving geometry
   * (translucency and blur). Panels sit above the viewport, so only the open viewport starts a pan.
   */
  startPan(event) {
    const svg = event.target.closest?.('.pv-part');
    if (!svg || this.inspect || event.button !== 0) return false;
    const win = this.root.querySelector('.pv-scene'), world = svg.querySelector('.pv-world');
    const zoom = win.getBoundingClientRect().width / win.offsetWidth;
    const start = { x: event.clientX, y: event.clientY, px: this.state.pan.x, py: this.state.pan.y };
    let dx = 0, dy = 0, frame = 0;
    svg.setPointerCapture(event.pointerId);
    svg.classList.add('panning');
    // Moving the layer is a compositor transform: nothing repaints while dragging, one frame at a time.
    const paint = () => { frame = 0; svg.style.transform = `translate3d(${dx}px,${dy}px,0)`; };
    const move = e => {
      dx = Math.max(-OVERSCAN, Math.min(OVERSCAN, (e.clientX - start.x) / zoom));
      dy = Math.max(-OVERSCAN, Math.min(OVERSCAN, (e.clientY - start.y) / zoom));
      if (!frame) frame = requestAnimationFrame(paint);
    };
    const end = () => {
      svg.removeEventListener('pointermove', move); svg.removeEventListener('pointerup', end); svg.removeEventListener('pointercancel', end);
      cancelAnimationFrame(frame);
      // Commit the offset into the drawing and drop the temporary transform in the same frame.
      this.state.pan = { x: start.px + dx, y: start.py + dy };
      world.setAttribute('transform', `translate(${this.state.pan.x} ${this.state.pan.y})`);
      svg.style.transform = '';
      svg.classList.remove('panning');
    };
    svg.addEventListener('pointermove', move); svg.addEventListener('pointerup', end); svg.addEventListener('pointercancel', end);
    event.preventDefault();
    return true;
  }

  /** Drag a feature dialog by its header; the offset is kept so a re-render does not move it back. */
  startDrag(event) {
    const handle = event.target.closest?.('[data-drag]');
    const dialog = handle?.closest('.pv-dialog');
    const win = this.root.querySelector('.pv-scene');
    if (!dialog || !win || this.inspect || event.button !== 0) return;
    const zoom = win.getBoundingClientRect().width / win.offsetWidth;
    const start = { x: event.clientX, y: event.clientY, dx: this.state.dialog.dx, dy: this.state.dialog.dy };
    const home = { left: dialog.offsetLeft - start.dx, top: dialog.offsetTop - start.dy };
    handle.setPointerCapture(event.pointerId);
    dialog.classList.add('dragging');
    const move = e => {
      const dx = start.dx + (e.clientX - start.x) / zoom, dy = start.dy + (e.clientY - start.y) / zoom;
      const left = Math.min(Math.max(home.left + dx, 0), win.offsetWidth - dialog.offsetWidth);
      const top = Math.min(Math.max(home.top + dy, 0), win.offsetHeight - 60);
      this.state.dialog = { dx: left - home.left, dy: top - home.top };
      dialog.style.left = left + 'px'; dialog.style.top = top + 'px';
    };
    const end = () => {
      handle.removeEventListener('pointermove', move); handle.removeEventListener('pointerup', end); handle.removeEventListener('pointercancel', end);
      dialog.classList.remove('dragging');
    };
    handle.addEventListener('pointermove', move); handle.addEventListener('pointerup', end); handle.addEventListener('pointercancel', end);
    event.preventDefault();
  }

  target(event) { return event?.target?.closest?.('[data-label]') ?? null; }

  hit(node) {
    return node ? { label: node.dataset.label, roles: node.dataset.roles.split(',').filter(Boolean), scene: this.scene, locked: false } : null;
  }

  hover(event) {
    if (!this.inspect || this.locked) return;
    const node = this.target(event);
    this.mark(node?.dataset.label ?? null, node);
    const hit = this.hit(node);
    if (hit) window.dispatchEvent(new CustomEvent('solidcraft-theme-studio-inspect', { detail: hit }));
  }

  /** A theme option changed in the Preferences page: remember it here and hand it to the studio. */
  setOption(id, value) {
    this.state.optionValues = { ...this.state.optionValues, [id]: value };
    this.onOption?.(id, value);
  }

  /** Drag a range in the Preferences page. The page is left alone while dragging and rebuilt on release. */
  startRange(event) {
    const rng = event.target.closest?.('.pv-rng');
    if (!rng || rng.classList.contains('off') || this.inspect || event.button !== 0) return false;
    const { opt, unit } = rng.dataset, min = Number(rng.dataset.min), max = Number(rng.dataset.max), step = Number(rng.dataset.step) || 1;
    const fill = rng.querySelector('.pv-rfill'), thumb = rng.querySelector('.pv-rthumb'), readout = this.root.querySelector(`[data-value-for="${opt}"]`);
    const set = e => {
      const box = rng.getBoundingClientRect(), f = Math.min(1, Math.max(0, (e.clientX - box.left) / box.width));
      const value = Math.min(max, Math.max(min, Math.round((min + f * (max - min)) / step) * step));
      const g = (value - min) / (max - min || 1), width = rng.offsetWidth;
      fill.style.width = `${g * width}px`; thumb.style.left = `${g * width - 10}px`;
      if (readout) readout.textContent = `${value}${unit}`;
      if (value !== this.state.optionValues?.[opt]) this.setOption(opt, value);
    };
    this.holding = true;
    rng.setPointerCapture(event.pointerId);
    set(event);
    const end = () => { rng.removeEventListener('pointermove', set); rng.removeEventListener('pointerup', end); rng.removeEventListener('pointercancel', end); this.holding = false; this.render(); };
    rng.addEventListener('pointermove', set); rng.addEventListener('pointerup', end); rng.addEventListener('pointercancel', end);
    event.preventDefault();
    return true;
  }

  /** Click targets in the Preferences page: theme options, local preferences, the theme carousel and defaults. */
  press(data) {
    const prefs = this.state.prefs;
    if (data.act === 'opt') this.setOption(data.opt, JSON.parse(data.val));
    else if (data.act === 'pref') prefs[data.key] = data.val;
    else if (data.act === 'themes') prefs.themeOffset = Math.max(0, prefs.themeOffset + Number(data.dir));
    else if (data.act === 'defaults') { for (const def of this.state.options || []) this.setOption(def.id, def.default); Object.assign(prefs, { background: 'gradient', view3d: 'own', logo: 'theme' }); }
    this.render();
  }

  click(event) {
    const control = !this.inspect && event.target.closest?.('.pv-act');
    if (control) { this.press(control.dataset); return; }
    const cell = !this.inspect && event.target.closest?.('.pv-icell');
    if (cell) { this.state.iconSelected = cell.dataset.icon; const top = this.root.scrollTop; this.render(); this.root.scrollTop = top; return; }
    if (!this.inspect) return;
    const node = this.target(event);
    const hit = this.hit(node);
    if (hit) { hit.locked = true; this.locked = hit; this.mark(hit.label, node); window.dispatchEvent(new CustomEvent('solidcraft-theme-studio-inspect', { detail: hit })); }
    else { this.locked = null; this.mark(null); }
  }

  mark(label, node = null) {
    this.root.querySelectorAll('.pv-hit').forEach(item => item.classList.remove('pv-hit'));
    if (!label) return;
    (node ? [node] : [...this.root.querySelectorAll('[data-label]')].filter(item => item.dataset.label === label)).forEach(item => item.classList.add('pv-hit'));
  }
}
