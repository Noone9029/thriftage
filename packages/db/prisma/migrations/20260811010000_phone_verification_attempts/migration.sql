CREATE TYPE "PhoneVerificationAttemptStatus" AS ENUM (
  'PENDING',
  'PROVIDER_VERIFIED',
  'LINKED',
  'EXPIRED',
  'CANCELLED',
  'FAILED'
);

CREATE TYPE "PhoneVerificationProvider" AS ENUM ('TWILIO_VERIFY');

CREATE TABLE "phone_verification_attempts" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "phone" VARCHAR(32) NOT NULL,
  "provider" "PhoneVerificationProvider" NOT NULL DEFAULT 'TWILIO_VERIFY',
  "provider_reference" VARCHAR(64),
  "status" "PhoneVerificationAttemptStatus" NOT NULL DEFAULT 'PENDING',
  "send_count" INTEGER NOT NULL DEFAULT 1,
  "verification_check_count" INTEGER NOT NULL DEFAULT 0,
  "expires_at" TIMESTAMPTZ(3) NOT NULL,
  "resend_available_at" TIMESTAMPTZ(3) NOT NULL,
  "provider_verified_at" TIMESTAMPTZ(3),
  "linked_at" TIMESTAMPTZ(3),
  "cancelled_at" TIMESTAMPTZ(3),
  "failed_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,

  CONSTRAINT "phone_verification_attempts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "phone_verification_attempts_send_count_check" CHECK ("send_count" >= 1),
  CONSTRAINT "phone_verification_attempts_check_count_check" CHECK ("verification_check_count" >= 0),
  CONSTRAINT "phone_verification_attempts_expiry_check" CHECK ("expires_at" > "created_at"),
  CONSTRAINT "phone_verification_attempts_provider_verified_check" CHECK (
    "status" NOT IN ('PROVIDER_VERIFIED', 'LINKED') OR "provider_verified_at" IS NOT NULL
  ),
  CONSTRAINT "phone_verification_attempts_linked_check" CHECK (
    ("status" = 'LINKED') = ("linked_at" IS NOT NULL)
  ),
  CONSTRAINT "phone_verification_attempts_cancelled_check" CHECK (
    ("status" = 'CANCELLED') = ("cancelled_at" IS NOT NULL)
  ),
  CONSTRAINT "phone_verification_attempts_failed_check" CHECK (
    ("status" = 'FAILED') = ("failed_at" IS NOT NULL)
  )
);

CREATE INDEX "phone_verification_attempts_user_status_created_idx"
  ON "phone_verification_attempts"("user_id", "status", "created_at");
CREATE INDEX "phone_verification_attempts_user_created_idx"
  ON "phone_verification_attempts"("user_id", "created_at");
CREATE INDEX "phone_verification_attempts_phone_status_idx"
  ON "phone_verification_attempts"("phone", "status");
CREATE INDEX "phone_verification_attempts_status_expires_idx"
  ON "phone_verification_attempts"("status", "expires_at");

ALTER TABLE "phone_verification_attempts"
  ADD CONSTRAINT "phone_verification_attempts_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
