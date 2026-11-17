# Matriz de permisos por rol

La autorización se valida en backend con `JwtAuthGuard`, `RolesGuard` y `PermissionsGuard`. La interfaz solo oculta opciones; nunca sustituye estas validaciones.

| Módulo | ADMIN | RRHH | DOCENTE | ESTUDIANTE |
| --- | --- | --- | --- | --- |
| Usuarios | CRUD | Consultar | Consultar | Sin acceso |
| Cursos y cohortes | CRUD | Consulta operativa | Consulta solo de cursos/cohortes asignados | Catálogo y cursos matriculados |
| Matrículas | CRUD | Crear/consultar/actualizar | Consultar estudiantes de sus cohortes | Consultar las propias |
| Pagos | Consultar/aprobar/rechazar | Consultar/aprobar/rechazar | Sin acceso | Crear checkout y subir comprobante |
| Materiales | CRUD | Sin acceso | CRUD de sus clases | Consultar materiales de sus matrículas |
| Evaluaciones y notas | CRUD | Sin acceso | Crear/editar/calificar en sus cohortes | Entregar y consultar sus notas |
| Asistencia | CRUD | Consultar | Registrar en sus cohortes | Consultar la propia |
| Contratos y RRHH | CRUD | CRUD | Consultar/firmar su contrato | Sin acceso |
| Certificados | Generar/gestionar | Generar/consultar | Generar según notas de sus cohortes | Consultar/descargar los propios |
| Reportes y auditoría | Consultar | Métricas operativas | Sin acceso global | Sin acceso |
| Foros y mensajería | Moderar/gestionar | Según permiso | Gestionar foros de sus cursos | Participar en cursos matriculados |

La asignación inicial está en `database/prisma/seed.ts`. Cualquier permiso nuevo debe añadirse al seed, proteger el controlador correspondiente y cubrirse con una prueba de autorización.
