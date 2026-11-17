# Runbook de produccion

Esta es la ruta de despliegue para una VM con Docker, Cloudflare Tunnel y
MinIO. El `DEPLOYMENT.md` anterior conserva la guia historica de proveedores
gestionados y no debe usarse para esta arquitectura.

## Primera instalacion

1. Instalar Docker Engine y Compose v2 en la VM.
2. Clonar el repositorio en `/opt/academia`.
3. Crear `deploy/.env.production` y `deploy/.env.tunnel` desde sus ejemplos y
   guardar secretos reales.
4. Crear el tunel remoto en Cloudflare y configurar sus rutas. Ver
   `deploy/CLOUDFLARE_TUNNEL.md`.
5. Validar la configuracion sin levantar servicios:

   ```bash
   set -a; . deploy/.env.tunnel; set +a
   bash scripts/preflight-production.sh
   docker compose --env-file deploy/.env.production \
     -f docker-compose.yml -f compose.production.yaml config --quiet
   ```

   En una maquina Windows puede ejecutarse también
   `scripts/preflight-production.ps1`; debe validar `STORAGE_PROVIDER=minio`,
   jobs `inline` y una `INITIAL_ADMIN_PASSWORD` única. Nunca uses la contraseña
   de desarrollo.

6. Construir las imágenes comunitarias de MinIO y `mc` desde los commits
   oficiales fijados en `compose.production.yaml`. MinIO ya no publica una
   imagen comunitaria precompilada accesible anónimamente:

   ```bash
   docker compose --env-file deploy/.env.production \
     --env-file deploy/.env.tunnel \
     -f docker-compose.yml -f compose.production.yaml build minio minio-init
   ```

7. Crear el volumen de PostgreSQL si es una VM nueva y levantar los servicios:

   ```bash
   set -a; . deploy/.env.tunnel; set +a
   docker volume create database_academia_virtual_data
  docker compose --env-file deploy/.env.production \
    -f docker-compose.yml -f compose.production.yaml up -d db minio minio-init clamav
   ```

8. Hacer backup de la base de datos y aplicar las migraciones. Este paso debe
   ejecutarse antes de arrancar el backend:

   ```bash
   docker compose --env-file deploy/.env.production \
     -f docker-compose.yml -f compose.production.yaml run --rm backend \
     npx prisma migrate deploy --schema=../database/prisma/schema.prisma
   ```

9. En la primera instalacion, crear los roles y el administrador inicial. El
   comando es idempotente, pero no debe formar parte de cada despliegue. La
   contrasena se toma de `INITIAL_ADMIN_PASSWORD` y nunca se muestra en logs:

   ```bash
   docker compose --env-file deploy/.env.production \
     -f docker-compose.yml -f compose.production.yaml run --rm backend \
     npx ts-node ../database/prisma/seed.ts
   ```

   Despues del primer ingreso, cambiar la contrasena y activar 2FA para cada
   cuenta ADMIN.

10. Hacer backup de la base de datos y migrar los archivos existentes. El
   migrador no elimina los archivos originales:

   ```bash
   docker compose --env-file deploy/.env.production \
     -f docker-compose.yml -f compose.production.yaml build backend
   docker compose --env-file deploy/.env.production \
     -f docker-compose.yml -f compose.production.yaml run --rm \
     -e MIGRATION_DRY_RUN=true backend npm run storage:migrate-minio
   ```

   Revisar la simulación: no continuar si `missing` es mayor que cero.
   Después del respaldo y con las escrituras detenidas, repetir sin
   `-e MIGRATION_DRY_RUN=true`. El migrador incluye comprobantes actuales,
   comprobantes del historial de cuotas y revisiones de entregas; conserva
   los originales y evita sobrescribir referencias que cambiaron mientras se migraba.

11. Levantar la aplicacion:

   ```bash
   docker compose --env-file deploy/.env.production \
     -f docker-compose.yml -f compose.production.yaml up -d --wait --wait-timeout 180 backend frontend cloudflared
   ```

La arquitectura productiva inicial es `inline`: el backend ejecuta alertas y
certificados programados. No se levanta `worker` en este despliegue.

## Actualizaciones

El workflow `.github/workflows/cd.yml` despliega despues de que el CI de `main`
termine correctamente. Usa un runner self-hosted instalado en la misma VM;
por eso no requiere exponer SSH hacia Internet. Antes de activarlo:

1. En GitHub, agregar un runner self-hosted para el repositorio con las
   etiquetas `self-hosted`, `linux`, `x64` y `production`.
2. Ejecutar el servicio del runner con un usuario que tenga acceso al checkout
   de `/opt/academia`, al archivo `deploy/.env.tunnel` y al socket de Docker.
3. Crear el environment protegido `production` y configurar únicamente:

   - Variable: `DEPLOY_PATH=/opt/academia`.

La VM debe tener ya creados `deploy/.env.production` y
`deploy/.env.tunnel`. El workflow hace backup, actualiza el checkout,
reconstruye backend/frontend, ejecuta migraciones y comprueba el estado de
Compose.

Mantener el repositorio privado y exigir aprobación del environment de
producción. Un runner self-hosted no debe aceptar trabajos de pull requests o
forks no confiables.

## Backups y rollback

- Ejecutar `scripts/backup-database.ps1` o su equivalente Linux antes de cada
  migración.
- Ejecutar `bash scripts/backup-minio.sh` periódicamente y verificarlo con
  `bash scripts/verify-minio-backup.sh`.
- Copiar backups de PostgreSQL y MinIO fuera de la VM.
- No borrar el volumen anterior hasta validar la migracion.
- Las migraciones Prisma deben ser compatibles hacia atras para permitir
  volver a la imagen anterior.
- Conservar al menos las dos ultimas imagenes o commits desplegados.

### Ensayo de recuperación

Al menos una vez por trimestre y después de cambios relevantes, restaurar una
copia reciente de PostgreSQL y de MinIO en una instalación aislada de pruebas,
con credenciales y almacenamiento diferentes de producción. Nunca apuntar el
ensayo a los volúmenes productivos.

1. Registrar la fecha de las copias, su ubicación, el responsable y la hora de
   inicio. Verificar que pertenecen a un período compatible.
2. Restaurar la base en una instancia PostgreSQL de pruebas y los buckets en
   un MinIO de pruebas. Mantener deshabilitados pagos, correo y trabajos
   programados para evitar operaciones externas.
3. Comprobar migraciones, acceso de prueba, matrícula, consulta de pagos y
   descarga de archivos de prueba con permisos adecuados. Comparar cantidades
   y fechas representativas con los registros de la copia.
4. Registrar la hora de finalización, el resultado, los errores y las acciones
   pendientes en el registro operativo protegido de la organización. La fecha
   del último ensayo exitoso debe quedar accesible al equipo responsable.

La comprobación de estructura de `verify-minio-backup.sh` no sustituye una
restauración real. Si falla cualquier paso, conservar las copias originales y
resolver el problema antes de declarar que la recuperación ha sido exitosa.
