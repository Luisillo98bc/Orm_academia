CREATE TYPE "ProspectStatus" AS ENUM ('NEW', 'CONTACTED', 'INTERESTED', 'ENROLLED', 'LOST');

ALTER TABLE "platform_settings"
ADD COLUMN "academy_name" VARCHAR(150) NOT NULL DEFAULT 'Academia Virtual',
ADD COLUMN "legal_name" VARCHAR(200),
ADD COLUMN "tax_id" VARCHAR(30),
ADD COLUMN "tagline" VARCHAR(250),
ADD COLUMN "description" TEXT,
ADD COLUMN "favicon_url" VARCHAR(500),
ADD COLUMN "primary_color" VARCHAR(20),
ADD COLUMN "sales_email" VARCHAR(255),
ADD COLUMN "address" VARCHAR(500),
ADD COLUMN "linkedin_url" VARCHAR(500),
ADD COLUMN "hero_eyebrow" VARCHAR(150),
ADD COLUMN "hero_title" VARCHAR(250),
ADD COLUMN "hero_subtitle" TEXT,
ADD COLUMN "terms_url" VARCHAR(500),
ADD COLUMN "privacy_url" VARCHAR(500);

CREATE TABLE "prospects" (
  "id" UUID NOT NULL,
  "name" VARCHAR(200) NOT NULL,
  "email" VARCHAR(255),
  "phone" VARCHAR(50),
  "message" TEXT,
  "source" VARCHAR(50) NOT NULL DEFAULT 'LANDING',
  "status" "ProspectStatus" NOT NULL DEFAULT 'NEW',
  "cohort_id" UUID,
  "assigned_to_id" UUID,
  "next_follow_up_at" TIMESTAMP(3),
  "last_contact_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "prospects_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "prospect_notes" (
  "id" UUID NOT NULL,
  "prospect_id" UUID NOT NULL,
  "author_id" UUID NOT NULL,
  "content" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "prospect_notes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "prospects_status_created_at_idx" ON "prospects"("status", "created_at");
CREATE INDEX "prospects_assigned_to_id_status_idx" ON "prospects"("assigned_to_id", "status");
CREATE INDEX "prospects_next_follow_up_at_idx" ON "prospects"("next_follow_up_at");
CREATE INDEX "prospects_email_idx" ON "prospects"("email");
CREATE INDEX "prospects_phone_idx" ON "prospects"("phone");
CREATE INDEX "prospect_notes_prospect_id_created_at_idx" ON "prospect_notes"("prospect_id", "created_at");

ALTER TABLE "prospects" ADD CONSTRAINT "prospects_cohort_id_fkey" FOREIGN KEY ("cohort_id") REFERENCES "cohorts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "prospects" ADD CONSTRAINT "prospects_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "prospect_notes" ADD CONSTRAINT "prospect_notes_prospect_id_fkey" FOREIGN KEY ("prospect_id") REFERENCES "prospects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "prospect_notes" ADD CONSTRAINT "prospect_notes_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
