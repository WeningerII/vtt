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
# Remove optional packages not required by @vtt/server runtime (may be pulled in by prune)
RUN rm -rf packages/performance || true
# Provide lightweight stubs in a dedicated directory
RUN mkdir -p stubs/logging stubs/performance stubs/monitoring \
 && printf '{\n  "name": "@vtt/logging",\n  "version": "0.0.0",\n  "main": "index.js",\n  "types": "index.d.ts"\n}\n' > stubs/logging/package.json \
 && printf 'const logger = {\n  trace: (msg, obj) => console.debug(msg, obj),\n  debug: (msg, obj) => console.debug(msg, obj),\n  info: (msg, obj) => console.log(msg, obj),\n  warn: (msg, obj) => console.warn(msg, obj),\n  error: (msg, obj) => console.error(msg, obj),\n  fatal: (msg, obj) => console.error(msg, obj),\n  child: () => logger,\n  withContext: () => logger,\n  logPerformance: () => {},\n  logError: () => {},\n  logAudit: () => {},\n  logSecurity: () => {},\n  logRequest: () => {},\n  logMetric: () => {}\n};\nmodule.exports = { logger, StructuredLogger: function() { return logger; }, createLogger: () => logger, initTelemetry: () => {}, withTrace: async (name, fn) => fn() };' > stubs/logging/index.js \
 && printf 'export interface LoggerConfig {\n  level?: string;\n  pretty?: boolean;\n  service?: string;\n  version?: string;\n  environment?: string;\n  otlpEndpoint?: string;\n}\nexport declare class StructuredLogger {\n  trace(msg: string, obj?: Record<string, any>): void;\n  debug(msg: string, obj?: Record<string, any>): void;\n  info(msg: string, obj?: Record<string, any>): void;\n  warn(msg: string, obj?: Record<string, any>): void;\n  error(msg: string, obj?: any): void;\n  fatal(msg: string, obj?: Record<string, any>): void;\n  child(context: Record<string, any>): StructuredLogger;\n  withContext(context: Record<string, any>): StructuredLogger;\n  logPerformance(operation: string, duration: number, metadata?: Record<string, any>): void;\n  logError(error: Error, context?: Record<string, any>): void;\n  logAudit(action: string, userId: string, metadata?: Record<string, any>): void;\n  logSecurity(event: string, severity: "low" | "medium" | "high" | "critical", details?: Record<string, any>): void;\n  logRequest(method: string, path: string, statusCode: number, duration: number, metadata?: Record<string, any>): void;\n  logMetric(name: string, value: number, unit: string, tags?: Record<string, any>): void;\n}\nexport declare const logger: StructuredLogger;\nexport declare function createLogger(config?: LoggerConfig): any;\nexport declare function initTelemetry(config?: LoggerConfig): any;\nexport declare function withTrace<T>(name: string, fn: () => Promise<T>, attributes?: Record<string, any>): Promise<T>;\nexport declare function requestLoggingMiddleware(logger: StructuredLogger): any;' > stubs/logging/index.d.ts \
 && printf '{\n  "name": "@vtt/performance",\n  "version": "0.0.0",\n  "main": "index.js",\n  "types": "index.d.ts"\n}\n' > stubs/performance/package.json \
 && printf 'module.exports = {};' > stubs/performance/index.js \
 && printf 'export {};' > stubs/performance/index.d.ts \
 && printf '{\n  "name": "@vtt/monitoring",\n  "version": "0.0.0",\n  "main": "index.js",\n  "types": "index.d.ts"\n}\n' > stubs/monitoring/package.json \
 && printf 'module.exports = {};' > stubs/monitoring/index.js \
 && printf 'export {};' > stubs/monitoring/index.d.ts
# Force pnpm to resolve optional workspace packages to local stubs
RUN node -e "const fs=require('fs'); const p='package.json'; const j=JSON.parse(fs.readFileSync(p,'utf8')); j.pnpm=j.pnpm||{}; j.pnpm.overrides=j.pnpm.overrides||{}; j.pnpm.overrides['@vtt/performance']='file:./stubs/performance'; j.pnpm.overrides['@vtt/monitoring']='file:./stubs/monitoring'; j.pnpm.overrides['@vtt/logging']='file:./stubs/logging'; fs.writeFileSync(p, JSON.stringify(j,null,2));"
# Ensure @vtt/ai does not declare @vtt/performance as a dependency in the pruned manifests
RUN node -e "const fs=require('fs'); const p='packages/ai/package.json'; if (fs.existsSync(p)) { const j=JSON.parse(fs.readFileSync(p,'utf8')); if (j.dependencies && j.dependencies['@vtt/performance']) { delete j.dependencies['@vtt/performance']; } j.peerDependencies=j.peerDependencies||{}; j.peerDependencies['@vtt/performance']='*'; j.peerDependenciesMeta=j.peerDependenciesMeta||{}; j.peerDependenciesMeta['@vtt/performance']={optional:true}; fs.writeFileSync(p, JSON.stringify(j,null,2)); }"
# Install deps for pruned workspace
RUN pnpm install --no-frozen-lockfile
# Copy pruned sources
COPY --from=pruner /repo/out/full/ ./
# Ensure base tsconfig exists for project references (copy from original repo, not pruned)
COPY --from=pruner /repo/tsconfig.base.json ./tsconfig.base.json
# Create package directories and ensure tsconfig files exist for all referenced packages
# These are needed for TypeScript compilation even when using stubs
RUN mkdir -p packages/logging packages/monitoring packages/core-ecs packages/ai packages/performance packages/ui packages/i18n packages/core packages/core-schemas packages/net
# Copy or create tsconfig files for all packages that might be referenced during compilation
RUN set -e; \
    # Function to create a standard tsconfig.json template \
    create_tsconfig() { \
        local pkg_name="$1"; \
        local has_refs="$2"; \
        printf '{\n  "extends": "../../tsconfig.base.json",\n  "compilerOptions": {\n    "outDir": "dist",\n    "rootDir": "src",\n    "composite": true,\n    "incremental": true,\n    "tsBuildInfoFile": "./%s.tsbuildinfo",\n    "types": ["node"]\n  },\n  "include": ["src/**/*"],\n  "exclude": ["dist", "node_modules"]%s\n}' "$pkg_name" "$has_refs"; \
    }; \
    # Always copy tsconfig files from the original repo (before pruning) \
    # This ensures all package tsconfig files exist even if they were excluded by turbo prune \
    for pkg in logging monitoring core-ecs ai performance ui i18n core core-schemas net; do \
        echo "Processing package: $pkg"; \
        mkdir -p "./packages/$pkg"; \
        if [ -f "/repo/packages/$pkg/tsconfig.json" ]; then \
            echo "Copying existing tsconfig for $pkg"; \
            cp "/repo/packages/$pkg/tsconfig.json" "./packages/$pkg/tsconfig.json"; \
        else \
            echo "Creating tsconfig for $pkg"; \
            case "$pkg" in \
                monitoring) create_tsconfig "$pkg" ',\n  "references": [{ "path": "../logging" }]' > "./packages/$pkg/tsconfig.json" ;; \
                ai) create_tsconfig "$pkg" ',\n  "references": [{ "path": "../logging" }, { "path": "../core-ecs" }]' > "./packages/$pkg/tsconfig.json" ;; \
                ui) printf '{\n  "extends": "../../tsconfig.base.json",\n  "compilerOptions": {\n    "outDir": "dist",\n    "rootDir": "src",\n    "jsx": "react-jsx",\n    "composite": true,\n    "incremental": true,\n    "tsBuildInfoFile": "./ui.tsbuildinfo",\n    "types": []\n  },\n  "include": ["src/**/*"],\n  "exclude": ["dist", "node_modules"]\n}' > "./packages/$pkg/tsconfig.json" ;; \
                i18n) printf '{\n  "extends": "../../tsconfig.base.json",\n  "compilerOptions": {\n    "outDir": "dist",\n    "rootDir": "src",\n    "jsx": "react-jsx",\n    "composite": true,\n    "incremental": true,\n    "tsBuildInfoFile": "./i18n.tsbuildinfo"\n  },\n  "include": ["src/**/*"],\n  "exclude": ["dist", "node_modules"]\n}' > "./packages/$pkg/tsconfig.json" ;; \
                *) create_tsconfig "$pkg" "" > "./packages/$pkg/tsconfig.json" ;; \
            esac; \
        fi; \
        echo "Tsconfig created/copied for $pkg"; \
    done
# Generate Prisma client for server schema using workspace Prisma CLI
RUN pnpm --filter @vtt/server exec prisma generate --schema prisma/schema.prisma
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
