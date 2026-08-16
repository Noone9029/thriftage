# Production Architecture

Thriftage has three isolated deployment identities. `DEPLOYMENT_ENV` is authoritative and must be `local`, `staging`, or `production`; non-local processes also require `NODE_ENV=production`, structured JSON logs, a release identifier, HTTPS origins, and non-placeholder provider configuration.

```text
Preview mobile -> Staging API -> Staging Supabase Postgres/Auth/Storage/Realtime
                              -> Staging Twilio Verify project/service
                              -> Staging OpenAI project
                              -> Staging Sentry projects

Production mobile -> Production API -> Production Supabase project
                                    -> Production Twilio/OpenAI/Sentry projects
```

The mobile app receives only public values prefixed with `EXPO_PUBLIC_`: API URL, Supabase URL/publishable key, public Sentry DSN, policy/support links, environment, and release. Database URLs, Supabase secret keys, Twilio credentials, OpenAI keys, Expo push access tokens, SMTP credentials, Sentry auth tokens, and signing credentials remain server/build-secret only.

NestJS is the authoritative application-data boundary. Mobile uses Supabase directly only for Auth and private Realtime subscriptions. Supabase Data API access to application tables is denied; a least-privilege `thriftage_runtime` database role receives table access through explicit server-only RLS policies. Prisma migration credentials are separate and never used by the API runtime.

PostgreSQL is authoritative for transactions and messages. Realtime and push are advisory: failures must not roll back committed business state, and clients refetch durable state after reconnect. Twilio, OpenAI, push, and Sentry are degradable providers. COD remains the only commerce method.

Production promotion is manual after staging validation. No configuration in this repository deploys, migrates, submits, or publicly releases production automatically.
