CREATE TABLE "cohort_favorites" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "cohort_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cohort_favorites_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cohort_favorites_user_id_cohort_id_key" ON "cohort_favorites"("user_id", "cohort_id");
CREATE INDEX "cohort_favorites_user_id_created_at_idx" ON "cohort_favorites"("user_id", "created_at");
ALTER TABLE "cohort_favorites" ADD CONSTRAINT "cohort_favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cohort_favorites" ADD CONSTRAINT "cohort_favorites_cohort_id_fkey" FOREIGN KEY ("cohort_id") REFERENCES "cohorts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
