import { vec2, vec3, _vec4 } from "gl-matrix";

export interface TerrainConfig {
  size: number; // Terrain size (width/height in world units)
  resolution: number; // Height map resolution (e.g., 512x512)
  maxHeight: number; // Maximum terrain height
  textureResolution: number; // Texture atlas resolution
  chunkSize: number; // Size of terrain chunks for LOD
  lodLevels: number; // Number of LOD levels
}

export interface HeightmapData {
  width: number;
  height: number;
  data: Float32Array; // Height values normalized to 0-1
}

export interface TextureLayer {
  id: string;
  name: string;
  diffuseTexture: string;
  normalTexture?: string;
  materialTexture?: string; // Roughness/metallic/AO
  tiling: vec2;
  strength: number;
  minHeight: number;
  maxHeight: number;
  minSlope: number;
  maxSlope: number;
}

export interface TerrainChunk {
  x: number;
  z: number;
  level: number;
  vertexBuffer: WebGLBuffer | null;
  indexBuffer: WebGLBuffer | null;
  vertexCount: number;
  indexCount: number;
  boundingBox: {
    min: vec3;
    max: vec3;
  };
  needsUpdate: boolean;
}

export interface TerrainMaterial {
  heightmapTexture: WebGLTexture;
  splatmapTexture: WebGLTexture;
  textureArray: WebGLTexture;
  normalArray: WebGLTexture;
  materialArray: WebGLTexture;
}

export class TerrainSystem {
  private gl: WebGL2RenderingContext;
  private config: TerrainConfig;
  private heightmapData: HeightmapData;
  private textureLayerData: Float32Array; // Splatmap data
  private chunks = new Map<string, TerrainChunk>();
  private material: TerrainMaterial | null = null;
  private textureLayers: TextureLayer[] = [];

  // Shaders
  private terrainShader: WebGLProgram | null = null;
  private wireframeShader: WebGLProgram | null = null;

  // Brushes for editing
  private brushes = new Map<string, TerrainBrush>();

  constructor(gl: WebGL2RenderingContext, config: TerrainConfig) {
    this.gl = gl;
    this.config = config;

    // Initialize heightmap
    this.heightmapData = {
      width: config.resolution,
      height: config.resolution,
      data: new Float32Array(config.resolution * config.resolution),
    };

    // Initialize texture layer data (4 channels for up to 4 layers)
    this.textureLayerData = new Float32Array(config.resolution * config.resolution * 4);

    this.initializeShaders();
    this.initializeBrushes();
    this.generateChunks();
  }

  private initializeShaders(): void {
    const vertexSource = `#version 300 es
      precision highp float;
      
      layout(location = 0) in vec3 a_position;
      layout(location = 1) in vec2 a_texCoord;
      layout(location = 2) in vec3 a_normal;
      
      uniform mat4 u_modelViewProjection;
      uniform mat4 u_modelView;
      uniform mat4 u_normalMatrix;
      uniform sampler2D u_heightmap;
      uniform float u_heightScale;
      
      out vec2 v_texCoord;
      out vec3 v_worldPos;
      out vec3 v_normal;
      out float v_height;
      
      void main() {
        vec2 heightCoord = a_texCoord;
        float height = texture(u_heightmap, heightCoord).r * u_heightScale;
        
        vec3 worldPos = a_position + vec3(0.0, height, 0.0);
        v_worldPos = worldPos;
        v_texCoord = a_texCoord;
        v_height = height / u_heightScale;
        
        // Calculate normal from heightmap
        float texelSize = 1.0 / float(textureSize(u_heightmap, 0).x);
        float heightL = texture(u_heightmap, heightCoord + vec2(-texelSize, 0.0)).r;
        float heightR = texture(u_heightmap, heightCoord + vec2(texelSize, 0.0)).r;
        float heightD = texture(u_heightmap, heightCoord + vec2(0.0, -texelSize)).r;
        float heightU = texture(u_heightmap, heightCoord + vec2(0.0, texelSize)).r;
        
        vec3 normal = normalize(vec3(heightL - heightR, 2.0 * texelSize, heightD - heightU));
        v_normal = normalize((u_normalMatrix * vec4(normal, 0.0)).xyz);
        
        gl_Position = u_modelViewProjection * vec4(worldPos, 1.0);
      }
    `;

    const fragmentSource = `#version 300 es
      precision highp float;
      
      in vec2 v_texCoord;
      in vec3 v_worldPos;
      in vec3 v_normal;
      in float v_height;
      
      uniform sampler2D u_splatmap;
      uniform sampler2DArray u_diffuseArray;
      uniform sampler2DArray u_normalArray;
      uniform sampler2DArray u_materialArray;
      
      uniform vec2 u_tilings[4];
      uniform vec3 u_lightDirection;
      uniform vec3 u_lightColor;
      uniform vec3 u_ambientColor;
      
      out vec4 fragColor;
      
      vec3 calculateLighting(vec3 albedo, vec3 normal, float roughness, float metallic) {
        vec3 lightDir = normalize(-u_lightDirection);
        float NdotL = max(dot(normal, lightDir), 0.0);
        
        vec3 ambient = u_ambientColor * albedo;
        vec3 diffuse = u_lightColor * albedo * NdotL;
        
        return ambient + diffuse;
      }
      
      void main() {
        vec4 splatWeights = texture(u_splatmap, v_texCoord);
        splatWeights /= (splatWeights.r + splatWeights.g + splatWeights.b + splatWeights.a + 0.001);
        
        vec3 albedo = vec3(0.0);
        vec3 normal = vec3(0.0);
        float roughness = 0.0;
        float metallic = 0.0;
        
        // Sample and blend texture layers
        for(int i = 0; i < 4; i++) {
          if(splatWeights[i] > 0.001) {
            vec2 tiledCoord = v_texCoord * u_tilings[i];
            
            vec3 layerAlbedo = texture(u_diffuseArray, vec3(tiledCoord, float(i))).rgb;
            vec3 layerNormal = texture(u_normalArray, vec3(tiledCoord, float(i))).rgb * 2.0 - 1.0;
            vec3 layerMaterial = texture(u_materialArray, vec3(tiledCoord, float(i))).rgb;
            
            float weight = splatWeights[i];
            albedo += layerAlbedo * weight;
            normal += layerNormal * weight;
            roughness += layerMaterial.r * weight;
            metallic += layerMaterial.g * weight;
          }
        }
        
        // Combine with vertex normal
        vec3 finalNormal = normalize(v_normal + normal);
        
        vec3 color = calculateLighting(albedo, finalNormal, roughness, metallic);
        
        fragColor = vec4(color, 1.0);
      }
    `;

    this.terrainShader = this.createShaderProgram(vertexSource, fragmentSource);
  }

  private createShaderProgram(vertexSource: string, fragmentSource: string): WebGLProgram | null {
    const vertexShader = this.gl.createShader(this.gl.VERTEX_SHADER);
    const fragmentShader = this.gl.createShader(this.gl.FRAGMENT_SHADER);

    if (!vertexShader || !fragmentShader) return null;

    this.gl.shaderSource(vertexShader, vertexSource);
    this.gl.compileShader(vertexShader);

    this.gl.shaderSource(fragmentShader, fragmentSource);
    this.gl.compileShader(fragmentShader);

    const program = this.gl.createProgram();
    if (!program) return null;

    this.gl.attachShader(program, vertexShader);
    this.gl.attachShader(program, fragmentShader);
    this.gl.linkProgram(program);

    this.gl.deleteShader(vertexShader);
    this.gl.deleteShader(fragmentShader);

    return program;
  }

  private initializeBrushes(): void {
    // Height brushes
    this.brushes.set("raise", new HeightBrush("raise", 1.0));
    this.brushes.set("lower", new HeightBrush("lower", -1.0));
    this.brushes.set("flatten", new FlattenBrush());
    this.brushes.set("smooth", new SmoothBrush());

    // Texture brushes
    this.brushes.set("paint", new PaintBrush());
  }

  private generateChunks(): void {
    const chunksPerSide = Math.ceil(this.config.size / this.config.chunkSize);

    for (let x = 0; x < chunksPerSide; x++) {
      for (let z = 0; z < chunksPerSide; z++) {
        for (let level = 0; level < this.config.lodLevels; level++) {
          const chunk = this.createChunk(x, z, level);
          const key = `${x}_${z}_${level}`;
          this.chunks.set(key, chunk);
        }
      }
    }
  }

  private createChunk(chunkX: number, chunkZ: number, lodLevel: number): TerrainChunk {
    const lodScale = Math.pow(2, lodLevel);
    const verticesPerSide = Math.floor(this.config.chunkSize / lodScale) + 1;

    const vertices: number[] = [];
    const indices: number[] = [];
    const normals: number[] = [];
    const texCoords: number[] = [];

    // Generate vertices
    for (let z = 0; z < verticesPerSide; z++) {
      for (let x = 0; x < verticesPerSide; x++) {
        const worldX = chunkX * this.config.chunkSize + x * lodScale;
        const worldZ = chunkZ * this.config.chunkSize + z * lodScale;

        vertices.push(worldX, 0, worldZ);
        texCoords.push(worldX / this.config.size, worldZ / this.config.size);
        normals.push(0, 1, 0); // Will be calculated in shader
      }
    }

    // Generate indices
    for (let z = 0; z < verticesPerSide - 1; z++) {
      for (let x = 0; x < verticesPerSide - 1; x++) {
        const topLeft = z * verticesPerSide + x;
        const topRight = topLeft + 1;
        const bottomLeft = (z + 1) * verticesPerSide + x;
        const bottomRight = bottomLeft + 1;

        // Two triangles per quad
        indices.push(topLeft, bottomLeft, topRight);
        indices.push(topRight, bottomLeft, bottomRight);
      }
    }

    // Create buffers
    const vertexBuffer = this.gl.createBuffer();
    const indexBuffer = this.gl.createBuffer();

    if (vertexBuffer) {
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, vertexBuffer);
      this.gl.bufferData(
        this.gl.ARRAY_BUFFER,
        new Float32Array([...vertices, ...texCoords, ...normals]),
        this.gl.STATIC_DRAW,
      );
    }

    if (indexBuffer) {
      this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
      this.gl.bufferData(
        this.gl.ELEMENT_ARRAY_BUFFER,
        new Uint16Array(indices),
        this.gl.STATIC_DRAW,
      );
    }

    return {
      x: chunkX,
      z: chunkZ,
      level: lodLevel,
      vertexBuffer,
      indexBuffer,
      vertexCount: vertices.length / 3,
      indexCount: indices.length,
      boundingBox: {
        min: vec3.fromValues(chunkX * this.config.chunkSize, 0, chunkZ * this.config.chunkSize),
        max: vec3.fromValues(
          (chunkX + 1) * this.config.chunkSize,
          this.config.maxHeight,
          (chunkZ + 1) * this.config.chunkSize,
        ),
      },
      needsUpdate: false,
    };
  }

  public addTextureLayer(layer: TextureLayer): void {
    this.textureLayers.push(layer);
    this.updateMaterial();
  }

  public removeTextureLayer(layerId: string): void {
    this.textureLayers = this.textureLayers.filter((layer) => layer.id !== layerId);
    this.updateMaterial();
  }

  private updateMaterial(): void {
    // Update texture arrays with new layers
    this.createTextureArrays();
  }

  private createTextureArrays(): void {
    // This would create WebGL texture arrays from the texture layers
    // Implementation would involve loading textures and creating 2D array textures
  }

  public applyBrush(
    brushType: string,
    position: vec3,
    size: number,
    strength: number,
    options?: any,
  ): void {
    const brush = this.brushes.get(brushType);
    if (!brush) return;

    const result = brush.apply(
      this.heightmapData,
      this.textureLayerData,
      position,
      size,
      strength,
      options,
    );

    if (result.heightmapModified) {
      this.updateHeightmapTexture();
      this.markChunksForUpdate(position, size);
    }

    if (result.splatmapModified) {
      this.updateSplatmapTexture();
    }
  }

  private updateHeightmapTexture(): void {
    // Update the WebGL heightmap texture
    if (this.material?.heightmapTexture) {
      this.gl.bindTexture(this.gl.TEXTURE_2D, this.material.heightmapTexture);
      this.gl.texSubImage2D(
        this.gl.TEXTURE_2D,
        0,
        0,
        0,
        this.heightmapData.width,
        this.heightmapData.height,
        this.gl.RED,
        this.gl.FLOAT,
        this.heightmapData.data,
      );
    }
  }

  private updateSplatmapTexture(): void {
    // Update the WebGL splatmap texture
    if (this.material?.splatmapTexture) {
      this.gl.bindTexture(this.gl.TEXTURE_2D, this.material.splatmapTexture);
      this.gl.texSubImage2D(
        this.gl.TEXTURE_2D,
        0,
        0,
        0,
        this.config.resolution,
        this.config.resolution,
        this.gl.RGBA,
        this.gl.FLOAT,
        this.textureLayerData,
      );
    }
  }

  private markChunksForUpdate(position: vec3, radius: number): void {
    for (const chunk of this.chunks.values()) {
      const chunkCenter = vec3.fromValues(
        (chunk.x + 0.5) * this.config.chunkSize,
        0,
        (chunk.z + 0.5) * this.config.chunkSize,
      );

      const distance = vec3.distance(position, chunkCenter);
      if (distance <= radius + this.config.chunkSize) {
        chunk.needsUpdate = true;
      }
    }
  }

  public getHeightAtPosition(position: vec2): number {
    const x = Math.floor((position[0] / this.config.size) * this.config.resolution);
    const z = Math.floor((position[1] / this.config.size) * this.config.resolution);

    if (x < 0 || x >= this.config.resolution || z < 0 || z >= this.config.resolution) {
      return 0;
    }

    const index = z * this.config.resolution + x;
    return this.heightmapData.data[index] * this.config.maxHeight;
  }

  public setHeightAtPosition(position: vec2, height: number): void {
    const x = Math.floor((position[0] / this.config.size) * this.config.resolution);
    const z = Math.floor((position[1] / this.config.size) * this.config.resolution);

    if (x < 0 || x >= this.config.resolution || z < 0 || z >= this.config.resolution) {
      return;
    }

    const index = z * this.config.resolution + x;
    this.heightmapData.data[index] = Math.max(0, Math.min(1, height / this.config.maxHeight));

    this.updateHeightmapTexture();
  }

  public render(viewMatrix: Float32Array, projectionMatrix: Float32Array): void {
    if (!this.terrainShader || !this.material) return;

    this.gl.useProgram(this.terrainShader);

    // Set uniforms
    const mvpLocation = this.gl.getUniformLocation(this.terrainShader, "u_modelViewProjection");
    const heightScaleLocation = this.gl.getUniformLocation(this.terrainShader, "u_heightScale");

    if (mvpLocation) {
      this.gl.uniformMatrix4fv(mvpLocation, false, projectionMatrix);
    }

    if (heightScaleLocation) {
      this.gl.uniform1f(heightScaleLocation, this.config.maxHeight);
    }

    // Bind textures
    this.gl.activeTexture(this.gl.TEXTURE0);
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.material.heightmapTexture);

    this.gl.activeTexture(this.gl.TEXTURE1);
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.material.splatmapTexture);

    // Render visible chunks
    for (const chunk of this.chunks.values()) {
      if (this.isChunkVisible(chunk)) {
        this.renderChunk(chunk);
      }
    }
  }

  private isChunkVisible(_chunk: TerrainChunk): boolean {
    // Basic frustum culling would go here
    return true; // Simplified for now
  }

  private renderChunk(chunk: TerrainChunk): void {
    if (!chunk.vertexBuffer || !chunk.indexBuffer) return;

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, chunk.vertexBuffer);
    this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, chunk.indexBuffer);

    // Set up vertex attributes
    this.gl.enableVertexAttribArray(0);
    this.gl.vertexAttribPointer(0, 3, this.gl.FLOAT, false, 0, 0);

    this.gl.drawElements(this.gl.TRIANGLES, chunk.indexCount, this.gl.UNSIGNED_SHORT, 0);
  }

  public exportHeightmap(): HeightmapData {
    return {
      width: this.heightmapData.width,
      height: this.heightmapData.height,
      data: new Float32Array(this.heightmapData.data),
    };
  }

  public importHeightmap(data: HeightmapData): void {
    this.heightmapData = {
      width: data.width,
      height: data.height,
      data: new Float32Array(data.data),
    };

    this.updateHeightmapTexture();

    // Mark all chunks for update
    for (const chunk of this.chunks.values()) {
      chunk.needsUpdate = true;
    }
  }

  public dispose(): void {
    // Clean up WebGL resources
    for (const chunk of this.chunks.values()) {
      if (chunk.vertexBuffer) {
        this.gl.deleteBuffer(chunk.vertexBuffer);
      }
      if (chunk.indexBuffer) {
        this.gl.deleteBuffer(chunk.indexBuffer);
      }
    }

    if (this.terrainShader) {
      this.gl.deleteProgram(this.terrainShader);
    }

    if (this.material) {
      this.gl.deleteTexture(this.material.heightmapTexture);
      this.gl.deleteTexture(this.material.splatmapTexture);
      this.gl.deleteTexture(this.material.textureArray);
      this.gl.deleteTexture(this.material.normalArray);
      this.gl.deleteTexture(this.material.materialArray);
    }

    this.chunks.clear();
  }
}

// Terrain brush classes
export abstract class TerrainBrush {
  protected name: string;

  constructor(name: string) {
    this.name = name;
  }

  abstract apply(
    heightmap: HeightmapData,
    splatmap: Float32Array,
    position: vec3,
    size: number,
    strength: number,
    options?: any,
  ): { heightmapModified: boolean; splatmapModified: boolean };

  protected calculateInfluence(distance: number, size: number, falloff: number = 0.5): number {
    if (distance >= size) return 0;

    const normalizedDistance = distance / size;
    return Math.pow(1 - normalizedDistance, 1 / falloff);
  }
}

export class HeightBrush extends TerrainBrush {
  private direction: number;

  constructor(name: string, direction: number) {
    super(name);
    this.direction = direction;
  }

  apply(
    heightmap: HeightmapData,
    splatmap: Float32Array,
    position: vec3,
    size: number,
    strength: number,
    options?: any,
  ): { heightmapModified: boolean; splatmapModified: boolean } {
    const centerX = position[0];
    const centerZ = position[2];

    for (let z = 0; z < heightmap.height; z++) {
      for (let x = 0; x < heightmap.width; x++) {
        const worldX = x / heightmap.width;
        const worldZ = z / heightmap.height;

        const distance = Math.sqrt(Math.pow(worldX - centerX, 2) + Math.pow(worldZ - centerZ, 2));

        const influence = this.calculateInfluence(distance, size);
        if (influence > 0) {
          const index = z * heightmap.width + x;
          const delta = this.direction * strength * influence * 0.01;
          heightmap.data[index] = Math.max(0, Math.min(1, heightmap.data[index] + delta));
        }
      }
    }

    return { heightmapModified: true, splatmapModified: false };
  }
}

export class FlattenBrush extends TerrainBrush {
  constructor() {
    super("flatten");
  }

  apply(
    heightmap: HeightmapData,
    splatmap: Float32Array,
    position: vec3,
    size: number,
    strength: number,
    options?: any,
  ): { heightmapModified: boolean; splatmapModified: boolean } {
    const targetHeight = options?.targetHeight ?? position[1];
    const normalizedTarget = targetHeight / 100; // Assuming max height of 100

    const centerX = position[0];
    const centerZ = position[2];

    for (let z = 0; z < heightmap.height; z++) {
      for (let x = 0; x < heightmap.width; x++) {
        const worldX = x / heightmap.width;
        const worldZ = z / heightmap.height;

        const distance = Math.sqrt(Math.pow(worldX - centerX, 2) + Math.pow(worldZ - centerZ, 2));

        const influence = this.calculateInfluence(distance, size);
        if (influence > 0) {
          const index = z * heightmap.width + x;
          const currentHeight = heightmap.data[index];
          heightmap.data[index] =
            currentHeight + (normalizedTarget - currentHeight) * influence * strength;
        }
      }
    }

    return { heightmapModified: true, splatmapModified: false };
  }
}

export class SmoothBrush extends TerrainBrush {
  constructor() {
    super("smooth");
  }

  apply(
    heightmap: HeightmapData,
    splatmap: Float32Array,
    position: vec3,
    size: number,
    strength: number,
    options?: any,
  ): { heightmapModified: boolean; splatmapModified: boolean } {
    const centerX = position[0];
    const centerZ = position[2];
    const smoothedData = new Float32Array(heightmap.data);

    for (let z = 1; z < heightmap.height - 1; z++) {
      for (let x = 1; x < heightmap.width - 1; x++) {
        const worldX = x / heightmap.width;
        const worldZ = z / heightmap.height;

        const distance = Math.sqrt(Math.pow(worldX - centerX, 2) + Math.pow(worldZ - centerZ, 2));

        const influence = this.calculateInfluence(distance, size);
        if (influence > 0) {
          const index = z * heightmap.width + x;

          // Calculate average of surrounding heights
          let sum = 0;
          let count = 0;

          for (let dz = -1; dz <= 1; dz++) {
            for (let dx = -1; dx <= 1; dx++) {
              const sampleIndex = (z + dz) * heightmap.width + (x + dx);
              sum += heightmap.data[sampleIndex];
              count++;
            }
          }

          const average = sum / count;
          const currentHeight = heightmap.data[index];
          smoothedData[index] = currentHeight + (average - currentHeight) * influence * strength;
        }
      }
    }

    heightmap.data.set(smoothedData);

    return { heightmapModified: true, splatmapModified: false };
  }
}

export class PaintBrush extends TerrainBrush {
  constructor() {
    super("paint");
  }

  apply(
    heightmap: HeightmapData,
    splatmap: Float32Array,
    position: vec3,
    size: number,
    strength: number,
    options?: any,
  ): { heightmapModified: boolean; splatmapModified: boolean } {
    const layerIndex = options?.layerIndex ?? 0;
    const centerX = position[0];
    const centerZ = position[2];

    for (let z = 0; z < heightmap.height; z++) {
      for (let x = 0; x < heightmap.width; x++) {
        const worldX = x / heightmap.width;
        const worldZ = z / heightmap.height;

        const distance = Math.sqrt(Math.pow(worldX - centerX, 2) + Math.pow(worldZ - centerZ, 2));

        const influence = this.calculateInfluence(distance, size);
        if (influence > 0) {
          const baseIndex = (z * heightmap.width + x) * 4;
          const paintStrength = influence * strength;

          // Add to target layer
          splatmap[baseIndex + layerIndex] = Math.min(
            1,
            splatmap[baseIndex + layerIndex] + paintStrength,
          );

          // Normalize weights to ensure they sum to 1
          let totalWeight = 0;
          for (let i = 0; i < 4; i++) {
            totalWeight += splatmap[baseIndex + i];
          }

          if (totalWeight > 0) {
            for (let i = 0; i < 4; i++) {
              splatmap[baseIndex + i] /= totalWeight;
            }
          }
        }
      }
    }

    return { heightmapModified: false, splatmapModified: true };
  }
}
