// The viewport in sketch mode: the sketch plane seen face-on, with the app's grid, origin axes,
// a profile with dimensions, a construction line, snap markers and the selection edge.
// Same node classes as the 3D part so panning and Inspect work unchanged.
const NS = 'http://www.w3.org/2000/svg';

export function sketchView(tokens, width, height, pan = { x: 0, y: 0 }) {
  const t = tokens;
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'pv-part');
  svg.setAttribute('width', width); svg.setAttribute('height', height);
  svg.dataset.label = 'Viewport (sketch)'; svg.dataset.roles = 'grid,grid_major,axis_x,axis_y,sketch,sketch_construction,sketch_point,dimension,sel_edge';
  const world = document.createElementNS(NS, 'g');
  world.setAttribute('class', 'pv-world'); world.setAttribute('transform', `translate(${pan.x} ${pan.y})`);
  svg.append(world);
  const s = (height - 38) / 110, ox = width * 0.5 - 40 * s, oy = height * 0.5 + 25 * s;
  const X = u => ox + u * s, Y = u => oy - u * s;
  const line = (a, b, stroke, w, extra = '') => `<line x1="${X(a[0])}" y1="${Y(a[1])}" x2="${X(b[0])}" y2="${Y(b[1])}" stroke="${stroke}" stroke-width="${w}" ${extra}/>`;
  let m = '';
  const span = 220;
  for (let i = -span; i <= span; i += 5) {
    const major = i % 25 === 0, c = major ? t.c('grid_major') : t.c('grid'), w = major ? 1.5 : 1;
    m += line([i, -span], [i, span], c, w) + line([-span, i], [span, i], c, w);
  }
  m += line([0, 0], [14, 0], t.c('axis_x'), 2) + line([0, 0], [0, 14], t.c('axis_y'), 2);
  m += `<polygon points="${X(0)},${Y(0)} ${X(80)},${Y(0)} ${X(80)},${Y(50)} ${X(0)},${Y(50)}" fill="${t.c('sel_profile')}"/>`;
  m += line([0, 0], [80, 0], t.c('sketch'), 2) + line([80, 50], [0, 50], t.c('sketch'), 2) + line([0, 50], [0, 0], t.c('sketch'), 2);
  m += line([80, 0], [80, 50], t.c('sel_edge_rim'), 5) + line([80, 0], [80, 50], t.c('sel_edge'), 2.5);
  m += line([40, -6], [40, 56], t.c('sketch_construction'), 1.2, 'stroke-dasharray="7 5"');
  for (const cx of [12, 68]) m += `<circle cx="${X(cx)}" cy="${Y(25)}" r="${4 * s}" fill="none" stroke="${t.c('sketch')}" stroke-width="2"/>`;
  m += `<circle cx="${X(40)}" cy="${Y(25)}" r="${12 * s}" fill="none" stroke="${t.c('sketch_fixed')}" stroke-width="2"/>`;
  m += `<circle cx="${X(40)}" cy="${Y(25)}" r="${6 * s}" fill="none" stroke="${t.c('sketch')}" stroke-width="2"/>`;
  [[0, 0], [80, 0], [80, 50], [0, 50], [12, 25], [68, 25], [40, 25]].forEach(([x, y], i) => { m += `<circle cx="${X(x)}" cy="${Y(y)}" r="3.5" fill="${i === 0 ? t.c('sketch_point') : t.c('sketch_point_free')}"/>`; });
  const dim = (a, b, off, text, color, vertical) => {
    const [x1, y1, x2, y2] = vertical ? [a[0] + off, a[1], b[0] + off, b[1]] : [a[0], a[1] + off, b[0], b[1] + off];
    const mid = [(x1 + x2) / 2, (y1 + y2) / 2];
    return line([x1, y1], [x2, y2], color, 1) + line(a, [x1, y1], color, 0.8) + line(b, [x2, y2], color, 0.8) +
      `<text x="${X(mid[0]) + (vertical ? 8 : 0)}" y="${Y(mid[1]) + (vertical ? 4 : -5)}" text-anchor="${vertical ? 'start' : 'middle'}" font-size="13" fill="${color}" font-family="Plex,system-ui,sans-serif">${text}</text>`;
  };
  m += dim([0, 0], [80, 0], -9, '80 mm', t.c('dimension')) + dim([80, 0], [80, 50], 9, '50 mm', t.c('dimension')) + dim([28, 25], [52, 25], -22, '(24 mm)', t.c('dimension_driven'));
  world.innerHTML = m;
  return svg;
}
