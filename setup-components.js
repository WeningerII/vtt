#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

/**
 * Sets up component library structure and utilities
 * to resolve missing imports identified in audit
 */

console.log("🎨 Setting up component library structure...\n");

// Create cn utility function in all app directories
const cnUtilityCode = `import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Utility function to merge class names with tailwind-merge
 * Combines clsx for conditional classes with tailwind-merge for proper precedence
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
`;

// Create format utilities
const formatUtilsCode = `import { format as dateFnsFormat, formatDistance, formatRelative } from 'date-fns';

export const formatDate = (date: Date | string, formatStr = 'PPP') => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return dateFnsFormat(d, formatStr);
};

export const formatTimeAgo = (date: Date | string) => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return formatDistance(d, new Date(), { addSuffix: true });
};

export const formatRelativeTime = (date: Date | string) => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return formatRelative(d, new Date());
};

export const formatNumber = (num: number) => {
  return new Intl.NumberFormat('en-US').format(num);
};

export const formatCurrency = (amount: number, currency = 'USD') => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
};

export const formatPercent = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'percent',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
};
`;

// Common React hooks wrapper
const commonHooksCode = `import { 
  useCallback, 
  useEffect, 
  useLayoutEffect, 
  useMemo, 
  useRef, 
  useState,
  useContext,
  useReducer,
  useImperativeHandle,
  useDebugValue,
  useId,
  useTransition,
  useDeferredValue,
  useSyncExternalStore
} from 'react';

// Re-export all React hooks for easier imports
export {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useContext,
  useReducer,
  useImperativeHandle,
  useDebugValue,
  useId,
  useTransition,
  useDeferredValue,
  useSyncExternalStore
};

// Export type definitions
export type {
  Dispatch,
  SetStateAction,
  RefObject,
  MutableRefObject,
  EffectCallback,
  DependencyList,
  Reducer,
  ReducerState,
  ReducerAction,
} from 'react';
`;

// Custom hooks library
const customHooksCode = `import { useEffect, useState, useRef, useCallback } from 'react';
import { useLocalStorage, useDebounce, useThrottle } from 'usehooks-ts';

// Re-export popular hooks from libraries
export { 
  useLocalStorage,
  useDebounce,
  useThrottle,
  useMediaQuery,
  useOnClickOutside,
  useInterval,
  useTimeout,
  useToggle,
  useCounter,
  useHover,
  useFetch,
  useScript,
  useWindowSize,
  useScrollPosition
} from 'usehooks-ts';

// Custom auth hook placeholder
export const useAuth = () => {
  // This should be implemented based on your auth system
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  
  return {
    isAuthenticated,
    user,
    login: async (credentials: any) => {
      // Implement login logic
    },
    logout: () => {
      setIsAuthenticated(false);
      setUser(null);
    }
  };
};

// Custom game hook placeholder
export const useGame = () => {
  const [gameState, setGameState] = useState(null);
  const [players, setPlayers] = useState([]);
  
  return {
    gameState,
    players,
    joinGame: (gameId: string) => {
      // Implement game join logic
    },
    leaveGame: () => {
      setGameState(null);
      setPlayers([]);
    }
  };
};

// WebSocket hook
export const useWebSocket = (url: string) => {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState(null);
  const ws = useRef<WebSocket | null>(null);
  
  useEffect(() => {
    ws.current = new WebSocket(url);
    
    ws.current.onopen = () => setIsConnected(true);
    ws.current.onclose = () => setIsConnected(false);
    ws.current.onmessage = (event) => setLastMessage(event.data);
    
    return () => {
      ws.current?.close();
    };
  }, [url]);
  
  const sendMessage = useCallback((message: string) => {
    ws.current?.send(message);
  }, []);
  
  return { isConnected, lastMessage, sendMessage };
};
`;

// Icon exports consolidation
const iconExportsCode = `// Consolidated icon exports from lucide-react
export {
  // Navigation
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  Home,
  
  // User/Account
  User,
  Users,
  UserPlus,
  UserMinus,
  UserCheck,
  UserX,
  LogIn,
  LogOut,
  
  // Common Actions
  Search,
  Settings,
  Edit,
  Edit2,
  Edit3,
  Save,
  Download,
  Upload,
  Copy,
  Clipboard,
  Trash,
  Trash2,
  Plus,
  Minus,
  Check,
  
  // Media
  Play,
  Pause,
  Stop,
  SkipForward,
  SkipBack,
  Volume,
  Volume2,
  VolumeX,
  Mic,
  MicOff,
  Camera,
  CameraOff,
  Image,
  
  // Communication
  Mail,
  MessageSquare,
  MessageCircle,
  Send,
  Bell,
  BellOff,
  
  // Files
  File,
  FileText,
  Folder,
  FolderOpen,
  
  // UI Elements
  Eye,
  EyeOff,
  Info,
  AlertCircle,
  AlertTriangle,
  HelpCircle,
  Loader,
  Loader2,
  RefreshCw,
  RotateCw,
  
  // Game/RPG specific
  Sword,
  Shield,
  Heart,
  Star,
  Zap,
  Flame,
  
  // Layout
  Grid,
  List,
  Layers,
  Layout,
  Sidebar,
  
  // Data
  Database,
  Server,
  Cloud,
  CloudOff,
  Wifi,
  WifiOff,
  
  // Time
  Clock,
  Calendar,
  Timer,
  
  // Money/Shop
  DollarSign,
  ShoppingCart,
  ShoppingBag,
  CreditCard,
  
  // Social
  Share,
  Share2,
  Link,
  Link2,
  ExternalLink,
  
  // Misc
  Sun,
  Moon,
  MapPin,
  Navigation,
  Compass,
  Activity,
  Award,
  Badge,
  Flag,
  Gift,
  Key,
  Lock,
  Unlock,
  Bookmark,
  Hash,
  Tag,
  Filter,
  Code,
  Terminal,
  type LucideIcon,
} from 'lucide-react';
`;

// Create directory structure
const directories = [
  "apps/client/src/lib",
  "apps/client/src/hooks",
  "apps/client/src/components/ui",
  "apps/editor/src/lib",
  "apps/editor/src/hooks",
  "apps/editor/src/components/ui",
  "apps/server/src/lib",
  "packages/ui/src",
  "packages/ui/src/hooks",
  "packages/ui/src/icons",
  "packages/ui/src/utils",
];

directories.forEach((dir) => {
  const fullPath = path.join("/home/weningerii/vtt", dir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
    console.log(`✅ Created directory: ${dir}`);
  }
});

// Write utility files
const files = [
  // CN utility for each app
  { path: "apps/client/src/lib/utils.ts", content: cnUtilityCode },
  { path: "apps/editor/src/lib/utils.ts", content: cnUtilityCode },
  { path: "packages/ui/src/utils/cn.ts", content: cnUtilityCode },

  // Format utilities
  { path: "apps/client/src/lib/format.ts", content: formatUtilsCode },
  { path: "apps/editor/src/lib/format.ts", content: formatUtilsCode },
  { path: "packages/ui/src/utils/format.ts", content: formatUtilsCode },

  // Hooks
  { path: "apps/client/src/hooks/index.ts", content: commonHooksCode },
  { path: "apps/editor/src/hooks/index.ts", content: commonHooksCode },
  { path: "packages/ui/src/hooks/react-hooks.ts", content: commonHooksCode },

  // Custom hooks
  { path: "apps/client/src/hooks/custom.ts", content: customHooksCode },
  { path: "apps/editor/src/hooks/custom.ts", content: customHooksCode },
  { path: "packages/ui/src/hooks/custom-hooks.ts", content: customHooksCode },

  // Icons
  { path: "packages/ui/src/icons/index.ts", content: iconExportsCode },
];

files.forEach(({ path: filePath, content }) => {
  const fullPath = path.join("/home/weningerii/vtt", filePath);
  fs.writeFileSync(fullPath, content, "utf8");
  console.log(`✅ Created: ${filePath}`);
});

// Create package.json for UI package if it doesn't exist
const uiPackageJson = {
  name: "@vtt/ui",
  version: "1.0.0",
  private: true,
  main: "./src/index.ts",
  types: "./src/index.ts",
  scripts: {
    typecheck: "tsc --noEmit",
  },
  dependencies: {
    clsx: "^2.1.0",
    "tailwind-merge": "^2.2.0",
    "lucide-react": "^0.294.0",
    "class-variance-authority": "latest",
    "date-fns": "latest",
    "@radix-ui/react-alert-dialog": "latest",
    "@radix-ui/react-dialog": "latest",
    "@radix-ui/react-dropdown-menu": "latest",
    "@radix-ui/react-label": "latest",
    "@radix-ui/react-popover": "latest",
    "@radix-ui/react-select": "latest",
    "@radix-ui/react-tabs": "latest",
    "@radix-ui/react-toast": "latest",
    react: "18",
    "react-dom": "18",
  },
  devDependencies: {
    "@types/react": "18",
    "@types/react-dom": "18",
    typescript: "^5.0.0",
  },
};

const uiPackagePath = "/home/weningerii/vtt/packages/ui/package.json";
fs.writeFileSync(uiPackagePath, JSON.stringify(uiPackageJson, null, 2));
console.log("✅ Created packages/ui/package.json");

// Create main UI export file
const uiIndexCode = `// Main UI package exports
export * from './utils/cn';
export * from './utils/format';
export * from './hooks/react-hooks';
export * from './hooks/custom-hooks';
export * from './icons';

// Re-export component types
export type { ClassValue } from 'clsx';
`;

fs.writeFileSync("/home/weningerii/vtt/packages/ui/src/index.ts", uiIndexCode);
console.log("✅ Created packages/ui/src/index.ts");

// Create tsconfig for UI package
const uiTsConfig = {
  extends: "../../tsconfig.base.json",
  compilerOptions: {
    jsx: "react-jsx",
    lib: ["ES2020", "DOM", "DOM.Iterable"],
    module: "ESNext",
    target: "ES2020",
    moduleResolution: "node",
    resolveJsonModule: true,
    allowSyntheticDefaultImports: true,
    esModuleInterop: true,
  },
  include: ["src/**/*"],
  exclude: ["node_modules", "dist"],
};

fs.writeFileSync(
  "/home/weningerii/vtt/packages/ui/tsconfig.json",
  JSON.stringify(uiTsConfig, null, 2),
);
console.log("✅ Created packages/ui/tsconfig.json");

console.log("\n✅ Component library structure setup complete!");
console.log("\n📝 Next steps:");
console.log("1. Run: node configure-paths.js");
console.log("2. Update pnpm-workspace.yaml to include packages/ui");
console.log("3. Run: pnpm install");
console.log('4. Start using imports like: import { cn } from "@vtt/ui"');
