$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$sourceDirectory = Join-Path $projectRoot 'hollow-cards'
$distDirectory = Join-Path $projectRoot 'dist'

New-Item -ItemType Directory -Force -Path $distDirectory | Out-Null
$sourceFiles = Get-ChildItem -LiteralPath $sourceDirectory -Filter '*.js' | Sort-Object Name
Copy-Item -Path $sourceFiles.FullName -Destination $distDirectory -Force

$entryPointPath = Join-Path $distDirectory 'hollow-cards.js'
$entryPointLines = @(
  '/*'
  ' * Hollow Cards 1.0.0 HACS entry point.'
  ' *'
  ' * The individual files remain separate so existing dashboard resources stay'
  ' * compatible. HACS downloads the JavaScript files in dist/ and this entry'
  ' * point loads the complete card set from one Lovelace module resource.'
  ' */'
  ''
  ($sourceFiles | ForEach-Object { "import './$($_.Name)';" })
)
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText(
  $entryPointPath,
  (($entryPointLines -join [Environment]::NewLine) + [Environment]::NewLine),
  $utf8NoBom
)

$legacyEntryPointPath = Join-Path $distDirectory 'hollow-cards-set.js'
if (Test-Path -LiteralPath $legacyEntryPointPath) {
  Remove-Item -LiteralPath $legacyEntryPointPath -Force
}

Write-Host "Synced Hollow Cards 1.0.0 modules and entry point from hollow-cards/ to dist/."
