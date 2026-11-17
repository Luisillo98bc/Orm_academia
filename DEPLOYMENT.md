# 🚀 Guía de Despliegue — Academia Virtual

Esta guía conserva la ruta histórica de proveedores gestionados. La ruta
canónica actual para producción está en `deploy/PRODUCTION_RUNBOOK.md` y usa
Docker, Cloudflare Tunnel, PostgreSQL y MinIO en una VM.

La arquitectura histórica descrita aquí es:
- **Supabase**: PostgreSQL Managed + File Storage
- **Railway / Render**: Backend NestJS (REST API + WebSockets + JWT)
- **Vercel / Cloudflare Pages**: Frontend Next.js 16

---

## 📋 Pasos Previos (Requisitos)

1. Una cuenta gratuita en [Supabase](https://supabase.com).
2. Una cuenta en [Railway](https://railway.app) o [Render](https://render.com).
4. El proyecto subido a tu repositorio de GitHub.

---

## 🟢 Paso 1: Configurar Supabase (Base de Datos + Storage)

### 1.1 Crear Proyecto en Supabase
1. Ingresa a Supabase Dashboard y crea un **Nuevo Proyecto**.
2. Asigna un nombre (e.g. `academia-virtual`) y una contraseña fuerte para la base de datos.
3. Elige la región más cercana a tus usuarios (ej. `South America (São Paulo)` o `US East`).

### 1.2 Obtener Cadenas de Conexión de PostgreSQL
1. En Supabase, ve a **Project Settings** ⚙️ → **Database**.
2. En la sección **Connection String**:
   - Copia la URL de **Transaction Pooler (Puerto 6543)** → Esta será tu `DATABASE_URL`.
   - Copia la URL de **Direct Connection (Puerto 5432)** → Esta será tu `DIRECT_URL`.

### 1.3 Obtener Llaves de API para Storage
1. Ve a **Project Settings** ⚙️ → **API**.
2. Copia la **Project URL** (`SUPABASE_URL`).
3. Copia la llave **`service_role`** (secret key) y guárdala únicamente como secreto del backend (`SUPABASE_SERVICE_ROLE_KEY`). Nunca la expongas al frontend.

### 1.4 Crear Buckets de Almacenamiento
1. En el menú lateral, ve a **Storage** → **Buckets**.
2. Crea los siguientes buckets:
   - `vouchers` (privado)
   - `materials` (privado)
   - `avatars` (público)
   - `courses` (público)

Los comprobantes y materiales nuevos se guardan como referencias protegidas y se descargan mediante el endpoint autenticado de la API. No conviertas `vouchers` ni `materials` en buckets públicos. En desarrollo local, el backend los guarda en `PRIVATE_STORAGE_DIR`, fuera de la carpeta estática pública.

### Procesos programados

En producción debes elegir una sola arquitectura:

1. **Una instancia HTTP**: `ENABLE_SCHEDULED_JOBS=true` y `SCHEDULED_JOBS_MODE=inline`.
2. **Backend HTTP + worker**: el backend usa `SCHEDULED_JOBS_MODE=disabled` y el worker usa `SCHEDULED_JOBS_MODE=worker`.

Puedes comprobar la elección antes de desplegar:

```powershell
.\scripts\validate-scheduled-jobs.ps1 -Architecture inline
# o, para la arquitectura separada:
.\scripts\validate-scheduled-jobs.ps1 -Architecture worker
```

Para Docker, la segunda opción se levanta con el override preparado:

```powershell
docker compose -f docker-compose.yml -f docker-compose.worker.yml --profile worker up -d --build backend frontend worker
```

No actives el perfil `worker` usando únicamente `docker-compose.yml` mientras el backend conserve `SCHEDULED_JOBS_MODE=inline`. El worker ejecuta contratos, certificados, recordatorios, conciliación de pagos y automatizaciones, con sus intervalos configurados.

Los trabajos comparten un servicio de bloqueo con una conexión PostgreSQL dedicada por proceso. Usa `DIRECT_URL` con conexión directa o pooling en modo sesión; el pooling por transacción no conserva estos bloqueos. El cliente fija `connection_limit=1`, `max_idle_connection_lifetime=0` y `max_connection_lifetime=0` para mantener la sesión hasta liberar el bloqueo. Reserva esa conexión adicional en el presupuesto de PostgreSQL y evita que el servidor o el proxy reciclen sesiones activas durante un trabajo. El cierre espera los trabajos antes de desconectar la base de datos.

Si el servicio registra que perdió la sesión de bloqueo, deja de aceptar trabajos y requiere reiniciar el worker. La pérdida de la conexión o un failover puede liberar un bloqueo mientras una llamada externa sigue activa: los efectos externos deben ser idempotentes y los pagos inciertos deben conciliarse antes de reintentarlos.

Los JWT nuevos se vinculan a una sesión persistida. Tras desplegar este cambio, las cookies de acceso antiguas exigirán renovar la sesión o volver a iniciar sesión. La revocación se comprueba en cada petición autenticada y antes de enviar eventos privados por WebSocket.

#### Prueba de SMTP

Con las variables SMTP configuradas en `backend/.env`, ejecuta una verificación de conexión y un envío real a una dirección controlada:

```powershell
cd backend
npm run test:smtp -- tu-correo-de-prueba@dominio.com
```

El script no imprime contraseñas. La prueba debe devolver `SMTP verificado` y `correo de prueba enviado`. Si el proveedor rechaza temporalmente el envío, `MailService` reintenta hasta `MAIL_RETRY_ATTEMPTS` veces usando un retraso progresivo.

---

## 🟣 Paso 2: Ejecutar Migraciones de Prisma a Supabase

Desde tu máquina local (o desde tu CI/CD):

1. En la carpeta `database/`:
   ```bash
   cd database
   ```
2. Configura temporalmente en tu `database/.env`:
   ```env
   DATABASE_URL="postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true"
   DIRECT_URL="postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres"
   ```
3. Ejecuta la migración y el seed inicial (roles, permisos y usuario administrador):
   ```bash
   npx prisma migrate deploy
   npx prisma db seed
   ```

---

## 🚂 Paso 3: Desplegar Backend (NestJS) en Railway

1. Entra a [Railway.app](https://railway.app) y haz clic en **New Project** → **Deploy from GitHub repo**.
2. Selecciona tu repositorio y especifica el Root Directory como `/backend`.
3. En la pestaña **Variables**, agrega todas las variables necesarias (mira `backend/.env.production.example`):
   ```env
   DATABASE_URL=postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true
   DIRECT_URL=postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres
   JWT_SECRET=tu_jwt_secret_super_seguro_aqui
   JWT_EXPIRES_IN=15m
   REFRESH_TOKEN_TTL_DAYS=30
   COOKIE_SECURE=true
   COOKIE_SAME_SITE=lax
   PORT=3000
   NODE_ENV=production
   CORS_ORIGIN=https://tu-frontend.vercel.app
   STORAGE_PROVIDER=supabase
   SUPABASE_URL=https://[ref].supabase.co
   SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key
   ```
4. En **Settings** → **Networking**, genera un dominio público (ej: `https://academia-backend.up.railway.app`).
5. En las variables del backend configura `PAYMENTS_MODE=cash`. En esta etapa no agregues claves ni webhooks de Culqi.

> Si despliegas con `docker compose`, los valores interpolados del archivo Compose deben estar disponibles en el `.env` raíz o pasarse con `docker compose --env-file .env.production up -d --build`. El archivo `backend/.env` se mantiene como `env_file` del contenedor, pero no sirve para interpolar los `build.args` del frontend.

---

## ⚡ Paso 4: Desplegar Frontend (Next.js)

Puedes desplegarlo en un segundo servicio de Railway para mantener toda la aplicación en la misma plataforma. También puedes usar Vercel si prefieres separar el frontend.

1. Crea un segundo servicio desde el mismo repositorio y usa `frontend` como Root Directory.
2. En **Build Arguments / Variables**, añade:
   ```env
   NEXT_PUBLIC_API_URL=https://academia-backend.up.railway.app/api/v1
   NEXT_PUBLIC_WS_URL=https://academia-backend.up.railway.app
   NEXT_PUBLIC_GOOGLE_CLIENT_ID=tu-client-id.apps.googleusercontent.com
   ```
3. Genera el dominio público del frontend y actualiza `CORS_ORIGIN` y `FRONTEND_URL` del backend con ese dominio.

---

## ✅ Verificación del Despliegue

1. Abre la URL de Vercel (ej: `https://tu-academia.vercel.app`).
2. Inicia sesión con Google usando la cuenta indicada en `INITIAL_ADMIN_EMAIL`.
3. Activa 2FA para la cuenta administradora.
4. Prueba crear una cohorte, registrar una matrícula en efectivo, aprobar el pago y subir un material para verificar que Supabase PostgreSQL y Supabase Storage estén funcionando perfectamente.

---

## 🛡️ Mantenimiento y Respaldos

- **Backups de BD**: Supabase Pro incluye Point-in-Time Recovery (PITR). Para una copia verificable usa `scripts/backup-database.ps1` y comprueba la restauración con `scripts/verify-backup.ps1`. Programa el primer script en Task Scheduler/cron y conserva las copias fuera del servidor.
- **Escalabilidad**: Esta arquitectura soporta fácilmente 1,000+ usuarios concurrentes aumentando los recursos del backend en Railway sin cambiar nada de código.
