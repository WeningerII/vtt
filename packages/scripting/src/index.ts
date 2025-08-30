// Scripting Engine exports
export { ScriptingEngine } from "./ScriptingEngine";
export type {
  ScriptContext,
  ScriptManifest,
  ScriptModule,
  ScriptPermissions,
  ScriptCommand,
} from "./ScriptingEngine";

export {
  ScriptEventSystem,
  GameAPI,
  RestrictedGameAPI,
  ScriptStorage,
  NamespacedStorage,
  ScriptLogger,
  NamespacedLogger,
  ScriptSandbox,
} from "./ScriptingEngine";

// Modding Framework exports
export { ModdingFramework } from "./ModdingFramework";
export type {
  ModManifest,
  ModDependency,
  ModAsset,
  ModHook,
  ModConfig,
  ModInstance,
  ModLoadResult,
} from "./ModdingFramework";

// Utility functions for creating common script and mod configurations
export function createBasicScriptManifest(
  _id: string,
  _name: string,
  _version: string = "1.0.0",
): Partial<ScriptManifest> {
  return {
    id,
    name,
    version,
    author: "Unknown",
    description: `Script: ${name}`,
    dependencies: [],
    permissions: ["gamestate.read"],
    entryPoint: "main.js",
    files: ["main.js"],
    hooks: [],
    commands: [],
  };
}

export function createBasicModManifest(
  _id: string,
  _name: string,
  _version: string = "1.0.0",
  _gameVersion: string = "1.0.0",
): Partial<ModManifest> {
  return {
    id,
    name,
    version,
    author: "Unknown",
    description: `Mod: ${name}`,
    gameVersion,
    dependencies: [],
    conflicts: [],
    assets: [],
    scripts: [],
    hooks: [],
    config: [],
  };
}
