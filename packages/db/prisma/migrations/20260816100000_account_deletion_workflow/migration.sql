CREATE TYPE "AccountDeletionStatus" AS ENUM ('REQUESTED', 'PROCESSING', 'RETRY', 'COMPLETED', 'FAILED');

CREATE TABLE "account_deletion_requests" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "auth_provider_user_id" VARCHAR(255),
  "status" "AccountDeletionStatus" NOT NULL DEFAULT 'REQUESTED',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "next_attempt_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "locked_at" TIMESTAMPTZ(3),
  "session_revoked_at" TIMESTAMPTZ(3),
  "media_deleted_at" TIMESTAMPTZ(3),
  "data_anonymized_at" TIMESTAMPTZ(3),
  "auth_identity_deleted_at" TIMESTAMPTZ(3),
  "completed_at" TIMESTAMPTZ(3),
  "last_error_code" VARCHAR(64),
  "requested_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "account_deletion_requests_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "account_deletion_requests_attempts_check" CHECK ("attempts" >= 0),
  CONSTRAINT "account_deletion_requests_completion_check" CHECK (
    ("status" = 'COMPLETED' AND "completed_at" IS NOT NULL AND "auth_provider_user_id" IS NULL) OR
    ("status" <> 'COMPLETED' AND "completed_at" IS NULL)
  )
);

CREATE UNIQUE INDEX "account_deletion_requests_user_id_key" ON "account_deletion_requests"("user_id");
CREATE INDEX "account_deletion_requests_status_next_idx" ON "account_deletion_requests"("status", "next_attempt_at", "requested_at");
CREATE INDEX "account_deletion_requests_status_locked_idx" ON "account_deletion_requests"("status", "locked_at");

ALTER TABLE "account_deletion_requests"
  ADD CONSTRAINT "account_deletion_requests_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
