CREATE TYPE "CertificateType" AS ENUM ('COMPLETION', 'GRADES');

ALTER TABLE "certificates"
ADD COLUMN "type" "CertificateType" NOT NULL DEFAULT 'COMPLETION',
ADD COLUMN "final_grade" DOUBLE PRECISION,
ADD COLUMN "attendance_rate" DOUBLE PRECISION,
ADD COLUMN "template_version" VARCHAR(30) NOT NULL DEFAULT 'v1',
ADD COLUMN "revoked_at" TIMESTAMP(3),
ADD COLUMN "revocation_reason" VARCHAR(500);

DROP INDEX IF EXISTS "certificates_enrollment_id_key";
CREATE INDEX "certificates_enrollment_id_type_idx"
ON "certificates"("enrollment_id", "type");
CREATE UNIQUE INDEX "certificates_enrollment_id_type_key"
ON "certificates"("enrollment_id", "type");

CREATE TYPE "ContractStatus" AS ENUM ('DRAFT', 'SENT', 'SIGNED', 'REJECTED', 'APPROVED', 'EXPIRED', 'CANCELLED');

ALTER TABLE "contracts"
ADD COLUMN "status" "ContractStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN "sent_at" TIMESTAMP(3),
ADD COLUMN "signed_at" TIMESTAMP(3),
ADD COLUMN "signed_by" UUID,
ADD COLUMN "signature_name" VARCHAR(200),
ADD COLUMN "signature_hash" VARCHAR(128),
ADD COLUMN "rejection_reason" VARCHAR(500),
ADD COLUMN "approved_at" TIMESTAMP(3),
ADD COLUMN "approved_by" UUID;

UPDATE "contracts"
SET "status" = CASE WHEN "is_active" = true THEN 'APPROVED'::"ContractStatus" ELSE 'CANCELLED'::"ContractStatus" END,
    "approved_at" = CASE WHEN "is_active" = true THEN "created_at" ELSE NULL END;

ALTER TABLE "contracts"
ALTER COLUMN "is_active" SET DEFAULT false;

CREATE INDEX "contracts_status_idx" ON "contracts"("status");
CREATE INDEX "contracts_is_active_end_date_idx" ON "contracts"("is_active", "end_date");

ALTER TABLE "contracts"
ADD CONSTRAINT "contracts_signed_by_fkey"
FOREIGN KEY ("signed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
ADD CONSTRAINT "contracts_approved_by_fkey"
FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
