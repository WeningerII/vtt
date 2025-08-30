import { logger } from '@vtt/logging';

/**
 * Visual Scripting System - Triple A Quality Node-Based Automation
 * Advanced visual scripting that exceeds Unreal Blueprint capabilities for VTTs
 */

export interface ScriptNode {
  id: string;
  type: string;
  name: string;
  category: NodeCategory;
  position: [number, number];
  inputs: NodeInput[];
  outputs: NodeOutput[];
  properties: Record<string, any>;
  breakpoint?: boolean;
  disabled?: boolean;
  comment?: string;
  color?: string;
}

export type NodeCategory = 
  | 'event' | 'action' | 'condition' | 'math' | 'logic' | 'data' | 'flow' 
  | 'game' | 'character' | 'combat' | 'dice' | 'ui' | 'audio' | 'animation' | 'custom';

export interface NodeInput {
  id: string;
  name: string;
  type: DataType;
  required: boolean;
  defaultValue?: any;
  connected?: Connection;
  description?: string;
}

export interface NodeOutput {
  id: string;
  name: string;
  type: DataType;
  description?: string;
}

export type DataType = 
  | 'exec' | 'boolean' | 'number' | 'string' | 'vector' | 'object' 
  | 'character' | 'item' | 'spell' | 'dice' | 'array' | 'any';

export interface Connection {
  nodeId: string;
  outputId: string;
  inputId: string;
}

export interface VisualScript {
  id: string;
  name: string;
  description: string;
  category: string;
  nodes: ScriptNode[];
  connections: Connection[];
  variables: ScriptVariable[];
  functions: ScriptFunction[];
  events: ScriptEvent[];
  version: number;
  author: string;
  created: Date;
  modified: Date;
  tags: string[];
}

export interface ScriptVariable {
  id: string;
  name: string;
  type: DataType;
  defaultValue: any;
  scope: 'local' | 'global' | 'persistent';
  description?: string;
}

export interface ScriptFunction {
  id: string;
  name: string;
  inputs: FunctionParameter[];
  outputs: FunctionParameter[];
  nodes: ScriptNode[];
  connections: Connection[];
  description?: string;
}

export interface FunctionParameter {
  name: string;
  type: DataType;
  defaultValue?: any;
  description?: string;
}

export interface ScriptEvent {
  id: string;
  name: string;
  trigger: EventTrigger;
  parameters: EventParameter[];
  description?: string;
}

export interface EventTrigger {
  type: 'game_event' | 'user_input' | 'timer' | 'condition' | 'custom';
  event: string;
  conditions?: string[];
}

export interface EventParameter {
  name: string;
  type: DataType;
  description?: string;
}

export interface ExecutionContext {
  scriptId: string;
  variables: Map<string, any>;
  callStack: ExecutionFrame[];
  currentNode: string | null;
  breakpoints: Set<string>;
  debugging: boolean;
  performance: PerformanceMetrics;
}

export interface ExecutionFrame {
  nodeId: string;
  functionId?: string;
  timestamp: number;
  variables: Map<string, any>;
}

export interface PerformanceMetrics {
  executionTime: number;
  nodeExecutions: number;
  memoryUsage: number;
  averageFrameTime: number;
}

export interface NodeDefinition {
  type: string;
  name: string;
  category: NodeCategory;
  description: string;
  inputs: InputDefinition[];
  outputs: OutputDefinition[];
  properties: PropertyDefinition[];
  icon?: string;
  color?: string;
  executor: NodeExecutor;
  validator?: NodeValidator;
}

export interface InputDefinition {
  id: string;
  name: string;
  type: DataType;
  required: boolean;
  defaultValue?: any;
  description?: string;
  validation?: InputValidation;
}

export interface OutputDefinition {
  id: string;
  name: string;
  type: DataType;
  description?: string;
}

export interface PropertyDefinition {
  id: string;
  name: string;
  type: 'string' | 'number' | 'boolean' | 'enum' | 'color' | 'vector';
  defaultValue: any;
  options?: any[];
  description?: string;
}

export interface InputValidation {
  min?: number;
  max?: number;
  pattern?: string;
  options?: any[];
}

export type NodeExecutor = (inputs: Record<string, any>, properties: Record<string, any>, context: ExecutionContext) => Promise<Record<string, any>>;
export type NodeValidator = (properties: Record<string, any>) => ValidationResult;

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface DebugInfo {
  currentNode: string | null;
  executionPath: string[];
  variableStates: Record<string, any>;
  callStack: ExecutionFrame[];
  breakpointHit: boolean;
  performance: PerformanceMetrics;
}

export class VisualScriptingEngine {
  private scripts: Map<string, VisualScript> = new Map();
  private nodeDefinitions: Map<string, NodeDefinition> = new Map();
  private executionContexts: Map<string, ExecutionContext> = new Map();
  private eventListeners: Map<string, ScriptEventHandler[]> = new Map();
  
  // Runtime execution
  private scheduler: ExecutionScheduler;
  private debugger: ScriptDebugger;
  private profiler: ScriptProfiler;
  
  // Node registry
  private nodeRegistry: NodeRegistry;
  private customNodes: Map<string, NodeDefinition> = new Map();
  
  // Compilation and optimization
  private compiler: ScriptCompiler;
  private optimizer: ScriptOptimizer;
  
  // Integration with game systems
  private gameIntegration: GameSystemIntegration;
  
  // Statistics
  private stats = {
    scriptsExecuted: 0,
    nodesExecuted: 0,
    averageExecutionTime: 0,
    memoryUsage: 0,
    compilationTime: 0,
  };

  constructor() {
    this.scheduler = new ExecutionScheduler();
    this.debugger = new ScriptDebugger();
    this.profiler = new ScriptProfiler();
    this.nodeRegistry = new NodeRegistry();
    this.compiler = new ScriptCompiler();
    this.optimizer = new ScriptOptimizer();
    this.gameIntegration = new GameSystemIntegration();
    
    this.registerBuiltinNodes();
  }

  private registerBuiltinNodes(): void {
    // Event nodes
    this.registerNode({
      type: 'event_start',
      name: 'Start',
      category: 'event',
      description: 'Script execution starts here',
      inputs: [],
      outputs: [{ id: 'exec', name: 'Execute', type: 'exec' }],
      properties: [],
      executor: async () => ({ exec: true }),
    });

    // Flow control nodes
    this.registerNode({
      type: 'flow_branch',
      name: 'Branch',
      category: 'flow',
      description: 'Conditional execution flow',
      inputs: [
        { id: 'exec', name: 'Execute', type: 'exec', required: true },
        { id: 'condition', name: 'Condition', type: 'boolean', required: true },
      ],
      outputs: [
        { id: 'true', name: 'True', type: 'exec' },
        { id: 'false', name: 'False', type: 'exec' },
      ],
      properties: [],
      executor: async (inputs: any) => ({
        true: inputs.condition,
        false: !inputs.condition,
      }),
    });

    // Math nodes
    this.registerNode({
      type: 'math_add',
      name: 'Add',
      category: 'math',
      description: 'Add two numbers',
      inputs: [
        { id: 'a', name: 'A', type: 'number', required: true, defaultValue: 0 },
        { id: 'b', name: 'B', type: 'number', required: true, defaultValue: 0 },
      ],
      outputs: [{ id: 'result', name: 'Result', type: 'number' }],
      properties: [],
      executor: async (inputs: any) => ({ result: inputs.a + inputs.b }),
    });

    // Game-specific nodes
    this.registerNode({
      type: 'dice_roll',
      name: 'Roll Dice',
      category: 'dice',
      description: 'Roll dice with specified formula',
      inputs: [
        { id: 'exec', name: 'Execute', type: 'exec', required: true },
        { id: 'formula', name: 'Formula', type: 'string', required: true, defaultValue: '1d20' },
      ],
      outputs: [
        { id: 'exec', name: 'Execute', type: 'exec' },
        { id: 'result', name: 'Result', type: 'number' },
        { id: 'rolls', name: 'Individual Rolls', type: 'array' },
      ],
      properties: [],
      executor: async (inputs: any) => {
        const result = this.rollDice(inputs.formula);
        return {
          exec: true,
          result: result.total,
          rolls: result.rolls,
        };
      },
    });

    // Character interaction nodes
    this.registerNode({
      type: 'character_get_stat',
      name: 'Get Character Stat',
      category: 'character',
      description: 'Get a character attribute or stat',
      inputs: [
        { id: 'character', name: 'Character', type: 'character', required: true },
        { id: 'stat', name: 'Stat Name', type: 'string', required: true },
      ],
      outputs: [{ id: 'value', name: 'Value', type: 'any' }],
      properties: [],
      executor: async (inputs: any) => {
        const value = this.gameIntegration.getCharacterStat(inputs.character, inputs.stat);
        return { value };
      },
    });
  }

  registerNode(definition: NodeDefinition): void {
    this.nodeDefinitions.set(definition.type, definition);
    this.nodeRegistry.register(definition);
  }

  registerCustomNode(definition: NodeDefinition): void {
    this.customNodes.set(definition.type, definition);
    this.registerNode(definition);
  }

  createScript(name: string, description?: string): VisualScript {
    const script: VisualScript = {
      id: this.generateId(),
      name,
      description: description || '',
      category: 'general',
      nodes: [],
      connections: [],
      variables: [],
      functions: [],
      events: [],
      version: 1,
      author: 'User',
      created: new Date(),
      modified: new Date(),
      tags: [],
    };

    this.scripts.set(script.id, script);
    return script;
  }

  addNode(scriptId: string, nodeType: string, position: [number, number]): ScriptNode {
    const script = this.scripts.get(scriptId);
    const definition = this.nodeDefinitions.get(nodeType);
    
    if (!script || !definition) {
      throw new Error(`Script or node type not found`);
    }

    const node: ScriptNode = {
      id: this.generateId(),
      type: nodeType,
      name: definition.name,
      category: definition.category,
      position,
      inputs: definition.inputs.map(input => ({
        id: input.id,
        name: input.name,
        type: input.type,
        required: input.required,
        defaultValue: input.defaultValue,
        description: input.description,
      })),
      outputs: definition.outputs.map(output => ({
        id: output.id,
        name: output.name,
        type: output.type,
        description: output.description,
      })),
      properties: this.initializeProperties(definition.properties),
    };

    script.nodes.push(node);
    script.modified = new Date();
    
    return node;
  }

  private initializeProperties(definitions: PropertyDefinition[]): Record<string, any> {
    const properties: Record<string, any> = {};
    
    definitions.forEach(def => {
      properties[def.id] = def.defaultValue;
    });
    
    return properties;
  }

  connectNodes(scriptId: string, fromNodeId: string, outputId: string, toNodeId: string, inputId: string): void {
    const script = this.scripts.get(scriptId);
    if (!script) throw new Error('Script not found');

    const connection: Connection = {
      nodeId: fromNodeId,
      outputId,
      inputId,
    };

    // Update input connection
    const toNode = script.nodes.find(n => n.id === toNodeId);
    if (toNode) {
      const input = toNode.inputs.find(i => i.id === inputId);
      if (input) {
        input.connected = connection;
      }
    }

    script.connections.push(connection);
    script.modified = new Date();
  }

  async executeScript(scriptId: string, eventData?: any): Promise<ExecutionResult> {
    const startTime = performance.now();
    const script = this.scripts.get(scriptId);
    
    if (!script) {
      throw new Error(`Script ${scriptId} not found`);
    }

    // Compile script if needed
    const _compiledScript = await this.compiler.compile(script);
    
    // Create execution context
    const context: ExecutionContext = {
      scriptId,
      variables: new Map(),
      callStack: [],
      currentNode: null,
      breakpoints: new Set(),
      debugging: false,
      performance: {
        executionTime: 0,
        nodeExecutions: 0,
        memoryUsage: 0,
        averageFrameTime: 0,
      },
    };

    this.executionContexts.set(scriptId, context);

    try {
      // Find entry point (Start node)
      const startNode = script.nodes.find(node => node.type === 'event_start');
      if (!startNode) {
        throw new Error('No start node found in script');
      }

      // Execute from start node
      const result = await this.executeNode(startNode, {}, context, script);
      
      // Update statistics
      const executionTime = performance.now() - startTime;
      this.stats.scriptsExecuted++;
      this.stats.averageExecutionTime = (this.stats.averageExecutionTime + executionTime) / 2;
      context.performance.executionTime = executionTime;

      return {
        success: true,
        result,
        context,
        executionTime,
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message,
        context,
        executionTime: performance.now() - startTime,
      };
    } finally {
      this.executionContexts.delete(scriptId);
    }
  }

  private async executeNode(node: ScriptNode, inputs: Record<string, any>, context: ExecutionContext, script: VisualScript): Promise<any> {
    context.currentNode = node.id;
    context.performance.nodeExecutions++;
    this.stats.nodesExecuted++;

    // Check breakpoint
    if (node.breakpoint && context.debugging) {
      await this.debugger.handleBreakpoint(node, context);
    }

    // Skip disabled nodes
    if (node.disabled) {
      return null;
    }

    // Get node definition
    const definition = this.nodeDefinitions.get(node.type);
    if (!definition) {
      throw new Error(`Node type ${node.type} not found`);
    }

    // Prepare input values
    const nodeInputs = await this.prepareInputs(node, inputs, context, script);

    // Execute node
    const outputs = await definition.executor(nodeInputs, node.properties, context);

    // Execute connected output nodes
    const results: Record<string, any> = {};
    
    for (const [outputId, value] of Object.entries(outputs)) {
      if (value === true && outputId === 'exec') {
        // Find connected execution nodes
        const connectedNodes = this.findConnectedNodes(script, node.id, outputId);
        
        for (const connectedNode of connectedNodes) {
          const connectedResult = await this.executeNode(connectedNode, outputs, context, script);
          Object.assign(results, connectedResult);
        }
      } else {
        results[outputId] = value;
      }
    }

    return results;
  }

  private async prepareInputs(node: ScriptNode, executionInputs: Record<string, any>, context: ExecutionContext, script: VisualScript): Promise<Record<string, any>> {
    const inputs: Record<string, any> = {};

    for (const input of node.inputs) {
      if (input.connected) {
        // Get value from connected output
        const sourceNode = script.nodes.find(n => n.id === input.connected!.nodeId);
        if (sourceNode) {
          // This would normally involve recursive execution or cached values
          inputs[input.id] = executionInputs[input.connected.outputId];
        }
      } else {
        // Use default value
        inputs[input.id] = input.defaultValue;
      }
    }

    return inputs;
  }

  private findConnectedNodes(script: VisualScript, nodeId: string, outputId: string): ScriptNode[] {
    const connected: ScriptNode[] = [];
    
    for (const connection of script.connections) {
      if (connection.nodeId === nodeId && connection.outputId === outputId) {
        const targetNode = script.nodes.find(n => 
          n.inputs.some(input => input.id === connection.inputId && input.connected?.nodeId === nodeId)
        );
        
        if (targetNode) {
          connected.push(targetNode);
        }
      }
    }
    
    return connected;
  }

  // Event system
  addEventListener(eventType: string, handler: ScriptEventHandler): void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, []);
    }
    this.eventListeners.get(eventType)!.push(handler);
  }

  triggerEvent(eventType: string, data: any): void {
    const handlers = this.eventListeners.get(eventType) || [];
    handlers.forEach(handler => {
      try {
        handler(data);
      } catch (error) {
        logger.error(`Event handler error:`, error);
      }
    });
  }

  // Debugging support
  enableDebugging(scriptId: string): void {
    const context = this.executionContexts.get(scriptId);
    if (context) {
      context.debugging = true;
    }
  }

  setBreakpoint(scriptId: string, nodeId: string): void {
    const script = this.scripts.get(scriptId);
    if (script) {
      const node = script.nodes.find(n => n.id === nodeId);
      if (node) {
        node.breakpoint = true;
      }
    }
  }

  getDebugInfo(scriptId: string): DebugInfo | null {
    const context = this.executionContexts.get(scriptId);
    if (!context) return null;

    return {
      currentNode: context.currentNode,
      executionPath: context.callStack.map(frame => frame.nodeId),
      variableStates: Object.fromEntries(context.variables),
      callStack: [...context.callStack],
      breakpointHit: false,
      performance: { ...context.performance },
    };
  }

  // Utility methods
  private rollDice(formula: string): { total: number; rolls: number[] } {
    // Simple dice rolling implementation
    const match = formula.match(/(\d+)d(\d+)(?:\+(\d+))?/);
    if (!match) return { total: 0, rolls: [] };

    const count = parseInt(match[1]);
    const sides = parseInt(match[2]);
    const modifier = parseInt(match[3] || '0');

    const rolls: number[] = [];
    let total = modifier;

    for (let i = 0; i < count; i++) {
      const roll = Math.floor(Math.random() * sides) + 1;
      rolls.push(roll);
      total += roll;
    }

    return { total, rolls };
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 15);
  }

  getStats() {
    return { ...this.stats };
  }

  getScript(scriptId: string): VisualScript | null {
    return this.scripts.get(scriptId) || null;
  }

  getAllScripts(): VisualScript[] {
    return Array.from(this.scripts.values());
  }

  validateScript(scriptId: string): ValidationResult {
    const script = this.scripts.get(scriptId);
    if (!script) {
      return { valid: false, errors: ['Script not found'], warnings: [] };
    }

    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for start node
    const hasStartNode = script.nodes.some(node => node.type === 'event_start');
    if (!hasStartNode) {
      errors.push('Script must have a Start node');
    }

    // Check for disconnected nodes
    script.nodes.forEach(node => {
      const hasIncomingConnection = script.connections.some(conn => 
        node.inputs.some(input => input.connected?.nodeId === conn.nodeId)
      );
      
      if (!hasIncomingConnection && node.type !== 'event_start') {
        warnings.push(`Node ${node.name} has no incoming connections`);
      }
    });

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  destroy(): void {
    this.scripts.clear();
    this.nodeDefinitions.clear();
    this.executionContexts.clear();
    this.eventListeners.clear();
    this.customNodes.clear();
  }
}

// Supporting interfaces and classes
interface ExecutionResult {
  success: boolean;
  result?: any;
  error?: string;
  context: ExecutionContext;
  executionTime: number;
}

type ScriptEventHandler = (_data: any) => void;

// Helper classes (simplified implementations)
class ExecutionScheduler {}
class ScriptDebugger { 
  async handleBreakpoint(_node: ScriptNode, _context: ExecutionContext): Promise<void> {}
}
class ScriptProfiler {}
class NodeRegistry { register(_definition: NodeDefinition): void {} }
class ScriptCompiler { async compile(script: VisualScript): Promise<any> { return script; } }
class ScriptOptimizer {}
class GameSystemIntegration { 
  getCharacterStat(_character: any, _stat: string): any { return 0; }
}
