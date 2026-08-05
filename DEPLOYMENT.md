# 🚀 Guía de Despliegue — Academia Virtual

Esta guía te explica paso a paso cómo desplegar la **Academia Virtual** en la arquitectura híbrida optimizada para costos:
- **Supabase**: PostgreSQL Managed + File Storage
- **Railway / Render**: Backend NestJS (REST API + WebSockets + JWT)
- **Vercel / Cloudflare Pages**: Frontend Next.js 16

---

## 📋 Pasos Previos (Requisitos)

1. Una cuenta gratuita en [Supabase](https://supabase.com).
2. Una cuenta en [Railway](https://railway.app) o [Render](https://render.com).
3. Una cuenta en [Vercel](https://vercel.com).
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
3. Copia la llave **`service_role`** (secret key) o `anon` (`SUPABASE_SERVICE_ROLE_KEY`).

### 1.4 Crear Buckets de Almacenamiento
1. En el menú lateral, ve a **Storage** → **Buckets**.
2. Crea los siguientes buckets públicos:
   - `vouchers` (público)
   - `materials` (público)
   - `avatars` (público)
   - `courses` (público)

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
   CORS_ORIGIN=https://tu-frontend.vercel.app,http://localhost:3000
   STORAGE_PROVIDER=supabase
   SUPABASE_URL=https://[ref].supabase.co
   SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key
   ```
4. En **Settings** → **Networking**, genera un dominio público (ej: `https://academia-backend.up.railway.app`).

---

## ⚡ Paso 4: Desplegar Frontend (Next.js) en Vercel

1. Entra a [Vercel.com](https://vercel.com) y haz clic en **Add New...** → **Project**.
2. Importa tu repositorio de GitHub.
3. En **Root Directory**, selecciona la carpeta `frontend`.
4. En **Environment Variables**, añade:
   ```env
   NEXT_PUBLIC_API_URL=https://academia-backend.up.railway.app/api/v1
   NEXT_PUBLIC_WS_URL=https://academia-backend.up.railway.app
   NEXT_PUBLIC_CULQI_PUBLIC_KEY=pk_test_xxxxxxxxxxxxxxxx
   ```
5. Haz clic en **Deploy**. ¡Listo!

---

## ✅ Verificación del Despliegue

1. Abre la URL de Vercel (ej: `https://tu-academia.vercel.app`).
2. Ingresa con las credenciales por defecto:
   - **Email**: `admin@academia.edu`
   - **Password**: `Admin@1234`
3. Prueba crear una cohorte o subir un comprobante para verificar que Supabase PostgreSQL y Supabase Storage estén funcionando perfectamente.

---

## 🛡️ Mantenimiento y Respaldos

- **Backups de BD**: Supabase Pro incluye Point-in-Time Recovery (PITR). En el plan gratuito, puedes exportar backups periódicos con `npx prisma db pull` o la CLI de PostgreSQL (`pg_dump`).
- **Escalabilidad**: Esta arquitectura soporta fácilmente 1,000+ usuarios concurrentes aumentando los recursos del backend en Railway sin cambiar nada de código.
