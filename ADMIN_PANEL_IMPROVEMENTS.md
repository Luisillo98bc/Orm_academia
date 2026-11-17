# Mejoras del panel de administración

Revisión: 13 de noviembre de 2026.

## Diseño y navegación

- Estilos administrativos consistentes para encabezados, indicadores, tablas y filtros.
- Navegación por ubicación y favoritos guardados por cuenta en el navegador.
- Accesos administrativos a asistencia y nómina; navegación compartida entre áreas de RR. HH.
- Menú móvil con diálogo accesible, cierre con Escape y control del foco.
- Pestañas con navegación por teclado, etiquetas y estados seleccionados.
- Corrección del desbordamiento de Matrículas en móvil y de las transiciones de color al cambiar de tema.

## Cambios por módulo

| Módulo | Mejoras implementadas |
| --- | --- |
| Inicio | Resumen separado en prioridades, calidad de datos e ingresos; actualización de indicadores y comparación de meses disponibles. |
| Cursos | Información por completar, filtro de incompletos y vista previa con objetivos y requisitos. |
| Usuarios | Búsqueda paginada en el servidor y ficha con datos, matrículas y actividad. |
| Cohortes | Filtros por estado, curso/cohorte/docente, indicadores y barras de ocupación. |
| Calendario | Filtros por curso y cohorte, resumen del mes, agenda y recuperación ante errores. |
| Matrículas | Relación visible entre inscripción, pago y acceso; confirmaciones consistentes y búsqueda desde la ficha de usuario. |
| Prospectos | Tablero por etapas, selección de ficha y prioridad visual de seguimientos vencidos. |
| Pagos | Búsqueda y método de pago en el servidor; antigüedad, errores con reintento y revisión accesible del comprobante. |
| Certificados | Filtro por cohorte y plantilla consultable sin ocupar permanentemente el área de trabajo. |
| Personal | Resumen del directorio, recuperación ante errores y accesos entre áreas de RR. HH. |
| Asistencia | Resumen diario, filtros y consulta mensual de registros agrupados por trabajador. |
| Nómina | Indicadores del período, filtro de estado de la página y confirmación antes de registrar un pago. |
| Contratos | Filtro de estados y consulta del PDF protegido dentro del panel. |
| Mis contratos | Pasos de revisión/firma, pendientes destacados y vista del documento. |
| Mensajes | Contactos con mensajes sin leer, filtro de roles y búsqueda dentro del historial cargado. |
| Anuncios | Borradores, vista previa, filtros por visibilidad y consulta administrativa separada de los anuncios públicos. |
| Foros | Búsqueda de temas, filtro sin respuestas y orden por actividad o título. |
| Reportes | Pestañas de gráficos/exportación, finanzas, seguimiento académico, conversión y comunicación. |
| Notificaciones | Resumen, filtro por tipo de la página y confirmación del servidor al marcar lecturas. |
| Soporte | Prioridades, responsables visibles y formulario de nueva solicitud desplegable para administración. |
| Automatizaciones | Explicación por proceso, próxima ejecución local y últimos resultados. |
| Auditoría | Acciones legibles y detalle de eventos con valores registrados por el servidor. |
| Estado del sistema | Resumen operativo y diagnóstico técnico desplegable. |
| Papelera | Presentación uniforme, búsquedas, paginación y confirmación de restauración. |
| Configuración | Secciones por pestañas, vistas previas y protección de cambios sin guardar. |
| Perfil | Completitud de ficha, campos faltantes, etiquetas asociadas y acceso a las secciones personales y de seguridad. |

## Verificación

- 26 pantallas administrativas recorridas en escritorio y móvil, sin errores de ejecución ni desbordamiento horizontal del área principal.
- Flujos de usuarios, cursos, cohortes, matrículas, prospectos, pagos, asistencia, contratos, nómina, anuncios, mensajes, soporte, papelera y configuración verificados con Playwright.
- Modo oscuro, movimiento reducido y anchos de 375, 768 y 1440 píxeles comprobados.
- Suite del backend: 89 suites y 454 pruebas aprobadas.
- Suite de interfaz y regresión: 59 pruebas aprobadas; una omitida porque el acceso móvil no aplica a escritorio.
- Comprobaciones de tipos, lint y compilación del frontend y backend.
- La compilación de verificación del frontend utiliza `NEXT_PUBLIC_SITE_URL=http://localhost:3102` únicamente en el proceso de compilación local.

## Alcance de los datos

- Las pruebas de interfaz interceptan la API y utilizan datos de prueba. No validan una base de producción ni envían comunicaciones reales.
- Los indicadores y filtros que trabajan sobre una página lo indican en pantalla. La búsqueda de usuarios y pagos abarca la colección desde el servidor.
- La asistencia mensual cuenta registros existentes; no convierte días sin marcar en ausencias.
- El historial de automatizaciones conserva hasta 20 ejecuciones de la instancia actual y se reinicia con el proceso.
- La administración de anuncios consulta los 200 registros más recientes.
- No se requieren migraciones nuevas ni dependencias adicionales para estos cambios.
