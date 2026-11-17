CREATE TABLE "material_progress" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "material_id" UUID NOT NULL,
  "completed_at" TIMESTAMP(3),
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "material_progress_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "material_progress_user_id_material_id_key" ON "material_progress"("user_id", "material_id");
CREATE INDEX "material_progress_user_id_idx" ON "material_progress"("user_id");
ALTER TABLE "material_progress" ADD CONSTRAINT "material_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "material_progress" ADD CONSTRAINT "material_progress_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "permissions" ("id", "action", "subject", "description", "created_at", "updated_at")
VALUES
  (gen_random_uuid(), 'read', 'prospects', 'Consultar prospectos', NOW(), NOW()),
  (gen_random_uuid(), 'update', 'prospects', 'Gestionar prospectos', NOW(), NOW()),
  (gen_random_uuid(), 'update', 'settings', 'Editar configuración institucional', NOW(), NOW()),
  (gen_random_uuid(), 'read', 'payments', 'Consultar pagos', NOW(), NOW()),
  (gen_random_uuid(), 'update', 'payments', 'Aprobar pagos', NOW(), NOW())
ON CONFLICT ("action", "subject") DO NOTHING;

INSERT INTO "role_permissions" ("id", "role_id", "permission_id", "assigned_at")
SELECT gen_random_uuid(), r.id, p.id, NOW()
FROM "roles" r CROSS JOIN "permissions" p
WHERE r.name = 'ADMIN'
ON CONFLICT ("role_id", "permission_id") DO NOTHING;

INSERT INTO "role_permissions" ("id", "role_id", "permission_id", "assigned_at")
SELECT gen_random_uuid(), r.id, p.id, NOW()
FROM "roles" r JOIN "permissions" p
  ON (p.subject = 'prospects' AND p.action IN ('read', 'update'))
  OR (p.subject = 'payments' AND p.action IN ('read', 'update'))
WHERE r.name = 'RRHH'
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
