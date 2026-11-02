// The dial: a boundless, relative control. A wheel of bold lines sits between a − and a + in one
// segmented control; dragging the wheel sideways turns it, with no end stop, and the buttons nudge
// it a notch. The lines are all there is to the wheel: evenly spaced at the middle, bunching and
// shortening toward the rim as they turn away, with a taller line every fifth so the eye can feel the
// distance travelled. They move exactly as far as the hand does.
import { el } from './dom.js';

const HEIGHT = 24;
const SPACING = 7;                              // px between two lines at the middle of the wheel
const EVERY = 5;                                // every fifth line is a long one

/** The lines for a given turn of a wheel `width` px across, as SVG markup. */
function ridges(phase, width) {
  const r = width / 2;
  // A whole number of lines, in whole groups of EVERY, so the long ones come round evenly.
  const count = EVERY * Math.max(4, Math.round((2 * Math.PI * r) / SPACING / EVERY)), pitch = (2 * Math.PI) / count;
  let out = '';
  for (let i = 0; i < count; i++) {
    const a = i * pitch + phase, c = Math.cos(a);
    if (c < 0.28) continue;
    const major = i % EVERY === 0;
    const w = (major ? 2.2 : 1.7) * (0.55 + 0.45 * c), h = HEIGHT * (major ? 0.78 : 0.48) * (0.55 + 0.45 * c);
    const x = r + r * Math.sin(a);
    out += `<rect class="${major ? 'major' : 'minor'}" x="${(x - w / 2).toFixed(2)}" y="${((HEIGHT - h) / 2).toFixed(2)}" width="${w.toFixed(2)}" height="${h.toFixed(2)}" rx="${(w / 2).toFixed(2)}"/>`;
  }
  return out;
}

const signed = value => (value > 0 ? `+${value}` : String(value));
export { signed };

/**
 * One dial with its name, readout, end labels and − / + buttons.
 *   ppu       pixels of drag per unit; `quantum` snaps the units (1 = whole numbers)
 *   begin()   a drag (or a keyboard burst) starts: take a snapshot
 *   drag(u)   the wheel is at `u` units from where the drag began; apply it and return the readout
 *   finish()  the drag ended: commit it
 *   step(s)   one click of − (s = -1) or + (s = 1), applied as its own change; returns a readout
 *   idle()    the readout when nothing is happening (nothing: the pill appears only while the wheel is in use)
 */
export function dial({ name, help, low, high, ppu = 140, quantum = 0, begin, drag, finish, step, idle = () => '', plain = false }) {
  const readout = el('output', { 'aria-live': 'off' }, idle());
  const body = el('div', { class: 'wheel-body' });
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('preserveAspectRatio', 'none'); svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = '<g class="wheel-ridges"></g>';
  const group = svg.querySelector('.wheel-ridges');
  body.append(svg);
  const surface = el('div', { class: 'wheel', tabindex: '0', role: 'slider', 'aria-label': `${name}, ${low} to ${high}`, 'aria-valuetext': idle(), title: help },
    body, el('i', { class: 'wheel-notch top', 'aria-hidden': 'true' }), el('i', { class: 'wheel-notch bottom', 'aria-hidden': 'true' }));
  let phase = 0, timer = 0, glide = 0;
  const draw = () => { const width = body.clientWidth || 240; svg.setAttribute('viewBox', `0 0 ${width} ${HEIGHT}`); group.innerHTML = ridges(phase, width); };
  new ResizeObserver(draw).observe(body);
  const radius = () => Math.max(40, body.clientWidth / 2);
  const show = (text, live) => { readout.textContent = text; readout.classList.toggle('live', live); surface.setAttribute('aria-valuetext', text); };
  const rest = () => show(idle(), false);
  const flash = text => { show(text, true); clearTimeout(timer); timer = setTimeout(rest, 700); };
  const units = dx => { const u = dx / ppu; return quantum ? Math.round(u / quantum) * quantum : u; };

  // Dragging: the surface under the pointer moves with it, so the lines travel exactly as far as the hand.
  let drive = null;
  const start = x => { clearTimeout(timer); begin(); drive = { x, phase, dx: 0 }; surface.classList.add('active'); };
  const move = x => { drive.dx = x - drive.x; phase = drive.phase + drive.dx / radius(); draw(); show(drag(units(drive.dx)), true); };
  const stop = () => { if (!drive) return; drive = null; surface.classList.remove('active'); finish(); rest(); };
  surface.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    try { surface.setPointerCapture(event.pointerId); } catch { /* a pointer that is already gone cannot be captured */ }
    start(event.clientX); event.preventDefault(); surface.focus({ preventScroll: true });
  });
  surface.addEventListener('pointermove', event => { if (drive) move(event.clientX); });
  surface.addEventListener('pointerup', stop); surface.addEventListener('pointercancel', stop); surface.addEventListener('lostpointercapture', stop);

  // Sideways scroll (a trackpad swipe, or Shift + wheel) turns it too; plain vertical scrolling still scrolls the page.
  let swipe = null;
  surface.addEventListener('wheel', event => {
    const dx = event.deltaX || (event.shiftKey ? event.deltaY : 0);
    if (!dx) return;
    event.preventDefault();
    if (!swipe) { start(0); swipe = { total: 0 }; }
    swipe.total -= dx; move(swipe.total);
    clearTimeout(swipe.timer);
    swipe.timer = setTimeout(() => { swipe = null; stop(); }, 450);
  }, { passive: false });

  // Steps: the wheel rolls on by a few lines, then the change lands as its own Undo step.
  const spin = sign => {
    const target = phase + sign * 0.3, from = phase, t0 = performance.now();
    cancelAnimationFrame(glide);
    const frame = now => { const k = Math.min(1, (now - t0) / 160); phase = from + (target - from) * (1 - (1 - k) ** 3); draw(); if (k < 1) glide = requestAnimationFrame(frame); };
    if (matchMedia('(prefers-reduced-motion:reduce)').matches) { phase = target; draw(); } else glide = requestAnimationFrame(frame);
  };
  const nudge = sign => { spin(sign); flash(step(sign) ?? idle()); };
  const end = (sign, glyph, label) => el('button', { type: 'button', class: `wheel-end ${sign < 0 ? 'minus' : 'plus'}`, 'aria-label': `${label}: a little ${sign < 0 ? 'less' : 'more'} ${name.toLowerCase()}`, title: label, onclick: () => nudge(sign) }, glyph);
  surface.addEventListener('keydown', event => {
    const sign = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[event.key];
    if (!sign) return;
    event.preventDefault(); nudge(sign);
  });

  draw();
  const node = el('div', { class: `nudge${plain ? ' plain' : ''}` },
    el('div', { class: 'nudge-head' }, el('span', { class: 'nudge-name', title: help }, name), readout),
    el('div', { class: 'dial' }, end(-1, '−', low), surface, end(1, '+', high)),
    el('div', { class: 'nudge-ends' }, el('span', {}, low), el('span', {}, high)));
  return { node, refresh: () => { if (!drive && !swipe) rest(); } };
}

/**
 * A slider, for a value that has a range and a number to show (a radius, a width, a blur). It reads as absolute, but
 * it is still relative underneath: moving it applies the same change to everything in its scope, from a snapshot taken
 * when the drag began.
 *   read()    the value now, from the theme
 *   apply(d)  the slider is `d` away from where it began; make that change (it takes its own snapshot)
 *   finish()  the drag ended: commit it
 */
export function slide({ name, help, low, high, min, max, step = 1, unit = '', read, apply, finish, plain = false }) {
  const fmt = value => `${Number(value.toFixed(2))}${unit}`;
  const input = el('input', { type: 'range', min, max, step, value: read(), 'aria-label': name, title: help });
  const readout = el('output', {}, fmt(read()));
  let rested = read(), held = false;
  const paint = () => input.style.setProperty('--fill', `${((input.valueAsNumber - min) / (max - min)) * 100}%`);
  const settle = () => { rested = read(); input.value = rested; readout.textContent = fmt(rested); readout.classList.remove('live'); paint(); };
  input.addEventListener('input', () => { held = true; apply(input.valueAsNumber - rested); readout.textContent = fmt(input.valueAsNumber); readout.classList.add('live'); paint(); });
  input.addEventListener('change', () => { held = false; finish(); settle(); });
  paint();
  const node = el('div', { class: `nudge slide${plain ? ' plain' : ''}` },
    el('div', { class: 'nudge-head' }, el('span', { class: 'nudge-name', title: help }, name), readout),
    el('div', { class: 'slide-body' }, input),
    el('div', { class: 'nudge-ends' }, el('span', {}, low), el('span', {}, high)));
  return { node, refresh: () => { if (!held) settle(); } };
}
