// Loads only the compiled, pinned SolidCraft workspace runtime. No JS token resolver.
const root = new URL('./', import.meta.url);
try {
  const manifestResponse = await fetch(new URL('manifest.json', root), {cache: 'no-cache'});
  if (!manifestResponse.ok) throw new Error('The Rust preview has not been built. Run scripts/build-runtime.ps1 first.');
  const manifest = await manifestResponse.json();
  const runtime = await import(new URL(manifest.module, root).href);
  await runtime.default({module_or_path: new URL(manifest.wasm, root)});
  let failed = false;
  const reportFailure = error => {
    if (failed) return;
    failed = true;
    window.dispatchEvent(new CustomEvent('solidcraft-theme-studio-error', {detail: {
      message: String(error?.message || error), codecAvailable: true
    }}));
  };
  const guarded = fn => (...args) => {
    try { return fn(...args); }
    catch (error) { reportFailure(error); throw error; }
  };
  const metadata = JSON.parse(runtime.contract());
  const fontBytes = new Map();
  async function installLanguageFont(language) {
    const font = metadata.scriptFonts?.find(font => font.language === language && font.url);
    if (!font || typeof runtime.setScriptFont !== 'function') return;
    if (!fontBytes.has(language)) {
      fontBytes.set(language, fetch(new URL(font.url, root)).then(async response => {
        if (!response.ok) throw new Error(`Native preview font unavailable (${language}).`);
        return new Uint8Array(await response.arrayBuffer());
      }).catch(error => { fontBytes.delete(language); throw error; }));
    }
    const result = JSON.parse(runtime.setScriptFont(language, await fontBytes.get(language)));
    if (!result.ok) throw new Error(result.errors?.join(' ') || 'Native font installation failed.');
  }
  let currentLanguage = metadata.defaultLanguage || 'en-GB';
  const viewAPI = typeof runtime.setView === 'function' ? {
    setView: async config => {
      const value = typeof config === 'string' ? JSON.parse(config) : config;
      const result = guarded(runtime.setView)(JSON.stringify(value));
      if (JSON.parse(result).ok) {
        currentLanguage = value.language || currentLanguage;
        await installLanguageFont(currentLanguage);
      }
      return result;
    }
  } : {};
  window.SolidCraftThemeStudio = Object.freeze({
    ...viewAPI,
    contract: guarded(runtime.contract),
    evaluate: guarded((source, values = '{}', tab = 'MODEL', vision = 'off') => runtime.evaluate(source, typeof values === 'string' ? values : JSON.stringify(values), tab, vision)),
    setPreview: guarded((source, values = '{}', tab = 'MODEL', vision = 'off') => runtime.setPreview(source, typeof values === 'string' ? values : JSON.stringify(values), tab, vision)),
    exportDefinition: guarded(runtime.exportDefinition),
    state: guarded(runtime.state)
  });
  await runtime.start('solidcraft-theme-preview');
  window.dispatchEvent(new CustomEvent('solidcraft-theme-studio-ready', {detail: {revision: manifest.revision}}));
  let previous = '';
  let previousInspection = '';
  setInterval(() => {
    if (failed) return;
    let value;
    try { value = runtime.state(); }
    catch (error) { reportFailure(error); return; }
    if (value !== previous) {
      previous = value;
      const state = JSON.parse(value);
      if (state.runtimeError) { reportFailure(state.runtimeError); return; }
      window.dispatchEvent(new CustomEvent('solidcraft-theme-studio-state', {detail: state}));
      const inspection = state.preview?.inspection;
      const serialized = JSON.stringify(inspection);
      if (serialized !== previousInspection) {
        previousInspection = serialized;
        if (inspection) window.dispatchEvent(new CustomEvent('solidcraft-theme-studio-inspect', {detail: inspection}));
      }
    }
  }, 200);
} catch (error) {
  window.dispatchEvent(new CustomEvent('solidcraft-theme-studio-error', {detail: {message: String(error?.message || error), codecAvailable: Boolean(window.SolidCraftThemeStudio)}}));
}
