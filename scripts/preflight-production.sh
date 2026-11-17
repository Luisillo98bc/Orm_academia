#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${1:-$ROOT_DIR/deploy/.env.production}"
TUNNEL_FILE="${2:-$ROOT_DIR/deploy/.env.tunnel}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "No existe $ENV_FILE" >&2
  exit 1
fi
if [[ ! -f "$TUNNEL_FILE" ]]; then
  echo "No existe $TUNNEL_FILE" >&2
  exit 1
fi

value() {
  local key="$1"
  sed -n "s/^${key}=//p" "$ENV_FILE" | tail -n 1 | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//"
}

tunnel_value() {
  local key="$1"
  sed -n "s/^${key}=//p" "$TUNNEL_FILE" | tail -n 1 | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//"
}

is_placeholder() {
  [[ -z "$1" || "$1" =~ genera- || "$1" =~ cambia-este- || "$1" =~ tu- || "$1" =~ xxxxxxxx || "$1" =~ configure_me ]]
}

require_value() {
  local key="$1"
  local current
  current="$(value "$key")"
  if is_placeholder "$current"; then
    echo "Configura $key en $ENV_FILE; no se muestran secretos." >&2
    exit 1
  fi
}

[[ "$(value NODE_ENV)" == "production" ]] || { echo "NODE_ENV debe ser production." >&2; exit 1; }
[[ "$(value COOKIE_SECURE)" == "true" ]] || { echo "COOKIE_SECURE debe ser true." >&2; exit 1; }
[[ "$(value PAYMENTS_MODE)" == "cash" ]] || { echo "PAYMENTS_MODE debe ser cash." >&2; exit 1; }
[[ "$(value CLAMAV_REQUIRED)" == "true" ]] || { echo "CLAMAV_REQUIRED debe ser true." >&2; exit 1; }
[[ "$(value STORAGE_PROVIDER)" == "minio" ]] || { echo "STORAGE_PROVIDER debe ser minio." >&2; exit 1; }
[[ "$(value ENABLE_SCHEDULED_JOBS)" == "true" ]] || { echo "ENABLE_SCHEDULED_JOBS debe ser true." >&2; exit 1; }
[[ "$(value SCHEDULED_JOBS_MODE)" == "inline" ]] || { echo "SCHEDULED_JOBS_MODE debe ser inline." >&2; exit 1; }
[[ "$(value CORS_ORIGIN)" == https://* ]] || { echo "CORS_ORIGIN debe usar HTTPS." >&2; exit 1; }
[[ "$(value FRONTEND_URL)" == https://* ]] || { echo "FRONTEND_URL debe usar HTTPS." >&2; exit 1; }

for key in \
  POSTGRES_PASSWORD DATABASE_URL DIRECT_URL JWT_SECRET TWO_FACTOR_ENCRYPTION_KEY CORS_ORIGIN FRONTEND_URL \
  GOOGLE_CLIENT_ID NEXT_PUBLIC_API_URL NEXT_PUBLIC_SITE_URL NEXT_PUBLIC_WS_URL \
  CLAMAV_REQUIRED CLAMAV_HOST CLAMAV_PORT STORAGE_BUCKET_QUOTA_BYTES \
  NEXT_PUBLIC_GOOGLE_CLIENT_ID INITIAL_ADMIN_EMAIL INITIAL_ADMIN_PASSWORD \
  MINIO_ROOT_USER MINIO_ROOT_PASSWORD MINIO_ACCESS_KEY MINIO_SECRET_KEY \
  MAIL_HOST MAIL_PORT MAIL_USER MAIL_PASS MAIL_FROM; do
  require_value "$key"
done

frontend_url="$(value FRONTEND_URL)"
cors_origin="$(value CORS_ORIGIN)"
site_url="$(value NEXT_PUBLIC_SITE_URL)"
[[ "${cors_origin%/}" == "${frontend_url%/}" ]] || { echo "CORS_ORIGIN y FRONTEND_URL deben coincidir." >&2; exit 1; }
[[ "${site_url%/}" == "${frontend_url%/}" ]] || { echo "NEXT_PUBLIC_SITE_URL debe coincidir con FRONTEND_URL." >&2; exit 1; }
[[ "$(value NEXT_PUBLIC_API_URL)" =~ ^https://[^/?#]+/api/v1/?$ ]] || { echo "NEXT_PUBLIC_API_URL debe usar HTTPS y terminar en /api/v1." >&2; exit 1; }
api_url="$(value NEXT_PUBLIC_API_URL)"
ws_url="$(value NEXT_PUBLIC_WS_URL)"
[[ "${api_url%/}" == "${ws_url%/}/api/v1" ]] || { echo "NEXT_PUBLIC_WS_URL debe apuntar al origen de la API." >&2; exit 1; }
[[ "$(value GOOGLE_CLIENT_ID)" == "$(value NEXT_PUBLIC_GOOGLE_CLIENT_ID)" ]] || { echo "Los identificadores OAuth deben coincidir." >&2; exit 1; }

storage_bucket_quota_bytes="$(value STORAGE_BUCKET_QUOTA_BYTES)"
[[ "$storage_bucket_quota_bytes" =~ ^[1-9][0-9]*$ ]] || {
  echo "STORAGE_BUCKET_QUOTA_BYTES debe ser un entero mayor que 0." >&2
  exit 1
}

[[ "$(value JWT_SECRET)" != "$(value INITIAL_ADMIN_PASSWORD)" ]] || {
  echo "JWT_SECRET y INITIAL_ADMIN_PASSWORD deben ser secretos distintos." >&2
  exit 1
}
jwt_two_factor_key="$(value TWO_FACTOR_ENCRYPTION_KEY)"
[[ "${#jwt_two_factor_key}" -ge 32 ]] || {
  echo "TWO_FACTOR_ENCRYPTION_KEY debe tener al menos 32 caracteres." >&2
  exit 1
}
[[ "$(value JWT_SECRET)" != "$jwt_two_factor_key" ]] || {
  echo "TWO_FACTOR_ENCRYPTION_KEY y JWT_SECRET deben ser secretos distintos." >&2
  exit 1
}
jwt_secret="$(value JWT_SECRET)"
[[ "${#jwt_secret}" -ge 32 ]] || {
  echo "JWT_SECRET debe tener al menos 32 caracteres." >&2
  exit 1
}
[[ "$(value INITIAL_ADMIN_PASSWORD)" != "Admin@1234" ]] || {
  echo "INITIAL_ADMIN_PASSWORD no puede ser la contraseña de desarrollo." >&2
  exit 1
}

proxy_hops="$(value TRUST_PROXY_HOPS)"
[[ "$proxy_hops" =~ ^[0-5]$ ]] || { echo "TRUST_PROXY_HOPS debe ser un entero entre 0 y 5." >&2; exit 1; }

is_placeholder "$(tunnel_value CLOUDFLARE_TUNNEL_TOKEN)" && {
  echo "Configura CLOUDFLARE_TUNNEL_TOKEN en $TUNNEL_FILE." >&2
  exit 1
}

echo "Preflight de configuración correcto. La conectividad, OAuth, SMTP y restauración requieren pruebas de integración."
