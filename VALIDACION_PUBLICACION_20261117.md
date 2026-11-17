# Preparación de publicación — 17 de noviembre de 2026

## Estado

Correcciones implementadas y verificadas en entornos desechables. El usuario
indicó dejar el correo pendiente. No se ha activado la configuración de
producción ni aplicado la nueva migración sobre la base de la academia.

Los cambios locales de entorno preparan un único `FRONTEND_URL` HTTPS y un
proxy confiable para la arquitectura Cloudflare Tunnel → backend. Los
contenedores existentes conservan su configuración hasta recrearlos.

## Cambios

- 2FA: la configuración no puede reemplazar un factor activo. La escritura
  exige que siga desactivado en PostgreSQL, y el secreto cifrado admite hasta
  255 caracteres. Se comprobó el almacenamiento real y el rechazo del reinicio.
- Mensualidades: el total pertenece a la matrícula original; cambiar la
  cohorte no amplía su deuda. No se puede abrir una cuota después de pagar la
  última. Las cuotas posteriores no requieren la reserva inicial de 48 horas.
  Las escrituras comprueban el estado leído para no sobrescribir una aprobación
  concurrente. Reintentar una primera cuota rechazada vuelve a reservar cupo.
- Ingresos: `payment_receipts` expone cada cobro una sola vez, aunque la
  siguiente cuota esté pendiente. Resúmenes, gráficos, rentabilidad, distribución
  de métodos, analítica y CSV consultan esos cobros y sus fechas. Los filtros
  diarios financieros usan la zona horaria de Lima.
  Los gráficos conservan seis meses distintos incluso al cerrar un mes de 31 días.
- Comprobantes: se autoriza el pago antes de guardar el archivo; las cargas
  fallidas se retiran y los comprobantes reemplazados se limpian después de
  guardar su sustituto. El historial conserva el acceso autorizado a vouchers.
- MinIO: política con permisos para comprobar cuotas y retirar vouchers;
  el migrador contempla comprobantes históricos y revisiones, tiene simulación
  y no borra originales. Comprueba que una referencia no haya cambiado antes
  de actualizarla. Su regresión verifica deduplicación e historial.
- Frontend: corregidos los errores de hooks y advertencias de lint; filtros
  de catálogo sincronizados con la URL; aviso sin conexión separado de la
  navegación móvil y sin interceptar pulsaciones. El tema oscuro se comprueba
  contra la paleta del proyecto, sin fijar un color antiguo en la prueba.
- Next.js y `eslint-config-next`: actualizados a 16.4.5 para incorporar el
  [parche oficial GHSA-mfr8-8qww-v76h](https://github.com/vercel/next.js/security/advisories/GHSA-mfr8-8qww-v76h).
  No se encontró el patrón `unstable_cache`/`use cache` afectado en el proyecto.
- Publicación: CD espera servicios saludables y comprueba readiness. El
  runbook documenta volumen inicial, simulación de archivos y orden de migración.
  Lint del frontend también rechaza advertencias.

## Validación

| Comprobación | Resultado |
|---|---|
| Backend: TypeScript, lint y build | Aprobados |
| Unitarias y umbral de cobertura | 89 suites, 460 pruebas aprobadas; 92.82 % de líneas y 74.20 % de ramas |
| E2E de API | 10 suites, 31 pruebas aprobadas, más la nueva regresión de migración antigua aprobada: 32 casos distintos |
| Migraciones desde una base vacía | 30 aplicadas |
| Migraciones ya aplicadas en la academia | Las 29 coinciden con los bytes preparados en Git; se recuperó la codificación/salto final original de una migración sin cambiar su SQL ni la base |
| 2FA y cobros históricos en PostgreSQL | Aprobados |
| SMTP simulado y migrador MinIO | 2 pruebas aprobadas; sin envíos reales |
| Restauración con cuota histórica ficticia | Recuperados un cobro de S/ 150.00 y su entrada de historial |
| Auditoría npm de producción | Cero avisos en backend, frontend y database tras el parche |
| Compose de producción | Estructura válida, sin activar servicios |
| Frontend: TypeScript, lint y build con Turbopack 16.4.5 | Aprobados |
| Interfaz en Chromium escritorio y móvil, con API simulada | 65 aprobadas y una omitida intencionalmente: los tamaños adicionales se prueban una vez en escritorio |

El último lint del backend necesitó 2 GiB para completar el análisis de tipos.
El intento anterior con 1.5 GiB agotó el heap; al repetir únicamente ese chequeo
con memoria suficiente finalizó sin errores ni advertencias.

Las pruebas no usaron credenciales de producción, cuentas reales ni la base de
la academia. PostgreSQL y los procesos de aplicación estuvieron aislados de la
red externa. El navegador usa API simulada y una sesión nueva. La consulta a
npm fue anónima y contó con autorización específica del usuario.

## Pasos de salida pendientes

1. Completar `MAIL_PASS` con una credencial SMTP válida. El preflight debe
   rechazar el valor de ejemplo. Comprobar autenticación y recepción en un
   destinatario autorizado; no se ha enviado ningún correo real.
   Se ejecutó el preflight local: este es el único valor que sigue rechazando.
   El correo inicial del administrador se alineó con el ya configurado en los
   dos entornos locales, sin cambiar su cuenta ni mostrar sus datos.
2. Crear respaldo verificable de datos y archivos reales; revisar la migración
   de matrículas antiguas, detener escrituras y aplicar las migraciones.
3. Preparar MinIO, aplicar su política, simular y comprobar la migración de
   archivos antes de actualizar sus referencias. Conservar los originales.
4. Recrear la aplicación con `compose.production.yaml`, confirmar
   `NODE_ENV=production`, almacenamiento MinIO, HTTPS y healthchecks.
5. Activar 2FA en las cuentas administrativas, comprobar OAuth/túnel en el
   dominio y conservar un respaldo fuera del equipo o VM.

No se ejecutó carga sostenida con esta versión ni se certificó un máximo de
usuarios. Las pruebas anteriores de carga siguen documentadas por separado.
