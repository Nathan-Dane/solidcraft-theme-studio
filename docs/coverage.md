# Preview and feature coverage

## Scene selection

| Scene | Theme judgments | Representative original icons and states |
| --- | --- | --- |
| Tools & tabs | App bar text and fills; ribbon surfaces; workspace accents and fading; hover, selected, disabled and tooltip states | `extrude`, `hole`, `fillet`, `surface_loft`, `flange`, `sheet_rules`, `save`, `undo` |
| Browser & history | Hierarchy, text hierarchy, row hover/selection, hidden and locked content, tiny icons and hover-only actions | `component`, `body`, `folder`, `eye`, history features |
| Feature controls | Labels, values, focus, selection, errors, primary and destructive actions, sliders, toggles, segments, numeric and text fields | `new`, `delete`, control icons; native keyboard and disabled states |
| Glass & menus | Translucent panels, nested menus and tooltips over detailed preceding content; blur radius, alpha floors, border roles, inset and bevel | Real `Container` surfaces and menu rows |
| Viewport details | Background gradients, quiet grids, body and edge tones, selected geometry, XYZ axes, sketch and construction guides, dimensions and canvas labels | `rect`, `spline_cv`, `c_parallel`, `axis_normal_to_face`, `plane_midplane`, `orbit`, `fit` |
| Icon lab | Neutral roles, semantic ramps, actual optical sizes, outlines, masks, clipping, transparent knockouts and simultaneous component colours | `interference` small variant; `coil` masks; `bendtable` clip path; `arc_slot` knockouts; status icons |

The icon lab must include 16, 24, 32 and 48 physical-pixel cases. The native renderer chooses an existing small optical variant at 24 physical pixels or below; device pixel ratio is part of the judgment. SVG source paint values identify semantic roles. GAP erases to transparency and must never be painted as an opaque panel colour.

## Authoring coverage

| Format feature | Editor location | Acceptance criterion |
| --- | --- | --- |
| Metadata, light/dark base, requirement level | Overview | Preserve metadata and distinguish absent/inherited fields from explicit values |
| Scalar and array colour tokens, alpha | Palette | All runtime-declared keys are searchable and editable; correct arity and alpha retained |
| Radii and all border roles | Shape & edges | Primary, secondary, tertiary, container, control, inset and bevel structures round-trip |
| SVG roles and active ramps | Icon colours | Roles and every semantic ramp can be inherited or authored; no artwork edits |
| Per-workspace panel and viewport tables | Workspaces | Every supported workspace and allowed tab key is editable; fades use real runtime behavior |
| Standard options | Options & rules | Opacity, Blur, Tab colours and Fade normalize through the authoritative provider definitions |
| Custom bool, choice and range definitions | Options & rules | Defaults, bounds, units, choices, labels/help/localizations, ordering, parents, sections and advanced state retained |
| Conditional overlays | Options & rules | Ordered equality/range conditions and literal colour/radius/border/icon tables remain editable |
| Continuous surface brightness | Options & rules | Explicit `surface_brightness` effect, level 2, 60–120%, 100% default, percent units and 1% steps |
| Raw/future/unknown properties | Source | Preserve authored data; invalid drafts remain recoverable; never silently drop fields on export |

## Onyx acceptance

Load the latest Onyx fixture. Confirm 80% Opacity with 60–100% range, Blur through 60 px, optional tab colours and 0–600 ms Fade, fixed Etched inset, and custom order Accent / Contrast / Brightness / Foreground colours. Exercise all three accents, both contrasts, both foreground modes, 60/100/120% Brightness, tab palettes, and opacity endpoints. Export and reimport through Rust; compare authored definitions and resolved appearances while keeping temporary preview values out of the file.

This matrix defines required coverage. Actual validation results are recorded separately by the supervising agent.
