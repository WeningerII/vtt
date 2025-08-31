# Memory Optimization Guide

This guide provides options for running the VTT development environment on systems with limited RAM.

## Quick Start

For immediate memory relief, use these commands instead of the standard ones:

```bash
# Low-memory testing
pnpm test:low-memory          # Single-worker Jest
pnpm test:e2e:low-memory      # Chromium-only Playwright

# Sequential building
pnpm build:sequential         # Build packages one at a time

# Lightweight development server
pnpm dev:light               # Server with reduced memory limit
```

## Configuration Files

### `jest.config.low-memory.js`
- Single worker execution
- Disabled caching
- Minimal reporters
- Essential tests only

### `playwright.config.low-memory.ts`
- Single worker
- Chromium browser only
- Reduced timeouts
- Minimal tracing
- Chrome launched with memory optimization flags

### `.env.local.example`
- Copy to `.env.local` and uncomment needed options
- Contains memory optimization environment variables
- Feature flags to disable resource-intensive features

## Memory Optimization Strategies

### 1. Test Execution
```bash
# Instead of: pnpm test
pnpm test:low-memory

# Instead of: pnpm test:e2e  
pnpm test:e2e:low-memory
```

### 2. Build Process
```bash
# Instead of: pnpm build
pnpm build:sequential
```

### 3. Development Server
```bash
# Instead of: pnpm dev:server
pnpm dev:light
```

### 4. Environment Variables
Create `.env.local` with:
```bash
NODE_OPTIONS="--max-old-space-size=2048"
JEST_MAX_WORKERS=1
TURBO_WORKERS=1
E2E_SKIP_BROWSERS="firefox,webkit,Mobile Chrome,Mobile Safari,Tablet"
```

## Trade-offs

**Benefits:**
- Stable development environment
- No out-of-memory crashes
- Consistent build completion
- Better resource utilization

**Costs:**
- Slower test execution
- Longer build times
- Reduced cross-browser testing coverage
- Less parallel processing

## Hybrid Approach

Use standard configs for CI/production and low-memory configs for local development:

```json
{
  "scripts": {
    "test": "turbo run test",
    "test:low-memory": "jest --config jest.config.low-memory.js",
    "test:e2e": "playwright test", 
    "test:e2e:low-memory": "playwright test --config playwright.config.low-memory.ts"
  }
}
```

## Monitoring Memory Usage

Monitor your system during development:
```bash
# Linux/macOS
htop

# Windows
taskmgr

# Node.js specific
node --trace-gc your-script.js
```

## When to Use

**Use low-memory configs when:**
- System has limited RAM (< 8GB available)
- Experiencing frequent out-of-memory crashes
- Running multiple development environments
- Working on battery power (reduced CPU/memory usage saves battery)

**Use standard configs when:**
- System has ample resources
- Running in CI/CD environments
- Need comprehensive cross-browser testing
- Optimizing for development speed over stability
