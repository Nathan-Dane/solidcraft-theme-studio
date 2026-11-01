import { createStore, pretty } from './state.js';
import { Editor } from './editor.js';
import { el, field } from './dom.js';
import { friendly } from './authoring.js';
import * as bridge from './bridge.js';

const $ = selector => document.querySelector(selector);
if (matchMedia('(max-width:800px)').matches) $('.try-options').open = false;
let noticeTimer;
function notify(message) { const notice = $('#notice'); notice.textContent = message; notice.hidden = false; clearTimeout(noticeTimer); noticeTimer = setTimeout(() => notice.hidden = true, 4500); }
const response = await fetch(new URL('../fixtures/onyx.json', import.meta.url));
if (!response.ok) throw new Error('The bundled Onyx theme could not be loaded.');
const starter = await response.json();
const store = createStore(starter);
const editor = new Editor($('#editor'), store, notify);
let ready = false, previewReady = false, rendererPresented = false, schema = null, evaluation = null, pendingEvaluation = 0, evaluationTimer;
let expectedNativePreview = null;
let rendererInfo = null;
let previewLanguage = 'en-GB';
const categoryScene = { surfaces: 'glass', icons: 'icons', tabs: 'tools', options: 'controls' };
const sceneNames = { app: 'Full app', tools: 'Tools & tabs', browser: 'Browser & history', controls: 'Feature controls', glass: 'Glass & menus', viewport: 'Viewport details', icons: 'Icon lab' };
const recovered = store.recover();
if (recovered) notify('Your last theme draft is back on the workbench.');

function errors(result) {
  const value = result?.errors || result?.error;
  return Array.isArray(value) ? value.map(item => typeof item === 'string' ? item : item.message || JSON.stringify(item)).join('\n') : value ? String(value) : '';
}
function refreshChrome(state) {
  $('#document-title').textContent = state.document.name || 'Untitled theme';
  document.title = `${state.document.name || 'Untitled'} · SolidCraft Theme Studio`;
  $('#dirty-indicator').hidden = !state.dirty;
  $('#undo-button').disabled = !state.canUndo; $('#redo-button').disabled = !state.canRedo;
  $('#workspace-select').value = state.workspace; $('#vision-select').value = state.vision;
  $('#compare-button').setAttribute('aria-pressed', !!state.comparison);
  $('#compare-button').textContent = state.comparison ? 'Unpin comparison' : 'Pin comparison';
  $('#save-status').textContent = state.storage === 'saved' ? (state.parseError ? 'Draft saved · JSON needs attention' : 'Saved in this browser') : state.storage === 'unavailable' ? 'Browser recovery unavailable · export to keep' : 'Preparing browser recovery…';
}
function sourceErrors(message) { const target = $('#source-errors'); if (target) { target.textContent = message; target.hidden = !message; } }
async function applyView(config) {
  if (!previewReady || typeof bridge.runtime()?.setView !== 'function') return;
  const result = await bridge.call('setView', JSON.stringify(config));
  if (result?.ok === false) throw new Error(errors(result) || 'The preview could not change view.');
  return result;
}
function renderDiagnostics() {
  if (!$('#about-dialog').open) return;
  const radius = value => Number.isFinite(value) ? `${Number(value.toFixed(2))} px` : 'Not reported';
  const renderer = rendererInfo?.current || rendererInfo, counts = renderer?.counters;
  const status = !previewReady ? 'Unavailable' : rendererPresented ? 'Live · actual SolidCraft renderer' : 'Preparing a frame';
  const blur = !renderer ? 'Waiting for the renderer' : renderer.pending ? 'Preparing the effect' : renderer.error ? `${radius(renderer.requestedRadius)} requested · effect unavailable` : renderer.requestedRadius === 0 ? 'Off · 0 px requested' : `${radius(renderer.requestedRadius)} requested · ${radius(renderer.effectiveRadius)} rendered`;
  const rows = [['Theme tools', ready ? 'Available · authoritative Rust codec' : 'Loading'], ['Preview', status], ['Blur', blur], ['Theme level', schema ? String(schema.supportsLevel) : 'Not yet available']];
  if (renderer?.physicalSize) rows.push(['Canvas', `${renderer.physicalSize.join(' × ')} physical pixels`]);
  if (Number.isFinite(renderer?.pixelsPerPoint)) rows.push(['Device scale', `${renderer.pixelsPerPoint}×`]);
  if (rendererInfo?.comparison) {
    const baseline = rendererInfo.comparison;
    rows.push(['Pinned preview', baseline.pending ? 'Preparing' : baseline.error ? 'Effect unavailable · see rendering details' : `${radius(baseline.effectiveRadius)} blur rendered`]);
  }
  $('#renderer-diagnostics').replaceChildren(...rows.map(([label, value]) => el('div', {}, el('dt', {}, label), el('dd', {}, value))));
  $('#renderer-counters').textContent = JSON.stringify({ source: schema?.sourceCommit || 'Not loaded', capability: schema?.capabilities || {}, renderer: renderer || null }, null, 2);
  if (counts) $('#renderer-counters').setAttribute('aria-label', 'Actual renderer state and counters');
}
function renderInspection(hit) {
  const panel = $('#inspection-panel'); panel.replaceChildren();
  if (!hit) { panel.append(el('strong', {}, 'Find the colour behind a detail.'), el('p', { class: 'field-help' }, 'Hover a preview element. Click it to lock the selection, then choose one of its roles to edit.')); panel.hidden = false; return; }
  const title = el('div', { class: 'inspection-heading' }, el('div', {}, el('span', { class: 'eyebrow' }, `${hit.baseline ? 'Pinned comparison · ' : ''}${sceneNames[hit.scene] || 'NATIVE PREVIEW HIT'}`), el('strong', {}, hit.label || 'Preview element')), el('span', { class: 'inspection-lock' }, hit.locked ? 'Selection locked' : 'Last hovered'), el('button', { type: 'button', class: 'icon-button', 'aria-label': 'Close inspector', onclick: () => $('#inspect-button').click() }, '×'));
  const chips = el('div', { class: 'inspection-roles' });
  for (const entry of Array.isArray(hit.roles) ? hit.roles : []) {
    const key = typeof entry === 'string' ? entry : entry?.key || entry?.role || entry?.name;
    if (!key) continue;
    const target = editor.roleTarget(key), parts = key.split('.');
    const label = key.startsWith('icon_palette.') ? `Icon · ${friendly(parts.slice(1).join('.'))}` : key.startsWith('borders.') ? `Border · ${friendly(parts.slice(1).join('.'))}` : friendly(key);
    const chip = el(target ? 'button' : 'span', { class: `inspection-role${target ? ' editable' : ''}`, ...(target ? { type: 'button', onclick: () => editor.navigateRole(key), title: `Edit ${key}` } : { title: 'Native role metadata; no editable file field is available.' }) }, el('span', { class: 'inspection-role-name' }, label), el('code', {}, key));
    if (typeof entry === 'object' && Object.hasOwn(entry, 'value')) {
      const values = Array.isArray(entry.value) ? entry.value : [entry.value];
      const swatches = el('span', { class: 'inspection-swatches' });
      for (const value of values) if (typeof value === 'string' && /^#[\da-f]{6}(?:[\da-f]{2})?$/i.test(value)) { const swatch = el('i', { title: value }); swatch.style.backgroundColor = value; swatches.append(swatch); }
      if (swatches.childElementCount) chip.prepend(swatches);
      chip.append(el('span', { class: 'inspection-value' }, typeof entry.value === 'string' ? entry.value : JSON.stringify(entry.value)));
    }
    chips.append(chip);
  }
  panel.append(title, chips, el('details', { class: 'inspection-raw' }, el('summary', {}, 'Native hit details'), el('pre', {}, JSON.stringify(hit, null, 2)))); panel.hidden = false;
}
function validationBanner(message, warning = false) {
  const banner = $('#validation-banner'); banner.replaceChildren(); banner.hidden = !message; banner.classList.toggle('warning', warning);
  if (message) banner.append(el('strong', {}, warning ? 'A newer theme format' : 'Your preview is safe'), el('p', {}, message), el('button', { type: 'button', class: 'text-button', onclick: () => editor.select('source') }, 'Review source'));
}
async function updatePreview() {
  const request = ++pendingEvaluation;
  const state = store.get();
  if (state.parseError) { $('#export-button').disabled = true; sourceErrors(state.parseError); validationBanner(state.parseError); return; }
  if (!ready) return;
  try {
    const result = await bridge.evaluate(state);
    if (request !== pendingEvaluation) return;
    evaluation = result; editor.setRuntime(schema, result);
    const message = errors(result);
    const valid = result.ok !== false && !message;
    $('#export-button').disabled = !valid;
    sourceErrors(message);
    validationBanner(message || (result.needsNewer ? 'This definition requires a newer SolidCraft theme level. Its base palette can be previewed; options and rules stay preserved in the file.' : ''), result.needsNewer);
    if (!valid) return;
    store.acceptValid(state.text);
    if (previewReady) {
      const painted = await bridge.preview(state);
      if (painted?.ok === false || errors(painted)) throw new Error(errors(painted) || 'The preview could not accept this theme.');
      expectedNativePreview = { values: effective(result), tab: state.workspace, vision: state.vision };
    }
    renderPreviewOptions(result);
    if (!previewReady) $('#engine-status').innerHTML = '<span></span>Theme tools ready · preview unavailable';
  } catch (error) { if (ready && evaluation?.ok) runtimeFailure(error.message); else { $('#export-button').disabled = true; sourceErrors(error.message); } }
}
function definitions(result) { return result?.definitions || result?.theme_option_defs || result?.theme?.options || []; }
function effective(result) { return result?.effectiveValues || result?.effective_values || result?.theme_option_values || {}; }
function renderPreviewOptions(result) {
  const container = $('#preview-options'), active = document.activeElement;
  if (container.contains(active) && active?.matches('input[type=range]')) return;
  container.replaceChildren();
  const defs = definitions(result), values = effective(result);
  for (const def of defs) {
    const kind = typeof def.type === 'string' ? def.type : def.kind?.type;
    const label = def.resolvedLabel || (typeof def.label === 'string' ? def.label : def.label?.en || def.id);
    const help = def.resolvedHelp || (typeof def.help === 'string' ? def.help : def.help?.en);
    const value = store.get().preview[def.id] ?? values[def.id] ?? def.default;
    const parentActive = def.active !== false;
    let input;
    if (kind === 'bool') {
      input = el('input', { type: 'checkbox', checked: value === true, disabled: !parentActive || def.available === false });
      input.title = help || ''; input.addEventListener('change', () => store.setPreview(def.id, input.checked));
      const wrapper = el('div', { class: 'field' }, el('label', { class: 'switch-label' }, input, label));
      container.append(wrapper); continue;
    }
    if (kind === 'choice') {
      input = el('select', {}, ...(def.values || []).map(choice => el('option', { value: choice.id }, typeof choice.label === 'string' ? choice.label : choice.label?.en || choice.id)));
      input.value = value; input.addEventListener('change', () => store.setPreview(def.id, input.value));
      input.title = help || '';
      input.disabled = !parentActive || def.available === false;
      container.append(field(label, input, help)); continue;
    }
    if (kind === 'range') {
      input = el('input', { type: 'range', min: def.min ?? 0, max: def.max ?? 100, step: def.step ?? 1, value, disabled: !parentActive || def.available === false, 'aria-label': label });
      const output = el('output', {}, `${value}${def.unit || ''}`);
      input.title = help || ''; if (help) input.setAttribute('aria-description', help);
      input.addEventListener('input', () => { output.textContent = `${input.value}${def.unit || ''}`; store.setPreview(def.id, input.valueAsNumber); });
      container.append(el('div', { class: 'field' }, el('label', {}, label), el('div', { class: 'range-row' }, input, output))); continue;
    }
  }
  if (!defs.length) container.append(el('span', { class: 'quiet' }, 'This theme does not declare any options.'));
}

store.subscribe((state, reason) => {
  refreshChrome(state);
  if (reason === 'storage') return;
  if (reason === 'native') { if (evaluation) renderPreviewOptions(evaluation); return; }
  if (['replace', 'undo', 'redo'].includes(reason)) editor.show();
  clearTimeout(evaluationTimer); evaluationTimer = setTimeout(updatePreview, ['source', 'document', 'preview'].includes(reason) ? 70 : 0);
});
for (const tab of document.querySelectorAll('[data-section]')) {
  tab.id = `editor-tab-${tab.dataset.section}`; tab.setAttribute('aria-controls', 'editor'); tab.tabIndex = tab.getAttribute('aria-selected') === 'true' ? 0 : -1;
  tab.addEventListener('click', () => {
  document.querySelectorAll('[data-section]').forEach(button => { button.setAttribute('aria-selected', button === tab); button.tabIndex = button === tab ? 0 : -1; });
  $('#editor').setAttribute('aria-labelledby', tab.id);
  editor.show(tab.dataset.section);
  $('#editor').scrollTop = 0;
  if (matchMedia('(max-width:800px)').matches) {
    const heading = $('#editor .section-heading') || $('#editor');
    const offset = $('.preview-shell').getBoundingClientRect().height + $('.editor-navigation').getBoundingClientRect().height + 12;
    window.scrollTo({ top: Math.max(0, window.scrollY + heading.getBoundingClientRect().top - offset), behavior: 'instant' });
  }
  if (categoryScene[tab.dataset.section]) applyView({ focusScene: categoryScene[tab.dataset.section] }).catch(error => notify(error.message));
  $('#editor-title')?.focus({ preventScroll: true });
  });
}
for (const tab of document.querySelectorAll('[data-section]')) tab.addEventListener('keydown', event => {
  const tabs = [...document.querySelectorAll('[data-section]')], index = tabs.indexOf(tab);
  const next = event.key === 'ArrowRight' ? tabs[(index + 1) % tabs.length] : event.key === 'ArrowLeft' ? tabs[(index - 1 + tabs.length) % tabs.length] : event.key === 'Home' ? tabs[0] : event.key === 'End' ? tabs.at(-1) : null;
  if (next) { event.preventDefault(); next.click(); next.focus({ preventScroll: true }); }
});
$('#undo-button').addEventListener('click', () => store.undo()); $('#redo-button').addEventListener('click', () => store.redo());
document.addEventListener('keydown', event => {
  const key = event.key.toLowerCase();
  if (!(event.ctrlKey || event.metaKey) || !['z', 'y'].includes(key)) return;
  if (event.target.matches('input,textarea,canvas,[contenteditable]')) return;
  event.preventDefault(); if (event.shiftKey || key === 'y') store.redo(); else store.undo();
});
$('#workspace-select').addEventListener('change', () => store.setContext($('#workspace-select').value, $('#vision-select').value));
$('#vision-select').addEventListener('change', () => store.setContext($('#workspace-select').value, $('#vision-select').value));
$('#scene-select').addEventListener('change', () => applyView({ scene: $('#scene-select').value }).catch(error => notify(error.message)));
$('#language-select').addEventListener('change', async () => {
  const input = $('#language-select'), previous = previewLanguage, language = input.value;
  input.disabled = true;
  try {
    await applyView({ language }); previewLanguage = language;
    if (ready) {
      const result = await bridge.evaluate(store.get());
      if (result.ok && !errors(result)) { evaluation = result; editor.setRuntime(schema, result); renderPreviewOptions(result); }
    }
  } catch (error) { input.value = previous; notify(error.message); }
  finally { input.disabled = !previewReady; }
});
window.addEventListener('solidcraft-theme-studio-focus', event => { if (event.detail?.scene) applyView({ focusScene: event.detail.scene }).catch(error => notify(error.message)); });
$('#import-button').addEventListener('click', () => $('#import-file').click());
$('#import-file').addEventListener('change', async event => {
  const file = event.target.files?.[0]; event.target.value = '';
  if (!file) return;
  const maximum = schema?.limits?.maxBytes || 256 * 1024;
  if (file.size > maximum) { notify(`Choose a theme no larger than ${Math.round(maximum / 1024)} KiB, matching SolidCraft’s file limit.`); return; }
  try {
    const source = await file.text(); const parsed = JSON.parse(source);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('A theme must be a JSON object.');
    if (ready) { const result = await bridge.call('evaluate', source, '{}', 'MODEL', 'off'); if (result.ok === false || errors(result)) throw new Error(errors(result) || 'The theme is invalid.'); }
    store.replace(source); notify(`Imported ${parsed.name || file.name}.`);
  } catch (error) { notify(`Could not import: ${error.message}`); }
});
$('#export-button').addEventListener('click', async () => {
  try {
    const result = await bridge.exportTheme(store.get().text);
    if (result.ok === false || errors(result)) throw new Error(errors(result) || 'The theme could not be exported.');
    const definition = result.definition ?? result.theme ?? result;
    const content = typeof definition === 'string' ? definition : pretty(definition);
    const blob = new Blob([content], { type: 'application/json' }), url = URL.createObjectURL(blob), link = el('a', { href: url, download: `${(store.get().document.name || 'theme').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'theme'}.json` });
    document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    store.markExported(); notify('Your theme is ready for SolidCraft.');
  } catch (error) { notify(error.message); }
});
$('#reset-button').addEventListener('click', () => { if (!store.get().dirty || confirm('Start again with Onyx? Your current draft is available through Undo.')) { store.replace(starter); notify('Fresh Onyx, ready to explore.'); } });
$('#compare-button').addEventListener('click', async () => {
  store.pin();
  const snapshot = store.get().comparison;
  try {
    if (bridge.runtime()?.setComparison) {
      const result = await bridge.call('setComparison', snapshot?.text || '', JSON.stringify(snapshot?.preview || {}), snapshot?.workspace || 'MODEL', snapshot?.vision || 'off');
      if (result?.ok === false) throw new Error(errors(result));
    } else if (bridge.runtime()?.setView) await applyView({ comparison: snapshot ? { source: snapshot.text, values: snapshot.preview, tab: snapshot.workspace, vision: snapshot.vision } : null });
  } catch (error) { store.pin(); notify(error.message); }
});
$('#inspect-button').addEventListener('click', async () => {
  const pressed = $('#inspect-button').getAttribute('aria-pressed') !== 'true'; $('#inspect-button').setAttribute('aria-pressed', pressed);
  try {
    if (bridge.runtime()?.setInspect) await bridge.call('setInspect', pressed);
    else if (bridge.runtime()?.setView) await applyView({ inspect: pressed });
    $('#inspection-panel').hidden = !pressed;
    if (pressed) renderInspection(null);
  } catch (error) { $('#inspect-button').setAttribute('aria-pressed', !pressed); notify(error.message); }
});
$('#about-button').addEventListener('click', () => { $('#about-dialog').showModal(); renderDiagnostics(); });
window.addEventListener('solidcraft-theme-studio-ready', () => startRuntime(true));
function runtimeFailure(message) {
  previewReady = false; rendererPresented = false;
  $('#engine-status').classList.remove('ready');
  $('#engine-loading').hidden = false; $('#engine-loading').classList.add('has-error');
  $('#engine-loading h3').textContent = 'The preview needs another moment.';
  $('#engine-loading>p').textContent = 'The SolidCraft engine could not load. Your theme draft is still here.';
  $('#engine-loading-detail').replaceChildren(el('button', { type: 'button', class: 'button', onclick: () => location.reload() }, 'Try again'));
  $('#engine-loading .runtime-error-details')?.remove();
  const details = el('details', { class: 'runtime-error-details' }, el('summary', {}, 'Technical details'), el('p', {}, String(message || 'The runtime was unavailable.')));
  $('#engine-loading').append(details); $('#engine-status').innerHTML = '<span></span>Preview unavailable';
  $('#preview-live-status').textContent = bridge.runtime() ? 'Theme editing available · preview offline' : 'Preview engine unavailable';
  $('#inspect-button').disabled = true; $('#compare-button').disabled = true; $('#scene-select').disabled = true; $('#language-select').disabled = true;
  if (bridge.runtime() && !ready) startRuntime(false);
}
window.addEventListener('solidcraft-theme-studio-error', event => runtimeFailure(event.detail?.message));
window.addEventListener('solidcraft-theme-studio-inspect', event => { if ($('#inspect-button').getAttribute('aria-pressed') === 'true') renderInspection(event.detail); });
window.addEventListener('solidcraft-theme-studio-state', event => {
  rendererInfo = event.detail?.renderer || null; renderDiagnostics();
  const native = event.detail?.preview;
  if (native?.scene && [...$('#scene-select').options].some(option => option.value === native.scene)) $('#scene-select').value = native.scene;
  if (native?.language && [...$('#language-select').options].some(option => option.value === native.language)) { previewLanguage = native.language; $('#language-select').value = native.language; }
  if (native && expectedNativePreview && rendererPresented) {
    const changes = {};
    const nativeValues = native.effectiveValues || native.values || {};
    for (const [key, value] of Object.entries(nativeValues)) if (JSON.stringify(value) !== JSON.stringify(expectedNativePreview.values?.[key])) changes[key] = value;
    const contextChanged = (native.tab && native.tab !== expectedNativePreview.tab) || (native.vision && native.vision !== expectedNativePreview.vision);
    if (Object.keys(changes).length || contextChanged) {
      expectedNativePreview = { values: { ...expectedNativePreview.values, ...nativeValues }, tab: native.tab || expectedNativePreview.tab, vision: native.vision || expectedNativePreview.vision };
      store.adoptPreview(changes, native.tab, native.vision);
    }
  }
  const renderer = event.detail?.renderer?.current || event.detail?.renderer;
  if (!renderer || !previewReady) return;
  if (renderer.counters && !renderer.pending) {
    rendererPresented = true; $('#engine-loading').hidden = true; $('#engine-loading').classList.remove('has-error');
    $('#engine-status').classList.add('ready');
    $('#engine-status').innerHTML = renderer.error ? '<span></span>Live UI · blur unavailable' : '<span></span>Real SolidCraft components';
    $('#engine-status').title = renderer.error || 'Rendered with SolidCraft’s actual UI and compositor.';
    $('#preview-live-status').innerHTML = '<span class="live-dot"></span>Live preview · hover, focus and click to explore';
  } else if (renderer.error && !renderer.pending && !rendererPresented) runtimeFailure(renderer.error);
  renderDiagnostics();
});
async function startRuntime(withPreview = true) {
  if (withPreview) previewReady = true;
  if (ready) { await updatePreview(); return; }
  try {
    schema = await bridge.contract(); ready = true;
    $('#runtime-version').textContent = `Theme level ${schema.supportsLevel || schema.requires || 2} · SolidCraft ${schema.sourceCommit || schema.version || 'source-pinned runtime'}`;
    const tabs = schema.tabsAllowed || schema.tabs || schema.tabNames || [];
    if (Array.isArray(tabs) && tabs.length) {
      $('#workspace-select').replaceChildren(...tabs.map(tab => el('option', { value: typeof tab === 'string' ? tab : tab.name }, typeof tab === 'string' ? tab : tab.name)));
      $('#workspace-select').value = store.get().workspace;
    }
    const engine = bridge.runtime();
    $('#inspect-button').disabled = !previewReady || (typeof engine.setInspect !== 'function' && !(typeof engine.setView === 'function' && (schema.capabilities?.inspect || schema.capabilities?.inspection)));
    $('#compare-button').disabled = !previewReady || (typeof engine.setComparison !== 'function' && !(typeof engine.setView === 'function' && schema.capabilities?.comparison));
    $('#scene-select').disabled = !previewReady || typeof engine.setView !== 'function';
    if (Array.isArray(schema.languages) && schema.languages.length && typeof engine.setView === 'function') {
      $('#language-context').hidden = false;
      $('#language-select').replaceChildren(...schema.languages.map(language => {
        const id = typeof language === 'string' ? language : language.id, label = typeof language === 'string' ? language : language.label;
        const option = el('option', { value: id }, label || id);
        const unavailable = schema.scriptFonts?.find(font => font.language === id && font.url === null);
        if (unavailable) { option.disabled = true; option.title = unavailable.reason || 'This script is not included in the native web font pack.'; }
        return option;
      }));
      previewLanguage = schema.defaultLanguage || 'en-GB'; $('#language-select').value = previewLanguage; $('#language-select').disabled = !previewReady;
    }
    const hasApp = Array.isArray(schema.scenes) && schema.scenes.includes('app');
    document.querySelector('[data-scene=app]').hidden = !hasApp;
    if (previewReady && typeof engine.setView === 'function' && matchMedia('(max-width:800px)').matches) { $('#scene-select').value = 'controls'; await bridge.call('setView', JSON.stringify({ scene: 'controls' })); }
    else if (previewReady && hasApp && typeof engine.setView === 'function') { $('#scene-select').value = 'app'; await bridge.call('setView', JSON.stringify({ scene: 'app' })); }
    editor.setRuntime(schema, evaluation); editor.show();
    if (previewReady && store.get().lastValidText !== store.get().text) {
      const restored = await bridge.preview({ ...store.get(), text: store.get().lastValidText });
      if (restored?.ok === false) runtimeFailure(errors(restored));
    }
    await updatePreview();
  } catch (error) { $('#engine-loading-detail').textContent = error.message; }
}
refreshChrome(store.get()); editor.show();
if (bridge.runtime()) startRuntime(false);
else import(new URL('../runtime/loader.js', import.meta.url)).catch(error => runtimeFailure(error.message));
