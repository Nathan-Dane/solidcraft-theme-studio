// The Overview page: who the theme is, which look it starts from, and sweeping controls that move the
// whole app (or one part of it) toward what the author wants before the granular tabs take over.
//
// Every sweep is relative. A control starts at zero each time you touch it, shows its effect live while
// you drag, and keeps it on release, so it can be used before or after any fine edit and repeated
// without a ceiling. Each drag is a single Undo step.
import { el, field, heading, button } from './dom.js';
import { clone } from './state.js';
import { CONTROLS, CORNERS, PARTS, SECTION_SWEEPS, apply, blurEdits, blurOf, colourEdits, context, opacityEdits, opacityOf, radiusEdits, radiusOf, retintEdits, samples, weightEdits, weightOf } from './sweeps.js';
import { TEMPLATES, buildTemplate } from './templates.js';
import { dial, signed, slide } from './wheel.js';

/** Replace the document with `snapshot` plus `edits`, so the same drag can be re-run from the same starting point. */
const rebuild = (snapshot, edits) => doc => {
  for (const key of Object.keys(doc)) delete doc[key];
  Object.assign(doc, clone(snapshot));
  apply(doc, edits);
};

export function overviewEditor(editor) {
  const live = [];
  editor.release?.();
  editor.release = editor.store.subscribe(() => { for (const refresh of live) refresh(); });
  const { root } = editor;
  root.append(heading('START HERE', 'Shape your theme.', 'Name it, choose a look to start from, then sweep the whole app toward what you want. The other tabs are for fine-tuning.'));
  root.append(identity(editor, live), templates(editor), sweeps(editor, live), fineTune(editor));
}

const ctxOf = editor => context(editor.contract, editor.store.get().document);

// ---- Identity -------------------------------------------------------------------------------------------

function strip(editor, live, keys) {
  const node = el('div', { class: 'ov-strip', 'aria-hidden': 'true' });
  const draw = () => {
    const ctx = ctxOf(editor);
    node.replaceChildren(...keys.map(key => { const value = ctx.colours(key), swatch = el('i'); swatch.style.background = String((Array.isArray(value) ? value[0] : value) || '#808080').slice(0, 7); return swatch; }));
  };
  draw(); live.push(draw);
  return node;
}

function identity(editor, live) {
  const doc = editor.store.get().document;
  const section = el('section', { class: 'ov-section', 'aria-labelledby': 'ov-identity' }, el('h3', { id: 'ov-identity', class: 'small-heading' }, 'Identity'));
  const name = editor.text(['name'], { maxlength: 80, placeholder: 'Name your theme', class: 'ov-name', 'aria-label': 'Theme name' });
  section.append(name);
  const foundation = el('div', { class: 'ov-segment', role: 'group', 'aria-label': 'Foundation' });
  const buttons = ['dark', 'light'].map(base => {
    const choice = el('button', { type: 'button', 'aria-pressed': String((doc.base || 'dark') === base), onclick: () => { editor.update(['base'], base); buttons.forEach(item => item.setAttribute('aria-pressed', String(item === choice))); } }, base === 'dark' ? 'Dark foundation' : 'Light foundation');
    return choice;
  });
  foundation.append(...buttons);
  section.append(el('div', { class: 'ov-line' }, foundation, strip(editor, live, ['viewport_bottom', 'panel', 'text', 'accent', 'sketch_accent', 'error'])));
  section.append(el('p', { class: 'field-help' }, 'Anything you do not set inherits from the foundation.'));
  section.append(field('Credit', editor.text(['provenance'], { placeholder: 'Who made it, or where it comes from' })));
  return section;
}

// ---- Templates ------------------------------------------------------------------------------------------

function templates(editor) {
  const section = el('section', { class: 'ov-section', 'aria-labelledby': 'ov-templates' }, el('h3', { id: 'ov-templates', class: 'small-heading' }, 'Start from a look'));
  section.append(el('p', { class: 'field-help' }, 'Choosing one replaces the current theme (Undo brings it back). Every look is an ordinary theme you can keep sweeping.'));
  const grid = el('div', { class: 'template-grid' });
  for (const template of TEMPLATES) {
    const doc = buildTemplate(editor.contract, template), ctx = context(editor.contract, doc);
    const card = el('button', { type: 'button', class: 'template-card', title: template.blurb, onclick: () => {
      if (editor.store.get().dirty && !confirm(`Start from ${template.name}? Your current theme stays available through Undo.`)) return;
      editor.store.replace(buildTemplate(editor.contract, template), false); editor.notify(`Started from ${template.name}.`);
    } });
    const swatches = el('span', { class: 'ov-strip', 'aria-hidden': 'true' }, ...['viewport_bottom', 'panel', 'text', 'accent', 'sketch_accent'].map(key => { const swatch = el('i'); swatch.style.background = String(ctx.colours(key) || '#808080').slice(0, 7); return swatch; }));
    card.append(swatches, el('strong', {}, template.name), el('span', { class: 'template-blurb' }, template.blurb));
    grid.append(card);
  }
  section.append(grid);
  return section;
}

// ---- Sweeping controls ----------------------------------------------------------------------------------

/**
 * A relative, boundless control. `edits(ctx, t)` says what amount `t` does to the theme as it stood when the drag
 * began (t = 1 is a drag of one wheel-travel, and nothing stops it going further). The wheel never holds a position:
 * each drag starts from the theme as it is now, so the next drag carries on from here.
 */
function nudge(editor, spec, edits, scope) {
  const id = `sweep:${scope}:${spec.name}`;
  let snapshot = null;
  const run = (t, key) => {
    const base = snapshot || clone(editor.store.get().document);
    editor.store.change(rebuild(base, edits(context(editor.contract, base), t)), key);
  };
  return dial({
    ...spec, ppu: 140,
    begin: () => { snapshot = clone(editor.store.get().document); },
    drag: units => { run(units, id); return signed(Math.round(units * 100)); },
    finish: () => { editor.store.endTransaction(); snapshot = null; editor.afterSweep?.(); },
    step: sign => { editor.store.endTransaction(); run(sign * 0.2); editor.afterSweep?.(); return signed(sign * 20); }
  }).node;
}

/**
 * A slider for a value with a range and a number to show. It is relative underneath: dragging it by some amount makes
 * that same change to everything in its scope (every corner, every outline), so what was offset stays offset.
 */
function absolute(editor, live, spec) {
  let snapshot = null;
  const control = slide({
    ...spec,
    read: () => spec.read(ctxOf(editor)),
    apply: delta => {
      snapshot ||= clone(editor.store.get().document);
      editor.store.change(rebuild(snapshot, spec.edits(context(editor.contract, snapshot), delta)), `sweep:${spec.name}`);
    },
    finish: () => { editor.store.endTransaction(); snapshot = null; editor.afterSweep?.(); }
  });
  live.push(control.refresh);
  return control.node;
}

const corner = (editor, live, name, group, help) => absolute(editor, live, { name, help, low: 'Square', high: 'Round', min: 0, max: 32, read: ctx => radiusOf(ctx, group), edits: (ctx, delta) => radiusEdits(ctx, CORNERS[group], delta) });

// Values with a range: a slider that shows the number. Everything else on this page is a wheel.
const SLIDERS = {
  weight: { min: 0, max: 4, step: 0.05, unit: 'pt', read: weightOf, edits: (ctx, delta) => weightEdits(ctx, delta / 0.6) },
  blur: { min: 0, max: 60, step: 1, unit: 'px', read: blurOf, edits: (ctx, delta) => blurEdits(ctx, delta / 20) },
  opacity: { min: 4, max: 100, step: 1, unit: '%', read: opacityOf, edits: (ctx, delta) => opacityEdits(ctx, delta / 100) }
};

const CORNER_HELP = {
  all: ['Corner roundness', 'The roundness of every corner. Nested corners share a centre, so one number moves them together and keeps each one’s offset.'],
  windows: ['Windows & panels', 'The outer corners of windows, dialogs and panels.'],
  controls: ['Buttons & fields', 'The corners of buttons, fields and sketch tools.'],
  details: ['Small details', 'The smallest corners: chips, keycaps and badges.']
};

/** Recolour the accent: pick the colour you want and the accent roles rotate and re-saturate to meet it. */
function accentPicker(editor) {
  const ctx = ctxOf(editor), current = String(ctx.colours('accent') || '#3a88ee').slice(0, 7);
  const picker = el('input', { type: 'color', value: current, 'aria-label': 'Accent colour' });
  let snapshot = null;
  picker.addEventListener('input', () => {
    snapshot ||= clone(editor.store.get().document);
    const base = context(editor.contract, snapshot);
    editor.store.change(rebuild(snapshot, retintEdits(base, 'accent', picker.value)), 'sweep:accent');
  });
  picker.addEventListener('change', () => { editor.store.endTransaction(); snapshot = null; });
  return el('div', { class: 'nudge accent-pick' }, el('div', { class: 'nudge-head' }, el('span', { class: 'nudge-name', title: 'Pick the accent colour you want. Selection, highlights and primary buttons follow it; everything else keeps its relationships.' }, 'Accent colour')), el('div', { class: 'nudge-body' }, picker, el('span', { class: 'field-help' }, 'Selection, highlights and primary buttons')));
}

/** A wheel for a sweep with no bounds and no number of its own, a slider for one that has a range. */
function colourControl(editor, live, partId, op) {
  if (SLIDERS[op]) return absolute(editor, live, { ...CONTROLS[op], ...SLIDERS[op] });
  return nudge(editor, CONTROLS[op], (ctx, t) => colourEdits(ctx, partId, op, t), partId);
}

const cluster = (title, ...children) => el('div', { class: 'ov-cluster' }, el('h4', {}, title), ...children);

function sweeps(editor, live) {
  const section = el('section', { class: 'ov-section', 'aria-labelledby': 'ov-sweeps' }, el('h3', { id: 'ov-sweeps', class: 'small-heading' }, 'Sweeping changes'));
  section.append(el('p', { class: 'field-help' }, 'These move what you have now rather than setting a fixed value, so they work before or after fine-tuning and you can keep going. Drag to try, release to keep. Undo takes back a drag. Each tab on the left opens with the same kind of controls for just its part of the app.'));
  section.append(
    cluster('Light & shade', colourControl(editor, live, 'all', 'brightness'), colourControl(editor, live, 'all', 'contrast')),
    cluster('Colour', colourControl(editor, live, 'all', 'warmth'), colourControl(editor, live, 'all', 'intensity'), colourControl(editor, live, 'all', 'hue'), accentPicker(editor)),
    cluster('Shape & lines', corner(editor, live, ...CORNER_HELP.all.slice(0, 1), 'all', CORNER_HELP.all[1]), colourControl(editor, live, 'lines', 'weight')),
    cluster('Glass', colourControl(editor, live, 'surfaces', 'opacity'), colourControl(editor, live, 'surfaces', 'blur'))
  );
  return section;
}

/** One part of the app, with the controls that suit it. */
function partDetails(editor, live, part) {
  const details = el('details', { class: 'ov-part' }, el('summary', {}, el('span', { class: 'ov-part-name' }, part.name), partStrip(editor, live, part.id)));
  details.append(el('p', { class: 'field-help' }, part.blurb), ...part.controls.map(op => colourControl(editor, live, part.id, op)));
  return details;
}

/**
 * The sweeping controls at the top of an editing tab: first the ones that move everything the tab covers, then, folded
 * beneath, the ones for each part of it. The element groups below them are the finest level.
 */
export function sectionSweeps(editor, id) {
  const spec = SECTION_SWEEPS[id], live = [];
  editor.release?.();
  editor.release = editor.store.subscribe(() => { for (const refresh of live) refresh(); });
  const box = el('details', { class: 'ov-sweepbox', open: true }, el('summary', {}, el('span', {}, `Sweep all of ${spec.name}`), el('span', { class: 'ov-hint' }, 'relative, boundless')));
  box.append(el('p', { class: 'field-help' }, 'These move what you have now rather than setting a value, so they work before or after the fine controls below.'));
  const wide = el('div', { class: 'ov-cluster' }, ...spec.wide.map(op => nudge(editor, CONTROLS[op], (ctx, t) => colourEdits(ctx, spec.parts, op, t), `section:${id}`)));
  box.append(wide);
  if (spec.corners) box.append(cluster('Corners', corner(editor, live, ...CORNER_HELP.all.slice(0, 1), 'all', CORNER_HELP.all[1])));
  if (spec.parts.length > 1) {
    box.append(el('h4', { class: 'ov-subhead' }, 'Parts'));
    for (const part of PARTS.filter(item => spec.parts.includes(item.id))) box.append(partDetails(editor, live, part));
  } else {
    const only = PARTS.find(item => item.id === spec.parts[0]);
    const extra = only.controls.filter(op => !spec.wide.includes(op));
    if (extra.length) box.append(cluster('Specifics', ...extra.map(op => colourControl(editor, live, only.id, op))));
  }
  if (spec.corners) {
    const corners = el('details', { class: 'ov-part' }, el('summary', {}, el('span', { class: 'ov-part-name' }, 'Corners by kind')));
    corners.append(el('p', { class: 'field-help' }, 'Corners nest inside one another, so each slider moves its whole group by the same amount.'), ...['windows', 'controls', 'details'].map(group => corner(editor, live, CORNER_HELP[group][0], group, CORNER_HELP[group][1])));
    box.append(corners);
  }
  return box;
}

/** The part's tonal range, as five swatches that follow the document. */
function partStrip(editor, live, partId) {
  const node = el('span', { class: 'ov-strip small', 'aria-hidden': 'true' });
  const draw = () => node.replaceChildren(...samples(ctxOf(editor), partId, 5).map(colour => { const swatch = el('i'); swatch.style.background = colour; return swatch; }));
  draw(); live.push(draw);
  return node;
}

// ---- Fine-tune and advanced ----------------------------------------------------------------------------

function fineTune(editor) {
  const section = el('section', { class: 'ov-section', 'aria-labelledby': 'ov-fine' }, el('h3', { id: 'ov-fine', class: 'small-heading' }, 'Then fine-tune'));
  section.append(el('div', { class: 'button-row' }, ...[['Interface', 'interface'], ['Viewport', 'viewport'], ['Text & icons', 'text'], ['Workspaces', 'workspaces'], ['Options', 'options']].map(([label, id]) => button(label, () => editor.select(id)))));
  const advanced = el('details', { class: 'ov-advanced' }, el('summary', {}, 'Advanced'));
  advanced.append(el('div', { class: 'inline-row' }, field('Picker order', editor.number(['order'], { step: 1 })), field('Required theme level', editor.number(['requires'], { min: 0, step: 1 }))), el('p', { class: 'field-help' }, 'Level 2 enables continuous surface brightness. Source keeps any extra metadata exactly as authored.'));
  section.append(advanced);
  return section;
}
