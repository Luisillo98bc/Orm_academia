-- AlterTable
ALTER TABLE "cohorts" ADD COLUMN IF NOT EXISTS "installments" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "payments"
  ADD COLUMN IF NOT EXISTS "installment_number" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "total_installments" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "paid_installments" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "next_due_date" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "installment_history" JSONB;

-- Backfill multi-month cohorts (> 50 days duration) with monthly installments count
UPDATE "cohorts"
SET "installments" = GREATEST(2, LEAST(12, ROUND(EXTRACT(EPOCH FROM ("end_date" - "start_date")) / (86400 * 30))::integer))
WHERE "installments" = 1 AND ("end_date" - "start_date") >= INTERVAL '50 days';

-- Backfill paid_installments = 1 for already completed payments
UPDATE "payments"
SET "paid_installments" = 1,
    "next_due_date" = COALESCE("validated_at", "created_at") + INTERVAL '30 days'
WHERE "status" = 'COMPLETED' AND "paid_installments" = 0;

-- Sync total_installments with cohort.installments for existing payments
UPDATE "payments" p
SET "total_installments" = c."installments"
FROM "enrollments" e
JOIN "cohorts" c ON c."id" = e."cohort_id"
WHERE p."enrollment_id" = e."id" AND p."total_installments" = 1 AND c."installments" > 1;
