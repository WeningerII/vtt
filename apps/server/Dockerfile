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
RUN apk add --no-cache --update libc6-compat nasm yasm build-base
RUN corepack enable && corepack prepare pnpm@9.12.2 --activate
WORKDIR /app
# Copy pruned package manifests and lockfile
COPY --from=pruner /repo/out/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=pruner /repo/out/json/ ./
COPY --from=pruner /repo/apps/server/prisma ./apps/server/prisma
# Install deps for pruned workspace
RUN pnpm install --no-frozen-lockfile
# Copy pruned sources
COPY --from=pruner /repo/out/full/ ./
COPY --from=pruner /repo/apps/server/prisma ./apps/server/prisma
# Ensure base tsconfig exists for project references (copy from original repo, not pruned)
COPY --from=pruner /repo/tsconfig.base.json ./tsconfig.base.json
# Generate Prisma client EARLY to ensure types are available during TypeScript compilation
RUN cd apps/server && pnpm exec prisma generate --schema prisma/schema.prisma
# Create package directories and ensure tsconfig files exist for all referenced packages
# These are needed for TypeScript compilation even when using stubs
RUN mkdir -p packages/logging packages/monitoring packages/core-ecs packages/ai packages/performance packages/ui packages/i18n packages/core packages/core-schemas packages/net
# Copy or create tsconfig files for all packages that might be referenced during compilation
RUN set -e; \
    # Function to create a standard tsconfig.json template \
    create_tsconfig() { \
        local pkg_name="$1"; \
        local has_refs="$2"; \
        printf '{\n  "extends": "../../tsconfig.base.json",\n  "compilerOptions": {\n    "outDir": "dist",\n    "rootDir": "src",\n    "composite": true,\n    "incremental": true,\n    "tsBuildInfoFile": "./%s.tsbuildinfo",\n    "types": ["node"]\n  },\n  "include": ["src/**/*"],\n  "exclude": ["dist", "node_modules", "**/*.test.ts", "**/*.spec.ts", "**/__tests__/**", "**/__mocks__/**"]%s\n}' "$pkg_name" "$has_refs"; \
    }; \
    # Always copy tsconfig files from the original repo (before pruning) \
    # This ensures all package tsconfig files exist even if they were excluded by turbo prune \
    for pkg in logging monitoring core-ecs ai performance ui i18n core core-schemas net; do \
        echo "Processing package: $pkg"; \
        mkdir -p "./packages/$pkg"; \
        if [ -f "/repo/packages/$pkg/tsconfig.json" ]; then \
            echo "Copying existing tsconfig for $pkg and modifying to exclude tests"; \
            # Copy and modify the tsconfig to exclude test files \
            node -e " \
                const fs = require('fs'); \
                const config = JSON.parse(fs.readFileSync('/repo/packages/$pkg/tsconfig.json', 'utf8')); \
                config.exclude = config.exclude || []; \
                const testExcludes = ['**/*.test.ts', '**/*.spec.ts', '**/__tests__/**', '**/__mocks__/**', 'src/**/__tests__/**']; \
                testExcludes.forEach(pattern => { \
                    if (!config.exclude.includes(pattern)) config.exclude.push(pattern); \
                }); \
                fs.writeFileSync('./packages/$pkg/tsconfig.json', JSON.stringify(config, null, 2)); \
            "; \
        else \
            echo "Creating tsconfig for $pkg"; \
            case "$pkg" in \
                monitoring) create_tsconfig "$pkg" ',\n  "references": [{ "path": "../logging" }]' > "./packages/$pkg/tsconfig.json" ;; \
                ai) create_tsconfig "$pkg" ',\n  "references": [{ "path": "../logging" }, { "path": "../core-ecs" }]' > "./packages/$pkg/tsconfig.json" ;; \
                ui) printf '{\n  "extends": "../../tsconfig.base.json",\n  "compilerOptions": {\n    "outDir": "dist",\n    "rootDir": "src",\n    "jsx": "react-jsx",\n    "composite": true,\n    "incremental": true,\n    "tsBuildInfoFile": "./ui.tsbuildinfo",\n    "types": []\n  },\n  "include": ["src/**/*"],\n  "exclude": ["dist", "node_modules", "**/*.test.ts", "**/*.spec.ts", "**/__tests__/**", "**/__mocks__/**"]\n}' > "./packages/$pkg/tsconfig.json" ;; \
                i18n) printf '{\n  "extends": "../../tsconfig.base.json",\n  "compilerOptions": {\n    "outDir": "dist",\n    "rootDir": "src",\n    "jsx": "react-jsx",\n    "composite": true,\n    "incremental": true,\n    "tsBuildInfoFile": "./i18n.tsbuildinfo"\n  },\n  "include": ["src/**/*"],\n  "exclude": ["dist", "node_modules", "**/*.test.ts", "**/*.spec.ts", "**/__tests__/**", "**/__mocks__/**"]\n}' > "./packages/$pkg/tsconfig.json" ;; \
                *) create_tsconfig "$pkg" "" > "./packages/$pkg/tsconfig.json" ;; \
            esac; \
        fi; \
        echo "Tsconfig created/copied for $pkg"; \
    done
# Install @types/jest globally to ensure it's available during package compilation if needed
RUN pnpm add -D @types/jest@^29.5.14 --no-frozen-lockfile || true
# Build workspace packages that provide type declarations consumed by the server
RUN pnpm --filter @vtt/logging run build \
 && pnpm --filter @vtt/core run build \
 && pnpm --filter @vtt/core-ecs run build \
 && pnpm --filter @vtt/core-schemas run build \
 && pnpm --filter @vtt/user-management run build \
 && pnpm --filter @vtt/auth run build \
 && pnpm --filter @vtt/combat run build \
 && pnpm --filter @vtt/conditions-engine run build \
 && pnpm --filter @vtt/dice-engine run build \
 && pnpm --filter @vtt/physics run build \
 && pnpm --filter @vtt/spell-engine run build \
 && pnpm --filter @vtt/content-5e-srd run build \
 && pnpm --filter @vtt/ai run build
# Verify Prisma client was generated correctly and debug if needed
RUN echo "Checking Prisma client generation..." && \
    ls -la node_modules/.prisma/client/ && \
    echo "Prisma client files:" && \
    find node_modules/.prisma/client -name "*.d.ts" | head -5
# Build only the server package (emit even if type errors per tsconfig)
RUN pnpm --filter @vtt/server run build
# Prune dev deps
RUN pnpm prune --prod

# 3) Runtime image
FROM node:22-alpine@sha256:6e80991f69cc7722c561e5d14d5e72ab47c0d6b6cfb3ae50fb9cf9a7b30fdf97 AS runner
ENV NODE_ENV=production
WORKDIR /srv
RUN apk add --no-cache --update libc6-compat \
 && npm i -g prisma@6.15.0 \
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
# Ensure Prisma client is generated in the runtime environment (guards against pnpm hoisting nuances)
RUN cd /srv && NODE_ENV=production prisma generate --schema apps/server/prisma/schema.prisma
# Security hardening
RUN chmod -R 755 /srv && \
    find /srv -type f -exec chmod 644 {} \;
USER 1001:1001
EXPOSE 8080
ENV PORT=8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/livez', (res) => process.exit(res.statusCode === 200 ? 0 : 1))"
CMD ["node", "--max-old-space-size=256", "--enable-source-maps", "apps/server/dist/index.js"]
