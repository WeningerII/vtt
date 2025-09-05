import { vec3, vec4 } from "gl-matrix";
import { TextureManager } from "./TextureManager";
import { ShaderProgram } from "./Shader";

export interface MaterialProperties {
  albedo?: vec3;
  metallic?: number;
  roughness?: number;
  normalScale?: number;
  emissive?: vec3;
  emissiveIntensity?: number;
  opacity?: number;
  alphaTest?: number;
  doubleSided?: boolean;
  transparent?: boolean;
  depthWrite?: boolean;
  depthTest?: boolean;
  blendMode?: BlendMode;
  cullMode?: CullMode;
}

export interface MaterialTextures {
  albedoMap?: string;
  normalMap?: string;
  metallicRoughnessMap?: string;
  emissiveMap?: string;
  occlusionMap?: string;
  heightMap?: string;
  detailNormalMap?: string;
  detailAlbedoMap?: string;
  cubeMap?: string;
}

export enum BlendMode {
  OPAQUE = "OPAQUE",
  ALPHA_BLEND = "ALPHA_BLEND",
  ADDITIVE = "ADDITIVE",
  MULTIPLY = "MULTIPLY",
  PREMULTIPLIED_ALPHA = "PREMULTIPLIED_ALPHA",
}

export enum CullMode {
  NONE = "NONE",
  FRONT = "FRONT",
  BACK = "BACK",
}

export class Material {
  public shaderName: string;
  public properties: MaterialProperties;
  public textures: MaterialTextures;
  public uniformValues = new Map<string, any>();

  private gl: WebGL2RenderingContext;
  private textureSlots = new Map<string, number>();
  private nextTextureSlot = 0;

  constructor(
    gl: WebGL2RenderingContext,
    shaderName: string = "pbr",
    properties: MaterialProperties = {},
    textures: MaterialTextures = {},
  ) {
    this.gl = gl;
    this.shaderName = shaderName;
    this.properties = {
      albedo: vec3.fromValues(1.0, 1.0, 1.0),
      metallic: 0.0,
      roughness: 0.5,
      normalScale: 1.0,
      emissive: vec3.fromValues(0.0, 0.0, 0.0),
      emissiveIntensity: 1.0,
      opacity: 1.0,
      alphaTest: 0.5,
      doubleSided: false,
      transparent: false,
      depthWrite: true,
      depthTest: true,
      blendMode: BlendMode.OPAQUE,
      cullMode: CullMode.BACK,
      ...properties,
    };
    this.textures = { ...textures };

    this.setupTextureSlots();
  }

  private setupTextureSlots(): void {
    const textureNames = [
      "albedoMap",
      "normalMap",
      "metallicRoughnessMap",
      "emissiveMap",
      "occlusionMap",
      "heightMap",
      "detailNormalMap",
      "detailAlbedoMap",
      "cubeMap",
    ];

    for (const textureName of textureNames) {
      this.textureSlots.set(textureName, this.nextTextureSlot++);
    }
  }

  bindTextures(gl: WebGL2RenderingContext, textureManager: TextureManager): void {
    for (const [textureName, texturePath] of Object.entries(this.textures)) {
      if (!texturePath) {continue;}

      const slot = this.textureSlots.get(textureName);
      if (slot === undefined) {continue;}

      gl.activeTexture(gl.TEXTURE0 + slot);

      const texture = textureManager.getTexture(texturePath);
      if (texture) {
        gl.bindTexture(gl.TEXTURE_2D, texture);
      } else {
        // Bind default texture
        gl.bindTexture(gl.TEXTURE_2D, textureManager.getDefaultTexture(textureName));
      }
    }
  }

  setUniforms(shader: ShaderProgram): void {
    // Material properties
    shader.setUniform3f(
      "u_albedo",
      this.properties.albedo?.[0] ?? 1,
      this.properties.albedo?.[1] ?? 1,
      this.properties.albedo?.[2] ?? 1,
    );
    shader.setUniform1f("u_metallic", this.properties.metallic ?? 0);
    shader.setUniform1f("u_roughness", this.properties.roughness ?? 1);
    shader.setUniform1f("u_normalScale", this.properties.normalScale ?? 1);
    shader.setUniform3f(
      "u_emissive",
      this.properties.emissive?.[0] ?? 0,
      this.properties.emissive?.[1] ?? 0,
      this.properties.emissive?.[2] ?? 0,
    );
    shader.setUniform1f("u_emissiveIntensity", this.properties.emissiveIntensity ?? 1);
    shader.setUniform1f("u_opacity", this.properties.opacity ?? 1);
    shader.setUniform1f("u_alphaTest", this.properties.alphaTest ?? 0);

    // Texture samplers
    for (const [textureName, slot] of this.textureSlots) {
      const uniformName = `u_${textureName}`;
      shader.setUniform1i(uniformName, slot);
    }

    // Texture flags
    shader.setUniform1i("u_hasAlbedoMap", this.textures.albedoMap ? 1 : 0);
    shader.setUniform1i("u_hasNormalMap", this.textures.normalMap ? 1 : 0);
    shader.setUniform1i("u_hasMetallicRoughnessMap", this.textures.metallicRoughnessMap ? 1 : 0);
    shader.setUniform1i("u_hasEmissiveMap", this.textures.emissiveMap ? 1 : 0);
    shader.setUniform1i("u_hasOcclusionMap", this.textures.occlusionMap ? 1 : 0);
    shader.setUniform1i("u_hasHeightMap", this.textures.heightMap ? 1 : 0);
    shader.setUniform1i("u_hasDetailNormalMap", this.textures.detailNormalMap ? 1 : 0);
    shader.setUniform1i("u_hasDetailAlbedoMap", this.textures.detailAlbedoMap ? 1 : 0);
    shader.setUniform1i("u_hasCubeMap", this.textures.cubeMap ? 1 : 0);

    // Custom uniform values
    for (const [name, value] of this.uniformValues) {
      this.setUniformValue(shader, name, value);
    }
  }

  private setUniformValue(shader: ShaderProgram, name: string, value: any): void {
    if (typeof value === "number") {
      shader.setUniform1f(name, value);
    } else if (Array.isArray(value)) {
      switch (value.length) {
        case 2:
          shader.setUniform2f(name, value[0], value[1]);
          break;
        case 3:
          shader.setUniform3f(name, value[0], value[1], value[2]);
          break;
        case 4:
          shader.setUniform4f(name, value[0], value[1], value[2], value[3]);
          break;
        default:
          shader.setUniform1fv(name, value);
      }
    } else if (value instanceof Float32Array) {
      if (value.length === 16) {
        shader.setUniformMatrix4fv(name, value);
      } else if (value.length === 9) {
        shader.setUniformMatrix3fv(name, value);
      } else if (value.length === 4) {
        shader.setUniformMatrix2fv(name, value);
      } else {
        shader.setUniform1fv(name, value);
      }
    }
  }

  setRenderState(gl: WebGL2RenderingContext): void {
    // Depth testing
    if (this.properties.depthTest) {
      gl.enable(gl.DEPTH_TEST);
    } else {
      gl.disable(gl.DEPTH_TEST);
    }

    // Depth writing
    gl.depthMask(this.properties.depthWrite!);

    // Face culling
    switch (this.properties.cullMode) {
      case CullMode.NONE:
        gl.disable(gl.CULL_FACE);
        break;
      case CullMode.FRONT:
        gl.enable(gl.CULL_FACE);
        gl.cullFace(gl.FRONT);
        break;
      case CullMode.BACK:
        gl.enable(gl.CULL_FACE);
        gl.cullFace(gl.BACK);
        break;
    }

    // Blending
    if (this.properties.transparent || this.properties.blendMode !== BlendMode.OPAQUE) {
      gl.enable(gl.BLEND);
      this.setBlendMode(gl);
    } else {
      gl.disable(gl.BLEND);
    }
  }

  private setBlendMode(gl: WebGL2RenderingContext): void {
    switch (this.properties.blendMode) {
      case BlendMode.ALPHA_BLEND:
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        break;
      case BlendMode.ADDITIVE:
        gl.blendFunc(gl.ONE, gl.ONE);
        break;
      case BlendMode.MULTIPLY:
        gl.blendFunc(gl.DST_COLOR, gl.ZERO);
        break;
      case BlendMode.PREMULTIPLIED_ALPHA:
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        break;
      default:
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    }
  }

  // Setters for material properties
  setAlbedo(color: vec3): void {
    vec3.copy(this.properties.albedo!, color);
  }

  setMetallic(metallic: number): void {
    this.properties.metallic = metallic;
  }

  setRoughness(roughness: number): void {
    this.properties.roughness = roughness;
  }

  setEmissive(color: vec3, intensity: number = 1.0): void {
    vec3.copy(this.properties.emissive!, color);
    this.properties.emissiveIntensity = intensity;
  }

  setOpacity(opacity: number): void {
    this.properties.opacity = opacity;
    this.properties.transparent = opacity < 1.0;
  }

  setTexture(type: keyof MaterialTextures, path: string): void {
    this.textures[type] = path;
  }

  setUniform(name: string, value: any): void {
    this.uniformValues.set(name, value);
  }

  // Getters
  isTransparent(): boolean {
    return this.properties.transparent! || this.properties.opacity! < 1.0;
  }

  needsAlphaTest(): boolean {
    return this.properties.alphaTest! > 0.0 && this.properties.alphaTest! < 1.0;
  }

  clone(): Material {
    const cloned = new Material(
      this.gl,
      this.shaderName,
      { ...this.properties },
      { ...this.textures },
    );

    // Copy uniform values
    for (const [name, value] of this.uniformValues) {
      cloned.uniformValues.set(name, value);
    }

    return cloned;
  }

  // Static factory methods for common materials
  static createPBRMaterial(
    gl: WebGL2RenderingContext,
    albedo: vec3 = vec3.fromValues(1, 1, 1),
    metallic: number = 0.0,
    roughness: number = 0.5,
  ): Material {
    return new Material(gl, "pbr", {
      albedo,
      metallic,
      roughness,
    });
  }

  static createUnlitMaterial(
    gl: WebGL2RenderingContext,
    color: vec3 = vec3.fromValues(1, 1, 1),
    texture?: string,
  ): Material {
    return new Material(
      gl,
      "unlit",
      {
        albedo: color,
      },
      texture ? { albedoMap: texture } : {} as Record<string, any>,
    );
  }

  static createEmissiveMaterial(
    gl: WebGL2RenderingContext,
    emissiveColor: vec3,
    intensity: number = 1.0,
  ): Material {
    return new Material(gl, "emissive", {
      emissive: emissiveColor,
      emissiveIntensity: intensity,
    });
  }

  static createTransparentMaterial(
    gl: WebGL2RenderingContext,
    albedo: vec3,
    opacity: number,
  ): Material {
    return new Material(gl, "pbr", {
      albedo,
      opacity,
      transparent: true,
      blendMode: BlendMode.ALPHA_BLEND,
    });
  }
}
