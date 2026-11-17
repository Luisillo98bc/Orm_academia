# Checklist de salida a producción

- Usar HTTPS y `COOKIE_SECURE=true`.
- Publicar frontend y API detrás de un CDN/WAF con protección DDoS y reglas de
  rate limiting; no exponer directamente el origen ni PostgreSQL.
- Configurar dominios exactos en `CORS_ORIGIN` y `FRONTEND_URL`.
- Configurar `TRUST_PROXY_HOPS` según el número real de proxies confiables.
- Usar secretos independientes de al menos 32 caracteres y rotarlos periódicamente.
- Mantener `PAYMENTS_MODE=cash` mientras la academia opere con pagos en efectivo; no publicar claves Culqi ni configurar sus webhooks en esta etapa.
- Ejecutar `prisma migrate deploy` una sola vez por despliegue.
- Aplicar `20261116220000_preserve_payment_receipts` antes de iniciar la nueva
  API: crea la vista de cobros por cuota y amplía la columna del secreto 2FA.
  Revisar la corrección de matrículas antiguas con una copia restaurada antes
  de ejecutarla sobre datos reales.
- En la primera instalacion, ejecutar el seed productivo con una
  `INITIAL_ADMIN_PASSWORD` unica; cambiarla despues del primer ingreso y
  activar 2FA en cada cuenta ADMIN.
- Aplicar la migración `20260827100000_add_admin_two_factor` y activar 2FA en cada cuenta ADMIN antes de abrir el sistema.
- Aplicar también `20260827160000_add_notification_preferences` y `20260827163000_add_privacy_consent`.
- Crear un backup con `scripts/backup-database.ps1` antes de cada migración.
- Verificar restauración periódicamente con `scripts/verify-backup.ps1`.
- Ejecutar `bash scripts/backup-minio.sh`, validar el resultado con
  `bash scripts/verify-minio-backup.sh` y copiarlo fuera de la VM.
- Ejecutar `scripts/audit-legacy-private-files.ps1` y migrar toda referencia legacy de materiales, comprobantes y entregas antes de publicar.
- Incluir comprobantes del historial de mensualidades y revisiones de entregas
  en la auditoría y en la simulación de `storage:migrate-minio`.
- Aplicar `deploy/minio-app-policy.json`: la cuenta de aplicación necesita
  listar los buckets para comprobar su cuota y eliminar comprobantes fallidos.
- Para migrar sin borrar originales: ejecutar primero `docker compose exec backend node scripts/migrate-legacy-private-files.mjs` y, después de revisar la simulación y confirmar el backup, repetir con `--apply`. Volver a ejecutar la auditoría hasta obtener `materials|0`, `payments|0` y `deliverables|0`.
- Restringir acceso a DNI, domicilio, nómina, comprobantes y backups.
- Confirmar política de privacidad, términos y consentimiento antes de captar datos reales.
- Ejecutar pruebas unitarias, E2E, lint y builds antes de publicar.
- Ejecutar `npm audit --omit=dev --audit-level=high` en backend y frontend y
  corregir toda vulnerabilidad high/critical antes de publicar.
- Confirmar cabeceras de seguridad, CSP, protección CSRF/origen y que no se
  permita SVG sin sanitización.
- Ejecutar `cd frontend; npm run test:e2e` en Chrome y móvil; en CI instalar Chromium con `npx playwright install --with-deps chromium`.
- Ejecutar `node scripts/load-test.mjs` contra un entorno de prueba, no contra datos productivos.
- Revisar healthchecks, logs de errores, espacio en disco y entrega de correos.
- Probar carga de PDF, Word, PowerPoint, Excel, vídeo y enlaces desde una clase con la política de almacenamiento definitiva.
- Confirmar `ENABLE_SCHEDULED_JOBS=true`, SMTP configurado y revisar los logs de alertas/certificados tras el primer ciclo.
- Configurar `MAIL_RETRY_ATTEMPTS` y `MAIL_RETRY_DELAY_MS`; en Gmail usar una contraseña de aplicación y rotarla si fue compartida.
- La primera publicación usa jobs `inline`: mantener `ENABLE_SCHEDULED_JOBS=true` y `SCHEDULED_JOBS_MODE=inline`; no levantar el worker de la arquitectura local.
- Probar aprobación, rechazo y reintento de pagos en efectivo desde el panel administrativo.
- Si posteriormente se habilita `PAYMENTS_MODE=online`, configurar y validar credenciales y webhooks de Culqi antes de cambiar la interfaz.
- Confirmar `TWO_FACTOR_ENCRYPTION_KEY` independiente de `JWT_SECRET`.
- Confirmar `CLAMAV_REQUIRED=true`, `CLAMAV_HOST=clamav` y que el contenedor
  ClamAV responda antes de abrir el registro de archivos al pÃºblico.
- Configurar `STORAGE_BUCKET_QUOTA_BYTES` con capacidad suficiente y probar el
  rechazo de una carga cuando el bucket alcanza la cuota.
- Repetir un checkout con la misma clave de idempotencia y confirmar que no crea
  dos pagos ni dos matrÃ­culas.
