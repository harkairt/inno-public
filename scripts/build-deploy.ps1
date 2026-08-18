<#
.SYNOPSIS
  Builds the InnoChat SPA for each target environment and stages the output for deployment.

.DESCRIPTION
  Syncs the develop branch, then for every requested environment writes the matching .env and
  produces both artifacts, each from a clean tree and each verified against the expected base URL:

    generate -> `npm run generate`, static preset, copies .output\public
                into <DeployRoot>\<Tag>\<environment>\generate\
    build    -> `npm run build`, node-server preset, copies the whole .output
                into <DeployRoot>\<Tag>\<environment>\build\ (start with `node server\index.mjs`)

  Only the build artifact runs a Nitro server, so the /api, /chatHub and /assets proxy rules
  from nuxt.config.ts are live there; the generate artifact is a plain static bundle.

  The repository .env is backed up before the first build and restored afterwards, even if a
  build fails or the run is interrupted.

.EXAMPLE
  .\scripts\build-deploy.ps1
  Builds both artifacts for dev, staging and prod into .\deploy\<today>\.

.EXAMPLE
  .\scripts\build-deploy.ps1 -Environments prod -Artifacts build -SkipGit
  Rebuilds only the prod server bundle from the current working tree.
#>
[CmdletBinding()]
param(
  # Environments to build, in the given order.
  [ValidateSet('dev', 'staging', 'prod')]
  [string[]]$Environments = @('dev', 'staging', 'prod'),

  # Which artifacts to produce per environment.
  [ValidateSet('generate', 'build')]
  [string[]]$Artifacts = @('generate', 'build'),

  # Deploy root. Defaults to <repo>\deploy. Relative paths are resolved against the repo root.
  [string]$DeployRoot,

  # Name of the dated folder created under the deploy root.
  [ValidatePattern('^[\w.\-]+$')]
  [string]$Tag = (Get-Date -Format 'yyyy-MM-dd'),

  # Build from the current working tree instead of switching to and pulling develop.
  [switch]$SkipGit,

  # Force `npm ci` even when the lockfile did not change.
  [switch]$Install
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# --- paths -------------------------------------------------------------------

$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).ProviderPath
$envPath = Join-Path $repoRoot '.env'
$outputDir = Join-Path $repoRoot '.output'
$nuxtDir = Join-Path $repoRoot '.nuxt'
$publicDir = Join-Path $outputDir 'public'

if ([string]::IsNullOrWhiteSpace($DeployRoot)) {
  $DeployRoot = Join-Path $repoRoot 'deploy'
}
elseif (-not [System.IO.Path]::IsPathRooted($DeployRoot)) {
  $DeployRoot = Join-Path $repoRoot $DeployRoot
}
$dateRoot = Join-Path $DeployRoot $Tag

# --- environment definitions -------------------------------------------------

$envFiles = @{}

$envFiles['dev'] = @'
# API Configuration
NUXT_PUBLIC_API_BASE_URL=http://172.22.4.22:8082
NUXT_APP_BASE_URL=/aichat
NUXT_PROXY_TARGET=http://172.22.4.22/aichat
NODE_ENV=development

# Dev login email (only used in development)
NUXT_PUBLIC_DEV_LOGIN_EMAIL=

# Transcription Service (Hugging Face Spaces)
# Use space identifier format: username/space-name
NUXT_PUBLIC_TRANSCRIPTION_SERVICE_URL=harkairt/whisper-stt-hf
NUXT_PUBLIC_TRANSCRIPTION_API_KEY=your-api-key-here
# HF Token for private spaces (get from https://huggingface.co/settings/tokens)
NUXT_PUBLIC_HF_TOKEN=hf_xxxxx
'@

$envFiles['staging'] = @'
# API Configuration
NUXT_PUBLIC_API_BASE_URL=https://innochat.hu/staging/
NUXT_APP_BASE_URL=/staging/
NUXT_PROXY_TARGET=https://innochat.hu/staging/
NODE_ENV=development

# Dev login email (only used in development)
NUXT_PUBLIC_DEV_LOGIN_EMAIL=

# Transcription Service (Hugging Face Spaces)
# Use space identifier format: username/space-name
NUXT_PUBLIC_TRANSCRIPTION_SERVICE_URL=harkairt/whisper-stt-hf
NUXT_PUBLIC_TRANSCRIPTION_API_KEY=your-api-key-here
# HF Token for private spaces (get from https://huggingface.co/settings/tokens)
NUXT_PUBLIC_HF_TOKEN=hf_xxxxx
'@

$envFiles['prod'] = @'
# API Configuration
NUXT_PUBLIC_API_BASE_URL=https://innochat.hu
NUXT_APP_BASE_URL=
NUXT_PROXY_TARGET=https://innochat.hu
NODE_ENV=development

# Dev login email (only used in development)
NUXT_PUBLIC_DEV_LOGIN_EMAIL=

# Transcription Service (Hugging Face Spaces)
# Use space identifier format: username/space-name
NUXT_PUBLIC_TRANSCRIPTION_SERVICE_URL=harkairt/whisper-stt-hf
NUXT_PUBLIC_TRANSCRIPTION_API_KEY=your-api-key-here
# HF Token for private spaces (get from https://huggingface.co/settings/tokens)
NUXT_PUBLIC_HF_TOKEN=hf_xxxxx
'@

# Base URL that nuxt.config.ts derives from NUXT_APP_BASE_URL for each environment.
$expectedBase = @{
  dev     = '/aichat/'
  staging = '/staging/'
  prod    = '/'
}

# What each artifact runs and which directory is the deployable payload. `generate` ships only
# the static public tree; `build` ships the whole .output because the Nitro server lives in
# .output\server and is launched via the commands in .output\nitro.json.
$artifactSpec = @{
  generate = @{ NpmScript = 'generate'; SourceKey = 'public'; Describes = '.output\public (static)' }
  build    = @{ NpmScript = 'build'; SourceKey = 'output'; Describes = '.output (node-server)' }
}

# --- helpers -----------------------------------------------------------------

function Write-Step {
  param([string]$Message)
  Write-Host ''
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Write-Detail {
  param([string]$Message)
  Write-Host "    $Message" -ForegroundColor DarkGray
}

function Invoke-Native {
  param(
    [Parameter(Mandatory)][string]$Command,
    [string[]]$Arguments = @()
  )
  Write-Detail "$Command $($Arguments -join ' ')"
  & $Command @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "'$Command $($Arguments -join ' ')' failed with exit code $LASTEXITCODE."
  }
}

function Get-GitOutput {
  param([string[]]$Arguments)
  $output = & git -C $repoRoot @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "'git $($Arguments -join ' ')' failed with exit code $LASTEXITCODE."
  }
  return $output
}

function Write-EnvFile {
  param(
    [Parameter(Mandatory)][string]$Path,
    [Parameter(Mandatory)][string]$Content
  )
  # Must be UTF-8 *without* BOM: a BOM ends up glued to the first key name and dotenv
  # silently drops that variable. Out-File/Set-Content are not reliable here.
  $normalized = (($Content -replace "`r`n", "`n").TrimEnd()) + "`n"
  [System.IO.File]::WriteAllText($Path, $normalized, (New-Object System.Text.UTF8Encoding($false)))
}

function Remove-DirectoryIfPresent {
  param([string]$Path)
  if (Test-Path -LiteralPath $Path) {
    Remove-Item -LiteralPath $Path -Recurse -Force -Confirm:$false
  }
}

function Assert-CopyComplete {
  param(
    [string]$Source,
    [string]$Target,
    [string]$Label
  )
  # Not a count comparison: `nuxt build` puts ~49 directory junctions under
  # .output\server\node_modules (Nitro's .nitro store links packages to each other).
  # Get-ChildItem does not descend into reparse points but Copy-Item follows them, so the
  # target legitimately ends up with MORE files than the source reports. A self-contained,
  # dereferenced folder is what we want to ship - what must hold is that every source file
  # arrived, so check relative paths instead.
  # Relative paths come from the provider rather than string arithmetic on $Source: the caller's
  # path may be an 8.3 short form, differently cased, or trailing-slashed compared to what
  # Get-ChildItem reports, and slicing by length silently produces wrong relative paths.
  Push-Location -LiteralPath $Source
  try {
    $sourceFiles = @(Get-ChildItem -LiteralPath . -Recurse -File -Force |
        ForEach-Object { Resolve-Path -LiteralPath $_.FullName -Relative })
  }
  finally {
    Pop-Location
  }

  $missing = New-Object System.Collections.Generic.List[string]
  foreach ($rel in $sourceFiles) {
    if (-not (Test-Path -LiteralPath (Join-Path $Target $rel))) {
      $missing.Add($rel) | Out-Null
      if ($missing.Count -ge 5) { break }
    }
  }
  if ($missing.Count -gt 0) {
    throw "[$Label] Incomplete copy - these files are missing from ${Target}: $($missing -join '; ')"
  }
  return $sourceFiles.Count
}

function Assert-BaseUrl {
  param(
    [string]$IndexPath,
    [string]$ExpectedBase,
    [string]$EnvName
  )
  $html = Get-Content -LiteralPath $IndexPath -Raw
  $assetRefs = [regex]::Matches($html, '(?:src|href)="([^"]*?)_nuxt/')
  if ($assetRefs.Count -eq 0) {
    Write-Warning "[$EnvName] No _nuxt asset reference found in index.html - base URL could not be verified."
    return
  }
  $found = @($assetRefs | ForEach-Object { $_.Groups[1].Value } | Sort-Object -Unique)
  if ($found.Count -ne 1 -or $found[0] -ne $ExpectedBase) {
    throw "[$EnvName] Wrong base URL in the build: expected '$ExpectedBase', found '$($found -join "', '")'. The .env was most likely not picked up - nothing was copied to the deploy folder."
  }
  Write-Detail "base URL verified: $ExpectedBase"
}

function Write-DevArtifactWarning {
  param([string]$PublicDir, [string]$EnvName)

  if (Test-Path -LiteralPath (Join-Path $PublicDir 'dev')) {
    Write-Warning "[$EnvName] The build contains a /dev route - dev-only pages were not excluded (check NODE_ENV handling)."
    return
  }
  $chunkDir = Join-Path $PublicDir '_nuxt'
  if (-not (Test-Path -LiteralPath $chunkDir)) { return }

  $leak = Get-ChildItem -LiteralPath $chunkDir -Filter '*.js' -File |
    Select-String -Pattern 'dev-gallery' -SimpleMatch -List |
    Select-Object -First 1
  if ($leak) {
    Write-Warning "[$EnvName] Dev gallery code found in $($leak.Filename) - dev-only assets were bundled into the build."
  }
}

# --- validate ----------------------------------------------------------------

if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw 'git was not found on PATH.' }
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { throw 'npm was not found on PATH.' }

Write-Host "InnoChat deploy build" -ForegroundColor Green
Write-Detail "repo        : $repoRoot"
Write-Detail "environments: $($Environments -join ', ')"
Write-Detail "artifacts   : $($Artifacts -join ', ')"
Write-Detail "deploy root : $dateRoot"

# --- prepare -----------------------------------------------------------------

# Node inspector flags leaking in from the VS Code terminal break the nuxt build; this is
# the same reason package.json keeps the `dev:plain` / `clean:plain` variants.
$savedNodeOptions = $env:NODE_OPTIONS
$savedInspectorOptions = $env:VSCODE_INSPECTOR_OPTIONS
if (Test-Path Env:NODE_OPTIONS) { Remove-Item Env:NODE_OPTIONS }
if (Test-Path Env:VSCODE_INSPECTOR_OPTIONS) { Remove-Item Env:VSCODE_INSPECTOR_OPTIONS }

# .env is gitignored, so this backup is its only copy while the script rewrites it.
$envBackup = $null
if (Test-Path -LiteralPath $envPath) {
  $envBackup = Join-Path $repoRoot ('.env.bak.' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
  Copy-Item -LiteralPath $envPath -Destination $envBackup -Force
  Write-Detail "existing .env backed up to $(Split-Path -Leaf $envBackup)"
}

$results = @()

Push-Location -LiteralPath $repoRoot
try {
  # --- git sync --------------------------------------------------------------

  $headBefore = $null
  $headAfter = $null

  if ($SkipGit) {
    Write-Step 'Skipping git sync (-SkipGit) - building from the current working tree'
  }
  else {
    Write-Step 'Syncing develop'
    $dirty = Get-GitOutput @('status', '--porcelain')
    if ($dirty) {
      Write-Warning "Working tree has uncommitted changes; they will be included in the build:`n$($dirty -join "`n")"
    }
    Invoke-Native 'git' @('-C', $repoRoot, 'switch', 'develop')
    $headBefore = (Get-GitOutput @('rev-parse', 'HEAD')).Trim()
    Invoke-Native 'git' @('-C', $repoRoot, 'pull', '--ff-only')
    $headAfter = (Get-GitOutput @('rev-parse', 'HEAD')).Trim()
    if ($headBefore -eq $headAfter) {
      Write-Detail "already up to date at $headAfter"
    }
    else {
      Write-Detail "updated $headBefore -> $headAfter"
    }
  }

  # --- dependencies ----------------------------------------------------------

  $needInstall = [bool]$Install
  if (-not (Test-Path -LiteralPath (Join-Path $repoRoot 'node_modules'))) {
    $needInstall = $true
  }
  if ($headBefore -and $headAfter -and $headBefore -ne $headAfter) {
    $changedFiles = Get-GitOutput @('diff', '--name-only', $headBefore, $headAfter)
    if ($changedFiles | Where-Object { $_ -eq 'package-lock.json' }) {
      Write-Detail 'package-lock.json changed in the pull'
      $needInstall = $true
    }
  }
  if ($needInstall) {
    Write-Step 'Installing dependencies (npm ci)'
    Invoke-Native 'npm' @('ci')
  }

  # --- per-environment builds ------------------------------------------------

  foreach ($name in $Environments) {
    Write-Step "Environment '$name'"

    Write-EnvFile -Path $envPath -Content $envFiles[$name]
    Write-Detail ".env written (base $($expectedBase[$name]))"

    $envRoot = Join-Path $dateRoot $name
    # Packages used to be written straight into <date>\<env>\; loose files at that level mean a
    # folder from the old layout. Drop it so the two artifact folders are not mixed with strays.
    if (Test-Path -LiteralPath $envRoot) {
      if (@(Get-ChildItem -LiteralPath $envRoot -File -Force).Count -gt 0) {
        Write-Detail 'removing package from the previous (flat) layout'
        Remove-DirectoryIfPresent $envRoot
      }
    }

    foreach ($artifact in $Artifacts) {
      $spec = $artifactSpec[$artifact]
      $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
      Write-Step "  $name / $artifact  ->  $($spec.Describes)"

      # baseURL is baked into index.html, sw.js and the manifest, and chunk names are hashed -
      # a stale .output would mix the previous artifact's files into this package.
      Remove-DirectoryIfPresent $outputDir
      Remove-DirectoryIfPresent $nuxtDir
      Write-Detail '.output and .nuxt cleaned'

      Invoke-Native 'npm' @('run', $spec.NpmScript)

      # Both presets emit .output\public\index.html with the base URL baked in, so the same
      # check guards both artifacts.
      $indexPath = Join-Path $publicDir 'index.html'
      if (-not (Test-Path -LiteralPath $indexPath)) {
        throw "[$name/$artifact] Build finished but $indexPath is missing."
      }
      Assert-BaseUrl -IndexPath $indexPath -ExpectedBase $expectedBase[$name] -EnvName "$name/$artifact"
      Write-DevArtifactWarning -PublicDir $publicDir -EnvName "$name/$artifact"

      if ($spec.SourceKey -eq 'public') { $source = $publicDir } else { $source = $outputDir }
      if ($artifact -eq 'build' -and -not (Test-Path -LiteralPath (Join-Path $outputDir 'server\index.mjs'))) {
        throw "[$name/$artifact] .output\server\index.mjs is missing - the server bundle was not produced."
      }

      $target = Join-Path $envRoot $artifact
      Remove-DirectoryIfPresent $target
      New-Item -ItemType Directory -Path $target -Force | Out-Null
      Copy-Item -Path (Join-Path $source '*') -Destination $target -Recurse -Force

      $sourceCount = Assert-CopyComplete -Source $source -Target $target -Label "$name/$artifact"

      $stopwatch.Stop()
      $files = @(Get-ChildItem -LiteralPath $target -Recurse -File -Force)
      $bytes = ($files | Measure-Object -Property Length -Sum).Sum
      if ($files.Count -ne $sourceCount) {
        Write-Detail "copied $($files.Count) files to $target ($sourceCount before resolving junctions)"
      }
      else {
        Write-Detail "copied $($files.Count) files to $target"
      }

      $results += [pscustomobject]@{
        Environment = $name
        Artifact    = $artifact
        Base        = $expectedBase[$name]
        Files       = $files.Count
        SizeMB      = [math]::Round($bytes / 1MB, 1)
        Duration    = $stopwatch.Elapsed.ToString('mm\:ss')
        Path        = $target
      }
    }
  }
}
finally {
  Pop-Location
  if ($envBackup -and (Test-Path -LiteralPath $envBackup)) {
    Copy-Item -LiteralPath $envBackup -Destination $envPath -Force
    Remove-Item -LiteralPath $envBackup -Force
    Write-Host ''
    Write-Host '.env restored from backup.' -ForegroundColor DarkGray
  }
  if ($null -ne $savedNodeOptions) { $env:NODE_OPTIONS = $savedNodeOptions }
  if ($null -ne $savedInspectorOptions) { $env:VSCODE_INSPECTOR_OPTIONS = $savedInspectorOptions }
}

# --- summary -----------------------------------------------------------------

Write-Step 'Done'
$results | Format-Table -AutoSize Environment, Artifact, Base, Files, SizeMB, Duration, Path
