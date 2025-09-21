#!/bin/bash

echo "🔄 Reloading Windsurf Configuration..."

# Kill language servers
echo "Stopping language servers..."
pkill -f "yaml.*language.*server" 2>/dev/null || true
pkill -f "github.*actions" 2>/dev/null || true

# Clear extension cache
echo "Clearing extension cache..."
rm -rf ~/.config/Windsurf/CachedExtensionVSIXs/* 2>/dev/null || true

# Clear logs
echo "Clearing logs..."
rm -rf ~/.config/Windsurf/logs/* 2>/dev/null || true

echo "✅ Cache cleared. Now restart Windsurf to reload configurations."
echo ""
echo "In Windsurf, use Command Palette (Ctrl+Shift+P) and run:"
echo "  1. Developer: Reload Window"
echo "  2. YAML: Reload Schema Cache"
echo "  3. Extensions: Reload Window"
echo ""
echo "Or close Windsurf completely and reopen it."
