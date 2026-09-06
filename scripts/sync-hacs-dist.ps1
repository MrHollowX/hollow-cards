$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$sourceDirectory = Join-Path $projectRoot 'hollow-cards'
$distDirectory = Join-Path $projectRoot 'dist'

New-Item -ItemType Directory -Force -Path $distDirectory | Out-Null
Copy-Item -Path (Join-Path $sourceDirectory '*.js') -Destination $distDirectory -Force

Write-Host "Synced Hollow Cards modules from hollow-cards/ to dist/."
