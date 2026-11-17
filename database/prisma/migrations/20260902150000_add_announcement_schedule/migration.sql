ALTER TABLE "announcements"
  ADD COLUMN "landing_starts_at" TIMESTAMP(3),
  ADD COLUMN "landing_ends_at" TIMESTAMP(3);

CREATE INDEX "announcements_landing_schedule_idx"
  ON "announcements"("show_on_landing", "is_active", "landing_starts_at", "landing_ends_at");
