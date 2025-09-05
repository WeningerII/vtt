// GPUBufferUsage and GPUTextureUsage are available as browser globals
import { ShaderManager, ShaderModule, ShadowShaderModule } from "./ShaderManager";
import { logger } from "@vtt/logging";

export interface RenderPipeline {
  pipeline: GPURenderPipeline;
  bindGroupLayouts: GPUBindGroupLayout[];
}

export interface ShadowPipeline {
  pipeline: GPURenderPipeline;
  bindGroupLayouts: GPUBindGroupLayout[];
}

export class PipelineManager {
  private device: GPUDevice;
  private shaderManager: ShaderManager;
  private mainPipeline: RenderPipeline | null = null;
  private shadowPipeline: ShadowPipeline | null = null;

  constructor(device: GPUDevice) {
    this.device = device;
    this.shaderManager = new ShaderManager(device);
  }

  async initialize(): Promise<void> {
    await this.createMainPipeline();
    await this.createShadowPipeline();
    logger.info("Pipeline manager initialized");
  }

  private async createMainPipeline(): Promise<void> {
    const shaders = await this.shaderManager.loadMainShaders();

    // Create bind group layouts
    const cameraBindGroupLayout = this.device.createBindGroupLayout({
      label: "Camera Bind Group Layout",
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: { type: "uniform" },
        },
      ],
    });

    const modelBindGroupLayout = this.device.createBindGroupLayout({
      label: "Model Bind Group Layout",
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX,
          buffer: { type: "uniform" },
        },
      ],
    });

    const lightBindGroupLayout = this.device.createBindGroupLayout({
      label: "Light Bind Group Layout",
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: { type: "uniform" },
        },
      ],
    });

    const materialBindGroupLayout = this.device.createBindGroupLayout({
      label: "Material Bind Group Layout",
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.FRAGMENT,
          buffer: { type: "uniform" },
        },
        {
          binding: 1,
          visibility: GPUShaderStage.FRAGMENT,
          texture: { sampleType: "float" },
        },
        {
          binding: 2,
          visibility: GPUShaderStage.FRAGMENT,
          texture: { sampleType: "float" },
        },
        {
          binding: 3,
          visibility: GPUShaderStage.FRAGMENT,
          texture: { sampleType: "float" },
        },
        {
          binding: 4,
          visibility: GPUShaderStage.FRAGMENT,
          texture: { sampleType: "float" },
        },
        {
          binding: 5,
          visibility: GPUShaderStage.FRAGMENT,
          texture: { sampleType: "depth" },
        },
        {
          binding: 6,
          visibility: GPUShaderStage.FRAGMENT,
          sampler: {},
        },
        {
          binding: 7,
          visibility: GPUShaderStage.FRAGMENT,
          sampler: { type: "comparison" },
        },
      ],
    });

    const pipelineLayout = this.device.createPipelineLayout({
      label: "Main Pipeline Layout",
      bindGroupLayouts: [
        cameraBindGroupLayout,
        modelBindGroupLayout,
        lightBindGroupLayout,
        materialBindGroupLayout,
      ],
    });

    // Vertex buffer layout
    const vertexBufferLayout: GPUVertexBufferLayout = {
      arrayStride: 11 * 4, // 3 pos + 3 normal + 2 uv + 3 tangent = 11 floats
      attributes: [
        {
          format: "float32x3",
          offset: 0,
          shaderLocation: 0, // position
        },
        {
          format: "float32x3",
          offset: 3 * 4,
          shaderLocation: 1, // normal
        },
        {
          format: "float32x2",
          offset: 6 * 4,
          shaderLocation: 2, // uv
        },
        {
          format: "float32x3",
          offset: 8 * 4,
          shaderLocation: 3, // tangent
        },
      ],
    };

    const pipeline = this.device.createRenderPipeline({
      label: "Main Render Pipeline",
      layout: pipelineLayout,
      vertex: {
        module: shaders.vertex,
        entryPoint: "vs_main",
        buffers: [vertexBufferLayout],
      },
      fragment: {
        module: shaders.fragment,
        entryPoint: "fs_main",
        targets: [
          {
            format: "rgba16float", // HDR format
            blend: {
              color: {
                srcFactor: "src-alpha",
                dstFactor: "one-minus-src-alpha",
              },
              alpha: {
                srcFactor: "one",
                dstFactor: "one-minus-src-alpha",
              },
            },
          },
        ],
      },
      primitive: {
        topology: "triangle-list",
        cullMode: "back",
        frontFace: "ccw",
      },
      depthStencil: {
        depthWriteEnabled: true,
        depthCompare: "less",
        format: "depth32float",
      },
      multisample: {
        count: 4, // MSAA
      },
    });

    this.mainPipeline = {
      pipeline,
      bindGroupLayouts: [
        cameraBindGroupLayout,
        modelBindGroupLayout,
        lightBindGroupLayout,
        materialBindGroupLayout,
      ],
    };
  }

  private async createShadowPipeline(): Promise<void> {
    const shaders = await this.shaderManager.loadShadowShaders();

    const modelBindGroupLayout = this.device.createBindGroupLayout({
      label: "Shadow Model Bind Group Layout",
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX,
          buffer: { type: "uniform" },
        },
      ],
    });

    const lightBindGroupLayout = this.device.createBindGroupLayout({
      label: "Shadow Light Bind Group Layout",
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX,
          buffer: { type: "uniform" },
        },
      ],
    });

    const pipelineLayout = this.device.createPipelineLayout({
      label: "Shadow Pipeline Layout",
      bindGroupLayouts: [modelBindGroupLayout, lightBindGroupLayout],
    });

    const vertexBufferLayout: GPUVertexBufferLayout = {
      arrayStride: 3 * 4, // Only position for shadow mapping
      attributes: [
        {
          format: "float32x3",
          offset: 0,
          shaderLocation: 0, // position
        },
      ],
    };

    const pipeline = this.device.createRenderPipeline({
      label: "Shadow Render Pipeline",
      layout: pipelineLayout,
      vertex: {
        module: shaders.vertex,
        entryPoint: "vs_main",
        buffers: [vertexBufferLayout],
      },
      fragment: {
        module: shaders.fragment,
        entryPoint: "fs_main",
        targets: [], // No color output for shadow mapping
      },
      primitive: {
        topology: "triangle-list",
        cullMode: "front", // Front face culling for shadow mapping
        frontFace: "ccw",
      },
      depthStencil: {
        depthWriteEnabled: true,
        depthCompare: "less",
        format: "depth32float",
      },
    });

    this.shadowPipeline = {
      pipeline,
      bindGroupLayouts: [modelBindGroupLayout, lightBindGroupLayout],
    };
  }

  getMainPipeline(): RenderPipeline {
    if (!this.mainPipeline) {
      throw new Error("Main pipeline not initialized");
    }
    return this.mainPipeline;
  }

  getShadowPipeline(): ShadowPipeline {
    if (!this.shadowPipeline) {
      throw new Error("Shadow pipeline not initialized");
    }
    return this.shadowPipeline;
  }

  dispose(): void {
    this.shaderManager.dispose();
    this.mainPipeline = null;
    this.shadowPipeline = null;
  }
}
