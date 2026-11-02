# Overview controls

The Overview page is where a theme gets most of the way to what its author wants. It has three parts: identity, a starting look, and sweeping changes for the whole app. The other tabs are for fine-tuning.

## Where the controls live

Sweeps exist at three levels, from general to specific, and each level sits above the next:

1. **Overview**: the whole app (brightness, contrast, warmth, intensity, hue, accent colour, corners, line weight, glass).
2. **The top of each editing tab**: "Sweep all of the interface / viewport / text & icons / workspaces". The first block moves everything the tab covers. Beneath it, folded, are the parts of that tab (panels & windows, lines, accent, status; viewport background, model & sketch; text, icons), each with the controls that suit it. Interface also owns the corner controls.
3. **The element groups** below, which edit individual colours, radii and lines. They redraw in place when a sweep above them moves the theme.

## Sweeps are relative

A sweep never sets a value. It reads each colour as it stands now (authored, or inherited from the foundation), moves it, and writes it back. So it works before or after any fine edit, and it can be repeated without a ceiling.

- A control with no bounds and no number of its own is a **wheel**: a knurled wheel between a − and a +. It starts at zero every time it is touched, turns with no end stop (140 px of drag is one "travel", and you can keep going), shows its effect live and keeps it on release. The readout pill appears only while it is in use. A sideways trackpad swipe also turns it; the arrow keys and the − / + buttons step it.
- A control whose value has a range and a number (corner radius, line weight, blur, surface opacity) is a **slider** that shows that number. It is still relative underneath: dragging it by some amount makes the same change to everything in its scope, so what was offset stays offset.
- One drag is one Undo step. Ops that would turn inside out stop at a floor (contrast stops at flat, intensity at grey), and colour stays inside the displayable range.
- Colour moves in OKLab, so a step in lightness, tint or hue looks the same on every colour. A result outside the colour range loses chroma instead of being clipped.
- Meaning colours (status, the X/Y/Z axes, add/cut previews, conflicts) are left where they are by a hue rotation.
- Every corner the preview draws is a radius token, or a token less a fixed inset, so none is left behind and nested corners stay concentric.

## What each control reaches

| Control | Kind | What it does | Parts that offer it |
| --- | --- | --- | --- |
| Brightness | wheel | every colour, icons and authored lines | panels & windows, text, accent, workspaces, status, viewport background, model & sketch, icons |
| Contrast | wheel | distance from the panel surface | panels & windows, text, viewport background |
| Warmth | wheel | tints near-grey colours toward amber or blue | panels & windows, text, viewport background |
| Intensity | wheel | colour strength; greys stay grey | accent, workspaces, status, model & sketch, icons |
| Hue | wheel | rotates colour (not meaning colours) | accent, workspaces, model & sketch, icons |
| Accent colour | colour | accent roles follow a chosen colour | whole app |
| Corner roundness | slider | all six radii | windows & panels, buttons & fields, small details |
| Line weight | slider | panel outline and any authored line | lines & dividers |
| Line strength | wheel | opacity or distance of lines from the surface | lines & dividers |
| Surface opacity | slider | alpha of the glass surfaces (panel, dialogs, toolbar) | panels & windows |
| Blur | slider | default of the standard Blur option | panels & windows |

Parts are: panels & windows, text, lines & dividers, accent & selection, workspace colours, status colours, viewport background, model & sketch, and icons. Every colour role belongs to exactly one part (`partOf` in `src/sweeps.js`).

## Starting looks

A template is a foundation plus a recipe of sweeps, so each is an ordinary theme that can be pulled further: SolidCraft Dark, SolidCraft Light, Onyx, Midnight, Paper and High contrast.
