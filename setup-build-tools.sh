#!/bin/bash

# VTT Project Build Tools Setup
# This script sets up all the necessary libraries and build tools
# to resolve the missing imports identified in the audit

echo "🚀 Setting up VTT build infrastructure..."

# Color codes for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. Install shadcn/ui dependencies for UI components and utilities
echo -e "${YELLOW}📦 Installing shadcn/ui dependencies...${NC}"
pnpm add class-variance-authority tw-animate-css

# 2. Install comprehensive React hooks libraries
echo -e "${YELLOW}🪝 Installing React hooks libraries...${NC}"
pnpm add usehooks-ts ahooks react-use @uidotdev/usehooks

# 3. Install utility libraries
echo -e "${YELLOW}🛠️ Installing utility libraries...${NC}"
pnpm add date-fns numeral classnames query-string
pnpm add -D @types/lodash

# 4. Install form and validation libraries
echo -e "${YELLOW}📝 Installing form libraries...${NC}"
pnpm add react-hook-form @hookform/resolvers yup zod

# 5. Install state management utilities
echo -e "${YELLOW}🗄️ Installing state management...${NC}"
pnpm add zustand jotai valtio immer

# 6. Install data fetching libraries
echo -e "${YELLOW}🔄 Installing data fetching libraries...${NC}"
pnpm add @tanstack/react-query swr

# 7. Install animation libraries
echo -e "${YELLOW}✨ Installing animation libraries...${NC}"
pnpm add framer-motion react-spring @react-spring/web

# 8. Install development type definitions
echo -e "${YELLOW}📋 Installing type definitions...${NC}"
pnpm add -D @types/react @types/react-dom @types/node
pnpm add -D @webgpu/types @types/three

# 9. Install UI component libraries
echo -e "${YELLOW}🎨 Installing UI libraries...${NC}"
pnpm add @radix-ui/react-alert-dialog @radix-ui/react-dialog @radix-ui/react-dropdown-menu
pnpm add @radix-ui/react-label @radix-ui/react-popover @radix-ui/react-select
pnpm add @radix-ui/react-separator @radix-ui/react-slider @radix-ui/react-switch
pnpm add @radix-ui/react-tabs @radix-ui/react-toast @radix-ui/react-tooltip
pnpm add @radix-ui/react-scroll-area @radix-ui/react-checkbox @radix-ui/react-radio-group

# 10. Install chart/visualization libraries
echo -e "${YELLOW}📊 Installing visualization libraries...${NC}"
pnpm add recharts react-chartjs-2 chart.js d3

# 11. Install WebGL/3D libraries for game rendering
echo -e "${YELLOW}🎮 Installing 3D/WebGL libraries...${NC}"
pnpm add three @react-three/fiber @react-three/drei

echo -e "${GREEN}✅ Dependencies installed!${NC}"
echo -e "${YELLOW}📁 Creating utility file structure...${NC}"

# Create the cn utility if it doesn't exist
mkdir -p apps/client/src/lib
mkdir -p apps/editor/src/lib
mkdir -p apps/server/src/lib

echo -e "${GREEN}✅ Build tools setup complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Run: pnpm install"
echo "2. Run: node setup-components.js (to set up component structure)"
echo "3. Run: node configure-paths.js (to configure TypeScript paths)"
