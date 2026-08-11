# ADR 0001: Supabase Auth as the Initial Identity Provider

- Status: Accepted
- Date: 2026-08-10

## Context

Thriftage needs password, phone, reset, verification, and session capabilities without making marketplace data depend on one identity vendor. Authentication identity and application authorization have different lifecycles and must remain separate.

## Decision

Thriftage will initially use Supabase Auth as its managed identity provider. Supabase Auth is responsible for:

- credential verification and password authentication;
- phone authentication when configured;
- password reset and authentication sessions;
- the identity-provider user ID; and
- email or phone verification state when Supabase provides it.

The Thriftage PostgreSQL database is responsible for:

- the application `User` and one-to-one `Profile` records;
- username and public profile information;
- application roles and account state;
- future moderation and seller-related state; and
- application timestamps and metadata.

`User.authProviderUserId` stores the unique external subject. It is not the application primary key. Application records use UUID primary keys so marketplace foreign keys remain stable if the identity provider changes. The API verifies routine access tokens through an application-owned interface backed by Supabase `getClaims`, and provisioning performs an authoritative `getUser` lookup before linking identity data.

Thriftage will not store passwords or password hashes, and Prisma models will not mirror Supabase internal authentication tables. A later bounded authentication task will validate Supabase sessions and provision/link application users through a server-controlled service.

## Data and Privacy Boundaries

Public profiles expose only the application user ID, username, optional profile fields, completed-sales count, and membership date. Full name remains private until a public-display-name policy is approved. Public contracts never expose email, phone, external auth subjects, account status, moderation metadata, or deletion state.

Owner profile inputs cannot set role, account status, verification state, or completed-sales count. Email and phone normalization happens at trusted application boundaries; phone numbers use canonical E.164 form.

Seller and buyer rating aggregates are deferred to the reviews module. No editable or placeholder rating fields are stored on `Profile`.

## Consequences

- Authentication-provider outages affect sign-in but do not change application identity or marketplace ownership.
- User provisioning must explicitly map a verified Supabase subject to one application `User`.
- Replacing Supabase later requires adapting the identity integration, not rewriting marketplace foreign keys.
- Login, signup, and authentication UI remain separate client tasks. Phase 1B implements only the API boundary and provisioning lifecycle.
