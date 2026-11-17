-- Existing day-only sessions are interpreted as midnight in Lima; new sessions retain the exact instant.
ALTER TABLE "class_sessions" ALTER COLUMN "date" TYPE TIMESTAMPTZ(3) USING ("date"::timestamp AT TIME ZONE 'America/Lima');
ALTER TABLE "class_sessions" ADD COLUMN "duration_minutes" INTEGER NOT NULL DEFAULT 60,
  ADD COLUMN "time_zone" VARCHAR(80) NOT NULL DEFAULT 'America/Lima';
ALTER TABLE "evaluations" ADD COLUMN "kind" VARCHAR(20) NOT NULL DEFAULT 'ASSIGNMENT',
  ADD COLUMN "allow_resubmit" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "allow_late" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "rubric" JSONB, ADD COLUMN "quiz" JSONB,
  ADD COLUMN "max_attempts" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "time_limit_minutes" INTEGER NOT NULL DEFAULT 30;
ALTER TABLE "grades" ADD COLUMN "rubric_scores" JSONB;
CREATE TABLE "classroom_posts" (
  "id" UUID PRIMARY KEY, "cohort_id" UUID NOT NULL REFERENCES "cohorts"("id") ON DELETE CASCADE,
  "author_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "title" VARCHAR(200) NOT NULL, "content" TEXT NOT NULL, "pinned" BOOLEAN NOT NULL DEFAULT false,
  "published_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "deleted_at" TIMESTAMP(3)
);
CREATE INDEX "classroom_posts_cohort_id_published_at_idx" ON "classroom_posts"("cohort_id", "published_at");
CREATE TABLE "classroom_questions" (
  "id" UUID PRIMARY KEY, "cohort_id" UUID NOT NULL REFERENCES "cohorts"("id") ON DELETE CASCADE,
  "prompt" TEXT NOT NULL, "options" JSONB NOT NULL, "correct_index" INTEGER NOT NULL,
  "points" DOUBLE PRECISION NOT NULL DEFAULT 1, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "classroom_questions_cohort_id_idx" ON "classroom_questions"("cohort_id");
CREATE TABLE "quiz_attempts" (
  "id" UUID PRIMARY KEY, "evaluation_id" UUID NOT NULL REFERENCES "evaluations"("id") ON DELETE RESTRICT,
  "student_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE, "number" INTEGER NOT NULL,
  "questions" JSONB NOT NULL, "answers" JSONB NOT NULL, "max_score" DOUBLE PRECISION NOT NULL,
  "score" DOUBLE PRECISION, "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMP(3) NOT NULL, "submitted_at" TIMESTAMP(3),
  CONSTRAINT "quiz_attempts_evaluation_id_student_id_number_key" UNIQUE ("evaluation_id", "student_id", "number")
);
CREATE INDEX "quiz_attempts_student_id_evaluation_id_idx" ON "quiz_attempts"("student_id", "evaluation_id");
CREATE TABLE "submission_revisions" (
  "id" UUID PRIMARY KEY, "deliverable_id" UUID NOT NULL REFERENCES "deliverables"("id") ON DELETE CASCADE,
  "file_url" VARCHAR(1000) NOT NULL, "file_name" VARCHAR(255), "comment" TEXT,
  "status" VARCHAR(20) NOT NULL, "grade_snapshot" JSONB, "submitted_at" TIMESTAMP(3) NOT NULL,
  "archived_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "submission_revisions_deliverable_id_archived_at_idx" ON "submission_revisions"("deliverable_id", "archived_at");
-- Repair databases where roles were seeded after the historical permission migration ran.
INSERT INTO "permissions" ("id", "action", "subject", "description", "created_at", "updated_at")
VALUES (gen_random_uuid(), 'submit', 'evaluations', 'Entregar evaluaciones', NOW(), NOW())
ON CONFLICT ("action", "subject") DO NOTHING;
INSERT INTO "role_permissions" ("id", "role_id", "permission_id", "assigned_at")
SELECT gen_random_uuid(), r.id, p.id, NOW() FROM "roles" r CROSS JOIN "permissions" p
WHERE r.name IN ('ADMIN','ESTUDIANTE') AND p.subject='evaluations' AND p.action='submit'
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
