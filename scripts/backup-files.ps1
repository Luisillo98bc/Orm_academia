param([string]$OutputDirectory = 'backups')

$ErrorActionPreference = 'Stop'
$workspace = Split-Path -Parent $PSScriptRoot
$directory = Join-Path $workspace $OutputDirectory
New-Item -ItemType Directory -Force -Path $directory | Out-Null
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$target = Join-Path $directory "academia-files-$timestamp.tar.gz"
$temporary = "/tmp/academia-files-$([guid]::NewGuid().ToString('N')).tar.gz"
$container = docker compose -f (Join-Path $workspace 'docker-compose.yml') ps -q backend
if ($LASTEXITCODE -ne 0 -or -not $container) { throw 'El backend no está disponible para respaldar archivos' }
try {
  docker exec $container tar -czf $temporary -C /app/backend uploads private-uploads legacy-host-uploads
  if ($LASTEXITCODE -ne 0) { throw 'No se pudo crear el respaldo de archivos' }
  docker exec $container tar -tzf $temporary | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'No se pudo verificar el respaldo de archivos' }
  docker cp "${container}:${temporary}" $target
  if ($LASTEXITCODE -ne 0) { throw 'No se pudo copiar el respaldo de archivos' }
  $hash = (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash
  Set-Content -LiteralPath "$target.sha256" -Value "$hash  $(Split-Path -Leaf $target)" -Encoding ascii
  Write-Output $target
} finally {
  docker exec $container rm -f $temporary | Out-Null
}
