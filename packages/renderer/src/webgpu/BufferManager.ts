// GPUBufferUsage is available as browser global
import { logger } from "@vtt/logging";

export interface BufferInfo {
  buffer: GPUBuffer;
  size: number;
  usage: GPUBufferUsageFlags;
  label?: string;
}

export interface UniformBufferData {
  camera: Float32Array;
  model: Float32Array;
  light: Float32Array;
  material: Float32Array;
}

export class BufferManager {
  private device: GPUDevice;
  private buffers = new Map<string, BufferInfo>();
  private uniformBuffers: Partial<UniformBufferData> = {};

  constructor(device: GPUDevice) {
    this.device = device;
  }

  createBuffer(
    label: string,
    size: number,
    usage: GPUBufferUsageFlags,
    data?: ArrayBuffer | ArrayBufferView,
  ): GPUBuffer {
    const buffer = this.device.createBuffer({
      label,
      size,
      usage,
      mappedAtCreation: !!data,
    });

    if (data) {
      const mappedRange = buffer.getMappedRange();
      if (data instanceof ArrayBuffer) {
        new Uint8Array(mappedRange).set(new Uint8Array(data));
      } else {
        new Uint8Array(mappedRange).set(
          new Uint8Array(data.buffer, data.byteOffset, data.byteLength),
        );
      }
      buffer.unmap();
    }

    this.buffers.set(label, { buffer, size, usage, label });
    return buffer;
  }

  createVertexBuffer(label: string, vertices: Float32Array): GPUBuffer {
    return this.createBuffer(
      label,
      vertices.byteLength,
      GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      vertices,
    );
  }

  createIndexBuffer(label: string, indices: Uint16Array | Uint32Array): GPUBuffer {
    return this.createBuffer(
      label,
      indices.byteLength,
      GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
      indices,
    );
  }

  createUniformBuffer(label: string, size: number): GPUBuffer {
    return this.createBuffer(label, size, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST);
  }

  updateBuffer(buffer: GPUBuffer, data: ArrayBuffer | ArrayBufferView, offset = 0): void {
    if (data instanceof ArrayBuffer) {
      this.device.queue.writeBuffer(buffer, offset, data);
    } else {
      // Pass the underlying ArrayBuffer and view offsets to satisfy GPUAllowSharedBufferSource
      this.device.queue.writeBuffer(
        buffer,
        offset,
        data.buffer as ArrayBuffer,
        data.byteOffset,
        data.byteLength,
      );
    }
  }

  // Camera uniform buffer (view, projection, camera position)
  createCameraUniformBuffer(): GPUBuffer {
    const size = 16 * 4 + 16 * 4 + 16 * 4 + 4 * 4; // view + proj + view_proj + camera_pos + padding
    const buffer = this.createUniformBuffer("camera_uniform", size);
    this.uniformBuffers.camera = new Float32Array(size / 4);
    return buffer;
  }

  updateCameraUniforms(
    buffer: GPUBuffer,
    viewMatrix: Float32Array,
    projMatrix: Float32Array,
    viewProjMatrix: Float32Array,
    cameraPos: Float32Array,
  ): void {
    if (!this.uniformBuffers.camera) {
      this.uniformBuffers.camera = new Float32Array(52); // Total size / 4
    }

    const data = this.uniformBuffers.camera;

    // View-projection matrix (16 floats)
    data.set(viewProjMatrix, 0);

    // View matrix (16 floats)
    data.set(viewMatrix, 16);

    // Projection matrix (16 floats)
    data.set(projMatrix, 32);

    // Camera position (3 floats + 1 padding)
    data.set(cameraPos, 48);

    this.updateBuffer(buffer, data);
  }

  // Model uniform buffer (model matrix, normal matrix)
  createModelUniformBuffer(): GPUBuffer {
    const size = 16 * 4 + 16 * 4; // model + normal_matrix
    const buffer = this.createUniformBuffer("model_uniform", size);
    this.uniformBuffers.model = new Float32Array(size / 4);
    return buffer;
  }

  updateModelUniforms(
    buffer: GPUBuffer,
    modelMatrix: Float32Array,
    normalMatrix: Float32Array,
  ): void {
    if (!this.uniformBuffers.model) {
      this.uniformBuffers.model = new Float32Array(32);
    }

    const data = this.uniformBuffers.model;
    data.set(modelMatrix, 0);
    data.set(normalMatrix, 16);

    this.updateBuffer(buffer, data);
  }

  // Light uniform buffer
  createLightUniformBuffer(): GPUBuffer {
    const size = 16 * 4 + 4 * 4 + 4 * 4 + 4 * 4; // light_view_proj + pos + dir + color + intensity
    const buffer = this.createUniformBuffer("light_uniform", size);
    this.uniformBuffers.light = new Float32Array(size / 4);
    return buffer;
  }

  updateLightUniforms(
    buffer: GPUBuffer,
    lightViewProjMatrix: Float32Array,
    lightPos: Float32Array,
    lightDir: Float32Array,
    lightColor: Float32Array,
    lightIntensity: number,
  ): void {
    if (!this.uniformBuffers.light) {
      this.uniformBuffers.light = new Float32Array(28);
    }

    const data = this.uniformBuffers.light;

    // Light view-projection matrix (16 floats)
    data.set(lightViewProjMatrix, 0);

    // Light position (3 floats + 1 padding)
    data.set(lightPos, 16);

    // Light direction (3 floats + 1 padding)
    data.set(lightDir, 20);

    // Light color (3 floats + 1 padding)
    data.set(lightColor, 24);

    // Light intensity (1 float)
    data[27] = lightIntensity;

    this.updateBuffer(buffer, data);
  }

  // Material uniform buffer
  createMaterialUniformBuffer(): GPUBuffer {
    const size = 4 * 4 + 4 + 4 + 4 * 4; // albedo + metallic + roughness + emissive + padding
    const buffer = this.createUniformBuffer("material_uniform", size);
    this.uniformBuffers.material = new Float32Array(size / 4);
    return buffer;
  }

  updateMaterialUniforms(
    buffer: GPUBuffer,
    albedo: Float32Array,
    metallic: number,
    roughness: number,
    emissive: Float32Array,
  ): void {
    if (!this.uniformBuffers.material) {
      this.uniformBuffers.material = new Float32Array(12);
    }

    const data = this.uniformBuffers.material;

    // Albedo (4 floats - RGBA)
    data.set(albedo, 0);

    // Metallic (1 float)
    data[4] = metallic;

    // Roughness (1 float)
    data[5] = roughness;

    // Emissive (3 floats + 1 padding)
    data.set(emissive, 6);

    this.updateBuffer(buffer, data);
  }

  getBuffer(label: string): GPUBuffer | undefined {
    return this.buffers.get(label)?.buffer;
  }

  destroyBuffer(label: string): void {
    const bufferInfo = this.buffers.get(label);
    if (bufferInfo) {
      bufferInfo.buffer.destroy();
      this.buffers.delete(label);
    }
  }

  dispose(): void {
    for (const [_label, bufferInfo] of this.buffers) {
      bufferInfo.buffer.destroy();
    }
    this.buffers.clear();
    this.uniformBuffers = {};
    logger.info("Buffer manager disposed");
  }

  getMemoryUsage(): number {
    let totalSize = 0;
    for (const bufferInfo of this.buffers.values()) {
      totalSize += bufferInfo.size;
    }
    return totalSize;
  }
}
