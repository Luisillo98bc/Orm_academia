param(
  [string]$OutputDirectory = "backups",
  [int]$RetentionDays = 30
)

$ErrorActionPreference = "Stop"
$workspace = Split-Path -Parent $PSScriptRoot
$targetDirectory = Join-Path $workspace $OutputDirectory
New-Item -ItemType Directory -Force -Path $targetDirectory | Out-Null
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$target = Join-Path $targetDirectory "academia_virtual-$timestamp.dump"

$container = docker compose -f (Join-Path $workspace "docker-compose.yml") ps -q db
if ($LASTEXITCODE -ne 0) { throw "No se pudo consultar PostgreSQL en Docker" }
if (-not $container) { throw "PostgreSQL no está en ejecución" }
docker exec $container pg_dump -U postgres -d academia_virtual -Fc -f /tmp/academia-backup.dump
if ($LASTEXITCODE -ne 0) { throw "No se pudo crear el respaldo de PostgreSQL" }
docker cp "${container}:/tmp/academia-backup.dump" $target
if ($LASTEXITCODE -ne 0) { throw "No se pudo copiar el respaldo de PostgreSQL" }
docker exec $container rm -f /tmp/academia-backup.dump
if ($LASTEXITCODE -ne 0) { throw "No se pudo eliminar el archivo temporal del contenedor" }
if ((Get-Item $target).Length -lt 1024) { throw "El respaldo generado parece incompleto" }
$hash = (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash
Set-Content -LiteralPath "$target.sha256" -Value "$hash  $(Split-Path -Leaf $target)" -Encoding ascii
$manifest = [ordered]@{ createdAt = (Get-Date).ToUniversalTime().ToString('o'); file = (Split-Path -Leaf $target); sizeBytes = (Get-Item $target).Length; sha256 = $hash; database = 'academia_virtual' } | ConvertTo-Json
Set-Content -LiteralPath "$target.json" -Value $manifest -Encoding utf8
if ($RetentionDays -gt 0) { Get-ChildItem -LiteralPath $targetDirectory -Filter 'academia_virtual-*.dump' | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$RetentionDays) } | Remove-Item -Force }
Write-Output $target
