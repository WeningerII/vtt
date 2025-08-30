import { logger } from "@vtt/logging";

export interface RenderObject {
  id: string;
  position: [number, number, number];
  rotation: number;
  scale: [number, number];
  textureId: string;
  color: [number, number, number, number];
  visible: boolean;
  layer: number;
}

export interface Camera {
  position: [number, number];
  zoom: number;
  rotation: number;
  viewport: [number, number, number, number]; // x, y, width, height
}

export interface Texture {
  id: string;
  glTexture: WebGLTexture;
  width: number;
  height: number;
  format: number;
}

export class WebGLRenderer {
  private canvas: HTMLCanvasElement;
  private gl: WebGL2RenderingContext;
  private program!: WebGLProgram;
  private vertexBuffer!: WebGLBuffer;
  private indexBuffer!: WebGLBuffer;
  private instanceBuffer!: WebGLBuffer;

  // Shader attribute/uniform locations
  private locations!: {
    position: number;
    texCoord: number;
    instancePosition: number;
    instanceRotation: number;
    instanceScale: number;
    instanceColor: number;
    instanceTexOffset: number;
    mvpMatrix: WebGLUniformLocation | null;
    textureAtlas: WebGLUniformLocation | null;
  };

  // State
  private textures: Map<string, Texture> = new Map();
  private renderQueue: RenderObject[] = [];
  private camera: Camera = {
    position: [0, 0],
    zoom: 1,
    rotation: 0,
    viewport: [0, 0, 800, 600],
  };
  private mvpMatrix: Float32Array = new Float32Array(16);

  // Performance tracking
  private stats = {
    drawCalls: 0,
    triangles: 0,
    instancesRendered: 0,
    frameTime: 0,
    fps: 0,
  };

  private lastFrameTime = 0;
  private frameCount = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;

    const gl = canvas.getContext("webgl2", {
      alpha: true,
      antialias: true,
      depth: true,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
    });

    if (!gl) {
      throw new Error("WebGL2 not supported");
    }

    this.gl = gl;
    this.initializeRenderer();
  }

  private initializeRenderer(): void {
    const gl = this.gl;

    // Enable features
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);

    // Create shader program
    this.program = this.createShaderProgram();
    gl.useProgram(this.program);

    // Get attribute and uniform locations
    this.locations = {
      position: gl.getAttribLocation(this.program, "a_position"),
      texCoord: gl.getAttribLocation(this.program, "a_texCoord"),
      instancePosition: gl.getAttribLocation(this.program, "a_instancePosition"),
      instanceRotation: gl.getAttribLocation(this.program, "a_instanceRotation"),
      instanceScale: gl.getAttribLocation(this.program, "a_instanceScale"),
      instanceColor: gl.getAttribLocation(this.program, "a_instanceColor"),
      instanceTexOffset: gl.getAttribLocation(this.program, "a_instanceTexOffset"),
      mvpMatrix: gl.getUniformLocation(this.program, "u_mvpMatrix")!,
      textureAtlas: gl.getUniformLocation(this.program, "u_textureAtlas")!,
    };

    // Create buffers
    this.createBuffers();

    // Set up vertex array
    this.setupVertexArray();

    logger.info("WebGL2 Renderer initialized");
  }

  private createShaderProgram(): WebGLProgram {
    const gl = this.gl;

    const vertexShaderSource = `#version 300 es
      precision highp float;
      
      in vec2 a_position;
      in vec2 a_texCoord;
      
      // Instance attributes
      in vec3 a_instancePosition;
      in float a_instanceRotation;
      in vec2 a_instanceScale;
      in vec4 a_instanceColor;
      in vec2 a_instanceTexOffset;
      
      uniform mat4 u_mvpMatrix;
      
      out vec2 v_texCoord;
      out vec4 v_color;
      out float v_depth;
      
      void main() {
        // Apply instance transformations
        vec2 scaledPos = a_position * a_instanceScale;
        
        // Apply rotation
        float cos_r = cos(a_instanceRotation);
        float sin_r = sin(a_instanceRotation);
        vec2 rotatedPos = vec2(
          scaledPos.x * cos_r - scaledPos.y * sin_r,
          scaledPos.x * sin_r + scaledPos.y * cos_r
        );
        
        // Apply translation
        vec3 worldPos = vec3(rotatedPos + a_instancePosition.xy, a_instancePosition.z);
        
        gl_Position = u_mvpMatrix * vec4(worldPos, 1.0);
        
        // Pass texture coordinates with atlas offset
        v_texCoord = a_texCoord + a_instanceTexOffset;
        v_color = a_instanceColor;
        v_depth = a_instancePosition.z;
      }
    `;

    const fragmentShaderSource = `#version 300 es
      precision highp float;
      
      in vec2 v_texCoord;
      in vec4 v_color;
      in float v_depth;
      
      uniform sampler2D u_textureAtlas;
      
      out vec4 fragColor;
      
      void main() {
        vec4 texColor = texture(u_textureAtlas, v_texCoord);
        
        // Apply tinting
        fragColor = texColor * v_color;
        
        // Discard transparent pixels
        if (fragColor.a < 0.01) {
          discard;
        }
        
        // Depth-based fog (optional)
        // float fogFactor = clamp(v_depth * 0.1, 0.0, 1.0);
        // fragColor.rgb = mix(fragColor.rgb, vec3(0.2), fogFactor);
      }
    `;

    const vertexShader = this.createShader(gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = this.createShader(gl.FRAGMENT_SHADER, fragmentShaderSource);

    const program = gl.createProgram()!;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const info = gl.getProgramInfoLog(program);
      throw new Error("Could not compile WebGL program: " + info);
    }

    return program;
  }

  private createShader(type: number, source: string): WebGLShader {
    const gl = this.gl;
    const shader = gl.createShader(type)!;

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(shader);
      throw new Error("Could not compile shader: " + info);
    }

    return shader;
  }

  private createBuffers(): void {
    const gl = this.gl;

    // Quad vertices (position + texture coordinates)
    const quadVertices = new Float32Array([
      -0.5,
      -0.5,
      0.0,
      0.0, // bottom-left
      0.5,
      -0.5,
      1.0,
      0.0, // bottom-right
      0.5,
      0.5,
      1.0,
      1.0, // top-right
      -0.5,
      0.5,
      0.0,
      1.0, // top-left
    ]);

    const quadIndices = new Uint16Array([0, 1, 2, 2, 3, 0]);

    // Create vertex buffer
    this.vertexBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, quadVertices, gl.STATIC_DRAW);

    // Create index buffer
    this.indexBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, quadIndices, gl.STATIC_DRAW);

    // Create instance buffer (dynamic)
    this.instanceBuffer = gl.createBuffer()!;
  }

  private setupVertexArray(): void {
    const gl = this.gl;

    // Bind vertex buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);

    // Position attribute
    gl.enableVertexAttribArray(this.locations.position);
    gl.vertexAttribPointer(this.locations.position, 2, gl.FLOAT, false, 16, 0);

    // Texture coordinate attribute
    gl.enableVertexAttribArray(this.locations.texCoord);
    gl.vertexAttribPointer(this.locations.texCoord, 2, gl.FLOAT, false, 16, 8);

    // Bind index buffer
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
  }

  public loadTexture(id: string, image: HTMLImageElement): Texture {
    const gl = this.gl;

    const texture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, texture);

    // Upload the image
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

    // Set texture parameters
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    const textureObj: Texture = {
      id,
      glTexture: texture,
      width: image.width,
      height: image.height,
      format: gl.RGBA,
    };

    this.textures.set(id, textureObj);
    return textureObj;
  }

  public setCamera(camera: Partial<Camera>): void {
    Object.assign(this.camera, camera);
  }

  public addRenderObject(obj: RenderObject): void {
    if (obj.visible) {
      this.renderQueue.push(obj);
    }
  }

  public clearRenderQueue(): void {
    this.renderQueue = [];
  }

  public render(): void {
    const startTime = performance.now();

    const gl = this.gl;

    // Clear the canvas
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0.1, 0.1, 0.1, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    if (this.renderQueue.length === 0) return;

    // Sort render queue by layer then by texture
    this.renderQueue.sort((a, b) => {
      if (a.layer !== b.layer) return a.layer - b.layer;
      return a.textureId.localeCompare(b.textureId);
    });

    // Update MVP matrix
    this.updateMVPMatrix();

    // Batch render by texture
    let currentTexture = "";
    let batchStart = 0;

    for (let i = 0; i <= this.renderQueue.length; i++) {
      const obj = this.renderQueue[i];
      const textureId = obj?.textureId || "";

      if (textureId !== currentTexture || i === this.renderQueue.length) {
        if (i > batchStart) {
          this.renderBatch(currentTexture, batchStart, i);
        }
        currentTexture = textureId;
        batchStart = i;
      }
    }

    // Update stats
    const frameTime = performance.now() - startTime;
    this.updateStats(frameTime);

    // Clear for next frame
    this.clearRenderQueue();
  }

  private renderBatch(textureId: string, start: number, end: number): void {
    const gl = this.gl;
    const batchSize = end - start;

    // Bind texture
    if (this.locations.mvpMatrix) {
      gl.uniformMatrix4fv(this.locations.mvpMatrix, false, this.mvpMatrix);
    }

    // Bind texture
    const texture = this.textures.get(textureId);
    if (texture) {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture.glTexture);
      if (this.locations.textureAtlas) {
        gl.uniform1i(this.locations.textureAtlas, 0);
      }
    }

    // Prepare instance data
    const instanceData = new Float32Array(batchSize * 12); // 12 floats per instance

    for (let i = start; i < end; i++) {
      const obj = this.renderQueue[i];
      if (!obj) continue;

      const offset = (i - start) * 12;

      // Position (3 floats)
      instanceData[offset] = obj.position[0];
      instanceData[offset + 1] = obj.position[1];
      instanceData[offset + 2] = obj.position[2];

      // Rotation (1 float)
      instanceData[offset + 3] = obj.rotation;

      // Scale (2 floats)
      instanceData[offset + 4] = obj.scale[0];
      instanceData[offset + 5] = obj.scale[1];

      // Color (4 floats)
      instanceData[offset + 6] = obj.color[0];
      instanceData[offset + 7] = obj.color[1];
      instanceData[offset + 8] = obj.color[2];
      instanceData[offset + 9] = obj.color[3];

      // Texture offset (2 floats) - for atlas support
      instanceData[offset + 10] = 0; // u offset
      instanceData[offset + 11] = 0; // v offset
    }

    // Upload instance data
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, instanceData, gl.DYNAMIC_DRAW);

    // Set up instance attributes
    const stride = 12 * 4; // 12 floats * 4 bytes

    gl.enableVertexAttribArray(this.locations.instancePosition);
    gl.vertexAttribPointer(this.locations.instancePosition, 3, gl.FLOAT, false, stride, 0);
    gl.vertexAttribDivisor(this.locations.instancePosition, 1);

    gl.enableVertexAttribArray(this.locations.instanceRotation);
    gl.vertexAttribPointer(this.locations.instanceRotation, 1, gl.FLOAT, false, stride, 12);
    gl.vertexAttribDivisor(this.locations.instanceRotation, 1);

    gl.enableVertexAttribArray(this.locations.instanceScale);
    gl.vertexAttribPointer(this.locations.instanceScale, 2, gl.FLOAT, false, stride, 16);
    gl.vertexAttribDivisor(this.locations.instanceScale, 1);

    gl.enableVertexAttribArray(this.locations.instanceColor);
    gl.vertexAttribPointer(this.locations.instanceColor, 4, gl.FLOAT, false, stride, 24);
    gl.vertexAttribDivisor(this.locations.instanceColor, 1);

    gl.enableVertexAttribArray(this.locations.instanceTexOffset);
    gl.vertexAttribPointer(this.locations.instanceTexOffset, 2, gl.FLOAT, false, stride, 40);
    gl.vertexAttribDivisor(this.locations.instanceTexOffset, 1);

    // Draw instances
    gl.drawElementsInstanced(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0, batchSize);

    // Update stats
    this.stats.drawCalls++;
    this.stats.triangles += batchSize * 2;
    this.stats.instancesRendered += batchSize;
  }

  private updateMVPMatrix(): void {
    const gl = this.gl;

    // Create view matrix from camera
    const viewMatrix = this.createViewMatrix();

    // Create projection matrix
    const projMatrix = this.createProjectionMatrix();

    // Multiply projection * view
    const mvpMatrix = this.multiplyMatrices(projMatrix, viewMatrix);

    // Upload to GPU
    gl.uniformMatrix4fv(this.locations.mvpMatrix, false, mvpMatrix);
  }

  private createViewMatrix(): Float32Array {
    const cam = this.camera;
    const matrix = new Float32Array(16);

    // Create 2D view matrix with translation, rotation, and scale
    const cos_r = Math.cos(-cam.rotation);
    const sin_r = Math.sin(-cam.rotation);
    const scale = cam.zoom;

    matrix[0] = cos_r * scale;
    matrix[4] = -sin_r * scale;
    matrix[8] = 0;
    matrix[12] = -cam.position[0] * scale;
    matrix[1] = sin_r * scale;
    matrix[5] = cos_r * scale;
    matrix[9] = 0;
    matrix[13] = -cam.position[1] * scale;
    matrix[2] = 0;
    matrix[6] = 0;
    matrix[10] = 1;
    matrix[14] = 0;
    matrix[3] = 0;
    matrix[7] = 0;
    matrix[11] = 0;
    matrix[15] = 1;

    return matrix;
  }

  private createProjectionMatrix(): Float32Array {
    const matrix = new Float32Array(16);

    const width = this.canvas.width;
    const height = this.canvas.height;
    const _aspect = width / height;

    // Orthographic projection
    const left = -width / 2;
    const right = width / 2;
    const bottom = -height / 2;
    const top = height / 2;
    const near = -1000;
    const far = 1000;

    matrix[0] = 2 / (right - left);
    matrix[4] = 0;
    matrix[8] = 0;
    matrix[12] = -(right + left) / (right - left);
    matrix[1] = 0;
    matrix[5] = 2 / (top - bottom);
    matrix[9] = 0;
    matrix[13] = -(top + bottom) / (top - bottom);
    matrix[2] = 0;
    matrix[6] = 0;
    matrix[10] = -2 / (far - near);
    matrix[14] = -(far + near) / (far - near);
    matrix[3] = 0;
    matrix[7] = 0;
    matrix[11] = 0;
    matrix[15] = 1;

    return matrix;
  }

  private multiplyMatrices(a: Float32Array, b: Float32Array): Float32Array {
    const result = new Float32Array(16);

    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        result[i * 4 + j] =
          (a[i * 4 + 0] || 0) * (b[0 * 4 + j] || 0) +
          (a[i * 4 + 1] || 0) * (b[1 * 4 + j] || 0) +
          (a[i * 4 + 2] || 0) * (b[2 * 4 + j] || 0) +
          (a[i * 4 + 3] || 0) * (b[3 * 4 + j] || 0);
      }
    }

    return result;
  }

  private updateStats(frameTime: number): void {
    this.stats.frameTime = frameTime;

    // Calculate FPS
    const now = performance.now();
    if (now - this.lastFrameTime >= 1000) {
      this.stats.fps = this.frameCount;
      this.frameCount = 0;
      this.lastFrameTime = now;
    }
    this.frameCount++;

    // Reset per-frame stats
    this.stats.drawCalls = 0;
    this.stats.triangles = 0;
    this.stats.instancesRendered = 0;
  }

  public getStats() {
    return { ...this.stats };
  }

  public getLoadedTextures() {
    return Array.from(this.textures.keys());
  }

  public hasTexture(url: string): boolean {
    return this.textures.has(url);
  }

  public resize(width: number, height: number): void {
    this.canvas.width = width;
    this.canvas.height = height;
    this.camera.viewport = [0, 0, width, height];
  }

  public dispose(): void {
    const gl = this.gl;

    // Clean up WebGL resources
    gl.deleteProgram(this.program);
    gl.deleteBuffer(this.vertexBuffer);
    gl.deleteBuffer(this.indexBuffer);
    gl.deleteBuffer(this.instanceBuffer);

    for (const texture of this.textures.values()) {
      gl.deleteTexture(texture.glTexture);
    }

    this.textures.clear();
    this.renderQueue = [];
  }
}
