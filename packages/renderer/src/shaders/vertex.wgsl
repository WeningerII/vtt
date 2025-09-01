struct VertexInput {
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
  
  // Transform normal to world space
  output.world_normal = normalize((model.normal_matrix * vec4<f32>(input.normal, 0.0)).xyz);
  
  // Transform tangent to world space
  output.tangent = normalize((model.model * vec4<f32>(input.tangent, 0.0)).xyz);
  
  // Calculate bitangent
  output.bitangent = cross(output.world_normal, output.tangent);
  
  output.uv = input.uv;
  
  // Shadow mapping coordinate
  output.shadow_coord = light.light_view_proj * world_position;
  
  return output;
}
