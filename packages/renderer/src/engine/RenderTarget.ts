export interface RenderTargetOptions {
  colorFormat?: number;
  depthFormat?: number;
  stencilFormat?: number;
  filter?: number;
  wrap?: number;
  samples?: number;
  generateMipmaps?: boolean;
  floatTexture?: boolean;
}

export class RenderTarget {
  private gl: WebGL2RenderingContext;
  private framebuffer: WebGLFramebuffer;
  private width: number;
  private height: number;
  private options: RenderTargetOptions;

  public colorTexture: WebGLTexture | null = null;
  public depthTexture: WebGLTexture | null = null;
  public stencilTexture: WebGLTexture | null = null;
  public colorBuffer: WebGLRenderbuffer | null = null;
  public depthBuffer: WebGLRenderbuffer | null = null;
  public stencilBuffer: WebGLRenderbuffer | null = null;

  constructor(
    gl: WebGL2RenderingContext,
    width: number,
    height: number,
    options: RenderTargetOptions = {},
  ) {
    this.gl = gl;
    this.width = width;
    this.height = height;
    this.options = {
      colorFormat: gl.RGBA8,
      depthFormat: gl.DEPTH_COMPONENT24,
      filter: gl.LINEAR,
      wrap: gl.CLAMP_TO_EDGE,
      samples: 0,
      generateMipmaps: false,
      floatTexture: false,
      ...options,
    };

    const framebuffer = gl.createFramebuffer();
    if (!framebuffer) {
      throw new Error("Failed to create framebuffer");
    }
    this.framebuffer = framebuffer;

    this.createAttachments();
  }

  private createAttachments(): void {
    const gl = this.gl;

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);

    // Create color attachment
    if (this.options.colorFormat) {
      if (this.options.samples && this.options.samples > 0) {
        // Multisampled render buffer
        this.colorBuffer = gl.createRenderbuffer();
        gl.bindRenderbuffer(gl.RENDERBUFFER, this.colorBuffer);
        gl.renderbufferStorageMultisample(
          gl.RENDERBUFFER,
          this.options.samples,
          this.options.colorFormat,
          this.width,
          this.height,
        );
        gl.framebufferRenderbuffer(
          gl.FRAMEBUFFER,
          gl.COLOR_ATTACHMENT0,
          gl.RENDERBUFFER,
          this.colorBuffer,
        );
      } else {
        // Color texture
        this.colorTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.colorTexture);

        const internalFormat = this.options.colorFormat;
        const format = this.getFormatFromInternalFormat(internalFormat);
        const type = this.getTypeFromInternalFormat(internalFormat);

        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          internalFormat,
          this.width,
          this.height,
          0,
          format,
          type,
          null,
        );

        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, this.options.filter!);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, this.options.filter!);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, this.options.wrap!);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, this.options.wrap!);

        if (this.options.generateMipmaps) {
          gl.generateMipmap(gl.TEXTURE_2D);
        }

        gl.framebufferTexture2D(
          gl.FRAMEBUFFER,
          gl.COLOR_ATTACHMENT0,
          gl.TEXTURE_2D,
          this.colorTexture,
          0,
        );
      }
    }

    // Create depth attachment
    if (this.options.depthFormat) {
      if (this.options.samples && this.options.samples > 0) {
        // Multisampled depth buffer
        this.depthBuffer = gl.createRenderbuffer();
        gl.bindRenderbuffer(gl.RENDERBUFFER, this.depthBuffer);
        gl.renderbufferStorageMultisample(
          gl.RENDERBUFFER,
          this.options.samples,
          this.options.depthFormat,
          this.width,
          this.height,
        );
        gl.framebufferRenderbuffer(
          gl.FRAMEBUFFER,
          gl.DEPTH_ATTACHMENT,
          gl.RENDERBUFFER,
          this.depthBuffer,
        );
      } else {
        // Depth texture
        this.depthTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.depthTexture);

        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          this.options.depthFormat,
          this.width,
          this.height,
          0,
          gl.DEPTH_COMPONENT,
          gl.UNSIGNED_INT,
          null,
        );

        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        gl.framebufferTexture2D(
          gl.FRAMEBUFFER,
          gl.DEPTH_ATTACHMENT,
          gl.TEXTURE_2D,
          this.depthTexture,
          0,
        );
      }
    }

    // Create stencil attachment
    if (this.options.stencilFormat) {
      if (this.options.samples && this.options.samples > 0) {
        // Multisampled stencil buffer
        this.stencilBuffer = gl.createRenderbuffer();
        gl.bindRenderbuffer(gl.RENDERBUFFER, this.stencilBuffer);
        gl.renderbufferStorageMultisample(
          gl.RENDERBUFFER,
          this.options.samples,
          this.options.stencilFormat,
          this.width,
          this.height,
        );
        gl.framebufferRenderbuffer(
          gl.FRAMEBUFFER,
          gl.STENCIL_ATTACHMENT,
          gl.RENDERBUFFER,
          this.stencilBuffer,
        );
      } else {
        // Stencil texture
        this.stencilTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.stencilTexture);

        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          this.options.stencilFormat,
          this.width,
          this.height,
          0,
          gl.STENCIL_INDEX8,
          gl.UNSIGNED_BYTE,
          null,
        );

        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

        gl.framebufferTexture2D(
          gl.FRAMEBUFFER,
          gl.STENCIL_ATTACHMENT,
          gl.TEXTURE_2D,
          this.stencilTexture,
          0,
        );
      }
    }

    // Check framebuffer completeness
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      throw new Error(`Framebuffer incomplete: ${this.getFramebufferStatusString(status)}`);
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  private getFormatFromInternalFormat(internalFormat: number): number {
    const gl = this.gl;

    switch (internalFormat) {
      case gl.RGBA8:
      case gl.RGBA16F:
      case gl.RGBA32F:
        return gl.RGBA;
      case gl.RGB8:
      case gl.RGB16F:
      case gl.RGB32F:
        return gl.RGB;
      case gl.RG8:
      case gl.RG16F:
      case gl.RG32F:
        return gl.RG;
      case gl.R8:
      case gl.R16F:
      case gl.R32F:
        return gl.RED;
      default:
        return gl.RGBA;
    }
  }

  private getTypeFromInternalFormat(internalFormat: number): number {
    const gl = this.gl;

    switch (internalFormat) {
      case gl.RGBA8:
      case gl.RGB8:
      case gl.RG8:
      case gl.R8:
        return gl.UNSIGNED_BYTE;
      case gl.RGBA16F:
      case gl.RGB16F:
      case gl.RG16F:
      case gl.R16F:
        return gl.HALF_FLOAT;
      case gl.RGBA32F:
      case gl.RGB32F:
      case gl.RG32F:
      case gl.R32F:
        return gl.FLOAT;
      default:
        return gl.UNSIGNED_BYTE;
    }
  }

  private getFramebufferStatusString(status: number): string {
    const gl = this.gl;

    switch (status) {
      case gl.FRAMEBUFFER_INCOMPLETE_ATTACHMENT:
        return "FRAMEBUFFER_INCOMPLETE_ATTACHMENT";
      case gl.FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT:
        return "FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT";
      case gl.FRAMEBUFFER_INCOMPLETE_DIMENSIONS:
        return "FRAMEBUFFER_INCOMPLETE_DIMENSIONS";
      case gl.FRAMEBUFFER_UNSUPPORTED:
        return "FRAMEBUFFER_UNSUPPORTED";
      case gl.FRAMEBUFFER_INCOMPLETE_MULTISAMPLE:
        return "FRAMEBUFFER_INCOMPLETE_MULTISAMPLE";
      default:
        return `UNKNOWN_STATUS_${status}`;
    }
  }

  bind(): void {
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.framebuffer);
    this.gl.viewport(0, 0, this.width, this.height);
  }

  unbind(): void {
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
  }

  resize(width: number, height: number): void {
    if (this.width === width && this.height === height) {
      return;
    }

    this.width = width;
    this.height = height;

    // Delete old attachments
    this.dispose(false);

    // Recreate attachments with new size
    this.createAttachments();
  }

  // Blit to another render target or screen
  blitTo(
    target: RenderTarget | null,
    srcX0: number = 0,
    srcY0: number = 0,
    srcX1: number = this.width,
    srcY1: number = this.height,
    dstX0: number = 0,
    dstY0: number = 0,
    dstX1?: number,
    dstY1?: number,
    mask: number = this.gl.COLOR_BUFFER_BIT,
    filter: number = this.gl.LINEAR,
  ): void {
    const gl = this.gl;

    if (dstX1 === undefined) {dstX1 = target ? target.width : gl.canvas.width;}
    if (dstY1 === undefined) {dstY1 = target ? target.height : gl.canvas.height;}

    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.framebuffer);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, target ? target.framebuffer : null);

    gl.blitFramebuffer(srcX0, srcY0, srcX1, srcY1, dstX0, dstY0, dstX1, dstY1, mask, filter);

    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
  }

  // Read pixels from the render target
  readPixels(
    x: number = 0,
    y: number = 0,
    width: number = this.width,
    height: number = this.height,
    format: number = this.gl.RGBA,
    type: number = this.gl.UNSIGNED_BYTE,
  ): ArrayBufferView {
    const gl = this.gl;

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);

    let pixels: ArrayBufferView;

    switch (type) {
      case gl.UNSIGNED_BYTE:
        pixels = new Uint8Array(width * height * 4);
        break;
      case gl.FLOAT:
        pixels = new Float32Array(width * height * 4);
        break;
      case gl.HALF_FLOAT:
        pixels = new Uint16Array(width * height * 4);
        break;
      default:
        pixels = new Uint8Array(width * height * 4);
    }

    gl.readPixels(x, y, width, height, format, type, pixels);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    return pixels;
  }

  getWidth(): number {
    return this.width;
  }

  getHeight(): number {
    return this.height;
  }

  getOptions(): RenderTargetOptions {
    return { ...this.options };
  }

  dispose(deleteFramebuffer: boolean = true): void {
    const gl = this.gl;

    if (this.colorTexture) {
      gl.deleteTexture(this.colorTexture);
      this.colorTexture = null;
    }

    if (this.depthTexture) {
      gl.deleteTexture(this.depthTexture);
      this.depthTexture = null;
    }

    if (this.stencilTexture) {
      gl.deleteTexture(this.stencilTexture);
      this.stencilTexture = null;
    }

    if (this.colorBuffer) {
      gl.deleteRenderbuffer(this.colorBuffer);
      this.colorBuffer = null;
    }

    if (this.depthBuffer) {
      gl.deleteRenderbuffer(this.depthBuffer);
      this.depthBuffer = null;
    }

    if (this.stencilBuffer) {
      gl.deleteRenderbuffer(this.stencilBuffer);
      this.stencilBuffer = null;
    }

    if (deleteFramebuffer && this.framebuffer) {
      gl.deleteFramebuffer(this.framebuffer);
    }
  }
}
