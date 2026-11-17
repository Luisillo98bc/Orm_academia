import "dotenv/config";

// ============================================================================
// Seed — Datos iniciales de RBAC
//
// Crea roles base (ADMIN, DOCENTE, ESTUDIANTE), permisos granulares,
// y un usuario administrador por defecto.
// ============================================================================

import { PrismaClient } from "../../backend/node_modules/@prisma/client";
import * as bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Iniciando seed de datos...");

  // ── 1. Crear Permisos ──
  const permissionsData = [
    { action: "submit", subject: "evaluations", description: "Entregar evaluaciones" },
    // Usuarios
    { action: "create", subject: "users", description: "Crear usuarios" },
    { action: "read", subject: "users", description: "Ver usuarios" },
    { action: "update", subject: "users", description: "Actualizar usuarios" },
    { action: "delete", subject: "users", description: "Eliminar usuarios" },
    // Roles
    { action: "create", subject: "roles", description: "Crear roles" },
    { action: "read", subject: "roles", description: "Ver roles" },
    { action: "update", subject: "roles", description: "Actualizar roles" },
    { action: "delete", subject: "roles", description: "Eliminar roles" },
    // Cursos
    { action: "create", subject: "courses", description: "Crear cursos" },
    { action: "read", subject: "courses", description: "Ver cursos" },
    { action: "update", subject: "courses", description: "Actualizar cursos" },
    { action: "delete", subject: "courses", description: "Eliminar cursos" },
    // Matrículas
    {
      action: "create",
      subject: "enrollments",
      description: "Crear matrículas",
    },
    { action: "read", subject: "enrollments", description: "Ver matrículas" },
    {
      action: "update",
      subject: "enrollments",
      description: "Actualizar matrículas",
    },
    {
      action: "delete",
      subject: "enrollments",
      description: "Eliminar matrículas",
    },
    // Auditoría
    {
      action: "read",
      subject: "audit_logs",
      description: "Ver logs de auditoría",
    },
    {
      action: "read",
      subject: "prospects",
      description: "Consultar prospectos",
    },
    {
      action: "update",
      subject: "prospects",
      description: "Gestionar prospectos",
    },
    {
      action: "update",
      subject: "settings",
      description: "Editar configuración institucional",
    },
    { action: "read", subject: "payments", description: "Consultar pagos" },
    { action: "update", subject: "payments", description: "Aprobar pagos" },
    // Contenido académico y comunicación
    {
      action: "update",
      subject: "evaluations",
      description: "Gestionar evaluaciones y calificaciones",
    },
    {
      action: "update",
      subject: "communications",
      description: "Gestionar anuncios institucionales",
    },
  ];

  const permissions = await Promise.all(
    permissionsData.map((p) =>
      prisma.permission.upsert({
        where: { action_subject: { action: p.action, subject: p.subject } },
        update: {},
        create: p,
      }),
    ),
  );

  console.log(`  ✅ ${permissions.length} permisos creados/verificados`);

  // ── 2. Crear Roles ──
  const adminRole = await prisma.role.upsert({
    where: { name: "ADMIN" },
    update: {},
    create: {
      name: "ADMIN",
      description: "Administrador del sistema con acceso completo",
    },
  });

  const docenteRole = await prisma.role.upsert({
    where: { name: "DOCENTE" },
    update: {},
    create: {
      name: "DOCENTE",
      description: "Docente con acceso a gestión de cursos y estudiantes",
    },
  });

  const estudianteRole = await prisma.role.upsert({
    where: { name: "ESTUDIANTE" },
    update: {},
    create: {
      name: "ESTUDIANTE",
      description: "Estudiante con acceso a cursos matriculados",
    },
  });

  const rrhhRole = await prisma.role.upsert({
    where: { name: "RRHH" },
    update: {},
    create: {
      name: "RRHH",
      description: "Recursos Humanos: Gestión de personal, contratos y nómina",
    },
  });

  console.log(
    "  ✅ Roles ADMIN, DOCENTE, ESTUDIANTE, RRHH creados/verificados",
  );

  // ── 3. Asignar Permisos a Roles ──
  // ADMIN: todos los permisos
  for (const perm of permissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: adminRole.id,
          permissionId: perm.id,
        },
      },
      update: {},
      create: {
        roleId: adminRole.id,
        permissionId: perm.id,
      },
    });
  }

  // DOCENTE: leer usuarios, CRUD cursos, leer matrículas
  const docentePermissions = permissions.filter(
    (p) =>
      (p.subject === "users" && p.action === "read") ||
      p.subject === "courses" ||
      (p.subject === "evaluations" && p.action === "update") ||
      (p.subject === "enrollments" && p.action === "read"),
  );

  for (const perm of docentePermissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: docenteRole.id,
          permissionId: perm.id,
        },
      },
      update: {},
      create: {
        roleId: docenteRole.id,
        permissionId: perm.id,
      },
    });
  }

  // ESTUDIANTE: leer cursos, leer/crear matrículas
  const rrhhPermissions = permissions.filter(
    (permission) =>
      ["users", "enrollments", "prospects", "payments"].includes(
        permission.subject,
      ) && ["read", "update"].includes(permission.action),
  );
  for (const permission of rrhhPermissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: rrhhRole.id,
          permissionId: permission.id,
        },
      },
      update: {},
      create: { roleId: rrhhRole.id, permissionId: permission.id },
    });
  }

  const estudiantePermissions = permissions.filter(
    (p) =>
      (p.subject === "evaluations" && p.action === "submit") ||
      (p.subject === "courses" && p.action === "read") ||
      (p.subject === "enrollments" && ["read", "create"].includes(p.action)),
  );

  for (const perm of estudiantePermissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: estudianteRole.id,
          permissionId: perm.id,
        },
      },
      update: {},
      create: {
        roleId: estudianteRole.id,
        permissionId: perm.id,
      },
    });
  }

  console.log("  ✅ Permisos asignados a roles");

  // ── 4. Crear Usuario Administrador por defecto ──
  const initialAdminEmail = (
    process.env.INITIAL_ADMIN_EMAIL || "admin@academia.edu"
  )
    .trim()
    .toLowerCase();
  const configuredAdminPassword = process.env.INITIAL_ADMIN_PASSWORD?.trim();
  const isProduction = process.env.NODE_ENV === "production";

  if (isProduction && !configuredAdminPassword) {
    throw new Error(
      "INITIAL_ADMIN_PASSWORD es obligatoria cuando NODE_ENV=production",
    );
  }

  if (isProduction && configuredAdminPassword === "Admin@1234") {
    throw new Error(
      "INITIAL_ADMIN_PASSWORD no puede usar la credencial de desarrollo",
    );
  }

  const initialAdminPassword = configuredAdminPassword || "Admin@1234";
  const adminPasswordHash = await bcrypt.hash(initialAdminPassword, 10);

  const adminUser = await prisma.user.upsert({
    where: { email: initialAdminEmail },
    update: {},
    create: {
      email: initialAdminEmail,
      passwordHash: adminPasswordHash,
      firstName: "Admin",
      lastName: "Sistema",
      isActive: true,
      emailVerifiedAt: new Date(),
    },
  });

  // Asignar rol ADMIN al usuario
  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: adminUser.id,
        roleId: adminRole.id,
      },
    },
    update: {},
    create: {
      userId: adminUser.id,
      roleId: adminRole.id,
    },
  });

  console.log(`  ✅ Usuario administrador creado/verificado: ${initialAdminEmail}`);
  if (!configuredAdminPassword) {
    console.log(
      "  ℹ️ Se usó la contraseña de desarrollo. No uses este seed sin INITIAL_ADMIN_PASSWORD en producción.",
    );
  }

  // ── 5. Registrar en Audit Log ──
  await prisma.auditLog.create({
    data: {
      userId: adminUser.id,
      action: "SEED",
      entity: "System",
      newValue: { message: "Seed de datos iniciales ejecutado correctamente" },
    },
  });

  console.log("  ✅ Audit log registrado");
  console.log("\n🎉 Seed completado exitosamente");
}

main()
  .catch((e) => {
    console.error("❌ Error en seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
