-- Structured style intelligence. Existing listings remain nullable so historical inventory
-- can be enriched without inventing metadata; new writes enforce completeness in the API.
CREATE TYPE "StyleQuizStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED');
CREATE TYPE "ColorFamily" AS ENUM ('BLACK', 'WHITE', 'GREY', 'BROWN', 'BEIGE', 'RED', 'ORANGE', 'YELLOW', 'GREEN', 'BLUE', 'PURPLE', 'PINK', 'METALLIC', 'MULTICOLOR');
CREATE TYPE "ColorPreferenceSentiment" AS ENUM ('PREFER', 'AVOID');
CREATE TYPE "FitType" AS ENUM ('OVERSIZED', 'RELAXED', 'REGULAR', 'SLIM', 'TAILORED');
CREATE TYPE "FashionPriority" AS ENUM ('COMFORT', 'PRICE', 'AESTHETICS', 'SUSTAINABILITY', 'EXCLUSIVITY');
CREATE TYPE "LifestyleType" AS ENUM ('STUDENT', 'PROFESSIONAL', 'ENTREPRENEUR', 'CREATIVE', 'ATHLETE');
CREATE TYPE "StyleExpression" AS ENUM ('OUTGOING', 'RESERVED', 'CREATIVE', 'AMBITIOUS', 'EXPERIMENTAL', 'CLASSIC');
CREATE TYPE "SizeSystem" AS ENUM ('ALPHA', 'EU', 'UK', 'US', 'WAIST_INCHES', 'SHOE_EU', 'SHOE_UK', 'SHOE_US', 'ONE_SIZE');
CREATE TYPE "GarmentRole" AS ENUM ('TOP', 'BOTTOM', 'DRESS', 'OUTERWEAR', 'SHOES', 'BAG', 'JEWELRY', 'ACCESSORY', 'OTHER');
CREATE TYPE "RecommendationEventType" AS ENUM ('IMPRESSION', 'VIEW', 'LIKE', 'SAVE', 'FOLLOW_SELLER', 'MESSAGE_SELLER', 'CHECKOUT', 'PURCHASE', 'NOT_INTERESTED');
CREATE TYPE "RecommendationSource" AS ENUM ('FOR_YOU', 'SEARCH', 'SIMILAR', 'LISTING_DETAIL');
CREATE TYPE "PersonalizationAuditAction" AS ENUM ('QUIZ_STARTED', 'QUIZ_SAVED', 'QUIZ_COMPLETED', 'PROFILE_UPDATED', 'PROFILE_RESET', 'LEARNED_SIGNALS_RESET', 'NOT_INTERESTED', 'NOT_INTERESTED_UNDONE', 'CONFIG_ACTIVATED', 'TAXONOMY_UPDATED');

ALTER TABLE "listings"
  ADD COLUMN "color_family" "ColorFamily",
  ADD COLUMN "fit_type" "FitType",
  ADD COLUMN "garment_role" "GarmentRole",
  ADD COLUMN "size_compatibility_key" VARCHAR(40),
  ADD COLUMN "size_system" "SizeSystem";

CREATE TABLE "style_definitions" (
  "id" UUID NOT NULL,
  "slug" VARCHAR(60) NOT NULL,
  "display_name" VARCHAR(80) NOT NULL,
  "description" VARCHAR(240),
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "style_definitions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "user_style_profiles" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "quiz_status" "StyleQuizStatus" NOT NULL DEFAULT 'NOT_STARTED',
  "quiz_step" INTEGER NOT NULL DEFAULT 0,
  "profile_version" INTEGER NOT NULL DEFAULT 1,
  "currency" "CurrencyCode" NOT NULL DEFAULT 'PKR',
  "budget_min_minor" INTEGER,
  "budget_max_minor" INTEGER,
  "priorities" "FashionPriority"[] DEFAULT ARRAY[]::"FashionPriority"[],
  "lifestyles" "LifestyleType"[] DEFAULT ARRAY[]::"LifestyleType"[],
  "expressions" "StyleExpression"[] DEFAULT ARRAY[]::"StyleExpression"[],
  "behavioral_reset_at" TIMESTAMPTZ(3),
  "completed_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "user_style_profiles_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "user_style_profiles_quiz_step_check" CHECK ("quiz_step" BETWEEN 0 AND 7),
  CONSTRAINT "user_style_profiles_profile_version_check" CHECK ("profile_version" > 0),
  CONSTRAINT "user_style_profiles_budget_check" CHECK (
    ("budget_min_minor" IS NULL OR "budget_min_minor" >= 0) AND
    ("budget_max_minor" IS NULL OR "budget_max_minor" > 0) AND
    ("budget_min_minor" IS NULL OR "budget_max_minor" IS NULL OR "budget_min_minor" <= "budget_max_minor")
  )
);

CREATE TABLE "user_style_preferences" (
  "profile_id" UUID NOT NULL, "style_definition_id" UUID NOT NULL, "strength" INTEGER NOT NULL,
  CONSTRAINT "user_style_preferences_pkey" PRIMARY KEY ("profile_id", "style_definition_id"),
  CONSTRAINT "user_style_preferences_strength_check" CHECK ("strength" BETWEEN 1 AND 5)
);
CREATE TABLE "user_color_preferences" (
  "profile_id" UUID NOT NULL, "color_family" "ColorFamily" NOT NULL, "sentiment" "ColorPreferenceSentiment" NOT NULL,
  CONSTRAINT "user_color_preferences_pkey" PRIMARY KEY ("profile_id", "color_family")
);
CREATE TABLE "user_fit_preferences" (
  "profile_id" UUID NOT NULL, "fit_type" "FitType" NOT NULL, "rank" INTEGER NOT NULL,
  CONSTRAINT "user_fit_preferences_pkey" PRIMARY KEY ("profile_id", "fit_type"),
  CONSTRAINT "user_fit_preferences_rank_check" CHECK ("rank" BETWEEN 1 AND 5)
);
CREATE TABLE "user_size_preferences" (
  "profile_id" UUID NOT NULL, "garment_role" "GarmentRole" NOT NULL, "size_system" "SizeSystem" NOT NULL, "size_key" VARCHAR(40) NOT NULL,
  CONSTRAINT "user_size_preferences_pkey" PRIMARY KEY ("profile_id", "garment_role", "size_system")
);
CREATE TABLE "listing_styles" (
  "listing_id" UUID NOT NULL, "style_definition_id" UUID NOT NULL,
  CONSTRAINT "listing_styles_pkey" PRIMARY KEY ("listing_id", "style_definition_id")
);
CREATE TABLE "recommendation_feedback" (
  "user_id" UUID NOT NULL, "listing_id" UUID NOT NULL, "hidden_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "recommendation_feedback_pkey" PRIMARY KEY ("user_id", "listing_id")
);
CREATE TABLE "recommendation_events" (
  "id" UUID NOT NULL, "user_id" UUID NOT NULL, "listing_id" UUID NOT NULL,
  "type" "RecommendationEventType" NOT NULL, "source" "RecommendationSource" NOT NULL,
  "algorithm_version" VARCHAR(40), "match_score" INTEGER, "occurred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "recommendation_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "recommendation_events_match_score_check" CHECK ("match_score" IS NULL OR "match_score" BETWEEN 0 AND 100)
);
CREATE TABLE "recommendation_configurations" (
  "id" UUID NOT NULL, "version" VARCHAR(40) NOT NULL, "is_active" BOOLEAN NOT NULL DEFAULT false,
  "personal_weight" INTEGER NOT NULL DEFAULT 45, "behavior_weight" INTEGER NOT NULL DEFAULT 15,
  "seller_weight" INTEGER NOT NULL DEFAULT 8, "freshness_weight" INTEGER NOT NULL DEFAULT 12,
  "trust_weight" INTEGER NOT NULL DEFAULT 8, "engagement_weight" INTEGER NOT NULL DEFAULT 7,
  "exploration_weight" INTEGER NOT NULL DEFAULT 5, "max_per_seller" INTEGER NOT NULL DEFAULT 2,
  "max_per_style" INTEGER NOT NULL DEFAULT 4, "exploration_percent" INTEGER NOT NULL DEFAULT 10,
  "candidate_limit" INTEGER NOT NULL DEFAULT 200,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "recommendation_configurations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "recommendation_configurations_weights_check" CHECK (
    "personal_weight" + "behavior_weight" + "seller_weight" + "freshness_weight" + "trust_weight" + "engagement_weight" + "exploration_weight" = 100
  ),
  CONSTRAINT "recommendation_configurations_limits_check" CHECK (
    "max_per_seller" BETWEEN 1 AND 20 AND "max_per_style" BETWEEN 1 AND 30 AND
    "exploration_percent" BETWEEN 0 AND 30 AND "candidate_limit" BETWEEN 20 AND 500
  )
);
CREATE TABLE "personalization_audits" (
  "id" UUID NOT NULL, "user_id" UUID, "actor_id" UUID, "action" "PersonalizationAuditAction" NOT NULL,
  "metadata" JSONB, "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "personalization_audits_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "style_definitions_slug_key" ON "style_definitions"("slug");
CREATE INDEX "style_definitions_active_sort_idx" ON "style_definitions"("is_active", "sort_order");
CREATE UNIQUE INDEX "user_style_profiles_user_id_key" ON "user_style_profiles"("user_id");
CREATE INDEX "user_style_profiles_status_updated_idx" ON "user_style_profiles"("quiz_status", "updated_at");
CREATE INDEX "user_style_preferences_style_definition_idx" ON "user_style_preferences"("style_definition_id");
CREATE INDEX "user_size_preferences_size_idx" ON "user_size_preferences"("size_system", "size_key");
CREATE INDEX "listing_styles_style_listing_idx" ON "listing_styles"("style_definition_id", "listing_id");
CREATE INDEX "recommendation_feedback_user_hidden_idx" ON "recommendation_feedback"("user_id", "hidden_at");
CREATE INDEX "recommendation_events_user_occurred_idx" ON "recommendation_events"("user_id", "occurred_at");
CREATE INDEX "recommendation_events_listing_type_occurred_idx" ON "recommendation_events"("listing_id", "type", "occurred_at");
CREATE INDEX "recommendation_events_type_score_occurred_idx" ON "recommendation_events"("type", "match_score", "occurred_at");
CREATE UNIQUE INDEX "recommendation_configurations_version_key" ON "recommendation_configurations"("version");
CREATE UNIQUE INDEX "recommendation_configurations_one_active_key" ON "recommendation_configurations"("is_active") WHERE "is_active" = true;
CREATE INDEX "recommendation_configurations_active_idx" ON "recommendation_configurations"("is_active");
CREATE INDEX "personalization_audits_user_created_idx" ON "personalization_audits"("user_id", "created_at");
CREATE INDEX "personalization_audits_action_created_idx" ON "personalization_audits"("action", "created_at");
CREATE INDEX "listings_status_style_metadata_idx" ON "listings"("status", "color_family", "fit_type", "garment_role");
CREATE INDEX "listings_status_size_compatibility_idx" ON "listings"("status", "size_system", "size_compatibility_key");

ALTER TABLE "user_style_profiles" ADD CONSTRAINT "user_style_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_style_preferences" ADD CONSTRAINT "user_style_preferences_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "user_style_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_style_preferences" ADD CONSTRAINT "user_style_preferences_style_definition_id_fkey" FOREIGN KEY ("style_definition_id") REFERENCES "style_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "user_color_preferences" ADD CONSTRAINT "user_color_preferences_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "user_style_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_fit_preferences" ADD CONSTRAINT "user_fit_preferences_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "user_style_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_size_preferences" ADD CONSTRAINT "user_size_preferences_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "user_style_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "listing_styles" ADD CONSTRAINT "listing_styles_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "listing_styles" ADD CONSTRAINT "listing_styles_style_definition_id_fkey" FOREIGN KEY ("style_definition_id") REFERENCES "style_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "recommendation_feedback" ADD CONSTRAINT "recommendation_feedback_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recommendation_feedback" ADD CONSTRAINT "recommendation_feedback_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recommendation_events" ADD CONSTRAINT "recommendation_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recommendation_events" ADD CONSTRAINT "recommendation_events_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "personalization_audits" ADD CONSTRAINT "personalization_audits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "personalization_audits" ADD CONSTRAINT "personalization_audits_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "style_definitions" ("id", "slug", "display_name", "description", "sort_order", "updated_at") VALUES
('f0000000-0000-4000-8000-000000000001', 'streetwear', 'Streetwear', 'Relaxed, graphic, and urban everyday style.', 0, CURRENT_TIMESTAMP),
('f0000000-0000-4000-8000-000000000002', 'old-money', 'Old Money', 'Refined heritage pieces and understated tailoring.', 1, CURRENT_TIMESTAMP),
('f0000000-0000-4000-8000-000000000003', 'vintage', 'Vintage', 'Distinctive pieces inspired by earlier decades.', 2, CURRENT_TIMESTAMP),
('f0000000-0000-4000-8000-000000000004', 'gothic', 'Gothic', 'Dark palettes, dramatic details, and expressive silhouettes.', 3, CURRENT_TIMESTAMP),
('f0000000-0000-4000-8000-000000000005', 'y2k', 'Y2K', 'Playful late-1990s and early-2000s styling.', 4, CURRENT_TIMESTAMP),
('f0000000-0000-4000-8000-000000000006', 'minimalist', 'Minimalist', 'Clean lines, versatile shapes, and restrained palettes.', 5, CURRENT_TIMESTAMP),
('f0000000-0000-4000-8000-000000000007', 'formal', 'Formal', 'Polished occasionwear and traditional tailoring.', 6, CURRENT_TIMESTAMP),
('f0000000-0000-4000-8000-000000000008', 'smart-casual', 'Smart Casual', 'Relaxed wardrobe staples with a polished finish.', 7, CURRENT_TIMESTAMP),
('f0000000-0000-4000-8000-000000000009', 'athleisure', 'Athleisure', 'Comfort-led active pieces for everyday wear.', 8, CURRENT_TIMESTAMP),
('f0000000-0000-4000-8000-000000000010', 'techwear', 'Techwear', 'Utility-led silhouettes and technical detailing.', 9, CURRENT_TIMESTAMP);
INSERT INTO "recommendation_configurations" ("id", "version", "is_active", "updated_at")
VALUES ('f1000000-0000-4000-8000-000000000001', 'rules-v1', true, CURRENT_TIMESTAMP);
