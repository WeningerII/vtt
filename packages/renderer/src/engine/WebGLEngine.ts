import { mat4, vec3, vec4, quat } from 'gl-matrix';
import { logger } from "@vtt/logging";
import { Shader, ShaderProgram } from "./Shader";
import { Material } from "./Material";
import { Light } from "./Light";
import { Camera } from "./Camera";
import { RenderTarget } from "./RenderTarget";
import { TextureManager } from "./TextureManager";
import { GeometryManager } from "./GeometryManager";

export interface RenderStats {
  frameTime: number;
  drawCalls: number;
  triangles: number;
  vertices: number;
  textureBinds: number;
  stateChanges: number;
}

export interface RenderSettings {
  shadows: boolean;
  shadowMapSize: number;
  antialiasing: boolean;
  ambientOcclusion: boolean;
  bloom: boolean;
  toneMapping: boolean;
  hdr: boolean;
  anisotropicFiltering: number;
  maxLights: number;
  cullingEnabled: boolean;
  lodEnabled: boolean;
}

export class WebGLEngine {
  private gl: WebGL2RenderingContext;
  private canvas: HTMLCanvasElement;
  private settings: RenderSettings;
  private stats: RenderStats;

  // Core systems
  private textureManager: TextureManager;
  private geometryManager: GeometryManager;
  private shaderCache = new Map<string, ShaderProgram>();

  // Render targets
  private shadowMapTarget: RenderTarget | null = null;
  private hdrTarget: RenderTarget | null = null;
  private postProcessTargets: RenderTarget[] = [];

  // Current state
  private currentShader: ShaderProgram | null = null;
  private currentMaterial: Material | null = null;
  private viewMatrix = mat4.create();
  private projectionMatrix = mat4.create();
  private modelMatrix = mat4.create();
  private mvpMatrix = mat4.create();

  // Lighting
  private lights: Light[] = [];
  private lightUniforms = {
    positions: new Float32Array(16 * 3), // Max 16 lights
    colors: new Float32Array(16 * 3),
    directions: new Float32Array(16 * 3),
    properties: new Float32Array(16 * 4), // intensity, range, spotAngle, type
  };

  // Extensions
  private extensions: { [key: string]: any } = {};

  constructor(canvas: HTMLCanvasElement, settings: Partial<RenderSettings> = {}) {
    this.canvas = canvas;
    this.settings = {
      shadows: true,
      shadowMapSize: 2048,
      antialiasing: true,
      ambientOcclusion: true,
      bloom: true,
      toneMapping: true,
      hdr: true,
      anisotropicFiltering: 16,
      maxLights: 16,
      cullingEnabled: true,
      lodEnabled: true,
      ...settings,
    };

    this.stats = {
      frameTime: 0,
      drawCalls: 0,
      triangles: 0,
      vertices: 0,
      textureBinds: 0,
      stateChanges: 0,
    };

    // Initialize WebGL context
    const gl = canvas.getContext("webgl2", {
      alpha: false,
      depth: true,
      stencil: true,
      antialias: this.settings.antialiasing,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
      powerPreference: "high-performance",
    });

    if (!gl) {
      throw new Error("WebGL2 not supported");
    }

    this.gl = gl;
    this.textureManager = new TextureManager(gl);
    this.geometryManager = new GeometryManager(gl);

    this.initializeExtensions();
    this.setupDefaultState();
    this.createRenderTargets();
  }

  private initializeExtensions(): void {
    const gl = this.gl;

    // Required extensions
    const extensions = [
      "EXT_color_buffer_float",
      "EXT_texture_filter_anisotropic",
      "OES_texture_float_linear",
      "WEBGL_depth_texture",
      "WEBGL_draw_buffers",
    ];

    for (const ext of extensions) {
      this.extensions[ext] = gl.getExtension(ext);
      if (!this.extensions[ext] && ext.includes("EXT_color_buffer_float")) {
        logger.warn(`Extension ${ext} not supported - HDR disabled`);
        this.settings.hdr = false;
      }
    }
  }

  private setupDefaultState(): void {
    const gl = this.gl;

    // Enable depth testing
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);

    // Enable culling
    if (this.settings.cullingEnabled) {
      gl.enable(gl.CULL_FACE);
      gl.cullFace(gl.BACK);
      gl.frontFace(gl.CCW);
    }

    // Enable blending for transparency
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // Set clear color
    gl.clearColor(0.1, 0.1, 0.1, 1.0);

    // Enable seamless cubemap filtering
    if (this.extensions["EXT_texture_filter_anisotropic"]) {
      const ext = gl.getExtension('EXT_texture_filter_anisotropic');
      if (ext) {
        gl.texParameterf(
          gl.TEXTURE_2D,
          ext.TEXTURE_MAX_ANISOTROPY_EXT,
          this.settings.anisotropicFiltering,
        );
      }
    }
  }

  private createRenderTargets(): void {
    const gl = this.gl;
    const width = this.canvas.width;
    const height = this.canvas.height;

    // Shadow map target
    if (this.settings.shadows) {
      this.shadowMapTarget = new RenderTarget(
        gl,
        this.settings.shadowMapSize,
        this.settings.shadowMapSize,
        {
          colorFormat: gl.RGBA,
          depthFormat: gl.DEPTH_COMPONENT24,
          filter: gl.LINEAR,
          wrap: gl.CLAMP_TO_EDGE,
        },
      );
    }

    // HDR target
    if (this.settings.hdr) {
      this.hdrTarget = new RenderTarget(gl, width, height, {
        colorFormat: gl.RGBA16F,
        depthFormat: gl.DEPTH_COMPONENT24,
        filter: gl.LINEAR,
        wrap: gl.CLAMP_TO_EDGE,
      });
    }

    // Post-process targets for effects
    const targetCount = 2; // Ping-pong buffers
    for (let i = 0; i < targetCount; i++) {
      this.postProcessTargets.push(
        new RenderTarget(gl, width, height, {
          colorFormat: this.settings.hdr ? gl.RGBA16F : gl.RGBA,
          filter: gl.LINEAR,
          wrap: gl.CLAMP_TO_EDGE,
        }),
      );
    }
  }

  // Main render function
  render(scene: any, camera: Camera): void {
    const startTime = performance.now();
    this.resetStats();

    this.updateMatrices(camera);
    this.updateLighting(scene.lights || []);

    // Shadow pass
    if (this.settings.shadows && this.shadowMapTarget) {
      this.renderShadowMap(scene, camera);
    }

    // Main pass
    const target = this.settings.hdr ? this.hdrTarget : null;
    this.renderScene(scene, camera, target);

    // Post-processing
    if (this.settings.hdr || this.settings.bloom || this.settings.toneMapping) {
      this.renderPostProcess();
    }

    this.stats.frameTime = performance.now() - startTime;
  }

  private updateMatrices(camera: Camera): void {
    camera.updateMatrices();
    mat4.copy(this.viewMatrix, camera.viewMatrix);
    mat4.copy(this.projectionMatrix, camera.projectionMatrix);
  }

  private updateLighting(lights: Light[]): void {
    this.lights = lights.slice(0, this.settings.maxLights);

    for (let i = 0; i < this.lights.length; i++) {
      const light = this.lights[i];
      const offset3 = i * 3;
      const offset4 = i * 4;

      if (!light) {continue;}

      // Position
      this.lightUniforms.positions[offset3] = light.position?.[0] ?? 0;
      this.lightUniforms.positions[offset3 + 1] = light.position?.[1] ?? 0;
      this.lightUniforms.positions[offset3 + 2] = light.position?.[2] ?? 0;

      // Color
      this.lightUniforms.colors[offset3] = light.color?.[0] ?? 1;
      this.lightUniforms.colors[offset3 + 1] = light.color?.[1] ?? 1;
      this.lightUniforms.colors[offset3 + 2] = light.color?.[2] ?? 1;

      // Direction (for directional/spot lights)
      this.lightUniforms.directions[offset3] = light.direction?.[0] ?? 0;
      this.lightUniforms.directions[offset3 + 1] = light.direction?.[1] ?? -1;
      this.lightUniforms.directions[offset3 + 2] = light.direction?.[2] ?? 0;

      // Properties: intensity, range, spotAngle, type
      this.lightUniforms.properties[offset4] = light.intensity ?? 1;
      this.lightUniforms.properties[offset4 + 1] = light.range ?? 100;
      this.lightUniforms.properties[offset4 + 2] = light.spotAngle ?? 0;
      this.lightUniforms.properties[offset4 + 3] = light.type ?? 0; // 0=directional, 1=point, 2=spot
    }
  }

  private renderShadowMap(scene: any, camera: Camera): void {
    if (!this.shadowMapTarget) {return;}

    const gl = this.gl;
    this.shadowMapTarget.bind();

    gl.viewport(0, 0, this.settings.shadowMapSize, this.settings.shadowMapSize);
    gl.clear(gl.DEPTH_BUFFER_BIT);

    // Use shadow shader
    const shadowShader = this.getShader("shadow");
    this.bindShader(shadowShader);

    // Render scene from light's perspective
    const directionalLights = this.lights.filter((light) => light?.type === 0);
    if (directionalLights.length > 0) {
      const light = directionalLights[0];
      if (light) {
        this.renderSceneWithShader(scene, light.shadowCamera || camera, shadowShader);
      }
    }

    this.shadowMapTarget.unbind();
  }

  private renderScene(scene: any, camera: Camera, target: RenderTarget | null): void {
    const gl = this.gl;

    if (target) {
      target.bind();
    }

    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Render opaque objects first
    this.renderObjects(scene.opaqueObjects || [], camera, false);

    // Render transparent objects (back to front)
    this.renderObjects(scene.transparentObjects || [], camera, true);

    if (target) {
      target.unbind();
    }
  }

  private renderObjects(objects: any[], camera: Camera, transparent: boolean): void {
    const gl = this.gl;

    // Sort objects if transparent
    if (transparent) {
      objects.sort((a, b) => {
        const distA = vec3.squaredDistance(camera.position, a.position);
        const distB = vec3.squaredDistance(camera.position, b.position);
        return distB - distA; // Back to front
      });

      gl.depthMask(false); // Disable depth writes for transparent objects
    }

    for (const obj of objects) {
      this.renderObject(obj, camera);
    }

    if (transparent) {
      gl.depthMask(true); // Re-enable depth writes
    }
  }

  private renderObject(object: any, camera: Camera): void {
    const gl = this.gl;

    // Frustum culling
    if (this.settings.cullingEnabled && !this.isInFrustum(object, camera)) {
      return;
    }

    // LOD selection
    const mesh = this.settings.lodEnabled ? this.selectLOD(object, camera) : object.mesh;
    if (!mesh) {return;}

    // Update model matrix
    this.updateModelMatrix(object);

    // Bind material and shader
    this.bindMaterial(object.material);

    // Bind geometry
    this.geometryManager.bindMesh(mesh);

    // Draw
    gl.drawElements(gl.TRIANGLES, mesh.indexCount, gl.UNSIGNED_SHORT, 0);

    this.stats.drawCalls++;
    this.stats.triangles += mesh.indexCount / 3;
    this.stats.vertices += mesh.vertexCount;
  }

  private renderPostProcess(): void {
    if (!this.hdrTarget) {return;}

    const _gl = this.gl;
    let currentSource = this.hdrTarget;
    let currentTarget = this.postProcessTargets[0];

    // Bloom pass
    if (this.settings.bloom) {
      // Extract bright pixels
      if (currentTarget) {
        this.renderFullscreenQuad(currentSource, currentTarget, "bloom_extract");
        [currentSource, currentTarget] = [currentTarget, currentSource];
      }

      // Blur passes
      for (let i = 0; i < 4; i++) {
        if (currentTarget) {
          this.renderFullscreenQuad(currentSource, currentTarget, "blur_horizontal");
          [currentSource, currentTarget] = [currentTarget, currentSource];
        }
        if (currentTarget) {
          this.renderFullscreenQuad(currentSource, currentTarget, "blur_vertical");
          [currentSource, currentTarget] = [currentTarget, currentSource];
        }
      }

      // Combine with original
      this.renderFullscreenQuad(currentSource, null, "bloom_combine", this.hdrTarget);
    }

    // Tone mapping
    if (this.settings.toneMapping) {
      this.renderFullscreenQuad(currentSource, null, "tonemap");
    }
  }

  private renderFullscreenQuad(
    source: RenderTarget,
    target: RenderTarget | null,
    shaderName: string,
    additionalTexture?: RenderTarget,
  ): void {
    const gl = this.gl;
    const shader = this.getShader(shaderName);

    if (target) {
      target.bind();
    }

    this.bindShader(shader);

    // Bind source texture
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, source.colorTexture);
    gl.uniform1i(shader.getUniformLocation("u_texture"), 0);

    if (additionalTexture) {
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, additionalTexture.colorTexture);
      gl.uniform1i(shader.getUniformLocation("u_additionalTexture"), 1);
    }

    // Render fullscreen quad
    this.geometryManager.renderFullscreenQuad();

    if (target) {
      target.unbind();
    }
  }

  private updateModelMatrix(object: any): void {
    mat4.fromRotationTranslationScale(
      this.modelMatrix,
      object.rotation || quat.create(),
      object.position || vec3.create(),
      object.scale || vec3.fromValues(1, 1, 1),
    );

    // Update MVP matrix
    mat4.multiply(this.mvpMatrix, this.viewMatrix, this.modelMatrix);
    mat4.multiply(this.mvpMatrix, this.projectionMatrix, this.mvpMatrix);
  }

  private bindMaterial(material: Material): void {
    if (this.currentMaterial === material) {return;}

    this.currentMaterial = material;
    const shader = this.getShader(material.shaderName);
    this.bindShader(shader);

    // Bind textures
    material.bindTextures(this.gl, this.textureManager);

    // Set uniforms
    material.setUniforms(shader);

    this.stats.stateChanges++;
  }

  private bindShader(shader: ShaderProgram): void {
    if (this.currentShader === shader) {return;}

    this.currentShader = shader;
    shader.use();

    // Set common uniforms
    shader.setUniformMatrix4fv("u_mvpMatrix", this.mvpMatrix);
    shader.setUniformMatrix4fv("u_modelMatrix", this.modelMatrix);
    shader.setUniformMatrix4fv("u_viewMatrix", this.viewMatrix);
    shader.setUniformMatrix4fv("u_projectionMatrix", this.projectionMatrix);

    // Set lighting uniforms
    shader.setUniform3fv("u_lightPositions", this.lightUniforms.positions);
    shader.setUniform3fv("u_lightColors", this.lightUniforms.colors);
    shader.setUniform3fv("u_lightDirections", this.lightUniforms.directions);
    shader.setUniform4fv("u_lightProperties", this.lightUniforms.properties);
    shader.setUniform1i("u_numLights", this.lights.length);

    this.stats.stateChanges++;
  }

  private getShader(name: string): ShaderProgram {
    if (!this.shaderCache.has(name)) {
      const shader = this.createShader(name);
      this.shaderCache.set(name, shader);
    }
    return this.shaderCache.get(name)!;
  }

  private createShader(_name: string): ShaderProgram {
    // Shader creation logic would go here
    // For now, return a placeholder
    return new ShaderProgram(this.gl, "", "");
  }

  private renderSceneWithShader(_scene: any, _camera: Camera, _shader: ShaderProgram): void {
    // Implementation for rendering with specific shader
  }

  private isInFrustum(_object: any, _camera: Camera): boolean {
    // Frustum culling implementation
    return true; // Simplified for now
  }

  private selectLOD(object: any, camera: Camera): any {
    // LOD selection based on distance
    const distance = vec3.distance(camera.position, object.position);

    if (distance < 50) {return object.meshLOD0;}
    if (distance < 100) {return object.meshLOD1;}
    if (distance < 200) {return object.meshLOD2;}
    return object.meshLOD3;
  }

  private resetStats(): void {
    this.stats.drawCalls = 0;
    this.stats.triangles = 0;
    this.stats.vertices = 0;
    this.stats.textureBinds = 0;
    this.stats.stateChanges = 0;
  }

  // Public API
  resize(width: number, height: number): void {
    this.canvas.width = width;
    this.canvas.height = height;
    this.gl.viewport(0, 0, width, height);

    // Recreate render targets
    if (this.hdrTarget) {
      this.hdrTarget.resize(width, height);
    }

    for (const target of this.postProcessTargets) {
      target.resize(width, height);
    }
  }

  getStats(): RenderStats {
    return { ...this.stats };
  }

  getSettings(): RenderSettings {
    return { ...this.settings };
  }

  updateSettings(settings: Partial<RenderSettings>): void {
    Object.assign(this.settings, settings);

    // Recreate render targets if needed
    if (settings.shadowMapSize && this.shadowMapTarget) {
      this.shadowMapTarget.resize(settings.shadowMapSize, settings.shadowMapSize);
    }
  }

  dispose(): void {
    // Cleanup resources
    this.shadowMapTarget?.dispose();
    this.hdrTarget?.dispose();
    this.postProcessTargets.forEach((target) => target.dispose());

    for (const shader of this.shaderCache.values()) {
      shader.dispose();
    }

    this.textureManager.dispose();
    this.geometryManager.dispose();
  }
}
