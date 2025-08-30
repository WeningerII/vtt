/**
 * WebGPU Type Definitions
 * Based on WebGPU specification for missing GPU types
 */

declare global {
  interface Navigator {
    gpu?: GPU;
  }

  interface GPU {
    requestAdapter(options?: GPURequestAdapterOptions): Promise<GPUAdapter | null>;
    getPreferredCanvasFormat?(): GPUTextureFormat;
  }

  interface GPURequestAdapterOptions {
    powerPreference?: GPUPowerPreference;
    forceFallbackAdapter?: boolean;
  }

  type GPUPowerPreference = "low-power" | "high-performance";

  interface GPUAdapter {
    readonly features: GPUSupportedFeatures;
    readonly limits: GPUSupportedLimits;
    readonly info: GPUAdapterInfo;
    requestDevice(descriptor?: GPUDeviceDescriptor): Promise<GPUDevice>;
  }

  interface GPUAdapterInfo {
    readonly vendor: string;
    readonly architecture: string;
    readonly device: string;
    readonly description: string;
  }

  interface GPUDeviceDescriptor {
    label?: string;
    requiredFeatures?: GPUFeatureName[];
    requiredLimits?: Record<string, GPUSize64>;
    defaultQueue?: GPUQueueDescriptor;
  }

  interface GPUQueueDescriptor {
    label?: string;
  }

  type GPUFeatureName = 
    | "depth-clip-control"
    | "depth32float-stencil8"
    | "texture-compression-bc"
    | "texture-compression-etc2"
    | "texture-compression-astc"
    | "timestamp-query"
    | "indirect-first-instance"
    | "shader-f16"
    | "rg11b10ufloat-renderable"
    | "bgra8unorm-storage"
    | "float32-filterable";

  interface GPUSupportedFeatures extends ReadonlySet<GPUFeatureName> {}

  interface GPUSupportedLimits {
    readonly maxTextureDimension1D: number;
    readonly maxTextureDimension2D: number;
    readonly maxTextureDimension3D: number;
    readonly maxTextureArrayLayers: number;
    readonly maxBindGroups: number;
    readonly maxDynamicUniformBuffersPerPipelineLayout: number;
    readonly maxDynamicStorageBuffersPerPipelineLayout: number;
    readonly maxSampledTexturesPerShaderStage: number;
    readonly maxSamplersPerShaderStage: number;
    readonly maxStorageBuffersPerShaderStage: number;
    readonly maxStorageTexturesPerShaderStage: number;
    readonly maxUniformBuffersPerShaderStage: number;
    readonly maxUniformBufferBindingSize: number;
    readonly maxStorageBufferBindingSize: number;
    readonly minUniformBufferOffsetAlignment: number;
    readonly minStorageBufferOffsetAlignment: number;
    readonly maxVertexBuffers: number;
    readonly maxVertexAttributes: number;
    readonly maxVertexBufferArrayStride: number;
    readonly maxInterStageShaderComponents: number;
    readonly maxComputeWorkgroupStorageSize: number;
    readonly maxComputeInvocationsPerWorkgroup: number;
    readonly maxComputeWorkgroupSizeX: number;
    readonly maxComputeWorkgroupSizeY: number;
    readonly maxComputeWorkgroupSizeZ: number;
    readonly maxComputeWorkgroupsPerDimension: number;
  }

  interface GPUDevice extends EventTarget {
    readonly features: GPUSupportedFeatures;
    readonly limits: GPUSupportedLimits;
    readonly queue: GPUQueue;
    readonly label: string;
    readonly lost: Promise<GPUDeviceLostInfo>;
    destroy(): void;
    createBuffer(descriptor: GPUBufferDescriptor): GPUBuffer;
    createTexture(descriptor: GPUTextureDescriptor): GPUTexture;
    createSampler(descriptor?: GPUSamplerDescriptor): GPUSampler;
    createBindGroupLayout(descriptor: GPUBindGroupLayoutDescriptor): GPUBindGroupLayout;
    createBindGroup(descriptor: GPUBindGroupDescriptor): GPUBindGroup;
    createPipelineLayout(descriptor: GPUPipelineLayoutDescriptor): GPUPipelineLayout;
    createShaderModule(descriptor: GPUShaderModuleDescriptor): GPUShaderModule;
    createComputePipeline(descriptor: GPUComputePipelineDescriptor): GPUComputePipeline;
    createRenderPipeline(descriptor: GPURenderPipelineDescriptor): GPURenderPipeline;
    createCommandEncoder(descriptor?: GPUCommandEncoderDescriptor): GPUCommandEncoder;
    pushErrorScope(filter: GPUErrorFilter): void;
    popErrorScope(): Promise<GPUError | null>;
    onuncapturederror: ((_event: GPUUncapturedErrorEvent) => any) | null;
  }

  interface GPUDeviceLostInfo {
    readonly reason: GPUDeviceLostReason;
    readonly message: string;
  }

  type GPUDeviceLostReason = "unknown" | "destroyed";
  type GPUErrorFilter = "out-of-memory" | "validation" | "internal";

  type GPUQueue = GPUCommandQueue;

  interface GPUCommandQueue {
    readonly label: string;
    submit(commandBuffers: GPUCommandBuffer[]): void;
    writeBuffer(buffer: GPUBuffer, bufferOffset: GPUSize64, data: BufferSource, dataOffset?: GPUSize64, size?: GPUSize64): void;
    writeTexture(destination: GPUImageCopyTexture, data: BufferSource, dataLayout: GPUImageDataLayout, size: GPUExtent3D): void;
  }

  interface GPUBuffer {
    readonly size: GPUSize64;
    readonly usage: GPUBufferUsageFlags;
    readonly mapState: GPUBufferMapState;
    readonly label: string;
    mapAsync(mode: GPUMapModeFlags, offset?: GPUSize64, size?: GPUSize64): Promise<void>;
    getMappedRange(offset?: GPUSize64, size?: GPUSize64): ArrayBuffer;
    unmap(): void;
    destroy(): void;
  }

  interface GPUBufferDescriptor {
    label?: string;
    size: GPUSize64;
    usage: GPUBufferUsageFlags;
    mappedAtCreation?: boolean;
  }

  type GPUBufferUsageFlags = number;
  type GPUMapModeFlags = number;
  type GPUBufferMapState = "unmapped" | "pending" | "mapped";
  type GPUSize64 = number;

  interface GPUTexture {
    readonly width: number;
    readonly height: number;
    readonly depthOrArrayLayers: number;
    readonly mipLevelCount: number;
    readonly sampleCount: number;
    readonly dimension: GPUTextureDimension;
    readonly format: GPUTextureFormat;
    readonly usage: GPUTextureUsageFlags;
    readonly label: string;
    createView(descriptor?: GPUTextureViewDescriptor): GPUTextureView;
    destroy(): void;
  }

  interface GPUTextureDescriptor {
    label?: string;
    size: GPUExtent3D;
    mipLevelCount?: number;
    sampleCount?: number;
    dimension?: GPUTextureDimension;
    format: GPUTextureFormat;
    usage: GPUTextureUsageFlags;
    viewFormats?: GPUTextureFormat[];
  }

  interface GPUTextureView {
    readonly label: string;
  }

  interface GPUTextureViewDescriptor {
    label?: string;
    format?: GPUTextureFormat;
    dimension?: GPUTextureViewDimension;
    aspect?: GPUTextureAspect;
    baseMipLevel?: number;
    mipLevelCount?: number;
    baseArrayLayer?: number;
    arrayLayerCount?: number;
  }

  type GPUTextureDimension = "1d" | "2d" | "3d";
  type GPUTextureViewDimension = "1d" | "2d" | "2d-array" | "cube" | "cube-array" | "3d";
  type GPUTextureAspect = "all" | "stencil-only" | "depth-only";
  type GPUTextureUsageFlags = number;

  type GPUTextureFormat = 
    | "r8unorm" | "r8snorm" | "r8uint" | "r8sint"
    | "r16uint" | "r16sint" | "r16float"
    | "rg8unorm" | "rg8snorm" | "rg8uint" | "rg8sint"
    | "r32uint" | "r32sint" | "r32float"
    | "rg16uint" | "rg16sint" | "rg16float"
    | "rgba8unorm" | "rgba8unorm-srgb" | "rgba8snorm" | "rgba8uint" | "rgba8sint"
    | "bgra8unorm" | "bgra8unorm-srgb"
    | "rgb9e5ufloat" | "rgb10a2unorm" | "rg11b10ufloat"
    | "rg32uint" | "rg32sint" | "rg32float"
    | "rgba16uint" | "rgba16sint" | "rgba16float"
    | "rgba32uint" | "rgba32sint" | "rgba32float"
    | "stencil8"
    | "depth16unorm"
    | "depth24plus"
    | "depth24plus-stencil8"
    | "depth32float"
    | "depth32float-stencil8";

  interface GPUExtent3D {
    width: number;
    height?: number;
    depthOrArrayLayers?: number;
  }

  interface GPUSampler {
    readonly label: string;
  }

  interface GPUSamplerDescriptor {
    label?: string;
    addressModeU?: GPUAddressMode;
    addressModeV?: GPUAddressMode;
    addressModeW?: GPUAddressMode;
    magFilter?: GPUFilterMode;
    minFilter?: GPUFilterMode;
    mipmapFilter?: GPUMipmapFilterMode;
    lodMinClamp?: number;
    lodMaxClamp?: number;
    compare?: GPUCompareFunction;
    maxAnisotropy?: number;
  }

  type GPUAddressMode = "clamp-to-edge" | "repeat" | "mirror-repeat";
  type GPUFilterMode = "nearest" | "linear";
  type GPUMipmapFilterMode = "nearest" | "linear";
  type GPUCompareFunction = "never" | "less" | "equal" | "less-equal" | "greater" | "not-equal" | "greater-equal" | "always";

  interface GPUBindGroupLayout {
    readonly label: string;
  }

  interface GPUBindGroupLayoutDescriptor {
    label?: string;
    entries: GPUBindGroupLayoutEntry[];
  }

  interface GPUBindGroupLayoutEntry {
    binding: number;
    visibility: GPUShaderStageFlags;
    buffer?: GPUBufferBindingLayout;
    sampler?: GPUSamplerBindingLayout;
    texture?: GPUTextureBindingLayout;
    storageTexture?: GPUStorageTextureBindingLayout;
  }

  type GPUShaderStageFlags = number;

  interface GPUBufferBindingLayout {
    type?: GPUBufferBindingType;
    hasDynamicOffset?: boolean;
    minBindingSize?: GPUSize64;
  }

  interface GPUSamplerBindingLayout {
    type?: GPUSamplerBindingType;
  }

  interface GPUTextureBindingLayout {
    sampleType?: GPUTextureSampleType;
    viewDimension?: GPUTextureViewDimension;
    multisampled?: boolean;
  }

  interface GPUStorageTextureBindingLayout {
    access?: GPUStorageTextureAccess;
    format: GPUTextureFormat;
    viewDimension?: GPUTextureViewDimension;
  }

  type GPUBufferBindingType = "uniform" | "storage" | "read-only-storage";
  type GPUSamplerBindingType = "filtering" | "non-filtering" | "comparison";
  type GPUTextureSampleType = "float" | "unfilterable-float" | "depth" | "sint" | "uint";
  type GPUStorageTextureAccess = "write-only" | "read-only" | "read-write";

  interface GPUBindGroup {
    readonly label: string;
  }

  interface GPUBindGroupDescriptor {
    label?: string;
    layout: GPUBindGroupLayout;
    entries: GPUBindGroupEntry[];
  }

  interface GPUBindGroupEntry {
    binding: number;
    resource: GPUBindingResource;
  }

  type GPUBindingResource = GPUSampler | GPUTextureView | GPUBufferBinding;

  interface GPUBufferBinding {
    buffer: GPUBuffer;
    offset?: GPUSize64;
    size?: GPUSize64;
  }

  interface GPUPipelineLayout {
    readonly label: string;
  }

  interface GPUPipelineLayoutDescriptor {
    label?: string;
    bindGroupLayouts: GPUBindGroupLayout[];
  }

  interface GPUShaderModule {
    readonly label: string;
  }

  interface GPUShaderModuleDescriptor {
    label?: string;
    code: string;
  }

  interface GPUComputePipeline {
    readonly label: string;
    getBindGroupLayout(index: number): GPUBindGroupLayout;
  }

  interface GPUComputePipelineDescriptor {
    label?: string;
    layout?: GPUPipelineLayout | "auto";
    compute: GPUProgrammableStage;
  }

  interface GPURenderPipeline {
    readonly label: string;
    getBindGroupLayout(index: number): GPUBindGroupLayout;
  }

  interface GPURenderPipelineDescriptor {
    label?: string;
    layout?: GPUPipelineLayout | "auto";
    vertex: GPUVertexState;
    primitive?: GPUPrimitiveState;
    depthStencil?: GPUDepthStencilState;
    multisample?: GPUMultisampleState;
    fragment?: GPUFragmentState;
  }

  interface GPUProgrammableStage {
    module: GPUShaderModule;
    entryPoint: string;
    constants?: Record<string, GPUPipelineConstantValue>;
  }

  interface GPUVertexState extends GPUProgrammableStage {
    buffers?: GPUVertexBufferLayout[];
  }

  interface GPUPrimitiveState {
    topology?: GPUPrimitiveTopology;
    stripIndexFormat?: GPUIndexFormat;
    frontFace?: GPUFrontFace;
    cullMode?: GPUCullMode;
  }

  interface GPUDepthStencilState {
    format: GPUTextureFormat;
    depthWriteEnabled?: boolean;
    depthCompare?: GPUCompareFunction;
    stencilFront?: GPUStencilFaceState;
    stencilBack?: GPUStencilFaceState;
    stencilReadMask?: number;
    stencilWriteMask?: number;
    depthBias?: number;
    depthBiasSlopeScale?: number;
    depthBiasClamp?: number;
  }

  interface GPUMultisampleState {
    count?: number;
    mask?: number;
    alphaToCoverageEnabled?: boolean;
  }

  interface GPUFragmentState extends GPUProgrammableStage {
    targets: GPUColorTargetState[];
  }

  interface GPUVertexBufferLayout {
    arrayStride: GPUSize64;
    stepMode?: GPUVertexStepMode;
    attributes: GPUVertexAttribute[];
  }

  interface GPUVertexAttribute {
    format: GPUVertexFormat;
    offset: GPUSize64;
    shaderLocation: number;
  }

  interface GPUStencilFaceState {
    compare?: GPUCompareFunction;
    failOp?: GPUStencilOperation;
    depthFailOp?: GPUStencilOperation;
    passOp?: GPUStencilOperation;
  }

  interface GPUColorTargetState {
    format: GPUTextureFormat;
    blend?: GPUBlendState;
    writeMask?: GPUColorWriteFlags;
  }

  interface GPUBlendState {
    color: GPUBlendComponent;
    alpha: GPUBlendComponent;
  }

  interface GPUBlendComponent {
    operation?: GPUBlendOperation;
    srcFactor?: GPUBlendFactor;
    dstFactor?: GPUBlendFactor;
  }

  type GPUPipelineConstantValue = number;
  type GPUPrimitiveTopology = "point-list" | "line-list" | "line-strip" | "triangle-list" | "triangle-strip";
  type GPUIndexFormat = "uint16" | "uint32";
  type GPUFrontFace = "ccw" | "cw";
  type GPUCullMode = "none" | "front" | "back";
  type GPUVertexStepMode = "vertex" | "instance";
  type GPUVertexFormat = 
    | "uint8x2" | "uint8x4" | "sint8x2" | "sint8x4" | "unorm8x2" | "unorm8x4" | "snorm8x2" | "snorm8x4"
    | "uint16x2" | "uint16x4" | "sint16x2" | "sint16x4" | "unorm16x2" | "unorm16x4" | "snorm16x2" | "snorm16x4"
    | "float16x2" | "float16x4" | "float32" | "float32x2" | "float32x3" | "float32x4"
    | "uint32" | "uint32x2" | "uint32x3" | "uint32x4" | "sint32" | "sint32x2" | "sint32x3" | "sint32x4";
  type GPUStencilOperation = "keep" | "zero" | "replace" | "invert" | "increment-clamp" | "decrement-clamp" | "increment-wrap" | "decrement-wrap";
  type GPUColorWriteFlags = number;
  type GPUBlendOperation = "add" | "subtract" | "reverse-subtract" | "min" | "max";
  type GPUBlendFactor = "zero" | "one" | "src" | "one-minus-src" | "src-alpha" | "one-minus-src-alpha" | "dst" | "one-minus-dst" | "dst-alpha" | "one-minus-dst-alpha" | "src-alpha-saturated" | "constant" | "one-minus-constant";

  interface GPUCommandEncoder {
    readonly label: string;
    beginRenderPass(descriptor: GPURenderPassDescriptor): GPURenderPassEncoder;
    beginComputePass(descriptor?: GPUComputePassDescriptor): GPUComputePassEncoder;
    copyBufferToBuffer(source: GPUBuffer, sourceOffset: GPUSize64, destination: GPUBuffer, destinationOffset: GPUSize64, size: GPUSize64): void;
    copyBufferToTexture(source: GPUImageCopyBuffer, destination: GPUImageCopyTexture, copySize: GPUExtent3D): void;
    copyTextureToBuffer(source: GPUImageCopyTexture, destination: GPUImageCopyBuffer, copySize: GPUExtent3D): void;
    copyTextureToTexture(source: GPUImageCopyTexture, destination: GPUImageCopyTexture, copySize: GPUExtent3D): void;
    finish(descriptor?: GPUCommandBufferDescriptor): GPUCommandBuffer;
  }

  interface GPUCommandEncoderDescriptor {
    label?: string;
  }

  interface GPUCommandBuffer {
    readonly label: string;
  }

  interface GPUCommandBufferDescriptor {
    label?: string;
  }

  interface GPURenderPassEncoder {
    setBindGroup(index: number, bindGroup: GPUBindGroup, dynamicOffsets?: number[]): void;
    setPipeline(pipeline: GPURenderPipeline): void;
    setVertexBuffer(slot: number, buffer: GPUBuffer, offset?: GPUSize64, size?: GPUSize64): void;
    setIndexBuffer(buffer: GPUBuffer, format: GPUIndexFormat, offset?: GPUSize64, size?: GPUSize64): void;
    draw(vertexCount: number, instanceCount?: number, firstVertex?: number, firstInstance?: number): void;
    drawIndexed(indexCount: number, instanceCount?: number, firstIndex?: number, baseVertex?: number, firstInstance?: number): void;
    end(): void;
  }

  interface GPUComputePassEncoder {
    setBindGroup(index: number, bindGroup: GPUBindGroup, dynamicOffsets?: number[]): void;
    setPipeline(pipeline: GPUComputePipeline): void;
    dispatchWorkgroups(workgroupCountX: number, workgroupCountY?: number, workgroupCountZ?: number): void;
    end(): void;
  }

  interface GPURenderPassDescriptor {
    label?: string;
    colorAttachments: GPURenderPassColorAttachment[];
    depthStencilAttachment?: GPURenderPassDepthStencilAttachment;
  }

  interface GPUComputePassDescriptor {
    label?: string;
  }

  interface GPURenderPassColorAttachment {
    view: GPUTextureView;
    resolveTarget?: GPUTextureView;
    clearValue?: GPUColor;
    loadOp: GPULoadOp;
    storeOp: GPUStoreOp;
  }

  interface GPURenderPassDepthStencilAttachment {
    view: GPUTextureView;
    depthClearValue?: number;
    depthLoadOp?: GPULoadOp;
    depthStoreOp?: GPUStoreOp;
    stencilClearValue?: number;
    stencilLoadOp?: GPULoadOp;
    stencilStoreOp?: GPUStoreOp;
  }

  interface GPUImageCopyBuffer {
    buffer: GPUBuffer;
    offset?: GPUSize64;
    bytesPerRow?: number;
    rowsPerImage?: number;
  }

  interface GPUImageCopyTexture {
    texture: GPUTexture;
    mipLevel?: number;
    origin?: GPUOrigin3D;
    aspect?: GPUTextureAspect;
  }

  interface GPUImageDataLayout {
    offset?: GPUSize64;
    bytesPerRow?: number;
    rowsPerImage?: number;
  }

  type GPUColor = [number, number, number, number] | { r: number; g: number; b: number; a: number };
  type GPULoadOp = "load" | "clear";
  type GPUStoreOp = "store" | "discard";
  type GPUOrigin3D = [number, number, number] | { x: number; y: number; z: number };

  interface GPUCanvasContext {
    readonly canvas: HTMLCanvasElement | OffscreenCanvas;
    configure(configuration: GPUCanvasConfiguration): void;
    unconfigure(): void;
    getCurrentTexture(): GPUTexture;
  }

  interface GPUCanvasConfiguration {
    device: GPUDevice;
    format: GPUTextureFormat;
    usage?: GPUTextureUsageFlags;
    viewFormats?: GPUTextureFormat[];
    colorSpace?: GPUPredefinedColorSpace;
    alphaMode?: GPUCanvasAlphaMode;
  }

  type GPUPredefinedColorSpace = "srgb" | "display-p3";
  type GPUCanvasAlphaMode = "opaque" | "premultiplied";

  interface GPUUncapturedErrorEvent extends Event {
    readonly error: GPUError;
  }

  interface GPUError {
    readonly message: string;
  }

  // Canvas extensions
  interface HTMLCanvasElement {
    getContext(contextId: "webgpu"): GPUCanvasContext | null;
  }

  interface OffscreenCanvas {
    getContext(contextId: "webgpu"): GPUCanvasContext | null;
  }

  // Constants
  namespace GPUBufferUsage {
    const MAP_READ: GPUBufferUsageFlags;
    const MAP_WRITE: GPUBufferUsageFlags;
    const COPY_SRC: GPUBufferUsageFlags;
    const COPY_DST: GPUBufferUsageFlags;
    const INDEX: GPUBufferUsageFlags;
    const VERTEX: GPUBufferUsageFlags;
    const UNIFORM: GPUBufferUsageFlags;
    const STORAGE: GPUBufferUsageFlags;
    const INDIRECT: GPUBufferUsageFlags;
    const QUERY_RESOLVE: GPUBufferUsageFlags;
  }

  namespace GPUTextureUsage {
    const COPY_SRC: GPUTextureUsageFlags;
    const COPY_DST: GPUTextureUsageFlags;
    const TEXTURE_BINDING: GPUTextureUsageFlags;
    const STORAGE_BINDING: GPUTextureUsageFlags;
    const RENDER_ATTACHMENT: GPUTextureUsageFlags;
  }

  namespace GPUShaderStage {
    const VERTEX: GPUShaderStageFlags;
    const FRAGMENT: GPUShaderStageFlags;
    const COMPUTE: GPUShaderStageFlags;
  }

  namespace GPUMapMode {
    const READ: GPUMapModeFlags;
    const WRITE: GPUMapModeFlags;
  }

  namespace GPUColorWrite {
    const RED: GPUColorWriteFlags;
    const GREEN: GPUColorWriteFlags;
    const BLUE: GPUColorWriteFlags;
    const ALPHA: GPUColorWriteFlags;
    const ALL: GPUColorWriteFlags;
  }
}

export {};
