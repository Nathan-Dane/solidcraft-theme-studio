# Authoring experience

## Design direction

Theme Studio is a workbench, not a marketing page. A neutral graphite and white chrome, one restrained blue accent and IBM Plex typography keep the authoring surface calm. That chrome stays independent of the authored theme so an experimental palette cannot make its own editor unreadable.

The desktop layout is a **stage and dock**. A vertical category rail and an editing dock sit beside the preview stage. The dock has three widths: normal, wide (two or three columns of grouped cards) and rail-only. The stage can also be expanded to hide the dock entirely. Related controls share one card: all corner radii sit together, each palette group is one card of colour tiles, and nothing inside a group is ruled apart.

Scenes are chosen from a tab strip above the canvas (keys 0–6 when focus is outside a field or the canvas). "All scenes" is the overview; each other tab shows one real runtime scene at full size. "Try this theme" is a popover so option changes never resize the GPU canvas. On small screens, the preview remains above the editor rather than squeezing a complete CAD app into a thumbnail. The real runtime owns scene layout and interactions; the shell never draws or fakes preview content.

## Core flows

1. **Create:** choose a clean dark or light foundation from Overview, or start with Onyx. Blank documents contain only the portable format, name and base. Switching a foundation on a populated document deliberately retains its explicit overrides.
2. **Import:** select a local JSON file. The size limit comes from the runtime contract. Rust validates supported syntax; raw author metadata remains available. A future requirement level warns visibly and preserves its uninterpreted options.
3. **Edit:** choose a semantic palette group, a surface treatment, an icon role, workspace table, option or rule. A friendly role name accompanies the technical key. Inherited values remain distinct from explicit overrides.
4. **Judge:** hover, click and focus the actual preview widgets. Temporary option values belong to the preview, not the definition’s defaults. The native engine controls option ancestry and availability.
5. **Refine:** use separate option definitions and ordered rules to build one flexible theme. Rename operations update known references. Removing a referenced control explains dependent removals first; Undo remains available.
6. **Export:** validate through Rust, then download the authored definition with its unknown metadata retained. Never export a flattened token snapshot in place of the theme file.

## Editing safety

- Invalid syntax and semantic errors show a persistent, compact explanation beside the editor. The last valid preview stays intact.
- Source, parsed author data and the last Rust-accepted definition are separate; incomplete drafts survive refresh where browser storage is available.
- Recovery status claims success only after a storage write. Editing and explicit export remain available when storage is blocked.
- Slider and colour drags are coalesced into single Undo transactions. Native preview text editing keeps its own keyboard history; document shortcuts do not intercept canvas focus.
- No script, CSS expression or external resource in an imported theme is executed. Source text is displayed as text. Property writes create own properties rather than mutating JavaScript prototypes.

## Structured coverage

Palette groups avoid presenting hundreds of tiny controls at once. Groups are populated when opened; search still covers every runtime-declared key and list entry. Colour fields support exact hex, native colour selection and explicit alpha. Shape controls expose all native radius and border types. Icon roles and ramps seed new authored entries from the actual Rust palette, never guessed browser defaults.

Custom options include toggle, choice and slider types, typed defaults, bounds, step, units, localization maps, parents, advanced placement and authored order. The continuous Brightness binding uses the native level-2 effect. Rules edit typed equality/range conditions and all supported literal override tables.

Inspect and comparison controls remain unavailable until the runtime supplies their real capabilities. Loading a JavaScript API is not evidence that a preview frame has rendered. Codec readiness and renderer readiness are reported separately so theme authoring can continue if WebGPU is unavailable.

## Review record

The supervising agent reviewed the shell at desktop and 470 px mobile widths and accepted its direction. Full form behavior, actual preview fidelity and Onyx round-trip acceptance are separate review gates; this document does not claim they have passed.
