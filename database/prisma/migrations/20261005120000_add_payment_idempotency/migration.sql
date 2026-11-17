ALTER TABLE "payments" ADD COLUMN "idempotency_key" VARCHAR(64);

CREATE UNIQUE INDEX "payments_idempotency_key_key"
ON "payments"("idempotency_key");
