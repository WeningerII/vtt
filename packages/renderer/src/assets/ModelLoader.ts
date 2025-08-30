import { AssetLoader, AssetMetadata, AssetLoadOptions } from './AssetManager';
import { GeometryData, VertexAttribute } from '../engine/GeometryManager';

export interface ModelData {
  meshes: MeshData[];
  materials: MaterialData[];
  textures: TextureReference[];
  animations?: AnimationData[];
  scene: SceneNode;
  metadata: {
    generator?: string;
    version?: string;
    copyright?: string;
    extras?: any;
  };
}

export interface MeshData {
  name: string;
  geometry: GeometryData;
  materialIndex?: number;
  boundingBox?: {
    min: [number, number, number];
    max: [number, number, number];
  };
  extras?: any;
}

export interface MaterialData {
  name: string;
  pbrMetallicRoughness?: {
    baseColorFactor?: [number, number, number, number];
    baseColorTexture?: TextureReference;
    metallicFactor?: number;
    roughnessFactor?: number;
    metallicRoughnessTexture?: TextureReference;
  };
  normalTexture?: TextureReference;
  occlusionTexture?: TextureReference;
  emissiveTexture?: TextureReference;
  emissiveFactor?: [number, number, number];
  alphaMode?: 'OPAQUE' | 'MASK' | 'BLEND';
  alphaCutoff?: number;
  doubleSided?: boolean;
  extras?: any;
}

export interface TextureReference {
  index: number;
  texCoord?: number;
  scale?: number;
  strength?: number;
  extras?: any;
}

export interface AnimationData {
  name: string;
  channels: AnimationChannel[];
  samplers: AnimationSampler[];
  extras?: any;
}

export interface AnimationChannel {
  sampler: number;
  target: {
    node?: number;
    path: 'translation' | 'rotation' | 'scale' | 'weights';
  };
}

export interface AnimationSampler {
  input: number; // accessor index
  output: number; // accessor index
  interpolation?: 'LINEAR' | 'STEP' | 'CUBICSPLINE';
}

export interface SceneNode {
  name?: string;
  children: SceneNode[];
  meshIndex?: number;
  transform: {
    translation?: [number, number, number];
    rotation?: [number, number, number, number];
    scale?: [number, number, number];
    matrix?: number[]; // 4x4 matrix in column-major order
  };
  extras?: any;
}

export class GLTFLoader implements AssetLoader<ModelData> {
  supportedTypes = ['model' as any];
  
  async load(metadata: AssetMetadata, options?: AssetLoadOptions): Promise<ModelData> {
    const isGLB = metadata.path.toLowerCase().endsWith('.glb');
    
    if (isGLB) {
      return this.loadGLB(metadata.path);
    } else {
      return this.loadGLTF(metadata.path);
    }
  }

  private async loadGLTF(path: string): Promise<ModelData> {
    const response = await fetch(path);
    const gltf = await response.json();
    
    // Resolve relative paths for binary data and images
    const baseDir = path.substring(0, path.lastIndexOf('/') + 1);
    
    return this.parseGLTF(gltf, baseDir);
  }

  private async loadGLB(path: string): Promise<ModelData> {
    const response = await fetch(path);
    const arrayBuffer = await response.arrayBuffer();
    
    return this.parseGLB(arrayBuffer);
  }

  private parseGLB(arrayBuffer: ArrayBuffer): ModelData {
    const dataView = new DataView(arrayBuffer);
    let offset = 0;
    
    // Read GLB header
    const magic = dataView.getUint32(offset, true);
    if (magic !== 0x46546C67) { // 'glTF'
      throw new Error('Invalid GLB magic number');
    }
    offset += 4;
    
    const version = dataView.getUint32(offset, true);
    if (version !== 2) {
      throw new Error(`Unsupported GLB version: ${version}`);
    }
    offset += 4;
    
    const length = dataView.getUint32(offset, true);
    offset += 4;
    
    // Read JSON chunk
    const jsonLength = dataView.getUint32(offset, true);
    offset += 4;
    
    const jsonType = dataView.getUint32(offset, true);
    if (jsonType !== 0x4E4F534A) { // 'JSON'
      throw new Error('Expected JSON chunk');
    }
    offset += 4;
    
    const jsonBytes = new Uint8Array(arrayBuffer, offset, jsonLength);
    const gltf = JSON.parse(new TextDecoder().decode(jsonBytes));
    offset += jsonLength;
    
    // Read binary chunk if present
    let binaryData: ArrayBuffer | null = null;
    if (offset < length) {
      const binaryLength = dataView.getUint32(offset, true);
      offset += 4;
      
      const binaryType = dataView.getUint32(offset, true);
      if (binaryType !== 0x004E4942) { // 'BIN\0'
        throw new Error('Expected BIN chunk');
      }
      offset += 4;
      
      binaryData = arrayBuffer.slice(offset, offset + binaryLength);
    }
    
    return this.parseGLTF(gltf, null, binaryData);
  }

  private parseGLTF(gltf: any, baseDir?: string | null, binaryData?: ArrayBuffer | null): ModelData {
    const buffers = this.loadBuffers(gltf.buffers || [], baseDir, binaryData);
    const bufferViews = this.createBufferViews(gltf.bufferViews || [], buffers);
    const accessors = this.createAccessors(gltf.accessors || [], bufferViews);
    
    const meshes = this.parseMeshes(gltf.meshes || [], accessors);
    const materials = this.parseMaterials(gltf.materials || []);
    const textures = this.parseTextures(gltf.textures || []);
    const animations = this.parseAnimations(gltf.animations || [], accessors);
    
    // Parse scene (use default scene or first scene)
    const sceneIndex = gltf.scene !== undefined ? gltf.scene : 0;
    const sceneData = gltf.scenes && gltf.scenes[sceneIndex] ? gltf.scenes[sceneIndex] : { nodes: [] };
    const scene = this.parseScene(sceneData, gltf.nodes || []);
    
    return {
      meshes,
      materials,
      textures,
      animations,
      scene,
      metadata: {
        generator: gltf.asset?.generator,
        version: gltf.asset?.version,
        copyright: gltf.asset?.copyright,
        extras: gltf.extras
      }
    };
  }

  private loadBuffers(buffers: any[], baseDir?: string | null, binaryData?: ArrayBuffer | null): ArrayBuffer[] {
    return buffers.map((buffer, _index) => {
      if (buffer.uri) {
        if (buffer.uri.startsWith('data:')) {
          // Data URI
          const base64 = buffer.uri.split(',')[1];
          const binaryString = atob(base64);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          return bytes.buffer;
        } else {
          // External file - would need to be loaded separately
          throw new Error('External buffer files not supported in this implementation');
        }
      } else if (index === 0 && binaryData) {
        // First buffer without URI in GLB format
        return binaryData;
      } else {
        throw new Error(`Buffer ${index} has no data`);
      }
    });
  }

  private createBufferViews(bufferViews: any[], buffers: ArrayBuffer[]): DataView[] {
    return bufferViews.map(bv => {
      const buffer = buffers[bv.buffer];
      return new DataView(buffer, bv.byteOffset || 0, bv.byteLength);
    });
  }

  private createAccessors(accessors: any[], bufferViews: DataView[]): any[] {
    return accessors.map(accessor => {
      const bufferView = bufferViews[accessor.bufferView];
      const componentType = accessor.componentType;
      const type = accessor.type;
      const count = accessor.count;
      const byteOffset = accessor.byteOffset || 0;
      
      const componentSize = this.getComponentSize(componentType);
      const elementSize = this.getElementSize(type) * componentSize;
      
      return {
        bufferView,
        componentType,
        type,
        count,
        byteOffset,
        componentSize,
        elementSize,
        normalized: accessor.normalized || false,
        min: accessor.min,
        max: accessor.max
      };
    });
  }

  private getComponentSize(componentType: number): number {
    switch (componentType) {
      case 5120: return 1; // BYTE
      case 5121: return 1; // UNSIGNED_BYTE
      case 5122: return 2; // SHORT
      case 5123: return 2; // UNSIGNED_SHORT
      case 5125: return 4; // UNSIGNED_INT
      case 5126: return 4; // FLOAT
      default: throw new Error(`Unknown component type: ${componentType}`);
    }
  }

  private getElementSize(type: string): number {
    switch (type) {
      case 'SCALAR': return 1;
      case 'VEC2': return 2;
      case 'VEC3': return 3;
      case 'VEC4': return 4;
      case 'MAT2': return 4;
      case 'MAT3': return 9;
      case 'MAT4': return 16;
      default: throw new Error(`Unknown type: ${type}`);
    }
  }

  private readAccessorData(accessor: any): Float32Array | Uint16Array | Uint32Array {
    const { bufferView,  componentType,  count,  byteOffset,  elementSize, _componentSize} = accessor;
    const totalBytes = count * elementSize;
    
    const bytes = new Uint8Array(bufferView.buffer, bufferView.byteOffset + byteOffset, totalBytes);
    
    switch (componentType) {
      case 5121: // UNSIGNED_BYTE
        return new Uint8Array(bytes);
      case 5123: // UNSIGNED_SHORT
        return new Uint16Array(bytes.buffer, bytes.byteOffset, totalBytes / 2);
      case 5125: // UNSIGNED_INT
        return new Uint32Array(bytes.buffer, bytes.byteOffset, totalBytes / 4);
      case 5126: // FLOAT
        return new Float32Array(bytes.buffer, bytes.byteOffset, totalBytes / 4);
      default:
        throw new Error(`Unsupported component type for reading: ${componentType}`);
    }
  }

  private parseMeshes(meshes: any[], accessors: any[]): MeshData[] {
    return meshes.map(mesh => {
      const primitives = mesh.primitives || [];
      
      // For simplicity, take the first primitive
      // In a full implementation, you'd handle multiple primitives per mesh
      const primitive = primitives[0];
      if (!primitive) {
        throw new Error('Mesh has no primitives');
      }
      
      const attributes = primitive.attributes;
      const indices = primitive.indices;
      
      // Read vertex data
      const vertexData: number[] = [];
      const attributeInfo: VertexAttribute[] = [];
      let stride = 0;
      
      // Position
      if (attributes.POSITION !== undefined) {
        const posAccessor = accessors[attributes.POSITION];
        const positions = this.readAccessorData(posAccessor) as Float32Array;
        
        attributeInfo.push({
          name: 'a_position',
          size: 3,
          type: WebGL2RenderingContext.FLOAT,
          normalized: false,
          stride: 0, // Will be updated
          offset: stride * 4
        });
        
        stride += 3;
        
        for (let i = 0; i < positions.length; i += 3) {
          vertexData.push(positions[i], positions[i + 1], positions[i + 2]);
        }
      }
      
      // Normal
      if (attributes.NORMAL !== undefined) {
        const normalAccessor = accessors[attributes.NORMAL];
        const normals = this.readAccessorData(normalAccessor) as Float32Array;
        
        attributeInfo.push({
          name: 'a_normal',
          size: 3,
          type: WebGL2RenderingContext.FLOAT,
          normalized: false,
          stride: 0, // Will be updated
          offset: stride * 4
        });
        
        stride += 3;
        
        // Interleave with position data
        const positions = this.readAccessorData(accessors[attributes.POSITION]) as Float32Array;
        const interleavedData: number[] = [];
        
        for (let i = 0; i < positions.length; i += 3) {
          interleavedData.push(positions[i], positions[i + 1], positions[i + 2]);
          interleavedData.push(normals[i], normals[i + 1], normals[i + 2]);
        }
        
        vertexData.length = 0;
        vertexData.push(...interleavedData);
      }
      
      // Texture coordinates
      if (attributes.TEXCOORD_0 !== undefined) {
        const uvAccessor = accessors[attributes.TEXCOORD_0];
        const uvs = this.readAccessorData(uvAccessor) as Float32Array;
        
        attributeInfo.push({
          name: 'a_texCoord',
          size: 2,
          type: WebGL2RenderingContext.FLOAT,
          normalized: false,
          stride: 0, // Will be updated
          offset: stride * 4
        });
        
        stride += 2;
        
        // Re-interleave all data
        const positions = this.readAccessorData(accessors[attributes.POSITION]) as Float32Array;
        const normals = attributes.NORMAL ? this.readAccessorData(accessors[attributes.NORMAL]) as Float32Array : null;
        const interleavedData: number[] = [];
        
        for (let i = 0; i < positions.length; i += 3) {
          interleavedData.push(positions[i], positions[i + 1], positions[i + 2]);
          
          if (normals) {
            interleavedData.push(normals[i], normals[i + 1], normals[i + 2]);
          }
          
          const uvIndex = (i / 3) * 2;
          interleavedData.push(uvs[uvIndex], uvs[uvIndex + 1]);
        }
        
        vertexData.length = 0;
        vertexData.push(...interleavedData);
      }
      
      // Update stride in attributes
      const strideBytes = stride * 4;
      for (const attr of attributeInfo) {
        attr.stride = strideBytes;
      }
      
      // Read indices
      let indicesArray: Uint16Array | Uint32Array;
      if (indices !== undefined) {
        const indexAccessor = accessors[indices];
        indicesArray = this.readAccessorData(indexAccessor) as Uint16Array | Uint32Array;
      } else {
        // Generate indices for triangles
        const vertexCount = vertexData.length / stride;
        indicesArray = new Uint16Array(vertexCount);
        for (let i = 0; i < vertexCount; i++) {
          indicesArray[i] = i;
        }
      }
      
      const geometry: GeometryData = {
        vertices: new Float32Array(vertexData),
        indices: indicesArray,
        attributes: attributeInfo,
        drawMode: this.getDrawMode(primitive.mode)
      };
      
      return {
        name: mesh.name || `Mesh_${meshes.indexOf(mesh)}`,
        geometry,
        materialIndex: primitive.material,
        extras: mesh.extras
      };
    });
  }

  private getDrawMode(mode?: number): number {
    switch (mode) {
      case 0: return WebGL2RenderingContext.POINTS;
      case 1: return WebGL2RenderingContext.LINES;
      case 2: return WebGL2RenderingContext.LINE_LOOP;
      case 3: return WebGL2RenderingContext.LINE_STRIP;
      case 4: return WebGL2RenderingContext.TRIANGLES;
      case 5: return WebGL2RenderingContext.TRIANGLE_STRIP;
      case 6: return WebGL2RenderingContext.TRIANGLE_FAN;
      default: return WebGL2RenderingContext.TRIANGLES;
    }
  }

  private parseMaterials(materials: any[]): MaterialData[] {
    return materials.map(material => ({
      name: material.name || 'Unnamed Material',
      pbrMetallicRoughness: material.pbrMetallicRoughness ? {
        baseColorFactor: material.pbrMetallicRoughness.baseColorFactor || [1, 1, 1, 1],
        baseColorTexture: material.pbrMetallicRoughness.baseColorTexture,
        metallicFactor: material.pbrMetallicRoughness.metallicFactor !== undefined ? material.pbrMetallicRoughness.metallicFactor : 1,
        roughnessFactor: material.pbrMetallicRoughness.roughnessFactor !== undefined ? material.pbrMetallicRoughness.roughnessFactor : 1,
        metallicRoughnessTexture: material.pbrMetallicRoughness.metallicRoughnessTexture
      } : undefined,
      normalTexture: material.normalTexture,
      occlusionTexture: material.occlusionTexture,
      emissiveTexture: material.emissiveTexture,
      emissiveFactor: material.emissiveFactor || [0, 0, 0],
      alphaMode: material.alphaMode || 'OPAQUE',
      alphaCutoff: material.alphaCutoff !== undefined ? material.alphaCutoff : 0.5,
      doubleSided: material.doubleSided || false,
      extras: material.extras
    }));
  }

  private parseTextures(textures: any[]): TextureReference[] {
    return textures.map((_texture, __index) => ({
      index,
      extras: texture.extras
    }));
  }

  private parseAnimations(animations: any[], _accessors: any[]): AnimationData[] {
    return animations.map(animation => ({
      name: animation.name || 'Unnamed Animation',
      channels: animation.channels || [],
      samplers: animation.samplers || [],
      extras: animation.extras
    }));
  }

  private parseScene(sceneData: any, nodes: any[]): SceneNode {
    const rootNode: SceneNode = {
      name: sceneData.name || 'Scene',
      children: [],
      transform: Record<string, any>
    };
    
    // Parse root nodes
    for (const nodeIndex of sceneData.nodes || []) {
      const childNode = this.parseNode(nodes[nodeIndex], nodes);
      rootNode.children.push(childNode);
    }
    
    return rootNode;
  }

  private parseNode(nodeData: any, allNodes: any[]): SceneNode {
    const node: SceneNode = {
      name: nodeData.name,
      children: [],
      meshIndex: nodeData.mesh,
      transform: {
        translation: nodeData.translation,
        rotation: nodeData.rotation,
        scale: nodeData.scale,
        matrix: nodeData.matrix
      },
      extras: nodeData.extras
    };
    
    // Parse child nodes
    if (nodeData.children) {
      for (const childIndex of nodeData.children) {
        const childNode = this.parseNode(allNodes[childIndex], allNodes);
        node.children.push(childNode);
      }
    }
    
    return node;
  }

  unload(_asset: any): void {
    // Clean up any WebGL resources if needed
    // This would be handled by the geometry manager
  }

  validate(data: ModelData): boolean {
    return data && 
           Array.isArray(data.meshes) && 
           Array.isArray(data.materials) && 
           data.scene !== undefined;
  }
}

export class OBJLoader implements AssetLoader<ModelData> {
  supportedTypes = ['model' as any];
  
  async load(metadata: AssetMetadata, options?: AssetLoadOptions): Promise<ModelData> {
    const response = await fetch(metadata.path);
    const text = await response.text();
    
    return this.parseOBJ(text, metadata.path);
  }

  private parseOBJ(text: string, path: string): ModelData {
    const lines = text.split('\n');
    
    const vertices: number[] = [];
    const normals: number[] = [];
    const texCoords: number[] = [];
    const faces: number[][] = [];
    
    let currentMaterial: string | null = null;
    
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      const command = parts[0];
      
      switch (command) {
        case 'v': // Vertex
          vertices.push(parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3]));
          break;
          
        case 'vn': // Normal
          normals.push(parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3]));
          break;
          
        case 'vt': // Texture coordinate
          texCoords.push(parseFloat(parts[1]), parseFloat(parts[2]));
          break;
          
        case 'f': // Face {
          const face: number[] = [];
          for (let i = 1; i < parts.length; i++) {
            const indices = parts[i].split('/');
            face.push(
              parseInt(indices[0]) - 1, // Vertex index (OBJ is 1-based)
              indices[1] ? parseInt(indices[1]) - 1 : -1, // Texture coord index
              indices[2] ? parseInt(indices[2]) - 1 : -1  // Normal index
            );
          }
          faces.push(face);
    }
          break;
          
        case 'usemtl': // Use material
          currentMaterial = parts[1];
          break;
      }
    }
    
    // Convert to interleaved vertex data
    const vertexData: number[] = [];
    const indices: number[] = [];
    let vertexIndex = 0;
    
    for (const face of faces) {
      // Triangulate face (assuming triangles or quads)
      const vertexCount = face.length / 3;
      
      for (let i = 0; i < vertexCount; i++) {
        const vIndex = face[i * 3];
        const tIndex = face[i * 3 + 1];
        const nIndex = face[i * 3 + 2];
        
        // Position
        if (vIndex >= 0) {
          vertexData.push(
            vertices[vIndex * 3],
            vertices[vIndex * 3 + 1],
            vertices[vIndex * 3 + 2]
          );
        } else {
          vertexData.push(0, 0, 0);
        }
        
        // Normal
        if (nIndex >= 0) {
          vertexData.push(
            normals[nIndex * 3],
            normals[nIndex * 3 + 1],
            normals[nIndex * 3 + 2]
          );
        } else {
          vertexData.push(0, 1, 0); // Default up normal
        }
        
        // Texture coordinates
        if (tIndex >= 0) {
          vertexData.push(texCoords[tIndex * 2], texCoords[tIndex * 2 + 1]);
        } else {
          vertexData.push(0, 0);
        }
        
        indices.push(vertexIndex++);
      }
      
      // If face has 4 vertices (quad), add second triangle
      if (vertexCount === 4) {
        // Add triangle: 0, 2, 3
        const baseIndex = vertexIndex - 4;
        indices.push(baseIndex, baseIndex + 2, baseIndex + 3);
        vertexIndex += 3; // We'll duplicate the vertices
        
        // Duplicate vertices for second triangle
        for (const i of [0, 2, 3]) {
          const vIndex = face[i * 3];
          const tIndex = face[i * 3 + 1];
          const nIndex = face[i * 3 + 2];
          
          if (vIndex >= 0) {
            vertexData.push(
              vertices[vIndex * 3],
              vertices[vIndex * 3 + 1],
              vertices[vIndex * 3 + 2]
            );
          } else {
            vertexData.push(0, 0, 0);
          }
          
          if (nIndex >= 0) {
            vertexData.push(
              normals[nIndex * 3],
              normals[nIndex * 3 + 1],
              normals[nIndex * 3 + 2]
            );
          } else {
            vertexData.push(0, 1, 0);
          }
          
          if (tIndex >= 0) {
            vertexData.push(texCoords[tIndex * 2], texCoords[tIndex * 2 + 1]);
          } else {
            vertexData.push(0, 0);
          }
        }
      }
    }
    
    const attributes: VertexAttribute[] = [
      { name: 'a_position', size: 3, type: WebGL2RenderingContext.FLOAT, normalized: false, stride: 32, offset: 0 },
      { name: 'a_normal', size: 3, type: WebGL2RenderingContext.FLOAT, normalized: false, stride: 32, offset: 12 },
      { name: 'a_texCoord', size: 2, type: WebGL2RenderingContext.FLOAT, normalized: false, stride: 32, offset: 24 }
    ];
    
    const geometry: GeometryData = {
      vertices: new Float32Array(vertexData),
      indices: new Uint16Array(indices),
      attributes
    };
    
    const mesh: MeshData = {
      name: path.split('/').pop()?.replace('.obj', '') || 'OBJ Model',
      geometry
    };
    
    const rootNode: SceneNode = {
      name: 'Root',
      children: [],
      meshIndex: 0,
      transform: Record<string, any>
    };
    
    return {
      meshes: [mesh],
      materials: [{ name: 'Default', extras: Record<string, unknown>}],
      textures: [],
      scene: rootNode,
      metadata: {
        generator: 'OBJ Loader',
        version: '1.0'
      }
    };
  }

  validate(data: ModelData): boolean {
    return data && data.meshes.length > 0;
  }
}
