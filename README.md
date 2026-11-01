# SolidCraft Theme Studio

A browser-local workbench for creating and editing SolidCraft themes. The editor surrounds a small collection of **real SolidCraft UI components**, rendered by the source-pinned Rust/WASM runtime with original SVG artwork, bundled fonts and the native theme resolver. No backend, account or CDN is required.

The preview separates temporary option values from the authored definition. Export validates through Rust and retains the original options, rules, workspace tables, requirement level and unknown metadata. It does not flatten the theme into resolved colours.

## Local development

Requirements:

- Node.js 20 or newer; the frontend has no npm dependencies.
- Python 3 or another local static HTTP server.
- PowerShell 7 (`pwsh`), Git, Rust/Cargo with the `wasm32-unknown-unknown` target, and Trunk.
- The runtime source requires Rust 1.95 or newer; building Trunk 0.22.1 requires Rust 1.96.1 or newer. CI pins Rust 1.96.1 and Trunk 0.22.1.

Build the reviewed source recorded in `runtime-source.json`:

```sh
rustup toolchain install 1.96.1 --profile minimal --target wasm32-unknown-unknown
cargo +1.96.1 install trunk --version 0.22.1 --locked
pwsh -File scripts/build-runtime.ps1
python -m http.server 4173 --bind 127.0.0.1
```

Open `http://127.0.0.1:4173/`. Serve over HTTP rather than opening `index.html` directly; ES modules and WASM need an origin. On systems with multiple Rust toolchains, set `RUSTUP_TOOLCHAIN=1.96.1` for the runtime build.

For local runtime development only, the build helper accepts a reviewed local SolidCraft checkout:

```sh
pwsh -File scripts/build-runtime.ps1 -SourcePath /path/to/solidcraft -Development
```

That override is for local previews. Dirty or unpinned artifacts cannot pass publication packaging. There is no JavaScript replacement theme resolver or mock preview fallback if the runtime is missing.

## Validation

The focused acceptance script instantiates the compiled WASM directly in Node and calls its real codec. It checks lossless Onyx definition round-trips, option order, Brightness, accent/contrast/foreground rules, workspace surfaces, preserved fractional blur intent, invalid inputs and future-file preservation:

```sh
npm test
```

Browser verification is separate: inspect real hover/focus/disabled states, icon optical sizes, layered transparency and blur, contrast modes, comparison and responsive layouts. Running the acceptance script does not establish visual parity or successful GPU rendering. About the preview exposes actual renderer state, effective blur and counters.

## Package for GitHub Pages

The compiled theme engine ships in `runtime/` (WASM, message catalogs, icon artwork, fonts and licences) and is committed, so packaging and CI need no Rust toolchain. `runtime/manifest.json` records the source revision and the WASM hash, which `npm run package` verifies.

```sh
npm test
npm run package
python -m http.server 4173 --bind 127.0.0.1 --directory dist
```

`scripts/package-site.mjs` copies an allowlist of static application files to `dist/`, verifies the WASM hash and includes the exact runtime licences. All application URLs are relative, so the artifact can be hosted at `https://OWNER.github.io/REPOSITORY/`.

To refresh the engine, run `pwsh -File scripts/build-runtime.ps1` (optionally with `-SourcePath` for a local SolidCraft checkout), then commit the updated `runtime/` files.

## GitHub Pages deployment

1. In **Settings → Pages → Build and deployment**, choose **GitHub Actions**.
2. The **GitHub Pages** workflow runs the Onyx acceptance checks, packages `dist/` and uses GitHub’s official Pages artifact/deployment actions.
3. Pushes to `main` and manual workflow runs deploy; pull requests validate without deploying.

Action revisions are pinned to reviewed official releases. No account, token or server is needed.

## Source and licences

Website sources are MIT OR Apache-2.0. The runtime and artwork originate in SolidCraft, with their original licences preserved. IBM Plex fonts are distributed unmodified under SIL OFL 1.1. See [ATTRIBUTION.md](ATTRIBUTION.md), [LICENSE-MIT](LICENSE-MIT), [LICENSE-APACHE](LICENSE-APACHE), and the generated `runtime/licenses/THIRD-PARTY-LICENSES.txt` in built packages.

Design and capability records: [feature inventory](docs/features.md), [preview coverage](docs/coverage.md), [architecture](docs/architecture.md) and [authoring UX](docs/ux.md).
