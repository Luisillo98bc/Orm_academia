ALTER TABLE "payments"
  ADD COLUMN "rejected_at" TIMESTAMP(3),
  ADD COLUMN "rejection_reason" VARCHAR(500);

INSERT INTO "permissions" ("id", "action", "subject", "description", "created_at", "updated_at") VALUES
  (gen_random_uuid(), 'read', 'reports', 'Consultar reportes', NOW(), NOW()),
  (gen_random_uuid(), 'read', 'rrhh', 'Consultar información de RRHH', NOW(), NOW()),
  (gen_random_uuid(), 'update', 'rrhh', 'Gestionar información de RRHH', NOW(), NOW())
ON CONFLICT ("action", "subject") DO NOTHING;
INSERT INTO "role_permissions" ("id", "role_id", "permission_id", "assigned_at")
SELECT gen_random_uuid(), r.id, p.id, NOW() FROM "roles" r CROSS JOIN "permissions" p WHERE r.name = 'ADMIN'
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
INSERT INTO "role_permissions" ("id", "role_id", "permission_id", "assigned_at")
SELECT gen_random_uuid(), r.id, p.id, NOW() FROM "roles" r JOIN "permissions" p ON p.subject = 'rrhh' WHERE r.name = 'RRHH'
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
