#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${1:?Uso: scripts/verify-minio-backup.sh /ruta/al/backup-minio}"
if [[ ! -d "$BACKUP_DIR" ]]; then
  echo "No existe el directorio de backup: $BACKUP_DIR" >&2
  exit 1
fi

for bucket in avatars courses cohorts materials vouchers deliverables; do
  if [[ ! -d "$BACKUP_DIR/$bucket" ]]; then
    echo "Falta el bucket $bucket en el backup" >&2
    exit 1
  fi
done

file_count="$(find "$BACKUP_DIR" -type f | wc -l | tr -d ' ')"
[[ "$file_count" -gt 0 ]] || {
  echo "El backup MinIO no contiene archivos" >&2
  exit 1
}

echo "Backup MinIO válido: $file_count archivos"
