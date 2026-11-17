[CmdletBinding()]
param(
  [switch]$Apply
)

$ErrorActionPreference = 'Stop'
$workspace = Split-Path -Parent $PSScriptRoot
$composeFile = Join-Path $workspace 'docker-compose.yml'

$backendContainer = docker compose -f $composeFile ps -q backend
if (-not $backendContainer) {
  throw 'El backend no está en ejecución. Levántalo primero con: docker compose up -d --build backend'
}

$arguments = @('exec', '-T', 'backend', 'node', 'scripts/migrate-legacy-private-files.mjs')
if ($Apply) {
  $arguments += '--apply'
}

Write-Output $(if ($Apply) {
    'Se aplicará la migración dentro del volumen Docker. Los originales no se borrarán.'
  } else {
    'Se ejecutará una simulación de solo lectura dentro del volumen Docker.'
  })

& docker compose -f $composeFile @arguments
if ($LASTEXITCODE -ne 0) {
  throw "La migración terminó con código $LASTEXITCODE"
}
