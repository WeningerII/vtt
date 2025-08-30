export interface VertexAttribute {
  name: string;
  size: number;
  type: number;
  normalized: boolean;
  stride: number;
  offset: number;
  divisor?: number; // For instanced rendering
}

export interface GeometryData {
  vertices: Float32Array;
  indices: Uint16Array | Uint32Array;
  attributes: VertexAttribute[];
  drawMode?: number;
  instanceCount?: number;
}

export interface Mesh {
  vertexArray: WebGLVertexArrayObject;
  vertexBuffer: WebGLBuffer;
  indexBuffer: WebGLBuffer;
  indexCount: number;
  vertexCount: number;
  drawMode: number;
  instanceCount?: number;
  boundingBox?: {
    min: [number, number, number];
    max: [number, number, number];
  };
  boundingSphere?: {
    center: [number, number, number];
    radius: number;
  };
}

export class GeometryManager {
  private gl: WebGL2RenderingContext;
  private meshes = new Map<string, Mesh>();
  private geometryData = new Map<string, GeometryData>();
  
  // Cached primitives
  private quadMesh: Mesh | null = null;
  private cubeMesh: Mesh | null = null;
  private sphereMesh: Mesh | null = null;
  private planeMesh: Mesh | null = null;
  
  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.createPrimitiveMeshes();
  }

  private createPrimitiveMeshes(): void {
    // Create fullscreen quad
    this.quadMesh = this.createQuad();
    
    // Create basic primitives
    this.cubeMesh = this.createCube();
    this.sphereMesh = this.createSphere(32, 16);
    this.planeMesh = this.createPlane(1, 1, 1, 1);
  }

  createMesh(name: string, data: GeometryData): Mesh {
    const gl = this.gl;
    
    // Create vertex array object
    const vao = gl.createVertexArray();
    if (!vao) {
      throw new Error('Failed to create vertex array object');
    }
    
    gl.bindVertexArray(vao);
    
    // Create vertex buffer
    const vertexBuffer = gl.createBuffer();
    if (!vertexBuffer) {
      throw new Error('Failed to create vertex buffer');
    }
    
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, data.vertices, gl.STATIC_DRAW);
    
    // Set up vertex attributes
    for (const attr of data.attributes) {
      const location = gl.getAttribLocation(gl.getParameter(gl.CURRENT_PROGRAM), attr.name);
      if (location >= 0) {
        gl.enableVertexAttribArray(location);
        gl.vertexAttribPointer(
          location,
          attr.size,
          attr.type,
          attr.normalized,
          attr.stride,
          attr.offset
        );
        
        if (attr.divisor !== undefined) {
          gl.vertexAttribDivisor(location, attr.divisor);
        }
      }
    }
    
    // Create index buffer
    const indexBuffer = gl.createBuffer();
    if (!indexBuffer) {
      throw new Error('Failed to create index buffer');
    }
    
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data.indices, gl.STATIC_DRAW);
    
    gl.bindVertexArray(null);
    
    // Calculate bounding volumes
    const boundingBox = this.calculateBoundingBox(data.vertices, data.attributes);
    const boundingSphere = this.calculateBoundingSphere(boundingBox);
    
    const mesh: Mesh = {
      vertexArray: vao,
      vertexBuffer,
      indexBuffer,
      indexCount: data.indices.length,
      vertexCount: data.vertices.length / this.getVertexStride(data.attributes),
      drawMode: data.drawMode || gl.TRIANGLES,
      instanceCount: data.instanceCount,
      boundingBox,
      boundingSphere
    };
    
    this.meshes.set(name, mesh);
    this.geometryData.set(name, data);
    
    return mesh;
  }

  private getVertexStride(attributes: VertexAttribute[]): number {
    let stride = 0;
    for (const attr of attributes) {
      stride += attr.size;
    }
    return stride;
  }

  private calculateBoundingBox(
    vertices: Float32Array, 
    attributes: VertexAttribute[]
  ): { min: [number, number, number]; max: [number, number, number] } {
    // Find position attribute
    const posAttr = attributes.find(attr => attr.name === 'a_position' || attr.name === 'position');
    if (!posAttr) {
      return { min: [-1, -1, -1], max: [1, 1, 1] };
    }
    
    const stride = posAttr.stride / 4; // Convert bytes to floats
    const offset = posAttr.offset / 4;
    
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    
    for (let i = offset; i < vertices.length; i += stride) {
      const x = vertices[i];
      const y = vertices[i + 1];
      const z = vertices[i + 2];
      
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (z < minZ) minZ = z;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      if (z > maxZ) maxZ = z;
    }
    
    return {
      min: [minX, minY, minZ],
      max: [maxX, maxY, maxZ]
    };
  }

  private calculateBoundingSphere(
    boundingBox: { min: [number, number, number]; max: [number, number, number] }
  ): { center: [number, number, number]; radius: number } {
    const center: [number, number, number] = [
      (boundingBox.min[0] + boundingBox.max[0]) * 0.5,
      (boundingBox.min[1] + boundingBox.max[1]) * 0.5,
      (boundingBox.min[2] + boundingBox.max[2]) * 0.5
    ];
    
    const dx = boundingBox.max[0] - center[0];
    const dy = boundingBox.max[1] - center[1];
    const dz = boundingBox.max[2] - center[2];
    const radius = Math.sqrt(dx * dx + dy * dy + dz * dz);
    
    return { center, radius };
  }

  bindMesh(mesh: Mesh): void {
    this.gl.bindVertexArray(mesh.vertexArray);
  }

  renderMesh(mesh: Mesh): void {
    const gl = this.gl;
    this.bindMesh(mesh);
    
    if (mesh.instanceCount && mesh.instanceCount > 0) {
      gl.drawElementsInstanced(mesh.drawMode, mesh.indexCount, gl.UNSIGNED_SHORT, 0, mesh.instanceCount);
    } else {
      gl.drawElements(mesh.drawMode, mesh.indexCount, gl.UNSIGNED_SHORT, 0);
    }
  }

  renderFullscreenQuad(): void {
    if (this.quadMesh) {
      this.renderMesh(this.quadMesh);
    }
  }

  getMesh(name: string): Mesh | null {
    return this.meshes.get(name) || null;
  }

  hasMesh(name: string): boolean {
    return this.meshes.has(name);
  }

  removeMesh(name: string): void {
    const mesh = this.meshes.get(name);
    if (mesh) {
      const gl = this.gl;
      gl.deleteVertexArray(mesh.vertexArray);
      gl.deleteBuffer(mesh.vertexBuffer);
      gl.deleteBuffer(mesh.indexBuffer);
      
      this.meshes.delete(name);
      this.geometryData.delete(name);
    }
  }

  // Primitive creation methods
  private createQuad(): Mesh {
    const vertices = new Float32Array([
      // Position    UV
      -1, -1, 0,     0, 0,
       1, -1, 0,     1, 0,
       1,  1, 0,     1, 1,
      -1,  1, 0,     0, 1
    ]);
    
    const indices = new Uint16Array([
      0, 1, 2,
      2, 3, 0
    ]);
    
    const attributes: VertexAttribute[] = [
      { name: 'a_position', size: 3, type: this.gl.FLOAT, normalized: false, stride: 20, offset: 0 },
      { name: 'a_texCoord', size: 2, type: this.gl.FLOAT, normalized: false, stride: 20, offset: 12 }
    ];
    
    return this.createMesh('_quad', { vertices, indices, attributes });
  }

  private createCube(): Mesh {
    const vertices = new Float32Array([
      // Front face
      -1, -1,  1,   0, 0, 1,   0, 0,
       1, -1,  1,   0, 0, 1,   1, 0,
       1,  1,  1,   0, 0, 1,   1, 1,
      -1,  1,  1,   0, 0, 1,   0, 1,
      
      // Back face
      -1, -1, -1,   0, 0, -1,  1, 0,
      -1,  1, -1,   0, 0, -1,  1, 1,
       1,  1, -1,   0, 0, -1,  0, 1,
       1, -1, -1,   0, 0, -1,  0, 0,
      
      // Top face
      -1,  1, -1,   0, 1, 0,   0, 1,
      -1,  1,  1,   0, 1, 0,   0, 0,
       1,  1,  1,   0, 1, 0,   1, 0,
       1,  1, -1,   0, 1, 0,   1, 1,
      
      // Bottom face
      -1, -1, -1,   0, -1, 0,  1, 1,
       1, -1, -1,   0, -1, 0,  0, 1,
       1, -1,  1,   0, -1, 0,  0, 0,
      -1, -1,  1,   0, -1, 0,  1, 0,
      
      // Right face
       1, -1, -1,   1, 0, 0,   1, 0,
       1,  1, -1,   1, 0, 0,   1, 1,
       1,  1,  1,   1, 0, 0,   0, 1,
       1, -1,  1,   1, 0, 0,   0, 0,
      
      // Left face
      -1, -1, -1,   -1, 0, 0,  0, 0,
      -1, -1,  1,   -1, 0, 0,  1, 0,
      -1,  1,  1,   -1, 0, 0,  1, 1,
      -1,  1, -1,   -1, 0, 0,  0, 1
    ]);
    
    const indices = new Uint16Array([
      0,  1,  2,    0,  2,  3,    // front
      4,  5,  6,    4,  6,  7,    // back
      8,  9,  10,   8,  10, 11,   // top
      12, 13, 14,   12, 14, 15,   // bottom
      16, 17, 18,   16, 18, 19,   // right
      20, 21, 22,   20, 22, 23    // left
    ]);
    
    const attributes: VertexAttribute[] = [
      { name: 'a_position', size: 3, type: this.gl.FLOAT, normalized: false, stride: 32, offset: 0 },
      { name: 'a_normal', size: 3, type: this.gl.FLOAT, normalized: false, stride: 32, offset: 12 },
      { name: 'a_texCoord', size: 2, type: this.gl.FLOAT, normalized: false, stride: 32, offset: 24 }
    ];
    
    return this.createMesh('_cube', { vertices, indices, attributes });
  }

  private createSphere(latitudeBands: number, longitudeBands: number): Mesh {
    const vertices: number[] = [];
    const indices: number[] = [];
    
    for (let lat = 0; lat <= latitudeBands; lat++) {
      const theta = (lat * Math.PI) / latitudeBands;
      const sinTheta = Math.sin(theta);
      const cosTheta = Math.cos(theta);
      
      for (let lon = 0; lon <= longitudeBands; lon++) {
        const phi = (lon * 2 * Math.PI) / longitudeBands;
        const sinPhi = Math.sin(phi);
        const cosPhi = Math.cos(phi);
        
        const x = cosPhi * sinTheta;
        const y = cosTheta;
        const z = sinPhi * sinTheta;
        const u = 1 - (lon / longitudeBands);
        const v = 1 - (lat / latitudeBands);
        
        // Position
        vertices.push(x, y, z);
        // Normal
        vertices.push(x, y, z);
        // UV
        vertices.push(u, v);
      }
    }
    
    for (let lat = 0; lat < latitudeBands; lat++) {
      for (let lon = 0; lon < longitudeBands; lon++) {
        const first = lat * (longitudeBands + 1) + lon;
        const second = first + longitudeBands + 1;
        
        indices.push(first, second, first + 1);
        indices.push(second, second + 1, first + 1);
      }
    }
    
    const attributes: VertexAttribute[] = [
      { name: 'a_position', size: 3, type: this.gl.FLOAT, normalized: false, stride: 32, offset: 0 },
      { name: 'a_normal', size: 3, type: this.gl.FLOAT, normalized: false, stride: 32, offset: 12 },
      { name: 'a_texCoord', size: 2, type: this.gl.FLOAT, normalized: false, stride: 32, offset: 24 }
    ];
    
    return this.createMesh('_sphere', {
      vertices: new Float32Array(vertices),
      indices: new Uint16Array(indices),
      attributes
    });
  }

  private createPlane(width: number, height: number, widthSegments: number, heightSegments: number): Mesh {
    const vertices: number[] = [];
    const indices: number[] = [];
    
    const widthHalf = width * 0.5;
    const heightHalf = height * 0.5;
    
    const gridX = Math.floor(widthSegments);
    const gridY = Math.floor(heightSegments);
    
    const segmentWidth = width / gridX;
    const segmentHeight = height / gridY;
    
    // Generate vertices
    for (let iy = 0; iy <= gridY; iy++) {
      const y = iy * segmentHeight - heightHalf;
      
      for (let ix = 0; ix <= gridX; ix++) {
        const x = ix * segmentWidth - widthHalf;
        
        // Position
        vertices.push(x, 0, -y);
        // Normal
        vertices.push(0, 1, 0);
        // UV
        vertices.push(ix / gridX, 1 - (iy / gridY));
      }
    }
    
    // Generate indices
    for (let iy = 0; iy < gridY; iy++) {
      for (let ix = 0; ix < gridX; ix++) {
        const a = ix + (gridX + 1) * iy;
        const b = ix + (gridX + 1) * (iy + 1);
        const c = (ix + 1) + (gridX + 1) * (iy + 1);
        const d = (ix + 1) + (gridX + 1) * iy;
        
        indices.push(a, b, d);
        indices.push(b, c, d);
      }
    }
    
    const attributes: VertexAttribute[] = [
      { name: 'a_position', size: 3, type: this.gl.FLOAT, normalized: false, stride: 32, offset: 0 },
      { name: 'a_normal', size: 3, type: this.gl.FLOAT, normalized: false, stride: 32, offset: 12 },
      { name: 'a_texCoord', size: 2, type: this.gl.FLOAT, normalized: false, stride: 32, offset: 24 }
    ];
    
    return this.createMesh('_plane', {
      vertices: new Float32Array(vertices),
      indices: new Uint16Array(indices),
      attributes
    });
  }

  // Instanced rendering support
  createInstanceBuffer(data: Float32Array): WebGLBuffer {
    const gl = this.gl;
    const buffer = gl.createBuffer();
    
    if (!buffer) {
      throw new Error('Failed to create instance buffer');
    }
    
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
    
    return buffer;
  }

  updateInstanceBuffer(buffer: WebGLBuffer, data: Float32Array, offset: number = 0): void {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, offset, data);
  }

  setupInstancedAttributes(mesh: Mesh, instanceBuffer: WebGLBuffer, attributes: VertexAttribute[]): void {
    const gl = this.gl;
    
    gl.bindVertexArray(mesh.vertexArray);
    gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer);
    
    for (const attr of attributes) {
      const location = gl.getAttribLocation(gl.getParameter(gl.CURRENT_PROGRAM), attr.name);
      if (location >= 0) {
        gl.enableVertexAttribArray(location);
        gl.vertexAttribPointer(
          location,
          attr.size,
          attr.type,
          attr.normalized,
          attr.stride,
          attr.offset
        );
        gl.vertexAttribDivisor(location, attr.divisor || 1);
      }
    }
    
    gl.bindVertexArray(null);
  }

  // Memory management
  getMemoryUsage(): number {
    let totalBytes = 0;
    
    for (const data of this.geometryData.values()) {
      totalBytes += data.vertices.byteLength;
      totalBytes += data.indices.byteLength;
    }
    
    return totalBytes;
  }

  getMeshCount(): number {
    return this.meshes.size;
  }

  clear(): void {
    const gl = this.gl;
    
    for (const mesh of this.meshes.values()) {
      gl.deleteVertexArray(mesh.vertexArray);
      gl.deleteBuffer(mesh.vertexBuffer);
      gl.deleteBuffer(mesh.indexBuffer);
    }
    
    this.meshes.clear();
    this.geometryData.clear();
  }

  dispose(): void {
    this.clear();
    this.quadMesh = null;
    this.cubeMesh = null;
    this.sphereMesh = null;
    this.planeMesh = null;
  }
}
