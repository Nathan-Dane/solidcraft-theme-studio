// Window chrome only: dock width, expanded preview, scene tabs and the options popover.
// Theme and renderer logic stays in app.js; this module never touches the canvas.
const $ = selector => document.querySelector(selector);
const workspace = $('#workspace');
const storage = {
  get(key) { try { return localStorage.getItem(key); } catch { return null; } },
  set(key, value) { try { localStorage.setItem(key, value); } catch { /* recovery storage is optional */ } }
};

// Dock: normal (editor beside preview), wide (two-column editing) or rail (categories only).
let dock = ['normal', 'wide', 'rail'].includes(storage.get('studio.dock')) ? storage.get('studio.dock') : 'normal';
let focus = false;
function applyDock() {
  workspace.dataset.dock = dock;
  workspace.classList.toggle('stage-focus', focus);
  $('#dock-widen').setAttribute('aria-pressed', dock === 'wide');
  const widen = dock === 'wide' ? 'Narrow editor' : 'Widen editor';
  $('#dock-widen').setAttribute('aria-label', widen); $('#dock-widen').title = widen;
  $('#stage-focus').setAttribute('aria-pressed', focus);
  const expand = focus ? 'Show editor' : 'Expand preview (hide editor)';
  $('#stage-focus').setAttribute('aria-label', expand); $('#stage-focus').title = expand;
  storage.set('studio.dock', dock);
}
$('#dock-widen').addEventListener('click', () => { dock = dock === 'wide' ? 'normal' : 'wide'; applyDock(); });
$('#dock-collapse').addEventListener('click', () => { dock = dock === 'rail' ? 'normal' : 'rail'; applyDock(); });
$('#stage-focus').addEventListener('click', () => { focus = !focus; applyDock(); });
// Choosing a category from the rail always reopens a collapsed editor.
for (const tab of document.querySelectorAll('[data-section]')) tab.addEventListener('click', () => {
  if (dock === 'rail' || focus) { dock = dock === 'rail' ? 'normal' : dock; focus = false; applyDock(); }
  $('#dock-title').textContent = tab.querySelector('span').textContent;
});
applyDock();

// Scene tabs mirror the hidden #scene-select, which app.js owns and keeps in step with the renderer.
const select = $('#scene-select');
const tabs = [...document.querySelectorAll('[data-scene]')];
function syncScenes() {
  $('.stage-wrap').dataset.activeScene = select.value;
  for (const tab of tabs) {
    tab.setAttribute('aria-pressed', tab.dataset.scene === select.value);
    tab.disabled = select.disabled;
  }
}
for (const tab of tabs) tab.addEventListener('click', () => {
  if (select.disabled) return;
  select.value = tab.dataset.scene; select.dispatchEvent(new Event('change'));
  syncScenes();
});
new MutationObserver(syncScenes).observe(select, { attributes: true, attributeFilter: ['disabled'] });
// app.js updates the select inside its own state listener; read it after that has run.
window.addEventListener('solidcraft-theme-studio-state', () => setTimeout(syncScenes));
document.addEventListener('keydown', event => {
  if (event.target.matches('input,textarea,select,[contenteditable]') || event.ctrlKey || event.metaKey || event.altKey) return;
  const index = Number(event.key);
  if (event.target.matches('canvas') || !Number.isInteger(index) || index < 0 || index >= tabs.length || select.disabled) return;
  tabs[index].click();
});
syncScenes();

// "Try this theme" is a popover over the stage so it never resizes the canvas.
const options = $('.try-options');
document.addEventListener('pointerdown', event => { if (options.open && !options.contains(event.target)) options.open = false; });
document.addEventListener('keydown', event => {
  if (event.key !== 'Escape' || !options.open) return;
  options.open = false; options.querySelector('summary').focus();
});
