import { logger } from "@vtt/logging";

export class Shader {
  private gl: WebGL2RenderingContext;
  private shader: WebGLShader;
  private type: number;
  private source: string;

  constructor(gl: WebGL2RenderingContext, source: string, type: number) {
    this.gl = gl;
    this.type = type;
    this.source = source;
    this.shader = this.compile(source, type);
  }

  private compile(source: string, type: number): WebGLShader {
    const gl = this.gl;
    const shader = gl.createShader(type);

    if (!shader) {
      throw new Error("Failed to create shader");
    }

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const error = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(`Shader compilation error: ${error}\nSource:\n${source}`);
    }

    return shader;
  }

  getShader(): WebGLShader {
    return this.shader;
  }

  getSource(): string {
    return this.source;
  }

  dispose(): void {
    this.gl.deleteShader(this.shader);
  }
}

export class ShaderProgram {
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram;
  private uniforms = new Map<string, WebGLUniformLocation>();
  private attributes = new Map<string, number>();
  private uniformBlocks = new Map<string, number>();

  constructor(
    gl: WebGL2RenderingContext,
    vertexSource: string,
    fragmentSource: string,
    geometrySource?: string,
  ) {
    this.gl = gl;
    this.program = this.link(vertexSource, fragmentSource, geometrySource);
    this.cacheLocations();
  }

  private link(
    vertexSource: string,
    fragmentSource: string,
    geometrySource?: string,
  ): WebGLProgram {
    const gl = this.gl;
    const program = gl.createProgram();

    if (!program) {
      throw new Error("Failed to create shader program");
    }

    // Create and attach shaders
    const vertexShader = new Shader(gl, vertexSource, gl.VERTEX_SHADER);
    const fragmentShader = new Shader(gl, fragmentSource, gl.FRAGMENT_SHADER);

    gl.attachShader(program, vertexShader.getShader());
    gl.attachShader(program, fragmentShader.getShader());

    if (geometrySource) {
      const geometryShader = new Shader(gl, geometrySource, gl.GEOMETRY_SHADER);
      gl.attachShader(program, geometryShader.getShader());
    }

    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const error = gl.getProgramInfoLog(program);
      gl.deleteProgram(program);
      throw new Error(`Shader program linking error: ${error}`);
    }

    return program;
  }

  private cacheLocations(): void {
    const gl = this.gl;
    const program = this.program;

    // Cache uniform locations
    const numUniforms = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < numUniforms; i++) {
      const uniformInfo = gl.getActiveUniform(program, i);
      if (uniformInfo) {
        const location = gl.getUniformLocation(program, uniformInfo.name);
        if (location) {
          this.uniforms.set(uniformInfo.name, location);
        }
      }
    }

    // Cache attribute locations
    const numAttributes = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES);
    for (let i = 0; i < numAttributes; i++) {
      const attributeInfo = gl.getActiveAttrib(program, i);
      if (attributeInfo) {
        const location = gl.getAttribLocation(program, attributeInfo.name);
        this.attributes.set(attributeInfo.name, location);
      }
    }

    // Cache uniform block indices
    const numUniformBlocks = gl.getProgramParameter(program, gl.ACTIVE_UNIFORM_BLOCKS);
    for (let i = 0; i < numUniformBlocks; i++) {
      const blockName = gl.getActiveUniformBlockName(program, i);
      if (blockName) {
        const blockIndex = gl.getUniformBlockIndex(program, blockName);
        this.uniformBlocks.set(blockName, blockIndex);
      }
    }
  }

  use(): void {
    this.gl.useProgram(this.program);
  }

  getUniformLocation(name: string): WebGLUniformLocation | null {
    return this.uniforms.get(name) || null;
  }

  getAttributeLocation(name: string): number {
    return this.attributes.get(name) ?? -1;
  }

  getUniformBlockIndex(name: string): number {
    return this.uniformBlocks.get(name) ?? -1;
  }

  // Uniform setters
  setUniform1f(name: string, value: number): void {
    const location = this.getUniformLocation(name);
    if (location) {
      this.gl.uniform1f(location, value);
    }
  }

  setUniform2f(name: string, x: number, y: number): void {
    const location = this.getUniformLocation(name);
    if (location) {
      this.gl.uniform2f(location, x, y);
    }
  }

  setUniform3f(name: string, x: number, y: number, z: number): void {
    const location = this.getUniformLocation(name);
    if (location) {
      this.gl.uniform3f(location, x, y, z);
    }
  }

  setUniform4f(name: string, x: number, y: number, z: number, w: number): void {
    const location = this.getUniformLocation(name);
    if (location) {
      this.gl.uniform4f(location, x, y, z, w);
    }
  }

  setUniform1i(name: string, value: number): void {
    const location = this.getUniformLocation(name);
    if (location) {
      this.gl.uniform1i(location, value);
    }
  }

  setUniform1fv(name: string, values: Float32Array | number[]): void {
    const location = this.getUniformLocation(name);
    if (location) {
      this.gl.uniform1fv(location, values);
    }
  }

  setUniform2fv(name: string, values: Float32Array | number[]): void {
    const location = this.getUniformLocation(name);
    if (location) {
      this.gl.uniform2fv(location, values);
    }
  }

  setUniform3fv(name: string, values: Float32Array | number[]): void {
    const location = this.getUniformLocation(name);
    if (location) {
      this.gl.uniform3fv(location, values);
    }
  }

  setUniform4fv(name: string, values: Float32Array | number[]): void {
    const location = this.getUniformLocation(name);
    if (location) {
      this.gl.uniform4fv(location, values);
    }
  }

  setUniformMatrix2fv(name: string, matrix: Float32Array | number[]): void {
    const location = this.getUniformLocation(name);
    if (location) {
      this.gl.uniformMatrix2fv(location, false, matrix);
    }
  }

  setUniformMatrix3fv(name: string, matrix: Float32Array | number[]): void {
    const location = this.getUniformLocation(name);
    if (location) {
      this.gl.uniformMatrix3fv(location, false, matrix);
    }
  }

  setUniformMatrix4fv(name: string, matrix: Float32Array | number[]): void {
    const location = this.getUniformLocation(name);
    if (location) {
      this.gl.uniformMatrix4fv(location, false, matrix);
    }
  }

  // Uniform buffer object binding
  bindUniformBlock(blockName: string, bindingPoint: number): void {
    const blockIndex = this.getUniformBlockIndex(blockName);
    if (blockIndex !== -1) {
      this.gl.uniformBlockBinding(this.program, blockIndex, bindingPoint);
    }
  }

  validate(): boolean {
    const gl = this.gl;
    gl.validateProgram(this.program);
    const valid = gl.getProgramParameter(this.program, gl.VALIDATE_STATUS);

    if (!valid) {
      const error = gl.getProgramInfoLog(this.program);
      logger.error(`Shader program validation error: ${error}`);
    }

    return valid;
  }

  dispose(): void {
    this.gl.deleteProgram(this.program);
    this.uniforms.clear();
    this.attributes.clear();
    this.uniformBlocks.clear();
  }
}
