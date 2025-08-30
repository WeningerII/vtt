/**
 * Unified Component Factory - Creates and manages components across UI and game systems
 * Consolidates component creation between UI framework and content creation systems
 */

import { EventEmitter, SystemEvents } from "./EventEmitter";
import { logger } from "@vtt/logging";
import {
  Component,
  ComponentType,
  ComponentProperties,
  ComponentFactory as IComponentFactory,
  ComponentConstructor,
  Disposable,
} from "./SharedInterfaces";

export interface ComponentDefinition {
  type: ComponentType;
  name: string;
  description: string;
  category: string;
  defaultProperties: ComponentProperties;
  requiredProperties: string[];
  constructor: ComponentConstructor;
  template?: string;
  styles?: string;
  dependencies: string[];
  version: string;
}

export interface ComponentRegistry {
  [type: string]: ComponentDefinition;
}

export class BaseComponent implements Component {
  public readonly id: string;
  public name: string;
  public type: ComponentType;
  public properties: ComponentProperties;
  public children: Component[] = [];
  public parent: Component | undefined;

  protected eventListeners = new Map<string, Set<EventListener>>();
  protected initialized = false;
  protected destroyed = false;

  constructor(properties: ComponentProperties = {}) {
    this.id = this.generateId();
    this.type = (properties as any).type || "base";
    this.name = properties.name || `${this.type}_${this.id}`;
    this.properties = { ...properties };
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Initialize children
    for (const child of this.children) {
      await child.initialize();
    }

    this.initialized = true;
  }

  update(deltaTime: number): void {
    if (!this.initialized || this.destroyed) return;

    // Update children
    for (const child of this.children) {
      child.update(deltaTime);
    }
  }

  render(): void {
    if (!this.initialized || this.destroyed) return;

    // Render children
    for (const child of this.children) {
      child.render();
    }
  }

  destroy(): void {
    if (this.destroyed) return;

    // Destroy children
    for (const child of this.children) {
      child.destroy();
    }
    this.children = [];

    // Remove from parent
    if (this.parent) {
      const index = this.parent.children.indexOf(this);
      if (index >= 0) {
        this.parent.children.splice(index, 1);
      }
    }

    // Clear event listeners
    this.eventListeners.clear();

    this.destroyed = true;
  }

  addEventListener(event: string, handler: EventListener): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(handler);
  }

  removeEventListener(event: string, handler: EventListener): void {
    const handlers = this.eventListeners.get(event);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.eventListeners.delete(event);
      }
    }
  }

  emit(event: string, data?: any): void {
    const handlers = this.eventListeners.get(event);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(data);
        } catch (error) {
          logger.error(`Error in event handler for ${event}:`, error);
        }
      }
    }
  }

  addChild(child: Component): void {
    if (child.parent) {
      const index = child.parent.children.indexOf(child);
      if (index >= 0) {
        child.parent.children.splice(index, 1);
      }
    }

    child.parent = this;
    this.children.push(child);
  }

  removeChild(child: Component): void {
    const index = this.children.indexOf(child);
    if (index >= 0) {
      this.children.splice(index, 1);
      child.parent = undefined as Component | undefined;
    }
  }

  findChild(id: string): Component | null {
    for (const child of this.children) {
      if (child.id === id) return child;

      const found = child.findChild(id);
      if (found) return found;
    }
    return null;
  }

  findChildByType(type: ComponentType): Component | null {
    for (const child of this.children) {
      if (child.type === type) return child;

      const found = child.findChildByType(type);
      if (found) return found;
    }
    return null;
  }

  private generateId(): string {
    return `comp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export class UnifiedComponentFactory
  extends EventEmitter<SystemEvents>
  implements IComponentFactory, Disposable
{
  private registry: ComponentRegistry = {};
  private instances = new Map<string, Component>();
  private templates = new Map<string, string>();
  private styles = new Map<string, string>();

  constructor() {
    super();
    this.registerBuiltInComponents();
  }

  /**
   * Create a new component instance
   */
  create(type: ComponentType, properties?: ComponentProperties): Component {
    const definition = this.registry[type];
    if (!definition) {
      throw new Error(`Component type '${type}' is not registered`);
    }

    // Validate required properties
    const mergedProperties = { ...definition.defaultProperties, ...properties };
    for (const required of definition.requiredProperties) {
      if (!(required in mergedProperties)) {
        throw new Error(`Required property '${required}' missing for component type '${type}'`);
      }
    }

    // Create instance
    const component = new definition.constructor(mergedProperties);
    this.instances.set(component.id, component);

    this.emit("ready", undefined);
    return component;
  }

  /**
   * Register a new component type
   */
  register(type: ComponentType, constructor: ComponentConstructor): void {
    const definition: ComponentDefinition = {
      type,
      name: type,
      description: `Component of type ${type}`,
      category: "custom",
      defaultProperties: Record<string, any>,
      requiredProperties: [],
      constructor,
      dependencies: [],
      version: "1.0.0",
    };

    this.registry[type] = definition;
  }

  /**
   * Register a component with full definition
   */
  registerDefinition(definition: ComponentDefinition): void {
    this.registry[definition.type] = definition;

    if (definition.template) {
      this.templates.set(definition.type, definition.template);
    }

    if (definition.styles) {
      this.styles.set(definition.type, definition.styles);
    }
  }

  /**
   * Get all available component types
   */
  getAvailableTypes(): ComponentType[] {
    return Object.keys(this.registry) as ComponentType[];
  }

  /**
   * Get component definition
   */
  getDefinition(type: ComponentType): ComponentDefinition | undefined {
    return this.registry[type];
  }

  /**
   * Get component by ID
   */
  getInstance(id: string): Component | null {
    return this.instances.get(id) || null;
  }

  /**
   * Create component from template
   */
  createFromTemplate(templateId: string, properties?: ComponentProperties): Component {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template '${templateId}' not found`);
    }

    // Parse template and create component
    const templateData = JSON.parse(template);
    return this.create(templateData.type, { ...templateData.properties, ...properties });
  }

  /**
   * Clone an existing component
   */
  clone(component: Component, deep: boolean = false): Component {
    const cloned = this.create(component.type, { ...component.properties });
    cloned.name = `${component.name}_clone`;

    if (deep) {
      for (const child of component.children) {
        const clonedChild = this.clone(child, true);
        cloned.addChild(clonedChild);
      }
    }

    return cloned;
  }

  /**
   * Destroy a component and clean up
   */
  destroyComponent(component: Component): void {
    component.destroy();
    this.instances.delete(component.id);
  }

  /**
   * Get components by type
   */
  getComponentsByType(type: ComponentType): Component[] {
    return Array.from(this.instances.values()).filter((comp) => comp.type === type);
  }

  /**
   * Get component statistics
   */
  getStats(): { totalComponents: number; byType: Record<string, number> } {
    const byType: Record<string, number> = {};

    for (const component of this.instances.values()) {
      byType[component.type] = (byType[component.type] || 0) + 1;
    }

    return {
      totalComponents: this.instances.size,
      byType,
    };
  }

  /**
   * Dispose of the factory
   */
  dispose(): void {
    // Destroy all instances
    for (const component of this.instances.values()) {
      component.destroy();
    }

    this.instances.clear();
    this.registry = {};
    this.templates.clear();
    this.styles.clear();
    this.removeAllListeners();
  }

  // Private helper methods

  private registerBuiltInComponents(): void {
    // UI Components
    this.registerDefinition({
      type: "ui_element",
      name: "UI Element",
      description: "Base UI element component",
      category: "ui",
      defaultProperties: {
        visible: true,
        enabled: true,
        style: Record<string, any>,
      },
      requiredProperties: [],
      constructor: BaseComponent,
      dependencies: [],
      version: "1.0.0",
    });

    this.registerDefinition({
      type: "panel",
      name: "Panel",
      description: "Container panel for other UI elements",
      category: "ui",
      defaultProperties: {
        visible: true,
        enabled: true,
        style: {
          backgroundColor: "#f0f0f0",
          borderWidth: 1,
          borderColor: "#ccc",
        },
      },
      requiredProperties: [],
      constructor: BaseComponent,
      dependencies: [],
      version: "1.0.0",
    });

    this.registerDefinition({
      type: "dialog",
      name: "Dialog",
      description: "Modal dialog component",
      category: "ui",
      defaultProperties: {
        visible: false,
        enabled: true,
        modal: true,
        style: {
          position: "fixed",
          zIndex: 1000,
        },
      },
      requiredProperties: ["title"],
      constructor: BaseComponent,
      dependencies: [],
      version: "1.0.0",
    });

    // Game Object Components
    this.registerDefinition({
      type: "game_object",
      name: "Game Object",
      description: "Base game object component",
      category: "game",
      defaultProperties: {
        transform: {
          position: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          scale: { x: 1, y: 1, z: 1 },
        },
        visible: true,
        enabled: true,
      },
      requiredProperties: [],
      constructor: BaseComponent,
      dependencies: [],
      version: "1.0.0",
    });

    // Layout Components
    this.registerDefinition({
      type: "layout",
      name: "Layout",
      description: "Layout container for arranging child components",
      category: "layout",
      defaultProperties: {
        direction: "row",
        spacing: 0,
        alignment: "start",
      },
      requiredProperties: [],
      constructor: BaseComponent,
      dependencies: [],
      version: "1.0.0",
    });

    // Widget Components
    this.registerDefinition({
      type: "widget",
      name: "Widget",
      description: "Interactive widget component",
      category: "widget",
      defaultProperties: {
        interactive: true,
        focusable: true,
      },
      requiredProperties: [],
      constructor: BaseComponent,
      dependencies: [],
      version: "1.0.0",
    });

    // Control Components
    this.registerDefinition({
      type: "control",
      name: "Control",
      description: "User input control component",
      category: "control",
      defaultProperties: {
        enabled: true,
        value: null,
      },
      requiredProperties: [],
      constructor: BaseComponent,
      dependencies: [],
      version: "1.0.0",
    });

    // System Components
    this.registerDefinition({
      type: "system",
      name: "System",
      description: "System component for game logic",
      category: "system",
      defaultProperties: {
        enabled: true,
        priority: 0,
      },
      requiredProperties: [],
      constructor: BaseComponent,
      dependencies: [],
      version: "1.0.0",
    });

    // Behavior Components
    this.registerDefinition({
      type: "behavior",
      name: "Behavior",
      description: "Behavior component for entity logic",
      category: "behavior",
      defaultProperties: {
        enabled: true,
      },
      requiredProperties: [],
      constructor: BaseComponent,
      dependencies: [],
      version: "1.0.0",
    });

    // Effect Components
    this.registerDefinition({
      type: "effect",
      name: "Effect",
      description: "Visual or audio effect component",
      category: "effect",
      defaultProperties: {
        duration: 1000,
        loop: false,
        autoPlay: true,
      },
      requiredProperties: [],
      constructor: BaseComponent,
      dependencies: [],
      version: "1.0.0",
    });
  }
}

// Export singleton instance
export const _componentFactory = new UnifiedComponentFactory();
