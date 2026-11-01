// The viewport in sketch mode: the sketch plane seen face-on (Top view), as the app draws it.
// Geometry is the Sample Plate's base sketch (80 x 50 rectangle) plus the holes, boss and bore,
// with constraint badges, driving dimensions and construction centre lines. Colours are tokens.
// Same node classes as the 3D part so panning and Inspect work unchanged.
const NS = 'http://www.w3.org/2000/svg';

// The plate's origin and scale in the 1276 x 854 reference window (measured from the app).
const ORIGIN = { x: 315 / 1288, y: 646 / 854 }, SCALE = 6.85 / 854;

import { overscan, OVERSCAN } from './part.js';

export function sketchView(tokens, width, height, pan = { x: 0, y: 0 }) {
  const t = tokens;
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'pv-part');
  overscan(svg, width, height);
  svg.dataset.label = 'Viewport (sketch)'; svg.dataset.roles = 'grid,grid_major,sketch_fixed,profile_fill,sketch_point,sketch_point_free,sketch_construction,dimension,sketch_conflict,viewport_bottom';
  const world = document.createElementNS(NS, 'g');
  world.setAttribute('class', 'pv-world'); world.setAttribute('transform', `translate(${pan.x} ${pan.y})`);
  svg.append(world);

  const s = height * SCALE, ox = width * ORIGIN.x, oy = height * ORIGIN.y;
  const X = u => ox + u * s, Y = u => oy - u * s;
  const n = v => Math.round(v * 100) / 100;
  const line = (a, b, stroke, w, extra = '') => `<line x1="${n(X(a[0]))}" y1="${n(Y(a[1]))}" x2="${n(X(b[0]))}" y2="${n(Y(b[1]))}" stroke="${stroke}" stroke-width="${w}" ${extra}/>`;
  const px = (x, y, stroke, w, extra = '') => `<line x1="${n(x[0])}" y1="${n(x[1])}" x2="${n(y[0])}" y2="${n(y[1])}" stroke="${stroke}" stroke-width="${w}" ${extra}/>`;
  const fixed = t.c('sketch_fixed'), yellow = t.c('dimension'), bad = t.c('sketch_conflict'), free = t.c('sketch_point_free');
  const mono = 'font-family="Plex Mono,ui-monospace,Consolas,monospace"';
  let m = '';

  // The grid fills the window: minor every 5 mm, major every 25 mm, aligned to the sketch origin.
  const lo = Math.floor((-oy + height - OVERSCAN) / s / 5) * 5 - 5, hi = Math.ceil((oy + OVERSCAN) / s / 5) * 5 + 5;
  const left = Math.floor((-ox - OVERSCAN) / s / 5) * 5 - 5, right = Math.ceil((width - ox + OVERSCAN) / s / 5) * 5 + 5;
  for (let i = left; i <= right; i += 5) { const major = i % 25 === 0; m += px([X(i), -OVERSCAN], [X(i), height + OVERSCAN], major ? t.c('grid_major') : t.c('grid'), major ? 1.5 : 1); }
  for (let i = lo; i <= hi; i += 5) { const major = i % 25 === 0; m += px([-OVERSCAN, Y(i)], [width + OVERSCAN, Y(i)], major ? t.c('grid_major') : t.c('grid'), major ? 1.5 : 1); }

  // Profile: fill and a hovered 9 mm corner region, then the outline.
  m += `<rect x="${n(X(0))}" y="${n(Y(50))}" width="${n(80 * s)}" height="${n(50 * s)}" fill="${t.c('profile_fill')}"/>`;
  m += `<rect x="${n(X(0))}" y="${n(Y(9))}" width="${n(9 * s)}" height="${n(9 * s)}" fill="${t.c('hover_profile')}" stroke="${t.c('hover_profile_edge')}" stroke-opacity=".35"/>`;
  for (const [a, b] of [[[0, 0], [80, 0]], [[80, 0], [80, 50]], [[80, 50], [0, 50]], [[0, 50], [0, 0]]]) m += line(a, b, fixed, 2);
  // The holes, boss and bore: circles with their centre points and construction centre lines.
  for (const [cx, r] of [[12, 4], [68, 4], [40, 12], [40, 6]]) m += `<circle cx="${n(X(cx))}" cy="${n(Y(25))}" r="${n(r * s)}" fill="none" stroke="${fixed}" stroke-width="2"/>`;
  m += line([-6, 25], [86, 25], t.c('sketch_construction'), 1.2, 'stroke-dasharray="9 5 2 5"') + line([40, -6], [40, 56], t.c('sketch_construction'), 1.2, 'stroke-dasharray="9 5 2 5"');
  m += line([12, 18], [12, 32], t.c('sketch_construction'), 1, 'stroke-dasharray="9 5 2 5"') + line([68, 18], [68, 32], t.c('sketch_construction'), 1, 'stroke-dasharray="9 5 2 5"');
  const square = (u, v, size = 6, fill = fixed) => `<rect x="${n(X(u) - size / 2)}" y="${n(Y(v) - size / 2)}" width="${size}" height="${size}" fill="${fill}"/>`;
  for (const [u, v] of [[80, 0], [80, 50], [0, 50]]) m += square(u, v);
  for (const u of [12, 68, 40]) m += square(u, 25, 5, free);
  m += `<circle cx="${n(X(0))}" cy="${n(Y(0))}" r="5.5" fill="${free}" stroke="${t.c('viewport_bottom')}" stroke-width="1"/>`;

  // Constraint badges: a small framed glyph beside the edge it constrains.
  const badge = (x, y, glyph) => {
    const g = glyph === 'h' ? `<line x1="${x - 4}" y1="${y}" x2="${x + 4}" y2="${y}"/>` : glyph === 'v' ? `<line x1="${x}" y1="${y - 4.5}" x2="${x}" y2="${y + 4.5}"/>` : glyph === 'c' ? `<path d="M${x - 4} ${y + 3} L${x} ${y - 3} L${x + 4} ${y + 3}"/>` : `<line x1="${x - 4}" y1="${y - 2}" x2="${x + 4}" y2="${y - 2}"/><line x1="${x - 4}" y1="${y + 2}" x2="${x + 4}" y2="${y + 2}"/>`;
    return `<rect x="${x - 9}" y="${y - 8}" width="18" height="16" rx="3" fill="${t.c('viewport_bottom')}" stroke="${bad}" stroke-width="1" fill-opacity=".92"/><g stroke="${bad}" stroke-width="1.5" fill="none">${g}</g>`;
  };
  m += badge(X(40), Y(50) - 15, 'h') + badge(X(40), Y(0) - 15, 'h') + badge(X(0) - 15, Y(25), 'v') + badge(X(80) - 10, Y(35), 'v');
  m += badge(X(0) + 10, Y(0) - 12, 'c');
  m += badge(X(26), Y(25) + 13, 'e') + badge(X(54), Y(25) + 13, 'e');

  // Driving dimensions: extension lines, arrow-headed span and a boxed value.
  const arrow = (x, y, dx, dy) => `<polygon points="${x},${y} ${n(x - dx * 11 + dy * 3.5)},${n(y - dy * 11 - dx * 3.5)} ${n(x - dx * 11 - dy * 3.5)},${n(y - dy * 11 + dx * 3.5)}" fill="${yellow}"/>`;
  const label = (x, y, text) => {
    const w = text.length * 8.4 + 12;
    return `<rect x="${n(x - w / 2)}" y="${n(y - 10)}" width="${n(w)}" height="20" fill="${t.c('viewport_bottom')}" fill-opacity=".92"/><text x="${n(x)}" y="${n(y + 0.5)}" text-anchor="middle" dominant-baseline="central" font-size="14" ${mono} fill="${yellow}">${text}</text>`;
  };
  const hdim = (u1, u2, yPx, from, text) => {
    const x1 = X(u1), x2 = X(u2);
    return px([x1, from], [x1, yPx + 4], yellow, 1) + px([x2, from], [x2, yPx + 4], yellow, 1) + px([x1, yPx], [x2, yPx], yellow, 1.5) + arrow(x1, yPx, -1, 0) + arrow(x2, yPx, 1, 0) + label((x1 + x2) / 2, yPx, text);
  };
  const vdim = (v1, v2, xPx, from, text, at = 0.5) => {
    const y1 = Y(v1), y2 = Y(v2);
    return px([from, y1], [xPx + 4, y1], yellow, 1) + px([from, y2], [xPx + 4, y2], yellow, 1) + px([xPx, y1], [xPx, y2], yellow, 1.5) + arrow(xPx, y1, 0, 1) + arrow(xPx, y2, 0, -1) + label(xPx, y1 + (y2 - y1) * at, text);
  };
  m += hdim(0, 80, Y(0) + 26, Y(0), 'fx: 80.00 mm') + vdim(0, 50, X(80) + 26, X(80), 'fx: 50.00 mm');
  m += hdim(0, 12, Y(50) - 30, Y(50), 'fx: 12.00 mm');
  m += vdim(0, 25, X(0) - 42, X(0), 'fx: 25.00 mm');
  // Diameters: a leader from the circle to a boxed value.
  const diameter = (cx, r, angle, text) => {
    const a = angle * Math.PI / 180, edge = [X(cx) + Math.cos(a) * r * s, Y(25) - Math.sin(a) * r * s], end = [edge[0] + Math.cos(a) * 36, edge[1] - Math.sin(a) * 36];
    return px(edge, end, yellow, 1) + label(end[0] + (Math.cos(a) > 0 ? text.length * 4.2 + 6 : -text.length * 4.2 - 6), end[1], text);
  };
  m += diameter(12, 4, 135, 'fx: Ø8.00 mm') + diameter(68, 4, 45, 'fx: Ø8.00 mm') + diameter(40, 12, 60, 'fx: Ø24.00 mm') + diameter(40, 6, 250, 'fx: Ø12.00 mm');
  world.innerHTML = m;
  return svg;
}
