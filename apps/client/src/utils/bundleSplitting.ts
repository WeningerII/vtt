/**
 * Bundle Splitting and Dynamic Import Utilities
 * Optimizes initial load performance through intelligent code splitting
 */

import { lazy, ComponentType } from 'react';

// Lazy loading wrapper with error boundary and loading states
export function createLazyComponent<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  fallback?: ComponentType
): T {
  return lazy(async () => {
    try {
      const module = await importFn();
      return module;
    } catch (error) {
      console.error('Dynamic import failed:', error);
      
      // Return fallback component or error boundary
      if (fallback) {
        return { default: fallback };
      }
      
      // Default error component
      const ErrorComponent = () => (
        <div className="p-4 text-center text-red-500">
          <p>Failed to load component</p>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-2 px-4 py-2 bg-red-500 text-white rounded"
            type="button"
          >
            Retry
          </button>
        </div>
      );
      
      return { default: ErrorComponent as T };
    }
  });
}

// Preload critical components during idle time
export function preloadComponent(importFn: () => Promise<any>): void {
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => {
      importFn().catch(() => {
        // Silent fail for preloading
      });
    });
  } else {
    // Fallback for browsers without requestIdleCallback
    setTimeout(() => {
      importFn().catch(() => {
        // Silent fail for preloading
      });
    }, 2000);
  }
}

// Bundle splitting configuration for different component categories
export const ComponentBundles = {
  // Core components - Always loaded
  core: {
    // These should be in the main bundle
    MobileNavigation: () => import('../components/MobileNavigation'),
    AdaptiveLayout: () => import('../components/AdaptiveLayout'),
  },

  // Game components - Loaded on demand
  game: {
    MapEditor: () => import('../components/MapEditor'),
    MobileMapToolbar: () => import('../components/MobileMapToolbar'),
    DiceRoller: () => import('../components/DiceRoller'),
    CharacterSheet: () => import('../components/LazyCharacterSheet'),
  },

  // UI components - Loaded when needed
  ui: {
    Modal: () => import('../components/ui/Modal'),
    Dialog: () => import('../components/ui/Dialog'),
    Drawer: () => import('../components/ui/Drawer'),
    Toast: () => import('../components/ui/Toast'),
  },

  // Feature components - Lazy loaded
  features: {
    AudioManager: () => import('../components/AudioManager'),
    VideoChat: () => import('../components/VideoChat'),
    FileUpload: () => import('../components/FileUpload'),
    ImageEditor: () => import('../components/ImageEditor'),
  },

  // Heavy components - Only load when absolutely needed
  heavy: {
    AdvancedCharacterSheet: () => import('../components/character/AdvancedCharacterSheet'),
    MapRenderer3D: () => import('../components/map/MapRenderer3D'),
    VoiceChat: () => import('../components/VoiceChat'),
    AIAssistant: () => import('../components/AIAssistant'),
  }
};

// Create lazy components with intelligent fallbacks
export const LazyComponents = {
  // Game components
  MapEditor: createLazyComponent(ComponentBundles.game.MapEditor),
  MobileMapToolbar: createLazyComponent(ComponentBundles.game.MobileMapToolbar),
  DiceRoller: createLazyComponent(ComponentBundles.game.DiceRoller),
  CharacterSheet: createLazyComponent(ComponentBundles.game.CharacterSheet),

  // UI components
  Modal: createLazyComponent(ComponentBundles.ui.Modal),
  Dialog: createLazyComponent(ComponentBundles.ui.Dialog),
  Drawer: createLazyComponent(ComponentBundles.ui.Drawer),
  Toast: createLazyComponent(ComponentBundles.ui.Toast),

  // Feature components
  AudioManager: createLazyComponent(ComponentBundles.features.AudioManager),
  VideoChat: createLazyComponent(ComponentBundles.features.VideoChat),
  FileUpload: createLazyComponent(ComponentBundles.features.FileUpload),
  ImageEditor: createLazyComponent(ComponentBundles.features.ImageEditor),

  // Heavy components
  AdvancedCharacterSheet: createLazyComponent(ComponentBundles.heavy.AdvancedCharacterSheet),
  MapRenderer3D: createLazyComponent(ComponentBundles.heavy.MapRenderer3D),
  VoiceChat: createLazyComponent(ComponentBundles.heavy.VoiceChat),
  AIAssistant: createLazyComponent(ComponentBundles.heavy.AIAssistant),
};

// Preloader for critical game components
export class ComponentPreloader {
  private static preloadedBundles = new Set<string>();
  private static loadingPromises = new Map<string, Promise<any>>();

  static preloadGameComponents(): void {
    // Preload essential game components during idle time
    const essentialComponents = [
      ComponentBundles.game.DiceRoller,
      ComponentBundles.ui.Modal,
      ComponentBundles.ui.Toast
    ];

    essentialComponents.forEach((importFn, index) => {
      // Stagger preloading to avoid blocking
      setTimeout(() => {
        preloadComponent(importFn);
      }, index * 500);
    });
  }

  static preloadFeatureComponents(): void {
    // Preload feature components based on user actions
    const featureComponents = [
      ComponentBundles.features.AudioManager,
      ComponentBundles.features.FileUpload
    ];

    featureComponents.forEach((importFn, index) => {
      setTimeout(() => {
        preloadComponent(importFn);
      }, (index + 1) * 1000);
    });
  }

  static async loadBundle(bundleName: keyof typeof ComponentBundles): Promise<void> {
    if (this.preloadedBundles.has(bundleName)) {
      return;
    }

    if (this.loadingPromises.has(bundleName)) {
      return this.loadingPromises.get(bundleName);
    }

    const loadPromise = this.loadBundleComponents(bundleName);
    this.loadingPromises.set(bundleName, loadPromise);

    try {
      await loadPromise;
      this.preloadedBundles.add(bundleName);
    } catch (error) {
      console.error(`Failed to load ${bundleName} bundle:`, error);
    } finally {
      this.loadingPromises.delete(bundleName);
    }
  }

  private static async loadBundleComponents(bundleName: keyof typeof ComponentBundles): Promise<void> {
    const bundle = ComponentBundles[bundleName];
    const loadPromises = Object.values(bundle).map(importFn => 
      importFn().catch(error => {
        console.warn(`Failed to preload component in ${bundleName}:`, error);
        return null;
      })
    );

    await Promise.all(loadPromises);
  }
}

// Route-based code splitting
export const RouteComponents = {
  // Main app routes
  GameSession: createLazyComponent(() => import('../pages/GameSession')),
  CharacterCreator: createLazyComponent(() => import('../pages/CharacterCreator')),
  CampaignManager: createLazyComponent(() => import('../pages/CampaignManager')),
  
  // Settings and admin routes
  Settings: createLazyComponent(() => import('../pages/Settings')),
  AdminPanel: createLazyComponent(() => import('../pages/AdminPanel')),
  
  // Social features
  Friends: createLazyComponent(() => import('../pages/Friends')),
  Groups: createLazyComponent(() => import('../pages/Groups')),
};

// Performance monitoring for bundle loading
export class BundlePerformance {
  private static metrics = new Map<string, {
    loadStart: number;
    loadEnd?: number;
    size?: number;
    success: boolean;
  }>();

  static startLoad(componentName: string): void {
    this.metrics.set(componentName, {
      loadStart: performance.now(),
      success: false
    });
  }

  static endLoad(componentName: string, success: boolean = true): void {
    const metric = this.metrics.get(componentName);
    if (metric) {
      metric.loadEnd = performance.now();
      metric.success = success;
    }
  }

  static getMetrics(): Record<string, any> {
    const result: Record<string, any> = {};
    
    for (const [name, metric] of this.metrics) {
      result[name] = {
        ...metric,
        loadTime: metric.loadEnd ? metric.loadEnd - metric.loadStart : null
      };
    }
    
    return result;
  }

  static reportSlowLoads(threshold: number = 1000): void {
    const slowLoads = Array.from(this.metrics.entries())
      .filter(([, metric]) => {
        const loadTime = metric.loadEnd ? metric.loadEnd - metric.loadStart : 0;
        return loadTime > threshold;
      });

    if (slowLoads.length > 0) {
      console.warn('Slow component loads detected:', slowLoads);
    }
  }
}

// Initialize bundle optimization
export function initializeBundleOptimization(): void {
  // Start preloading critical components
  ComponentPreloader.preloadGameComponents();
  
  // Preload features after initial render
  setTimeout(() => {
    ComponentPreloader.preloadFeatureComponents();
  }, 3000);
  
  // Monitor bundle performance
  setTimeout(() => {
    BundlePerformance.reportSlowLoads();
  }, 10000);
}

export default {
  LazyComponents,
  ComponentPreloader,
  BundlePerformance,
  RouteComponents,
  initializeBundleOptimization
};
