ALTER TABLE "enrollments" ADD COLUMN "reservation_expires_at" TIMESTAMP(3);
UPDATE "enrollments"
SET "reservation_expires_at" = "created_at" + INTERVAL '48 hours'
WHERE "status" = 'PENDING_PAYMENT' AND "deleted_at" IS NULL;
CREATE INDEX "enrollments_cohort_id_status_reservation_expires_at_idx"
ON "enrollments"("cohort_id", "status", "reservation_expires_at");

ALTER TABLE "payments"
  ADD COLUMN "culqi_order_id" VARCHAR(40),
  ADD COLUMN "culqi_charge_id" VARCHAR(40),
  ADD COLUMN "culqi_event_id" VARCHAR(50),
  ADD COLUMN "charge_attempt_key" VARCHAR(80),
  ADD COLUMN "charge_started_at" TIMESTAMP(3);

CREATE UNIQUE INDEX "payments_culqi_order_id_key" ON "payments"("culqi_order_id");
CREATE UNIQUE INDEX "payments_culqi_charge_id_key" ON "payments"("culqi_charge_id");
CREATE UNIQUE INDEX "payments_culqi_event_id_key" ON "payments"("culqi_event_id");
