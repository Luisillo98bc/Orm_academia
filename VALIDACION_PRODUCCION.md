# Validación y actualización del backend

Fecha: 11 de noviembre de 2026 (Lima).

Se completó la validación pendiente del 10 de noviembre y se actualizó el
backend Docker existente. El frontend conserva la versión validada en
`MEJORAS_FRONTEND.md`.

## Cambios cerrados

- Las automatizaciones recorren por identificador todas las páginas de
  prospectos, pagos y matrículas. La regresión incluye 201 prospectos,
  201 pagos y 501 matrículas, superando los límites de la primera página.
- El aula permite trabajar a estudiantes distintos simultáneamente; conserva
  la exclusión para un mismo estudiante y para editar la actividad. La prueba
  utiliza conexiones reales a PostgreSQL.
- El medidor de carga consume el cuerpo completo y registra timeouts como
  fallos. Sus dos pruebas usan un servidor HTTP ficticio.
- Los preflight de PowerShell y Bash exigen `POSTGRES_PASSWORD`, rechazan
  secretos de ejemplo del túnel y secretos compartidos entre JWT y el
  administrador, y aceptan las mismas URL con barra final. Sus pruebas usan
  archivos temporales ficticios y se incorporaron al CI junto con las del
  medidor de carga.
- Se corrigieron los errores de formato detectados y el tipo de los mocks de
  respuesta en las pruebas CSRF, sin cambiar su comportamiento.

## Resultados

| Comprobación | Resultado |
|---|---|
| TypeScript del backend | Aprobado |
| Unitarias y umbral de cobertura | 88 suites, 439 pruebas aprobadas |
| Prueba CSRF tras ajustar el tipo del mock | 5 pruebas aprobadas |
| E2E de API con PostgreSQL 15 aislado | 6 suites, 24 pruebas aprobadas |
| Migraciones desde una base vacía | 28 aplicadas |
| Compilación del backend | Aprobada |
| Lint del backend | 0 errores y 0 advertencias tras la continuación del 11 de noviembre |
| Preflight de PowerShell y Bash | Ambos aprobados; configuración válida y 10 rechazos por plataforma |
| Medidor de carga | 2 pruebas aprobadas |
| Restauración de datos ficticios | Coinciden 101 usuarios, 12 cohortes, 218 pagos, 436 entregas y 28 migraciones |
| Carga breve de salud y catálogos | 90 solicitudes, concurrencia 10, 90 HTTP 200, 0 fallos |
| Latencia de esa ejecución | p50 44 ms; p95 95 ms; p99 153 ms |
| Imagen candidata | Salud y ambos catálogos públicos devuelven HTTP 200 |

Las pruebas utilizaron copias del código, secretos ficticios y PostgreSQL
desechable sin puertos publicados ni volúmenes productivos. No tuvieron acceso
de red externa. La imagen se construyó sin descargar dependencias y se comprobó
que el lockfile coincidía con el de la imagen de dependencias existente.

La carga breve verifica el recorrido de lectura; no demuestra una capacidad
máxima de usuarios ni sustituye carga sostenida, operaciones autenticadas o
pruebas de escritura concurrente representativas.

## Actualización y recuperación

- Se creó `backups/pre-backend-validation-20261111.dump`, se comprobó su índice
  y se guardó su SHA-256. Los respaldos están excluidos de Git.
- Se conservó la imagen anterior como
  `orm-academia_virtual-backend:before-validation-20261111`.
- Se activó la imagen `orm-academia_virtual-backend:validated-20261111`,
  identificador `sha256:b599c1bbd5326916480127eb3ad6ea4cfb38b46688ecd65814caf05e0da31d9c`.
- El backend quedó saludable y su endpoint local de salud devolvió `ok`.
  PostgreSQL ya tenía las 28 migraciones; no se añadieron migraciones.
- Se conservaron variables y montajes de datos del backend. El puerto 3003
  queda vinculado a `127.0.0.1`, como define el Compose actual.
- Frontend, PostgreSQL y ClamAV quedaron saludables; Cloudflare siguió en
  ejecución.

Para revertir el backend, etiquetar la imagen `before-validation-20261111`
como `orm-academia_virtual-backend:latest` y ejecutar
`docker compose up -d --no-deps --no-build --wait backend`.

## Continuación: advertencias e integraciones

Se eliminaron las 190 advertencias mediante tipos de Prisma para los resultados
del repositorio de cohortes y tipos para mocks y comparadores asimétricos de
Jest. No se desactivaron reglas. `npm run lint` ahora exige
`--max-warnings=0`, también en CI. Volvieron a aprobar las 439 pruebas unitarias
con cobertura, las 24 E2E de API y TypeScript.

La prueba SMTP admite `--verify-only`, limita los tiempos de conexión y
comprueba la aceptación de los destinatarios antes de anunciar un envío.
Su prueba con un servidor SMTP local comprobó autenticación, verificación sin
enviar, entrega aceptada, rechazo de destinatario y rechazo de credenciales.
Se incorporó al CI junto con la prueba del medidor de carga sostenida.

### Estado de servicios externos

| Integración | Resultado observado el 11 de noviembre |
|---|---|
| SMTP real | Se alcanzó Gmail, que rechazó la autenticación con `535 BadCredentials`. No se envió ningún correo. El usuario autorizó como destinatario el remitente configurado; sigue pendiente corregir `MAIL_USER`/`MAIL_PASS` en `backend/.env`. |
| Pagos | El entorno activo usa `PAYMENTS_MODE=cash`. Las E2E verificaron importe decimal, reserva, checkout repetido sin duplicados, rechazo/reintento, aprobación, permisos y auditoría sobre PostgreSQL desechable. No se registraron pagos ficticios en la base de la academia. |
| Culqi | Desactivado por indicación del usuario; el alcance actual son pagos en efectivo. |
| WhatsApp | Desactivado por indicación del usuario; no tiene proveedor configurado. |

Para verificar SMTP sin enviar:

```text
cd backend
npm run test:smtp -- --verify-only
```

Para enviar un único aviso al destinatario autorizado, tras corregir la
autenticación:

```text
npm run test:smtp -- destinatario-autorizado@dominio.com
```

`npm run test:smtp -- --self` usa `MAIL_FROM` como destinatario y debe
ejecutarse únicamente cuando el usuario haya autorizado ese aviso.

La aceptación SMTP acredita que el proveedor aceptó el mensaje; la recepción
final debe confirmarse en el buzón. Ninguna prueba simulada acredita una entrega
real. No se activó Culqi ni WhatsApp con datos de ejemplo.

Las pruebas del navegador del frontend son las registradas el 10 de noviembre;
no se repitieron al no cambiar su código. La migración a MinIO y la configuración
de una VM productiva son operaciones separadas de esta actualización del entorno
Docker existente. Se mantienen los límites para varias réplicas y el resto de
mejoras de escala descritos en `REVISION_TECNICA.md`.

## Carga sostenida completada

El 11 de noviembre se ejecutaron siete minutos de actividad autenticada sobre
PostgreSQL 15 desechable, con las reglas normales de rate limiting, sin red
externa, correo ni procesos programados. Se usaron 50 cuentas distintas con
sesiones válidas; cada alumno realizó una acción cada cinco segundos entre
diez recorridos de matrículas, resumen de aprendizaje, progreso, temario,
evaluaciones, notificaciones, publicaciones, catálogo, guardado de progreso y
entrega/reentrega. No se ejecutó carga sobre la base de la academia.

| Alumnos | Duración | Solicitudes | Fallos | p50 | p95 | p99 |
|---|---|---|---|---|---|---|
| 10 | 1 minuto | 120 | 0 | 42 ms | 173 ms | 257 ms |
| 25 | 1 minuto | 300 | 0 | 106 ms | 239 ms | 252 ms |
| 50 | 5 minutos | 3.000 | 0 | 179 ms | 325 ms | 455 ms |

Resultado: **3.420 solicitudes exitosas**, sin HTTP 429, timeouts ni errores
5xx. La última etapa sostuvo diez solicitudes por segundo y alcanzó cincuenta
solicitudes simultáneas. La verificación posterior encontró los cincuenta
progresos completados, cincuenta entregas y 291 revisiones: coinciden exactamente
con las 341 operaciones de entrega exitosas, sin duplicados ni pérdidas.

La API tuvo límites de dos CPU y 3 GiB de RAM; PostgreSQL, una CPU y 768 MiB;
el generador, una CPU y 256 MiB. En 25 muestras se observaron como máximos
361,6 MiB de RAM y 71,16 % de CPU para la API, 164,4 MiB de RAM y 10,56 %
de CPU para PostgreSQL, y diecinueve conexiones totales en la base. En Docker,
100 % de CPU equivale a un núcleo. No hubo reinicios ni agotamiento de memoria.

Los resultados detallados están en `VALIDACION_CARGA_20261111.json`. Esta
ejecución demuestra el recorrido medido con cincuenta alumnos; no establece
el máximo. La base utilizó tmpfs y la comunicación fue por loopback, por lo
que no mide latencia de disco productivo, red remota, archivos grandes,
videoconferencias, sockets ni ráfagas de inicio de sesión.

## Versión final activada

Se comprobó la imagen final contra la base ficticia antes de actualizar el
backend existente. La API y el catálogo web respondieron correctamente después
de la actualización; el backend quedó saludable y sin reinicios. Los demás
servicios conservaron sus contenedores.

- Imagen activa: `orm-academia_virtual-backend:complete-20261111`;
  `sha256:21aadd8f0a586b7002a792b75e5f7effd53bcad4580247af0f1d1c13f6c483de`.
- Imagen anterior: `orm-academia_virtual-backend:before-clean-20261111`.
- Respaldo previo: `backups/pre-lint-clean-20261111.dump`, con índice y SHA-256
  verificados. No hubo cambios de esquema.

Para revertir esta última actualización, etiquetar `before-clean-20261111`
como `orm-academia_virtual-backend:latest` y ejecutar
`docker compose up -d --no-deps --no-build --wait backend`.
