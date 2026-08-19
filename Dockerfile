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

WORKDIR /app

COPY --chown=node:node --from=build /deploy ./

USER node

CMD ["node", "dist/main.js"]
