-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'ACTIVE', 'RESERVED', 'SOLD', 'REJECTED', 'REMOVED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ListingCondition" AS ENUM ('NEW', 'LIKE_NEW', 'GOOD', 'FAIR');

-- CreateEnum
CREATE TYPE "CurrencyCode" AS ENUM ('PKR', 'USD', 'GBP', 'EUR', 'AED', 'SAR', 'CAD');

-- CreateEnum
CREATE TYPE "ReportTargetType" AS ENUM ('LISTING', 'USER');

-- CreateEnum
CREATE TYPE "ReportReason" AS ENUM ('COUNTERFEIT', 'FRAUD_OR_SCAM', 'PROHIBITED_ITEM', 'MISLEADING_CONTENT', 'HARASSMENT', 'SPAM', 'OTHER');

-- CreateEnum
CREATE TYPE "ModerationReportStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'ACTIONED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "ModerationAuditAction" AS ENUM ('CATEGORY_CREATED', 'CATEGORY_UPDATED', 'CATEGORY_ACTIVATED', 'CATEGORY_DEACTIVATED', 'LISTING_APPROVED', 'LISTING_REJECTED', 'LISTING_REMOVED', 'REPORT_UNDER_REVIEW', 'REPORT_ACTIONED', 'REPORT_DISMISSED');

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "parent_id" UUID,
    "slug" VARCHAR(60) NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "description" VARCHAR(240),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listings" (
    "id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "description" VARCHAR(2000) NOT NULL,
    "price_minor" INTEGER NOT NULL,
    "currency" "CurrencyCode" NOT NULL DEFAULT 'PKR',
    "condition" "ListingCondition" NOT NULL,
    "size" VARCHAR(50) NOT NULL,
    "brand" VARCHAR(80),
    "color" VARCHAR(50),
    "status" "ListingStatus" NOT NULL DEFAULT 'DRAFT',
    "rejection_reason" VARCHAR(500),
    "submitted_at" TIMESTAMPTZ(3),
    "moderated_at" TIMESTAMPTZ(3),
    "activated_at" TIMESTAMPTZ(3),
    "archived_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listing_images" (
    "id" UUID NOT NULL,
    "listing_id" UUID NOT NULL,
    "storage_key" VARCHAR(255) NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "listing_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listing_likes" (
    "user_id" UUID NOT NULL,
    "listing_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "listing_likes_pkey" PRIMARY KEY ("user_id","listing_id")
);

-- CreateTable
CREATE TABLE "saved_listings" (
    "user_id" UUID NOT NULL,
    "listing_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_listings_pkey" PRIMARY KEY ("user_id","listing_id")
);

-- CreateTable
CREATE TABLE "follows" (
    "follower_id" UUID NOT NULL,
    "followed_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "follows_pkey" PRIMARY KEY ("follower_id","followed_id")
);

-- CreateTable
CREATE TABLE "moderation_reports" (
    "id" UUID NOT NULL,
    "reporter_id" UUID NOT NULL,
    "target_type" "ReportTargetType" NOT NULL,
    "listing_id" UUID,
    "target_user_id" UUID,
    "reason" "ReportReason" NOT NULL,
    "detail" VARCHAR(1000),
    "status" "ModerationReportStatus" NOT NULL DEFAULT 'OPEN',
    "assigned_admin_id" UUID,
    "resolution" VARCHAR(1000),
    "resolved_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "moderation_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "moderation_audits" (
    "id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "action" "ModerationAuditAction" NOT NULL,
    "listing_id" UUID,
    "category_id" UUID,
    "report_id" UUID,
    "reason" VARCHAR(1000),
    "previous_state" VARCHAR(32),
    "next_state" VARCHAR(32),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "moderation_audits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE INDEX "categories_parent_active_sort_idx" ON "categories"("parent_id", "is_active", "sort_order");

-- CreateIndex
CREATE INDEX "categories_active_sort_idx" ON "categories"("is_active", "sort_order");

-- CreateIndex
CREATE INDEX "listings_status_created_id_idx" ON "listings"("status", "created_at", "id");

-- CreateIndex
CREATE INDEX "listings_seller_status_updated_idx" ON "listings"("seller_id", "status", "updated_at");

-- CreateIndex
CREATE INDEX "listings_category_status_created_idx" ON "listings"("category_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "listings_status_currency_price_id_idx" ON "listings"("status", "currency", "price_minor", "id");

-- CreateIndex
CREATE UNIQUE INDEX "listing_images_storage_key_key" ON "listing_images"("storage_key");

-- CreateIndex
CREATE INDEX "listing_images_listing_position_idx" ON "listing_images"("listing_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "listing_images_listing_id_position_key" ON "listing_images"("listing_id", "position");

-- CreateIndex
CREATE INDEX "listing_likes_listing_created_idx" ON "listing_likes"("listing_id", "created_at");

-- CreateIndex
CREATE INDEX "saved_listings_listing_created_idx" ON "saved_listings"("listing_id", "created_at");

-- CreateIndex
CREATE INDEX "saved_listings_user_created_idx" ON "saved_listings"("user_id", "created_at", "listing_id");

-- CreateIndex
CREATE INDEX "follows_followed_created_idx" ON "follows"("followed_id", "created_at");

-- CreateIndex
CREATE INDEX "moderation_reports_status_created_id_idx" ON "moderation_reports"("status", "created_at", "id");

-- CreateIndex
CREATE INDEX "moderation_reports_reporter_created_idx" ON "moderation_reports"("reporter_id", "created_at");

-- CreateIndex
CREATE INDEX "moderation_reports_listing_status_idx" ON "moderation_reports"("listing_id", "status");

-- CreateIndex
CREATE INDEX "moderation_reports_user_status_idx" ON "moderation_reports"("target_user_id", "status");

-- CreateIndex
CREATE INDEX "moderation_audits_actor_created_idx" ON "moderation_audits"("actor_id", "created_at");

-- CreateIndex
CREATE INDEX "moderation_audits_listing_created_idx" ON "moderation_audits"("listing_id", "created_at");

-- CreateIndex
CREATE INDEX "moderation_audits_category_created_idx" ON "moderation_audits"("category_id", "created_at");

-- CreateIndex
CREATE INDEX "moderation_audits_report_created_idx" ON "moderation_audits"("report_id", "created_at");

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listings" ADD CONSTRAINT "listings_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listings" ADD CONSTRAINT "listings_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_images" ADD CONSTRAINT "listing_images_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_likes" ADD CONSTRAINT "listing_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_likes" ADD CONSTRAINT "listing_likes_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_listings" ADD CONSTRAINT "saved_listings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_listings" ADD CONSTRAINT "saved_listings_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follows" ADD CONSTRAINT "follows_follower_id_fkey" FOREIGN KEY ("follower_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follows" ADD CONSTRAINT "follows_followed_id_fkey" FOREIGN KEY ("followed_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderation_reports" ADD CONSTRAINT "moderation_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderation_reports" ADD CONSTRAINT "moderation_reports_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderation_reports" ADD CONSTRAINT "moderation_reports_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderation_reports" ADD CONSTRAINT "moderation_reports_assigned_admin_id_fkey" FOREIGN KEY ("assigned_admin_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderation_audits" ADD CONSTRAINT "moderation_audits_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderation_audits" ADD CONSTRAINT "moderation_audits_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderation_audits" ADD CONSTRAINT "moderation_audits_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderation_audits" ADD CONSTRAINT "moderation_audits_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "moderation_reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Domain invariants that Prisma cannot express directly.
ALTER TABLE "categories"
  ADD CONSTRAINT "categories_parent_not_self_check" CHECK ("parent_id" IS NULL OR "parent_id" <> "id"),
  ADD CONSTRAINT "categories_sort_order_check" CHECK ("sort_order" >= 0);

ALTER TABLE "listings"
  ADD CONSTRAINT "listings_price_minor_check" CHECK ("price_minor" > 0 AND "price_minor" <= 2000000000),
  ADD CONSTRAINT "listings_rejection_reason_check" CHECK (("status" = 'REJECTED') = ("rejection_reason" IS NOT NULL));

ALTER TABLE "listing_images"
  ADD CONSTRAINT "listing_images_position_check" CHECK ("position" >= 0 AND "position" < 10),
  ADD CONSTRAINT "listing_images_dimensions_check" CHECK ("width" > 0 AND "height" > 0),
  ADD CONSTRAINT "listing_images_storage_key_format_check" CHECK (
    "storage_key" ~ '^listings/[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.webp$'
  );

ALTER TABLE "follows"
  ADD CONSTRAINT "follows_not_self_check" CHECK ("follower_id" <> "followed_id");

ALTER TABLE "moderation_reports"
  ADD CONSTRAINT "moderation_reports_target_check" CHECK (
    ("target_type" = 'LISTING' AND "listing_id" IS NOT NULL AND "target_user_id" IS NULL) OR
    ("target_type" = 'USER' AND "target_user_id" IS NOT NULL AND "listing_id" IS NULL)
  );

ALTER TABLE "moderation_audits"
  ADD CONSTRAINT "moderation_audits_single_target_check" CHECK (
    (CASE WHEN "listing_id" IS NULL THEN 0 ELSE 1 END) +
    (CASE WHEN "category_id" IS NULL THEN 0 ELSE 1 END) +
    (CASE WHEN "report_id" IS NULL THEN 0 ELSE 1 END) = 1
  );

CREATE UNIQUE INDEX "moderation_reports_open_listing_reporter_key"
  ON "moderation_reports" ("reporter_id", "listing_id")
  WHERE "listing_id" IS NOT NULL AND "status" IN ('OPEN', 'UNDER_REVIEW');

CREATE UNIQUE INDEX "moderation_reports_open_user_reporter_key"
  ON "moderation_reports" ("reporter_id", "target_user_id")
  WHERE "target_user_id" IS NOT NULL AND "status" IN ('OPEN', 'UNDER_REVIEW');

-- PostgreSQL-native search keeps the first release operational without an external search service.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX "listings_title_trgm_idx" ON "listings" USING GIN ("title" gin_trgm_ops);
CREATE INDEX "listings_description_trgm_idx" ON "listings" USING GIN ("description" gin_trgm_ops);
CREATE INDEX "listings_brand_trgm_idx" ON "listings" USING GIN ("brand" gin_trgm_ops);
