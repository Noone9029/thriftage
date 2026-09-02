-- Thriftage monetized Lahore beta commerce foundation.
-- This migration is additive until the legacy single-reservation pointer is safely backfilled.

BEGIN;

ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'AWAITING_PAYMENT' BEFORE 'PENDING';
ALTER TYPE "OrderEventType" ADD VALUE IF NOT EXISTS 'PAYMENT_EXPIRED';
ALTER TYPE "OrderEventType" ADD VALUE IF NOT EXISTS 'REFUND_STATUS_CHANGED';
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'PAYFAST_HOSTED';
ALTER TYPE "PaymentProviderCode" ADD VALUE IF NOT EXISTS 'PAYFAST';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'REQUIRES_ACTION' BEFORE 'PENDING_COLLECTION';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'REFUND_PENDING';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'REFUNDED';
ALTER TYPE "ShipmentStatus" ADD VALUE IF NOT EXISTS 'BOOKED';
ALTER TYPE "ShipmentStatus" ADD VALUE IF NOT EXISTS 'PICKED_UP';
ALTER TYPE "ShipmentStatus" ADD VALUE IF NOT EXISTS 'IN_TRANSIT';
ALTER TYPE "ShipmentStatus" ADD VALUE IF NOT EXISTS 'FAILED';
ALTER TYPE "ShipmentStatus" ADD VALUE IF NOT EXISTS 'RETURNING';
ALTER TYPE "ShipmentStatus" ADD VALUE IF NOT EXISTS 'RETURNED';
ALTER TYPE "ShipmentStatus" ADD VALUE IF NOT EXISTS 'LOST';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'PAYOUT_DESTINATION_CHANGED';

CREATE TYPE "InventoryMovementType" AS ENUM ('RESERVED', 'RELEASED', 'SOLD', 'RESTOCKED', 'ADJUSTED');
CREATE TYPE "PayoutDestinationType" AS ENUM ('BANK_IBAN', 'EASYPAISA', 'JAZZCASH');
CREATE TYPE "PayoutProfileStatus" AS ENUM ('PENDING_REVIEW', 'ACTIVE', 'REJECTED', 'SUPERSEDED');
CREATE TYPE "SettlementSource" AS ENUM ('PAYFAST', 'COURIER_COD', 'MANUAL_BANK');
CREATE TYPE "SettlementStatus" AS ENUM ('PENDING', 'MATCHED', 'EXCEPTION', 'REVERSED');
CREATE TYPE "RefundStatus" AS ENUM ('REQUESTED', 'APPROVED', 'SUBMITTED', 'SUCCEEDED', 'FAILED', 'REJECTED', 'STOCK_PENDING_INSPECTION', 'STOCK_RESTORED');
CREATE TYPE "FinancialEntryType" AS ENUM ('PAYFAST_SETTLEMENT', 'COURIER_COD_DEPOSIT', 'REFUND', 'PROVIDER_COST', 'COURIER_COST', 'WITHHOLDING', 'COMMISSION', 'SELLER_PAYABLE', 'PAYOUT');
CREATE TYPE "PayoutBatchStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'PROCESSING', 'PAID', 'FAILED', 'CANCELLED');
CREATE TYPE "PayoutItemStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'CANCELLED');
CREATE TYPE "AdminPermissionCode" AS ENUM ('MODERATION', 'OPERATIONS', 'FINANCE_RECONCILIATION', 'PAYOUT_CREATE', 'PAYOUT_APPROVE', 'RELEASE', 'BILLING');

ALTER TABLE "listings"
  ADD COLUMN "stock_available" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "stock_reserved" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "stock_sold" INTEGER NOT NULL DEFAULT 0;

UPDATE "listings"
SET "stock_available" = CASE WHEN "status" IN ('RESERVED', 'SOLD') THEN 0 ELSE 1 END,
    "stock_reserved" = CASE WHEN "status" = 'RESERVED' THEN 1 ELSE 0 END,
    "stock_sold" = CASE WHEN "status" = 'SOLD' THEN 1 ELSE 0 END;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "listings"
    WHERE "stock_available" + "stock_reserved" + "stock_sold" <> 1
       OR ("status" = 'ACTIVE' AND "stock_available" <> 1)
       OR ("status" = 'RESERVED' AND "stock_reserved" <> 1)
       OR ("status" = 'SOLD' AND "stock_sold" <> 1)
  ) THEN
    RAISE EXCEPTION 'Listing stock backfill parity failed; migration rolled back.';
  END IF;
END;
$$;

ALTER TABLE "orders"
  ADD COLUMN "quantity" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "item_subtotal_minor" INTEGER,
  ADD COLUMN "delivery_rate_version" VARCHAR(40) NOT NULL DEFAULT 'lahore-flat-v1',
  ADD COLUMN "commission_bps" INTEGER NOT NULL DEFAULT 1000,
  ADD COLUMN "commission_minor" INTEGER,
  ADD COLUMN "withholding_bps" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "withholding_minor" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "seller_net_minor" INTEGER,
  ADD COLUMN "financial_policy_version" VARCHAR(40),
  ADD COLUMN "withholding_rule_version" VARCHAR(40),
  ADD COLUMN "payment_expires_at" TIMESTAMPTZ(3),
  ADD COLUMN "dispute_window_ends_at" TIMESTAMPTZ(3),
  ADD COLUMN "payout_eligible_at" TIMESTAMPTZ(3);

UPDATE "orders"
SET "item_subtotal_minor" = "price_minor",
    "commission_minor" = (("price_minor"::bigint * 1000 + 5000) / 10000)::integer,
    "seller_net_minor" = "price_minor" - (("price_minor"::bigint * 1000 + 5000) / 10000)::integer,
    "financial_policy_version" = 'marketplace-fees-v1',
    "withholding_rule_version" = 'withholding-unapproved-v1',
    "dispute_window_ends_at" = CASE WHEN "delivered_at" IS NULL THEN NULL ELSE "delivered_at" + INTERVAL '48 hours' END,
    "payout_eligible_at" = CASE WHEN "completed_at" IS NULL THEN NULL ELSE GREATEST("completed_at", COALESCE("delivered_at", "completed_at") + INTERVAL '48 hours') END;

ALTER TABLE "orders"
  ALTER COLUMN "item_subtotal_minor" SET NOT NULL,
  ALTER COLUMN "commission_minor" SET NOT NULL,
  ALTER COLUMN "seller_net_minor" SET NOT NULL,
  ALTER COLUMN "financial_policy_version" SET NOT NULL,
  ALTER COLUMN "withholding_rule_version" SET NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "orders"
    WHERE "quantity" <> 1
       OR "item_subtotal_minor" <> "price_minor"
       OR "total_minor" <> "item_subtotal_minor" + "shipping_minor"
       OR "seller_net_minor" <> "item_subtotal_minor" - "commission_minor" - "withholding_minor"
  ) THEN
    RAISE EXCEPTION 'Order financial snapshot backfill parity failed; migration rolled back.';
  END IF;
END;
$$;

ALTER TABLE "payments"
  ADD COLUMN "checkout_url" VARCHAR(2048),
  ADD COLUMN "expires_at" TIMESTAMPTZ(3),
  ADD COLUMN "refunded_at" TIMESTAMPTZ(3);

ALTER TABLE "shipments"
  ADD COLUMN "provider_code" VARCHAR(40) NOT NULL DEFAULT 'LOCAL_COURIER_MANUAL',
  ADD COLUMN "courier_reference" VARCHAR(120),
  ADD COLUMN "fee_minor" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "evidence_reference" VARCHAR(255),
  ADD COLUMN "booked_at" TIMESTAMPTZ(3),
  ADD COLUMN "picked_up_at" TIMESTAMPTZ(3),
  ADD COLUMN "returned_at" TIMESTAMPTZ(3);

CREATE TABLE "inventory_movements" (
  "id" UUID NOT NULL,
  "listing_id" UUID NOT NULL,
  "order_id" UUID,
  "actor_id" UUID,
  "type" "InventoryMovementType" NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "available_after" INTEGER NOT NULL,
  "reserved_after" INTEGER NOT NULL,
  "sold_after" INTEGER NOT NULL,
  "reason" VARCHAR(500),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "inventory_movements_pkey" PRIMARY KEY ("id")
);

INSERT INTO "inventory_movements" ("id", "listing_id", "order_id", "type", "quantity", "available_after", "reserved_after", "sold_after", "reason")
SELECT md5("id"::text || ':stock-migration-v1')::uuid,
       "id",
       CASE WHEN "status" = 'RESERVED' THEN "reserved_order_id" ELSE NULL END,
       'ADJUSTED'::"InventoryMovementType",
       1,
       "stock_available",
       "stock_reserved",
       "stock_sold",
       'Initial stock migrated from the single-unit listing model.'
FROM "listings";

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "listings" AS listing
    LEFT JOIN "inventory_movements" AS movement
      ON movement."listing_id" = listing."id"
     AND movement."reason" = 'Initial stock migrated from the single-unit listing model.'
    WHERE movement."id" IS NULL
       OR movement."available_after" <> listing."stock_available"
       OR movement."reserved_after" <> listing."stock_reserved"
       OR movement."sold_after" <> listing."stock_sold"
       OR (
         listing."status" = 'RESERVED'
         AND movement."order_id" IS DISTINCT FROM listing."reserved_order_id"
       )
  ) THEN
    RAISE EXCEPTION 'Inventory movement backfill parity failed; migration rolled back.';
  END IF;
END;
$$;

CREATE TABLE "seller_payout_profiles" (
  "id" UUID NOT NULL,
  "seller_id" UUID NOT NULL,
  "type" "PayoutDestinationType" NOT NULL,
  "destination_ciphertext" TEXT NOT NULL,
  "destination_iv" VARCHAR(64) NOT NULL,
  "destination_auth_tag" VARCHAR(64) NOT NULL,
  "destination_fingerprint" VARCHAR(64) NOT NULL,
  "display_label" VARCHAR(80) NOT NULL,
  "account_title" VARCHAR(120) NOT NULL,
  "status" "PayoutProfileStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
  "held_until" TIMESTAMPTZ(3) NOT NULL,
  "reviewed_by_id" UUID,
  "review_reason" VARCHAR(500),
  "reviewed_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "seller_payout_profiles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "settlements" (
  "id" UUID NOT NULL,
  "recorded_by_id" UUID NOT NULL,
  "source" "SettlementSource" NOT NULL,
  "external_reference" VARCHAR(255) NOT NULL,
  "amount_minor" INTEGER NOT NULL,
  "currency" "CurrencyCode" NOT NULL,
  "status" "SettlementStatus" NOT NULL DEFAULT 'PENDING',
  "evidence_reference" VARCHAR(255),
  "received_at" TIMESTAMPTZ(3) NOT NULL,
  "matched_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "settlements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "settlement_allocations" (
  "id" UUID NOT NULL,
  "settlement_id" UUID NOT NULL,
  "order_id" UUID NOT NULL,
  "payment_id" UUID NOT NULL,
  "amount_minor" INTEGER NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "settlement_allocations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "refunds" (
  "id" UUID NOT NULL,
  "order_id" UUID NOT NULL,
  "payment_id" UUID NOT NULL,
  "requested_by_id" UUID NOT NULL,
  "reviewed_by_id" UUID,
  "status" "RefundStatus" NOT NULL DEFAULT 'REQUESTED',
  "reason" VARCHAR(500) NOT NULL,
  "amount_minor" INTEGER NOT NULL,
  "commission_reversal_minor" INTEGER NOT NULL,
  "provider_reference" VARCHAR(255),
  "stock_restored_at" TIMESTAMPTZ(3),
  "reviewed_at" TIMESTAMPTZ(3),
  "completed_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "financial_entries" (
  "id" UUID NOT NULL,
  "order_id" UUID,
  "actor_id" UUID,
  "type" "FinancialEntryType" NOT NULL,
  "amount_minor" INTEGER NOT NULL,
  "currency" "CurrencyCode" NOT NULL,
  "external_reference" VARCHAR(255),
  "rule_version" VARCHAR(40) NOT NULL,
  "occurred_at" TIMESTAMPTZ(3) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "financial_entries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "payout_batches" (
  "id" UUID NOT NULL,
  "creator_id" UUID NOT NULL,
  "approver_id" UUID,
  "status" "PayoutBatchStatus" NOT NULL DEFAULT 'DRAFT',
  "currency" "CurrencyCode" NOT NULL,
  "total_minor" INTEGER NOT NULL,
  "approved_at" TIMESTAMPTZ(3),
  "paid_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "payout_batches_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "payout_items" (
  "id" UUID NOT NULL,
  "batch_id" UUID NOT NULL,
  "order_id" UUID NOT NULL,
  "payout_profile_id" UUID NOT NULL,
  "seller_id" UUID NOT NULL,
  "amount_minor" INTEGER NOT NULL,
  "status" "PayoutItemStatus" NOT NULL DEFAULT 'PENDING',
  "provider_reference" VARCHAR(255),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "payout_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "marketplace_analytics_events" (
  "id" UUID NOT NULL,
  "name" VARCHAR(80) NOT NULL,
  "actor_id" UUID,
  "target_user_id" UUID,
  "category_id" UUID,
  "listing_id" UUID,
  "conversation_id" UUID,
  "order_id" UUID,
  "occurred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "marketplace_analytics_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "admin_permission_grants" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "permission" "AdminPermissionCode" NOT NULL,
  "granted_by_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "admin_permission_grants_pkey" PRIMARY KEY ("id")
);

DROP INDEX IF EXISTS "orders_one_active_per_listing_idx";
ALTER TABLE "listings" DROP CONSTRAINT IF EXISTS "listings_reservation_state_check";
ALTER TABLE "listings" DROP CONSTRAINT IF EXISTS "listings_reserved_order_id_fkey";
DROP INDEX IF EXISTS "listings_reserved_order_id_key";
ALTER TABLE "listings" DROP COLUMN "reserved_order_id"; -- migration-safety: approved; reservation ownership is preserved in inventory_movements/order_id after the verified backfill above; recover by restoring the pre-migration backup if parity checks fail.

ALTER TABLE "listings"
  ADD CONSTRAINT "listings_stock_check" CHECK (
    "stock_available" >= 0 AND "stock_reserved" >= 0 AND "stock_sold" >= 0
    AND "stock_available" + "stock_reserved" + "stock_sold" BETWEEN 1 AND 999
  ),
  ADD CONSTRAINT "listings_stock_status_check" CHECK (
    ("status" = 'ACTIVE' AND "stock_available" > 0)
    OR ("status" = 'RESERVED' AND "stock_available" = 0 AND "stock_reserved" > 0)
    OR ("status" = 'SOLD' AND "stock_available" = 0 AND "stock_reserved" = 0 AND "stock_sold" > 0)
    OR "status" NOT IN ('ACTIVE', 'RESERVED', 'SOLD')
  );

ALTER TABLE "orders"
  DROP CONSTRAINT "orders_money_check",
  ADD CONSTRAINT "orders_money_check" CHECK (
    "quantity" = 1
    AND "price_minor" = "item_subtotal_minor"
    AND "item_subtotal_minor" > 0
    AND "shipping_minor" >= 0
    AND "total_minor" = "item_subtotal_minor" + "shipping_minor"
    AND "commission_bps" BETWEEN 0 AND 10000
    AND "commission_minor" = (("item_subtotal_minor"::bigint * "commission_bps" + 5000) / 10000)::integer
    AND "withholding_bps" BETWEEN 0 AND 10000
    AND "withholding_minor" >= 0
    AND "seller_net_minor" = "item_subtotal_minor" - "commission_minor" - "withholding_minor"
    AND "seller_net_minor" >= 0
  );

ALTER TABLE "shipments" ADD CONSTRAINT "shipments_fee_check" CHECK ("fee_minor" >= 0);
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_counts_check" CHECK ("quantity" > 0 AND "available_after" >= 0 AND "reserved_after" >= 0 AND "sold_after" >= 0);
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_amount_check" CHECK ("amount_minor" > 0);
ALTER TABLE "settlement_allocations" ADD CONSTRAINT "settlement_allocations_amount_check" CHECK ("amount_minor" > 0);
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_amount_check" CHECK ("amount_minor" > 0 AND "commission_reversal_minor" >= 0);
ALTER TABLE "payout_batches" ADD CONSTRAINT "payout_batches_amount_and_approval_check" CHECK ("total_minor" >= 0 AND ("approver_id" IS NULL OR "approver_id" <> "creator_id"));
ALTER TABLE "payout_items" ADD CONSTRAINT "payout_items_amount_check" CHECK ("amount_minor" > 0);

CREATE INDEX "inventory_movements_listing_created_idx" ON "inventory_movements"("listing_id", "created_at");
CREATE INDEX "inventory_movements_order_created_idx" ON "inventory_movements"("order_id", "created_at");
CREATE UNIQUE INDEX "seller_payout_profiles_seller_fingerprint_key" ON "seller_payout_profiles"("seller_id", "destination_fingerprint");
CREATE INDEX "seller_payout_profiles_seller_status_idx" ON "seller_payout_profiles"("seller_id", "status", "created_at");
CREATE INDEX "seller_payout_profiles_status_hold_idx" ON "seller_payout_profiles"("status", "held_until");
CREATE UNIQUE INDEX "settlements_source_reference_key" ON "settlements"("source", "external_reference");
CREATE INDEX "settlements_status_received_idx" ON "settlements"("status", "received_at");
CREATE UNIQUE INDEX "settlement_allocations_settlement_order_key" ON "settlement_allocations"("settlement_id", "order_id");
CREATE INDEX "settlement_allocations_order_idx" ON "settlement_allocations"("order_id");
CREATE UNIQUE INDEX "refunds_order_id_key" ON "refunds"("order_id");
CREATE INDEX "refunds_status_created_idx" ON "refunds"("status", "created_at");
CREATE UNIQUE INDEX "financial_entries_type_reference_key" ON "financial_entries"("type", "external_reference");
CREATE INDEX "financial_entries_order_occurred_idx" ON "financial_entries"("order_id", "occurred_at");
CREATE INDEX "financial_entries_type_occurred_idx" ON "financial_entries"("type", "occurred_at");
CREATE INDEX "financial_entries_actor_occurred_idx" ON "financial_entries"("actor_id", "occurred_at");
CREATE INDEX "payout_batches_status_created_idx" ON "payout_batches"("status", "created_at");
CREATE UNIQUE INDEX "payout_items_order_id_key" ON "payout_items"("order_id");
CREATE INDEX "payout_items_batch_status_idx" ON "payout_items"("batch_id", "status");
CREATE INDEX "payout_items_seller_created_idx" ON "payout_items"("seller_id", "created_at");
CREATE INDEX "marketplace_analytics_events_name_occurred_idx" ON "marketplace_analytics_events"("name", "occurred_at");
CREATE INDEX "marketplace_analytics_events_actor_occurred_idx" ON "marketplace_analytics_events"("actor_id", "occurred_at");
CREATE INDEX "marketplace_analytics_events_listing_occurred_idx" ON "marketplace_analytics_events"("listing_id", "occurred_at");
CREATE INDEX "marketplace_analytics_events_order_occurred_idx" ON "marketplace_analytics_events"("order_id", "occurred_at");
CREATE UNIQUE INDEX "admin_permission_grants_user_permission_key" ON "admin_permission_grants"("user_id", "permission");
CREATE INDEX "admin_permission_grants_permission_user_idx" ON "admin_permission_grants"("permission", "user_id");

ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "seller_payout_profiles" ADD CONSTRAINT "seller_payout_profiles_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "seller_payout_profiles" ADD CONSTRAINT "seller_payout_profiles_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "settlement_allocations" ADD CONSTRAINT "settlement_allocations_settlement_id_fkey" FOREIGN KEY ("settlement_id") REFERENCES "settlements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "settlement_allocations" ADD CONSTRAINT "settlement_allocations_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "settlement_allocations" ADD CONSTRAINT "settlement_allocations_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "financial_entries" ADD CONSTRAINT "financial_entries_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "financial_entries" ADD CONSTRAINT "financial_entries_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payout_batches" ADD CONSTRAINT "payout_batches_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payout_batches" ADD CONSTRAINT "payout_batches_approver_id_fkey" FOREIGN KEY ("approver_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payout_items" ADD CONSTRAINT "payout_items_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "payout_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payout_items" ADD CONSTRAINT "payout_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payout_items" ADD CONSTRAINT "payout_items_profile_id_fkey" FOREIGN KEY ("payout_profile_id") REFERENCES "seller_payout_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payout_items" ADD CONSTRAINT "payout_items_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "marketplace_analytics_events" ADD CONSTRAINT "marketplace_analytics_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "admin_permission_grants" ADD CONSTRAINT "admin_permission_grants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "admin_permission_grants" ADD CONSTRAINT "admin_permission_grants_granted_by_id_fkey" FOREIGN KEY ("granted_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION "reject_immutable_marketplace_update"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME USING ERRCODE = '55000';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "inventory_movements_immutable" BEFORE UPDATE OR DELETE ON "inventory_movements" FOR EACH ROW EXECUTE FUNCTION "reject_immutable_marketplace_update"();
CREATE TRIGGER "financial_entries_immutable" BEFORE UPDATE OR DELETE ON "financial_entries" FOR EACH ROW EXECUTE FUNCTION "reject_immutable_marketplace_update"();
CREATE TRIGGER "settlement_allocations_immutable" BEFORE UPDATE OR DELETE ON "settlement_allocations" FOR EACH ROW EXECUTE FUNCTION "reject_immutable_marketplace_update"();
CREATE TRIGGER "settlements_immutable" BEFORE UPDATE OR DELETE ON "settlements" FOR EACH ROW EXECUTE FUNCTION "reject_immutable_marketplace_update"();

COMMIT;
