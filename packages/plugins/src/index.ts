/**
 * Plugins can extend the virtual tabletop by registering UI panels,
 * systems, or new token sheets. This package defines a very simple
 * interface and a registry for demonstration purposes.
 */

export interface Plugin {
  id: string;
  name: string;
  init(): void;
}

const registry: Plugin[] = [];

export function register(plugin: Plugin): void {
  registry.push(plugin);
  plugin.init();
}

export function list(): Plugin[] {
  return [...registry];
}