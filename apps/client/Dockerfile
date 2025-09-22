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
RUN apk add --no-cache --update nasm yasm build-base
RUN corepack enable && corepack prepare pnpm@9.12.2 --activate
WORKDIR /app
COPY --from=pruner /repo/out/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=pruner /repo/out/json/ ./
# Create lightweight stubs for optional packages that might be referenced during client build
RUN mkdir -p stubs/logging stubs/performance stubs/monitoring \
 && printf '{\n  "name": "@vtt/logging",\n  "version": "0.0.0",\n  "main": "index.js",\n  "types": "index.d.ts"\n}\n' > stubs/logging/package.json \
 && printf 'export const logger = { trace: () => {}, debug: () => {}, info: () => {}, warn: () => {}, error: () => {}, fatal: () => {}, child: () => logger, withContext: () => logger }; export const StructuredLogger = function() { return logger; }; export const createLogger = () => logger;' > stubs/logging/index.js \
 && printf 'export declare const logger: any; export declare class StructuredLogger { [key: string]: any; } export declare function createLogger(): any;' > stubs/logging/index.d.ts \
 && printf '{\n  "name": "@vtt/performance",\n  "version": "0.0.0",\n  "main": "index.js",\n  "types": "index.d.ts"\n}\n' > stubs/performance/package.json \
 && printf 'export {};' > stubs/performance/index.js \
 && printf 'export {};' > stubs/performance/index.d.ts \
 && printf '{\n  "name": "@vtt/monitoring",\n  "version": "0.0.0",\n  "main": "index.js",\n  "types": "index.d.ts"\n}\n' > stubs/monitoring/package.json \
 && printf 'export {};' > stubs/monitoring/index.js \
 && printf 'export {};' > stubs/monitoring/index.d.ts
# Override any optional dependencies with stubs
RUN node -e "const fs=require('fs'); const p='package.json'; const j=JSON.parse(fs.readFileSync(p,'utf8')); j.pnpm=j.pnpm||{}; j.pnpm.overrides=j.pnpm.overrides||{}; j.pnpm.overrides['@vtt/performance']='file:./stubs/performance'; j.pnpm.overrides['@vtt/monitoring']='file:./stubs/monitoring'; j.pnpm.overrides['@vtt/logging']='file:./stubs/logging'; fs.writeFileSync(p, JSON.stringify(j,null,2));"
RUN pnpm install --no-frozen-lockfile
COPY --from=pruner /repo/out/full/ ./
## Ensure base tsconfig is present for packages that extend it
COPY --from=pruner /repo/tsconfig.base.json ./tsconfig.base.json
## Ensure required package tsconfig files exist for TypeScript compilation
RUN set -e; \
    for pkg in core-schemas i18n; do \
        if [ -f "/repo/packages/$pkg/tsconfig.json" ]; then \
            mkdir -p "./packages/$pkg" && cp "/repo/packages/$pkg/tsconfig.json" "./packages/$pkg/tsconfig.json"; \
        fi; \
    done
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
