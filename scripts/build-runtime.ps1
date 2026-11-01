[CmdletBinding()]
param([string]$SourcePath, [switch]$Development)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$source = Get-Content -Raw -LiteralPath (Join-Path $projectRoot 'runtime-source.json') | ConvertFrom-Json
if (-not $SourcePath) {
    if ($source.commit -notmatch '^[0-9a-f]{40}$') { throw 'Pin runtime-source.json to the reviewed 40-character fork commit before a published build. Local review may pass -SourcePath.' }
    $cacheRoot = Join-Path $projectRoot 'target'
    New-Item -ItemType Directory -Force -Path $cacheRoot | Out-Null
    $SourcePath = Join-Path $cacheRoot ('runtime-' + $source.commit)
    if (-not (Test-Path -LiteralPath (Join-Path $SourcePath '.git'))) {
        git clone --filter=blob:none --no-checkout $source.repository $SourcePath
        if ($LASTEXITCODE -ne 0) { throw 'Runtime source clone failed.' }
        git -C $SourcePath fetch origin $source.commit
        if ($LASTEXITCODE -ne 0) { throw 'Pinned runtime fetch failed.' }
        git -C $SourcePath checkout --detach $source.commit
        if ($LASTEXITCODE -ne 0) { throw 'Pinned runtime checkout failed.' }
    }
}
$SourcePath = (Resolve-Path -LiteralPath $SourcePath).Path
$revision = git -C $SourcePath rev-parse HEAD
if ($LASTEXITCODE -ne 0) { throw 'Runtime source is not a valid checkout.' }
$dirty = [bool](git -C $SourcePath status --porcelain)
if (-not $PSBoundParameters.ContainsKey('SourcePath') -and ($revision -ne $source.commit -or $dirty)) { throw 'Published runtime must exactly match its clean pinned source commit.' }
$previousRevision = $env:SOLIDCRAFT_THEME_STUDIO_REVISION
$env:SOLIDCRAFT_THEME_STUDIO_REVISION = $revision + $(if ($dirty) { '-dirty' } else { '' })
try {
    Push-Location (Join-Path $SourcePath $source.workspaceApp)
    try {
        # Message catalogs are served as files, not compiled in (the lazy-locales feature); the runtime's build
        # script writes the merged catalogs here. A published build uses the size-tuned web-studio profile.
        $env:SOLIDCRAFT_LOCALES_OUT = Join-Path $SourcePath 'target/theme-studio-locales'
        if ($Development) { trunk build --locked true } else { trunk build --cargo-profile web-studio --locked true }
        if ($LASTEXITCODE -ne 0) { throw 'Rust/Trunk runtime build failed; existing preview artifacts were retained.' }
    } finally { Pop-Location }
    # Cargo/Trunk may update the lockfile. Published provenance must describe the
    # source after compilation, and must never silently accept a changed checkout.
    $postRevision = git -C $SourcePath rev-parse HEAD
    if ($LASTEXITCODE -ne 0 -or $postRevision -ne $revision) { throw 'Runtime source revision changed during compilation; artifacts were not published.' }
    $postStatus = git -C $SourcePath status --porcelain
    if ($LASTEXITCODE -ne 0) { throw 'Could not verify runtime source after compilation.' }
    $dirty = [bool]$postStatus
    if (-not $PSBoundParameters.ContainsKey('SourcePath') -and $dirty) { throw 'Published runtime source became dirty during compilation; artifacts were not published.' }
    $artifactRevision = $postRevision + $(if ($dirty) { '-dirty' } else { '' })
    $dist = Join-Path $SourcePath 'target/theme-studio-web'
    $module = Get-ChildItem -LiteralPath $dist -Filter ($source.package + '*.js') | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    $wasm = Get-ChildItem -LiteralPath $dist -Filter ($source.package + '*_bg.wasm') | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if (-not $module -or -not $wasm) { throw 'Trunk did not produce the expected runtime JavaScript and WASM artifacts.' }
    $runtimeDir = Join-Path $projectRoot 'runtime'
    $pkgDir = Join-Path $runtimeDir 'pkg'
    # Replace old hashes only after a successful build and explicit path validation.
    $resolvedProject = [IO.Path]::GetFullPath($projectRoot).TrimEnd([IO.Path]::DirectorySeparatorChar)
    $resolvedPkg = [IO.Path]::GetFullPath($pkgDir)
    $expectedPkg = [IO.Path]::GetFullPath((Join-Path $resolvedProject 'runtime/pkg'))
    if ($resolvedPkg -ne $expectedPkg -or -not $resolvedPkg.StartsWith($resolvedProject + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
        throw 'Refusing to replace artifacts outside the project runtime/pkg directory.'
    }
    if (Test-Path -LiteralPath $resolvedPkg) { Remove-Item -LiteralPath $resolvedPkg -Recurse -Force }
    New-Item -ItemType Directory -Force -Path $pkgDir | Out-Null
    Get-ChildItem -LiteralPath $dist | Where-Object { $_.Name -ne 'index.html' } | ForEach-Object { Copy-Item -LiteralPath $_.FullName -Destination $pkgDir -Recurse -Force }
    $licenseDir = Join-Path $runtimeDir 'licenses'
    New-Item -ItemType Directory -Force -Path $licenseDir | Out-Null
    $licensePaths = @()
    $licenseHashes = [ordered]@{}
    foreach ($name in @('LICENSE-MIT', 'LICENSE-APACHE', 'THIRD-PARTY-LICENSES.txt')) {
        $original = Join-Path $SourcePath $name
        Copy-Item -LiteralPath $original -Destination (Join-Path $licenseDir $name) -Force
        $relative = './licenses/' + $name
        $licensePaths += $relative
        $licenseHashes[$relative] = (Get-FileHash -LiteralPath $original -Algorithm SHA256).Hash.ToLowerInvariant()
    }
    $localesSource = Join-Path $SourcePath 'target/theme-studio-locales'
    if (-not (Test-Path -LiteralPath $localesSource) -or -not (Get-ChildItem -LiteralPath $localesSource -Filter '*.json')) { throw 'The runtime build did not write its message catalogs.' }
    $localesDir = Join-Path $runtimeDir 'locales'
    if (Test-Path -LiteralPath $localesDir) { Remove-Item -LiteralPath $localesDir -Recurse -Force }
    New-Item -ItemType Directory -Force -Path $localesDir | Out-Null
    Copy-Item -Path (Join-Path $localesSource '*.json') -Destination $localesDir -Force
    # Icon artwork: the pinned source's masters (flat and model) and small optical variants, with an
    # index from master id to file, so the page draws the same artwork the native renderer rasterises.
    $iconSource = Join-Path $SourcePath 'assets/icons/ui/design/svg'
    $iconsDir = Join-Path $runtimeDir 'icons'
    if (Test-Path -LiteralPath $iconsDir) { Remove-Item -LiteralPath $iconsDir -Recurse -Force }
    New-Item -ItemType Directory -Force -Path $iconsDir | Out-Null
    $iconIndex = [ordered]@{ masters = [ordered]@{}; small = [ordered]@{} }
    foreach ($group in @('flat', 'model', 'small')) {
        $groupSource = Join-Path $iconSource $group
        if (-not (Test-Path -LiteralPath $groupSource)) { throw "Missing icon group $group in the runtime source." }
        New-Item -ItemType Directory -Force -Path (Join-Path $iconsDir $group) | Out-Null
        foreach ($file in Get-ChildItem -LiteralPath $groupSource -Filter '*.svg') {
            Copy-Item -LiteralPath $file.FullName -Destination (Join-Path $iconsDir $group) -Force
            $id = $file.BaseName
            if ($group -eq 'small') { $iconIndex.small[$id] = "small/$($file.Name)" } else { $iconIndex.masters[$id] = "$group/$($file.Name)" }
        }
    }
    # Real SolidCraft artwork newer than the pinned source (for example the workspace marks). Pinned
    # artwork always wins, and a master is only added where the pinned source has none.
    $supplement = Join-Path $projectRoot 'assets/icons-supplement'
    if (Test-Path -LiteralPath $supplement) {
        foreach ($groupDir in Get-ChildItem -LiteralPath $supplement -Directory) {
            New-Item -ItemType Directory -Force -Path (Join-Path $iconsDir $groupDir.Name) | Out-Null
            foreach ($file in Get-ChildItem -LiteralPath $groupDir.FullName -Filter '*.svg') {
                if ($iconIndex.masters.Contains($file.BaseName)) { continue }
                Copy-Item -LiteralPath $file.FullName -Destination (Join-Path $iconsDir $groupDir.Name) -Force
                $iconIndex.masters[$file.BaseName] = "$($groupDir.Name)/$($file.Name)"
            }
        }
    }
    $iconIndex | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $iconsDir 'index.json') -Encoding utf8NoBOM
    $fontDir = Join-Path $runtimeDir 'fonts'
    New-Item -ItemType Directory -Force -Path $fontDir | Out-Null
    $fontPaths = @()
    foreach ($font in @(
        @{ Directory = 'biz-udp-gothic'; Name = 'BIZUDPGothic-Regular.ttf' },
        @{ Directory = 'craft-ui-sc'; Name = 'CraftUI-SC.otf' },
        @{ Directory = 'craft-ui-tc'; Name = 'CraftUI-TC.otf' }
    )) {
        $originalDir = Join-Path $SourcePath ('assets/fonts/' + $font.Directory)
        Copy-Item -LiteralPath (Join-Path $originalDir $font.Name) -Destination (Join-Path $fontDir $font.Name) -Force
        $fontPaths += './fonts/' + $font.Name
        $oflName = $font.Directory + '-OFL.txt'
        $ofl = Join-Path $originalDir 'OFL.txt'
        Copy-Item -LiteralPath $ofl -Destination (Join-Path $fontDir $oflName) -Force
        $relative = './fonts/' + $oflName
        $licensePaths += $relative
        $licenseHashes[$relative] = (Get-FileHash -LiteralPath $ofl -Algorithm SHA256).Hash.ToLowerInvariant()
    }
    $manifest = [ordered]@{ module = './pkg/' + $module.Name; wasm = './pkg/' + $wasm.Name; revision = $artifactRevision; source = $source.repository; dirty = $dirty; licensePaths = $licensePaths; licenseHashes = $licenseHashes; fontPaths = $fontPaths; wasmSha256 = (Get-FileHash -LiteralPath $wasm.FullName -Algorithm SHA256).Hash.ToLowerInvariant() }
    $manifest | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $runtimeDir 'manifest.json') -Encoding utf8NoBOM
} finally { $env:SOLIDCRAFT_THEME_STUDIO_REVISION = $previousRevision }
