import { logger } from "@vtt/logging";

export interface TextureOptions {
  format?: number;
  internalFormat?: number;
  type?: number;
  wrapS?: number;
  wrapT?: number;
  minFilter?: number;
  magFilter?: number;
  generateMipmaps?: boolean;
  flipY?: boolean;
  premultiplyAlpha?: boolean;
  unpackAlignment?: number;
  anisotropy?: number;
}

export interface CubeMapFaces {
  positiveX: string | ImageData | HTMLImageElement;
  negativeX: string | ImageData | HTMLImageElement;
  positiveY: string | ImageData | HTMLImageElement;
  negativeY: string | ImageData | HTMLImageElement;
  positiveZ: string | ImageData | HTMLImageElement;
  negativeZ: string | ImageData | HTMLImageElement;
}

export class TextureManager {
  private gl: WebGL2RenderingContext;
  private textures = new Map<string, WebGLTexture>();
  private textureData = new Map<string, { width: number; height: number; format: number }>();
  private loadingPromises = new Map<string, Promise<WebGLTexture>>();
  private defaultTextures = new Map<string, WebGLTexture>();
  private anisotropyExt: EXT_texture_filter_anisotropic | null;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.anisotropyExt = gl.getExtension("EXT_texture_filter_anisotropic");
    this.createDefaultTextures();
  }

  private createDefaultTextures(): void {
    const _gl = this.gl;

    // White 1x1 texture
    this.defaultTextures.set("white", this.createSolidColorTexture([255, 255, 255, 255]));

    // Black 1x1 texture
    this.defaultTextures.set("black", this.createSolidColorTexture([0, 0, 0, 255]));

    // Normal map default (128, 128, 255, 255) - pointing up
    this.defaultTextures.set("normalMap", this.createSolidColorTexture([128, 128, 255, 255]));

    // Default metallic/roughness (0, 128, 0, 255) - no metallic, 0.5 roughness
    this.defaultTextures.set(
      "metallicRoughnessMap",
      this.createSolidColorTexture([0, 128, 0, 255]),
    );

    // Default occlusion (full white - no occlusion)
    this.defaultTextures.set("occlusionMap", this.createSolidColorTexture([255, 255, 255, 255]));

    // Default emissive (black - no emission)
    this.defaultTextures.set("emissiveMap", this.createSolidColorTexture([0, 0, 0, 255]));

    // Checkerboard pattern for missing textures
    this.defaultTextures.set("missing", this.createCheckerboardTexture(64, 64));

    // Default cube map
    this.defaultTextures.set("cubeMap", this.createDefaultCubeMap());
  }

  private createSolidColorTexture(color: number[]): WebGLTexture {
    const gl = this.gl;
    const texture = gl.createTexture()!;

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      1,
      1,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      new Uint8Array(color),
    );

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);

    return texture;
  }

  private createCheckerboardTexture(width: number, height: number): WebGLTexture {
    const gl = this.gl;
    const texture = gl.createTexture()!;
    const data = new Uint8Array(width * height * 4);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = (y * width + x) * 4;
        const checker = ((x >> 3) + (y >> 3)) & 1;
        const color = checker ? 255 : 128;

        data[index] = color; // R
        data[index + 1] = color; // G
        data[index + 2] = color; // B
        data[index + 3] = 255; // A
      }
    }

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    gl.generateMipmap(gl.TEXTURE_2D);

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);

    return texture;
  }

  private createDefaultCubeMap(): WebGLTexture {
    const gl = this.gl;
    const texture = gl.createTexture()!;

    gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);

    // Create a simple gradient cube map
    const faces = [
      gl.TEXTURE_CUBE_MAP_POSITIVE_X, // +X (red)
      gl.TEXTURE_CUBE_MAP_NEGATIVE_X, // -X (dark red)
      gl.TEXTURE_CUBE_MAP_POSITIVE_Y, // +Y (green)
      gl.TEXTURE_CUBE_MAP_NEGATIVE_Y, // -Y (dark green)
      gl.TEXTURE_CUBE_MAP_POSITIVE_Z, // +Z (blue)
      gl.TEXTURE_CUBE_MAP_NEGATIVE_Z, // -Z (dark blue)
    ];

    const colors = [
      [255, 128, 128, 255], // Light red
      [128, 64, 64, 255], // Dark red
      [128, 255, 128, 255], // Light green
      [64, 128, 64, 255], // Dark green
      [128, 128, 255, 255], // Light blue
      [64, 64, 128, 255], // Dark blue
    ];

    for (let i = 0; i < 6; i++) {
      gl.texImage2D(
        faces[i] ?? gl.TEXTURE_CUBE_MAP_POSITIVE_X,
        0,
        gl.RGBA,
        1,
        1,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        new Uint8Array(colors[i] ?? [255, 255, 255]),
      );
    }

    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);

    return texture;
  }

  async loadTexture(path: string, options: TextureOptions = {}): Promise<WebGLTexture> {
    // Return cached texture if available
    if (this.textures.has(path)) {
      return this.textures.get(path)!;
    }

    // Return existing loading promise if in progress
    if (this.loadingPromises.has(path)) {
      return this.loadingPromises.get(path)!;
    }

    // Start loading
    const loadingPromise = this._loadTexture(path, options);
    this.loadingPromises.set(path, loadingPromise);

    try {
      const texture = await loadingPromise;
      this.textures.set(path, texture);
      return texture;
    } catch (error) {
      logger.error(`Failed to load texture: ${path}`, error as Record<string, any>);
      // Return missing texture fallback
      return this.defaultTextures.get("missing")!;
    } finally {
      this.loadingPromises.delete(path);
    }
  }

  private async _loadTexture(path: string, options: TextureOptions): Promise<WebGLTexture> {
    const gl = this.gl;
    const texture = gl.createTexture();

    if (!texture) {
      throw new Error("Failed to create texture");
    }

    // Set default options
    const opts = {
      format: gl.RGBA,
      internalFormat: gl.RGBA8,
      type: gl.UNSIGNED_BYTE,
      wrapS: gl.REPEAT,
      wrapT: gl.REPEAT,
      minFilter: gl.LINEAR_MIPMAP_LINEAR,
      magFilter: gl.LINEAR,
      generateMipmaps: true,
      flipY: true,
      premultiplyAlpha: false,
      unpackAlignment: 4,
      anisotropy: 16,
      ...options,
    };

    gl.bindTexture(gl.TEXTURE_2D, texture);

    // Set texture parameters
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, opts.wrapS);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, opts.wrapT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, opts.minFilter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, opts.magFilter);

    // Set anisotropic filtering if available
    if (this.anisotropyExt && opts.anisotropy > 1) {
      const maxAnisotropy = gl.getParameter(this.anisotropyExt.MAX_TEXTURE_MAX_ANISOTROPY_EXT);
      const anisotropy = Math.min(opts.anisotropy, maxAnisotropy);
      gl.texParameterf(gl.TEXTURE_2D, this.anisotropyExt.TEXTURE_MAX_ANISOTROPY_EXT, anisotropy);
    }

    // Set pixel store parameters
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, opts.flipY);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, opts.premultiplyAlpha);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, opts.unpackAlignment);

    // Load image
    const image = await this.loadImage(path);

    // Upload texture data
    gl.texImage2D(gl.TEXTURE_2D, 0, opts.internalFormat, opts.format, opts.type, image);

    // Generate mipmaps if requested
    if (opts.generateMipmaps && this.isPowerOfTwo(image.width) && this.isPowerOfTwo(image.height)) {
      gl.generateMipmap(gl.TEXTURE_2D);
    } else if (opts.generateMipmaps) {
      logger.warn(
        `Cannot generate mipmaps for non-power-of-two texture: ${path} (${image.width}x${image.height})`,
      );
      // Set filters to not use mipmaps
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    }

    // Store texture metadata
    this.textureData.set(path, {
      width: image.width,
      height: image.height,
      format: opts.format,
    });

    return texture;
  }

  async loadCubeMapTexture(
    faces: CubeMapFaces,
    options: TextureOptions = {},
  ): Promise<WebGLTexture> {
    const gl = this.gl;
    const texture = gl.createTexture();

    if (!texture) {
      throw new Error("Failed to create cube map texture");
    }

    gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);

    const opts = {
      format: gl.RGBA,
      internalFormat: gl.RGBA8,
      type: gl.UNSIGNED_BYTE,
      minFilter: gl.LINEAR_MIPMAP_LINEAR,
      magFilter: gl.LINEAR,
      generateMipmaps: true,
      flipY: false, // Cube maps usually don't need flipping
      ...options,
    };

    // Set texture parameters
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, opts.minFilter);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, opts.magFilter);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);

    // Set pixel store parameters
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, opts.flipY);

    // Load all faces
    const faceTargets = [
      { target: gl.TEXTURE_CUBE_MAP_POSITIVE_X, source: faces.positiveX },
      { target: gl.TEXTURE_CUBE_MAP_NEGATIVE_X, source: faces.negativeX },
      { target: gl.TEXTURE_CUBE_MAP_POSITIVE_Y, source: faces.positiveY },
      { target: gl.TEXTURE_CUBE_MAP_NEGATIVE_Y, source: faces.negativeY },
      { target: gl.TEXTURE_CUBE_MAP_POSITIVE_Z, source: faces.positiveZ },
      { target: gl.TEXTURE_CUBE_MAP_NEGATIVE_Z, source: faces.negativeZ },
    ];

    for (const face of faceTargets) {
      let image: HTMLImageElement | ImageData;

      if (typeof face.source === "string") {
        image = await this.loadImage(face.source);
      } else {
        image = face.source as HTMLImageElement | ImageData;
      }

      gl.texImage2D(face.target, 0, opts.internalFormat, opts.format, opts.type, image);
    }

    // Generate mipmaps if requested
    if (opts.generateMipmaps) {
      gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
    }

    return texture;
  }

  private loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((_resolve, __reject) => {
      const image = new Image();
      image.crossOrigin = "anonymous";

      image.onload = () => _resolve(image);
      image.onerror = (_error) => __reject(new Error(`Failed to load image: ${src}`));

      image.src = src;
    });
  }

  private isPowerOfTwo(value: number): boolean {
    return (value & (value - 1)) === 0 && value > 0;
  }

  createDataTexture(
    data: ArrayBufferView,
    width: number,
    height: number,
    options: TextureOptions = {},
  ): WebGLTexture {
    const gl = this.gl;
    const texture = gl.createTexture();

    if (!texture) {
      throw new Error("Failed to create data texture");
    }

    const opts = {
      format: gl.RGBA,
      internalFormat: gl.RGBA8,
      type: gl.UNSIGNED_BYTE,
      wrapS: gl.CLAMP_TO_EDGE,
      wrapT: gl.CLAMP_TO_EDGE,
      minFilter: gl.LINEAR,
      magFilter: gl.LINEAR,
      generateMipmaps: false,
      ...options,
    };

    gl.bindTexture(gl.TEXTURE_2D, texture);

    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      opts.internalFormat,
      width,
      height,
      0,
      opts.format,
      opts.type,
      data,
    );

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, opts.wrapS);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, opts.wrapT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, opts.minFilter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, opts.magFilter);

    if (opts.generateMipmaps) {
      gl.generateMipmap(gl.TEXTURE_2D);
    }

    return texture;
  }

  createRenderTexture(width: number, height: number, options: TextureOptions = {}): WebGLTexture {
    return this.createDataTexture(null as any, width, height, {
      wrapS: this.gl.CLAMP_TO_EDGE,
      wrapT: this.gl.CLAMP_TO_EDGE,
      minFilter: this.gl.LINEAR,
      magFilter: this.gl.LINEAR,
      generateMipmaps: false,
      ...options,
    });
  }

  getTexture(path: string): WebGLTexture | null {
    return this.textures.get(path) || null;
  }

  getDefaultTexture(type: string): WebGLTexture {
    return this.defaultTextures.get(type) || this.defaultTextures.get("white")!;
  }

  getTextureData(path: string): { width: number; height: number; format: number } | null {
    return this.textureData.get(path) || null;
  }

  hasTexture(path: string): boolean {
    return this.textures.has(path);
  }

  removeTexture(path: string): void {
    const texture = this.textures.get(path);
    if (texture) {
      this.gl.deleteTexture(texture);
      this.textures.delete(path);
      this.textureData.delete(path);
    }
  }

  clear(): void {
    for (const texture of this.textures.values()) {
      this.gl.deleteTexture(texture);
    }
    this.textures.clear();
    this.textureData.clear();
    this.loadingPromises.clear();
  }

  dispose(): void {
    this.clear();

    // Dispose default textures
    for (const texture of this.defaultTextures.values()) {
      this.gl.deleteTexture(texture);
    }
    this.defaultTextures.clear();
  }

  // Utility methods
  getMemoryUsage(): number {
    let totalBytes = 0;

    for (const data of this.textureData.values()) {
      const bytesPerPixel = this.getBytesPerPixel(data.format);
      totalBytes += data.width * data.height * bytesPerPixel;
    }

    return totalBytes;
  }

  private getBytesPerPixel(format: number): number {
    const gl = this.gl;

    switch (format) {
      case gl.RGBA:
        return 4;
      case gl.RGB:
        return 3;
      case gl.RG:
        return 2;
      case gl.RED:
        return 1;
      default:
        return 4;
    }
  }

  getLoadedTextureCount(): number {
    return this.textures.size;
  }

  getLoadingTextureCount(): number {
    return this.loadingPromises.size;
  }
}
