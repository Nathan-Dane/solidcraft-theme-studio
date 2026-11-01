const RECOVERY_KEY = 'solidcraft-theme-studio.document.v1';
const HISTORY_LIMIT = 80;
export const clone = value => structuredClone(value);
export const pretty = value => JSON.stringify(value, null, 2) + '\n';

export function createStore(initial) {
  let document = clone(initial), text = pretty(initial), original = text, lastValidText = text;
  let parseError = null, history = [], future = [], transaction = null;
  let preview = {}, workspace = 'MODEL', vision = 'off', comparison = null, storage = 'pending';
  const listeners = new Set();
  let recoveryTimer;
  const snapshot = () => ({ document, text, lastValidText, parseError, preview, workspace, vision, comparison, storage,
    dirty: text !== original, canUndo: history.length > 0, canRedo: future.length > 0 });
  const emit = reason => {
    clearTimeout(recoveryTimer);
    recoveryTimer = setTimeout(() => {
      try { localStorage.setItem(RECOVERY_KEY, JSON.stringify({ text, original, lastValidText, preview, workspace, vision, savedAt: Date.now() })); storage = 'saved'; } catch { storage = 'unavailable'; }
      for (const listener of listeners) listener(snapshot(), 'storage');
    }, 250);
    for (const listener of listeners) listener(snapshot(), reason);
  };
  const remember = key => {
    if (!key || transaction !== key) {
      history.push(text);
      if (history.length > HISTORY_LIMIT) history.shift();
      future = [];
    }
    transaction = key || null;
  };
  const parseText = value => {
    text = value;
    try {
      const parsed = JSON.parse(value);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('A theme must be a JSON object.');
      document = parsed; parseError = null;
    } catch (error) { parseError = error.message; }
  };
  queueMicrotask(() => emit('initialized'));
  return {
    get: snapshot,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    change(mutator, key) {
      const next = clone(document); mutator(next);
      const nextText = pretty(next); if (nextText === text) return;
      remember(key); document = next; text = nextText; parseError = null; emit('document');
    },
    source(value) { if (value === text) return; remember('source'); parseText(value); emit('source'); },
    acceptValid(value) { lastValidText = value; },
    endTransaction() { transaction = null; },
    replace(value, clean = true) {
      remember(); parseText(typeof value === 'string' ? value : pretty(value));
      if (clean) original = text;
      preview = {}; transaction = null; emit('replace');
    },
    undo() {
      if (!history.length) return;
      future.push(text); parseText(history.pop()); transaction = null; emit('undo');
    },
    redo() {
      if (!future.length) return;
      history.push(text); parseText(future.pop()); transaction = null; emit('redo');
    },
    setPreview(id, value) { preview = { ...preview, [id]: value }; emit('preview'); },
    adoptPreview(changes, tab, mode) { preview = { ...preview, ...changes }; workspace = tab || workspace; vision = mode || vision; emit('native'); },
    clearPreview() { preview = {}; emit('preview'); },
    setContext(tab, mode) { workspace = tab; vision = mode; emit('context'); },
    pin() { comparison = comparison ? null : { document: clone(document), text, preview: clone(preview), workspace, vision }; emit('comparison'); },
    markExported() { original = text; emit('saved'); },
    recover() {
      try {
        const saved = JSON.parse(localStorage.getItem(RECOVERY_KEY));
        if (saved?.text && typeof saved.text === 'string') {
          if (typeof saved.lastValidText === 'string') { lastValidText = saved.lastValidText; parseText(lastValidText); }
          parseText(saved.text); original = saved.original || text;
          preview = saved.preview || {}; workspace = saved.workspace || 'MODEL'; vision = saved.vision || 'off';
          emit('replace'); return true;
        }
      } catch { /* A damaged or blocked recovery store never prevents launch. */ }
      return false;
    }
  };
}

export function at(object, path) { return path.reduce((value, key) => value?.[key], object); }
export function put(object, path, value) {
  const keys = [...path], last = keys.pop(); let target = object;
  for (const key of keys) {
    if (!Object.hasOwn(target, key) || !target[key] || typeof target[key] !== 'object') Object.defineProperty(target, key, { value: {}, writable: true, enumerable: true, configurable: true });
    target = target[key];
  }
  if (value === undefined) delete target[last]; else Object.defineProperty(target, last, { value, writable: true, enumerable: true, configurable: true });
}
