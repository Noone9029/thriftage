-- AI Stylist conversations remain separate from buyer/seller messaging. Provider requests use
-- application-owned state; no hidden reasoning or raw provider response dumps are persisted.
CREATE TYPE "AiStylistMessageRole" AS ENUM ('USER', 'ASSISTANT');
CREATE TYPE "AiGenerationStatus" AS ENUM ('PROCESSING', 'SUCCEEDED', 'FALLBACK', 'FAILED', 'CANCELLED', 'REFUSED');
CREATE TYPE "AiProviderCode" AS ENUM ('OPENAI', 'DETERMINISTIC');
CREATE TYPE "AiAttributionEventType" AS ENUM ('OPEN', 'SAVE', 'CHECKOUT', 'PURCHASE');

CREATE TABLE "ai_stylist_conversations" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "title" VARCHAR(120) NOT NULL,
  "context_snapshot" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "archived_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "ai_stylist_conversations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_stylist_messages" (
  "id" UUID NOT NULL,
  "conversation_id" UUID NOT NULL,
  "role" "AiStylistMessageRole" NOT NULL,
  "content" VARCHAR(4000) NOT NULL,
  "assistant_payload" JSONB,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_stylist_messages_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ai_stylist_messages_payload_role_check" CHECK (
    ("role" = 'USER' AND "assistant_payload" IS NULL) OR
    ("role" = 'ASSISTANT' AND "assistant_payload" IS NOT NULL)
  )
);

CREATE TABLE "ai_generations" (
  "id" UUID NOT NULL,
  "conversation_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "client_request_id" UUID NOT NULL,
  "provider" "AiProviderCode" NOT NULL,
  "requested_model" VARCHAR(100) NOT NULL,
  "returned_model" VARCHAR(100),
  "prompt_version" VARCHAR(60) NOT NULL,
  "tool_schema_version" VARCHAR(60) NOT NULL,
  "reasoning_effort" VARCHAR(20) NOT NULL,
  "status" "AiGenerationStatus" NOT NULL DEFAULT 'PROCESSING',
  "input_tokens" INTEGER NOT NULL DEFAULT 0,
  "cached_input_tokens" INTEGER NOT NULL DEFAULT 0,
  "output_tokens" INTEGER NOT NULL DEFAULT 0,
  "estimated_cost_micro_usd" INTEGER NOT NULL DEFAULT 0,
  "latency_ms" INTEGER,
  "tool_call_count" INTEGER NOT NULL DEFAULT 0,
  "failure_code" VARCHAR(60),
  "intent_category" VARCHAR(60),
  "response_payload" JSONB,
  "started_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMPTZ(3),
  CONSTRAINT "ai_generations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ai_generations_usage_check" CHECK (
    "input_tokens" >= 0 AND "cached_input_tokens" >= 0 AND "output_tokens" >= 0 AND
    "cached_input_tokens" <= "input_tokens" AND
    "estimated_cost_micro_usd" >= 0 AND "tool_call_count" >= 0 AND
    ("latency_ms" IS NULL OR "latency_ms" >= 0)
  ),
  CONSTRAINT "ai_generations_completion_check" CHECK (
    ("status" = 'PROCESSING' AND "completed_at" IS NULL) OR
    ("status" <> 'PROCESSING' AND "completed_at" IS NOT NULL)
  )
);

CREATE TABLE "saved_outfits" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "title" VARCHAR(120) NOT NULL,
  "source_conversation_id" UUID,
  "source_generation_id" UUID,
  "source_outfit_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "saved_outfits_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "saved_outfit_items" (
  "id" UUID NOT NULL,
  "saved_outfit_id" UUID NOT NULL,
  "listing_id" UUID,
  "listing_reference_id" UUID NOT NULL,
  "replacement_request_id" UUID,
  "garment_role" "GarmentRole" NOT NULL,
  "position" INTEGER NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "saved_outfit_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "saved_outfit_items_position_check" CHECK ("position" BETWEEN 0 AND 9)
);

CREATE TABLE "ai_attribution_events" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "generation_id" UUID NOT NULL,
  "listing_id" UUID NOT NULL,
  "order_id" UUID,
  "type" "AiAttributionEventType" NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_attribution_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ai_attribution_events_order_check" CHECK (
    ("type" IN ('CHECKOUT', 'PURCHASE') AND "order_id" IS NOT NULL) OR
    ("type" IN ('OPEN', 'SAVE') AND "order_id" IS NULL)
  )
);

CREATE INDEX "ai_stylist_conversations_user_archive_updated_idx" ON "ai_stylist_conversations"("user_id", "archived_at", "updated_at", "id");
CREATE INDEX "ai_stylist_messages_conversation_created_idx" ON "ai_stylist_messages"("conversation_id", "created_at", "id");
CREATE UNIQUE INDEX "ai_generations_user_request_key" ON "ai_generations"("user_id", "client_request_id");
CREATE UNIQUE INDEX "ai_generations_one_processing_per_user_key" ON "ai_generations"("user_id") WHERE "status" = 'PROCESSING';
CREATE INDEX "ai_generations_conversation_started_idx" ON "ai_generations"("conversation_id", "started_at", "id");
CREATE INDEX "ai_generations_user_started_status_idx" ON "ai_generations"("user_id", "started_at", "status");
CREATE INDEX "ai_generations_status_started_idx" ON "ai_generations"("status", "started_at");
CREATE INDEX "ai_generations_provider_model_started_idx" ON "ai_generations"("provider", "requested_model", "started_at");
CREATE UNIQUE INDEX "saved_outfits_user_source_outfit_key" ON "saved_outfits"("user_id", "source_outfit_id");
CREATE INDEX "saved_outfits_user_created_idx" ON "saved_outfits"("user_id", "created_at", "id");
CREATE UNIQUE INDEX "saved_outfit_items_outfit_position_key" ON "saved_outfit_items"("saved_outfit_id", "position");
CREATE UNIQUE INDEX "saved_outfit_items_outfit_replacement_request_key" ON "saved_outfit_items"("saved_outfit_id", "replacement_request_id");
CREATE INDEX "saved_outfit_items_listing_id_idx" ON "saved_outfit_items"("listing_id");
CREATE INDEX "ai_attribution_events_user_created_idx" ON "ai_attribution_events"("user_id", "created_at");
CREATE UNIQUE INDEX "ai_attribution_events_user_generation_listing_type_key" ON "ai_attribution_events"("user_id", "generation_id", "listing_id", "type");
CREATE INDEX "ai_attribution_events_generation_listing_type_idx" ON "ai_attribution_events"("generation_id", "listing_id", "type");
CREATE INDEX "ai_attribution_events_type_created_idx" ON "ai_attribution_events"("type", "created_at");

ALTER TABLE "ai_stylist_conversations" ADD CONSTRAINT "ai_stylist_conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_stylist_messages" ADD CONSTRAINT "ai_stylist_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "ai_stylist_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_generations" ADD CONSTRAINT "ai_generations_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "ai_stylist_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_generations" ADD CONSTRAINT "ai_generations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "saved_outfits" ADD CONSTRAINT "saved_outfits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "saved_outfits" ADD CONSTRAINT "saved_outfits_source_conversation_id_fkey" FOREIGN KEY ("source_conversation_id") REFERENCES "ai_stylist_conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "saved_outfits" ADD CONSTRAINT "saved_outfits_source_generation_id_fkey" FOREIGN KEY ("source_generation_id") REFERENCES "ai_generations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "saved_outfit_items" ADD CONSTRAINT "saved_outfit_items_saved_outfit_id_fkey" FOREIGN KEY ("saved_outfit_id") REFERENCES "saved_outfits"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "saved_outfit_items" ADD CONSTRAINT "saved_outfit_items_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ai_attribution_events" ADD CONSTRAINT "ai_attribution_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_attribution_events" ADD CONSTRAINT "ai_attribution_events_generation_id_fkey" FOREIGN KEY ("generation_id") REFERENCES "ai_generations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_attribution_events" ADD CONSTRAINT "ai_attribution_events_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ai_attribution_events" ADD CONSTRAINT "ai_attribution_events_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
