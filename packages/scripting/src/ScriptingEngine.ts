import { logger } from "@vtt/logging";

export interface ScriptContext {
  gameState: any;
  entities: Map<string, any>;
  events: ScriptEventSystem;
  api: GameAPI;
  storage: ScriptStorage;
  logger: ScriptLogger;
  permissions: ScriptPermissions;
}

export interface ScriptManifest {
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  dependencies: string[];
  permissions: string[];
  entryPoint: string;
  files: string[];
  hooks: string[];
  commands: ScriptCommand[];
}

export interface ScriptCommand {
  name: string;
  description: string;
  usage: string;
  permission?: string;
}

export interface ScriptModule {
  manifest: ScriptManifest;
  code: string;
  instance?: any;
  isActive: boolean;
  loadTime: number;
  executionTime: number;
  errorCount: number;
  lastError?: Error;
}

export interface ScriptPermissions {
  canAccessGameState: boolean;
  canModifyEntities: boolean;
  canRegisterEvents: boolean;
  canAccessNetwork: boolean;
  canAccessFileSystem: boolean;
  canExecuteCommands: boolean;
  allowedAPIs: string[];
}

export class ScriptingEngine {
  private modules = new Map<string, ScriptModule>();
  private hooks = new Map<string, ScriptHook[]>();
  private commands = new Map<string, ScriptCommandHandler>();
  private eventSystem: ScriptEventSystem;
  private api: GameAPI;
  private storage: ScriptStorage;
  private logger: ScriptLogger;
  private sandboxes = new Map<string, ScriptSandbox>();

  // Security and performance
  private executionLimits = {
    maxExecutionTime: 1000, // ms
    maxMemoryUsage: 50 * 1024 * 1024, // 50MB
    maxAPICallsPerSecond: 1000,
    maxEventListeners: 100,
  };

  private stats = {
    totalScripts: 0,
    activeScripts: 0,
    totalExecutions: 0,
    totalErrors: 0,
    averageExecutionTime: 0,
  };

  constructor() {
    this.eventSystem = new ScriptEventSystem();
    this.api = new GameAPI();
    this.storage = new ScriptStorage();
    this.logger = new ScriptLogger();

    this.initializeDefaultHooks();
  }

  private initializeDefaultHooks(): void {
    // Core game hooks
    this.registerHook("game.start");
    this.registerHook("game.end");
    this.registerHook("game.tick");
    this.registerHook("game.pause");
    this.registerHook("game.resume");

    // Entity hooks
    this.registerHook("entity.create");
    this.registerHook("entity.update");
    this.registerHook("entity.delete");
    this.registerHook("entity.move");

    // Player hooks
    this.registerHook("player.join");
    this.registerHook("player.leave");
    this.registerHook("player.action");
    this.registerHook("player.chat");

    // Combat hooks
    this.registerHook("combat.start");
    this.registerHook("combat.end");
    this.registerHook("combat.turn");
    this.registerHook("combat.damage");
    this.registerHook("combat.heal");

    // UI hooks
    this.registerHook("ui.render");
    this.registerHook("ui.click");
    this.registerHook("ui.hover");
  }

  public async loadScript(manifest: ScriptManifest, code: string): Promise<boolean> {
    try {
      // Validate manifest
      if (!this.validateManifest(manifest)) {
        throw new Error(`Invalid manifest for script ${manifest.id}`);
      }

      // Check dependencies
      if (!this.checkDependencies(manifest.dependencies)) {
        throw new Error(`Missing dependencies for script ${manifest.id}`);
      }

      // Create sandbox
      const sandbox = new ScriptSandbox(manifest.id, this.createScriptContext(manifest));
      this.sandboxes.set(manifest.id, sandbox);

      // Create module
      const module: ScriptModule = {
        manifest,
        code,
        isActive: false,
        loadTime: Date.now(),
        executionTime: 0,
        errorCount: 0,
      };

      // Execute script in sandbox
      const startTime = performance.now();
      module.instance = await sandbox.execute(code);
      module.executionTime = performance.now() - startTime;

      this.modules.set(manifest.id, module);
      this.stats.totalScripts++;

      // Register hooks and commands
      this.registerScriptHooks(manifest);
      this.registerScriptCommands(manifest);

      this.logger.info(`Script loaded: ${manifest.name} v${manifest.version}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to load script ${manifest.id}:`, error);
      return false;
    }
  }

  public unloadScript(scriptId: string): boolean {
    const module = this.modules.get(scriptId);
    if (!module) return false;

    try {
      // Deactivate if active
      if (module.isActive) {
        this.deactivateScript(scriptId);
      }

      // Clean up hooks and commands
      this.unregisterScriptHooks(module.manifest);
      this.unregisterScriptCommands(module.manifest);

      // Clean up sandbox
      const sandbox = this.sandboxes.get(scriptId);
      if (sandbox) {
        sandbox.dispose();
        this.sandboxes.delete(scriptId);
      }

      // Remove module
      this.modules.delete(scriptId);
      this.stats.totalScripts--;

      this.logger.info(`Script unloaded: ${module.manifest.name}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to unload script ${scriptId}:`, error);
      return false;
    }
  }

  public activateScript(scriptId: string): boolean {
    const module = this.modules.get(scriptId);
    if (!module || module.isActive) return false;

    try {
      // Call onActivate if it exists
      if (module.instance && typeof module.instance.onActivate === "function") {
        module.instance.onActivate();
      }

      module.isActive = true;
      this.stats.activeScripts++;

      this.logger.info(`Script activated: ${module.manifest.name}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to activate script ${scriptId}:`, error);
      module.errorCount++;
      module.lastError = error instanceof Error ? error : new Error(String(error));
      return false;
    }
  }

  public deactivateScript(scriptId: string): boolean {
    const module = this.modules.get(scriptId);
    if (!module || !module.isActive) return false;

    try {
      // Call onDeactivate if it exists
      if (module.instance && typeof module.instance.onDeactivate === "function") {
        module.instance.onDeactivate();
      }

      module.isActive = false;
      this.stats.activeScripts--;

      this.logger.info(`Script deactivated: ${module.manifest.name}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to deactivate script ${scriptId}:`, error);
      module.errorCount++;
      module.lastError = error instanceof Error ? error : new Error(String(error));
      return false;
    }
  }

  private createScriptContext(manifest: ScriptManifest): ScriptContext {
    const permissions = this.createPermissions(manifest.permissions);

    return {
      gameState: permissions.canAccessGameState ? this.api.getGameState() : Record<string, any>,
      entities: permissions.canModifyEntities ? this.api.getEntities() : new Map(),
      events: this.eventSystem,
      api: this.createRestrictedAPI(permissions),
      storage: this.storage.createNamespace(manifest.id),
      logger: this.logger.createNamespace(manifest.id),
      permissions,
    };
  }

  private createPermissions(requestedPermissions: string[]): ScriptPermissions {
    // This would normally check against user-granted permissions
    // For now, we'll grant based on requested permissions

    return {
      canAccessGameState: requestedPermissions.includes("gamestate.read"),
      canModifyEntities: requestedPermissions.includes("entities.write"),
      canRegisterEvents: requestedPermissions.includes("events.register"),
      canAccessNetwork: requestedPermissions.includes("network.access"),
      canAccessFileSystem: requestedPermissions.includes("fs.access"),
      canExecuteCommands: requestedPermissions.includes("commands.execute"),
      allowedAPIs: requestedPermissions.filter((p) => p.startsWith("api.")),
    };
  }

  private createRestrictedAPI(permissions: ScriptPermissions): GameAPI {
    return new RestrictedGameAPI(this.api, permissions);
  }

  private validateManifest(manifest: ScriptManifest): boolean {
    const required = ["id", "name", "version", "author", "entryPoint"];

    for (const field of required) {
      if (!manifest[field as keyof ScriptManifest]) {
        return false;
      }
    }

    // Validate version format
    if (!/^\d+\.\d+\.\d+$/.test(manifest.version)) {
      return false;
    }

    // Validate ID format
    if (!/^[a-z][a-z0-9_-]*$/.test(manifest.id)) {
      return false;
    }

    return true;
  }

  private checkDependencies(dependencies: string[]): boolean {
    for (const dep of dependencies) {
      if (!this.modules.has(dep)) {
        return false;
      }
    }
    return true;
  }

  private registerScriptHooks(manifest: ScriptManifest): void {
    for (const hookName of manifest.hooks) {
      if (!this.hooks.has(hookName)) {
        this.hooks.set(hookName, []);
      }

      this.hooks.get(hookName)!.push({
        _scriptId: manifest.id,
        _callback: (data: any) => this.executeHook(manifest.id, _hookName, _data),
      });
    }
  }

  private unregisterScriptHooks(manifest: ScriptManifest): void {
    for (const hookName of manifest.hooks) {
      const hooks = this.hooks.get(hookName);
      if (hooks) {
        const filtered = hooks.filter((hook) => hook.scriptId !== manifest.id);
        if (filtered.length === 0) {
          this.hooks.delete(hookName);
        } else {
          this.hooks.set(hookName, filtered);
        }
      }
    }
  }

  private registerScriptCommands(manifest: ScriptManifest): void {
    for (const command of manifest.commands) {
      this.commands.set(command.name, {
        scriptId: manifest.id,
        command,
        handler: (args: string[], _context: any) =>
          this.executeCommand(manifest.id, command.name, args, _context),
      });
    }
  }

  private unregisterScriptCommands(manifest: ScriptManifest): void {
    for (const command of manifest.commands) {
      this.commands.delete(command.name);
    }
  }

  public async executeHook(hookName: string, data: any = {}): Promise<void> {
    const hookList = this.hooks.get(hookName);
    if (!hookList) return;

    for (const hook of hookList) {
      try {
        const startTime = performance.now();

        await this.withTimeout(hook.callback(data), this.executionLimits.maxExecutionTime);

        const executionTime = performance.now() - startTime;
        this.updateExecutionStats(hook.scriptId, executionTime);
      } catch (error) {
        this.handleScriptError(hook.scriptId, error);
      }
    }
  }

  private async executeHook(scriptId: string, hookName: string, data: any): Promise<void> {
    const module = this.modules.get(scriptId);
    if (!module || !module.isActive || !module.instance) return;

    const hookMethod = `on${hookName.charAt(0).toUpperCase() + hookName.slice(1).replace(".", "")}`;

    if (typeof module.instance[hookMethod] === "function") {
      await module.instance[hookMethod](data);
    }
  }

  public async executeCommand(
    commandName: string,
    args: string[],
    context: any = {},
  ): Promise<string> {
    const commandHandler = this.commands.get(commandName);
    if (!commandHandler) {
      throw new Error(`Command not found: ${commandName}`);
    }

    try {
      const startTime = performance.now();

      const result = await this.withTimeout(
        commandHandler.handler(args, context),
        this.executionLimits.maxExecutionTime,
      );

      const executionTime = performance.now() - startTime;
      this.updateExecutionStats(commandHandler.scriptId, executionTime);

      return result || "Command executed successfully";
    } catch (error) {
      this.handleScriptError(commandHandler.scriptId, error);
      throw error;
    }
  }

  private async executeCommand(
    scriptId: string,
    commandName: string,
    args: string[],
    context: any,
  ): Promise<string> {
    const module = this.modules.get(scriptId);
    if (!module || !module.isActive || !module.instance) {
      throw new Error(`Script not active: ${scriptId}`);
    }

    const commandMethod = `command${commandName.charAt(0).toUpperCase() + commandName.slice(1)}`;

    if (typeof module.instance[commandMethod] === "function") {
      return await module.instance[commandMethod](args, context);
    }

    throw new Error(`Command method not found: ${commandMethod}`);
  }

  private registerHook(hookName: string): void {
    if (!this.hooks.has(hookName)) {
      this.hooks.set(hookName, []);
    }
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error("Script execution timeout")), timeoutMs),
      ),
    ]);
  }

  private updateExecutionStats(scriptId: string, executionTime: number): void {
    const module = this.modules.get(scriptId);
    if (module) {
      module.executionTime += executionTime;
    }

    this.stats.totalExecutions++;
    this.stats.averageExecutionTime =
      (this.stats.averageExecutionTime * (this.stats.totalExecutions - 1) + executionTime) /
      this.stats.totalExecutions;
  }

  private handleScriptError(scriptId: string, error: any): void {
    const module = this.modules.get(scriptId);
    if (module) {
      module.errorCount++;
      module.lastError = error instanceof Error ? error : new Error(String(error));

      // Deactivate script if too many errors
      if (module.errorCount >= 10) {
        this.deactivateScript(scriptId);
        this.logger.warn(`Script deactivated due to errors: ${module.manifest.name}`);
      }
    }

    this.stats.totalErrors++;
    this.logger.error(`Script error in ${scriptId}:`, error);
  }

  // Public API methods
  public getLoadedScripts(): ScriptModule[] {
    return Array.from(this.modules.values());
  }

  public getActiveScripts(): ScriptModule[] {
    return Array.from(this.modules.values()).filter((module) => module.isActive);
  }

  public getScript(scriptId: string): ScriptModule | undefined {
    return this.modules.get(scriptId);
  }

  public getAvailableHooks(): string[] {
    return Array.from(this.hooks.keys());
  }

  public getAvailableCommands(): string[] {
    return Array.from(this.commands.keys());
  }

  public getStats() {
    return { ...this.stats };
  }

  public getScriptStats(scriptId: string) {
    const module = this.modules.get(scriptId);
    if (!module) return null;

    return {
      id: module.manifest.id,
      name: module.manifest.name,
      version: module.manifest.version,
      isActive: module.isActive,
      loadTime: module.loadTime,
      executionTime: module.executionTime,
      errorCount: module.errorCount,
      lastError: module.lastError?.message,
    };
  }

  public dispose(): void {
    // Unload all scripts
    for (const scriptId of this.modules.keys()) {
      this.unloadScript(scriptId);
    }

    // Clean up sandboxes
    for (const sandbox of this.sandboxes.values()) {
      sandbox.dispose();
    }

    this.modules.clear();
    this.hooks.clear();
    this.commands.clear();
    this.sandboxes.clear();
  }
}

// Supporting classes
interface ScriptHook {
  scriptId: string;
  callback: (data: any) => Promise<void>;
}

interface ScriptCommandHandler {
  scriptId: string;
  command: ScriptCommand;
  handler: (_args: string[], _context: any) => Promise<string>;
}

export class ScriptEventSystem {
  private listeners = new Map<
    string,
    Array<{ scriptId: string; callback: (...args: any[]) => any }>
  >();

  public on(event: string, callback: (...args: any[]) => any, scriptId: string): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }

    this.listeners.get(event)!.push({ scriptId, callback });
  }

  public off(event: string, scriptId: string): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      const filtered = listeners.filter((listener) => listener.scriptId !== scriptId);
      if (filtered.length === 0) {
        this.listeners.delete(event);
      } else {
        this.listeners.set(event, filtered);
      }
    }
  }

  public emit(event: string, data?: any): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener.callback(data);
        } catch (error) {
          logger.error(`Event listener error in script ${listener.scriptId}:`, error);
        }
      }
    }
  }

  public removeScriptListeners(scriptId: string): void {
    for (const [event, listeners] of this.listeners) {
      const filtered = listeners.filter((listener) => listener.scriptId !== scriptId);
      if (filtered.length === 0) {
        this.listeners.delete(event);
      } else {
        this.listeners.set(event, filtered);
      }
    }
  }
}

export class GameAPI {
  public getGameState(): any {
    // Return current game state
    return {};
  }

  public getEntities(): Map<string, any> {
    // Return current entities
    return new Map();
  }

  public createEntity(_data: any): string {
    // Create new entity
    return "new-entity-id";
  }

  public updateEntity(_id: string, _data: any): boolean {
    // Update entity
    return true;
  }

  public deleteEntity(_id: string): boolean {
    // Delete entity
    return true;
  }

  public sendMessage(_playerId: string, _message: string): void {
    // Send message to player
  }

  public broadcastMessage(_message: string): void {
    // Broadcast message to all players
  }
}

export class RestrictedGameAPI extends GameAPI {
  private permissions: ScriptPermissions;
  private baseAPI: GameAPI;

  constructor(baseAPI: GameAPI, permissions: ScriptPermissions) {
    super();
    this.baseAPI = baseAPI;
    this.permissions = permissions;
  }

  public getGameState(): any {
    if (!this.permissions.canAccessGameState) {
      throw new Error("Permission denied: gamestate.read");
    }
    return this.baseAPI.getGameState();
  }

  public getEntities(): Map<string, any> {
    if (!this.permissions.canModifyEntities) {
      return new Map(); // Return empty map if no permission
    }
    return this.baseAPI.getEntities();
  }

  public createEntity(data: any): string {
    if (!this.permissions.canModifyEntities) {
      throw new Error("Permission denied: entities.write");
    }
    return this.baseAPI.createEntity(data);
  }

  public updateEntity(id: string, data: any): boolean {
    if (!this.permissions.canModifyEntities) {
      throw new Error("Permission denied: entities.write");
    }
    return this.baseAPI.updateEntity(id, data);
  }

  public deleteEntity(id: string): boolean {
    if (!this.permissions.canModifyEntities) {
      throw new Error("Permission denied: entities.write");
    }
    return this.baseAPI.deleteEntity(id);
  }
}

export class ScriptStorage {
  private data = new Map<string, Map<string, any>>();

  public createNamespace(namespace: string): NamespacedStorage {
    if (!this.data.has(namespace)) {
      this.data.set(namespace, new Map());
    }

    return new NamespacedStorage(this.data.get(namespace)!);
  }

  public clearNamespace(namespace: string): void {
    this.data.delete(namespace);
  }
}

export class NamespacedStorage {
  constructor(private storage: Map<string, any>) {}

  public get(key: string): any {
    return this.storage.get(key);
  }

  public set(key: string, value: any): void {
    this.storage.set(key, value);
  }

  public delete(key: string): boolean {
    return this.storage.delete(key);
  }

  public has(key: string): boolean {
    return this.storage.has(key);
  }

  public keys(): string[] {
    return Array.from(this.storage.keys());
  }

  public clear(): void {
    this.storage.clear();
  }
}

export class ScriptLogger {
  private loggers = new Map<string, NamespacedLogger>();

  public createNamespace(namespace: string): NamespacedLogger {
    if (!this.loggers.has(namespace)) {
      this.loggers.set(namespace, new NamespacedLogger(namespace));
    }

    return this.loggers.get(namespace)!;
  }

  public info(message: string, ...args: any[]): void {
    logger.info(`[ScriptEngine] ${message}`, ...args);
  }

  public warn(message: string, ...args: any[]): void {
    logger.warn(`[ScriptEngine] ${message}`, ...args);
  }

  public error(message: string, ...args: any[]): void {
    logger.error(`[ScriptEngine] ${message}`, ...args);
  }
}

export class NamespacedLogger {
  constructor(private namespace: string) {}

  public info(message: string, ...args: any[]): void {
    logger.info(`[${this.namespace}] ${message}`, ...args);
  }

  public warn(message: string, ...args: any[]): void {
    logger.warn(`[${this.namespace}] ${message}`, ...args);
  }

  public error(message: string, ...args: any[]): void {
    logger.error(`[${this.namespace}] ${message}`, ...args);
  }

  public debug(message: string, ...args: any[]): void {
    logger.debug(`[${this.namespace}] ${message}`, ...args);
  }
}

export class ScriptSandbox {
  private scriptId: string;
  private context: ScriptContext;
  private vm: any; // Would use vm2 or similar in Node.js

  constructor(scriptId: string, context: ScriptContext) {
    this.scriptId = scriptId;
    this.context = context;
    this.setupSandbox();
  }

  private setupSandbox(): void {
    // In a real implementation, this would set up a proper sandbox
    // For now, we'll just store the context
  }

  public async execute(code: string): Promise<any> {
    // In a real implementation, this would execute code in a sandbox
    // For now, we'll use a simple eval with try/catch

    try {
      const func = new Function(
        "context",
        `
        const { _gameState, _entities,  _events, _api,  _storage, _logger,  _permissions  } = context;
        ${code}
        return typeof exports !== 'undefined' ? exports : Record<string, any>;
      `,
      );

      return func(this.context);
    } catch (error) {
      throw new Error(`Script execution failed: ${error}`);
    }
  }

  public dispose(): void {
    // Clean up sandbox resources
  }
}
