// Starting points. A template is a foundation plus, optionally, a recipe of sweeps run on top of it, so
// every one is an ordinary theme that can be pulled further with the same controls.
import { clone } from './state.js';
import { apply, colourEdits, context, weightEdits } from './sweeps.js';

export const TEMPLATES = [
  { id: 'dark', name: 'SolidCraft Dark', blurb: 'The standard dark look, with nothing overridden.', base: 'dark' },
  { id: 'light', name: 'SolidCraft Light', blurb: 'The standard light look, with nothing overridden.', base: 'light' },
  { id: 'onyx', name: 'Onyx', blurb: 'Muted slate with glass panels, tab colours and every standard option.', starter: true },
  { id: 'midnight', name: 'Midnight', blurb: 'Deep, cool blue-greys.', base: 'dark', recipe: [['all', 'brightness', -0.4], ['all', 'warmth', -1], ['all', 'intensity', 0.15]] },
  { id: 'paper', name: 'Paper', blurb: 'Warm and soft, easy on the eyes.', base: 'light', recipe: [['all', 'warmth', 0.9], ['all', 'brightness', -0.08], ['all', 'contrast', -0.25]] },
  { id: 'high-contrast', name: 'High contrast', blurb: 'Maximum separation between layers, text and lines.', base: 'dark', recipe: [['all', 'contrast', 1], ['lines', 'strength', 1], ['lines', 'weight', 1]] }
];

/** A fresh theme document for a template. */
export function buildTemplate(contract, template) {
  if (template.starter && contract.starter) return clone(contract.starter);
  const doc = { format: contract.format || 'solidcraft-theme/1', name: template.name === 'SolidCraft Dark' || template.name === 'SolidCraft Light' ? 'Untitled theme' : template.name, base: template.base };
  for (const [part, op, t] of template.recipe || []) {
    const ctx = context(contract, doc);
    apply(doc, op === 'weight' ? weightEdits(ctx, t) : colourEdits(ctx, part, op, t));
  }
  return doc;
}
