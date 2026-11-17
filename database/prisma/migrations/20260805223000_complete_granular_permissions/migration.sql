INSERT INTO "permissions" ("id", "action", "subject", "description", "created_at", "updated_at") VALUES
 (gen_random_uuid(), 'read', 'communications', 'Consultar comunicaciones', NOW(), NOW()),
 (gen_random_uuid(), 'update', 'communications', 'Gestionar comunicaciones', NOW(), NOW()),
 (gen_random_uuid(), 'read', 'evaluations', 'Consultar evaluaciones', NOW(), NOW()),
 (gen_random_uuid(), 'update', 'evaluations', 'Crear y calificar evaluaciones', NOW(), NOW()),
 (gen_random_uuid(), 'submit', 'evaluations', 'Entregar evaluaciones', NOW(), NOW())
ON CONFLICT ("action", "subject") DO NOTHING;
INSERT INTO "role_permissions" ("id", "role_id", "permission_id", "assigned_at")
SELECT gen_random_uuid(), r.id, p.id, NOW() FROM "roles" r CROSS JOIN "permissions" p WHERE r.name = 'ADMIN'
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
INSERT INTO "role_permissions" ("id", "role_id", "permission_id", "assigned_at")
SELECT gen_random_uuid(), r.id, p.id, NOW() FROM "roles" r JOIN "permissions" p ON
 (r.name = 'DOCENTE' AND p.subject IN ('communications','evaluations')) OR
 (r.name = 'ESTUDIANTE' AND ((p.subject = 'communications' AND p.action = 'read') OR (p.subject = 'evaluations' AND p.action IN ('read','submit')))) OR
 (r.name = 'RRHH' AND p.action = 'read' AND p.subject IN ('communications','evaluations'))
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
