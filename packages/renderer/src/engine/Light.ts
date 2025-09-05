import { vec3, mat4 } from "gl-matrix";
import { Camera, CameraType } from "./Camera";

export enum LightType {
  DIRECTIONAL = 0,
  POINT = 1,
  SPOT = 2,
  AREA = 3,
}

export interface LightProperties {
  type: LightType;
  color: vec3;
  intensity: number;
  range?: number;
  spotAngle?: number;
  spotPenumbra?: number;
  castShadows?: boolean;
  shadowBias?: number;
  shadowNormalBias?: number;
  shadowRadius?: number;
  shadowMapSize?: number;
}

export class Light {
  public id = Math.random().toString(36).substr(2, 9);
  public position = vec3.create();
  public direction = vec3.fromValues(0, -1, 0);
  public color = vec3.fromValues(1, 1, 1);
  public intensity = 1.0;
  public range = 100;
  public innerConeAngle = 0;
  public falloffExponent = 1;
  public width?: number;
  public height?: number;
  public spotAngle = Math.PI / 4;
  public outerConeAngle = Math.PI / 3;
  public spotPenumbra = 0.1;
  public type: LightType;

  // Shadow properties
  public castShadows = true;
  public shadowBias = 0.0005;
  public shadowNormalBias = 0.05;
  public shadowRadius = 1.0;
  public shadowMapSize = 1024;
  public shadowCamera: Camera | null = null;

  // Cached values
  private shadowMatrix = mat4.create();
  private lightViewMatrix = mat4.create();
  private lightProjectionMatrix = mat4.create();

  constructor(type: LightType, properties: Partial<LightProperties> = {}) {
    this.type = type;

    if (properties.color) {vec3.copy(this.color, properties.color);}
    if (properties.intensity !== undefined) {this.intensity = properties.intensity;}
    if (properties.range !== undefined) {this.range = properties.range;}
    if (properties.spotAngle !== undefined) {
      this.spotAngle = properties.spotAngle;
      this.outerConeAngle = properties.spotAngle * 1.2; // Default outer cone slightly larger
    }
    if (properties.spotPenumbra !== undefined) {this.spotPenumbra = properties.spotPenumbra;}
    if (properties.castShadows !== undefined) {this.castShadows = properties.castShadows;}
    if (properties.shadowBias !== undefined) {this.shadowBias = properties.shadowBias;}
    if (properties.shadowNormalBias !== undefined)
      {this.shadowNormalBias = properties.shadowNormalBias;}
    if (properties.shadowRadius !== undefined) {this.shadowRadius = properties.shadowRadius;}
    if (properties.shadowMapSize !== undefined) {this.shadowMapSize = properties.shadowMapSize;}

    this.createShadowCamera();
  }

  private createShadowCamera(): void {
    if (!this.castShadows) {return;}

    switch (this.type) {
      case LightType.DIRECTIONAL:
        this.shadowCamera = new Camera({
          type: CameraType.ORTHOGRAPHIC,
          left: -50,
          right: 50,
          top: 50,
          bottom: -50,
          near: 0.1,
          far: 200,
        });
        break;

      case LightType.SPOT:
        this.shadowCamera = new Camera({
          type: CameraType.PERSPECTIVE,
          fov: this.spotAngle * 2,
          aspect: 1,
          near: 0.1,
          far: this.range,
        });
        break;

      case LightType.POINT:
        // Point lights use cube shadow maps - create 6 cameras
        // For now, create one camera for the primary direction
        this.shadowCamera = new Camera({
          type: CameraType.PERSPECTIVE,
          fov: Math.PI / 2,
          aspect: 1,
          near: 0.1,
          far: this.range,
        });
        break;
    }
  }

  updateShadowCamera(): void {
    if (!this.shadowCamera) {return;}

    switch (this.type) {
      case LightType.DIRECTIONAL:
        {
          // Position camera along light direction
          const offset = vec3.create();
          vec3.scale(offset, this.direction, -100);
          vec3.add(offset, this.position, offset);

          this.shadowCamera.setPosition(offset[0] ?? 0, offset[1] ?? 0, offset[2] ?? 0);

          const target = vec3.create();
          vec3.add(target, offset, this.direction);
          this.shadowCamera.lookAt(target);
        }
        break;

      case LightType.SPOT:
        {
          this.shadowCamera.setPosition(this.position[0] ?? 0, this.position[1] ?? 0, this.position[2] ?? 0);

          const spotTarget = vec3.create();
          vec3.add(spotTarget, this.position, this.direction);
          this.shadowCamera.lookAt(spotTarget);
        }
        break;

      case LightType.POINT:
        this.shadowCamera.setPosition(this.position[0] ?? 0, this.position[1] ?? 0, this.position[2] ?? 0);
        // Point lights need special handling for omnidirectional shadows
        break;
    }

    this.shadowCamera.updateMatrices();
    this.updateShadowMatrix();
  }

  private updateShadowMatrix(): void {
    if (!this.shadowCamera) {return;}

    // Create shadow matrix for transforming world coordinates to shadow map coordinates
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

    mat4.multiply(this.shadowMatrix, biasMatrix, this.shadowCamera.viewProjectionMatrix);
  }

  // Light-specific calculations
  calculateAttenuation(distance: number): number {
    if (this.type === LightType.DIRECTIONAL) {
      return 1.0; // No attenuation for directional lights
    }

    if (distance >= this.range) {
      return 0.0;
    }

    // Physically-based inverse square law with smooth cutoff
    const distanceRatio = distance / this.range;
    const attenuation = 1.0 / (1.0 + distance * distance);
    const cutoff = Math.max(0, 1.0 - distanceRatio * distanceRatio);

    return attenuation * cutoff * cutoff;
  }

  calculateSpotAttenuation(lightDirection: vec3, surfaceToLight: vec3): number {
    if (this.type !== LightType.SPOT) {
      return 1.0;
    }

    const cosAngle = vec3.dot(lightDirection, surfaceToLight);
    const outerCos = Math.cos(this.spotAngle);
    const innerCos = Math.cos(this.spotAngle * (1.0 - this.spotPenumbra));

    if (cosAngle < outerCos) {
      return 0.0;
    }

    if (cosAngle > innerCos) {
      return 1.0;
    }

    // Smooth transition between inner and outer cone
    const t = (cosAngle - outerCos) / (innerCos - outerCos);
    return t * t * (3.0 - 2.0 * t); // Smoothstep
  }

  // Utility methods
  setPosition(x: number, y: number, z: number): void {
    vec3.set(this.position, x, y, z);
  }

  setDirection(x: number, y: number, z: number): void {
    vec3.set(this.direction, x, y, z);
    vec3.normalize(this.direction, this.direction);
  }

  setColor(r: number, g: number, b: number): void {
    vec3.set(this.color, r, g, b);
  }

  setIntensity(intensity: number): void {
    this.intensity = Math.max(0, intensity);
  }

  setRange(range: number): void {
    this.range = Math.max(0.1, range);
    if (this.shadowCamera && this.type !== LightType.DIRECTIONAL) {
      // Update camera far plane
      this.shadowCamera.settings.far = this.range;
      this.shadowCamera.updateProjectionMatrix();
    }
  }

  setSpotAngle(angle: number): void {
    this.spotAngle = Math.max(0.01, Math.min(Math.PI, angle));
    if (this.shadowCamera && this.type === LightType.SPOT) {
      // Update camera FOV
      this.shadowCamera.settings.fov = this.spotAngle * 2;
      this.shadowCamera.updateProjectionMatrix();
    }
  }

  getShadowMatrix(): mat4 {
    return this.shadowMatrix;
  }

  clone(): Light {
    const cloned = new Light(this.type, {
      color: vec3.clone(this.color),
      intensity: this.intensity,
      range: this.range,
      spotAngle: this.spotAngle,
      spotPenumbra: this.spotPenumbra,
      castShadows: this.castShadows,
      shadowBias: this.shadowBias,
      shadowNormalBias: this.shadowNormalBias,
      shadowRadius: this.shadowRadius,
      shadowMapSize: this.shadowMapSize,
    });

    vec3.copy(cloned.position, this.position);
    vec3.copy(cloned.direction, this.direction);

    return cloned;
  }

  // Static factory methods
  static createDirectionalLight(
    direction: vec3 = vec3.fromValues(0, -1, 0),
    color: vec3 = vec3.fromValues(1, 1, 1),
    intensity: number = 1.0,
  ): Light {
    const light = new Light(LightType.DIRECTIONAL, {
      color: vec3.clone(color),
      intensity,
    });
    vec3.copy(light.direction, direction);
    vec3.normalize(light.direction, light.direction);
    return light;
  }

  static createPointLight(
    position: vec3,
    color: vec3 = vec3.fromValues(1, 1, 1),
    intensity: number = 1.0,
    range: number = 10.0,
  ): Light {
    const light = new Light(LightType.POINT, {
      color: vec3.clone(color),
      intensity,
      range,
    });
    vec3.copy(light.position, position);
    return light;
  }

  static createSpotLight(
    position: vec3,
    direction: vec3,
    color: vec3 = vec3.fromValues(1, 1, 1),
    intensity: number = 1.0,
    range: number = 10.0,
    spotAngle: number = Math.PI / 4,
  ): Light {
    const light = new Light(LightType.SPOT, {
      color: vec3.clone(color),
      intensity,
      range,
      spotAngle,
    });
    vec3.copy(light.position, position);
    vec3.copy(light.direction, direction);
    vec3.normalize(light.direction, light.direction);
    return light;
  }

  static createAreaLight(
    position: vec3,
    direction: vec3,
    color: vec3 = vec3.fromValues(1, 1, 1),
    intensity: number = 1.0,
    range: number = 10.0,
  ): Light {
    const light = new Light(LightType.AREA, {
      color: vec3.clone(color),
      intensity,
      range,
    });
    vec3.copy(light.position, position);
    vec3.copy(light.direction, direction);
    vec3.normalize(light.direction, light.direction);
    return light;
  }
}
