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
export declare function register(plugin: Plugin): void;
export declare function list(): Plugin[];
//# sourceMappingURL=index.d.ts.map