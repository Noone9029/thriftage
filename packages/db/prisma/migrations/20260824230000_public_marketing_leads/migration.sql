CREATE TYPE "MarketingLeadKind" AS ENUM ('BETA', 'SELLER');
CREATE TYPE "MarketingAudience" AS ENUM ('BUYER', 'SELLER', 'BOTH');
CREATE TYPE "MarketingSellerType" AS ENUM ('CLOSET_SELLER', 'THRIFT_RESELLER', 'FASHION_CREATOR', 'OTHER');
CREATE TYPE "MarketingItemVolume" AS ENUM ('ONE_TO_TEN', 'ELEVEN_TO_THIRTY', 'THIRTY_ONE_TO_SEVENTY_FIVE', 'MORE_THAN_SEVENTY_FIVE');

CREATE TABLE "marketing_leads" (
  "id" UUID NOT NULL,
  "kind" "MarketingLeadKind" NOT NULL,
  "email_normalized" VARCHAR(254) NOT NULL,
  "name" VARCHAR(120),
  "city" VARCHAR(100) NOT NULL,
  "audience" "MarketingAudience",
  "seller_type" "MarketingSellerType",
  "item_volume" "MarketingItemVolume",
  "style_interest" VARCHAR(120),
  "store_url" VARCHAR(500),
  "message" VARCHAR(1000),
  "source" VARCHAR(100) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "marketing_leads_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "marketing_leads_kind_shape_check" CHECK (
    (
      "kind" = 'BETA'
      AND "audience" IS NOT NULL
      AND "name" IS NULL
      AND "seller_type" IS NULL
      AND "item_volume" IS NULL
      AND "store_url" IS NULL
      AND "message" IS NULL
    )
    OR
    (
      "kind" = 'SELLER'
      AND "name" IS NOT NULL
      AND "seller_type" IS NOT NULL
      AND "item_volume" IS NOT NULL
      AND "audience" IS NULL
      AND "style_interest" IS NULL
    )
  )
);

CREATE TABLE "marketing_lead_rate_limit_buckets" (
  "fingerprint_hash" CHAR(64) NOT NULL,
  "bucket_start" TIMESTAMPTZ(3) NOT NULL,
  "request_count" INTEGER NOT NULL DEFAULT 1,
  "expires_at" TIMESTAMPTZ(3) NOT NULL,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "marketing_lead_rate_limit_buckets_pkey" PRIMARY KEY ("fingerprint_hash", "bucket_start"),
  CONSTRAINT "marketing_lead_rate_limit_buckets_count_check" CHECK ("request_count" > 0)
);

CREATE UNIQUE INDEX "marketing_leads_kind_email_key" ON "marketing_leads"("kind", "email_normalized");
CREATE INDEX "marketing_leads_kind_created_idx" ON "marketing_leads"("kind", "created_at", "id");
CREATE INDEX "marketing_lead_rate_limit_buckets_expiry_idx" ON "marketing_lead_rate_limit_buckets"("expires_at");

-- These tables contain private recruitment data and are intentionally server-only.
-- No anon/authenticated policies are created; Prisma connects through the trusted backend role.
ALTER TABLE "marketing_leads" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "marketing_lead_rate_limit_buckets" ENABLE ROW LEVEL SECURITY;
