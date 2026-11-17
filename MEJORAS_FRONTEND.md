# Mejoras del frontend

Fecha: 10 de noviembre de 2026.

## Cambios

| Mejora | Comportamiento |
|---|---|
| Continuidad del curso | Desde el panel, «Continuar curso» elige un curso activo con avance y abre su primer material sin completar. El material queda señalado y recibe foco. |
| Actividad exacta | Las evaluaciones pendientes enlazan a su actividad en el aula y la enfocan al cargar. No se inicia un intento automáticamente. |
| Carga por secciones | El panel de alumno, docente y administración carga sus recursos de forma independiente, con estructuras de carga y reintentos. |
| Errores y vacíos | Una consulta fallida muestra recuperación; no se transforma en cero matrículas, pagos o alertas. |
| Ventanas y formularios | Las 17 ventanas de administración, aula y personal comparten un diálogo nativo con navegación de foco, Escape, devolución del foco y bloqueo del fondo. Se asociaron etiquetas a los campos y se añadieron nombres a controles de cierre. |
| Catálogo compartible | Los filtros, el orden y la selección para comparar viven en la URL. Se conservan al recargar y volver desde otra página. |
| Comparación | Hasta tres programas con nivel, duración, inversión de la próxima edición, modalidad, inicio y horario. Tabla desplazable con primera columna fija. |
| Borradores de entrega | Los enlaces y comentarios se conservan por usuario y evaluación en la pestaña. Se recuperan al volver y se eliminan tras una entrega exitosa. Un error conserva el borrador. |
| Móvil | Barra inferior con accesos según el rol, espacio para el área segura y contenido desplazable sin quedar detrás de los accesos. |
| Tema e impresión | Se corrigió el contraste del campus oscuro. Los diálogos conservan estilos para impresión de asistencia y notas. |

## Alcance de validación

Las pruebas `frontend/e2e/frontend-improvements.spec.mjs` usan respuestas de API simuladas. Comprueban recorridos y errores de interfaz sin crear matrículas, enviar avisos ni modificar datos reales. Incluyen escritorio, móvil, anchos de 320/768/1440 px, tema oscuro, movimiento reducido, foco, formularios, aislamiento de borradores y ausencia de errores JavaScript.

Comandos:

```powershell
npm run lint --prefix frontend
npm run typecheck --prefix frontend
# Compilación de producción ejecutada con Docker y las NEXT_PUBLIC_* del contenedor activo.
cd frontend
$env:PLAYWRIGHT_BASE_URL='http://localhost:3005'
npx playwright test e2e/frontend-improvements.spec.mjs --no-deps --project=chrome --project=mobile --workers=2 --reporter=line
```

## Límites

- Los borradores duran la sesión de la pestaña y no se sincronizan con otros dispositivos. Los archivos adjuntos deben volver a seleccionarse al regresar.
- Los enlaces internos muestran confirmación de salida; recargar/cerrar usa la advertencia nativa. Volver/Adelante del navegador conserva el texto guardado, pero no bloquea la navegación de la aplicación.
- La comparación usa la próxima edición disponible y los datos públicos del catálogo; no reserva cupos.
- La validación automatizada de entregas usa una API simulada; no sustituye una prueba de proveedores externos ni una auditoría completa de accesibilidad.

## Docker

Se conserva la imagen anterior con la etiqueta `orm-academia_virtual-frontend:before-frontend-20261110`. La imagen candidata se comprueba en un contenedor temporal antes de actualizar `academia_virtual_frontend`. La actualización no requiere migraciones ni modificar volúmenes.

Resultado final:

- Lint: aprobado sin errores ni advertencias.
- TypeScript: aprobado.
- Compilación de producción Docker: aprobada; 52 páginas estáticas generadas.
- Playwright: 31 pruebas aprobadas y una omitida por repetir los tamaños adicionales del proyecto de escritorio.
- Revisión visual: comparador, curso, navegación móvil y campus oscuro; ajustes de foco y contraste verificados.
- Despliegue: `academia_virtual_frontend` actualizado y saludable, imagen `sha256:dbbcaa754da837db27622fad3bfa9a5a85560987f427d52a473b11639c10869a`.
- Backend, PostgreSQL y ClamAV saludables; túnel Cloudflare en ejecución.
- Comprobación posterior en `http://localhost:3002/cursos`: HTTP 200, nueve programas reales mostrados, comparador operativo y cero errores JavaScript.
- El contenedor temporal de validación fue retirado. Se conserva la imagen anterior para reversión.
