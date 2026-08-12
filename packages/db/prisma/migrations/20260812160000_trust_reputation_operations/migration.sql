-- CreateEnum
CREATE TYPE "ReviewDirection" AS ENUM ('BUYER_TO_SELLER', 'SELLER_TO_BUYER');

-- CreateEnum
CREATE TYPE "ReviewModerationState" AS ENUM ('VISIBLE', 'TEXT_HIDDEN', 'INVALIDATED');

-- CreateEnum
CREATE TYPE "ReviewReportReason" AS ENUM ('HARASSMENT', 'HATE_OR_ABUSE', 'PERSONAL_INFORMATION', 'SPAM', 'IRRELEVANT', 'FRAUDULENT', 'RETALIATION', 'OTHER');

-- CreateEnum
CREATE TYPE "ReviewReportStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'ACTIONED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "PolicyType" AS ENUM ('TERMS_OF_USE', 'PRIVACY_POLICY', 'COMMUNITY_GUIDELINES');

-- CreateEnum
CREATE TYPE "DisputeReason" AS ENUM ('ITEM_NOT_RECEIVED', 'ITEM_NOT_AS_DESCRIBED', 'DAMAGED_ITEM', 'COUNTERFEIT_SUSPECTED', 'DELIVERY_PROBLEM', 'PAYMENT_OR_COD_ISSUE', 'HARASSMENT_OR_SAFETY', 'OTHER');

-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'AWAITING_INFORMATION', 'RESOLVED', 'REJECTED', 'CLOSED');

-- CreateEnum
CREATE TYPE "DisputeEventType" AS ENUM ('OPENED', 'EVIDENCE_ADDED', 'STATUS_CHANGED', 'INFORMATION_REQUESTED', 'RESOLUTION_RECORDED', 'INTERNAL_NOTE');

-- CreateEnum
CREATE TYPE "DisputeEventVisibility" AS ENUM ('PARTICIPANTS', 'INTERNAL');

-- CreateEnum
CREATE TYPE "SellerVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "SellerVerificationMethod" AS ENUM ('ACCOUNT_REVIEW');

-- CreateEnum
CREATE TYPE "RestrictionScope" AS ENUM ('MESSAGING', 'SELLING', 'BUYING', 'SOCIAL');

-- CreateEnum
CREATE TYPE "SafetyActionType" AS ENUM ('WARNING', 'TEMPORARY_RESTRICTION', 'PERMANENT_RESTRICTION', 'ACCOUNT_SUSPENSION', 'RESTRICTION_REVOKED');

-- CreateEnum
CREATE TYPE "TrustAuditAction" AS ENUM ('POLICY_PUBLISHED', 'REVIEW_HIDDEN', 'REVIEW_RESTORED', 'REVIEW_INVALIDATED', 'REVIEW_REPORT_DISMISSED', 'DISPUTE_STATUS_CHANGED', 'DISPUTE_RESOLVED', 'SELLER_VERIFICATION_APPROVED', 'SELLER_VERIFICATION_REJECTED', 'SELLER_VERIFICATION_SUSPENDED', 'RESTRICTION_CREATED', 'RESTRICTION_REVOKED', 'WARNING_ISSUED', 'ACCOUNT_SUSPENDED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'REVIEW_RECEIVED';
ALTER TYPE "NotificationType" ADD VALUE 'DISPUTE_OPENED';
ALTER TYPE "NotificationType" ADD VALUE 'DISPUTE_UPDATED';
ALTER TYPE "NotificationType" ADD VALUE 'DISPUTE_RESOLVED';
ALTER TYPE "NotificationType" ADD VALUE 'SELLER_VERIFICATION_SUBMITTED';
ALTER TYPE "NotificationType" ADD VALUE 'SELLER_VERIFICATION_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE 'SELLER_VERIFICATION_REJECTED';
ALTER TYPE "NotificationType" ADD VALUE 'ACCOUNT_RESTRICTED';

-- AlterTable
ALTER TABLE "notification_outbox" ADD COLUMN     "dispute_id" UUID,
ADD COLUMN     "review_id" UUID,
ADD COLUMN     "seller_verification_id" UUID;

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "dispute_id" UUID,
ADD COLUMN     "review_id" UUID,
ADD COLUMN     "seller_verification_id" UUID;

-- CreateTable
CREATE TABLE "reviews" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "reviewer_id" UUID NOT NULL,
    "reviewee_id" UUID NOT NULL,
    "direction" "ReviewDirection" NOT NULL,
    "rating" INTEGER NOT NULL,
    "text" VARCHAR(1000),
    "moderation_state" "ReviewModerationState" NOT NULL DEFAULT 'VISIBLE',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_reports" (
    "id" UUID NOT NULL,
    "review_id" UUID NOT NULL,
    "reporter_id" UUID NOT NULL,
    "reason" "ReviewReportReason" NOT NULL,
    "detail" VARCHAR(1000),
    "status" "ReviewReportStatus" NOT NULL DEFAULT 'OPEN',
    "assigned_admin_id" UUID,
    "resolution" VARCHAR(1000),
    "resolved_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "review_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_moderation_audits" (
    "id" UUID NOT NULL,
    "review_id" UUID NOT NULL,
    "report_id" UUID,
    "actor_id" UUID NOT NULL,
    "previous_state" "ReviewModerationState",
    "next_state" "ReviewModerationState",
    "reason" VARCHAR(1000) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_moderation_audits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_blocks" (
    "blocker_id" UUID NOT NULL,
    "blocked_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_blocks_pkey" PRIMARY KEY ("blocker_id","blocked_user_id")
);

-- CreateTable
CREATE TABLE "policy_versions" (
    "id" UUID NOT NULL,
    "policy_type" "PolicyType" NOT NULL,
    "version" VARCHAR(40) NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "url" VARCHAR(2048) NOT NULL,
    "required_for_ugc" BOOLEAN NOT NULL DEFAULT true,
    "effective_at" TIMESTAMPTZ(3) NOT NULL,
    "is_current" BOOLEAN NOT NULL DEFAULT false,
    "published_by_id" UUID NOT NULL,
    "published_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "policy_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policy_acceptances" (
    "policy_version_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "accepted_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "policy_acceptances_pkey" PRIMARY KEY ("policy_version_id","user_id")
);

-- CreateTable
CREATE TABLE "disputes" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "opener_id" UUID NOT NULL,
    "counterparty_id" UUID NOT NULL,
    "reason" "DisputeReason" NOT NULL,
    "description" VARCHAR(3000) NOT NULL,
    "status" "DisputeStatus" NOT NULL DEFAULT 'OPEN',
    "assigned_admin_id" UUID,
    "resolution" VARCHAR(2000),
    "resolved_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "disputes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispute_evidence" (
    "id" UUID NOT NULL,
    "dispute_id" UUID NOT NULL,
    "uploaded_by_id" UUID NOT NULL,
    "storage_key" VARCHAR(255) NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retained_until" TIMESTAMPTZ(3),

    CONSTRAINT "dispute_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispute_events" (
    "id" UUID NOT NULL,
    "dispute_id" UUID NOT NULL,
    "actor_id" UUID,
    "type" "DisputeEventType" NOT NULL,
    "visibility" "DisputeEventVisibility" NOT NULL,
    "message" VARCHAR(2000),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dispute_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seller_verifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "reviewer_id" UUID,
    "status" "SellerVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "method" "SellerVerificationMethod" NOT NULL DEFAULT 'ACCOUNT_REVIEW',
    "statement" VARCHAR(1500) NOT NULL,
    "decision_reason" VARCHAR(1000),
    "submitted_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMPTZ(3),
    "can_reapply_at" TIMESTAMPTZ(3),

    CONSTRAINT "seller_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_restrictions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "scope" "RestrictionScope" NOT NULL,
    "reason" VARCHAR(1000) NOT NULL,
    "created_by_id" UUID NOT NULL,
    "starts_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(3),
    "revoked_at" TIMESTAMPTZ(3),
    "revoked_reason" VARCHAR(1000),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_restrictions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "safety_actions" (
    "id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "target_user_id" UUID NOT NULL,
    "type" "SafetyActionType" NOT NULL,
    "reason" VARCHAR(1000) NOT NULL,
    "restriction_id" UUID,
    "report_id" UUID,
    "dispute_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "safety_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trust_audits" (
    "id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "target_user_id" UUID,
    "action" "TrustAuditAction" NOT NULL,
    "reason" VARCHAR(1000) NOT NULL,
    "review_id" UUID,
    "review_report_id" UUID,
    "dispute_id" UUID,
    "seller_verification_id" UUID,
    "restriction_id" UUID,
    "policy_version_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trust_audits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reviews_reviewee_direction_state_created_idx" ON "reviews"("reviewee_id", "direction", "moderation_state", "created_at");

-- CreateIndex
CREATE INDEX "reviews_order_created_idx" ON "reviews"("order_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_order_reviewer_direction_key" ON "reviews"("order_id", "reviewer_id", "direction");

-- CreateIndex
CREATE INDEX "review_reports_status_created_idx" ON "review_reports"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "review_reports_review_reporter_key" ON "review_reports"("review_id", "reporter_id");

-- CreateIndex
CREATE INDEX "review_moderation_audits_review_created_idx" ON "review_moderation_audits"("review_id", "created_at");

-- CreateIndex
CREATE INDEX "user_blocks_blocked_blocker_idx" ON "user_blocks"("blocked_user_id", "blocker_id");

-- CreateIndex
CREATE INDEX "policy_versions_current_effective_idx" ON "policy_versions"("is_current", "effective_at");

-- CreateIndex
CREATE UNIQUE INDEX "policy_versions_type_version_key" ON "policy_versions"("policy_type", "version");

-- CreateIndex
CREATE INDEX "policy_acceptances_user_accepted_idx" ON "policy_acceptances"("user_id", "accepted_at");

-- CreateIndex
CREATE INDEX "disputes_status_created_idx" ON "disputes"("status", "created_at");

-- CreateIndex
CREATE INDEX "disputes_opener_created_idx" ON "disputes"("opener_id", "created_at");

-- CreateIndex
CREATE INDEX "disputes_counterparty_created_idx" ON "disputes"("counterparty_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "disputes_order_id_key" ON "disputes"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "dispute_evidence_storage_key_key" ON "dispute_evidence"("storage_key");

-- CreateIndex
CREATE INDEX "dispute_evidence_dispute_created_idx" ON "dispute_evidence"("dispute_id", "created_at");

-- CreateIndex
CREATE INDEX "dispute_events_dispute_visibility_created_idx" ON "dispute_events"("dispute_id", "visibility", "created_at");

-- CreateIndex
CREATE INDEX "seller_verifications_status_submitted_idx" ON "seller_verifications"("status", "submitted_at");

-- CreateIndex
CREATE INDEX "seller_verifications_user_submitted_idx" ON "seller_verifications"("user_id", "submitted_at");

-- CreateIndex
CREATE INDEX "user_restrictions_user_scope_active_idx" ON "user_restrictions"("user_id", "scope", "revoked_at", "expires_at");

-- CreateIndex
CREATE INDEX "user_restrictions_created_idx" ON "user_restrictions"("created_at");

-- CreateIndex
CREATE INDEX "safety_actions_target_created_idx" ON "safety_actions"("target_user_id", "created_at");

-- CreateIndex
CREATE INDEX "trust_audits_actor_created_idx" ON "trust_audits"("actor_id", "created_at");

-- CreateIndex
CREATE INDEX "trust_audits_target_created_idx" ON "trust_audits"("target_user_id", "created_at");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "reviews"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_dispute_id_fkey" FOREIGN KEY ("dispute_id") REFERENCES "disputes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_seller_verification_id_fkey" FOREIGN KEY ("seller_verification_id") REFERENCES "seller_verifications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_outbox" ADD CONSTRAINT "notification_outbox_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "reviews"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_outbox" ADD CONSTRAINT "notification_outbox_dispute_id_fkey" FOREIGN KEY ("dispute_id") REFERENCES "disputes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_outbox" ADD CONSTRAINT "notification_outbox_seller_verification_id_fkey" FOREIGN KEY ("seller_verification_id") REFERENCES "seller_verifications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_reviewee_id_fkey" FOREIGN KEY ("reviewee_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_reports" ADD CONSTRAINT "review_reports_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "reviews"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_reports" ADD CONSTRAINT "review_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_reports" ADD CONSTRAINT "review_reports_assigned_admin_id_fkey" FOREIGN KEY ("assigned_admin_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_moderation_audits" ADD CONSTRAINT "review_moderation_audits_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "reviews"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_moderation_audits" ADD CONSTRAINT "review_moderation_audits_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "review_reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_moderation_audits" ADD CONSTRAINT "review_moderation_audits_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_blocks" ADD CONSTRAINT "user_blocks_blocker_id_fkey" FOREIGN KEY ("blocker_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_blocks" ADD CONSTRAINT "user_blocks_blocked_user_id_fkey" FOREIGN KEY ("blocked_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_versions" ADD CONSTRAINT "policy_versions_published_by_id_fkey" FOREIGN KEY ("published_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_acceptances" ADD CONSTRAINT "policy_acceptances_policy_version_id_fkey" FOREIGN KEY ("policy_version_id") REFERENCES "policy_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_acceptances" ADD CONSTRAINT "policy_acceptances_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_opener_id_fkey" FOREIGN KEY ("opener_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_counterparty_id_fkey" FOREIGN KEY ("counterparty_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_assigned_admin_id_fkey" FOREIGN KEY ("assigned_admin_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispute_evidence" ADD CONSTRAINT "dispute_evidence_dispute_id_fkey" FOREIGN KEY ("dispute_id") REFERENCES "disputes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispute_evidence" ADD CONSTRAINT "dispute_evidence_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispute_events" ADD CONSTRAINT "dispute_events_dispute_id_fkey" FOREIGN KEY ("dispute_id") REFERENCES "disputes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispute_events" ADD CONSTRAINT "dispute_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_verifications" ADD CONSTRAINT "seller_verifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_verifications" ADD CONSTRAINT "seller_verifications_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_restrictions" ADD CONSTRAINT "user_restrictions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_restrictions" ADD CONSTRAINT "user_restrictions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "safety_actions" ADD CONSTRAINT "safety_actions_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "safety_actions" ADD CONSTRAINT "safety_actions_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "safety_actions" ADD CONSTRAINT "safety_actions_restriction_id_fkey" FOREIGN KEY ("restriction_id") REFERENCES "user_restrictions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "safety_actions" ADD CONSTRAINT "safety_actions_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "moderation_reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "safety_actions" ADD CONSTRAINT "safety_actions_dispute_id_fkey" FOREIGN KEY ("dispute_id") REFERENCES "disputes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trust_audits" ADD CONSTRAINT "trust_audits_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trust_audits" ADD CONSTRAINT "trust_audits_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trust_audits" ADD CONSTRAINT "trust_audits_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "reviews"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trust_audits" ADD CONSTRAINT "trust_audits_review_report_id_fkey" FOREIGN KEY ("review_report_id") REFERENCES "review_reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trust_audits" ADD CONSTRAINT "trust_audits_dispute_id_fkey" FOREIGN KEY ("dispute_id") REFERENCES "disputes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trust_audits" ADD CONSTRAINT "trust_audits_seller_verification_id_fkey" FOREIGN KEY ("seller_verification_id") REFERENCES "seller_verifications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trust_audits" ADD CONSTRAINT "trust_audits_restriction_id_fkey" FOREIGN KEY ("restriction_id") REFERENCES "user_restrictions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trust_audits" ADD CONSTRAINT "trust_audits_policy_version_id_fkey" FOREIGN KEY ("policy_version_id") REFERENCES "policy_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Domain invariants not expressible in Prisma schema.
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_rating_check" CHECK ("rating" BETWEEN 1 AND 5);
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_participants_differ_check" CHECK ("reviewer_id" <> "reviewee_id");
ALTER TABLE "user_blocks" ADD CONSTRAINT "user_blocks_users_differ_check" CHECK ("blocker_id" <> "blocked_user_id");
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_participants_differ_check" CHECK ("opener_id" <> "counterparty_id");
ALTER TABLE "dispute_evidence" ADD CONSTRAINT "dispute_evidence_dimensions_check" CHECK ("width" > 0 AND "height" > 0);
ALTER TABLE "user_restrictions" ADD CONSTRAINT "user_restrictions_time_check" CHECK ("expires_at" IS NULL OR "expires_at" > "starts_at");
CREATE UNIQUE INDEX "policy_versions_one_current_per_type_key" ON "policy_versions"("policy_type") WHERE "is_current" = true;
CREATE UNIQUE INDEX "seller_verifications_one_active_per_user_key" ON "seller_verifications"("user_id") WHERE "status" IN ('PENDING', 'VERIFIED');

