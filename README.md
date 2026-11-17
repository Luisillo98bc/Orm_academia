# Academia Virtual — ERP + LMS educativo

Plataforma web para comercializar cursos, gestionar cohortes y matrículas,
impartir clases, evaluar estudiantes y administrar pagos y recursos humanos.

## Arquitectura

- `backend/`: API NestJS, JWT/RBAC, Swagger y WebSockets.
- `frontend/`: Next.js App Router y paneles por rol.
- `database/`: PostgreSQL, esquema Prisma, migraciones y seeds.

## Inicio rápido con Docker

Configura primero los archivos locales `backend/.env` y
`frontend/.env.local`. Después ejecuta desde la raíz:

```bash
docker compose up -d --build
```

Servicios locales:

- Frontend: http://localhost:3002
- API: http://localhost:3003/api/v1
- Swagger: http://localhost:3003/api/docs
- Salud: http://localhost:3003/api/v1/health
- PostgreSQL: localhost:5434

Comprueba los contenedores con:

```bash
docker compose ps
```

Los servicios incluyen healthchecks y el backend espera a que PostgreSQL esté
saludable antes de iniciar.

## Base de datos

El esquema está gestionado por Prisma Migrate. Para aplicar migraciones:

```bash
cd database
npm install
npm run prisma:migrate:deploy
npm run prisma:seed
```

Para cargar un escenario demo completo con 100 usuarios y actividad en todos los módulos:

```bash
npm run prisma:seed:demo
```

Las cuentas demo usan `Demo@1234!` y el formato de correo `demo100.<rol>001@academia.local`. Es un seed idempotente para entornos locales o de pruebas.

No uses `prisma db push` en producción. Para cambios nuevos del esquema usa
`npm run prisma:migrate` en desarrollo y versiona la migración generada.

## Desarrollo sin Docker

Backend:

```bash
cd backend
npm install
npm run prisma:generate
npm run start:dev
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Si ambos se ejecutan fuera de Docker, configura puertos distintos mediante las
variables de entorno correspondientes.

## Verificación

La preparación más reciente está en
[VALIDACION_PUBLICACION_20261117.md](VALIDACION_PUBLICACION_20261117.md), con las
correcciones de 2FA, cuotas, reportes y archivos, las pruebas ejecutadas y los
pasos de publicación pendientes. El correo real queda pendiente de configuración.

Consulta [REVISION_TECNICA.md](REVISION_TECNICA.md) para las correcciones de concurrencia y sesiones, el alcance revisado y las validaciones pendientes antes de escalar.

```bash
cd backend
npm test -- --runInBand
npm run build

cd ../frontend
npm run build
```

## Seguridad de producción

- Usa un `JWT_SECRET` aleatorio de al menos 32 caracteres.
- Configura un origen CORS explícito; `*` se rechaza en producción.
- Define las llaves reales de Culqi únicamente en el backend.
- Configura `MAIL_HOST`, `MAIL_PORT`, `MAIL_USER`, `MAIL_PASS` y `MAIL_FROM` si
  deseas habilitar correo.
- Cambia o elimina las credenciales del administrador de desarrollo antes de
  publicar la plataforma.

En desarrollo, define `INITIAL_ADMIN_EMAIL` y
`INITIAL_ADMIN_PASSWORD` en el entorno local antes de ejecutar el seed. No
documentes ni reutilices credenciales reales en el repositorio.

En producción, el seed exige `INITIAL_ADMIN_PASSWORD` y nunca acepta esta
contraseña de desarrollo. Después del primer acceso, activa 2FA y rota la
contraseña inicial.
