// The analytic isometric part behind the full-app scene: ground grid, axes, a rounded plate with
// a bossed bore and two holes, drawn from the theme's viewport tokens. It is deliberately simple
// geometry (the same study the native scene paints), not a CAD model.
const NS = 'http://www.w3.org/2000/svg';

function shade(hex, factor) {
  const [r, g, b, a] = parse(hex);
  const k = v => Math.max(0, Math.min(255, Math.floor(v * factor)));
  return `rgba(${k(r)},${k(g)},${k(b)},${a / 255})`;
}
function parse(hex) {
  const v = hex.replace('#', '');
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16), v.length >= 8 ? parseInt(v.slice(6, 8), 16) : 255];
}

function hull(points) {
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]).filter((p, i, all) => !i || p[0] !== all[i - 1][0] || p[1] !== all[i - 1][1]);
  if (sorted.length < 3) return sorted;
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const out = [];
  for (const pass of [sorted, [...sorted].reverse()]) {
    const start = out.length;
    for (const p of pass) {
      while (out.length >= start + 2 && cross(out[out.length - 2], out[out.length - 1], p) <= 0) out.pop();
      out.push(p);
    }
    out.pop();
  }
  return out;
}

export function part(tokens, width, height) {
  const t = tokens;
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'pv-part');
  svg.setAttribute('width', width); svg.setAttribute('height', height);
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  const scale = Math.min(Math.max(Math.min(width / 230, height / 140), 0.8), 5);
  const origin = [width / 2 - width * 0.02, height / 2 + height * 0.06];
  const at = (x, y, z) => [origin[0] + (x - y) * 0.866 * scale, origin[1] + ((x + y) * 0.5 - z) * scale];
  const add = (name, attrs) => { const node = document.createElementNS(NS, name); for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v); svg.append(node); return node; };
  const line = (a, b, color, w) => add('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke: color, 'stroke-width': w, 'stroke-linecap': 'butt' });
  const poly = (points, fill, stroke, w = 1) => add('polygon', { points: points.map(p => p.join(',')).join(' '), fill, stroke, 'stroke-width': w, 'stroke-linejoin': 'round' });
  const faded = (hex, k) => { const [r, g, b, a] = parse(hex); return `rgba(${r},${g},${b},${(a / 255) * k})`; };

  for (let step = -12; step <= 12; step++) {
    const offset = step * 10, major = step % 5 === 0;
    const fade = Math.min(Math.max(1 - Math.abs(step) / 13, 0.15), 1);
    const color = faded(major ? t.c('grid_major') : t.c('grid'), fade), w = major ? 1.2 : 0.8;
    line(at(offset, -120, 0), at(offset, 120, 0), color, w);
    line(at(-120, offset, 0), at(120, offset, 0), color, w);
  }
  line(at(0, 0, 0), at(110, 0, 0), t.c('axis_x'), 1.5);
  line(at(0, 0, 0), at(0, 110, 0), t.c('axis_y'), 1.5);
  line(at(0, 0, 0), at(0, 0, 80), t.c('axis_z'), 1.5);

  const edge = t.c('body_edge'), body = t.c('body');
  const [hx, hy, thick, corner] = [58, 36, 12, 9];
  const outline = z => {
    const points = [];
    for (const [cx, cy, start] of [[hx - corner, hy - corner, 0], [-(hx - corner), hy - corner, 0.25], [-(hx - corner), -(hy - corner), 0.5], [hx - corner, -(hy - corner), 0.75]]) {
      for (let i = 0; i <= 8; i++) {
        const angle = (start + (i / 8) * 0.25) * Math.PI * 2;
        points.push(at(cx + corner * Math.cos(angle), cy + corner * Math.sin(angle), z));
      }
    }
    return points;
  };
  const ring = (cx, cy, z, radius) => Array.from({ length: 64 }, (_, i) => {
    const a = (i / 64) * Math.PI * 2;
    return at(cx + radius * Math.cos(a), cy + radius * Math.sin(a), z);
  });
  poly(hull([...outline(0), ...outline(thick)]), shade(body, 0.62), edge);
  poly(outline(thick), body, edge);
  for (const [cx, cy] of [[-38, 20], [40, -20]]) poly(ring(cx, cy, thick, 6.5), shade(body, 0.28), edge);
  const bossTop = thick + 26;
  poly(hull([...ring(8, 0, thick, 24), ...ring(8, 0, bossTop, 24)]), shade(body, 0.66), edge);
  poly(ring(8, 0, bossTop, 24), shade(body, 1.06), edge);
  poly(ring(8, 0, bossTop, 13), shade(body, 0.30), edge);

  const sel = [at(-hx + corner, -hy, thick), at(-hx + corner, hy - corner, thick)];
  line(sel[0], sel[1], t.c('sel_edge_rim'), 4); line(sel[0], sel[1], t.c('sel_edge'), 2);
  const hov = [at(hx - corner, hy, thick), at(-hx + corner, hy, thick)];
  line(hov[0], hov[1], t.c('hover_edge_halo'), 4); line(hov[0], hov[1], t.c('hover_edge'), 2);
  return svg;
}
