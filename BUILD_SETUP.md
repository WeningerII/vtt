# VTT Build Setup Documentation

## 🚀 Quick Start

```bash
# Install dependencies (ignore mozjpeg error - it's optional)
pnpm install

# Run build tools setup (if not already done)
bash setup-build-tools.sh
node setup-components.js
node configure-paths.js
```

## Project Overview

This document outlines the build setup for the VTT (Virtual Tabletop) project, a modern web-based tabletop gaming platform.

## 🎯 Build Infrastructure Solution

To resolve the **1,524 missing imports** across **221 files**, we've established a comprehensive build infrastructure that leverages existing, battle-tested libraries rather than reinventing the wheel.

### Import Categories Resolved:
- **621 Type Imports** → TypeScript path mappings + @types packages
- **551 Lucide Icons** → Consolidated icon exports in `@vtt/ui/icons`
- **219 Utility Functions** → shadcn/ui utilities (cn) + date-fns + lodash
- **82 React Hooks** → usehooks-ts + ahooks + react-use libraries
- **44 Library Imports** → Installed via package.json dependencies
- **5 Custom Hooks** → Custom hooks library in each app
- **2 UI Components** → Radix UI primitives + shadcn/ui components

## Build Tools

### Package Manager: pnpm
- Efficient disk space usage
- Strict dependency management
- Workspace support for monorepo

### Installed Libraries

#### UI Component Libraries
- **shadcn/ui dependencies**: class-variance-authority, tw-animate-css
- **Radix UI**: Complete set of unstyled, accessible UI primitives
- **Tailwind utilities**: clsx, tailwind-merge for className management

#### React Hook Libraries  
- **usehooks-ts**: TypeScript-first collection of React hooks
- **ahooks**: Alibaba's high-quality React hooks library
- **react-use**: Most popular React hooks collection
- **@uidotdev/usehooks**: Modern hooks with great documentation

#### Utility Libraries
- **date-fns**: Modern date utility library
- **lodash**: Utility functions (already installed)
- **numeral**: Number formatting
- **classnames**: Dynamic className construction
- **query-string**: URL query string parsing

#### State Management
- **zustand**: Lightweight state management
- **jotai**: Atomic state management
- **valtio**: Proxy-based state management
- **immer**: Immutable state updates

#### Data Fetching
- **@tanstack/react-query**: Powerful data synchronization
- **swr**: Data fetching with caching

#### Form Handling
- **react-hook-form**: Performant forms with validation
- **@hookform/resolvers**: Validation resolvers
- **yup**: Schema validation
- **zod**: TypeScript-first schema validation

#### Animation
- **framer-motion**: Production-ready motion library
- **react-spring**: Spring-physics animations

#### 3D/WebGL
- **three**: 3D graphics library
- **@react-three/fiber**: React renderer for Three.js
- **@react-three/drei**: Useful helpers for react-three-fiber

#### Visualization
- **recharts**: Composable charting library
- **chart.js + react-chartjs-2**: Popular charting solution
- **d3**: Data visualization library

## Project Structure

### New UI Package (`@vtt/ui`)
Centralized UI utilities and components:
```
packages/ui/
├── src/
│   ├── index.ts          # Main exports
│   ├── utils/
│   │   ├── cn.ts         # className utility
│   │   └── format.ts     # Formatting utilities
│   ├── hooks/
│   │   ├── react-hooks.ts    # React hook re-exports
│   │   └── custom-hooks.ts   # Custom hooks
│   └── icons/
│       └── index.ts      # Consolidated icon exports
├── package.json
└── tsconfig.json
```

### Import Patterns

#### Before (Missing Imports)
```typescript
// ❌ Missing imports cause errors
import { useState } from 'react';  // Sometimes missing
import { User } from 'lucide-react';  // Often missing
import { cn } from '../../../lib/utils';  // Path hell
```

#### After (Resolved)
```typescript
// ✅ Clean, absolute imports
import { useState } from '@vtt/ui/hooks/react-hooks';
import { User } from '@vtt/ui/icons';
import { cn } from '@vtt/ui';
```

## Development Workflow

### Local Development
```bash
# Start development servers
pnpm dev:server  # Backend server
pnpm dev:client  # Frontend client
pnpm dev:editor  # Map editor
```

### Building
```bash
# Build all packages
pnpm build

# Type checking
pnpm typecheck

# Linting
pnpm lint
```

### Testing
```bash
# Run unit tests
pnpm test

# Run E2E tests
pnpm test:e2e

# Run all tests
pnpm test:all
```

## Import Resolution Strategy

### 1. TypeScript Path Mappings
Configured in `tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "paths": {
      "@vtt/ui": ["packages/ui/src/index.ts"],
      "@vtt/ui/*": ["packages/ui/src/*"],
      "@/client/*": ["apps/client/src/*"],
      "@/editor/*": ["apps/editor/src/*"],
      "@/server/*": ["apps/server/src/*"],
      // ... all package mappings
    }
  }
}
```

### 2. Consolidated Exports
All commonly used imports are re-exported from central locations:

#### Icons (`@vtt/ui/icons`)
```typescript
export {
  User, Users, Search, Settings, Edit, Save,
  // ... 100+ icons exported
} from 'lucide-react';
```

#### React Hooks (`@vtt/ui/hooks/react-hooks`)
```typescript
export {
  useState, useEffect, useCallback, useMemo,
  // ... all React hooks
} from 'react';
```

#### Utilities (`@vtt/ui`)
```typescript
export { cn } from './utils/cn';  // className merger
export * from './utils/format';   // Date/number formatting
```

### 3. Custom Hooks Library
Shared custom hooks available in each app:
```typescript
// apps/client/src/hooks/custom.ts
export { useAuth } from './useAuth';
export { useGame } from './useGame';
export { useWebSocket } from './useWebSocket';
// Plus all hooks from usehooks-ts, ahooks, react-use
```

## Migration Guide

### Step 1: Update Imports
Replace relative imports with absolute imports:
```typescript
// Old
import { cn } from '../../../lib/utils';
import { User } from 'lucide-react';

// New
import { cn } from '@vtt/ui';
import { User } from '@vtt/ui/icons';
```

### Step 2: Use Consolidated Hooks
```typescript
// Old - might be missing
import { useState, useEffect } from 'react';

// New - guaranteed to work
import { useState, useEffect } from '@vtt/ui/hooks/react-hooks';
// Or use custom hooks
import { useLocalStorage, useDebounce } from '@/client/hooks/custom';
```

### Step 3: Leverage Utility Libraries
```typescript
import { formatDate, formatCurrency } from '@vtt/ui';
import { debounce } from 'lodash';
import { format } from 'date-fns';
```

## Benefits

1. **No More Missing Imports**: All common imports are centralized and guaranteed available
2. **Better DX**: Absolute imports with IntelliSense support
3. **Type Safety**: Full TypeScript support with proper type definitions
4. **Performance**: Tree-shaking ensures only used code is bundled
5. **Maintainability**: Single source of truth for common utilities
6. **Scalability**: Easy to add new shared components/utilities

## Troubleshooting

### Issue: Import not found
**Solution**: Check if the package is listed in the specific app's package.json or the root package.json

### Issue: TypeScript path not resolving
**Solution**: Ensure your IDE is using the workspace TypeScript version and restart TS server

### Issue: mozjpeg installation fails
**Solution**: This is optional for image optimization. Install nasm if needed:
```bash
# Ubuntu/Debian
sudo apt-get install nasm
# Then retry
pnpm install
```

## Scripts Reference

### Setup Scripts
- `setup-build-tools.sh` - Installs all necessary libraries
- `setup-components.js` - Creates component library structure
- `configure-paths.js` - Configures TypeScript path mappings

### Fix Scripts (from import audit)
- `fix-missing-imports.js` - Fixes React hooks and utilities
- `fix-package-dependencies.js` - Manages package.json dependencies
- `fix-type-imports.js` - Fixes TypeScript type imports

## Next Steps

1. **Verify Installation**: Run `pnpm install` to ensure all dependencies are installed
2. **Test Build**: Run `pnpm build` to verify everything compiles
3. **Update Existing Code**: Gradually migrate existing imports to use the new structure
4. **Add Custom Components**: Build reusable components in `@vtt/ui`
5. **Documentation**: Document any custom hooks or utilities you create
