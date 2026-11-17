# Comprobantes y notificaciones

Fecha: 11 de noviembre de 2026 (Lima).

## Comprobante de pago

El cliente enviaba el archivo, pero el backend usaba los caracteres literales
`\\0` al iniciar el protocolo INSTREAM de ClamAV, en vez del byte NUL. El
antivirus real contestaba `UNKNOWN COMMAND` y cerraba la conexión. Como la
aplicación no atendía ese cierre, la solicitud seguía esperando el timeout
de dos minutos.

Se corrigió el comando y se añadió el manejo del cierre sin resultado: ahora
devuelve un error recuperable en lugar de seguir esperando. También se cierra
el flujo de lectura cuando termina o falla el análisis. El antivirus continúa
siendo obligatorio; no se omite la validación de los archivos.

Se añadió una alternativa de copia y eliminación del temporal cuando el
archivo recibido y el almacenamiento privado están en sistemas de archivos
distintos (`EXDEV`). Otros errores de escritura se conservan y mantienen el
archivo de origen.

## Panel de notificaciones

Se reemplazó la capa de cierre por detección directa de clic o toque exterior.
El panel también se cierra con Escape, con su botón X y al mover el foco fuera
con el teclado. Escape y X devuelven el foco a la campana. Interactuar dentro
del panel conserva su apertura. No se eliminan notificaciones al cerrar.

El panel tiene nombre accesible, relación con la campana y fondo opaco para
evitar que el texto de la página interfiera con la lectura en móvil.

## Validación

- 29 pruebas de almacenamiento aprobadas, incluidos el byte NUL, el cierre
  del antivirus sin resultado y el traslado entre sistemas de archivos.
- Tres pruebas HTTP multipart con proveedor antivirus local de prueba:
  PDF, PNG y cierre sin respuesta (503 inmediato).
- Dos pruebas HTTP multipart con el ClamAV real: PDF y PNG analizados y
  guardados correctamente. El almacenamiento privado de la prueba usó un
  montaje temporal separado para comprobar también el caso `EXDEV`.
- Seis pruebas Playwright aprobadas sobre la compilación de producción,
  en Chrome y móvil: cierre exterior, Escape, X, navegación por teclado,
  interacción interior, envío correcto y recuperación del estado de carga
  ante un error. Sin errores JavaScript. Capturas revisadas en ambos tamaños.
- TypeScript y compilaciones de backend/frontend aprobados; 52 páginas
  estáticas generadas por Next.js. Lint sin errores ni advertencias.
- Regresión completa del backend: 88 suites y 441 pruebas aprobadas.

La regresión detectó dos expectativas anteriores desactualizadas: el número de
operación añadido a pagos pendientes y las sesiones independientes por pestaña.
Se actualizaron las pruebas y se conservó una prueba explícita de una sola
renovación para solicitudes simultáneas dentro de la misma pestaña.

Las cargas usaron documentos ficticios. Las pruebas HTTP sustituyen el usuario
y el registro del pago por fixtures; no crean inscripciones ni adjuntan
comprobantes a pagos reales. La prueba con ClamAV usa el antivirus existente,
pero guarda los archivos en un contenedor temporal. Las pruebas de interfaz
usan respuestas de API simuladas.

## Recuperación

Se conservaron las imágenes anteriores con las etiquetas
`orm-academia_virtual-backend:before-voucher-20261111` y
`orm-academia_virtual-frontend:before-voucher-20261111`.
El respaldo `backups/pre-voucher-fix-20261111.dump` tiene índice y SHA-256
verificados y está excluido de Git. Esta corrección no cambia el esquema.

Se activaron las imágenes `voucher-fix-20261111` del backend y frontend.
Ambos servicios quedaron saludables, sin reinicios. La API devolvió `ok` y el
catálogo web HTTP 200. Se contrastaron las huellas de los archivos corregidos
con el código activo.

- Backend: `sha256:d720fa0d188994b1492a2932f8d22b5164b8b4bf5e64cb716d6bd7e2f8d2671a`.
- Frontend: `sha256:e76b0a3595e0b9cac2f91c21001832c923035a64f27ae15484e44e91367db87a`.

Para revertir, etiquetar las imágenes `before-voucher-20261111` de cada
servicio como `latest` y ejecutar
`docker compose up -d --no-deps --no-build --wait backend frontend`.
