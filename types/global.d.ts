// Global type definitions for VTT project

declare module '*.svg' {
  const content: string;
  export default content;
}

declare module '*.png' {
  const content: string;
  export default content;
}

declare module '*.jpg' {
  const content: string;
  export default content;
}

declare module '*.wgsl' {
  const content: string;
  export default content;
}

// WebGPU types (if not using @webgpu/types)
interface GPUCanvasContext {
  configure(configuration: GPUCanvasConfiguration): void;
  unconfigure(): void;
  getCurrentTexture(): GPUTexture;
}

// Extend Window for any custom properties
interface Window {
  vtt?: {
    version: string;
    debug: boolean;
  };
}

// Common VTT types
type UUID = string;
type EntityID = string;
type Timestamp = number;

interface Position {
  x: number;
  y: number;
  z?: number;
}

interface Dimensions {
  width: number;
  height: number;
  depth?: number;
}

interface Transform {
  position: Position;
  rotation?: number;
  scale?: number;
}
