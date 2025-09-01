import type { GPUDevice, GPUShaderModule } from "@webgpu/types";
import { logger } from "@vtt/logging";

export interface ShaderModule {
  vertex: GPUShaderModule;
  fragment: GPUShaderModule;
}

export interface ShadowShaderModule {
  vertex: GPUShaderModule;
  fragment: GPUShaderModule;
}

export class ShaderManager {
  private device: GPUDevice;
  private shaderCache = new Map<string, GPUShaderModule>();

  constructor(device: GPUDevice) {
    this.device = device;
  }

  async loadShader(name: string, source: string): Promise<GPUShaderModule> {
    if (this.shaderCache.has(name)) {
      return this.shaderCache.get(name)!;
    }

    try {
      const module = this.device.createShaderModule({
        label: name,
        code: source,
      });

      this.shaderCache.set(name, module);
      logger.info(`Loaded shader: ${name}`);
      return module;
    } catch (error) {
      logger.error(`Failed to load shader ${name}:`, error);
      throw error;
    }
  }

  async loadMainShaders(): Promise<ShaderModule> {
    const vertexSource = await this.loadShaderSource('vertex.wgsl');
    const fragmentSource = await this.loadShaderSource('fragment.wgsl');

    const vertex = await this.loadShader('main_vertex', vertexSource);
    const fragment = await this.loadShader('main_fragment', fragmentSource);

    return { vertex, fragment };
  }

  async loadShadowShaders(): Promise<ShadowShaderModule> {
    const shadowSource = await this.loadShaderSource('shadow.wgsl');
    
    const vertex = await this.loadShader('shadow_vertex', shadowSource);
    const fragment = await this.loadShader('shadow_fragment', shadowSource);

    return { vertex, fragment };
  }

  private async loadShaderSource(filename: string): Promise<string> {
    // In a real implementation, you'd load from files or embed as strings
    // For now, we'll return the shader sources directly
    switch (filename) {
      case 'vertex.wgsl':
        return `struct VertexInput {
  @location(0) position: vec3<f32>,
  @location(1) normal: vec3<f32>,
  @location(2) uv: vec2<f32>,
  @location(3) tangent: vec3<f32>,
}

struct VertexOutput {
  @builtin(position) clip_position: vec4<f32>,
  @location(0) world_position: vec3<f32>,
  @location(1) world_normal: vec3<f32>,
  @location(2) uv: vec2<f32>,
  @location(3) tangent: vec3<f32>,
  @location(4) bitangent: vec3<f32>,
  @location(5) shadow_coord: vec4<f32>,
}

struct CameraUniforms {
  view_proj: mat4x4<f32>,
  view: mat4x4<f32>,
  proj: mat4x4<f32>,
  camera_pos: vec3<f32>,
  _padding: f32,
}

struct ModelUniforms {
  model: mat4x4<f32>,
  normal_matrix: mat4x4<f32>,
}

struct LightUniforms {
  light_view_proj: mat4x4<f32>,
  light_pos: vec3<f32>,
  light_dir: vec3<f32>,
  light_color: vec3<f32>,
  light_intensity: f32,
}

@group(0) @binding(0) var<uniform> camera: CameraUniforms;
@group(1) @binding(0) var<uniform> model: ModelUniforms;
@group(2) @binding(0) var<uniform> light: LightUniforms;

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  
  let world_position = model.model * vec4<f32>(input.position, 1.0);
  output.world_position = world_position.xyz;
  output.clip_position = camera.view_proj * world_position;
  
  output.world_normal = normalize((model.normal_matrix * vec4<f32>(input.normal, 0.0)).xyz);
  output.tangent = normalize((model.model * vec4<f32>(input.tangent, 0.0)).xyz);
  output.bitangent = cross(output.world_normal, output.tangent);
  
  output.uv = input.uv;
  output.shadow_coord = light.light_view_proj * world_position;
  
  return output;
}`;

      case 'fragment.wgsl':
        return `struct VertexOutput {
  @builtin(position) clip_position: vec4<f32>,
  @location(0) world_position: vec3<f32>,
  @location(1) world_normal: vec3<f32>,
  @location(2) uv: vec2<f32>,
  @location(3) tangent: vec3<f32>,
  @location(4) bitangent: vec3<f32>,
  @location(5) shadow_coord: vec4<f32>,
}

struct MaterialUniforms {
  albedo: vec4<f32>,
  metallic: f32,
  roughness: f32,
  emissive: vec3<f32>,
  _padding: f32,
}

struct LightUniforms {
  light_view_proj: mat4x4<f32>,
  light_pos: vec3<f32>,
  light_dir: vec3<f32>,
  light_color: vec3<f32>,
  light_intensity: f32,
}

struct CameraUniforms {
  view_proj: mat4x4<f32>,
  view: mat4x4<f32>,
  proj: mat4x4<f32>,
  camera_pos: vec3<f32>,
  _padding: f32,
}

@group(0) @binding(0) var<uniform> camera: CameraUniforms;
@group(2) @binding(0) var<uniform> light: LightUniforms;
@group(3) @binding(0) var<uniform> material: MaterialUniforms;
@group(3) @binding(1) var albedo_texture: texture_2d<f32>;
@group(3) @binding(2) var normal_texture: texture_2d<f32>;
@group(3) @binding(3) var metallic_roughness_texture: texture_2d<f32>;
@group(3) @binding(4) var emissive_texture: texture_2d<f32>;
@group(3) @binding(5) var shadow_texture: texture_depth_2d;
@group(3) @binding(6) var texture_sampler: sampler;
@group(3) @binding(7) var shadow_sampler: sampler_comparison;

fn distribution_ggx(n_dot_h: f32, roughness: f32) -> f32 {
  let a = roughness * roughness;
  let a2 = a * a;
  let n_dot_h2 = n_dot_h * n_dot_h;
  let num = a2;
  var denom = n_dot_h2 * (a2 - 1.0) + 1.0;
  denom = 3.14159265 * denom * denom;
  return num / denom;
}

fn geometry_schlick_ggx(n_dot_v: f32, roughness: f32) -> f32 {
  let r = roughness + 1.0;
  let k = (r * r) / 8.0;
  let num = n_dot_v;
  let denom = n_dot_v * (1.0 - k) + k;
  return num / denom;
}

fn geometry_smith(n: vec3<f32>, v: vec3<f32>, l: vec3<f32>, roughness: f32) -> f32 {
  let n_dot_v = max(dot(n, v), 0.0);
  let n_dot_l = max(dot(n, l), 0.0);
  let ggx2 = geometry_schlick_ggx(n_dot_v, roughness);
  let ggx1 = geometry_schlick_ggx(n_dot_l, roughness);
  return ggx1 * ggx2;
}

fn fresnel_schlick(cos_theta: f32, f0: vec3<f32>) -> vec3<f32> {
  return f0 + (1.0 - f0) * pow(clamp(1.0 - cos_theta, 0.0, 1.0), 5.0);
}

fn calculate_shadow(shadow_coord: vec4<f32>) -> f32 {
  let shadow_coord_normalized = shadow_coord.xyz / shadow_coord.w;
  let shadow_coord_uv = shadow_coord_normalized.xy * 0.5 + 0.5;
  let shadow_coord_depth = shadow_coord_normalized.z;
  
  if (shadow_coord_uv.x < 0.0 || shadow_coord_uv.x > 1.0 || 
      shadow_coord_uv.y < 0.0 || shadow_coord_uv.y > 1.0) {
    return 1.0;
  }
  
  return textureSampleCompare(shadow_texture, shadow_sampler, shadow_coord_uv, shadow_coord_depth);
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
  let albedo_sample = textureSample(albedo_texture, texture_sampler, input.uv);
  let normal_sample = textureSample(normal_texture, texture_sampler, input.uv);
  let metallic_roughness_sample = textureSample(metallic_roughness_texture, texture_sampler, input.uv);
  let emissive_sample = textureSample(emissive_texture, texture_sampler, input.uv);
  
  let albedo = material.albedo.rgb * albedo_sample.rgb;
  let metallic = material.metallic * metallic_roughness_sample.b;
  let roughness = material.roughness * metallic_roughness_sample.g;
  let emissive = material.emissive * emissive_sample.rgb;
  
  let normal_map = normal_sample.rgb * 2.0 - 1.0;
  let tbn = mat3x3<f32>(
    normalize(input.tangent),
    normalize(input.bitangent),
    normalize(input.world_normal)
  );
  let normal = normalize(tbn * normal_map);
  
  let view_dir = normalize(camera.camera_pos - input.world_position);
  let light_dir = normalize(light.light_pos - input.world_position);
  let halfway_dir = normalize(view_dir + light_dir);
  
  let n_dot_v = max(dot(normal, view_dir), 0.0);
  let n_dot_l = max(dot(normal, light_dir), 0.0);
  let n_dot_h = max(dot(normal, halfway_dir), 0.0);
  
  let f0 = mix(vec3<f32>(0.04), albedo, metallic);
  let ndf = distribution_ggx(n_dot_h, roughness);
  let g = geometry_smith(normal, view_dir, light_dir, roughness);
  let f = fresnel_schlick(max(dot(halfway_dir, view_dir), 0.0), f0);
  
  let numerator = ndf * g * f;
  let denominator = 4.0 * n_dot_v * n_dot_l + 0.0001;
  let specular = numerator / denominator;
  
  let ks = f;
  var kd = vec3<f32>(1.0) - ks;
  kd *= 1.0 - metallic;
  
  let shadow = calculate_shadow(input.shadow_coord);
  let radiance = light.light_color * light.light_intensity;
  let lo = (kd * albedo / 3.14159265 + specular) * radiance * n_dot_l * shadow;
  
  let ambient = vec3<f32>(0.03) * albedo;
  let color = ambient + lo + emissive;
  
  let mapped = color / (color + vec3<f32>(1.0));
  let gamma_corrected = pow(mapped, vec3<f32>(1.0 / 2.2));
  
  return vec4<f32>(gamma_corrected, 1.0);
}`;

      case 'shadow.wgsl':
        return `struct VertexInput {
  @location(0) position: vec3<f32>,
}

struct VertexOutput {
  @builtin(position) clip_position: vec4<f32>,
}

struct ModelUniforms {
  model: mat4x4<f32>,
  normal_matrix: mat4x4<f32>,
}

struct LightUniforms {
  light_view_proj: mat4x4<f32>,
  light_pos: vec3<f32>,
  light_dir: vec3<f32>,
  light_color: vec3<f32>,
  light_intensity: f32,
}

@group(1) @binding(0) var<uniform> model: ModelUniforms;
@group(2) @binding(0) var<uniform> light: LightUniforms;

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  
  let world_position = model.model * vec4<f32>(input.position, 1.0);
  output.clip_position = light.light_view_proj * world_position;
  
  return output;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
  return vec4<f32>(0.0, 0.0, 0.0, 1.0);
}`;

      default:
        throw new Error(`Unknown shader file: ${filename}`);
    }
  }

  dispose(): void {
    this.shaderCache.clear();
  }
}
