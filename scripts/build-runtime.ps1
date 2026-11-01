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
        if ($Development) { trunk build --locked true } else { trunk build --release --locked true }
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
