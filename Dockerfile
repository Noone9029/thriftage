FROM node:24-bookworm-slim AS build

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

WORKDIR /workspace

RUN corepack enable

COPY . .

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile \
    && pnpm db:generate \
    && pnpm --filter @thriftage/api... build \
    && pnpm --filter @thriftage/api deploy --prod --legacy /deploy

FROM node:24-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV API_HOST=0.0.0.0
ENV NODE_EXTRA_CA_CERTS=/app/certificates/supabase-root-2021-ca.crt

WORKDIR /app

COPY --chown=node:node tooling/certificates/supabase-root-2021-ca.crt /app/certificates/supabase-root-2021-ca.crt
COPY --chown=node:node --from=build /deploy ./

RUN echo "700723581420dd1ac98fd7e9ac529f0ef210eadcaf87fc868a3ad7d114c2f3b7  /app/certificates/supabase-root-2021-ca.crt" | sha256sum --check --strict

USER node

CMD ["node", "dist/main.js"]
