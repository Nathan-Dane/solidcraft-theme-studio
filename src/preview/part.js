// The viewport behind the full-app scene: the Sample Plate in the app's Iso view, drawn exactly.
//
// The Iso home view is orthographic with yaw -45 degrees and sin(pitch) = 1/sqrt(3), looking at the
// part from a corner, so the projection is closed-form:
//     screen x  = (x + y) / sqrt(2)
//     screen up = (-x + y + 2z) / sqrt(6)
// World X and Y therefore draw as exact 30 degree lines, the two visible wall faces mirror each
// other, and a circle in any horizontal plane is an axis-aligned ellipse with ry = rx / sqrt(3).
// Geometry is the app's sample design: an 80 x 50 x 8 plate with 6 mm vertical fillets, two 8 mm
// holes, a 24 mm boss 14 mm tall and a 12 mm bore through everything. The grid is the app's
// (minor step 5, major step 25 at this zoom), with the origin axes at the plate's corner.
const NS = 'http://www.w3.org/2000/svg';
const S2 = Math.SQRT2, S6 = Math.sqrt(6), S3 = Math.sqrt(3);
const TARGET = { x: 40, y: 25, z: 11 }; // the camera target: the part's bounding-box centre
const HALF_HEIGHT = 55.4;               // half the visible height in world units after the home fit
const LIGHT = [0.14, -0.48, 0.87];      // light direction in world space (top .93, -y wall .74, +x wall .57)
const BACK = [1 / S3, -1 / S3, 1 / S3]; // the direction from the part to the eye

const parse = hex => { const v = hex.replace('#', ''); return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16), v.length >= 8 ? parseInt(v.slice(6, 8), 16) / 255 : 1]; };
const rgb = (c, f = 1, a = c[3]) => `rgba(${Math.min(255, Math.round(c[0] * f))},${Math.min(255, Math.round(c[1] * f))},${Math.min(255, Math.round(c[2] * f))},${a})`;
const facing = n => n[0] * BACK[0] + n[1] * BACK[1] + n[2] * BACK[2] > 1e-6;
const light = n => 0.5 + 0.5 * Math.max(0, n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]);

export function part(tokens, width, height, pan = { x: 0, y: 0 }) {
  const t = tokens, body = parse(t.c('body'));
  const edge = 'none'; // the Shaded visual style draws no edge lines (Shaded with edges would use body_edge)
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'pv-part');
  svg.setAttribute('width', width); svg.setAttribute('height', height);
  svg.dataset.label = 'Viewport (analytic part)'; svg.dataset.roles = 'body,body_edge,grid,grid_major,axis_x,axis_y,axis_z,viewport_top,viewport_bottom';
  const world = document.createElementNS(NS, 'g');
  world.setAttribute('class', 'pv-world'); world.setAttribute('transform', `translate(${pan.x} ${pan.y})`);
  svg.append(world);

  // The pixels per world unit of the home fit, and where the target sits in the window.
  const s = (height - 38) / 2 / HALF_HEIGHT;
  const cx = width * 0.5987, cy = height * 0.5;
  const tx = (TARGET.x + TARGET.y) / S2, tu = (-TARGET.x + TARGET.y + 2 * TARGET.z) / S6;
  const P = (x, y, z) => [cx + s * ((x + y) / S2 - tx), cy - s * ((-x + y + 2 * z) / S6 - tu)];
  const num = v => Math.round(v * 100) / 100;
  const pts = list => list.map(p => `${num(p[0])},${num(p[1])}`).join(' ');
  const add = (name, attrs, parent = world) => { const node = document.createElementNS(NS, name); for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v); parent.append(node); return node; };
  const poly = (list, fill, stroke = 'none', w = 1, parent) => add('polygon', { points: pts(list), fill, stroke, 'stroke-width': w, 'stroke-linejoin': 'round' }, parent);
  const line = (a, b, stroke, w, dash) => add('line', { x1: num(a[0]), y1: num(a[1]), x2: num(b[0]), y2: num(b[1]), stroke, 'stroke-width': w, ...(dash ? { 'stroke-dasharray': dash } : {}) });
  // A horizontal circle is an axis-aligned ellipse: rx = r*s, ry = rx / sqrt(3).
  const ellipse = (x, y, z, r, attrs, parent) => { const c = P(x, y, z); return add('ellipse', { cx: num(c[0]), cy: num(c[1]), rx: num(r * s), ry: num((r * s) / S3), ...attrs }, parent); };

  // --- Ground grid on z = 0, faded with distance from the target, minor and major lines. ---
  const gridLines = (step, color, w, strong) => {
    for (let i = -Math.ceil(400 / step); i <= Math.ceil(400 / step); i++) {
      const o = i * step, major = strong;
      for (const along of ['x', 'y']) {
        const a = along === 'x' ? [o, -400, 0] : [-400, o, 0], b = along === 'x' ? [o, 400, 0] : [400, o, 0];
        const d = Math.hypot(along === 'x' ? o - TARGET.x : o - TARGET.y, 0);
        const fade = Math.max(0.2, 1 - d / 260);
        const pa = P(...a), pb = P(...b);
        line(pa, pb, rgb(parse(color), 1, parse(color)[3] * fade * (major ? 0.115 : 0.02)), w);
      }
    }
  };
  gridLines(5, t.c('text'), 1, false);
  gridLines(25, t.c('text'), 1.5, true);

  // The X and Y axes lie on the plate's bottom edges; the plate hides most of them.
  const O = P(0, 0, 0);
  line(O, P(10, 0, 0), t.c('axis_x'), 1.6);
  line(O, P(0, 10, 0), t.c('axis_y'), 1.6);

  // --- The plate outline (80 x 50, 6 mm vertical fillets), counter-clockwise in plan. ---
  const W = 80, D = 50, T = 8, R = 6, STEPS = 10;
  const outline = [];
  [[W - R, R, -90], [W - R, D - R, 0], [R, D - R, 90], [R, R, 180]].forEach(([ccx, ccy, a0]) => {
    for (let i = 0; i <= STEPS; i++) { const a = ((a0 + (i / STEPS) * 90) * Math.PI) / 180; outline.push([ccx + R * Math.cos(a), ccy + R * Math.sin(a), a]); }
  });

  // Outward wall facets, visible ones only, each shaded by its own normal.
  const walls = [];
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i], b = outline[(i + 1) % outline.length];
    const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy);
    if (len < 1e-9) continue;
    const n = [dy / len, -dx / len, 0];
    if (!facing(n)) continue;
    walls.push({ n, quad: [P(a[0], a[1], 0), P(b[0], b[1], 0), P(b[0], b[1], T), P(a[0], a[1], T)] });
  }
  walls.forEach(w => poly(w.quad, rgb(body, light(w.n)), rgb(body, light(w.n)), 0.6));

  // Top face with the two holes cut out.
  const top = outline.map(p => P(p[0], p[1], T));
  const holeD = (x, y, z, r) => { const c = P(x, y, z), rx = r * s, ry = rx / S3; return `M${num(c[0] - rx)},${num(c[1])}a${num(rx)},${num(ry)} 0 1,0 ${num(2 * rx)},0a${num(rx)},${num(ry)} 0 1,0 ${num(-2 * rx)},0z`; };
  const holes = [[12, 25], [68, 25]];
  add('path', { d: `M${pts(top).replace(/ /g, 'L')}z${holes.map(([x, y]) => holeD(x, y, T, 4)).join('')}`, fill: rgb(body, light([0, 0, 1])), 'fill-rule': 'evenodd', stroke: edge, 'stroke-width': 1, 'stroke-linejoin': 'round' });

  // Vertical creases at the fillet tangent lines, and the visible bottom edge.
  [0, STEPS, STEPS + 1, 2 * STEPS + 1, 2 * STEPS + 2, 3 * STEPS + 2, 3 * STEPS + 3, 4 * STEPS + 3].forEach(i => {
    const a = outline[i % outline.length], prev = outline[(i + outline.length - 1) % outline.length], n = [a[1] - prev[1], -(a[0] - prev[0]), 0];
    const m = Math.hypot(n[0], n[1]) || 1;
    if (facing([n[0] / m, n[1] / m, 0]) || facing([-n[1] / m, n[0] / m, 0])) line(P(a[0], a[1], 0), P(a[0], a[1], T), edge, 1);
  });
  for (const w of walls) line(w.quad[0], w.quad[1], edge, 1);

  // Hole walls: the far wall seen through each hole, clipped to the rim ellipse.
  const defs = add('defs', {}, svg);
  const cylinderInside = (x, y, r, z0, z1, id) => {
    const clip = add('clipPath', { id }, defs); ellipse(x, y, z1, r, {}, clip);
    const g = add('g', { 'clip-path': `url(#${id})` });
    const N = 28;
    for (let i = 0; i < N; i++) {
      const a0 = (i / N) * Math.PI * 2, a1 = ((i + 1) / N) * Math.PI * 2, am = (a0 + a1) / 2;
      const n = [-Math.cos(am), -Math.sin(am), 0];            // the wall faces the axis
      if (!facing(n)) continue;
      const p0 = [x + r * Math.cos(a0), y + r * Math.sin(a0)], p1 = [x + r * Math.cos(a1), y + r * Math.sin(a1)];
      poly([P(p0[0], p0[1], z1), P(p1[0], p1[1], z1), P(p1[0], p1[1], z0), P(p0[0], p0[1], z0)], rgb(body, light(n)), rgb(body, light(n)), 0.6, g);
    }
    ellipse(x, y, z1, r, { fill: 'none', stroke: edge, 'stroke-width': 1 });
  };
  holes.forEach(([x, y], i) => cylinderInside(x, y, 4, 0, T, `hole${i}`));

  // --- The boss (24 mm, 14 tall) and its bore (12 mm, through everything). ---
  const BX = 40, BY = 25, BR = 12, BZ = T + 14, BORE = 6;
  const N = 48;
  for (let i = 0; i < N; i++) {
    const a0 = (i / N) * Math.PI * 2, a1 = ((i + 1) / N) * Math.PI * 2, am = (a0 + a1) / 2, n = [Math.cos(am), Math.sin(am), 0];
    if (!facing(n)) continue;
    const p0 = [BX + BR * Math.cos(a0), BY + BR * Math.sin(a0)], p1 = [BX + BR * Math.cos(a1), BY + BR * Math.sin(a1)];
    poly([P(p0[0], p0[1], T), P(p1[0], p1[1], T), P(p1[0], p1[1], BZ), P(p0[0], p0[1], BZ)], rgb(body, light(n)), rgb(body, light(n)), 0.6);
  }
  // The boss meets the plate in a visible front arc; its sides are vertical silhouette lines.
  const sx0 = P(BX, BY, BZ)[0] - BR * s, sx1 = P(BX, BY, BZ)[0] + BR * s;
  line([sx0, P(BX, BY, T)[1]], [sx0, P(BX, BY, BZ)[1]], edge, 1);
  line([sx1, P(BX, BY, T)[1]], [sx1, P(BX, BY, BZ)[1]], edge, 1);
  const base = P(BX, BY, T);
  add('path', { d: `M${num(sx0)},${num(base[1])}A${num(BR * s)},${num((BR * s) / S3)} 0 0,0 ${num(sx1)},${num(base[1])}`, fill: 'none', stroke: edge, 'stroke-width': 1 });
  add('path', { d: `${holeD(BX, BY, BZ, BR)}${holeD(BX, BY, BZ, BORE)}`, fill: rgb(body, light([0, 0, 1])), 'fill-rule': 'evenodd', stroke: edge, 'stroke-width': 1 });
  cylinderInside(BX, BY, BORE, 0, BZ, 'bore');

  // The origin axis (Z) and the origin marker, over the plate's corner.
  line(O, P(0, 0, 10), t.c('axis_z'), 1.6, '3 2');
  add('circle', { cx: num(O[0]), cy: num(O[1]), r: 4, fill: t.c('text'), stroke: t.c('panel'), 'stroke-width': 1.2, opacity: 0.9 });
  return svg;
}
