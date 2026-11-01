import { el, field, heading, button } from './dom.js';
import { at, clone, put } from './state.js';

export const friendly = key => {
  const words = key.replace(/^icons\./, 'viewport glyph ').replace(/_/g, ' ').replace(/\bfg\b/g, 'foreground').replace(/\bbg\b/g, 'background').replace(/\bink\b/g, 'foreground').replace(/^sheet /, 'sheet metal ');
  return words.charAt(0).toUpperCase() + words.slice(1);
};
export function select(values, current, change, label) {
  const input = el('select', { 'aria-label': label }, ...values.map(value => el('option', { value: typeof value === 'string' ? value : value.value }, typeof value === 'string' ? friendly(value) : value.label)));
  input.value = current ?? '';
  input.addEventListener('change', () => change(input.value)); return input;
}
function mutate(editor, action, redraw = false) { editor.store.change(action); if (redraw) editor.show(); }
const defaults = editor => editor.contract.baseDefaults?.[editor.store.get().document.base || 'dark'] || {};
function addControl(label, values, action) {
  const input = select([{ value: '', label }, ...values.map(value => typeof value === 'string' ? { value, label: friendly(value) } : value)], '', value => { if (value) action(value); }, label);
  return el('div', { class: 'add-control' }, input);
}
function boolField(label, value, action, help) {
  const input = el('input', { type: 'checkbox', checked: value === true }); input.addEventListener('change', () => action(input.checked));
  return el('div', { class: 'field' }, el('label', { class: 'switch-label' }, input, label), help ? el('p', { class: 'field-help' }, help) : null);
}

const PALETTE_GROUPS = [
  ['surfaces', 'Surfaces', 'The material behind the content.'],
  ['text', 'Text & labels', 'Primary, secondary and on-colour foregrounds.'],
  ['interaction', 'Interaction', 'Selection, focus and hover affordances.'],
  ['viewport', 'Viewport & geometry', 'Grid, axes, bodies, sketches and dimensions.'],
  ['workspace', 'Workspace accents', 'Distinct meanings across modelling workspaces.'],
  ['status', 'Status & feedback', 'Warnings, errors, recovery and agent states.'],
  ['details', 'Lines & details', 'Borders, separators and remaining small details.']
];
function paletteGroup(key) {
  if (/^(error|warning|agent_|file_recovery(?!_well)|status|success|danger)/.test(key)) return 'status';
  if (/^(surface_|mesh_|sheet_|render_|form_(accent|fill|soft|tab_ink)|sketch_accent)/.test(key)) return 'workspace';
  if (/^(accent|selected|sel_|hover|rubber_band|box_|chip)|hover|press|focus/.test(key)) return 'interaction';
  if (/^(viewport|grid|body|axis|cube|sketch|construction|dimension|glyph|origin|joint|bend|manipulator|continuity|preview_|icons\.)/.test(key)) return 'viewport';
  if (/text|ink|label|dim/.test(key)) return 'text';
  if (/^(panel|toolbar|timeline|dialog_(bg|body|footer)|overlay|field|control_fill|app_bar(?!.*separator)|file_(background|surface|recovery_well)|nav_(viewport|field|tip$))/.test(key)) return 'surfaces';
  return 'details';
}
export function paletteEditor(editor) {
  editor.root.append(heading('COLOUR, WITH CONTEXT', 'Find your balance.', 'Browse by purpose, then judge the real components beside you. A colour can always go back to its inherited value.'));
  const search = el('input', { type: 'search', placeholder: 'Find panel, axis, text…', class: 'token-search input', 'aria-label': 'Find a colour role' });
  const facets = el('div', { class: 'palette-facets', 'aria-label': 'Colour role groups' }), list = el('div');
  let facet = 'all';
  const authored = editor.store.get().document.colors || {};
  const keys = editor.keys('color', authored);
  const draw = () => {
    list.replaceChildren(); facets.replaceChildren();
    for (const [id, name] of [['all', 'All roles'], ...PALETTE_GROUPS]) {
      const control = button(name, () => { facet = id; draw(); const scene = { surfaces: 'glass', text: 'controls', interaction: 'browser', viewport: 'viewport', workspace: 'tools', status: 'browser', details: 'glass' }[id]; if (scene) window.dispatchEvent(new CustomEvent('solidcraft-theme-studio-focus', { detail: { scene } })); }, `facet${facet === id ? ' selected' : ''}`); control.setAttribute('aria-pressed', facet === id); facets.append(control);
    }
    const query = search.value.trim().toLowerCase(); let count = 0;
    for (const [id, name, description] of PALETTE_GROUPS) {
      if (facet !== 'all' && facet !== id) continue;
      const matches = keys.filter(key => paletteGroup(key) === id && `${key} ${friendly(key)}`.toLowerCase().includes(query));
      if (!matches.length) continue; count += matches.length;
      const details = el('details', { class: 'palette-group', open: !!query || facet !== 'all' || id === 'surfaces' }, el('summary', {}, el('span', {}, name), el('span', { class: 'category-count' }, `${matches.length}`)));
      const body = el('div', { class: 'palette-group-body' });
      let populated = false;
      const populate = () => {
        if (!details.open || populated) return; populated = true;
        body.append(el('p', { class: 'field-help group-description' }, description));
        for (const key of matches) {
          const fallback = editor.result?.resolved?.colors?.[key] ?? defaults(editor).colors?.[key];
          body.append(editor.token(['colors', key], key, fallback));
        }
      };
      details.append(body); details.addEventListener('toggle', populate); populate(); list.append(details);
    }
    if (!count) list.append(el('p', { class: 'empty-state' }, 'No matching roles. Try a different word or another group.'));
  };
  search.addEventListener('input', draw); editor.root.append(search, facets, list); draw();
}

function borderDefault(editor, role) {
  const existing = editor.result?.resolved?.borders?.[role] ?? defaults(editor).borders?.[role];
  if (existing) return clone(existing);
  const color = defaults(editor).colors?.border || '#666666';
  if (role === 'bevel') return { width: 0.5, highlight: '#ffffff20', light: '#ffffff10', shadow: '#00000020', dark_shadow: '#00000030' };
  if (role === 'primary_inset') return { width: 0.5, gap: 1, color };
  return { width: 1, color, ...(role === 'secondary' ? { pattern: 'solid' } : {}) };
}
export function borderFields(editor, path, role) {
  const schema = editor.contract.borderSchema || {}, value = at(editor.store.get().document, path);
  const wrap = el('div');
  if (!value || typeof value !== 'object' || Array.isArray(value)) { wrap.append(el('p', { class: 'field-help' }, 'The authored value has an unsupported shape. Repair it in Source.')); return wrap; }
  wrap.append(field('Width · pt', editor.number([...path, 'width'], { min: role === 'bevel' ? 0.1 : 0, max: role === 'bevel' ? schema.bevel?.width?.max ?? 2 : schema.stroke?.width?.max ?? 4, step: 0.1 }), role === 'bevel' ? 'A positive bevel width; light and shadow follow the actual surface direction.' : 'Zero disables this stroke.'));
  if (role === 'primary_inset') wrap.append(field('Inset gap · pt', editor.number([...path, 'gap'], { min: 0, max: schema.insetGap?.max ?? 12, step: 0.1 })));
  if (role === 'secondary') wrap.append(field('Pattern', select(schema.secondaryPatterns || ['solid', 'dotted'], value.pattern || 'solid', next => editor.update([...path, 'pattern'], next), 'Secondary border pattern')));
  for (const key of role === 'bevel' ? schema.bevel?.colors || ['highlight', 'light', 'shadow', 'dark_shadow'] : ['color']) wrap.append(editor.token([...path, key], friendly(key), value[key], { inheritable: false }));
  return wrap;
}
export function surfaceEditor(editor) {
  editor.root.append(heading('QUIET EDGES', 'Shape & edges.', 'A little rounding. A fine line. Change the material details using the same roles as the app.'));
  const radii = editor.contract.radiusKeys || [], doc = editor.store.get().document;
  editor.root.append(el('h3', { class: 'small-heading' }, 'Corner radii'));
  const radiiCard = el('div', { class: 'group-card radii-card' });
  editor.root.append(radiiCard);
  for (const spec of radii) {
    const key = typeof spec === 'string' ? spec : spec.key, authored = doc.radii?.[key], fallback = editor.result?.resolved?.radii?.[key] ?? defaults(editor).radii?.[key] ?? 0;
    const input = el('input', { type: 'range', min: spec.min ?? 0, max: spec.max ?? 32, step: 1, value: authored ?? fallback, 'aria-label': friendly(key) });
    const output = el('output', {}, `${authored ?? fallback} pt`);
    const inherit = button('↺', () => { editor.update(['radii', key], undefined); editor.show(); }, 'reset-chip'); inherit.disabled = authored === undefined;
    inherit.setAttribute('aria-label', `Use inherited ${friendly(key)}`); inherit.title = authored === undefined ? 'Inherited' : 'Use inherited value';
    input.addEventListener('input', () => { output.textContent = `${input.value} pt`; inherit.disabled = false; inherit.title = 'Use inherited value'; editor.update(['radii', key], input.valueAsNumber, true); }); input.addEventListener('change', () => editor.store.endTransaction());
    radiiCard.append(el('div', { class: 'radius-control', 'data-property': `radii.${key}` }, el('span', { class: 'field-label' }, friendly(key)), input, output, inherit));
  }
  editor.root.append(el('h3', { class: 'small-heading' }, 'Border treatments'), el('p', { class: 'field-help' }, 'Inherited borders retain each host’s native styling. Explicit borders can coexist: an inset line does not replace the outer stroke.'));
  const borderGrid = el('div', { class: 'card-grid' });
  editor.root.append(borderGrid);
  for (const role of editor.contract.borderSchema?.roles || ['primary', 'secondary', 'tertiary', 'container', 'control', 'primary_inset', 'bevel']) {
    const value = doc.borders?.[role], details = el('details', { class: 'disclosure-card', 'data-property': `borders.${role}` }, el('summary', {}, friendly(role), el('span', { class: 'pill' }, value === undefined ? 'Inherited' : 'Authored')));
    if (value === undefined) details.append(button('Author this border', () => { editor.update(['borders', role], borderDefault(editor, role)); editor.show(); }));
    else details.append(borderFields(editor, ['borders', role], role), button('Use inherited border', () => { editor.update(['borders', role], undefined); editor.show(); }, 'text-button'));
    borderGrid.append(details);
  }
}
export function iconEditor(editor) {
  editor.root.append(heading('SMALL, BUT IMPORTANT', 'Icon colours.', 'Original SolidCraft artwork, recoloured by meaning. Masks and transparent gaps remain untouched.'));
  const palette = editor.store.get().document.icon_palette || {}, native = editor.contract.iconDefaults?.[editor.store.get().document.base] || {};
  for (const [kind, title, keys] of [['roles', 'Drawing roles', editor.contract.iconRoleKeys || []], ['ramps', 'Semantic ramps', editor.contract.iconAccentKeys || []]]) {
    editor.root.append(el('h3', { class: 'group-heading' }, title));
    const grid = el('div', { class: 'card-grid' }); editor.root.append(grid);
    const all = [...new Set([...keys, ...Object.keys(palette).filter(key => kind === 'ramps' ? Array.isArray(palette[key]) : !Array.isArray(palette[key]))])];
    for (const key of all) {
      const authored = palette[key];
      const details = el('details', { class: 'disclosure-card', open: authored !== undefined, 'data-property': `icon_palette.${key}` }, el('summary', {}, friendly(key), el('span', { class: 'pill' }, authored === undefined ? 'Inherited' : 'Authored')));
      if (authored === undefined) {
        const add = button('Author this colour', () => { editor.update(['icon_palette', key], clone(native[key])); editor.show(); }); add.disabled = native[key] === undefined;
        details.append(el('p', { class: 'field-help' }, kind === 'ramps' ? 'Keeps the compiled ramp for this semantic meaning. A custom Solid ramp does not replace omitted workspace ramps.' : 'Keeps the native light/dark role colour.'), add);
      }
      else details.append(editor.token(['icon_palette', key], key, authored));
      grid.append(details);
    }
  }
  editor.root.append(el('p', { class: 'field-help' }, 'Icon colours are opaque RGB. Colour-vision variants take priority in the real preview. GAP is a transparent eraser and cannot be authored as a colour.'));
}
export function workspaceEditor(editor) {
  editor.root.append(heading('A CHANGE OF SCENERY', 'Workspace colours.', 'Three carefully chosen surfaces per workspace. Preview transitions by enabling Tab colours above the canvas.'));
  const authored = editor.store.get().document.tabs || {}, tabs = editor.contract.tabsAllowed || [], keys = editor.contract.tabSurfaceKeys || ['panel', 'viewport_top', 'viewport_bottom'];
  const grid = el('div', { class: 'card-grid' }); editor.root.append(grid);
  for (const tab of [...new Set([...Object.keys(authored), ...tabs])]) {
    const values = authored[tab], details = el('details', { class: 'disclosure-card' }, el('summary', {}, tab, el('span', { class: 'pill' }, values ? `${Object.keys(values).length} surfaces` : 'Inherited')));
    details.append(button('View this workspace', () => editor.store.setContext(tab, editor.store.get().vision), 'button small'));
    for (const key of keys) details.append(editor.token(['tabs', tab, key], key, defaults(editor).colors?.[key]));
    if (values) details.append(button('Use inherited workspace colours', () => { editor.update(['tabs', tab], undefined); editor.show(); }, 'text-button'));
    grid.append(details);
  }
}

function uniqueId(items, prefix) { let name = prefix, n = 2; while (items.some(item => item.id === name)) name = `${prefix}_${n++}`; return name; }
function parentOf(editor, definition) {
  const standard = (editor.contract.standardOptions || []).find(item => item.id === definition.id);
  return standard ? standard.parent : definition.parent;
}
function localized(editor, path, title, maximum = 40) {
  const map = at(editor.store.get().document, path) || {}, details = el('details', { class: 'localization-editor' }, el('summary', {}, title, el('span', { class: 'category-count' }, `${Object.keys(map).length} languages`)));
  for (const language of Object.keys(map)) {
    const input = editor.text([...path, language], { maxlength: maximum, 'aria-label': `${title} · ${language}` });
    details.append(el('div', { class: 'localization-row' }, el('span', { class: 'code-label' }, language), input, button('×', () => { editor.update([...path, language], undefined); editor.show(); }, 'icon-button remove-small')));
  }
  const language = el('input', { type: 'text', placeholder: 'de, ja, ko, zh…', maxlength: 32, 'aria-label': `Language code for ${title}` });
  const add = button('Add', () => {
    const code = language.value.trim();
    if (!/^[a-zA-Z0-9_-]{1,32}$/.test(code)) { editor.notify('Use a language code such as en, de or zh-TW.'); return; }
    if (Object.hasOwn(map, code)) { editor.notify('That language is already here.'); return; }
    editor.update([...path, code], map.en || ''); editor.show();
  }); add.disabled = Object.keys(map).length >= (editor.contract.limits?.maxLanguages || 64);
  details.append(el('div', { class: 'inline-row locale-add' }, language, add));
  return details;
}
function deleteOption(editor, index) {
  const options = editor.store.get().document.options || [], option = options[index], removed = new Set([option.id]);
  for (let i = 0; i < options.length; i++) for (const child of options) if (removed.has(parentOf(editor, child))) removed.add(child.id);
  const rules = (editor.store.get().document.overlays || []).filter(rule => removed.has(rule.when?.opt)).length;
  if (removed.size > 1 || rules) if (!confirm(`Remove ${option.id}, ${removed.size - 1} dependent option(s) and ${rules} rule(s)? This can be undone.`)) return;
  mutate(editor, doc => { doc.options = doc.options.filter(item => !removed.has(item.id)); if (doc.overlays) doc.overlays = doc.overlays.filter(item => !removed.has(item.when?.opt)); }, true);
}
function optionCard(editor, option, index) {
  const path = ['options', index], defs = editor.store.get().document.options || [], normalized = editor.result?.definitions?.find(item => item.id === option.id) || option;
  const standard = (editor.contract.standardOptions || []).some(item => item.id === option.id);
  const details = el('details', { class: 'disclosure-card option-card', 'data-option-id': option.id }, el('summary', {}, el('span', {}, option.label?.en || normalized.resolvedLabel || friendly(option.id)), el('span', { class: 'pill' }, standard ? 'Standard' : option.type)));
  const standardIds = new Set((editor.contract.standardOptions || []).map(item => item.id));
  const customIndices = defs.map((item, i) => standardIds.has(item.id) ? -1 : i).filter(i => i >= 0), customIndex = customIndices.indexOf(index);
  const up = button('↑', () => { const previous = customIndices[customIndex - 1]; if (previous !== undefined) mutate(editor, doc => { [doc.options[previous], doc.options[index]] = [doc.options[index], doc.options[previous]]; }, true); });
  const down = button('↓', () => { const next = customIndices[customIndex + 1]; if (next !== undefined) mutate(editor, doc => { [doc.options[next], doc.options[index]] = [doc.options[index], doc.options[next]]; }, true); });
  up.disabled = standard || customIndex <= 0; down.disabled = standard || customIndex < 0 || customIndex >= customIndices.length - 1;
  up.setAttribute('aria-label', `Move ${option.id} earlier`); down.setAttribute('aria-label', `Move ${option.id} later`);
  const indexActions = el('div', { class: 'row-between option-order' }, el('span', { class: 'code-label' }, option.id), el('div', { class: 'button-row' }, up, down, button('Remove', () => deleteOption(editor, index), 'button small danger-text')));
  details.append(indexActions);
  if (standard) details.append(el('p', { class: 'field-help' }, 'SolidCraft owns this option’s label, units, step and order. Author its default or a narrower range within the supported limits.'));
  else {
    const id = el('input', { type: 'text', value: option.id, maxlength: 32, spellcheck: 'false' });
    id.addEventListener('change', () => {
      const name = id.value.trim();
      if (!/^[a-z][a-z0-9_]{0,31}$/.test(name) || standardIds.has(name) || defs.some((item, i) => i !== index && item.id === name)) { id.value = option.id; editor.notify('Choose a unique custom id using lowercase letters, numbers and underscores. Standard ids belong to the app.'); return; }
      mutate(editor, doc => { doc.options[index].id = name; for (const item of doc.options) if (item.parent === option.id) item.parent = name; for (const rule of doc.overlays || []) if (rule.when?.opt === option.id) rule.when.opt = name; }, true);
    });
    details.append(field('Option id', id), field('Control type', select(['bool', 'choice', 'range'].map(value => ({ value, label: { bool: 'Toggle', choice: 'Choice', range: 'Slider' }[value] })), option.type, type => {
      const affected = (editor.store.get().document.overlays || []).filter(rule => rule.when?.opt === option.id).length, children = defs.filter(item => item.parent === option.id).length;
      if ((affected || children) && !confirm(`Change this control type? ${affected} rule condition(s) will reset and ${children} child control(s) will be detached. Override colours stay intact.`)) { editor.show(); return; }
      mutate(editor, doc => {
        const item = doc.options[index]; item.type = type; delete item.values; delete item.min; delete item.max; delete item.step; delete item.unit; delete item.effect;
        if (type === 'bool') item.default = false;
        if (type === 'range') Object.assign(item, { default: 50, min: 0, max: 100, step: 1 });
        if (type === 'choice') Object.assign(item, { default: 'first', values: [{ id: 'first', label: { en: 'First' } }, { id: 'second', label: { en: 'Second' } }] });
        for (const child of doc.options) if (child.parent === item.id) delete child.parent;
        for (const rule of doc.overlays || []) if (rule.when?.opt === item.id) rule.when = { opt: item.id, eq: item.default };
      }, true);
    }, 'Control type')));
  }
  const kind = normalized.type || option.type;
  if (kind === 'bool') details.append(boolField('Default state', option.default ?? normalized.default, value => editor.update([...path, 'default'], value)));
  if (kind === 'range') {
    for (const [key, label] of [['default', 'Default value'], ['min', 'Minimum'], ['max', 'Maximum'], ['step', 'Step']]) {
      if (standard && key === 'step') continue;
      const input = editor.number([...path, key], { step: 'any', placeholder: normalized[key] === undefined ? '' : String(normalized[key]) });
      if (option[key] === undefined) input.value = normalized[key] ?? '';
      details.append(field(label, input));
    }
    if (!standard) {
      details.append(field('Units', editor.text([...path, 'unit'], { maxlength: 4, placeholder: '%, px, pt…' })));
      const effectChoices = [{ value: '', label: 'None · use rules below' }];
      if (!defs.some((item, i) => i !== index && item.effect === 'surface_brightness')) effectChoices.push({ value: 'surface_brightness', label: 'Surface brightness' });
      details.append(field('Continuous effect', select(effectChoices, option.effect || '', effect => {
        mutate(editor, doc => {
          if (!effect) delete doc.options[index].effect;
          else {
            const spec = editor.contract.effects?.surface_brightness || {};
            Object.assign(doc.options[index], { effect, default: spec.default ?? 100, min: spec.min ?? 60, max: spec.max ?? 120, step: spec.step ?? 1, unit: spec.unit ?? '%' });
            doc.requires = Math.max(doc.requires || 1, spec.requires ?? 2);
          }
        }, true);
      }, 'Continuous effect'), 'Surface brightness requires theme level 2 and 60–120% bounds around a 100% default.'));
    }
  }
  if (kind === 'choice') {
    details.append(field('Default choice', select((option.values || []).map(value => ({ value: value.id, label: value.label?.en || value.id })), option.default, value => editor.update([...path, 'default'], value), 'Default choice')));
    (option.values || []).forEach((choice, choiceIndex) => {
      const choicePath = [...path, 'values', choiceIndex], choiceBox = el('div', { class: 'choice-definition' });
      const id = el('input', { type: 'text', value: choice.id, 'aria-label': 'Choice id', maxlength: 32 });
      id.addEventListener('change', () => {
        const next = id.value.trim();
        if (!/^[a-z][a-z0-9_]{0,31}$/.test(next) || option.values.some((item, i) => i !== choiceIndex && item.id === next)) { editor.notify('Choice ids must be unique lowercase identifiers.'); id.value = choice.id; return; }
        mutate(editor, doc => { doc.options[index].values[choiceIndex].id = next; if (doc.options[index].default === choice.id) doc.options[index].default = next; for (const rule of doc.overlays || []) if (rule.when?.opt === option.id && rule.when.eq === choice.id) rule.when.eq = next; }, true);
      });
      choiceBox.append(field('Choice id', id), field('English label', editor.text([...choicePath, 'label', 'en'], { maxlength: 40 })), localized(editor, [...choicePath, 'label'], 'Choice translations'));
      const remove = button('Remove choice', () => {
        const affected = (editor.store.get().document.overlays || []).filter(rule => rule.when?.opt === option.id && rule.when.eq === choice.id).length;
        if (affected && !confirm(`Remove this choice and ${affected} dependent rule(s)?`)) return;
        mutate(editor, doc => { doc.options[index].values.splice(choiceIndex, 1); if (doc.options[index].default === choice.id) doc.options[index].default = doc.options[index].values[0].id; if (affected) doc.overlays = doc.overlays.filter(rule => !(rule.when?.opt === option.id && rule.when.eq === choice.id)); }, true);
      }, 'text-button danger-text'); remove.disabled = option.values.length <= 2; choiceBox.append(remove); details.append(choiceBox);
    });
    const add = button('Add choice', () => mutate(editor, doc => { const items = doc.options[index].values; items.push({ id: uniqueId(items, 'choice'), label: { en: `Choice ${items.length + 1}` } }); }, true)); add.disabled = (option.values || []).length >= (editor.contract.limits?.choiceMax || 12); details.append(add);
  }
  if (!standard) {
    details.append(el('hr', { class: 'section-rule' }), field('English label', editor.text([...path, 'label', 'en'], { maxlength: 40 })), field('English help', editor.text([...path, 'help', 'en'], { maxlength: 160 })), localized(editor, [...path, 'label'], 'Label translations'), localized(editor, [...path, 'help'], 'Help translations', 160));
    const descendants = new Set([option.id]);
    for (let i = 0; i < defs.length; i++) for (const item of defs) if (descendants.has(parentOf(editor, item))) descendants.add(item.id);
    const parents = [{ value: '', label: 'No parent' }, ...defs.filter((item, i) => i !== index && item.type === 'bool' && !descendants.has(item.id) && !defs.some((child, childIndex) => childIndex !== index && parentOf(editor, child) === item.id)).map(item => ({ value: item.id, label: item.label?.en || item.id }))];
    details.append(field('Enabled by', select(parents, option.parent || '', value => { editor.update([...path, 'parent'], value || undefined); editor.show(); }, 'Parent toggle'), 'A disabled parent keeps its child’s saved value. A toggle can have one direct child.'));
    details.append(boolField('Place in More', option.advanced, value => editor.update([...path, 'advanced'], value)), field('Section label', editor.text([...path, 'section'], { maxlength: 24, placeholder: 'Optional grouping' })));
  }
  return details;
}

function layerEditor(editor, path) {
  const layer = at(editor.store.get().document, path) || {}, container = el('div');
  for (const [kind, title] of [['colors', 'Colour overrides'], ['radii', 'Radius overrides'], ['borders', 'Border overrides'], ['icon_palette', 'Icon overrides']]) {
    const table = layer[kind] || {}, group = el('details', { class: 'rule-layer-group', open: Object.keys(table).length > 0 }, el('summary', {}, title, el('span', { class: 'category-count' }, `${Object.keys(table).length}`)));
    for (const [key, value] of Object.entries(table)) {
      if (kind === 'colors' || kind === 'icon_palette') group.append(editor.token([...path, kind, key], key, value, { resetLabel: 'Remove override' }));
      if (kind === 'radii') group.append(el('div', { class: 'row-between' }, field(friendly(key), editor.number([...path, kind, key], { min: 0, max: 32, step: 1 })), button('Remove', () => { editor.update([...path, kind, key], undefined); editor.show(); }, 'text-button')));
      if (kind === 'borders') group.append(el('div', { class: 'rule-border' }, el('h4', { class: 'small-heading' }, friendly(key)), borderFields(editor, [...path, kind, key], key), button('Remove override', () => { editor.update([...path, kind, key], undefined); editor.show(); }, 'text-button')));
    }
    const keys = kind === 'colors' ? editor.keys('color') : kind === 'radii' ? (editor.contract.radiusKeys || []).map(item => typeof item === 'string' ? item : item.key) : kind === 'borders' ? editor.contract.borderSchema?.roles || [] : [...(editor.contract.iconRoleKeys || []), ...(editor.contract.iconAccentKeys || [])].filter(key => editor.contract.iconDefaults?.[editor.store.get().document.base]?.[key] !== undefined || editor.store.get().document.icon_palette?.[key] !== undefined);
    group.append(addControl('Add an override…', keys.filter(key => !Object.hasOwn(table, key)), key => {
      let value;
      if (kind === 'colors') value = clone(editor.result?.resolved?.colors?.[key] ?? defaults(editor).colors?.[key] ?? '#808080');
      if (kind === 'radii') value = defaults(editor).radii?.[key] ?? 4;
      if (kind === 'borders') value = borderDefault(editor, key);
      if (kind === 'icon_palette') value = clone(editor.store.get().document.icon_palette?.[key] ?? editor.contract.iconDefaults?.[editor.store.get().document.base]?.[key]);
      editor.update([...path, kind, key], value); editor.show();
    })); container.append(group);
  }
  return container;
}
function ruleCondition(option) {
  return { opt: option.id, eq: option.type === 'bool' ? true : option.type === 'choice' ? option.default ?? option.values?.[0]?.id ?? '' : option.default ?? option.min ?? 0 };
}
function overlayCard(editor, overlay, index) {
  const defs = editor.store.get().document.options || [], path = ['overlays', index], option = defs.find(item => item.id === overlay.when?.opt);
  const details = el('details', { class: 'disclosure-card overlay-card' }, el('summary', {}, `Rule ${index + 1}`, el('span', { class: 'pill' }, overlay.when?.opt || 'Choose an option')));
  const conditionFor = ruleCondition;
  details.append(el('div', { class: 'row-between' }, el('p', { class: 'field-help' }, 'Later matching rules win by key.'), el('div', { class: 'button-row' }, button('↑', () => { if (index) mutate(editor, doc => { [doc.overlays[index - 1], doc.overlays[index]] = [doc.overlays[index], doc.overlays[index - 1]]; }, true); }), button('↓', () => { if (index < (editor.store.get().document.overlays || []).length - 1) mutate(editor, doc => { [doc.overlays[index + 1], doc.overlays[index]] = [doc.overlays[index], doc.overlays[index + 1]]; }, true); }), button('Remove', () => mutate(editor, doc => doc.overlays.splice(index, 1), true), 'button small danger-text'))));
  details.append(field('When this option…', select(defs.map(item => ({ value: item.id, label: item.label?.en || friendly(item.id) })), option?.id, value => { const def = defs.find(item => item.id === value); if (def) { editor.update([...path, 'when'], conditionFor(def)); editor.show(); } }, 'Rule option')));
  if (!option) details.append(el('p', { class: 'error-list' }, 'This rule refers to an option that is not defined. Select one above or repair the source.'));
  else if (option.type === 'bool') details.append(field('…is', select([{ value: 'true', label: 'On' }, { value: 'false', label: 'Off' }], String(overlay.when.eq), value => editor.update([...path, 'when', 'eq'], value === 'true'), 'Rule toggle condition')));
  else if (option.type === 'choice') details.append(field('…equals', select((option.values || []).map(item => ({ value: item.id, label: item.label?.en || item.id })), overlay.when.eq, value => editor.update([...path, 'when', 'eq'], value), 'Rule choice condition')));
  else if (option.type === 'range') {
    const equal = Object.hasOwn(overlay.when || {}, 'eq');
    details.append(field('…matches', select([{ value: 'equal', label: 'Exactly equals' }, { value: 'range', label: 'Within a range' }], equal ? 'equal' : 'range', mode => { editor.update([...path, 'when'], mode === 'equal' ? conditionFor(option) : { opt: option.id, gte: option.min ?? 0, lte: option.max ?? 100 }); editor.show(); }, 'Rule numeric condition')));
    if (equal) details.append(field(`Value${option.unit ? ` · ${option.unit}` : ''}`, editor.number([...path, 'when', 'eq'], { step: 'any' })));
    else for (const [key, label] of [['gte', 'At least'], ['lte', 'At most']]) {
      const value = overlay.when[key], row = field(`${label}${option.unit ? ` · ${option.unit}` : ''}`, editor.number([...path, 'when', key], { step: 'any', placeholder: 'Unbounded' }));
      const remove = button(value === undefined ? 'Unbounded' : 'Remove bound', () => { editor.update([...path, 'when', key], undefined); editor.show(); }, 'text-button');
      remove.disabled = value === undefined || overlay.when[key === 'gte' ? 'lte' : 'gte'] === undefined;
      row.append(remove); details.append(row);
    }
  }
  details.append(layerEditor(editor, path)); return details;
}
export function optionsEditor(editor) {
  editor.root.append(heading('ROOM TO PLAY', 'Options & rules.', 'Create a theme with possibilities. Define useful controls, then decide what each choice changes.'));
  const doc = editor.store.get().document, options = doc.options || [];
  const object = value => value && typeof value === 'object' && !Array.isArray(value);
  if (editor.result?.needsNewer) {
    editor.root.append(el('p', { class: 'empty-state' }, 'This file uses a newer theme level. Its options and rules remain intact in Source; this runtime does not reinterpret their syntax.'), button('Review source', () => editor.select('source'))); return;
  }
  if (!Array.isArray(options) || options.some(option => !object(option) || typeof option.id !== 'string' || (option.type === 'choice' && (!Array.isArray(option.values) || option.values.some(choice => !object(choice) || typeof choice.id !== 'string')))) || (doc.overlays !== undefined && (!Array.isArray(doc.overlays) || doc.overlays.some(overlay => !object(overlay))))) {
    editor.root.append(el('p', { class: 'error-list' }, 'The draft’s options or rules have an invalid structure. Your last valid preview is safe; repair the structure in Source to use the visual builder.'), button('Repair source', () => editor.select('source'))); return;
  }
  editor.root.append(el('h3', { class: 'small-heading' }, 'Theme options'), el('p', { class: 'field-help' }, 'Standard controls stay first. Custom controls appear in the order below; children share a cell with their parent.'));
  options.forEach((option, index) => editor.root.append(optionCard(editor, option, index)));
  const standardMissing = (editor.contract.standardOptions || []).filter(item => !options.some(option => option.id === item.id));
  if (standardMissing.length) {
    const remaining = (editor.contract.limits?.maxOptions || 16) - options.length;
    const possible = standardMissing.filter(item => item.id !== 'tab_fade_ms' || options.some(option => option.id === 'tab_colours') || remaining >= 2);
    const addStandard = addControl('Add a standard control…', possible.map(item => ({ value: item.id, label: item.resolvedLabel || item.label?.en || friendly(item.id) })), id => mutate(editor, doc => {
    doc.options ||= [];
    const item = clone(editor.contract.standardOptions.find(item => item.id === id));
    if (id === 'tab_fade_ms' && !doc.options.some(item => item.id === 'tab_colours')) doc.options.push(clone(editor.contract.standardOptions.find(item => item.id === 'tab_colours')));
    doc.options.push(item);
    }, true));
    addStandard.querySelector('select').disabled = remaining <= 0; editor.root.append(addStandard);
  }
  const addOption = button('＋ Add a custom option', () => mutate(editor, doc => { doc.options ||= []; doc.options.push({ id: uniqueId(doc.options, 'custom_option'), type: 'bool', default: false, label: { en: 'A new possibility' }, help: { en: '' } }); }, true)); addOption.disabled = options.length >= (editor.contract.limits?.maxOptions || 16); editor.root.append(addOption);
  editor.root.append(el('hr', { class: 'section-rule' }), el('h3', { class: 'small-heading' }, 'Conditional rules'), el('p', { class: 'field-help' }, 'Choose an option value and author only the values it changes. Rules cannot change other rules, options or workspace tables.'));
  (doc.overlays || []).forEach((overlay, index) => editor.root.append(overlayCard(editor, overlay, index)));
  if (!doc.overlays?.length) editor.root.append(el('p', { class: 'empty-state' }, 'No rules yet. A toggle can change a palette; a choice can offer a different contrast or accent.'));
  const addRule = button('＋ Add a rule', () => mutate(editor, doc => { doc.overlays ||= []; const option = doc.options[0]; doc.overlays.push({ when: ruleCondition(option), colors: {} }); }, true));
  addRule.disabled = !options.length || (doc.overlays || []).length >= (editor.contract.limits?.maxOverlays || 32); editor.root.append(addRule);
}
