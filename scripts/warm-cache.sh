#!/bin/bash

# Warm build cache for frequently changed packages
echo "🔥 Warming build cache..."

# Build core packages in parallel
pnpm turbo run build --filter=@vtt/core* --filter=@vtt/rules* --filter=@vtt/net --filter=@vtt/performance --concurrency=4

# Pre-compile test files
pnpm turbo run typecheck --filter=@vtt/* --concurrency=4

echo "✅ Cache warmed successfully"
