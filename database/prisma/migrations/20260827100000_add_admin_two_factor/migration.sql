ALTER TABLE "users"
  ADD COLUMN "two_factor_enabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "two_factor_secret" VARCHAR(64);

ALTER TABLE "platform_settings"
  ADD COLUMN "certificate_template" JSONB;
