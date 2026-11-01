// Root-owned execution: these assertions call the compiled SolidCraft Rust codec.
// They deliberately do not implement a JavaScript theme resolver.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const manifestUrl = process.argv[2] ? pathToFileURL(resolve(process.argv[2])) : new URL('../runtime/manifest.json', import.meta.url);
let manifest;
try { manifest = JSON.parse(await readFile(manifestUrl, 'utf8')); }
catch (error) { throw new Error('Build the source-pinned Rust runtime before running the Onyx acceptance checks.', { cause: error }); }
const native = await import(new URL(manifest.module, manifestUrl));
await native.default({ module_or_path: await readFile(new URL(manifest.wasm, manifestUrl)) });
const source = await readFile(new URL('../fixtures/onyx.json', import.meta.url), 'utf8');
const authored = JSON.parse(source);
const contract = JSON.parse(native.contract());
const decode = result => typeof result === 'string' ? JSON.parse(result) : result;
const evaluate = (values = {}, tab = 'MODEL', input = source) => decode(native.evaluate(input, JSON.stringify(values), tab, 'off'));
const exported = input => decode(native.exportDefinition(input));
const ok = result => { assert.equal(result.ok, true, JSON.stringify(result.errors)); return result; };

const initial = ok(evaluate());
const roundtrip = ok(exported(source));
assert.deepEqual(roundtrip.definition, authored, 'Export must retain authored options, rules, tabs, order, provenance and unknown metadata.');
assert.deepEqual(ok(exported(JSON.stringify(roundtrip.definition))).definition, authored);
assert.equal(initial.requires, 2);
assert.equal(initial.needsNewer, false);
assert.deepEqual(initial.definitions.map(option => option.id), ['opacity', 'blur', 'tab_colours', 'tab_fade_ms', 'accent', 'contrast', 'brightness', 'foreground_colours']);
assert.equal(initial.definitions.some(option => option.id === 'edge_finish'), false);
const brightness = initial.definitions.find(option => option.id === 'brightness');
assert.deepEqual([brightness.min, brightness.max, brightness.default, brightness.step, brightness.unit], [60, 120, 100, 1, '%']);
assert.equal(authored.options.find(option => option.id === 'brightness').effect, 'surface_brightness');
assert.equal(authored.borders.primary_inset.width, 0.5);
assert.equal(authored.borders.primary_inset.gap, 1);

const dark = ok(evaluate({ brightness: 60 })), neutral = ok(evaluate({ brightness: 100 })), bright = ok(evaluate({ brightness: 120 }));
const redChannel = color => parseInt(color.slice(1, 3), 16);
for (const key of ['viewport_top', 'viewport_bottom', 'grid']) {
  assert.ok(redChannel(dark.resolved.colors[key]) < redChannel(neutral.resolved.colors[key]), `${key} darkens at 60%.`);
  assert.ok(redChannel(neutral.resolved.colors[key]) < redChannel(bright.resolved.colors[key]), `${key} lightens at 120%.`);
}
for (const key of ['axis_x', 'axis_y', 'axis_z', 'text', 'accent', 'selected_bg']) {
  assert.equal(dark.resolved.colors[key], bright.resolved.colors[key], `${key} is independent of surface brightness.`);
}
assert.equal(ok(evaluate({ brightness: 59 })).effectiveValues.brightness, 60, 'Native saved-value handling clamps below the declared range.');

const silverLiteral = authored.overlays.find(rule => rule.when.opt === 'accent' && rule.when.eq === 'silver').colors.accent;
assert.equal(ok(evaluate({ accent: 'silver' })).resolved.colors.accent, silverLiteral);
const sageLiteral = authored.overlays.find(rule => rule.when.opt === 'accent' && rule.when.eq === 'sage').colors.accent;
assert.equal(ok(evaluate({ accent: 'sage' })).resolved.colors.accent, sageLiteral);
const definedLiteral = authored.overlays.find(rule => rule.when.opt === 'contrast' && rule.when.eq === 'defined').colors.control_fill;
assert.equal(ok(evaluate({ contrast: 'defined' })).resolved.colors.control_fill, definedLiteral);
const vibrantLiteral = authored.overlays.find(rule => rule.when.opt === 'foreground_colours' && rule.when.eq === 'vibrant').colors.axis_x;
assert.equal(ok(evaluate({ foreground_colours: 'muted' })).resolved.colors.axis_x, authored.colors.axis_x);
assert.equal(ok(evaluate({ foreground_colours: 'vibrant' })).resolved.colors.axis_x, vibrantLiteral);
assert.equal(ok(evaluate({ tab_colours: true }, 'SHEET METAL')).resolved.colors.viewport_top, authored.tabs['SHEET METAL'].viewport_top);
assert.equal(ok(evaluate({ tab_colours: false }, 'SHEET METAL')).resolved.colors.viewport_top, authored.colors.viewport_top);
assert.equal(ok(evaluate({ tab_colours: false })).definitions.find(option => option.id === 'tab_fade_ms').active, false);
assert.equal(ok(evaluate({ tab_colours: true })).definitions.find(option => option.id === 'tab_fade_ms').active, true);
assert.equal(ok(evaluate({ opacity: 60 })).effectiveValues.opacity, 60);
assert.equal(ok(evaluate({ opacity: 100 })).effectiveValues.opacity, 100);
assert.equal(ok(evaluate({ blur: 0 })).effectiveValues.blur, 0);
assert.equal(ok(evaluate({ blur: 60 })).effectiveValues.blur, 60);
assert.equal(ok(evaluate({ blur: 5.5 })).effectiveValues.blur, 5.5, 'Integer UI steps must not round existing fractional blur intent.');

const noBrightnessBinding = structuredClone(authored);
delete noBrightnessBinding.options.find(option => option.id === 'brightness').effect;
assert.deepEqual(neutral.resolved, ok(evaluate({}, 'MODEL', JSON.stringify(noBrightnessBinding))).resolved, 'The 100% default preserves the exact authored native appearance.');

const annotated = structuredClone(authored);
annotated.studio_test_metadata = { preserved: true, nested: ['untouched', 42] };
assert.deepEqual(ok(exported(JSON.stringify(annotated))).definition, annotated);
const invalid = structuredClone(authored);
invalid.options.find(option => option.id === 'brightness').min = 59;
assert.equal(exported(JSON.stringify(invalid)).ok, false, 'An unsupported effect bound cannot be exported as a valid theme.');
assert.equal(exported('{').ok, false, 'Incomplete source cannot be exported as a valid theme.');

const future = structuredClone(annotated);
future.requires = contract.supportsLevel + 1;
future.options.push({ id: 'future_option', type: 'future_control', author_data: { preserve: true } });
const futureResult = ok(evaluate({}, 'MODEL', JSON.stringify(future)));
assert.equal(futureResult.needsNewer, true);
assert.deepEqual(futureResult.definitions, []);
assert.deepEqual(ok(exported(JSON.stringify(future))).definition, future, 'Newer definitions must survive without lossy normalization.');

console.log('Onyx authored round-trip, native option behavior, brightness, overlays, workspace colours and future-file preservation passed.');
