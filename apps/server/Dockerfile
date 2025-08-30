# syntax=docker/dockerfile:1.6

# 1) Prune to minimal workspace for @vtt/server
FROM node:22-alpine@sha256:6e80991f69cc7722c561e5d14d5e72ab47c0d6b6cfb3ae50fb9cf9a7b30fdf97 AS pruner
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable && corepack prepare pnpm@9.12.2 --activate
WORKDIR /repo
# Copy monorepo (turbo prune will create a minimized workspace in /repo/out)
COPY . .
# Create a pruned workspace for the server
RUN pnpm dlx turbo prune --scope=@vtt/server --docker

# 2) Install and build in pruned workspace
FROM node:22-alpine@sha256:6e80991f69cc7722c561e5d14d5e72ab47c0d6b6cfb3ae50fb9cf9a7b30fdf97 AS builder
ENV NODE_ENV=development
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN apk add --no-cache --update libc6-compat
RUN corepack enable && corepack prepare pnpm@9.12.2 --activate
WORKDIR /app
# Copy pruned package manifests and lockfile
COPY --from=pruner /repo/out/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=pruner /repo/out/json/ ./
# Install deps
RUN pnpm install --frozen-lockfile
# Copy pruned sources
COPY --from=pruner /repo/out/full/ ./
# Generate Prisma client for server schema
RUN pnpm dlx prisma generate --schema apps/server/prisma/schema.prisma
# Build only what is needed for the server and its deps
RUN pnpm dlx turbo run build --filter=@vtt/server...
# Prune dev deps
RUN pnpm prune --prod

# 3) Runtime image
FROM node:22-alpine@sha256:6e80991f69cc7722c561e5d14d5e72ab47c0d6b6cfb3ae50fb9cf9a7b30fdf97 AS runner
ENV NODE_ENV=production
WORKDIR /srv
RUN apk add --no-cache --update libc6-compat \
 && npm i -g prisma@6.14.0 \
 && apk del --purge \
 && rm -rf /var/cache/apk/* /tmp/* /var/tmp/* \
 && addgroup -g 1001 -S nodegrp \
 && adduser -S nodeusr -u 1001 -G nodegrp -s /bin/false -D -H
# Copy production node_modules and built artifacts
COPY --from=builder --chown=1001:1001 /app/node_modules ./node_modules
COPY --from=builder --chown=1001:1001 /app/apps/server/dist ./apps/server/dist
# Copy Prisma schema and migrations for runtime tooling (e.g., migration job)
COPY --from=builder --chown=1001:1001 /app/apps/server/prisma ./apps/server/prisma
# If server imports workspace packages at runtime, copy their built output
COPY --from=builder --chown=1001:1001 /app/packages ./packages
# Security hardening
RUN chmod -R 755 /srv && \
    find /srv -type f -exec chmod 644 {} \;
USER 1001:1001
EXPOSE 8080
ENV PORT=8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/livez', (res) => process.exit(res.statusCode === 200 ? 0 : 1))"
CMD ["node", "--max-old-space-size=256", "--enable-source-maps", "apps/server/dist/index.js"]
