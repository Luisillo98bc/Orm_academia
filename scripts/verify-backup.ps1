param(
  [Parameter(Mandatory = $true)][string]$BackupFile
)

$ErrorActionPreference = "Stop"
$resolved = (Resolve-Path $BackupFile).Path
if ((Get-Item $resolved).Length -lt 1024) { throw "El archivo no es un respaldo válido" }
$checksumFile = "$resolved.sha256"
if (Test-Path -LiteralPath $checksumFile) {
  $expected = (Get-Content -LiteralPath $checksumFile -Raw).Trim().Split(' ')[0].ToUpperInvariant()
  $actual = (Get-FileHash -LiteralPath $resolved -Algorithm SHA256).Hash.ToUpperInvariant()
  if ($expected -ne $actual) { throw "La suma SHA-256 del respaldo no coincide" }
}
$workspace = Split-Path -Parent $PSScriptRoot
$composeFile = Join-Path $workspace "docker-compose.yml"
$container = docker compose -f $composeFile ps -q db
if ($LASTEXITCODE -ne 0) { throw "No se pudo consultar PostgreSQL en Docker" }
if (-not $container) { throw "PostgreSQL no está en ejecución" }
$testDatabase = "academia_restore_$([guid]::NewGuid().ToString('N'))"
$containerFile = "/tmp/$testDatabase.dump"
$created = $false
try {
  docker cp $resolved "${container}:${containerFile}"
  if ($LASTEXITCODE -ne 0) { throw "No se pudo copiar el respaldo para verificarlo" }
  docker exec $container createdb -U postgres $testDatabase
  if ($LASTEXITCODE -ne 0) { throw "No se pudo crear la base de verificación" }
  $created = $true
  docker exec $container pg_restore -U postgres -d $testDatabase --exit-on-error $containerFile
  if ($LASTEXITCODE -ne 0) { throw "No se pudo restaurar el respaldo" }
  $objects = docker exec $container pg_restore -l $containerFile
  if ($LASTEXITCODE -ne 0) { throw "No se pudo inspeccionar el respaldo" }
  if (-not ($objects -match 'TABLE DATA.*users')) { throw "La restauraciÃ³n no contiene la tabla de usuarios" }
  $migrationCount = docker exec $container psql -U postgres -d $testDatabase -tAc "SELECT COUNT(*) FROM _prisma_migrations;"
  if ($LASTEXITCODE -ne 0) { throw "No se pudieron comprobar las migraciones restauradas" }
  if ([int]$migrationCount.Trim() -lt 1) {
    throw "La restauración no contiene migraciones de Prisma"
  }
  Write-Output "Restauración verificada correctamente ($($migrationCount.Trim()) migraciones)"
}
finally {
  if ($created) { docker exec $container dropdb -U postgres --if-exists $testDatabase 2>$null }
  docker exec $container rm -f $containerFile 2>$null
}
