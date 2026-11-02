// Sweeping changes are relative, repeatable and order-independent. These checks run against the real
// contract the compiled codec reports (foundation colours, radii, icon palette).
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { apply, blurEdits, blurOf, colourEdits, context, format, opacityEdits, opacityOf, parse, radiusEdits, radiusOf, weightEdits, weightOf } from '../src/sweeps.js';
import { TEMPLATES, buildTemplate } from '../src/templates.js';

const manifestUrl = new URL('../runtime/manifest.json', import.meta.url);
const manifest = JSON.parse(await readFile(manifestUrl, 'utf8'));
const native = await import(new URL(manifest.module, manifestUrl));
await native.default({ module_or_path: await readFile(new URL(manifest.wasm, manifestUrl)) });
const contract = JSON.parse(native.contract());
const fresh = () => ({ format: contract.format, name: 'Sweep', base: 'dark' });
const sweep = (doc, part, op, t) => { apply(doc, colourEdits(context(contract, doc), part, op, t)); return doc; };
const lightness = hex => parse(hex).L;

// Colour maths round-trips opaque and translucent colours.
for (const hex of ['#3a88ee', '#2b2d30cc', '#ffffff', '#000000', '#9eafbd']) assert.equal(format(parse(hex)), hex, `${hex} survives OKLab`);

// Brightness moves every colour the same way, and has no ceiling: repeating it keeps going until a colour saturates.
const once = sweep(fresh(), 'all', 'brightness', 0.5), twice = sweep(structuredClone(once), 'all', 'brightness', 0.5);
assert.ok(lightness(once.colors.panel) > lightness(contract.baseDefaults.dark.colors.panel));
assert.ok(lightness(twice.colors.panel) > lightness(once.colors.panel), 'a second nudge goes further than the first');
assert.ok(lightness(sweep(fresh(), 'all', 'brightness', -0.5).colors.panel) < lightness(contract.baseDefaults.dark.colors.panel));

// A sweep reads the theme as it stands: an edit made before it moves along with it, one made after it stays exactly.
const before = fresh(); before.colors = { accent: '#e0457b' };
sweep(before, 'all', 'brightness', 0.4);
assert.notEqual(before.colors.accent, '#e0457b', 'an earlier edit is carried by the sweep');
assert.ok(lightness(before.colors.accent) > lightness('#e0457b'));
const after = sweep(fresh(), 'all', 'brightness', 0.4); after.colors.accent = '#e0457b';
sweep(after, 'surfaces', 'warmth', 0.5);
assert.equal(after.colors.accent, '#e0457b', 'a part sweep leaves colours outside the part, and later edits, alone');

// Parts do not leak: sweeping text changes text roles and nothing else.
const text = sweep(fresh(), 'text', 'brightness', 0.5);
assert.ok(Object.keys(text.colors).every(key => ['text', 'text_dim', 'icon', 'app_bar_text', 'dialog_label', 'form_ink', 'form_dim', 'cube_text', 'nav_dim', 'nav_tip_ink', 'file_dim', 'file_rail_ink', 'file_recovery_ink'].includes(key)), 'only text roles are authored');
assert.equal(text.icon_palette, undefined, 'text sweeps do not touch the icon palette');

// A hue rotation leaves the meaning colours (errors, axes) alone but turns the rest, icons included.
const hue = sweep(fresh(), 'all', 'hue', 0.8);
assert.equal(hue.colors.error, undefined, 'error keeps its colour');
assert.equal(hue.colors.axis_x, undefined, 'the X axis stays red');
assert.notEqual(hue.colors.accent, contract.baseDefaults.dark.colors.accent);
assert.ok(Object.keys(hue.icon_palette || {}).length > 0, 'icon colours rotate with the rest');

// Contrast pivots on the panel: the panel itself does not move, text moves away from it.
const contrast = sweep(fresh(), 'all', 'contrast', 0.8);
assert.equal(contrast.colors.panel, undefined, 'the pivot surface stays');
assert.ok(Math.abs(lightness(contrast.colors.text) - lightness(contract.baseDefaults.dark.colors.panel)) > Math.abs(lightness(contract.baseDefaults.dark.colors.text) - lightness(contract.baseDefaults.dark.colors.panel)));

// Nothing bounds a drag: far past one wheel-travel, ops stop at their own floor instead of turning inside out.
const far = sweep(fresh(), 'all', 'contrast', -6);
assert.ok(lightness(far.colors.text) > lightness(contract.baseDefaults.dark.colors.panel), 'maximum softness collapses toward the panel, never past it');
const grey = sweep(fresh(), 'all', 'intensity', -9);
assert.ok(Object.values(grey.colors).flat().every(value => /^#[0-9a-f]{6}([0-9a-f]{2})?$/.test(value)), 'drained colour is still colour');
assert.ok(Math.hypot(parse(grey.colors.accent).a, parse(grey.colors.accent).b) < 0.005, 'intensity bottoms out at grey');
// Surface opacity is a slider on an absolute value: it moves each glass surface by the same amount and never clears them.
const glassy = fresh(); apply(glassy, opacityEdits(context(contract, glassy), -0.3));
assert.equal(opacityOf(context(contract, glassy)), Math.round((opacityOf(context(contract, fresh())) - 30)), 'the slider reads back what it set');
apply(glassy, opacityEdits(context(contract, glassy), -5));
assert.ok(parse(glassy.colors.panel).alpha >= 0.039, 'surfaces never vanish entirely');
assert.equal(weightOf(context(contract, fresh())), 1);
const blurred = fresh(); apply(blurred, blurEdits(context(contract, blurred), 1));
assert.equal(blurOf(context(contract, blurred)), 20, 'blur reads back its default after the nudge');
assert.ok(lightness(sweep(fresh(), 'all', 'brightness', 40).colors.panel) <= 1, 'brightness saturates at white');

// Corners share a centre: one slider moves every radius by the same amount, so nested offsets are kept.
const ctx = context(contract, fresh()), radii = contract.baseDefaults.dark.radii;
const moved = Object.fromEntries(radiusEdits(ctx, ['radius_xl', 'radius_lg', 'radius_md', 'radius_sm'], 3).map(([[, key], value]) => [key, value]));
assert.deepEqual(Object.entries(moved).map(([key, value]) => value - radii[key]), [3, 3, 3, 3]);
assert.equal(radiusOf(ctx, 'windows'), radii.radius_xl);
assert.ok(radiusEdits(ctx, ['radius_sm'], -99).every(([, value]) => value === 0), 'radii stop at square');

// Line weight authors the panel outline from the foundation's border colour, then keeps thickening.
const weighted = fresh(); apply(weighted, weightEdits(context(contract, weighted), 0.5));
assert.ok(weighted.borders.primary.width > 1);
const heavier = structuredClone(weighted); apply(heavier, weightEdits(context(contract, heavier), 0.5));
assert.ok(heavier.borders.primary.width > weighted.borders.primary.width);

// Every template is a valid starting document.
for (const template of TEMPLATES) {
  const doc = buildTemplate(contract, template), result = JSON.parse(native.evaluate(JSON.stringify(doc), '{}', 'MODEL', 'off'));
  assert.equal(result.ok, true, `${template.name}: ${JSON.stringify(result.errors)}`);
}
console.log('Sweeps are relative and repeatable, parts stay in their lane, corners stay concentric and every template evaluates.');
