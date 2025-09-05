import { Light, LightType } from "../engine/Light";
import { ShadowManager, ShadowData, ShadowMapConfig } from "./ShadowManager";
import { Camera } from "../engine/Camera";
import { ShaderProgram } from "../engine/Shader";
import { mat4, vec3, vec4 } from "gl-matrix";

export interface LightingConfig {
  maxDirectionalLights: number;
  maxPointLights: number;
  maxSpotLights: number;
  maxAreaLights: number;
  enableShadows: boolean;
  enableIBL: boolean;
  ambientIntensity: number;
  ambientColor: [number, number, number];
  exposure: number;
  gamma: number;
}

export interface LightUniformData {
  // Light properties (vec4 for alignment)
  positions: Float32Array; // xyz = position, w = type
  directions: Float32Array; // xyz = direction, w = range
  colors: Float32Array; // xyz = color, w = intensity
  parameters: Float32Array; // x = innerCone, y = outerCone, z = falloff, w = shadowIndex
  shadowMatrices: Float32Array; // 4x4 matrices for shadow mapping
  cascadeSplits: Float32Array; // Cascade split distances for CSM
}

export interface IBLData {
  diffuseMap: WebGLTexture; // Irradiance cube map
  specularMap: WebGLTexture; // Pre-filtered environment map
  brdfLUT: WebGLTexture; // BRDF lookup table
  intensity: number;
  rotation: mat4;
}

export class LightingManager {
  private gl: WebGL2RenderingContext;
  private shadowManager: ShadowManager;
  private lights = new Map<string, Light>();
  private lightArray: Light[] = [];
  private config: LightingConfig;

  // Light categorization
  private directionalLights: Light[] = [];
  private pointLights: Light[] = [];
  private spotLights: Light[] = [];
  private areaLights: Light[] = [];

  // Uniform data
  private lightUniforms!: LightUniformData;
  private uniformBuffer: WebGLBuffer | null = null;
  private uniformBindingPoint = 1;

  // IBL
  private iblData: IBLData | null = null;

  // Statistics
  private stats = {
    totalLights: 0,
    shadowCastingLights: 0,
    culledLights: 0,
    renderTime: 0,
    shadowRenderTime: 0,
  };

  constructor(gl: WebGL2RenderingContext, config?: Partial<LightingConfig>) {
    this.gl = gl;
    this.shadowManager = new ShadowManager(gl);

    this.config = {
      maxDirectionalLights: 4,
      maxPointLights: 32,
      maxSpotLights: 16,
      maxAreaLights: 8,
      enableShadows: true,
      enableIBL: true,
      ambientIntensity: 0.1,
      ambientColor: [0.2, 0.2, 0.3],
      exposure: 1.0,
      gamma: 2.2,
      ...config,
    };

    this.initializeUniforms();
    this.createBRDFLUT();
  }

  private initializeUniforms(): void {
    const maxLights =
      this.config.maxDirectionalLights +
      this.config.maxPointLights +
      this.config.maxSpotLights +
      this.config.maxAreaLights;

    this.lightUniforms = {
      positions: new Float32Array(maxLights * 4),
      directions: new Float32Array(maxLights * 4),
      colors: new Float32Array(maxLights * 4),
      parameters: new Float32Array(maxLights * 4),
      shadowMatrices: new Float32Array(maxLights * 16), // 4x4 matrices
      cascadeSplits: new Float32Array(16), // Max 4 cascades per light
    };

    // Create uniform buffer
    const gl = this.gl;
    this.uniformBuffer = gl.createBuffer();

    if (this.uniformBuffer) {
      gl.bindBuffer(gl.UNIFORM_BUFFER, this.uniformBuffer);

      // Calculate buffer size
      const bufferSize =
        maxLights * 4 * 4 * 4 + // positions, directions, colors, parameters
        maxLights * 16 * 4 + // shadow matrices
        16 * 4 + // cascade splits
        16 * 4; // padding/other uniforms

      gl.bufferData(gl.UNIFORM_BUFFER, bufferSize, gl.DYNAMIC_DRAW);
      gl.bindBufferBase(gl.UNIFORM_BUFFER, this.uniformBindingPoint, this.uniformBuffer);
    }
  }

  addLight(light: Light): void {
    this.lights.set(light.id, light);
    this.categorizeLights();
    this.updateUniforms();

    // Create shadow map if light casts shadows
    if (this.config.enableShadows && light.castShadows) {
      const shadowConfig: Partial<ShadowMapConfig> = {
        resolution: light.type === LightType.DIRECTIONAL ? 4096 : 2048,
        cascadeCount: light.type === LightType.DIRECTIONAL ? 4 : 1,
        softShadows: true,
      };

      this.shadowManager.createShadowMap(light, shadowConfig);
      this.stats.shadowCastingLights++;
    }

    this.stats.totalLights++;
  }

  removeLight(lightId: string): void {
    const light = this.lights.get(lightId);
    if (light) {
      this.lights.delete(lightId);
      this.shadowManager.removeShadowMap(lightId);
      this.categorizeLights();
      this.updateUniforms();

      if (light.castShadows) {
        this.stats.shadowCastingLights--;
      }
      this.stats.totalLights--;
    }
  }

  getLight(lightId: string): Light | null {
    return this.lights.get(lightId) || null;
  }

  updateLight(lightId: string, updates: Partial<Light>): void {
    const light = this.lights.get(lightId);
    if (light) {
      Object.assign(light, updates);
      this.updateUniforms();

      // Update shadow map if needed
      if (this.config.enableShadows && light.castShadows) {
        const shadowData = this.shadowManager.getShadowData(lightId);
        if (shadowData) {
          // Shadow data will be updated during render
        }
      }
    }
  }

  private categorizeLights(): void {
    this.directionalLights = [];
    this.pointLights = [];
    this.spotLights = [];
    this.areaLights = [];
    this.lightArray = [];

    for (const light of this.lights.values()) {
      this.lightArray.push(light);

      switch (light.type) {
        case LightType.DIRECTIONAL:
          if (this.directionalLights.length < this.config.maxDirectionalLights) {
            this.directionalLights.push(light);
          }
          break;
        case LightType.POINT:
          if (this.pointLights.length < this.config.maxPointLights) {
            this.pointLights.push(light);
          }
          break;
        case LightType.SPOT:
          if (this.spotLights.length < this.config.maxSpotLights) {
            this.spotLights.push(light);
          }
          break;
        case LightType.AREA:
          if (this.areaLights.length < this.config.maxAreaLights) {
            this.areaLights.push(light);
          }
          break;
      }
    }
  }

  private updateUniforms(): void {
    let index = 0;

    // Pack light data
    for (const light of this.lightArray) {
      if (index >= this.lightUniforms.positions.length / 4) {break;}

      const baseIndex = index * 4;

      // Position (xyz) + type (w)
      if (light.position) {
        this.lightUniforms.positions[baseIndex] = light.position[0] ?? 0;
        this.lightUniforms.positions[baseIndex + 1] = light.position[1] ?? 0;
        this.lightUniforms.positions[baseIndex + 2] = light.position[2] ?? 0;
      }
      this.lightUniforms.positions[baseIndex + 3] = light.type;

      // Direction (xyz) + range (w)
      if (light.direction) {
        this.lightUniforms.directions[baseIndex] = light.direction[0] ?? 0;
        this.lightUniforms.directions[baseIndex + 1] = light.direction[1] ?? 0;
        this.lightUniforms.directions[baseIndex + 2] = light.direction[2] ?? 0;
      }
      this.lightUniforms.directions[baseIndex + 3] = light.range || 0;

      // Color (xyz) + intensity (w)
      this.lightUniforms.colors[baseIndex] = light.color[0] ?? 0;
      this.lightUniforms.colors[baseIndex + 1] = light.color[1] ?? 0;
      this.lightUniforms.colors[baseIndex + 2] = light.color[2] ?? 0;
      this.lightUniforms.colors[baseIndex + 3] = light.intensity;

      // Parameters: innerCone, outerCone, falloff, shadowIndex
      this.lightUniforms.parameters[baseIndex] = light.innerConeAngle || 0;
      this.lightUniforms.parameters[baseIndex + 1] = light.outerConeAngle || 0;
      this.lightUniforms.parameters[baseIndex + 2] = light.falloffExponent || 1;
      this.lightUniforms.parameters[baseIndex + 3] = light.castShadows ? index : -1;

      // Shadow matrix (if available)
      const shadowData = this.shadowManager.getShadowData(light.id);
      if (shadowData) {
        const matrixIndex = index * 16;
        for (let i = 0; i < 16; i++) {
          this.lightUniforms.shadowMatrices[matrixIndex + i] = shadowData.shadowMatrix[i] ?? 0;
        }
      }

      index++;
    }

    // Update GPU buffer
    this.uploadUniformData();
  }

  private uploadUniformData(): void {
    if (!this.uniformBuffer) {return;}

    const gl = this.gl;
    gl.bindBuffer(gl.UNIFORM_BUFFER, this.uniformBuffer);

    let offset = 0;

    // Upload positions
    gl.bufferSubData(gl.UNIFORM_BUFFER, offset, this.lightUniforms.positions);
    offset += this.lightUniforms.positions.byteLength;

    // Upload directions
    gl.bufferSubData(gl.UNIFORM_BUFFER, offset, this.lightUniforms.directions);
    offset += this.lightUniforms.directions.byteLength;

    // Upload colors
    gl.bufferSubData(gl.UNIFORM_BUFFER, offset, this.lightUniforms.colors);
    offset += this.lightUniforms.colors.byteLength;

    // Upload parameters
    gl.bufferSubData(gl.UNIFORM_BUFFER, offset, this.lightUniforms.parameters);
    offset += this.lightUniforms.parameters.byteLength;

    // Upload shadow matrices
    gl.bufferSubData(gl.UNIFORM_BUFFER, offset, this.lightUniforms.shadowMatrices);
    offset += this.lightUniforms.shadowMatrices.byteLength;

    // Upload cascade splits
    gl.bufferSubData(gl.UNIFORM_BUFFER, offset, this.lightUniforms.cascadeSplits);
  }

  cullLights(camera: Camera): Light[] {
    // Simple frustum culling placeholder - using camera position and direction
    const cameraPos = camera.position;
    const viewDistance = 100; // TODO: Get from camera far plane
    const culledLights: Light[] = [];
    this.stats.culledLights = 0;

    for (const light of this.lightArray) {
      if (this.isLightVisible(light, null)) {
        culledLights.push(light);
      } else {
        this.stats.culledLights++;
      }
    }

    return culledLights;
  }

  private isLightVisible(light: Light, _frustum: any): boolean {
    // Simplified frustum culling - in a real implementation you'd use proper frustum planes
    switch (light.type) {
      case LightType.DIRECTIONAL:
        return true; // Directional lights always visible

      case LightType.POINT:
        if (light.position && light.range) {
          // Check if point light sphere intersects frustum
          // Simplified check - implement proper sphere-frustum intersection
          return true;
        }
        break;

      case LightType.SPOT:
        if (light.position && light.direction && light.range) {
          // Check if spot light cone intersects frustum
          // Simplified check - implement proper cone-frustum intersection
          return true;
        }
        break;

      case LightType.AREA:
        if (light.position && light.width !== undefined && light.height !== undefined) {
          // Check if area light bounds intersect frustum
          return true;
        }
        break;
    }

    return false;
  }

  renderShadowMaps(camera: Camera, _renderScene: (shadowData: ShadowData) => void): void {
    const startTime = performance.now();

    for (const light of this.lightArray) {
      if (!light.castShadows) {continue;}

      const shadowData = this.shadowManager.getShadowData(light.id);
      if (!shadowData) {continue;}

      // Update cascade matrices for directional lights
      if (light.type === LightType.DIRECTIONAL && shadowData.cascades) {
        this.shadowManager.updateCascadedShadowMap(shadowData, camera);

        // Render each cascade
        for (const cascade of shadowData.cascades) {
          cascade.renderTarget.bind();

          // Set up shadow rendering state
          const gl = this.gl;
          gl.enable(gl.DEPTH_TEST);
          gl.depthFunc(gl.LESS);
          gl.colorMask(false, false, false, false);
          gl.clear(gl.DEPTH_BUFFER_BIT);

          // Create temporary shadow data for this cascade
          const cascadeShadowData: ShadowData = {
            ...shadowData,
            shadowMap: cascade.renderTarget,
            lightViewMatrix: cascade.viewMatrix,
            lightProjectionMatrix: cascade.projectionMatrix,
            shadowMatrix: cascade.shadowMatrix,
          };

          _renderScene(cascadeShadowData);
          cascade.renderTarget.unbind();
        }
      } else {
        // Render single shadow map
        shadowData.shadowMap.bind();

        const gl = this.gl;
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LESS);
        gl.colorMask(false, false, false, false);
        gl.clear(gl.DEPTH_BUFFER_BIT);

        _renderScene(shadowData);
        shadowData.shadowMap.unbind();
      }
    }

    // Restore rendering state
    const gl = this.gl;
    gl.colorMask(true, true, true, true);

    this.stats.shadowRenderTime = performance.now() - startTime;
  }

  bindLightingUniforms(shader: ShaderProgram): void {
    const gl = this.gl;

    // Bind uniform buffer
    if (this.uniformBuffer) {
      gl.bindBufferBase(gl.UNIFORM_BUFFER, this.uniformBindingPoint, this.uniformBuffer);
    }

    // Set light counts
    shader.setUniform1i("u_numDirectionalLights", this.directionalLights.length);
    shader.setUniform1i("u_numPointLights", this.pointLights.length);
    shader.setUniform1i("u_numSpotLights", this.spotLights.length);
    shader.setUniform1i("u_numAreaLights", this.areaLights.length);

    // Set ambient lighting
    shader.setUniform3fv("u_ambientColor", this.config.ambientColor);
    shader.setUniform1f("u_ambientIntensity", this.config.ambientIntensity);

    // Set camera exposure
    shader.setUniform1f("u_exposure", this.config.exposure);
    shader.setUniform1f("u_gamma", this.config.gamma);

    // Bind shadow maps
    if (this.config.enableShadows) {
      this.shadowManager.bindShadowMapForReading(10); // Use texture unit 10
      shader.setUniform1i("u_shadowMaps", 10);
    }

    // Bind IBL textures
    if (this.config.enableIBL && this.iblData) {
      gl.activeTexture(gl.TEXTURE0 + 11);
      gl.bindTexture(gl.TEXTURE_CUBE_MAP, this.iblData.diffuseMap);
      shader.setUniform1i("u_irradianceMap", 11);

      gl.activeTexture(gl.TEXTURE0 + 12);
      gl.bindTexture(gl.TEXTURE_CUBE_MAP, this.iblData.specularMap);
      shader.setUniform1i("u_prefilterMap", 12);

      gl.activeTexture(gl.TEXTURE0 + 13);
      gl.bindTexture(gl.TEXTURE_2D, this.iblData.brdfLUT);
      shader.setUniform1i("u_brdfLUT", 13);

      shader.setUniform1f("u_iblIntensity", this.iblData.intensity);
      shader.setUniform1f("u_iblRotation", 0); // TODO: Fix rotation matrix to scalar conversion
    }
  }

  // IBL setup
  async loadHDREnvironment(hdriPath: string, intensity: number = 1.0): Promise<void> {
    // Load HDRI texture
    const hdriTexture = await this.loadHDRITexture(hdriPath);

    // Generate IBL maps
    const diffuseMap = this.generateIrradianceMap(hdriTexture);
    const specularMap = this.generatePrefilterMap(hdriTexture);

    this.iblData = {
      diffuseMap,
      specularMap,
      brdfLUT: await this.getBRDFLUT(),
      intensity,
      rotation: mat4.create(),
    };

    // Clean up HDRI texture
    this.gl.deleteTexture(hdriTexture);
  }

  private async loadHDRITexture(_hdriPath: string): Promise<WebGLTexture> {
    // This is a placeholder - would need actual HDR loading
    // In practice, you'd use a library like THREE.js's HDR loader or implement HDRI parsing
    throw new Error("HDRI loading not implemented - would need HDR file format support");
  }

  private generateIrradianceMap(_hdriTexture: WebGLTexture): WebGLTexture {
    const gl = this.gl;
    const resolution = 32; // Low resolution for diffuse

    // Create cube map texture
    const irradianceMap = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, irradianceMap);

    for (let i = 0; i < 6; i++) {
      gl.texImage2D(
        gl.TEXTURE_CUBE_MAP_POSITIVE_X + i,
        0,
        gl.RGB16F,
        resolution,
        resolution,
        0,
        gl.RGB,
        gl.HALF_FLOAT,
        null,
      );
    }

    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);

    // Render irradiance using convolution shader
    // This would require a compute shader or render-to-texture setup
    // For now, return empty cube map

    return irradianceMap;
  }

  private generatePrefilterMap(_hdriTexture: WebGLTexture): WebGLTexture {
    const gl = this.gl;
    const resolution = 128; // Higher resolution for specular

    const prefilterMap = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, prefilterMap);

    // Generate mipmaps for different roughness levels
    const maxMipLevels = 5;
    for (let mip = 0; mip < maxMipLevels; mip++) {
      const mipResolution = resolution >> mip;

      for (let i = 0; i < 6; i++) {
        gl.texImage2D(
          gl.TEXTURE_CUBE_MAP_POSITIVE_X + i,
          mip,
          gl.RGB16F,
          mipResolution,
          mipResolution,
          0,
          gl.RGB,
          gl.HALF_FLOAT,
          null,
        );
      }
    }

    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);

    return prefilterMap;
  }

  private createBRDFLUT(): void {
    const gl = this.gl;
    const resolution = 512;

    const brdfTexture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, brdfTexture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RG16F,
      resolution,
      resolution,
      0,
      gl.RG,
      gl.HALF_FLOAT,
      null,
    );

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    // Render BRDF integration using compute shader or full-screen quad
    // For now, store reference to texture
    this.gl.deleteTexture(brdfTexture); // Cleanup placeholder
  }

  private async getBRDFLUT(): Promise<WebGLTexture> {
    // Return pre-computed BRDF LUT texture
    const gl = this.gl;
    const brdfTexture = gl.createTexture()!;

    // This would load a pre-computed BRDF LUT or generate it
    // For now, create a placeholder texture
    gl.bindTexture(gl.TEXTURE_2D, brdfTexture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RG8,
      1,
      1,
      0,
      gl.RG,
      gl.UNSIGNED_BYTE,
      new Uint8Array([255, 255]),
    );

    return brdfTexture;
  }

  setAmbientLight(color: [number, number, number], intensity: number): void {
    this.config.ambientColor = color;
    this.config.ambientIntensity = intensity;
  }

  setExposure(exposure: number): void {
    this.config.exposure = exposure;
  }

  getStats() {
    return {
      ...this.stats,
      shadowMapStats: this.shadowManager.getStats(),
      memoryUsage: this.getMemoryUsage(),
      lightDistribution: {
        directional: this.directionalLights.length,
        point: this.pointLights.length,
        spot: this.spotLights.length,
        area: this.areaLights.length,
      },
    };
  }

  private getMemoryUsage(): number {
    let memory = 0;

    // Uniform buffer
    if (this.uniformBuffer) {
      memory += this.lightUniforms.positions.byteLength;
      memory += this.lightUniforms.directions.byteLength;
      memory += this.lightUniforms.colors.byteLength;
      memory += this.lightUniforms.parameters.byteLength;
      memory += this.lightUniforms.shadowMatrices.byteLength;
      memory += this.lightUniforms.cascadeSplits.byteLength;
    }

    // IBL textures (rough estimate)
    if (this.iblData) {
      memory += 32 * 32 * 6 * 8; // Irradiance map (RGB16F)
      memory += 128 * 128 * 6 * 8 * 1.33; // Prefilter map with mipmaps
      memory += 512 * 512 * 2 * 2; // BRDF LUT (RG16F)
    }

    return memory;
  }

  clear(): void {
    this.lights.clear();
    this.categorizeLights();
    this.shadowManager.clear();
    this.stats = {
      totalLights: 0,
      shadowCastingLights: 0,
      culledLights: 0,
      renderTime: 0,
      shadowRenderTime: 0,
    };
  }

  dispose(): void {
    this.clear();
    this.shadowManager.dispose();

    const gl = this.gl;

    if (this.uniformBuffer) {
      gl.deleteBuffer(this.uniformBuffer);
      this.uniformBuffer = null;
    }

    if (this.iblData) {
      gl.deleteTexture(this.iblData.diffuseMap);
      gl.deleteTexture(this.iblData.specularMap);
      gl.deleteTexture(this.iblData.brdfLUT);
      this.iblData = null;
    }
  }
}
