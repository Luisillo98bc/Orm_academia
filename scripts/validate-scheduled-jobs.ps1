param(
  [ValidateSet('inline', 'worker')]
  [string]$Architecture = 'inline',
  [string]$EnvFile = '.\backend\.env'
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath $EnvFile)) {
  throw "No existe el archivo de entorno: $EnvFile"
}

$values = @{}
Get-Content -LiteralPath $EnvFile | ForEach-Object {
  if ($_ -match '^\s*([^#=]+?)\s*=\s*(.*)\s*$') {
    $key = $Matches[1].Trim()
    $value = $Matches[2].Trim().Trim('"').Trim("'")
    $values[$key] = $value
  }
}

$enabled = $values['ENABLE_SCHEDULED_JOBS']
$mode = $values['SCHEDULED_JOBS_MODE']

if ($enabled -ne 'true') {
  throw 'ENABLE_SCHEDULED_JOBS debe estar en true para producción.'
}

if ($Architecture -eq 'inline' -and $mode -ne 'inline') {
  throw "Arquitectura inline requiere SCHEDULED_JOBS_MODE=inline; valor actual: '$mode'"
}

if ($Architecture -eq 'worker' -and $mode -ne 'disabled') {
  throw "Arquitectura worker requiere SCHEDULED_JOBS_MODE=disabled en el backend HTTP; valor actual: '$mode'"
}

if ($Architecture -eq 'worker' -and -not (Test-Path -LiteralPath '.\docker-compose.worker.yml')) {
  throw 'No se encontró docker-compose.worker.yml para aislar el worker.'
}

$smtpKeys = @('MAIL_HOST', 'MAIL_PORT', 'MAIL_USER', 'MAIL_PASS', 'MAIL_FROM')
$missing = @($smtpKeys | Where-Object { -not $values[$_] })
if ($missing.Count -gt 0) {
  throw "Faltan variables SMTP para jobs activos: $($missing -join ', ')"
}

Write-Host "Configuración válida: arquitectura $Architecture; jobs activos; SMTP configurado."
if ($Architecture -eq 'inline') {
  Write-Host 'El backend HTTP será la única instancia que ejecuta los jobs.'
} else {
  Write-Host 'El backend HTTP queda disabled y docker-compose.worker.yml deja al worker como único ejecutor.'
}
