ALTER TABLE "profiles"
  ADD COLUMN "profile_image_key" VARCHAR(255);

ALTER TABLE "profiles"
  ADD CONSTRAINT "profiles_username_format_check"
    CHECK ("username" ~ '^[a-z0-9_]{3,30}$'),
  ADD CONSTRAINT "profiles_image_metadata_pair_check"
    CHECK (("profile_image_key" IS NULL) = ("profile_image_url" IS NULL)),
  ADD CONSTRAINT "profiles_image_key_format_check"
    CHECK (
      "profile_image_key" IS NULL OR
      "profile_image_key" ~ '^profiles/[0-9a-f-]{36}/[0-9a-f-]{36}\.webp$'
    );
