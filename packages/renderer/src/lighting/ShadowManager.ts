import { Light, LightType } from "../engine/Light";
import { RenderTarget } from "../engine/RenderTarget";
import { Camera } from "../engine/Camera";
import { mat4, vec3 } from "gl-matrix";

export interface ShadowMapConfig {
  resolution: number;
  cascadeCount?: number; // For CSM
  splitLambda?: number; // For CSM split calculation
  bias: number;
  normalBias: number;
  softShadows: boolean;
  pcfSamples?: number;
  cascadeBlendDistance?: number;
}

export interface ShadowData {
  light: Light;
  shadowMap: RenderTarget;
  lightViewMatrix: mat4;
  lightProjectionMatrix: mat4;
  shadowMatrix: mat4; // Transform from world to shadow map space
  cascades?: ShadowCascade[]; // For cascaded shadow maps
  config: ShadowMapConfig;
}

export interface ShadowCascade {
  viewMatrix: mat4;
  projectionMatrix: mat4;
  shadowMatrix: mat4;
  splitDistance: number;
  renderTarget: RenderTarget;
}

export class ShadowManager {
  private gl: WebGL2RenderingContext;
  private shadowMaps = new Map<string, ShadowData>();
  private defaultConfig: ShadowMapConfig = {
    resolution: 2048,
    cascadeCount: 4,
    splitLambda: 0.5,
    bias: 0.001,
    normalBias: 0.01,
    softShadows: true,
    pcfSamples: 16,
    cascadeBlendDistance: 0.1,
  };

  // Shadow map texture array for efficient binding
  private shadowMapArray: WebGLTexture | null = null;
  private maxShadowMaps = 16;
  private currentShadowMapCount = 0;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.initializeShadowMapArray();
  }

  private initializeShadowMapArray(): void {
    const gl = this.gl;

    this.shadowMapArray = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.shadowMapArray);

    // Initialize texture array
    gl.texImage3D(
      gl.TEXTURE_2D_ARRAY,
      0,
      gl.DEPTH_COMPONENT24,
      this.defaultConfig.resolution,
      this.defaultConfig.resolution,
      this.maxShadowMaps,
      0,
      gl.DEPTH_COMPONENT,
      gl.UNSIGNED_INT,
      null,
    );

    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
  }

  createShadowMap(light: Light, config?: Partial<ShadowMapConfig>): ShadowData {
    const finalConfig = { ...this.defaultConfig, ...config };
    const lightId = light.id;

    // Remove existing shadow map if it exists
    this.removeShadowMap(lightId);

    let shadowData: ShadowData;

    switch (light.type) {
      case LightType.DIRECTIONAL:
        shadowData = this.createDirectionalShadowMap(light, finalConfig);
        break;
      case LightType.SPOT:
        shadowData = this.createSpotShadowMap(light, finalConfig);
        break;
      case LightType.POINT:
        shadowData = this.createPointShadowMap(light, finalConfig);
        break;
      default:
        throw new Error(`Shadow maps not supported for light type: ${light.type}`);
    }

    this.shadowMaps.set(lightId, shadowData);
    return shadowData;
  }

  private createDirectionalShadowMap(light: Light, config: ShadowMapConfig): ShadowData {
    if (config.cascadeCount && config.cascadeCount > 1) {
      return this.createCascadedShadowMap(light, config);
    }

    const shadowMap = new RenderTarget(this.gl, {
      width: config.resolution,
      height: config.resolution,
      hasDepthBuffer: true,
      depthFormat: this.gl.DEPTH_COMPONENT24,
      colorBuffers: [], // Depth-only rendering
    });

    // Calculate light view and projection matrices
    const lightViewMatrix = mat4.create();
    const lightProjectionMatrix = mat4.create();
    const shadowMatrix = mat4.create();

    this.calculateDirectionalLightMatrices(
      light,
      lightViewMatrix,
      lightProjectionMatrix,
      shadowMatrix,
    );

    return {
      light,
      shadowMap,
      lightViewMatrix,
      lightProjectionMatrix,
      shadowMatrix,
      config,
    };
  }

  private createCascadedShadowMap(light: Light, config: ShadowMapConfig): ShadowData {
    const cascadeCount = config.cascadeCount!;
    const cascades: ShadowCascade[] = [];

    // Create render targets for each cascade
    for (let i = 0; i < cascadeCount; i++) {
      const renderTarget = new RenderTarget(this.gl, {
        width: config.resolution,
        height: config.resolution,
        hasDepthBuffer: true,
        depthFormat: this.gl.DEPTH_COMPONENT24,
        colorBuffers: [],
      });

      cascades.push({
        viewMatrix: mat4.create(),
        projectionMatrix: mat4.create(),
        shadowMatrix: mat4.create(),
        splitDistance: 0, // Will be calculated later
        renderTarget,
      });
    }

    // Main shadow map (combined)
    const shadowMap = new RenderTarget(this.gl, {
      width: config.resolution * 2, // 2x2 grid for 4 cascades
      height: config.resolution * 2,
      hasDepthBuffer: true,
      depthFormat: this.gl.DEPTH_COMPONENT24,
      colorBuffers: [],
    });

    return {
      light,
      shadowMap,
      lightViewMatrix: mat4.create(),
      lightProjectionMatrix: mat4.create(),
      shadowMatrix: mat4.create(),
      cascades,
      config,
    };
  }

  private createSpotShadowMap(light: Light, config: ShadowMapConfig): ShadowData {
    const shadowMap = new RenderTarget(this.gl, {
      width: config.resolution,
      height: config.resolution,
      hasDepthBuffer: true,
      depthFormat: this.gl.DEPTH_COMPONENT24,
      colorBuffers: [],
    });

    const lightViewMatrix = mat4.create();
    const lightProjectionMatrix = mat4.create();
    const shadowMatrix = mat4.create();

    this.calculateSpotLightMatrices(light, lightViewMatrix, lightProjectionMatrix, shadowMatrix);

    return {
      light,
      shadowMap,
      lightViewMatrix,
      lightProjectionMatrix,
      shadowMatrix,
      config,
    };
  }

  private createPointShadowMap(light: Light, config: ShadowMapConfig): ShadowData {
    // Point lights use cube maps
    const gl = this.gl;

    const cubeMapTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, cubeMapTexture);

    // Create cube map faces
    for (let i = 0; i < 6; i++) {
      gl.texImage2D(
        gl.TEXTURE_CUBE_MAP_POSITIVE_X + i,
        0,
        gl.DEPTH_COMPONENT24,
        config.resolution,
        config.resolution,
        0,
        gl.DEPTH_COMPONENT,
        gl.UNSIGNED_INT,
        null,
      );
    }

    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);

    // Create framebuffer for cube map rendering
    const framebuffer = gl.createFramebuffer();

    const shadowMap = {
      framebuffer,
      colorTexture: null,
      depthTexture: cubeMapTexture,
      width: config.resolution,
      height: config.resolution,
      bind: () => {
        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
        gl.viewport(0, 0, config.resolution, config.resolution);
      },
      unbind: () => {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      },
      resize: () => {}, // Cube maps don't resize
      dispose: () => {
        gl.deleteFramebuffer(framebuffer);
        gl.deleteTexture(cubeMapTexture);
      },
    } as RenderTarget;

    return {
      light,
      shadowMap,
      lightViewMatrix: mat4.create(),
      lightProjectionMatrix: mat4.create(),
      shadowMatrix: mat4.create(),
      config,
    };
  }

  updateCascadedShadowMap(shadowData: ShadowData, camera: Camera): void {
    if (!shadowData.cascades) return;

    const { cascades, config } = shadowData;
    const cascadeCount = cascades.length;

    // Calculate cascade split distances
    const nearPlane = camera.near;
    const farPlane = camera.far;
    const splitDistances = this.calculateCascadeSplits(
      nearPlane,
      farPlane,
      cascadeCount,
      config.splitLambda!,
    );

    // Update each cascade
    for (let i = 0; i < cascadeCount; i++) {
      const cascade = cascades[i];
      cascade.splitDistance = splitDistances[i + 1];

      // Calculate frustum for this cascade
      const frustumNear = i === 0 ? nearPlane : splitDistances[i];
      const frustumFar = splitDistances[i + 1];

      this.calculateCascadeMatrices(
        shadowData.light,
        camera,
        frustumNear,
        frustumFar,
        cascade.viewMatrix,
        cascade.projectionMatrix,
        cascade.shadowMatrix,
      );
    }
  }

  private calculateCascadeSplits(
    near: number,
    far: number,
    cascadeCount: number,
    lambda: number,
  ): number[] {
    const splits: number[] = [];
    splits.push(near);

    for (let i = 1; i < cascadeCount; i++) {
      const p = i / cascadeCount;
      const log = near * Math.pow(far / near, p);
      const uniform = near + (far - near) * p;
      const split = lambda * log + (1 - lambda) * uniform;
      splits.push(split);
    }

    splits.push(far);
    return splits;
  }

  private calculateDirectionalLightMatrices(
    light: Light,
    viewMatrix: mat4,
    projectionMatrix: mat4,
    shadowMatrix: mat4,
  ): void {
    const lightDirection = vec3.normalize(vec3.create(), light.direction!);
    const lightPosition = vec3.scale(vec3.create(), lightDirection, -100); // Far away position
    const up =
      Math.abs(lightDirection[1]) > 0.99 ? vec3.fromValues(1, 0, 0) : vec3.fromValues(0, 1, 0);
    const target = vec3.add(vec3.create(), lightPosition, lightDirection);

    mat4.lookAt(viewMatrix, lightPosition, target, up);

    // Use orthographic projection for directional lights
    const size = 50; // Scene bounds - should be calculated dynamically
    mat4.ortho(projectionMatrix, -size, size, -size, size, 1, 200);

    // Calculate shadow matrix (world to shadow map space)
    const biasMatrix = mat4.fromValues(
      0.5,
      0.0,
      0.0,
      0.0,
      0.0,
      0.5,
      0.0,
      0.0,
      0.0,
      0.0,
      0.5,
      0.0,
      0.5,
      0.5,
      0.5,
      1.0,
    );

    mat4.multiply(shadowMatrix, biasMatrix, projectionMatrix);
    mat4.multiply(shadowMatrix, shadowMatrix, viewMatrix);
  }

  private calculateSpotLightMatrices(
    light: Light,
    viewMatrix: mat4,
    projectionMatrix: mat4,
    shadowMatrix: mat4,
  ): void {
    const lightPosition = light.position!;
    const lightDirection = vec3.normalize(vec3.create(), light.direction!);
    const up =
      Math.abs(lightDirection[1]) > 0.99 ? vec3.fromValues(1, 0, 0) : vec3.fromValues(0, 1, 0);
    const target = vec3.add(vec3.create(), lightPosition, lightDirection);

    mat4.lookAt(viewMatrix, lightPosition, target, up);

    // Use perspective projection for spot lights
    const fov = light.outerConeAngle ? light.outerConeAngle * 2 : Math.PI / 4;
    mat4.perspective(projectionMatrix, fov, 1, 1, light.range || 100);

    // Calculate shadow matrix
    const biasMatrix = mat4.fromValues(
      0.5,
      0.0,
      0.0,
      0.0,
      0.0,
      0.5,
      0.0,
      0.0,
      0.0,
      0.0,
      0.5,
      0.0,
      0.5,
      0.5,
      0.5,
      1.0,
    );

    mat4.multiply(shadowMatrix, biasMatrix, projectionMatrix);
    mat4.multiply(shadowMatrix, shadowMatrix, viewMatrix);
  }

  private calculateCascadeMatrices(
    light: Light,
    camera: Camera,
    near: number,
    far: number,
    viewMatrix: mat4,
    projectionMatrix: mat4,
    shadowMatrix: mat4,
  ): void {
    // Calculate frustum corners for this cascade
    const corners = this.calculateFrustumCorners(camera, near, far);

    // Calculate bounding sphere of frustum corners
    const center = this.calculateBoundingSphere(corners);
    const radius = this.calculateBoundingRadius(corners, center);

    // Position light camera to encompass the frustum
    const lightDirection = vec3.normalize(vec3.create(), light.direction!);
    const lightPosition = vec3.scaleAndAdd(vec3.create(), center, lightDirection, -radius * 2);
    const up =
      Math.abs(lightDirection[1]) > 0.99 ? vec3.fromValues(1, 0, 0) : vec3.fromValues(0, 1, 0);

    mat4.lookAt(viewMatrix, lightPosition, center, up);

    // Create tight orthographic projection
    mat4.ortho(projectionMatrix, -radius, radius, -radius, radius, 0.1, radius * 4);

    // Calculate shadow matrix
    const biasMatrix = mat4.fromValues(
      0.5,
      0.0,
      0.0,
      0.0,
      0.0,
      0.5,
      0.0,
      0.0,
      0.0,
      0.0,
      0.5,
      0.0,
      0.5,
      0.5,
      0.5,
      1.0,
    );

    mat4.multiply(shadowMatrix, biasMatrix, projectionMatrix);
    mat4.multiply(shadowMatrix, shadowMatrix, viewMatrix);
  }

  private calculateFrustumCorners(camera: Camera, near: number, far: number): vec3[] {
    const aspect = camera.aspect;
    const tanFov = Math.tan(camera.fov / 2);

    const nearHeight = near * tanFov;
    const nearWidth = nearHeight * aspect;
    const farHeight = far * tanFov;
    const farWidth = farHeight * aspect;

    const cameraPos = camera.position;
    const forward = vec3.normalize(vec3.create(), camera.getForward());
    const right = vec3.normalize(vec3.create(), camera.getRight());
    const up = vec3.normalize(vec3.create(), camera.getUp());

    const nearCenter = vec3.scaleAndAdd(vec3.create(), cameraPos, forward, near);
    const farCenter = vec3.scaleAndAdd(vec3.create(), cameraPos, forward, far);

    const corners: vec3[] = [];

    // Near plane corners
    corners.push(
      vec3.add(
        vec3.create(),
        vec3.scaleAndAdd(vec3.create(), nearCenter, right, -nearWidth),
        vec3.scale(vec3.create(), up, nearHeight),
      ),
    ); // Top left
    corners.push(
      vec3.add(
        vec3.create(),
        vec3.scaleAndAdd(vec3.create(), nearCenter, right, nearWidth),
        vec3.scale(vec3.create(), up, nearHeight),
      ),
    ); // Top right
    corners.push(
      vec3.add(
        vec3.create(),
        vec3.scaleAndAdd(vec3.create(), nearCenter, right, -nearWidth),
        vec3.scale(vec3.create(), up, -nearHeight),
      ),
    ); // Bottom left
    corners.push(
      vec3.add(
        vec3.create(),
        vec3.scaleAndAdd(vec3.create(), nearCenter, right, nearWidth),
        vec3.scale(vec3.create(), up, -nearHeight),
      ),
    ); // Bottom right

    // Far plane corners
    corners.push(
      vec3.add(
        vec3.create(),
        vec3.scaleAndAdd(vec3.create(), farCenter, right, -farWidth),
        vec3.scale(vec3.create(), up, farHeight),
      ),
    ); // Top left
    corners.push(
      vec3.add(
        vec3.create(),
        vec3.scaleAndAdd(vec3.create(), farCenter, right, farWidth),
        vec3.scale(vec3.create(), up, farHeight),
      ),
    ); // Top right
    corners.push(
      vec3.add(
        vec3.create(),
        vec3.scaleAndAdd(vec3.create(), farCenter, right, -farWidth),
        vec3.scale(vec3.create(), up, -farHeight),
      ),
    ); // Bottom left
    corners.push(
      vec3.add(
        vec3.create(),
        vec3.scaleAndAdd(vec3.create(), farCenter, right, farWidth),
        vec3.scale(vec3.create(), up, -farHeight),
      ),
    ); // Bottom right

    return corners;
  }

  private calculateBoundingSphere(points: vec3[]): vec3 {
    const center = vec3.create();

    for (const point of points) {
      vec3.add(center, center, point);
    }

    vec3.scale(center, center, 1 / points.length);
    return center;
  }

  private calculateBoundingRadius(points: vec3[], center: vec3): number {
    let maxDistance = 0;

    for (const point of points) {
      const distance = vec3.distance(point, center);
      maxDistance = Math.max(maxDistance, distance);
    }

    return maxDistance;
  }

  getShadowData(lightId: string): ShadowData | null {
    return this.shadowMaps.get(lightId) || null;
  }

  getShadowMapTexture(): WebGLTexture | null {
    return this.shadowMapArray;
  }

  removeShadowMap(lightId: string): void {
    const shadowData = this.shadowMaps.get(lightId);
    if (shadowData) {
      shadowData.shadowMap.dispose();

      if (shadowData.cascades) {
        for (const cascade of shadowData.cascades) {
          cascade.renderTarget.dispose();
        }
      }

      this.shadowMaps.delete(lightId);
    }
  }

  bindShadowMapForReading(unit: number): void {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.shadowMapArray);
  }

  clear(): void {
    for (const lightId of this.shadowMaps.keys()) {
      this.removeShadowMap(lightId);
    }
  }

  dispose(): void {
    this.clear();

    if (this.shadowMapArray) {
      this.gl.deleteTexture(this.shadowMapArray);
      this.shadowMapArray = null;
    }
  }

  // Statistics and debugging
  getStats() {
    let totalMemory = 0;
    let cascadeCount = 0;

    for (const shadowData of this.shadowMaps.values()) {
      const resolution = shadowData.config.resolution;
      totalMemory += resolution * resolution * 4; // Depth buffer bytes

      if (shadowData.cascades) {
        cascadeCount += shadowData.cascades.length;
        totalMemory += shadowData.cascades.length * resolution * resolution * 4;
      }
    }

    return {
      activeShadowMaps: this.shadowMaps.size,
      totalCascades: cascadeCount,
      memoryUsage: totalMemory,
      maxShadowMaps: this.maxShadowMaps,
      averageResolution:
        this.shadowMaps.size > 0
          ? Array.from(this.shadowMaps.values()).reduce(
              (_sum, _data) => sum + data.config.resolution,
              0,
            ) / this.shadowMaps.size
          : 0,
    };
  }
}
