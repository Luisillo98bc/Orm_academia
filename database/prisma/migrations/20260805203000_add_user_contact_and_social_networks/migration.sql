ALTER TABLE "users"
  ADD COLUMN "dni" VARCHAR(8),
  ADD COLUMN "phone" VARCHAR(20),
  ADD COLUMN "address" VARCHAR(500),
  ADD COLUMN "district" VARCHAR(100),
  ADD COLUMN "province" VARCHAR(100),
  ADD COLUMN "department" VARCHAR(100);

CREATE UNIQUE INDEX "users_dni_key" ON "users"("dni");

ALTER TABLE "platform_settings"
  ADD COLUMN "youtube_url" VARCHAR(500),
  ADD COLUMN "tiktok_url" VARCHAR(500),
  ADD COLUMN "x_url" VARCHAR(500);
