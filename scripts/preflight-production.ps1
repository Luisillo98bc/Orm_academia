param(
  [ValidateSet('inline')]
  [string]$Architecture = 'inline',
  [string]$EnvFile = '.\deploy\.env.production',
  [string]$TunnelEnvFile = '.\deploy\.env.tunnel'
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath $EnvFile)) {
  throw "No existe el archivo de entorno de producción: $EnvFile"
}
if (-not (Test-Path -LiteralPath $TunnelEnvFile)) {
  throw "No existe el archivo de entorno del túnel: $TunnelEnvFile"
}

$values = @{}
$validationErrors = [System.Collections.Generic.List[string]]::new()
Get-Content -LiteralPath $EnvFile | ForEach-Object {
  if ($_ -match '^\s*([^#=]+?)\s*=\s*(.*)\s*$') {
    $key = $Matches[1].Trim()
    $value = $Matches[2].Trim().Trim('"').Trim("'")
    $values[$key] = $value
  }
}

function Require-Value([string]$Key) {
  $value = $values[$Key]
  if ([string]::IsNullOrWhiteSpace($value) -or $value -match '(?i)\[.*(tu-|ref|password)|xxxxxxxx|configure_me|genera-|cambia-este-|^tu-') {
    throw "Configura $Key en $EnvFile. El valor no puede estar vacío ni ser un placeholder."
  }
  return $value
}

if ($values['NODE_ENV'] -ne 'production') { throw 'NODE_ENV debe ser production.' }
if ($values['COOKIE_SECURE'] -ne 'true') { throw 'COOKIE_SECURE debe ser true.' }
if ($values['PAYMENTS_MODE'] -ne 'cash') { throw 'PAYMENTS_MODE debe permanecer en cash por ahora.' }
if ($values['STORAGE_PROVIDER'] -ne 'minio') { throw 'STORAGE_PROVIDER debe ser minio en esta arquitectura.' }
if ($values['CLAMAV_REQUIRED'] -ne 'true') { throw 'CLAMAV_REQUIRED debe ser true en producción.' }
if ($values['SCHEDULED_JOBS_MODE'] -ne 'inline') { throw 'La producción inicial usa SCHEDULED_JOBS_MODE=inline.' }
if ($values['ENABLE_SCHEDULED_JOBS'] -ne 'true') { throw 'ENABLE_SCHEDULED_JOBS debe ser true.' }

foreach ($key in @(
  'POSTGRES_PASSWORD', 'DATABASE_URL', 'DIRECT_URL', 'JWT_SECRET', 'TWO_FACTOR_ENCRYPTION_KEY', 'CORS_ORIGIN', 'FRONTEND_URL',
  'GOOGLE_CLIENT_ID', 'NEXT_PUBLIC_API_URL', 'NEXT_PUBLIC_SITE_URL', 'NEXT_PUBLIC_WS_URL',
  'NEXT_PUBLIC_GOOGLE_CLIENT_ID', 'INITIAL_ADMIN_EMAIL', 'INITIAL_ADMIN_PASSWORD',
  'CLAMAV_REQUIRED', 'CLAMAV_HOST', 'CLAMAV_PORT', 'STORAGE_BUCKET_QUOTA_BYTES',
  'MINIO_ROOT_USER', 'MINIO_ROOT_PASSWORD', 'MINIO_ACCESS_KEY', 'MINIO_SECRET_KEY',
  'MAIL_HOST', 'MAIL_PORT', 'MAIL_USER', 'MAIL_PASS', 'MAIL_FROM'
)) {
  try {
    Require-Value $key | Out-Null
  } catch {
    $validationErrors.Add($_.Exception.Message)
  }
}

if ($validationErrors.Count -gt 0) {
  throw ("Preflight detenido. Corrige estas variables:`n" + ($validationErrors -join "`n"))
}

[long]$storageBucketQuotaBytes = 0
if (-not [long]::TryParse($values['STORAGE_BUCKET_QUOTA_BYTES'], [ref]$storageBucketQuotaBytes) -or $storageBucketQuotaBytes -le 0) {
  throw 'STORAGE_BUCKET_QUOTA_BYTES debe ser un entero mayor que 0.'
}

if ($values['JWT_SECRET'].Length -lt 32) { throw 'JWT_SECRET debe tener al menos 32 caracteres.' }
if ($values['JWT_SECRET'] -eq $values['INITIAL_ADMIN_PASSWORD']) { throw 'JWT_SECRET y INITIAL_ADMIN_PASSWORD deben ser secretos distintos.' }
if ($values['TWO_FACTOR_ENCRYPTION_KEY'].Length -lt 32) { throw 'TWO_FACTOR_ENCRYPTION_KEY debe tener al menos 32 caracteres.' }
if ($values['TWO_FACTOR_ENCRYPTION_KEY'] -eq $values['JWT_SECRET']) { throw 'TWO_FACTOR_ENCRYPTION_KEY y JWT_SECRET deben ser secretos distintos.' }
if ($values['CORS_ORIGIN'] -notmatch '^https://') { throw 'CORS_ORIGIN debe usar HTTPS.' }
if ($values['FRONTEND_URL'] -notmatch '^https://') { throw 'FRONTEND_URL debe usar HTTPS.' }
if ($values['CORS_ORIGIN'].TrimEnd('/') -ne $values['FRONTEND_URL'].TrimEnd('/')) { throw 'CORS_ORIGIN y FRONTEND_URL deben coincidir con el dominio público.' }
if ($values['NEXT_PUBLIC_SITE_URL'].TrimEnd('/') -ne $values['FRONTEND_URL'].TrimEnd('/')) { throw 'NEXT_PUBLIC_SITE_URL debe coincidir con FRONTEND_URL.' }
if ($values['NEXT_PUBLIC_API_URL'] -notmatch '^https://[^/?#]+/api/v1/?$') { throw 'NEXT_PUBLIC_API_URL debe usar HTTPS y terminar en /api/v1.' }
if ($values['NEXT_PUBLIC_WS_URL'].TrimEnd('/') -ne ($values['NEXT_PUBLIC_API_URL'] -replace '/api/v1/?$', '')) { throw 'NEXT_PUBLIC_WS_URL debe apuntar al origen de la API.' }
if ($values['NEXT_PUBLIC_GOOGLE_CLIENT_ID'] -ne $values['GOOGLE_CLIENT_ID']) { throw 'Los identificadores OAuth del frontend y backend deben coincidir.' }
if ($values['TRUST_PROXY_HOPS'] -notmatch '^[0-5]$') { throw 'TRUST_PROXY_HOPS debe ser un entero entre 0 y 5.' }
if ($values['INITIAL_ADMIN_PASSWORD'] -eq 'Admin@1234') {
  throw 'INITIAL_ADMIN_PASSWORD no puede ser la contraseña de desarrollo.'
}

$tunnelValues = @{}
Get-Content -LiteralPath $TunnelEnvFile | ForEach-Object {
  if ($_ -match '^\s*([^#=]+?)\s*=\s*(.*)\s*$') {
    $tunnelValues[$Matches[1].Trim()] = $Matches[2].Trim().Trim('"').Trim("'")
  }
}
if ([string]::IsNullOrWhiteSpace($tunnelValues['CLOUDFLARE_TUNNEL_TOKEN']) -or $tunnelValues['CLOUDFLARE_TUNNEL_TOKEN'] -match '(?i)\[.*(tu-|ref|password)|xxxxxxxx|configure_me|genera-|cambia-este-|^tu-') {
  throw "Configura CLOUDFLARE_TUNNEL_TOKEN en $TunnelEnvFile."
}

Write-Host "Preflight de producción correcto: arquitectura $Architecture."
Write-Host 'Variables y dominios comprobados sin mostrar secretos. La conectividad, OAuth, SMTP y restauración requieren sus pruebas de integración.'
