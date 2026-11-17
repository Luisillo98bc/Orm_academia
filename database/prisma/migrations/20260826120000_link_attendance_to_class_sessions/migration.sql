ALTER TABLE "class_attendances"
ADD COLUMN "session_id" UUID;

-- Vincula históricos solo cuando hay una sesión inequívoca ese día.
UPDATE "class_attendances" AS ca
SET "session_id" = cs.id
FROM "class_sessions" AS cs
INNER JOIN "syllabus_modules" AS sm ON sm.id = cs.module_id
WHERE sm.cohort_id = ca.cohort_id
  AND cs.date = ca.date
  AND ca.session_id IS NULL
  AND (
    SELECT COUNT(*)
    FROM "class_sessions" AS cs_same_day
    INNER JOIN "syllabus_modules" AS sm_same_day
      ON sm_same_day.id = cs_same_day.module_id
    WHERE sm_same_day.cohort_id = ca.cohort_id
      AND cs_same_day.date = ca.date
  ) = 1;

DROP INDEX IF EXISTS "class_attendances_cohort_id_student_id_date_key";

CREATE UNIQUE INDEX "class_attendances_session_id_student_id_key"
ON "class_attendances"("session_id", "student_id");

CREATE INDEX "class_attendances_cohort_id_date_idx"
ON "class_attendances"("cohort_id", "date");

CREATE INDEX "class_attendances_session_id_idx"
ON "class_attendances"("session_id");

ALTER TABLE "class_attendances"
ADD CONSTRAINT "class_attendances_session_id_fkey"
FOREIGN KEY ("session_id") REFERENCES "class_sessions"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
