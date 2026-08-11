# Mobile Email Authentication

Phase 1C1 adds email/password authentication to the Expo application. Supabase remains authoritative for credentials and sessions; the Thriftage API remains authoritative for application-user identity, role, and account status. Phone authentication is deferred to Phase 1C2, and Profile onboarding is deferred to Phase 1D.

## Architecture and routes

The root `AuthProvider` restores the Supabase session, subscribes once to auth changes, manages native foreground auto-refresh, and coordinates backend account resolution. TanStack Query owns `/auth/me` server state, but never owns the Supabase session.

Expo Router protects distinct route sets:

```text
(auth)/    login, signup, verify-email, forgot-password,
           reset-password, complete-account
(app)/     authenticated development placeholder
(blocked)/ suspended or deactivated account state
auth/      allowlisted callback landing routes
```

The explicit mobile state model distinguishes bootstrapping, signed out, pending email verification, authenticated-unprovisioned, authenticated-active, suspended, deactivated, and password recovery. Route guards remove inaccessible screens when state changes.

## Session lifecycle and storage

The single Supabase client uses persistent sessions, automatic refresh, disabled URL auto-detection, and `processLock`. Android and iOS store the Supabase payload in Expo SecureStore through an application-owned versioned chunk adapter. New generations are committed only after every chunk is written, then old chunks are deleted. Native credentials never fall back to plaintext storage. Web export uses browser `localStorage`, isolated behind the same asynchronous contract. Expo's server-side static-render pass receives an empty no-op store because no browser session exists there; this preserves browser/CI compatibility without creating a plaintext native fallback.

On native startup, the provider starts refresh only while `AppState` is active and stops it in background. The listener and auth subscription are registered once and removed on provider cleanup. API requests obtain the current access token immediately before sending, attach `Authorization: Bearer <token>`, and perform at most one Supabase refresh/retry for invalid or expired token errors.

## Signup and provisioning

```text
User -> Signup form -> Supabase Auth -> email confirmation if required
     -> Thriftage deep link -> Supabase session -> GET /auth/me
     -> POST /auth/provision when required -> GET /auth/me -> authenticated app
```

If signup returns a session, provisioning begins immediately. If email confirmation is required, only normalized `fullName` is retained; passwords and tokens are never copied into the pending-registration store. After cross-device confirmation/login, an unprovisioned identity without a pending name is routed to `complete-account`, which asks only for full name.

## Login and password recovery

```text
User -> Supabase Auth -> session -> GET /auth/me
     -> application account-state resolution -> authenticated app

User -> forgot-password -> Supabase email -> Thriftage recovery deep link
     -> PASSWORD_RECOVERY -> reset-password -> Supabase updateUser(password)
```

Suspended and deactivated API errors enter dedicated blocked states and are never treated as token-refresh failures. Logout clears the local application user, private query cache, pending registration data, and authenticated routes.

## Deep links and required configuration

The application scheme is `thriftage`. Only these callback paths are accepted:

- `thriftage://auth/callback`
- `thriftage://auth/reset-password`

The parser rejects other schemes, hosts, paths, embedded credentials, provider errors, missing credentials, and arbitrary navigation parameters. Supported Supabase session establishment uses `setSession` for token fragments, `exchangeCodeForSession` for PKCE codes, or `verifyOtp` for allowlisted email token hashes.

The Supabase Dashboard must still be configured manually. Add the two URLs above (or the narrow `thriftage://auth/**` pattern) to Authentication redirect URLs and ensure confirmation/recovery templates respect `redirectTo`. No Dashboard changes or native store builds were performed by this task. A new development/production native binary is required after adding the SecureStore config plugin.

Required mobile variables are `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_SUPABASE_URL`, and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Only the publishable key belongs in the mobile bundle; database, secret, and service-role credentials are forbidden.
