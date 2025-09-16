# syntax=docker/dockerfile:1.6

# 1) Prune to minimal workspace for @vtt/client
FROM node:22-alpine@sha256:6e80991f69cc7722c561e5d14d5e72ab47c0d6b6cfb3ae50fb9cf9a7b30fdf97 AS pruner
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable && corepack prepare pnpm@9.12.2 --activate
WORKDIR /repo
COPY . .
RUN pnpm dlx turbo prune --scope=@vtt/client --docker

# 2) Install deps and build client
FROM node:22-alpine@sha256:6e80991f69cc7722c561e5d14d5e72ab47c0d6b6cfb3ae50fb9cf9a7b30fdf97 AS builder
ENV NODE_ENV=development
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable && corepack prepare pnpm@9.12.2 --activate
WORKDIR /app
COPY --from=pruner /repo/out/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=pruner /repo/out/json/ ./
RUN pnpm install --no-frozen-lockfile
COPY --from=pruner /repo/out/full/ ./
## Ensure base tsconfig is present for packages that extend it
COPY --from=pruner /repo/tsconfig.base.json ./tsconfig.base.json
## Ensure i18n package tsconfig exists (Vite resolves it during build)
COPY --from=pruner /repo/packages/i18n/tsconfig.json ./packages/i18n/tsconfig.json
RUN pnpm dlx turbo run build --filter=@vtt/client...

# 3) Runtime image using nginx
FROM nginx:1.27-alpine@sha256:a5127daff3d6f4606be3100a252419bfa84fd6ee5cd74d0feaca1a5068f97dcf AS runner
WORKDIR /usr/share/nginx/html
# Security hardening
RUN apk add --no-cache --update && \
    rm -rf /var/cache/apk/* /tmp/* /var/tmp/* && \
    chown -R nginx:nginx /var/cache/nginx /var/run /var/log/nginx && \
    chmod -R 755 /var/cache/nginx /var/run && \
    touch /var/run/nginx.pid && \
    chown nginx:nginx /var/run/nginx.pid
# Copy static assets
COPY --from=builder --chown=nginx:nginx /app/apps/client/dist ./
# nginx config for SPA
COPY --chown=nginx:nginx apps/client/nginx.conf /etc/nginx/conf.d/default.conf
USER 101:101
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/ || exit 1
CMD ["nginx", "-g", "daemon off;"]
