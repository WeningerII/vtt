import { logger } from '@vtt/logging';

export interface ModManifest {
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  gameVersion: string;
  dependencies: ModDependency[];
  conflicts: string[];
  assets: ModAsset[];
  scripts: string[];
  hooks: ModHook[];
  config: ModConfig[];
}

export interface ModDependency {
  id: string;
  version: string;
  optional: boolean;
}

export interface ModAsset {
  id: string;
  type: 'texture' | 'model' | 'audio' | 'data' | 'shader';
  path: string;
  override?: string; // Original asset to override
}

export interface ModHook {
  event: string;
  script: string;
  priority: number;
}

export interface ModConfig {
  key: string;
  type: 'string' | 'number' | 'boolean' | 'select' | 'range';
  default: any;
  options?: any[];
  min?: number;
  max?: number;
  description: string;
}

export interface ModInstance {
  manifest: ModManifest;
  isEnabled: boolean;
  isLoaded: boolean;
  loadOrder: number;
  configValues: Map<string, any>;
  assetOverrides: Map<string, string>;
  scriptInstances: Map<string, any>;
  lastError?: Error;
}

export interface ModLoadResult {
  success: boolean;
  mod?: ModInstance;
  errors: string[];
  warnings: string[];
}

export class ModdingFramework {
  private mods = new Map<string, ModInstance>();
  private loadOrder: string[] = [];
  private assetRegistry = new Map<string, ModAsset>();
  private configStorage = new Map<string, Map<string, any>>();
  
  // Dependencies
  private scriptingEngine: any; // ScriptingEngine
  private assetManager: any; // AssetManager
  
  // Statistics
  private stats = {
    totalMods: 0,
    enabledMods: 0,
    totalAssets: 0,
    totalOverrides: 0,
    loadErrors: 0
  };
  
  constructor(scriptingEngine: any, assetManager: any) {
    this.scriptingEngine = scriptingEngine;
    this.assetManager = assetManager;
  }
  
  public async loadMod(manifest: ModManifest, modPath: string): Promise<ModLoadResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    try {
      // Validate manifest
      const validationResult = this.validateManifest(manifest);
      if (!validationResult.valid) {
        errors.push(...validationResult.errors);
        warnings.push(...validationResult.warnings);
        
        if (errors.length > 0) {
          return { success: false, errors, warnings };
        }
      }
      
      // Check dependencies
      const depResult = this.checkDependencies(manifest.dependencies);
      if (!depResult.satisfied) {
        errors.push(...depResult.missing.map(dep => `Missing dependency: ${dep.id} ${dep.version}`));
      }
      
      // Check conflicts
      const conflictResult = this.checkConflicts(manifest.conflicts);
      if (conflictResult.hasConflicts) {
        errors.push(...conflictResult.conflicts.map(mod => `Conflicts with: ${mod}`));
      }
      
      if (errors.length > 0) {
        return { success: false, errors, warnings };
      }
      
      // Create mod instance
      const modInstance: ModInstance = {
        manifest,
        isEnabled: false,
        isLoaded: false,
        loadOrder: this.generateLoadOrder(manifest),
        configValues: new Map(),
        assetOverrides: new Map(),
        scriptInstances: new Map(),
      };
      
      // Load configuration
      await this.loadModConfig(modInstance, modPath);
      
      // Load assets
      await this.loadModAssets(modInstance, modPath);
      
      // Load scripts
      await this.loadModScripts(modInstance, modPath);
      
      // Register mod
      this.mods.set(manifest.id, modInstance);
      this.insertInLoadOrder(manifest.id, modInstance.loadOrder);
      
      modInstance.isLoaded = true;
      this.stats.totalMods++;
      
      return {
        success: true,
        mod: modInstance,
        errors,
        warnings
      };
      
    } catch (error) {
      errors.push(`Failed to load mod: ${error}`);
      this.stats.loadErrors++;
      
      return { success: false, errors, warnings };
    }
  }
  
  public unloadMod(modId: string): boolean {
    const mod = this.mods.get(modId);
    if (!mod) return false;
    
    try {
      // Disable if enabled
      if (mod.isEnabled) {
        this.disableMod(modId);
      }
      
      // Unload scripts
      for (const scriptId of mod.scriptInstances.keys()) {
        this.scriptingEngine.unloadScript(scriptId);
      }
      
      // Remove asset overrides
      for (const [originalAsset, _] of mod.assetOverrides) {
        this.assetManager.removeOverride(originalAsset);
      }
      
      // Remove from registries
      this.mods.delete(modId);
      this.loadOrder = this.loadOrder.filter(id => id !== modId);
      
      // Clean up asset registry
      for (const [assetId, asset] of this.assetRegistry) {
        if (asset.path.startsWith(`mods/${modId}/`)) {
          this.assetRegistry.delete(assetId);
        }
      }
      
      this.stats.totalMods--;
      return true;
      
    } catch (error) {
      logger.error(`Failed to unload mod ${modId}:`, error);
      return false;
    }
  }
  
  public enableMod(modId: string): boolean {
    const mod = this.mods.get(modId);
    if (!mod || !mod.isLoaded || mod.isEnabled) return false;
    
    try {
      // Check dependencies are enabled
      for (const dep of mod.manifest.dependencies) {
        if (!dep.optional) {
          const depMod = this.mods.get(dep.id);
          if (!depMod || !depMod.isEnabled) {
            throw new Error(`Dependency not enabled: ${dep.id}`);
          }
        }
      }
      
      // Apply asset overrides
      for (const asset of mod.manifest.assets) {
        if (asset.override) {
          this.assetManager.addOverride(asset.override, `mods/${modId}/${asset.path}`);
          mod.assetOverrides.set(asset.override, `mods/${modId}/${asset.path}`);
        }
      }
      
      // Activate scripts
      for (const scriptId of mod.scriptInstances.keys()) {
        this.scriptingEngine.activateScript(scriptId);
      }
      
      mod.isEnabled = true;
      this.stats.enabledMods++;
      
      return true;
      
    } catch (error) {
      logger.error(`Failed to enable mod ${modId}:`, error);
      mod.lastError = error instanceof Error ? error : new Error(String(error));
      return false;
    }
  }
  
  public disableMod(modId: string): boolean {
    const mod = this.mods.get(modId);
    if (!mod || !mod.isEnabled) return false;
    
    try {
      // Check if other mods depend on this one
      const dependents = this.findDependents(modId);
      for (const dependent of dependents) {
        const depMod = this.mods.get(dependent);
        if (depMod && depMod.isEnabled) {
          throw new Error(`Cannot disable: ${dependent} depends on this mod`);
        }
      }
      
      // Deactivate scripts
      for (const scriptId of mod.scriptInstances.keys()) {
        this.scriptingEngine.deactivateScript(scriptId);
      }
      
      // Remove asset overrides
      for (const [originalAsset, _] of mod.assetOverrides) {
        this.assetManager.removeOverride(originalAsset);
      }
      mod.assetOverrides.clear();
      
      mod.isEnabled = false;
      this.stats.enabledMods--;
      
      return true;
      
    } catch (error) {
      logger.error(`Failed to disable mod ${modId}:`, error);
      mod.lastError = error instanceof Error ? error : new Error(String(error));
      return false;
    }
  }
  
  private validateManifest(manifest: ModManifest): { valid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Required fields
    const requiredFields = ['id', 'name', 'version', 'author', 'gameVersion'];
    for (const field of requiredFields) {
      if (!manifest[field as keyof ModManifest]) {
        errors.push(`Missing required field: ${field}`);
      }
    }
    
    // Version format
    if (manifest.version && !/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(manifest.version)) {
      errors.push('Invalid version format. Use semantic versioning (e.g., 1.0.0)');
    }
    
    // Game version compatibility
    if (manifest.gameVersion && !this.isVersionCompatible(manifest.gameVersion)) {
      warnings.push(`Mod may not be compatible with current game version`);
    }
    
    // ID format
    if (manifest.id && !/^[a-z][a-z0-9_-]*$/.test(manifest.id)) {
      errors.push('Invalid mod ID format. Use lowercase letters, numbers, underscores, and hyphens only');
    }
    
    // Check for duplicate assets
    const assetIds = new Set<string>();
    for (const asset of manifest.assets || []) {
      if (assetIds.has(asset.id)) {
        errors.push(`Duplicate asset ID: ${asset.id}`);
      }
      assetIds.add(asset.id);
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
  
  private checkDependencies(dependencies: ModDependency[]): { satisfied: boolean; missing: ModDependency[] } {
    const missing: ModDependency[] = [];
    
    for (const dep of dependencies) {
      const depMod = this.mods.get(dep.id);
      
      if (!depMod) {
        if (!dep.optional) {
          missing.push(dep);
        }
        continue;
      }
      
      // Check version compatibility
      if (!this.isVersionCompatible(dep.version, depMod.manifest.version)) {
        missing.push(dep);
      }
    }
    
    return {
      satisfied: missing.length === 0,
      missing
    };
  }
  
  private checkConflicts(conflicts: string[]): { hasConflicts: boolean; conflicts: string[] } {
    const foundConflicts: string[] = [];
    
    for (const conflictId of conflicts) {
      if (this.mods.has(conflictId)) {
        foundConflicts.push(conflictId);
      }
    }
    
    return {
      hasConflicts: foundConflicts.length > 0,
      conflicts: foundConflicts
    };
  }
  
  private isVersionCompatible(required: string, actual?: string): boolean {
    if (!actual) return false;
    
    // Simple semver compatibility check
    const parseVersion = (v: string) => v.split('.').map(n => parseInt(n) || 0);
    
    const req = parseVersion(required);
    const act = parseVersion(actual);
    
    // Major version must match, minor and patch can be higher
    return req[0] === act[0] && 
           (act[1] > req[1] || (act[1] === req[1] && act[2] >= req[2]));
  }
  
  private generateLoadOrder(manifest: ModManifest): number {
    // Generate load order based on dependencies
    let order = 1000; // Default priority
    
    // Higher priority for mods with fewer dependencies
    order -= manifest.dependencies.length * 100;
    
    // Lower priority for mods that override core assets
    const coreOverrides = manifest.assets.filter(asset => 
      asset.override && asset.override.startsWith('core/')
    );
    order += coreOverrides.length * 50;
    
    return order;
  }
  
  private insertInLoadOrder(modId: string, order: number): void {
    // Insert mod in load order maintaining sort
    let insertIndex = 0;
    
    for (let i = 0; i < this.loadOrder.length; i++) {
      const existingMod = this.mods.get(this.loadOrder[i]);
      if (existingMod && existingMod.loadOrder <= order) {
        insertIndex = i + 1;
      } else {
        break;
      }
    }
    
    this.loadOrder.splice(insertIndex, 0, modId);
  }
  
  private findDependents(modId: string): string[] {
    const dependents: string[] = [];
    
    for (const [id, mod] of this.mods) {
      if (mod.manifest.dependencies.some(dep => dep.id === modId)) {
        dependents.push(id);
      }
    }
    
    return dependents;
  }
  
  private async loadModConfig(mod: ModInstance, _modPath: string): Promise<void> {
    // Load saved configuration
    const savedConfig = this.configStorage.get(mod.manifest.id) || new Map();
    
    // Apply default values and saved values
    for (const config of mod.manifest.config) {
      let value = savedConfig.get(config.key);
      
      if (value === undefined) {
        value = config.default;
      }
      
      // Validate value
      if (!this.validateConfigValue(config, value)) {
        value = config.default;
      }
      
      mod.configValues.set(config.key, value);
    }
  }
  
  private validateConfigValue(config: ModConfig, value: any): boolean {
    switch (config.type) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number' && 
               (config.min === undefined || value >= config.min) &&
               (config.max === undefined || value <= config.max);
      case 'boolean':
        return typeof value === 'boolean';
      case 'select':
        return config.options && config.options.includes(value);
      case 'range':
        return typeof value === 'number' &&
               config.min !== undefined && value >= config.min &&
               config.max !== undefined && value <= config.max;
      default:
        return true;
    }
  }
  
  private async loadModAssets(mod: ModInstance, modPath: string): Promise<void> {
    for (const asset of mod.manifest.assets) {
      const fullPath = `${modPath}/${asset.path}`;
      
      // Register asset with asset manager
      try {
        await this.assetManager.loadAsset(asset.id, fullPath, asset.type);
        this.assetRegistry.set(asset.id, asset);
        this.stats.totalAssets++;
        
        if (asset.override) {
          this.stats.totalOverrides++;
        }
      } catch (error) {
        logger.warn(`Failed to load asset ${asset.id}:`, error);
      }
    }
  }
  
  private async loadModScripts(mod: ModInstance, modPath: string): Promise<void> {
    for (const scriptPath of mod.manifest.scripts) {
      try {
        // Load script file
        const fullPath = `${modPath}/${scriptPath}`;
        const scriptCode = await this.loadScriptFile(fullPath);
        
        // Create script manifest
        const scriptManifest = {
          id: `${mod.manifest.id}_${scriptPath}`,
          name: `${mod.manifest.name} Script`,
          version: mod.manifest.version,
          author: mod.manifest.author,
          description: `Script from mod: ${mod.manifest.name}`,
          dependencies: [],
          permissions: ['gamestate.read', 'entities.write', 'events.register'],
          entryPoint: scriptPath,
          files: [scriptPath],
          hooks: mod.manifest.hooks.map(hook => hook.event),
          commands: []
        };
        
        // Load script
        const success = await this.scriptingEngine.loadScript(scriptManifest, scriptCode);
        if (success) {
          mod.scriptInstances.set(scriptManifest.id, true);
        }
        
      } catch (error) {
        logger.warn(`Failed to load script ${scriptPath}:`, error);
      }
    }
  }
  
  private async loadScriptFile(path: string): Promise<string> {
    // In a real implementation, this would read from the file system
    // For now, return empty script
    return `// Mod script: ${path}`;
  }
  
  // Public API
  public getMod(modId: string): ModInstance | undefined {
    return this.mods.get(modId);
  }
  
  public getAllMods(): ModInstance[] {
    return Array.from(this.mods.values());
  }
  
  public getEnabledMods(): ModInstance[] {
    return Array.from(this.mods.values()).filter(mod => mod.isEnabled);
  }
  
  public getLoadOrder(): string[] {
    return [...this.loadOrder];
  }
  
  public setModConfig(modId: string, key: string, value: any): boolean {
    const mod = this.mods.get(modId);
    if (!mod) return false;
    
    const config = mod.manifest.config.find(c => c.key === key);
    if (!config) return false;
    
    if (!this.validateConfigValue(config, value)) return false;
    
    mod.configValues.set(key, value);
    
    // Save to persistent storage
    let savedConfig = this.configStorage.get(modId);
    if (!savedConfig) {
      savedConfig = new Map();
      this.configStorage.set(modId, savedConfig);
    }
    savedConfig.set(key, value);
    
    return true;
  }
  
  public getModConfig(modId: string, key: string): any {
    const mod = this.mods.get(modId);
    if (!mod) return undefined;
    
    return mod.configValues.get(key);
  }
  
  public getStats() {
    return { ...this.stats };
  }
  
  public exportModList(): any {
    return {
      mods: Array.from(this.mods.values()).map(mod => ({
        id: mod.manifest.id,
        name: mod.manifest.name,
        version: mod.manifest.version,
        author: mod.manifest.author,
        enabled: mod.isEnabled,
        loadOrder: mod.loadOrder
      })),
      loadOrder: this.loadOrder,
      stats: this.stats
    };
  }
  
  public dispose(): void {
    // Disable all mods
    for (const modId of this.mods.keys()) {
      this.disableMod(modId);
    }
    
    // Unload all mods
    for (const modId of this.mods.keys()) {
      this.unloadMod(modId);
    }
    
    this.mods.clear();
    this.loadOrder = [];
    this.assetRegistry.clear();
    this.configStorage.clear();
  }
}
