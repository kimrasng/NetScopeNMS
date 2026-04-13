FROM node:20-alpine AS base
RUN apk add --no-cache dumb-init

FROM base AS deps
WORKDIR /app
COPY package.json yarn.lock ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
COPY packages/ai-engine/package.json packages/ai-engine/
COPY packages/notification/package.json packages/notification/
COPY packages/polling-engine/package.json packages/polling-engine/
RUN yarn install --frozen-lockfile || yarn install

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN cd apps/web && npx next build

FROM base AS runner
WORKDIR /app
RUN addgroup --gid 1001 appgroup && \
    adduser --uid 1001 --ingroup appgroup --disabled-password appuser
COPY --from=deps --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --chown=appuser:appgroup . .

# API target
FROM runner AS api
USER appuser
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:4000/api/health || exit 1
EXPOSE 4000
ENTRYPOINT ["dumb-init", "--"]
CMD ["sh", "scripts/start-api.sh"]

# Web target (production)
FROM runner AS web
COPY --from=builder --chown=appuser:appgroup /app/apps/web/.next ./apps/web/.next
ENV NEXT_TELEMETRY_DISABLED=1
USER appuser
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/ || exit 1
WORKDIR /app/apps/web
EXPOSE 3000
ENTRYPOINT ["dumb-init", "--"]
CMD ["npx", "next", "start", "--port", "3000"]
