import { el, field, heading, button } from './dom.js';
import { at, put, pretty, clone } from './state.js';
import { friendly, paletteEditor, optionsEditor } from './authoring.js';
import { elementEditor, workspaceEditor, locate } from './elements.js';

export class Editor {
  constructor(container, store, notify) { this.root = container; this.store = store; this.notify = notify; this.section = 'overview'; this.contract = {}; this.result = null; }
  setRuntime(contract, result) { this.contract = contract || {}; this.result = result; }
  show(section = this.section) {
    this.section = section;
    const state = this.store.get();
    this.root.replaceChildren();
    if (state.parseError && section !== 'source') {
      this.root.append(heading('A LITTLE REPAIR FIRST', 'Your draft needs a look.', 'There is a JSON syntax error. Your last valid preview is safe.'), el('div', { class: 'error-list' }, state.parseError), button('Open source', () => this.select('source'))); return;
    }
    ({ overview: () => this.overview(), interface: () => elementEditor(this, 'interface'), viewport: () => elementEditor(this, 'viewport'), text: () => elementEditor(this, 'text'), workspaces: () => workspaceEditor(this), palette: () => paletteEditor(this), options: () => this.options(), source: () => this.source() }[section] || (() => this.overview()))();
  }
  select(section) { document.querySelector(`[data-section="${section}"]`)?.click(); }
  roleTarget(key) {
    const found = locate(this, key);
    if (found) return found;
    return this.keys('color').includes(key) ? { section: 'palette', token: key } : null;
  }
  navigateRole(key) {
    const target = this.roleTarget(key); if (!target) return;
    this.select(target.section);
    if (target.group) {
      this.root._reveal?.(target.group);
      const group = this.root.querySelector(`[data-group="${CSS.escape(target.group)}"]`);
      if (group) { group.hidden = false; group.open = true; group._build?.(); }
    }
    if (target.section === 'palette') {
      const search = this.root.querySelector('.token-search');
      if (search) { search.value = target.token; search.dispatchEvent(new Event('input', { bubbles: true })); }
    }
    const card = target.token ? this.root.querySelector(`[data-token="${CSS.escape(target.token)}"]`) : this.root.querySelector(`[data-property="${CSS.escape(target.property)}"]`);
    if (!card) return;
    if (card.tagName === 'DETAILS') card.open = true;
    for (let parent = card.parentElement; parent && parent !== this.root; parent = parent.parentElement) if (parent.tagName === 'DETAILS') parent.open = true;
    const narrow = matchMedia('(max-width:800px)').matches;
    card.style.scrollMarginTop = `${narrow ? (document.querySelector('.preview-shell')?.getBoundingClientRect().height || 0) + (document.querySelector('.editor-navigation')?.getBoundingClientRect().height || 0) + 12 : 18}px`;
    card.scrollIntoView({ block: narrow ? 'start' : 'center', behavior: matchMedia('(prefers-reduced-motion:reduce)').matches ? 'instant' : 'smooth' });
    card.classList.add('inspected-field'); setTimeout(() => card.classList.remove('inspected-field'), 1800);
    card.querySelector('input,select,button:not(:disabled)')?.focus({ preventScroll: true });
  }
  update(path, value, coalesce = false) { this.store.change(doc => put(doc, path, value), coalesce ? path.join('.') : undefined); }
  text(path, options = {}) {
    const input = el('input', { type: 'text', value: at(this.store.get().document, path) ?? '', ...options });
    input.addEventListener('input', () => this.update(path, input.value, true));
    input.addEventListener('blur', () => this.store.endTransaction()); return input;
  }
  number(path, options = {}) {
    const input = el('input', { type: 'number', value: at(this.store.get().document, path) ?? '', ...options });
    input.addEventListener('input', () => {
      if (input.value === '') this.update(path, undefined, true);
      else if (Number.isFinite(input.valueAsNumber)) this.update(path, input.valueAsNumber, true);
    });
    input.addEventListener('blur', () => this.store.endTransaction()); return input;
  }
  overview() {
    const doc = this.store.get().document;
    this.root.append(heading('MAKE IT YOURS', 'A good place to start.', 'Give your theme a name. The little previews stay beside you as you make it your own.'));
    this.root.append(field('Theme name', this.text(['name'], { maxlength: 80, placeholder: 'Something with character' })));
    const base = el('select', {}, ...['dark', 'light'].map(value => el('option', { value }, value === 'dark' ? 'Dark foundation' : 'Light foundation'))); base.value = doc.base || 'dark';
    base.addEventListener('change', () => this.update(['base'], base.value));
    this.root.append(field('Foundation', base, 'Unspecified colours inherit from this SolidCraft palette.'));
    const colors = doc.colors || {};
    this.root.append(el('div', { class: 'swatch-strip', 'aria-label': 'Theme colour sample' }, ...['panel', 'viewport_top', 'accent', 'sheet_ink', 'error', 'text'].map(key => { const swatch = el('i', { title: key }); if (typeof colors[key] === 'string') swatch.style.backgroundColor = colors[key]; return swatch; })));
    this.root.append(el('div', { class: 'note-card' }, el('h3', {}, 'Play with it. Keep the good bits.'), el('p', {}, 'Use “Try this theme” above the previews to explore the options. Those values do not change the defaults in your exported file.')));
    this.root.append(field('Provenance', this.text(['provenance']), 'Credit the palette’s author or describe its origin.'));
    this.root.append(el('div', { class: 'inline-row' }, field('Picker order', this.number(['order'], { step: 1 })), field('Required theme level', this.number(['requires'], { min: 0, step: 1 }))));
    this.root.append(el('p', { class: 'field-help' }, 'Level 2 enables continuous surface brightness. Keep unknown metadata in Source; imports and exports preserve your authored document.'));
    this.root.append(el('hr', { class: 'section-rule' }), el('h3', { class: 'small-heading' }, 'Choose your next brush'), el('div', { class: 'button-row' }, button('Style the interface', () => this.select('interface')), button('Build options', () => this.select('options')), button('See the source', () => this.select('source'))));
    this.root.append(el('h3', { class: 'small-heading' }, 'Or start from a clean foundation'), el('div', { class: 'button-row' }, ...['dark', 'light'].map(base => button(`New ${base} theme`, () => { if (this.store.get().dirty && !confirm('Start a new theme? The current document stays available through Undo.')) return; this.store.replace({ format: this.contract.format || 'solidcraft-theme/1', name: 'Untitled theme', base }, false); }))));
  }
  keys(kind, authored = {}) {
    const declared = this.contract[`${kind}Keys`] || this.contract.keys?.[kind] || [];
    return [...new Set([...Object.keys(authored), ...declared.map(item => typeof item === 'string' ? item : item.key || item.name)].filter(Boolean))].sort();
  }
  token(path, label, fallback, options = {}) {
    const authored = at(this.store.get().document, path), value = authored ?? fallback ?? '#808080';
    const card = el('div', { class: 'token-card', 'data-token': label });
    const inherit = button(authored === undefined ? 'Inherited' : options.resetLabel || 'Use inherited', () => { this.update(path, undefined); this.show(); }, `inherit-button${authored === undefined ? ' active' : ''}`);
    inherit.disabled = authored === undefined;
    card.append(el('div', { class: 'token-topline' }, el('div', {}, el('span', { class: 'token-friendly-name' }, friendly(label)), el('span', { class: 'token-name' }, label)), options.inheritable === false ? null : inherit));
    const values = Array.isArray(value) ? value : [value];
    values.forEach((color, index) => {
      const subpath = Array.isArray(value) ? [...path, index] : path;
      const text = el('input', { type: 'text', value: typeof color === 'string' ? color : pretty(color).trim(), 'aria-label': `${label}${values.length > 1 ? ` colour ${index + 1}` : ''}`, spellcheck: 'false' });
      const rgb = typeof color === 'string' && /^#[\da-f]{6,8}$/i.test(color) ? color.slice(0, 7) : '#808080';
      const picker = el('input', { type: 'color', value: rgb, 'aria-label': `Pick ${label}${values.length > 1 ? ` colour ${index + 1}` : ''}` });
      const update = newColor => {
        if (Array.isArray(value)) {
          const next = clone(at(this.store.get().document, path) ?? value); next[index] = newColor; this.update(path, next, true);
        } else this.update(subpath, newColor, true);
        inherit.disabled = false; inherit.textContent = options.resetLabel || 'Use inherited'; inherit.classList.remove('active');
      };
      text.addEventListener('input', () => { update(text.value); if (/^#[\da-f]{6,8}$/i.test(text.value)) picker.value = text.value.slice(0, 7); });
      const alphaAllowed = !path.includes('icon_palette');
      picker.addEventListener('input', () => { const alpha = alphaAllowed && /^#[\da-f]{8}$/i.test(text.value) ? text.value.slice(7) : ''; text.value = picker.value + alpha; update(text.value); });
      for (const input of [text, picker]) input.addEventListener('blur', () => this.store.endTransaction());
      card.append(el('div', { class: 'token-input-row' }, picker, text));
      if (alphaAllowed) {
        const alphaValue = /^#[\da-f]{8}$/i.test(String(color)) ? parseInt(String(color).slice(7), 16) : 255;
        const alpha = el('input', { type: 'range', min: 0, max: 255, step: 1, value: alphaValue, 'aria-label': `${label}${values.length > 1 ? ` colour ${index + 1}` : ''} alpha` });
        const readout = el('output', {}, `${Math.round(alphaValue / 255 * 100)}%`);
        alpha.addEventListener('input', () => { const base = /^#[\da-f]{6,8}$/i.test(text.value) ? text.value.slice(0, 7) : picker.value; text.value = `${base}${alpha.valueAsNumber === 255 ? '' : alpha.valueAsNumber.toString(16).padStart(2, '0')}`; readout.textContent = `${Math.round(alpha.valueAsNumber / 255 * 100)}%`; update(text.value); });
        alpha.addEventListener('change', () => this.store.endTransaction());
        text.addEventListener('input', () => { if (/^#[\da-f]{6,8}$/i.test(text.value)) { alpha.value = text.value.length === 9 ? parseInt(text.value.slice(7), 16) : 255; readout.textContent = `${Math.round(alpha.valueAsNumber / 255 * 100)}%`; } });
        card.append(el('div', { class: 'alpha-row' }, el('span', {}, 'Alpha'), alpha, readout));
      }
    });
    return card;
  }
  options() { optionsEditor(this); }
  source() {
    this.root.append(heading('NOTHING HIDDEN', 'Your theme, in full.', 'The complete authored definition. Valid edits update the preview; an unfinished draft keeps the last good appearance.'));
    const input = el('textarea', { class: 'source-editor', spellcheck: 'false', 'aria-label': 'Theme JSON source', value: this.store.get().text });
    input.addEventListener('input', () => this.store.source(input.value)); input.addEventListener('blur', () => this.store.endTransaction());
    this.root.append(input, el('div', { id: 'source-errors', class: 'error-list', hidden: true }), el('div', { class: 'button-row' }, button('Format JSON', () => { if (this.store.get().parseError) { this.notify('Finish the JSON syntax before formatting.'); return; } this.store.endTransaction(); this.store.source(pretty(this.store.get().document)); this.store.endTransaction(); this.show(); })));
  }
}
