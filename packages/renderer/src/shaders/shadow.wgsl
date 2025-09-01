struct VertexInput {
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
  // Shadow mapping only needs depth, no color output needed
  return vec4<f32>(0.0, 0.0, 0.0, 1.0);
}
