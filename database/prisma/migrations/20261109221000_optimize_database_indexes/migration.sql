-- Drop redundant non-unique indexes that duplicate existing @unique constraints
DROP INDEX IF EXISTS "users_email_idx";
DROP INDEX IF EXISTS "courses_code_idx";
DROP INDEX IF EXISTS "certificates_code_idx";
DROP INDEX IF EXISTS "certificates_enrollment_id_type_idx";

-- Create performance indexes for hot query paths
CREATE INDEX IF NOT EXISTS "users_is_active_deleted_at_idx" ON "users"("is_active", "deleted_at");
CREATE INDEX IF NOT EXISTS "courses_is_published_deleted_at_idx" ON "courses"("is_published", "deleted_at");
CREATE INDEX IF NOT EXISTS "cohorts_is_active_deleted_at_end_date_idx" ON "cohorts"("is_active", "deleted_at", "end_date");
CREATE INDEX IF NOT EXISTS "payments_status_updated_at_idx" ON "payments"("status", "updated_at");
CREATE INDEX IF NOT EXISTS "payments_voucher_url_idx" ON "payments"("voucher_url");
CREATE INDEX IF NOT EXISTS "materials_file_url_idx" ON "materials"("file_url");
CREATE INDEX IF NOT EXISTS "class_sessions_module_id_date_idx" ON "class_sessions"("module_id", "date");
CREATE INDEX IF NOT EXISTS "deliverables_file_url_idx" ON "deliverables"("file_url");
CREATE INDEX IF NOT EXISTS "forums_cohort_id_is_active_idx" ON "forums"("cohort_id", "is_active");
CREATE INDEX IF NOT EXISTS "forum_messages_forum_id_parent_id_created_at_idx" ON "forum_messages"("forum_id", "parent_id", "created_at");
