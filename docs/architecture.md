# Theme Studio architecture

The site is a static application suitable for a GitHub Pages repository subpath. It requires no server, accounts, CDN, or runtime network services. All authored files stay in browser memory and optional local recovery storage until the user downloads them.

## Boundaries

- `index.html`: semantic shell, stable preview canvas and accessible document actions.
- `styles/studio.css`: authoring chrome, intentionally independent of the theme being edited.
- `src/state.js`: authored document, temporary preview values, last-valid state, bounded undo history and recovery.
- `src/bridge.js`: deterministic JSON-string boundary to the authoritative Rust WASM runtime.
- `src/editor.js`: category lifecycle, primitive colour/text/source controls and overview. It edits authored data, never a resolved token snapshot.
- `src/authoring.js`: grouped palette, shape, icon, workspace, option and conditional-rule builders, driven by native contract metadata.
- `src/dom.js`: safe text-based DOM construction and accessible field associations.
- `src/app.js`: lifecycle and user actions.
- `runtime/loader.js` and generated runtime artifacts: source-pinned SolidCraft resolver, codecs, real UI components, SVG renderer and preview scenes. Owned by the Rust runtime build.
- `fixtures/onyx.json`: the latest accepted Onyx definition used for development and acceptance.

## Runtime contract

`window.SolidCraftThemeStudio` offers `contract()`, `evaluate(source, values, tab, vision)`, `setPreview(source, values, tab, vision)` and `exportDefinition(source)`. Inputs and outputs cross as JSON strings. It dispatches `solidcraft-theme-studio-ready` once available.

The authoring shell does not implement a second theme resolver. Parsing, normalization, option ordering, conditional matching, tab composition, brightness and opacity protection belong to Rust. Export first validates with Rust, then pretty-prints the authored definition while preserving unknown metadata. Invalid edits keep the last valid preview and cannot be exported as a valid theme. Unsupported/newer files must not be silently normalized into data loss.

Authored definitions and preview option values are separate. Changing the preview brightness must not rewrite its default. A pinned comparison is an independent definition and preview snapshot, not an image with stale colours.

## Interaction and recovery

Pointer drags are coalesced into single undo transactions. The document is recoverable through local storage, including a syntactically invalid raw draft. Import is bounded and uses authoritative validation when the runtime is available. File download uses validated authored JSON, not a lossy resolved or normalized snapshot. Unknown metadata remains in the authored object and must be preserved by the export path or explicitly reported before export.

Keyboard users can reach every editor and preview control. The shell honours reduced motion; the actual egui preview provides the native widget focus behavior. The editor remains independently legible even when the authored palette is unusable.

## Reviews

1. Feature and preview coverage review.
2. Shell plus real controls vertical slice.
3. Complete structured authoring and recovery.
4. Onyx import, all option branches, round-trip export, real hover/focus/disabled states, narrow layout and Pages subpath verification.

Only the supervising agent runs tests or builds. This document is a plan, not a claim that checks have passed.
