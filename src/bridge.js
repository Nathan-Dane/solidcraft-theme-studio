export function runtime() { return window.SolidCraftThemeStudio || null; }
export async function call(method, ...args) {
  const engine = runtime();
  if (!engine || typeof engine[method] !== 'function') throw new Error('The SolidCraft preview engine is not ready yet.');
  const result = await engine[method](...args);
  return typeof result === 'string' ? JSON.parse(result) : result;
}
export const evaluate = state => call('evaluate', state.text, JSON.stringify(state.preview), state.workspace, state.vision);
export const preview = state => call('setPreview', state.text, JSON.stringify(state.preview), state.workspace, state.vision);
export const exportTheme = source => call('exportDefinition', source);
export const contract = () => call('contract');
