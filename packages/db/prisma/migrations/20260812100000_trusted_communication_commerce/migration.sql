-- CreateEnum
CREATE TYPE "MessageModerationState" AS ENUM ('CLEAR', 'FLAGGED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "MessageFlagCategory" AS ENUM ('PHONE_NUMBER', 'EMAIL_ADDRESS', 'WHATSAPP', 'SOCIAL_HANDLE', 'OBFUSCATED_CONTACT');

-- CreateEnum
CREATE TYPE "MessageFlagStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'ACTIONED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OrderEventType" AS ENUM ('ORDER_CREATED', 'SELLER_CONFIRMED', 'SELLER_CANCELLED', 'BUYER_CANCELLED', 'MARKED_SHIPPED', 'MARKED_DELIVERED', 'COMPLETED', 'PAYMENT_STATUS_CHANGED');

-- CreateEnum
CREATE TYPE "OrderActorType" AS ENUM ('USER', 'ADMIN', 'SYSTEM');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH_ON_DELIVERY');

-- CreateEnum
CREATE TYPE "PaymentProviderCode" AS ENUM ('CASH_ON_DELIVERY');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING_COLLECTION', 'COLLECTED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ShipmentStatus" AS ENUM ('PENDING', 'SHIPPED', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('NEW_FOLLOWER', 'NEW_MESSAGE', 'ITEM_PURCHASED', 'ITEM_SOLD', 'ORDER_CONFIRMED', 'ORDER_SHIPPED', 'ORDER_DELIVERED', 'ORDER_COMPLETED', 'ORDER_CANCELLED', 'LISTING_APPROVED', 'LISTING_REJECTED', 'LISTING_REMOVED');

-- CreateEnum
CREATE TYPE "NotificationOutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "PushPlatform" AS ENUM ('IOS', 'ANDROID');

-- CreateEnum
CREATE TYPE "PushDeliveryStatus" AS ENUM ('PENDING', 'TICKET_ACCEPTED', 'DELIVERED', 'RETRY', 'FAILED', 'DEVICE_UNREGISTERED');

-- AlterTable
ALTER TABLE "listings" ADD COLUMN     "reserved_order_id" UUID;

-- CreateTable
CREATE TABLE "conversations" (
    "id" UUID NOT NULL,
    "listing_id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "buyer_id" UUID NOT NULL,
    "last_message_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "sender_id" UUID NOT NULL,
    "body" VARCHAR(2000) NOT NULL,
    "moderation_state" "MessageModerationState" NOT NULL DEFAULT 'CLEAR',
    "read_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_moderation_flags" (
    "id" UUID NOT NULL,
    "message_id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "category" "MessageFlagCategory" NOT NULL,
    "detector" VARCHAR(64) NOT NULL,
    "confidence" INTEGER NOT NULL,
    "blocked" BOOLEAN NOT NULL,
    "requires_review" BOOLEAN NOT NULL DEFAULT true,
    "status" "MessageFlagStatus" NOT NULL DEFAULT 'OPEN',
    "reviewer_id" UUID,
    "resolution" VARCHAR(1000),
    "reviewed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "message_moderation_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_moderation_audits" (
    "id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "flag_id" UUID,
    "action" VARCHAR(64) NOT NULL,
    "reason" VARCHAR(1000),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_moderation_audits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "addresses" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "label" VARCHAR(50) NOT NULL,
    "recipient_name" VARCHAR(120) NOT NULL,
    "phone" VARCHAR(32) NOT NULL,
    "address_line_1" VARCHAR(180) NOT NULL,
    "address_line_2" VARCHAR(180),
    "city" VARCHAR(100) NOT NULL,
    "region" VARCHAR(100) NOT NULL,
    "postal_code" VARCHAR(32),
    "country_code" CHAR(2) NOT NULL,
    "delivery_instructions" VARCHAR(500),
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL,
    "order_number" VARCHAR(32) NOT NULL,
    "idempotency_key" UUID NOT NULL,
    "listing_id" UUID NOT NULL,
    "conversation_id" UUID,
    "buyer_id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "listing_title" VARCHAR(120) NOT NULL,
    "listing_image_key" VARCHAR(255),
    "buyer_username" VARCHAR(30) NOT NULL,
    "seller_username" VARCHAR(30) NOT NULL,
    "price_minor" INTEGER NOT NULL,
    "shipping_minor" INTEGER NOT NULL DEFAULT 0,
    "total_minor" INTEGER NOT NULL,
    "currency" "CurrencyCode" NOT NULL,
    "payment_method" "PaymentMethod" NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "recipient_name" VARCHAR(120) NOT NULL,
    "delivery_phone" VARCHAR(32) NOT NULL,
    "address_line_1" VARCHAR(180) NOT NULL,
    "address_line_2" VARCHAR(180),
    "city" VARCHAR(100) NOT NULL,
    "region" VARCHAR(100) NOT NULL,
    "postal_code" VARCHAR(32),
    "country_code" CHAR(2) NOT NULL,
    "delivery_instructions" VARCHAR(500),
    "cancellation_reason" VARCHAR(500),
    "cancelled_by_id" UUID,
    "confirmed_at" TIMESTAMPTZ(3),
    "shipped_at" TIMESTAMPTZ(3),
    "delivered_at" TIMESTAMPTZ(3),
    "completed_at" TIMESTAMPTZ(3),
    "cancelled_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "provider" "PaymentProviderCode" NOT NULL,
    "provider_reference" VARCHAR(255),
    "amount_minor" INTEGER NOT NULL,
    "currency" "CurrencyCode" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING_COLLECTION',
    "failure_code" VARCHAR(64),
    "collected_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_provider_events" (
    "id" UUID NOT NULL,
    "payment_id" UUID NOT NULL,
    "provider_event_id" VARCHAR(255) NOT NULL,
    "event_type" VARCHAR(80) NOT NULL,
    "payload_hash" VARCHAR(64) NOT NULL,
    "processed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_provider_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipments" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "provider_display_name" VARCHAR(100) NOT NULL,
    "tracking_number" VARCHAR(120),
    "tracking_url" VARCHAR(2048),
    "status" "ShipmentStatus" NOT NULL DEFAULT 'PENDING',
    "shipped_at" TIMESTAMPTZ(3),
    "delivered_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "shipments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_events" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "actor_id" UUID,
    "actor_type" "OrderActorType" NOT NULL,
    "type" "OrderEventType" NOT NULL,
    "previous_state" VARCHAR(32),
    "next_state" VARCHAR(32),
    "reason" VARCHAR(500),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "recipient_id" UUID NOT NULL,
    "type" "NotificationType" NOT NULL,
    "actor_user_id" UUID,
    "listing_id" UUID,
    "conversation_id" UUID,
    "order_id" UUID,
    "title" VARCHAR(120) NOT NULL,
    "body" VARCHAR(240) NOT NULL,
    "dedupe_key" VARCHAR(255) NOT NULL,
    "read_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_devices" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "expo_push_token" VARCHAR(255) NOT NULL,
    "platform" "PushPlatform" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "last_seen_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "push_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_outbox" (
    "id" UUID NOT NULL,
    "recipient_id" UUID NOT NULL,
    "event_type" "NotificationType" NOT NULL,
    "actor_user_id" UUID,
    "listing_id" UUID,
    "conversation_id" UUID,
    "order_id" UUID,
    "message_id" UUID,
    "dedupe_key" VARCHAR(255) NOT NULL,
    "status" "NotificationOutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "available_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "locked_at" TIMESTAMPTZ(3),
    "last_error_code" VARCHAR(64),
    "processed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "notification_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_deliveries" (
    "id" UUID NOT NULL,
    "notification_id" UUID NOT NULL,
    "push_device_id" UUID NOT NULL,
    "status" "PushDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "ticket_id" VARCHAR(255),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "next_receipt_at" TIMESTAMPTZ(3),
    "last_error_code" VARCHAR(64),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "push_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "conversations_seller_last_message_idx" ON "conversations"("seller_id", "last_message_at", "id");

-- CreateIndex
CREATE INDEX "conversations_buyer_last_message_idx" ON "conversations"("buyer_id", "last_message_at", "id");

-- CreateIndex
CREATE UNIQUE INDEX "conversations_listing_id_buyer_id_key" ON "conversations"("listing_id", "buyer_id");

-- CreateIndex
CREATE INDEX "messages_conversation_created_id_idx" ON "messages"("conversation_id", "created_at", "id");

-- CreateIndex
CREATE INDEX "messages_conversation_read_created_idx" ON "messages"("conversation_id", "read_at", "created_at");

-- CreateIndex
CREATE INDEX "messages_sender_created_idx" ON "messages"("sender_id", "created_at");

-- CreateIndex
CREATE INDEX "message_moderation_flags_status_created_idx" ON "message_moderation_flags"("status", "created_at", "id");

-- CreateIndex
CREATE INDEX "message_moderation_flags_conversation_created_idx" ON "message_moderation_flags"("conversation_id", "created_at");

-- CreateIndex
CREATE INDEX "message_moderation_flags_message_idx" ON "message_moderation_flags"("message_id");

-- CreateIndex
CREATE INDEX "message_moderation_audits_conversation_created_idx" ON "message_moderation_audits"("conversation_id", "created_at");

-- CreateIndex
CREATE INDEX "message_moderation_audits_actor_created_idx" ON "message_moderation_audits"("actor_id", "created_at");

-- CreateIndex
CREATE INDEX "addresses_user_created_idx" ON "addresses"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "orders_order_number_key" ON "orders"("order_number");

-- CreateIndex
CREATE INDEX "orders_buyer_created_id_idx" ON "orders"("buyer_id", "created_at", "id");

-- CreateIndex
CREATE INDEX "orders_seller_created_id_idx" ON "orders"("seller_id", "created_at", "id");

-- CreateIndex
CREATE INDEX "orders_listing_status_idx" ON "orders"("listing_id", "status");

-- CreateIndex
CREATE INDEX "orders_status_updated_idx" ON "orders"("status", "updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "orders_buyer_id_idempotency_key_key" ON "orders"("buyer_id", "idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "payments_order_id_key" ON "payments"("order_id");

-- CreateIndex
CREATE INDEX "payments_status_updated_idx" ON "payments"("status", "updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "payment_provider_events_provider_event_id_key" ON "payment_provider_events"("provider_event_id");

-- CreateIndex
CREATE INDEX "payment_provider_events_payment_processed_idx" ON "payment_provider_events"("payment_id", "processed_at");

-- CreateIndex
CREATE UNIQUE INDEX "shipments_order_id_key" ON "shipments"("order_id");

-- CreateIndex
CREATE INDEX "shipments_status_updated_idx" ON "shipments"("status", "updated_at");

-- CreateIndex
CREATE INDEX "order_events_order_created_idx" ON "order_events"("order_id", "created_at");

-- CreateIndex
CREATE INDEX "order_events_actor_created_idx" ON "order_events"("actor_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_dedupe_key_key" ON "notifications"("dedupe_key");

-- CreateIndex
CREATE INDEX "notifications_recipient_created_id_idx" ON "notifications"("recipient_id", "created_at", "id");

-- CreateIndex
CREATE INDEX "notifications_recipient_read_created_idx" ON "notifications"("recipient_id", "read_at", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "push_devices_expo_push_token_key" ON "push_devices"("expo_push_token");

-- CreateIndex
CREATE INDEX "push_devices_user_active_seen_idx" ON "push_devices"("user_id", "active", "last_seen_at");

-- CreateIndex
CREATE UNIQUE INDEX "notification_outbox_dedupe_key_key" ON "notification_outbox"("dedupe_key");

-- CreateIndex
CREATE INDEX "notification_outbox_status_available_idx" ON "notification_outbox"("status", "available_at", "created_at");

-- CreateIndex
CREATE INDEX "notification_outbox_locked_idx" ON "notification_outbox"("locked_at");

-- CreateIndex
CREATE UNIQUE INDEX "push_deliveries_ticket_id_key" ON "push_deliveries"("ticket_id");

-- CreateIndex
CREATE INDEX "push_deliveries_status_receipt_idx" ON "push_deliveries"("status", "next_receipt_at");

-- CreateIndex
CREATE UNIQUE INDEX "push_deliveries_notification_device_key" ON "push_deliveries"("notification_id", "push_device_id");

-- CreateIndex
CREATE UNIQUE INDEX "listings_reserved_order_id_key" ON "listings"("reserved_order_id");

-- AddForeignKey
ALTER TABLE "listings" ADD CONSTRAINT "listings_reserved_order_id_fkey" FOREIGN KEY ("reserved_order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_moderation_flags" ADD CONSTRAINT "message_moderation_flags_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_moderation_flags" ADD CONSTRAINT "message_moderation_flags_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_moderation_flags" ADD CONSTRAINT "message_moderation_flags_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_moderation_audits" ADD CONSTRAINT "message_moderation_audits_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_moderation_audits" ADD CONSTRAINT "message_moderation_audits_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_moderation_audits" ADD CONSTRAINT "message_moderation_audits_flag_id_fkey" FOREIGN KEY ("flag_id") REFERENCES "message_moderation_flags"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_cancelled_by_id_fkey" FOREIGN KEY ("cancelled_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_provider_events" ADD CONSTRAINT "payment_provider_events_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_events" ADD CONSTRAINT "order_events_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_events" ADD CONSTRAINT "order_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_devices" ADD CONSTRAINT "push_devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_outbox" ADD CONSTRAINT "notification_outbox_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_outbox" ADD CONSTRAINT "notification_outbox_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_outbox" ADD CONSTRAINT "notification_outbox_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_outbox" ADD CONSTRAINT "notification_outbox_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_outbox" ADD CONSTRAINT "notification_outbox_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_outbox" ADD CONSTRAINT "notification_outbox_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_deliveries" ADD CONSTRAINT "push_deliveries_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "notifications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_deliveries" ADD CONSTRAINT "push_deliveries_push_device_id_fkey" FOREIGN KEY ("push_device_id") REFERENCES "push_devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Domain invariants Prisma cannot express directly.
ALTER TABLE "conversations"
  ADD CONSTRAINT "conversations_distinct_participants_check"
  CHECK ("seller_id" <> "buyer_id");

ALTER TABLE "message_moderation_flags"
  ADD CONSTRAINT "message_moderation_flags_confidence_check"
  CHECK ("confidence" BETWEEN 0 AND 100);

ALTER TABLE "addresses"
  ADD CONSTRAINT "addresses_country_code_check"
  CHECK ("country_code" ~ '^[A-Z]{2}$');

CREATE UNIQUE INDEX "addresses_one_default_per_user_idx"
  ON "addresses" ("user_id")
  WHERE "is_default" = true;

ALTER TABLE "orders"
  ADD CONSTRAINT "orders_distinct_participants_check"
  CHECK ("buyer_id" <> "seller_id"),
  ADD CONSTRAINT "orders_money_check"
  CHECK ("price_minor" > 0 AND "shipping_minor" >= 0 AND "total_minor" = "price_minor" + "shipping_minor"),
  ADD CONSTRAINT "orders_country_code_check"
  CHECK ("country_code" ~ '^[A-Z]{2}$');

CREATE UNIQUE INDEX "orders_one_active_per_listing_idx"
  ON "orders" ("listing_id")
  WHERE "status" <> 'CANCELLED';

ALTER TABLE "payments"
  ADD CONSTRAINT "payments_amount_check"
  CHECK ("amount_minor" > 0);

ALTER TABLE "notification_outbox"
  ADD CONSTRAINT "notification_outbox_attempts_check"
  CHECK ("attempts" >= 0);

ALTER TABLE "push_deliveries"
  ADD CONSTRAINT "push_deliveries_attempts_check"
  CHECK ("attempts" >= 0);

ALTER TABLE "listings"
  ADD CONSTRAINT "listings_reservation_state_check"
  CHECK (
    ("status" = 'RESERVED' AND "reserved_order_id" IS NOT NULL)
    OR
    ("status" <> 'RESERVED' AND "reserved_order_id" IS NULL)
  );
