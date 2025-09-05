/**
 * Core package exports
 */

// Core shared functionality for the VTT platform
export * from "./EventEmitter";
export * from "./SharedInterfaces";
export * from "./GPUResourceManager";
export * from "./UnifiedAssetManager";
export * from "./PerformanceMonitor";
export * from "./StateManager";
export * from "./ComponentFactory";
export * from "./WebGPUContextManager";
export * from "./AIProviderRegistry";
export * from "./NetworkManager";
export * from "./MemoryOptimizer";

// Singleton instances for shared resources
import { UnifiedGPUResourceManager } from "./GPUResourceManager";
import { logger } from "@vtt/logging";
import { UnifiedAssetManager } from "./UnifiedAssetManager";
import { PerformanceMonitorImpl } from "./PerformanceMonitor";
import { createStateManager } from "./StateManager";
import { _componentFactory } from "./ComponentFactory";
import { WebGPUContextManager } from "./WebGPUContextManager";
import { AIProviderRegistry } from "./AIProviderRegistry";
import { _networkManager } from "./NetworkManager";
import { MemoryOptimizer } from "./MemoryOptimizer";

export const gpuResourceManager = new UnifiedGPUResourceManager();
export const assetManager = new UnifiedAssetManager();
export const performanceMonitor = new PerformanceMonitorImpl();
export const _stateManager = createStateManager({});
export const webgpuContextManager = new WebGPUContextManager();
export const aiProviderRegistry = new AIProviderRegistry();
export const networkManager = _networkManager;
export const memoryOptimizer = new MemoryOptimizer();
export {
  _componentFactory as componentFactory,
};

// Initialize core systems
async function initializeCore() {
  try {
    await gpuResourceManager.initialize();
    await assetManager.initialize();
    performanceMonitor.start();

    logger.info("Core systems initialized successfully");
  } catch (error) {
    logger.error("Failed to initialize core systems:", error as Record<string, any>);
    throw error;
  }
}

// Auto-initialize when imported (can be disabled if needed)
let autoInit = true;
export const _setAutoInit = (_enabled: boolean) => {
  autoInit = _enabled;
};

if (autoInit && typeof window !== "undefined") {
  initializeCore().catch(console.error);
}

export { initializeCore };

export * from "./errors";
