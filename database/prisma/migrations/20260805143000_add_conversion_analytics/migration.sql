CREATE TABLE "conversion_events" (
    "id" UUID NOT NULL,
    "session_id" VARCHAR(64) NOT NULL,
    "event" VARCHAR(50) NOT NULL,
    "path" VARCHAR(500),
    "cohort_id" UUID,
    "payment_id" UUID,
    "metadata" JSONB,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "conversion_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "conversion_events_event_occurred_at_idx" ON "conversion_events"("event", "occurred_at");
CREATE INDEX "conversion_events_session_id_occurred_at_idx" ON "conversion_events"("session_id", "occurred_at");
CREATE INDEX "conversion_events_cohort_id_event_idx" ON "conversion_events"("cohort_id", "event");
