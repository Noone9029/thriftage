CREATE TYPE "FeedbackReviewStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'ACTIONED', 'DISMISSED');
CREATE TYPE "BetaFeedbackCategory" AS ENUM ('BUG', 'USABILITY', 'PERFORMANCE', 'SAFETY', 'OTHER');
CREATE TYPE "FeedbackClientPlatform" AS ENUM ('IOS', 'ANDROID', 'WEB');
CREATE TYPE "AiResponseFeedbackKind" AS ENUM ('HELPFUL', 'NOT_HELPFUL', 'REPORT');

CREATE TABLE "beta_feedback" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "category" "BetaFeedbackCategory" NOT NULL,
  "description" VARCHAR(2000) NOT NULL,
  "route" VARCHAR(200),
  "app_version" VARCHAR(40) NOT NULL,
  "build_number" VARCHAR(40) NOT NULL,
  "platform" "FeedbackClientPlatform" NOT NULL,
  "status" "FeedbackReviewStatus" NOT NULL DEFAULT 'OPEN',
  "reviewer_id" UUID,
  "resolution" VARCHAR(1000),
  "reviewed_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "beta_feedback_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_response_feedback" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "generation_id" UUID NOT NULL,
  "kind" "AiResponseFeedbackKind" NOT NULL,
  "reason" VARCHAR(1000),
  "status" "FeedbackReviewStatus" NOT NULL,
  "reviewer_id" UUID,
  "resolution" VARCHAR(1000),
  "reviewed_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "ai_response_feedback_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ai_response_feedback_report_status_check" CHECK (
    ("kind" = 'REPORT' AND "status" IN ('OPEN', 'UNDER_REVIEW', 'ACTIONED', 'DISMISSED')) OR
    ("kind" <> 'REPORT' AND "status" = 'ACTIONED')
  )
);

CREATE INDEX "beta_feedback_status_created_idx" ON "beta_feedback"("status", "created_at", "id");
CREATE INDEX "beta_feedback_user_created_idx" ON "beta_feedback"("user_id", "created_at");
CREATE UNIQUE INDEX "ai_response_feedback_user_generation_key" ON "ai_response_feedback"("user_id", "generation_id");
CREATE INDEX "ai_response_feedback_status_created_idx" ON "ai_response_feedback"("status", "created_at", "id");
CREATE INDEX "ai_response_feedback_generation_idx" ON "ai_response_feedback"("generation_id");

ALTER TABLE "beta_feedback" ADD CONSTRAINT "beta_feedback_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "beta_feedback" ADD CONSTRAINT "beta_feedback_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ai_response_feedback" ADD CONSTRAINT "ai_response_feedback_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_response_feedback" ADD CONSTRAINT "ai_response_feedback_generation_id_fkey" FOREIGN KEY ("generation_id") REFERENCES "ai_generations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_response_feedback" ADD CONSTRAINT "ai_response_feedback_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
