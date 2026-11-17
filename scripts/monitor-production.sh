#!/usr/bin/env bash
set -u

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

read_env_value() {
  local key="$1"
  sed -n "s/^${key}=//p" deploy/.env.production | tail -n 1
}

compose=(docker compose
  --env-file deploy/.env.production
  --env-file deploy/.env.tunnel
  -f docker-compose.yml
  -f compose.production.yaml)

alerts=()

add_alert() {
  alerts+=("$1")
}

check_service() {
  local service="$1"
  local needs_health="$2"
  local container_id state health

  container_id="$("${compose[@]}" ps -q "$service" | head -n 1)"
  if [ -z "$container_id" ]; then
    add_alert "$service: contenedor no encontrado"
    return
  fi

  state="$(docker inspect --format '{{.State.Status}}' "$container_id")"
  health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$container_id")"
  if [ "$state" != "running" ]; then
    add_alert "$service: estado=$state"
  elif [ "$needs_health" = "yes" ] && [ "$health" != "healthy" ]; then
    add_alert "$service: health=$health"
  fi
}

check_service db yes
check_service minio yes
check_service clamav no
check_service backend yes
check_service frontend yes
check_service cloudflared no

init_id="$("${compose[@]}" ps -aq minio-init | head -n 1)"
if [ -z "$init_id" ]; then
  add_alert "minio-init: contenedor no encontrado"
else
  init_state="$(docker inspect --format '{{.State.Status}}' "$init_id")"
  init_code="$(docker inspect --format '{{.State.ExitCode}}' "$init_id")"
  if [ "$init_state" != "exited" ] || [ "$init_code" != "0" ]; then
    add_alert "minio-init: estado=$init_state exit_code=$init_code"
  fi
fi

disk_path="$(read_env_value MONITOR_DISK_PATH)"
disk_path="${disk_path:-/}"
disk_limit="$(read_env_value DISK_ALERT_PERCENT)"
disk_limit="${disk_limit:-80}"
disk_used="$(df -P "$disk_path" | awk 'NR==2 {gsub("%", "", $5); print $5}')"
if ! [[ "$disk_used" =~ ^[0-9]+$ ]] || ! [[ "$disk_limit" =~ ^[0-9]+$ ]]; then
  add_alert "disco: no se pudo interpretar el uso de $disk_path"
elif [ "$disk_used" -ge "$disk_limit" ]; then
  add_alert "disco: ${disk_used}% usado en $disk_path (limite ${disk_limit}%)"
fi

timestamp="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
if [ "${#alerts[@]}" -eq 0 ]; then
  echo "$timestamp OK academia production"
  exit 0
fi

message="$timestamp ALERT academia production: $(IFS='; '; echo "${alerts[*]}")"
echo "$message" >&2

webhook="$(read_env_value MONITOR_ALERT_WEBHOOK_URL)"
if [ -n "$webhook" ] && command -v curl >/dev/null 2>&1; then
  escaped="$(printf '%s' "$message" | sed 's/\\/\\\\/g; s/"/\\"/g')"
  curl -fsS -X POST "$webhook" \
    -H 'Content-Type: application/json' \
    --data "{\"text\":\"$escaped\"}" >/dev/null || \
    echo "$timestamp WARN no se pudo enviar el webhook de monitoreo" >&2
fi

exit 1
