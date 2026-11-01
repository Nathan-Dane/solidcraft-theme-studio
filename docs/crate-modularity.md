# Crate modularity plan

Goal: the theme, UI kit and translation code live in small crates that sister apps (the browser Theme Studio now; other SolidCraft front ends later) can depend on without pulling in the CAD application. No behaviour change in the desktop app.

## Why

The browser Theme Studio links `solidcraft-ui-egui`, a ~280k-line crate that depends on the engine, GPU, kernel and every CAD dialog. After lazy-loading translations the studio WASM is 12.5 MB raw (4.2 MB gzipped), still mostly code that no theme preview reaches by design but cannot be removed because it is reachable through the crate's own module graph.

## Measured findings (commit `80a4ad18d` plus the Theme Studio scenes)

Module reachability from the studio's scene code: about 170 of 203 non-test `ui-egui` modules and about 194k of 211k lines. The cause is a small set of back-edges from foundation modules into application modules, not the foundations themselves. Counts are `crate::<module>` references outside tests.

| Foundation module (lines) | Back-edges into application code |
| --- | --- |
| `theme` (2.2k) | `workspace` (tab names), `scenario` (test harness), `gpu`, `fonts`, `icon_svg` |
| `theme_files` (3.0k), `theme_options` (0.2k) | none beyond `theme`/`icon_svg` |
| `icons` (0.4k), `icon_svg` (1.1k) | `sketch_families` (icon_svg), `fonts` |
| `fonts` (1.7k) | `prefs` (UI font choice), `scenario` |
| `frame` (0.3k) | `shell` (layout mode), `dialogs`, `scenario` |
| `i18n` (2.5k), `bidi` (0.2k) | `prefs`, `toolbar`, `toolbar_custom`, `workspace`, `context_menu`, `dialogs`, `sketch_families`, `ui_kit` (mostly its tests and the message-id guard) |
| `blur` (0.2k) | `gpu` |
| `ui_kit` (24k) | `prefs` (`parse_number`, `unit_scale`), `prefs_search`, `scenario` (tests), `navigation_bar`, `context_menu`, `shell` (`LayoutMode`), `timeline_left`, `shortcut_box`, `issue_report`, `recent_colors`, `params_dialog`, `browser`, `home` |

The foundations are separable. Only a few types are in the wrong place (`LayoutMode`, number parsing and unit scaling, tab names, the UI-font preference value).

Binary composition of the studio WASM before the translation work: 14.4 MB data (12 MB translation catalogs, fonts, icon tables), 8.2 MB code, 1.25 MB symbol names.

## Target crates

Layer numbers extend the existing rule "geom, sketch/kernel/render, doc, io, engine, ui-egui, apps" (`cargo xtask layers`). Each new crate needs an entry there.

| Crate | Contents | Depends on |
| --- | --- | --- |
| `solidcraft-ui-text` | `i18n` catalogs, `lazy-locales`/`install_catalog`, `bidi`, message-id guards | none (no egui) |
| `solidcraft-theme` | `Tokens`, `theme_files` (format, resolve, export), `theme_options`, colour vision, tab accents, `icon_svg` colour roles, workspace tab names | `egui` (colours only), `ui-text` |
| `solidcraft-ui-kit` | `ui_kit` widgets and containers, `frame`, `LayoutMode`, `icons`, `fonts`, number parsing and unit scaling, navigation cube drawing | `theme`, `ui-text`, `egui`, `tiny-skia` |
| `solidcraft-ui-blur` | `blur`, `blur_studio`, `StudioRenderer` | `ui-kit`, `egui-wgpu` |
| `solidcraft-view-math` (or a `view` feature of `geom`) | `grid_lines`, `dim_layout`, `Camera` projection used by the viewport study | `geom` only |
| `solidcraft-theme-studio-core` | `theme_studio*` scenes, `contract`, `evaluate`, `export_definition`, `StudioPreview` | `theme`, `ui-kit`, `view-math`, `ui-text` |
| `solidcraft-ui-egui` | the CAD application shell: dialogs, toolbar, browser, `SolveApp`, preferences | all of the above, `engine`, `gpu` |

`apps/theme-studio` then depends on `theme-studio-core` and `ui-blur` only.

## Steps (each is its own PR; the repository allows one topic per PR)

1. **Measure and guard.** Add a documented `cargo xtask` check (or script) that builds the studio WASM and prints raw and gzipped size, and one that prints the foundation back-edges above, so every later step shows its effect. No code moves.
2. **Extract `solidcraft-ui-text`.** Move `i18n` and `bidi`. Invert the back-edges: the crate must not mention `prefs`, `toolbar`, `workspace` or dialogs; the application passes the language preference in. Move tests that scan application sources to the application crate. Keep `lazy-locales` and `install_catalog`.
3. **Extract `solidcraft-theme`.** Move tokens, theme files and options, vision, tab accents and icon colour roles. Replace the `workspace` and `sketch_families` edges with small data tables owned by `theme` (the tab names list is data).
4. **Extract `solidcraft-ui-kit`.** Move `ui_kit`, `frame`, `icons`, `fonts`. Move `LayoutMode`, `parse_number` and `unit_scale` into it. The UI-font choice arrives as a plain parameter, not a `prefs` import. `ui_kit` pieces that need application state (`context_menu`, `shortcut_box`, `navigation_bar` glue, `prefs_search`) stay in `ui-egui` and use the kit.
5. **Extract `solidcraft-ui-blur`** and **`solidcraft-view-math`.**
6. **Extract `solidcraft-theme-studio-core`** and point `apps/theme-studio` at it. Remove the `theme-studio` feature from `ui-egui` once nothing uses it.
7. **Re-measure.** Record raw and gzipped WASM size, build time, and the foundation back-edge counts in the PR. Target: the studio no longer links `engine`, `kernel` or `gpu` apart from what `view-math` needs; report the actual size.

Work in this order; steps 2 to 4 are the load-bearing ones. After each step the desktop app, the full test suite and the Theme Studio must behave exactly as before.

## Rules that apply (from `AGENTS.md`)

- Run `cargo xtask ci` before every commit, and do not switch branches while it runs.
- Layering: update `cargo xtask layers` for every new crate. Only `crates/kernel` may use `truck`.
- UI strings go in `assets/locales/pending/<slug>.json`; sorted lists stay sorted (`cargo xtask lists`). Do not edit generated files.
- Never crash: no `unwrap`/`expect`/`panic`/`unsafe` in non-test code.
- A moved test stays in the area's existing test file; do not add per-bug files.
- A changed default needs a preference and the PR's `Changes a default:` line; this plan should change none.
- Observable changes need real screenshots or a recording. For pure moves, show the Theme Studio before and after (identical scenes) and the desktop app unchanged.
- Build the WASM with Rust 1.96.1, `cargo +1.96.1`, target `wasm32-unknown-unknown`, via `trunk` from `apps/theme-studio` (see the Theme Studio repository's `scripts/build-runtime.ps1`, which accepts `-SourcePath` for a local checkout).

## Prompt for the implementing worker

> You are working in the SolidCraft repository (clean-room Rust CAD, egui UI). Read `AGENTS.md`, `CONTRIBUTING.md` and `skills/solidcraft-contributing/SKILL.md` first and follow them exactly: look at open PRs and issues, claim with a draft PR, one topic per PR, run `cargo xtask ci` before every commit.
>
> Goal: make the theme, UI-kit and translation code reusable by other front ends without pulling in the CAD application. Do it as a series of small PRs, one per step below, in this order. After each step the desktop app and every existing test must behave exactly as before; do not change any default or any visible behaviour.
>
> 1. Add tooling that prints (a) the raw and gzipped size of the browser Theme Studio WASM (`apps/theme-studio`, built with `trunk build --cargo-profile web-studio`) and (b) the count of `crate::<application module>` references from the foundation modules listed in the plan. Put the baseline numbers in the PR.
> 2. Extract `crates/ui-text` (`solidcraft-ui-text`): `i18n` and `bidi`, keeping the `lazy-locales` feature, `install_catalog` and `lazy_catalog_ids`. The crate must not depend on egui or on any application module; invert any edge to `prefs`, `toolbar`, `workspace`, `context_menu` or dialogs by passing data in. Tests that scan application sources move to `ui-egui`.
> 3. Extract `crates/theme` (`solidcraft-theme`): tokens, theme files and options, colour vision, tab accents, icon colour roles. Replace imports of `workspace` and `sketch_families` with data owned by the new crate.
> 4. Extract `crates/ui-kit` (`solidcraft-ui-kit`): `ui_kit`, `frame`, `icons`, `fonts`, `LayoutMode`, `parse_number` and `unit_scale`. The UI-font choice is a plain parameter. Code that needs application state stays in `ui-egui`.
> 5. Extract `ui-blur` (blur, `StudioRenderer`) and a small view-math crate (`grid_lines`, `dim_layout`, camera projection) so the viewport study does not need `engine`.
> 6. Extract `theme-studio-core` (the `theme_studio*` scenes, contract, evaluate, export) and make `apps/theme-studio` depend only on it and `ui-blur`. Remove the `theme-studio` feature from `ui-egui`.
> 7. Re-run the step-1 tooling and report the new WASM size, build time and back-edge counts.
>
> For every new crate add it to `cargo xtask layers` with the right layer, give it its own `Cargo.toml` with workspace lints, and keep public APIs minimal. Verify the Theme Studio still renders every scene identically (screenshots before and after) and that `cargo xtask ci` passes. Report any back-edge you could not remove and why, rather than working around the layering rules.

## Open questions for the maintainers

- Whether `view-math` should be a new crate or a module of `geom`.
- Whether `icons`/`fonts` belong in `ui-kit` or a separate `ui-assets` crate (fonts embed several MB).
- Naming: `ui-text`/`theme`/`ui-kit` follow the existing `crates/*` pattern; confirm the `solidcraft-` prefix.
