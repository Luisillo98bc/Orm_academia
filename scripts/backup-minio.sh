#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUTPUT_DIR="${1:-$ROOT_DIR/backups/minio}"
mkdir -p "$OUTPUT_DIR"

compose=(
  docker compose
  --env-file "$ROOT_DIR/deploy/.env.production"
  -f "$ROOT_DIR/docker-compose.yml"
  -f "$ROOT_DIR/compose.production.yaml"
)

"${compose[@]}" ps --status running minio >/dev/null

"${compose[@]}" run --rm --no-deps \
  -v "$OUTPUT_DIR:/backup" \
  --entrypoint /bin/sh minio-init \
  -ec '
    mc alias set local http://minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null
    for bucket in avatars courses cohorts materials vouchers deliverables; do
      mkdir -p "/backup/$bucket"
      mc mirror --overwrite "local/$bucket" "/backup/$bucket"
    done
  '

manifest="$OUTPUT_DIR/manifest-$(date -u +%Y%m%dT%H%M%SZ).txt"
{
  echo "created_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  for bucket in avatars courses cohorts materials vouchers deliverables; do
    printf '%s=' "$bucket"
    find "$OUTPUT_DIR/$bucket" -type f | wc -l | tr -d ' '
  done
} > "$manifest"

echo "Backup MinIO creado en $OUTPUT_DIR"
