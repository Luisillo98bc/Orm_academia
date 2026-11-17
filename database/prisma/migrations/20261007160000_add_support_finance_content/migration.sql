CREATE TYPE "SupportTicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'WAITING_USER', 'RESOLVED', 'CLOSED');
CREATE TYPE "SupportTicketPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

CREATE TABLE "support_tickets" (
  "id" UUID NOT NULL,
  "requester_id" UUID NOT NULL,
  "assignee_id" UUID,
  "subject" VARCHAR(200) NOT NULL,
  "description" TEXT NOT NULL,
  "category" VARCHAR(50) NOT NULL DEFAULT 'GENERAL',
  "status" "SupportTicketStatus" NOT NULL DEFAULT 'OPEN',
  "priority" "SupportTicketPriority" NOT NULL DEFAULT 'NORMAL',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "last_message_at" TIMESTAMP(3),
  "closed_at" TIMESTAMP(3),
  CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "support_tickets_requester_id_status_idx" ON "support_tickets"("requester_id", "status");
CREATE INDEX "support_tickets_assignee_id_status_idx" ON "support_tickets"("assignee_id", "status");
CREATE INDEX "support_tickets_status_priority_updated_at_idx" ON "support_tickets"("status", "priority", "updated_at");
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "support_ticket_messages" (
  "id" UUID NOT NULL,
  "ticket_id" UUID NOT NULL,
  "author_id" UUID NOT NULL,
  "body" TEXT NOT NULL,
  "internal_note" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "support_ticket_messages_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "support_ticket_messages_ticket_id_created_at_idx" ON "support_ticket_messages"("ticket_id", "created_at");
ALTER TABLE "support_ticket_messages" ADD CONSTRAINT "support_ticket_messages_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "support_ticket_messages" ADD CONSTRAINT "support_ticket_messages_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "operating_costs" (
  "id" UUID NOT NULL,
  "course_id" UUID,
  "cohort_id" UUID,
  "created_by_id" UUID NOT NULL,
  "label" VARCHAR(200) NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "period_start" TIMESTAMP(3) NOT NULL,
  "period_end" TIMESTAMP(3),
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "operating_costs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "operating_costs_period_start_period_end_idx" ON "operating_costs"("period_start", "period_end");
CREATE INDEX "operating_costs_course_id_idx" ON "operating_costs"("course_id");
CREATE INDEX "operating_costs_cohort_id_idx" ON "operating_costs"("cohort_id");
ALTER TABLE "operating_costs" ADD CONSTRAINT "operating_costs_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "operating_costs" ADD CONSTRAINT "operating_costs_cohort_id_fkey" FOREIGN KEY ("cohort_id") REFERENCES "cohorts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "operating_costs" ADD CONSTRAINT "operating_costs_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "content_versions" (
  "id" UUID NOT NULL,
  "entity_type" VARCHAR(50) NOT NULL,
  "entity_id" UUID NOT NULL,
  "version" INTEGER NOT NULL,
  "snapshot" JSONB NOT NULL,
  "created_by_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "content_versions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "content_versions_entity_type_entity_id_version_key" ON "content_versions"("entity_type", "entity_id", "version");
CREATE INDEX "content_versions_entity_type_entity_id_created_at_idx" ON "content_versions"("entity_type", "entity_id", "created_at");
ALTER TABLE "content_versions" ADD CONSTRAINT "content_versions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
