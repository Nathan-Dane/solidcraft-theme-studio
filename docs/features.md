# SolidCraft Theme Studio — read-only implementation audit

Audited 2026-11-01. No product edits, builds or tests performed. This document is planning evidence, not a validation result.

## Revision contract

- Authoritative latest Onyx: `theme-onyx` / `0d9591f39`, checkout `SolidCraft checkout at the pinned Onyx revision`.
- Pending native blur/control branch: PR #9810 / `9fb94f36b`, checkout `blur-controls-review`, additionally containing the reviewed but uncommitted compact Blur/Fade label/layout refinement. The Onyx branch alone DOES NOT register the native blur provider.
- Pending slider fix #10375: `slider-transparency-review`, claim `150f97c09` plus reviewed uncommitted slider source edits. Native rail/handle shapes are removed rather than masked with a rectangle; token track/thumb and native editor/input stay.
- Related Browser clear-backdrop preference #10396 is host policy, not theme data. It deliberately bypasses blur for the floating Design Browser and stacked History when enabled. Independently created popups/tooltips still blur. Do not mistake this for a theme-wide blur disable.
- Website baselines must record these exact source/patch revisions. A single main-branch token dump is insufficient for all latest features. Do not copy entire older preview files over newer product source.

## Authoritative source map

- Codec, limits, key inventory, literal layers, option validation/order, resolution, export, follow reload: `crates/ui-egui/src/theme_files.rs`.
- Defaults: `assets/styles/ui/palettes.rs`; runtime tokens, accessibility, surfaces/fades, readability, brightness: `crates/ui-egui/src/theme.rs`.
- Provider availability/application: `crates/ui-egui/src/theme_options.rs` (use #9810 version for blur).
- Actual control layout: `ui_kit/preferences.rs`, `preferences_layout.rs`; primitives `fields.rs`, `actions.rs`, `panel.rs`, `container.rs`, `history.rs`, `navigation.rs`.
- Native effect: `blur.rs`, `blur_native.rs`, `blur.wgsl`, locally modified egui-wgpu renderer/pass owner.
- Actual original artwork: `assets/icons/ui/design/svg`, stable roles `palette.toml`, aliases `aliases.toml`, resolution/rasterisation `icon_svg.rs`, generated-data wiring `crates/ui-egui/build.rs`.
- Existing gallery `ui_kit/gallery.rs` is test-oriented and draws actual kit elements; it is not a ready standalone production web API.

## File envelope, validation and import semantics

- File `format` exactly `solidcraft-theme/1`; required nonempty trimmed `name`, at most 80 Unicode characters; `base` exactly `dark` or `light`. Runtime id is a slug of name, not a separately authored identity in the portable file.
- JSON text limit 256 KiB. Colors limit 512 entries per literal layer before discarding retired entries; at most 64 imported themes in app preferences. A studio should apply the same bounds to uploads/paste and not execute imported content.
- Optional base tables: `colors`, `radii`, `borders`, `icon_palette`; `tabs`, ordered `options`, ordered `overlays`, optional integer `requires`.
- `requires` defaults to legacy 1 and is omitted for 1 on export. Supported maximum is 2. Level 2 is retained explicitly on export. A future level preserves authored base tables but disables options/overlays and flags needs-newer. Future syntax must not be interpreted opportunistically.
- `order` and `provenance` occur in shipped asset authoring but are not ThemeFile codec fields. Existing app definition export does not preserve arbitrary top-level author annotations. Studio must choose/document whether it retains raw extra metadata in project state; it must not claim the app export preserves it.
- Unknown color/radius/border/icon/tab keys reject imports (up to eight color/radius errors reported); many unrelated extra top-level/option fields are ignored by current codec. Do not claim a blanket unknown-property rejection stricter than native behavior.
- Colors accept trimmed #rrggbb or #rrggbbaa, uppercase hex permitted; alpha is unpremultiplied in JSON. Native Color32 stores gamma-premultiplied bytes: low-alpha round trips may quantize RGB. Opaque snapshot export uses lowercase 6-digit, translucent 8-digit. Single slots accept a string or a one-element array; list slots require exact list length.
- Compatibility: legacy `gizmo` and `triad` lists each contain three colors; triad wins over gizmo, explicit axis_x/y/z win over both in the same layer. Logo legacy list of four reads first three. Retired procedural-icon/window-band color keys are dropped, not exposed as editable active tokens.
- Import validates complete supported-level tables atomically; last valid file remains active on failed followed-file reload. Follow interval 1 second, desktop path limit 4096; following is an app integration, not a mandatory browser editor file-system feature.

## Palette and shape coverage

- 155 scalar color keys plus continuity[4], logo[3], and three scalar icons.* viewport-glyph colors (160 active keys total). Full inventory below. These include File page surfaces, app bar, selection/hover, sketches, grid/axes, bodies, dimensions, preview cuts, semantic workspace inks/fills/softs, forms, and native viewport glyphs.
- Not all token fields are color-editable file fields: typography, spacing, control heights, analysis shader tables, hover-face lift etc remain compiled defaults. A full feature editor must not invent unsupported JSON keys for them.
- Radii: radius_sm, radius_md, radius_lg, radius_xl, control_radius, sketch_mode_radius; each integer logical UI points 0..32. Missing retains base value; states such as hover/focus use the same geometry policy.
- Borders max seven roles: primary, secondary, tertiary, container, control, primary_inset, bevel. Ordinary stroke width finite 0..4, color required; width 0 disables. Secondary additionally pattern solid(default) or dotted. Primary inset also requires finite gap 0..12. Bevel width >0..2 and requires highlight/light/shadow/dark_shadow color; no other settings accepted. Stroke widths consume/influence native margins, corner bounds and clipping; do not render every border as a CSS inset box-shadow.
- Missing border entries retain host-specific native styling. Explicit borders are independent of legacy border color tokens. Primary inset can coexist with primary stroke; bevel directional raised/recessed treatment differs by control/surface.

## Options, descendants and layout

- At most 16 definitions. IDs match [a-z][a-z0-9_]{0,31}; unique.
- Kinds: bool with bool default; choice with 2..12 unique valid-id values and declared valid default; numeric range with finite f32-representable min/max/default/positive step, min<=max, custom default within bounds. Unit optional <=4 characters.
- Custom localized label/help/value-label maps: max64 languages; language code length1..32 ASCII alphanumeric/hyphen/underscore; labels <=40 Unicode characters, help <=160, section <=24. Missing translations use theme English fallback. Use en,de,ja,ko,zh for newly authored studio content.
- Standard metadata is app-owned and normalized: opacity range floor40 ceiling100, omitted default100/min40/max100, step1 unit%; blur floor0 ceiling60 step1 px; tab_colours bool; tab_fade_ms range0..600 step20 ms and forcibly parent=tab_colours. App labels override authored labels/help for standard IDs. Standard default values are clamped into declared narrower bounds.
- Standard options are opt-in declarations, never automatically injected. Provider absent/unavailable means ordinary palette fallback; undeclared runtime settings cannot activate behavior. Unavailable ancestors disable descendants.
- Custom parent must name a bool option, one child per parent, no cycles; descendants can form a chain. Disabled children retain their stored values, but inactive descendant overlays/effects do not apply.
- Order: standard opacity, blur, tab_colours followed by its child chain; custom roots in file order, descendants remain grouped. Onyx latest exact order given below.
- Values use JSON bool/string/number; effective resolution validates type/choice/finite, clamps ranges WITHOUT snapping to step. Wrong type/choice/nonfinite fall back to authored default with notices; unknown saved ids omitted from effective map but raw saved intent may remain in app preferences. Preview edits are separate from changing exported authored defaults.
- Actual UI packs ordered measured two-column cells. Bool/range/<=3 choice usually compact; 4..5 choice wide, >5 dropdown. Parent/child share composite cell. Translated label, readout, reason and cost meter participate in measured minimum; narrow widths stack/fall back. Ten main cells, advanced or remaining cells go to More; section labels appear beyond six cells. Do not hardcode every option to full width or stretch all controls identically.
- Reviewed refinement: standard labels Blur and Fade, Tab colours unchanged; forced wide Blur removed. Native preview confirmed Opacity+Blur compact columns and Tab colours+Fade one compact cell beside Contrast. Fade is disabled with Tab colours off, preserving its value.
- Reviewed slider: NO rectangular backing under any configuration. Preserve native hit geometry, keyboard/value editor, formatted readouts, disabled fading, off endpoint hollow thumb and cost cue. Custom track/thumb match native endpoint input radius. Do not simply omit rail/background and leave a second native thumb visible.

## Overlays and exact resolution order

- Max32 overlays; ordered. Each has one strict `when` either {opt,eq} (exact typed bool/choice/number) or {opt,gte?,lte?} (range, inclusive finite bounds, at least one bound, gte<=lte). Unknown options/comparison keys or mixed comparisons reject. Choice eq must be a declared value; numeric eq need not itself be inside declaration bounds and then simply may never match.
- Overlay tables only colors/radii/borders/icon_palette, same validation as base layers. They do not introduce tabs, options or arbitrary executable expressions. Matching later entries replace earlier map entries by key; border-role objects replace by role, not deep-merge arbitrary nested properties.
- Resolver: validate/normalize definitions and saved values; clone authored base; apply active matching overlays in file order (legacy-axis precedence local to each layer); resolve base palette/defaults/derived file-view colors; if offered and enabled tab_colours, apply selected tab's three allowed surface overrides; apply active continuous effect(s); apply registered standard providers (opacity); protect tab panel readability; then runtime environment/accessibility/logo/viewport overrides at publication boundary.
- Keep author document and derived tokens separate. Exporting a resolved token snapshot loses conditionals/definitions/tab tables by design. Offer explicit theme-definition download versus separately named current-look snapshot; do not silently flatten Onyx.

## Continuous brightness, level 2

- Custom range effect string surface_brightness only; not a standard/provider id and retains custom label/order. Requires level>=2. Only one such effect in a theme, not on a standard ID or non-range.
- Bounds inside60..120, must include100, default100, step1, unit%. Onyx uses complete60..120. Runtime finite clamp60..120. Default100 returns exact original bytes; alpha0 unchanged. RGB multiply in sRGB bytes, round/clamp; original alpha retained. This is not HSL value, CSS filter brightness on the whole UI, or a linear-light exposure change.
- Applies after tab/overlay surfaces and BEFORE opacity protection. Text, semantic/status/selection colors, axes, icon palette remain unchanged. Changed roles: panel/panel_header/toolbar/timeline/timeline_item/dialog_bg/dialog_body/dialog_footer/overlay/field/control_fill/app_bar/app_bar_tab_active/nav_tip/nav_field/nav_viewport/glyph_bg/cube_face/viewport_top/viewport_bottom/grid/grid_major/border/dialog_border/dialog_rule/control_border/app_bar_separator/nav_tip_key_border/cube_border/file_background/file_surface/file_border/file_recovery_well; explicit primary/secondary/tertiary/container/control stroke colors and primary_inset stroke color. Bevel colors are not transformed by this method.

## Tabs, animation, accents, readability and accessibility

- Known tab ids (exact, case-sensitive): MODEL, SKETCH, SURFACE, MESH, FORM, SHEET METAL, WELDMENTS, ASSEMBLE, INSERT, INSPECT, MANAGE, VIEW, RENDER, RENDER APPEARANCE, RENDER SCENE, RENDER CAMERA.
- Each tab allows ONLY panel, viewport_top, viewport_bottom scalar colors. No panel_header, toolbar, arbitrary tokens, radii or icons in tab table. Other tab-specific values can be authored through custom choice/overlay, not the tabs mechanism.
- Fade animates only panel and viewport gradient surfaces. It blends perceptually with OKLab RGB and alpha interpolation, preserves exact endpoints, retargets from current sampled appearance and requests repaint only while active; duration0 instant. Affordance semantic colors remain governed by TabAccent/workspace tokens.
- Cache identity includes complete theme content and raw saved map, not only id/base; reload same name must refresh. Environment includes dark/light, accessibility mode, custom generation, logo preference, separate viewport theme/background. Icon caches include complete palette/look/accent/pixel size. Browser studio should cache derived state, never mutate authored source from a preview-only switch.
- Opacity scales only neutral backing fill alpha: panel,panel_header,toolbar,timeline,dialog_bg/body/footer,overlay and nav_tip. It is NOT global opacity applied to UI text/icons. Native readable_fill raises alpha from requested up to255 until primary body inks retain4.5:1 over BOTH black and white underlying backgrounds (sRGB compositing followed by WCAG luminance). Full opacity>=100 bypasses scaling; invalid finite values clamp40..100 at provider. Authored low-alpha full-fill behavior is preserved at100. Tab panel has another floor protecting text/text_dim/form_ink/dialog_label even at100. Browser CSS opacity on parent would be wrong.
- Color vision modes off/protan/deutan/tritan are authored semantic palette overrides, NOT screen-wide color filters. Protan/deutan share red-green table; tritan blue-yellow. SVG accessibility variants take priority over custom semantic icon ramps. Preview these modes and expose contrast diagnostics without mutating exported theme.
- Navigation cube inactive blends face/border/text and axes55% toward viewport_top while retaining opaque facets; active shows full palette. Need both states in faithful gyro preview.
- Derived File view chooses readable inks from theme candidates; do not paste fixed blue app-default File page behind a custom theme.

## Native blur and browser fidelity boundary

- Theme blur is radius0..60 physical pixels, default only if declared; opacity independent. Cost bars ceil(radius/8) saturated5 from33 through60; off is hollow/muted with Off readout and line cue. Five level maximum, schedule2steps<=8,3<=18,4<=30,5 thereafter, normalized Kawase offset radius/(2*sqrt((35/18)*(4^steps-1))). 2*steps passes for EACH actual backing boundary in current ordered compositor.
- Native root viewport only; real prepared scene/background initializes composition, then each semantic backing marker filters all actual preceding UI and paints before its normal fill/content. Nested popups must blur preceding panels, not cut through them to scene. Effective painter opacity/fades, clips, all four radii, screen transforms and device scale matter.
- All explicit backing UI hosts/cards participate, except true alpha0/no backing or deliberate clear Browser policy. Text, strokes, selection/hover tints and model geometry are not separate blur surfaces.
- Capability rejects software devices, unsupported target/device/resource/source situations, web paths and other native viewports. Runtime saved radius remains unchanged by unavailable path. OS Reduce transparency can disable rendering; quality guard after60 consecutive actual native submission intervals>22ms lowers pass cap, not radius. Undo/suppression are session state, not file data.
- Existing web app has NO native blur compositor integration. CSS backdrop-filter blur is Gaussian/implementation-dependent, logical CSS pixels and browser stacking; it is not the app's Kawase physical-pixel pipeline. A CSS-only preview may be useful but MUST be labeled approximate for blur, gamma rounding, native widget layout/rasterisation and compositing. Do not claim pixel identity.
- Root counters bound resources256MiB and markers256; disabled effect allocates no effect resources/passes. Avoid advertising a benchmark from source audit; no performance measurement performed.

## Original SVG artwork and palette substitution

- 362 SVG files include normal masters and small optical variants;38 explicit aliases at audited revision. Use real source geometry, not Unicode/emoji/hand-drawn replacements. Copy only approved SolidCraft artwork with its licence/attribution and record original paths/revision. No external CAD assets.
- Role source hexes are stable identifiers, NOT literal intended display colors. currentColor means role line. Roles include ink,line,passive-1/2/3,gap,guide,active-1/2/3 and component orange/yellow triplets. Default palette and semantic ramps come from palette.toml.
- icon_palette accepts all role names EXCEPT gap plus ramps solid,surface,form,mesh,sketch,constraint,construction, exactly3 opaque colors for ramps, opaque scalar for roles. Omitted entries keep compiled defaults. Gap erases prior artwork to alpha0; replacing white/gap with dark background paint is wrong. Preserve clip paths, masks, group opacity, even-odd rules, dash, joins and transparency holes.
- Resolve alias -> master + explicit or default semantic accent. At px<=24 use small variant if available. Icon native rasteriser tiny-skia; native browser SVG anti-aliasing can differ even with identical geometry.
- Active ramp uses solid if no semantic accent; a missing semantic ramp must fall back to compiled semantic accent, NOT the custom solid ramp. Accessibility variant tables win first. Guide has dedicated fallback and must not be recolored with workspace accent. Whole-glyph tint maps passive1/2/3 to active1/2/3 only, preserving ink, guides, mask literals and knockout.
- Browser SVG role mapping should parse/transform fill/stroke attributes via source-role lookup, use a real mask/knockout equivalent, and isolate per-icon ids to prevent document mask/clip collisions. Replacing all same-colored source text indiscriminately can change literal mask paint. Reuse native rasteriser via bridge if exactness is required.

## Recommended implementation architecture and review gates

1. Static multi-file project, relative assets/URLs and versioned source manifest, build output publishable to GitHub Pages. Separate author-document model, schema/codec, pure resolver, preview state, UI editor, icon assets, preview renderer and export. No server requirement, no API secrets, import remains local. Keep project save/restore separate from portable theme export.
2. Authoritative Rust/WASM bridge preferred for decode/normalize/resolve/export and native icon pixels. Public theme_files parse/from_value/resolve/resolve_with/export/export_file and public theme/IconSvg pieces already exist. Tab resolution, brightness/readability helpers, icon palette serialization and many kit controls are crate-private; a small explicit bridge entry inside ui-egui is needed. Do NOT reimplement a second divergent resolver ad hoc in UI handlers.
3. A ready lightweight WASM package does NOT exist. ui-egui depends engine+gpu+other app modules unconditionally; wasm wrapper around current crate compiles that dependency graph. Source already builds for browser, but first/cold WASM compile and payload are unmeasured here. Existing full web app is Trunk/eframe WebGPU+WebGL2, relative public_url ./ and offline hook; it exposes an application API rather than a tiny theme-only export. A new bridge can dead-strip unused code at link time, but do not promise resulting size/build-time before measuring.
4. For exact native controls, reuse actual kit draw code in an egui preview canvas via a public preview entry; existing gallery provides the drawing ingredients but is test-only. A theme-core extraction could make codec/tokens standalone long-term, but that is a separate refactor requiring native equivalence review. Forked Rust snapshots must be pinned/regeneratable with clear provenance.
5. Multiple independent interactive views: CAD workspace scene with actual Browser/History/ribbon/gyro/grid and selectable surfaces; Preferences/forms with exact option packer/sliders/segments/readouts/disabled/keyboard/value-edit states; menu/dialog/tooltip overlap composition; File page/cards/status and icon semantic matrix; accessibility/contrast inspection. Views share resolved tokens but have independent scenario interactions and viewport state. Use actual app dimensions/fonts and real artwork, not a screenshot background with a few overlaid controls.
6. Blur remains a deliberate architecture choice: either honestly show native-WASM UI with blur unavailable as app web currently behaves, or implement browser ordered compositor matching published shader schedule/alpha/clip semantics (WebGPU/WGSL is closest) and label validation status. CSS Gaussian cannot become faithful by adjusting radius constants alone. A WebGL/Canvas preview may be a planned fallback, not silent identical rendering.
7. Stage review gates: (a) capability/codec contract + authoring flow and visual design plan, (b) shell and first faithful preview, (c) all supported schema editors and interaction views, (d) Onyx full import/export and cross-preview state, (e) native cross-reference captures and publish-ready output. User asked staged reviews; stop for each actual review rather than completing the whole app before first inspection.
8. Root-owned minimal eventual validation: Onyx definition round-trip (not flattened) including requires2,effect,tab surfaces,locales/choices; invalid boundaries and future-level preservation; compare actual native token snapshots for60/100/120brightness and opacity endpoints and both foreground modes; ensure exact option order and no Edge finish; original SVG samples including knockout/aliases/small versions/accessibility; keyboard/disabled sliders, parent Fade state, overlapping backing blur and dark/light bases. No such validation was run in this audit.

## Latest Onyx authoring baseline

```json
{
  "requires": 2,
  "name": "Onyx",
  "base": "dark",
  "options": [
    {
      "id": "opacity",
      "type": "range",
      "default": 80,
      "min": 60,
      "max": 100
    },
    {
      "id": "blur",
      "type": "range",
      "default": 60,
      "max": 60
    },
    {
      "id": "tab_colours",
      "type": "bool",
      "default": false
    },
    {
      "id": "tab_fade_ms",
      "type": "range",
      "default": 240
    },
    {
      "id": "accent",
      "type": "choice",
      "default": "slate"
    },
    {
      "id": "contrast",
      "type": "choice",
      "default": "soft"
    },
    {
      "id": "brightness",
      "type": "range",
      "effect": "surface_brightness",
      "default": 100,
      "min": 60,
      "max": 120,
      "step": 1,
      "unit": "%"
    },
    {
      "id": "foreground_colours",
      "type": "choice",
      "default": "vibrant"
    }
  ],
  "borders": {
    "primary_inset": {
      "width": 0.5,
      "gap": 1,
      "color": "#dce2e70e"
    }
  }
}
```

No Edge finish option: Etched inset permanently in base. Accent Slate/Silver/Sage; Contrast Soft/Defined; Brightness60–120%; Foreground Vibrant(default)/Muted. Opacity80%default60–100%; Blur60pxdefault/max60; Tab colours defaultfalse, Fade240ms. Sheet Metal palette uses coordinated cool mineral teal/petrol; fine grid252729, major2e3235. Keep all baseline fields/tables in canonical import/export.

## Full active color-key inventory

Scalar #rrggbb/#rrggbbaa (or native-accepted singleton array):

- nav_hover, nav_press, nav_dim, nav_viewport, nav_tip, nav_tip_ink, nav_tip_key_border, nav_field
- file_dim, file_recovery_well, file_background, file_surface, file_border, file_image_tint, file_rail, file_rail_ink
- file_rail_hover, file_primary, file_primary_ink, file_primary_border, file_recovery, file_recovery_ink, file_recovery_border, app_bar
- toolbar, panel, panel_header, border, text, text_dim, accent, accent_soft
- sketch_accent, error, warning, icon, timeline, hover, sel_face, sel_edge
- sel_edge_rim, hover_edge, hover_edge_halo, sel_profile, sel_profile_edge, hover_profile, hover_profile_edge, sel_vertex
- origin_plane, origin_plane_edge, origin_plane_hover, origin_point, axis_x, axis_y, axis_z, construction_plane
- construction_geom, body, body_edge, manipulator, joint_manipulator, joint_axis, preview_add, preview_new
- preview_sketch, preview_cut, cube_face, cube_border, cube_text, cube_hover, viewport_top, viewport_bottom
- grid, grid_major, body_selected, sketch, sketch_fixed, sketch_halo, sketch_locked, sketch_conflict
- dimension, dimension_driven, sketch_point, sketch_point_free, dialog_bg, dialog_border, chip, section_cap
- profile_fill, glyph_bg, glyph_edge, glyph_text, overlay, rubber_band, app_bar_text, app_bar_hover
- timeline_item, timeline_item_error, timeline_marker, field, box_window, box_crossing, sketch_projected, sketch_lost
- sketch_construction, sketch_centerline, bend_up, bend_down, interference, sketch_ink, sketch_soft, surface_fill
- surface_ink, surface_soft, mesh_fill, mesh_ink, mesh_soft, form_fill, form_tab_ink, form_soft
- sheet_fill, sheet_ink, sheet_soft, render_fill, render_ink, render_soft, tab_on_fill_dark, app_bar_separator
- surface_accent, mesh_accent, form_accent, render_accent, on_accent, agent_ok, agent_busy, app_bar_hover_subtle
- app_bar_hover_button, app_bar_hover_strong, app_bar_tab_active, form_ink, form_dim, form_primary, form_primary_fill, form_error
- form_error_fill, form_success, form_success_fill, dialog_body, dialog_footer, dialog_rule, control_fill, control_border
- dialog_label, selected_ink, selected_bg

Lists: continuity exactly4, logo exactly3 (legacy4 accepted on import). Viewport glyph scalars: icons.highlight, icons.agent, icons.marker_halo.

SVG roles accepted except gap: ink, line, passive-1, passive-2, passive-3, guide, active-1, active-2, active-3, component-orange-1, component-orange-2, component-orange-3, component-yellow-1, component-yellow-2, component-yellow-3.

SVG three-color ramps: solid, surface, form, mesh, sketch, constraint, construction.
