/**
 * Plugins can extend the virtual tabletop by registering UI panels,
 * systems, or new token sheets. This package defines a very simple
 * interface and a registry for demonstration purposes.
 */
const registry = [];
export function register(plugin) {
    registry.push(plugin);
    plugin.init();
}
export function list() {
    return [...registry];
}
//# sourceMappingURL=index.js.map