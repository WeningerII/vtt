# syntax=docker/dockerfile:1.6

# 1) Prune to minimal workspace for @vtt/server
FROM node:22-alpine@sha256:6e80991f69cc7722c561e5d14d5e72ab47c0d6b6cfb3ae50fb9cf9a7b30fdf97 AS pruner
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable && corepack prepare pnpm@10.17.1 --activate
WORKDIR /repo
# Copy monorepo (turbo prune will create a minimized workspace in /repo/out)
COPY . .
# Create a pruned workspace for the server
# Note: turbo version (2.5.6) is specified in package.json devDependencies
RUN pnpm dlx turbo@2.5.6 prune --scope=@vtt/server --docker

# 2) Install and build in pruned workspace
FROM node:22-alpine@sha256:6e80991f69cc7722c561e5d14d5e72ab47c0d6b6cfb3ae50fb9cf9a7b30fdf97 AS builder
ENV NODE_ENV=development
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
ENV PRISMA_HIDE_PREVIEW_FLAG_WARNINGS=1
ENV PRISMA_HIDE_UPDATE_MESSAGE=1
RUN apk add --no-cache --update libc6-compat nasm yasm build-base
RUN corepack enable && corepack prepare pnpm@10.17.1 --activate
WORKDIR /app
# Copy pruned package manifests and lockfile
COPY --from=pruner /repo/out/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=pruner /repo/out/json/ ./
COPY --from=pruner /repo/apps/server/prisma ./apps/server/prisma
# Install deps for pruned workspace
# Note: bcrypt@6.0.0 (latest) shows punycode deprecation warnings from transitive dependencies.
# This is a Node.js core module deprecation (DEP0040) in bcrypt's native build chain.
# No action needed - bcrypt maintainers will update when ecosystem stabilizes.
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
    # Always copy tsconfig files from the original repo (before pruning) \
    # This ensures all package tsconfig files exist even if they were excluded by turbo prune \
    for pkg in logging monitoring core-ecs ai performance ui i18n core core-schemas net; do \
        echo "Processing package: $pkg"; \
        mkdir -p "./packages/$pkg"; \
        if [ -f "/repo/packages/$pkg/tsconfig.json" ]; then \
            echo "Copying existing tsconfig for $pkg and modifying to exclude tests"; \
            # Copy and modify the tsconfig to exclude test files using Node.js \
            node -e " \
                const fs = require('fs'); \
                try { \
                    const content = fs.readFileSync('/repo/packages/$pkg/tsconfig.json', 'utf8'); \
                    const config = JSON.parse(content); \
                    config.exclude = config.exclude || []; \
                    const testExcludes = ['**/*.test.ts', '**/*.spec.ts', '**/__tests__/**', '**/__mocks__/**', 'src/**/__tests__/**']; \
                    testExcludes.forEach(pattern => { \
                        if (!config.exclude.includes(pattern)) config.exclude.push(pattern); \
                    }); \
                    const output = JSON.stringify(config, null, 2); \
                    fs.writeFileSync('./packages/$pkg/tsconfig.json', output, { encoding: 'utf8', flag: 'w' }); \
                    console.log('Modified and validated tsconfig for', '$pkg'); \
                } catch (error) { \
                    console.error('Error processing tsconfig for $pkg:', error.message); \
                    // Fall back to copying original file \
                    fs.copyFileSync('/repo/packages/$pkg/tsconfig.json', './packages/$pkg/tsconfig.json'); \
                    console.log('Copied original tsconfig for', '$pkg'); \
                } \
            "; \
        else \
            echo "Creating default tsconfig for $pkg (file not found in pruned workspace)"; \
            node -e " \
                const fs = require('fs'); \
                const pkg = '$pkg'; \
                let config = { \
                    extends: '../../tsconfig.base.json', \
                    compilerOptions: { \
                        outDir: 'dist', \
                        rootDir: 'src', \
                        composite: true, \
                        incremental: true, \
                        tsBuildInfoFile: './' + pkg + '.tsbuildinfo', \
                        types: ['node'] \
                    }, \
                    include: ['src/**/*'], \
                    exclude: ['dist', 'node_modules', '**/*.test.ts', '**/*.spec.ts', '**/__tests__/**', '**/__mocks__/**'] \
                }; \
                if (pkg === 'monitoring') { \
                    config.references = [{ path: '../logging' }]; \
                } else if (pkg === 'ai') { \
                    config.references = [{ path: '../logging' }, { path: '../core-ecs' }, { path: '../performance' }]; \
                } else if (pkg === 'ui' || pkg === 'i18n') { \
                    config.compilerOptions.jsx = 'react-jsx'; \
                    if (pkg === 'ui') config.compilerOptions.types = []; \
                } \
                fs.writeFileSync('./packages/' + pkg + '/tsconfig.json', JSON.stringify(config, null, 2), 'utf8'); \
                console.log('Created tsconfig for', pkg); \
            "; \
        fi; \
        echo "Tsconfig created/copied for $pkg"; \
    done
# Install @types/jest globally to ensure it's available during package compilation if needed
RUN pnpm add -D @types/jest@^29.5.14 || true
# Debug: Validate all tsconfig.json files before build
RUN echo "=== Validating tsconfig files before build ===" && \
    for file in $(find . -name "tsconfig.json" -not -path "./node_modules/*"); do \
        echo "Checking: $file"; \
        node -e "try { JSON.parse(require('fs').readFileSync('$file', 'utf8')); console.log('  ✓ Valid JSON'); } catch(e) { console.log('  ✗ Invalid JSON:', e.message); process.exit(1); }"; \
        # Check for problematic characters \
        node -e "const fs=require('fs'); const content=fs.readFileSync('$file','utf8'); const lines=content.split(/\\r?\\n/); lines.forEach((line,i)=>{if(line.length>108){console.log('  Line '+(i+1)+' length '+line.length+':', JSON.stringify(line.slice(100))); if(line.length>108&&line.charCodeAt(108)>127){console.log('    ✗ Non-ASCII at pos 109'); process.exit(1);}}}); console.log('  ✓ No long lines with issues');"; \
    done

# Build workspace packages that provide type declarations consumed by the server
RUN pnpm --filter @vtt/logging run build \
 && pnpm --filter @vtt/core run build \
 && pnpm --filter @vtt/core-ecs run build \
 && pnpm --filter @vtt/core-schemas run build \
 && pnpm --filter @vtt/performance run build \
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
ENV PRISMA_HIDE_PREVIEW_FLAG_WARNINGS=1
ENV PRISMA_HIDE_UPDATE_MESSAGE=1
WORKDIR /srv
RUN apk add --no-cache --update libc6-compat \
 && npm i -g npm@11.6.1 \
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
