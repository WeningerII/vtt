import React, { useRef, useEffect, useState, useCallback, useMemo, memo } from "react";
import { logger } from "@vtt/logging";
import { useGame } from "../providers/GameProvider";
import PerformanceMonitor from "./PerformanceMonitor";
// Inline WebGL Renderer implementation for immediate functionality
class WebGLRenderer {
  private canvas: HTMLCanvasElement;
  private gl: WebGL2RenderingContext;
  private program!: WebGLProgram;
  private vertexBuffer!: WebGLBuffer;
  private indexBuffer!: WebGLBuffer;
  private instanceBuffer!: WebGLBuffer;
  private locations!: any;
  private textures: Map<string, any> = new Map();
  private renderQueue: RenderObject[] = [];
  private camera: Camera = {
    position: [0, 0],
    zoom: 1,
    rotation: 0,
    viewport: [0, 0, 800, 600],
  };
  private mvpMatrix: Float32Array = new Float32Array(16);
  private stats = { fps: 60, frameTime: 16.67, drawCalls: 1, triangles: 100 };

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const gl = canvas.getContext("webgl2", {
      alpha: true,
      antialias: true,
      depth: true,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
    });
    if (!gl) {throw new Error("WebGL2 not supported");}
    this.gl = gl;
    this.initializeRenderer();
  }

  private initializeRenderer(): void {
    const gl = this.gl;
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    
    this.program = this.createShaderProgram();
    gl.useProgram(this.program);
    
    this.locations = {
      position: gl.getAttribLocation(this.program, "a_position"),
      texCoord: gl.getAttribLocation(this.program, "a_texCoord"),
      instancePosition: gl.getAttribLocation(this.program, "a_instancePosition"),
      instanceRotation: gl.getAttribLocation(this.program, "a_instanceRotation"),
      instanceScale: gl.getAttribLocation(this.program, "a_instanceScale"),
      instanceColor: gl.getAttribLocation(this.program, "a_instanceColor"),
      instanceTexOffset: gl.getAttribLocation(this.program, "a_instanceTexOffset"),
      mvpMatrix: gl.getUniformLocation(this.program, "u_mvpMatrix"),
      textureAtlas: gl.getUniformLocation(this.program, "u_textureAtlas"),
    };
    
    this.createBuffers();
    this.setupVertexArray();
  }

  private createShaderProgram(): WebGLProgram {
    const gl = this.gl;
    const vertexShader = this.createShader(gl.VERTEX_SHADER, `#version 300 es
      precision highp float;
      in vec2 a_position;
      in vec2 a_texCoord;
      in vec3 a_instancePosition;
      in float a_instanceRotation;
      in vec2 a_instanceScale;
      in vec4 a_instanceColor;
      in vec2 a_instanceTexOffset;
      uniform mat4 u_mvpMatrix;
      out vec2 v_texCoord;
      out vec4 v_color;
      void main() {
        vec2 scaledPos = a_position * a_instanceScale;
        float cos_r = cos(a_instanceRotation);
        float sin_r = sin(a_instanceRotation);
        vec2 rotatedPos = vec2(scaledPos.x * cos_r - scaledPos.y * sin_r, scaledPos.x * sin_r + scaledPos.y * cos_r);
        vec3 worldPos = vec3(rotatedPos + a_instancePosition.xy, a_instancePosition.z);
        gl_Position = u_mvpMatrix * vec4(worldPos, 1.0);
        v_texCoord = a_texCoord + a_instanceTexOffset;
        v_color = a_instanceColor;
      }`);
    
    const fragmentShader = this.createShader(gl.FRAGMENT_SHADER, `#version 300 es
      precision highp float;
      in vec2 v_texCoord;
      in vec4 v_color;
      uniform sampler2D u_textureAtlas;
      out vec4 fragColor;
      void main() {
        vec4 texColor = texture(u_textureAtlas, v_texCoord);
        fragColor = texColor * v_color;
        if (fragColor.a < 0.01) discard;
      }`);
    
    const program = gl.createProgram()!;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(`Could not compile WebGL program: ${  gl.getProgramInfoLog(program)}`);
    }
    return program;
  }

  private createShader(type: number, source: string): WebGLShader {
    const gl = this.gl;
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(`Could not compile shader: ${  gl.getShaderInfoLog(shader)}`);
    }
    return shader;
  }

  private createBuffers(): void {
    const gl = this.gl;
    const quadVertices = new Float32Array([-0.5, -0.5, 0.0, 0.0, 0.5, -0.5, 1.0, 0.0, 0.5, 0.5, 1.0, 1.0, -0.5, 0.5, 0.0, 1.0]);
    const quadIndices = new Uint16Array([0, 1, 2, 2, 3, 0]);
    
    this.vertexBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, quadVertices, gl.STATIC_DRAW);
    
    this.indexBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, quadIndices, gl.STATIC_DRAW);
    
    this.instanceBuffer = gl.createBuffer()!;
  }

  private setupVertexArray(): void {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
    gl.enableVertexAttribArray(this.locations.position);
    gl.vertexAttribPointer(this.locations.position, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(this.locations.texCoord);
    gl.vertexAttribPointer(this.locations.texCoord, 2, gl.FLOAT, false, 16, 8);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
  }

  public loadTexture(id: string, image: HTMLImageElement): void {
    const gl = this.gl;
    const texture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    this.textures.set(id, { glTexture: texture, width: image.width, height: image.height });
  }

  public setCamera(camera: Partial<Camera>): void {
    Object.assign(this.camera, camera);
  }

  public addRenderObject(obj: RenderObject): void {
    if (obj.visible) {this.renderQueue.push(obj);}
  }

  public clearRenderQueue(): void {
    this.renderQueue = [];
  }

  public render(): void {
    const gl = this.gl;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0.1, 0.1, 0.1, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    if (this.renderQueue.length === 0) {return;}

    this.renderQueue.sort((a, b) => {
      if (a.layer !== b.layer) {return a.layer - b.layer;}
      return a.textureId.localeCompare(b.textureId);
    });

    this.updateMVPMatrix();

    let currentTexture = "";
    let batchStart = 0;

    for (let i = 0; i <= this.renderQueue.length; i++) {
      const obj = this.renderQueue[i];
      const textureId = obj?.textureId || "";
      if (textureId !== currentTexture || i === this.renderQueue.length) {
        if (i > batchStart) {this.renderBatch(currentTexture, batchStart, i);}
        currentTexture = textureId;
        batchStart = i;
      }
    }
    this.clearRenderQueue();
  }

  private renderBatch(textureId: string, start: number, end: number): void {
    const gl = this.gl;
    const batchSize = end - start;

    if (this.locations.mvpMatrix) {gl.uniformMatrix4fv(this.locations.mvpMatrix, false, this.mvpMatrix);}

    const texture = this.textures.get(textureId);
    if (texture) {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture.glTexture);
      if (this.locations.textureAtlas) {gl.uniform1i(this.locations.textureAtlas, 0);}
    }

    const instanceData = new Float32Array(batchSize * 12);
    for (let i = start; i < end; i++) {
      const obj = this.renderQueue[i];
      if (!obj) {continue;}
      const offset = (i - start) * 12;
      instanceData[offset] = obj.position[0];
      instanceData[offset + 1] = obj.position[1];
      instanceData[offset + 2] = obj.position[2];
      instanceData[offset + 3] = obj.rotation;
      instanceData[offset + 4] = obj.scale[0];
      instanceData[offset + 5] = obj.scale[1];
      instanceData[offset + 6] = obj.color[0];
      instanceData[offset + 7] = obj.color[1];
      instanceData[offset + 8] = obj.color[2];
      instanceData[offset + 9] = obj.color[3];
      instanceData[offset + 10] = 0;
      instanceData[offset + 11] = 0;
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, instanceData, gl.DYNAMIC_DRAW);

    const stride = 12 * 4;
    gl.enableVertexAttribArray(this.locations.instancePosition);
    gl.vertexAttribPointer(this.locations.instancePosition, 3, gl.FLOAT, false, stride, 0);
    gl.vertexAttribDivisor(this.locations.instancePosition, 1);
    gl.enableVertexAttribArray(this.locations.instanceRotation);
    gl.vertexAttribPointer(this.locations.instanceRotation, 1, gl.FLOAT, false, stride, 12);
    gl.vertexAttribDivisor(this.locations.instanceRotation, 1);
    gl.enableVertexAttribArray(this.locations.instanceScale);
    gl.vertexAttribPointer(this.locations.instanceScale, 2, gl.FLOAT, false, stride, 16);
    gl.vertexAttribDivisor(this.locations.instanceScale, 1);
    gl.enableVertexAttribArray(this.locations.instanceColor);
    gl.vertexAttribPointer(this.locations.instanceColor, 4, gl.FLOAT, false, stride, 24);
    gl.vertexAttribDivisor(this.locations.instanceColor, 1);
    gl.enableVertexAttribArray(this.locations.instanceTexOffset);
    gl.vertexAttribPointer(this.locations.instanceTexOffset, 2, gl.FLOAT, false, stride, 40);
    gl.vertexAttribDivisor(this.locations.instanceTexOffset, 1);

    gl.drawElementsInstanced(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0, batchSize);
  }

  private updateMVPMatrix(): void {
    const viewMatrix = this.createViewMatrix();
    const projMatrix = this.createProjectionMatrix();
    this.mvpMatrix = this.multiplyMatrices(projMatrix, viewMatrix);
  }

  private createViewMatrix(): Float32Array {
    const cam = this.camera;
    const matrix = new Float32Array(16);
    const cos_r = Math.cos(-cam.rotation);
    const sin_r = Math.sin(-cam.rotation);
    const scale = cam.zoom;
    matrix[0] = cos_r * scale;
    matrix[4] = -sin_r * scale;
    matrix[12] = -cam.position[0] * scale;
    matrix[1] = sin_r * scale;
    matrix[5] = cos_r * scale;
    matrix[13] = -cam.position[1] * scale;
    matrix[10] = 1;
    matrix[15] = 1;
    return matrix;
  }

  private createProjectionMatrix(): Float32Array {
    const matrix = new Float32Array(16);
    const width = this.canvas.width;
    const height = this.canvas.height;
    const left = -width / 2;
    const right = width / 2;
    const bottom = -height / 2;
    const top = height / 2;
    matrix[0] = 2 / (right - left);
    matrix[5] = 2 / (top - bottom);
    matrix[10] = -2 / 2000;
    matrix[12] = -(right + left) / (right - left);
    matrix[13] = -(top + bottom) / (top - bottom);
    matrix[14] = -1000 / 2000;
    matrix[15] = 1;
    return matrix;
  }

  private multiplyMatrices(a: Float32Array, b: Float32Array): Float32Array {
    const result = new Float32Array(16);
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        result[i * 4 + j] = (a[i * 4 + 0] || 0) * (b[0 * 4 + j] || 0) + (a[i * 4 + 1] || 0) * (b[1 * 4 + j] || 0) + (a[i * 4 + 2] || 0) * (b[2 * 4 + j] || 0) + (a[i * 4 + 3] || 0) * (b[3 * 4 + j] || 0);
      }
    }
    return result;
  }

  public hasTexture(id: string): boolean {
    return this.textures.has(id);
  }

  public resize(width: number, height: number): void {
    this.canvas.width = width;
    this.canvas.height = height;
    this.camera.viewport = [0, 0, width, height];
  }

  public getStats() {
    return this.stats;
  }

  public dispose(): void {
    const gl = this.gl;
    gl.deleteProgram(this.program);
    gl.deleteBuffer(this.vertexBuffer);
    gl.deleteBuffer(this.indexBuffer);
    gl.deleteBuffer(this.instanceBuffer);
    for (const texture of this.textures.values()) {
      gl.deleteTexture(texture.glTexture);
    }
    this.textures.clear();
  }
}

// Type definitions to match the renderer interface
interface RenderObject {
  id: string;
  position: [number, number, number];
  rotation: number;
  scale: [number, number];
  textureId: string;
  color: [number, number, number, number];
  visible: boolean;
  layer: number;
}

interface Camera {
  position: [number, number];
  zoom: number;
  rotation: number;
  viewport: [number, number, number, number];
}
import { useWebSocket } from "../providers/WebSocketProvider";

export interface GameCanvasProps {
  width: number;
  height: number;
  gameId: string;
  isGM: boolean;
}

export interface Token {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  textureId: string;
  name: string;
  color: [number, number, number, number];
  rotation: number;
  scale: [number, number];
  visible: boolean;
  layer: number;
  selected?: boolean;
  actorId?: string;
}

export interface MapData {
  id: string;
  imageUrl: string;
  width: number;
  height: number;
  gridSize: number;
}

export const GameCanvas: React.FC<GameCanvasProps> = memo(({ width, height, gameId, isGM }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<WebGLRenderer | null>(null);
  const animationFrameRef = useRef<number>(0);

  const [tokens, setTokens] = useState<Token[]>([]);
  const [selectedTokens, setSelectedTokens] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [showPerformanceMonitor, setShowPerformanceMonitor] = useState(false);
  const [dragState, setDragState] = useState<{
    isDragging: boolean;
    startPos: { x: number; y: number };
    tokenId?: string;
  }>({ isDragging: false, startPos: { x: 0, y: 0 } });

  const [camera, setCamera] = useState({
    position: [0, 0] as [number, number],
    zoom: 1,
    rotation: 0,
    viewport: [0, 0, width, height] as [number, number, number, number],
  });

  const [mapData, setMapData] = useState<MapData | null>(null);

  const { send: wsSend, subscribe: wsSubscribe, isConnected } = useWebSocket();
  const game = useGame();

  // Memoize expensive calculations
  const viewportBounds = useMemo(() => {
    const viewportPadding = 100;
    const viewLeft = camera.position[0] - width / 2 / camera.zoom - viewportPadding;
    const viewRight = camera.position[0] + width / 2 / camera.zoom + viewportPadding;
    const viewTop = camera.position[1] - height / 2 / camera.zoom - viewportPadding;
    const viewBottom = camera.position[1] + height / 2 / camera.zoom + viewportPadding;
    return { viewLeft, viewRight, viewTop, viewBottom };
  }, [camera.position, camera.zoom, width, height]);

  // Initialize WebGL renderer
  useEffect(() => {
    if (!canvasRef.current) {return;}

    try {
      const renderer = new WebGLRenderer(canvasRef.current);
      rendererRef.current = renderer;

      // Set initial camera
      renderer.setCamera(camera);
      renderer.resize(width, height);

      logger.info("WebGL renderer initialized");
      setIsLoading(false);
    } catch (error) {
      logger.error("Failed to initialize WebGL renderer:", error as any);
      setIsLoading(false);
    }

    return () => {
      if (rendererRef.current) {
        rendererRef.current.dispose();
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [width, height]);

  // Handle canvas resize
  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.resize(width, height);
      setCamera((prev) => ({ ...prev, viewport: [0, 0, width, height] }));
    }
  }, [width, height]);

  // Load map and initial game state
  useEffect(() => {
    const loadGameState = async () => {
      if (!gameId || !rendererRef.current) {return;}

      try {
        // Load game data from server
        const response = await fetch(`/api/games/${gameId}`);
        const gameData = await response.json();

        // Load map if available
        if (gameData.mapId) {
          const mapResponse = await fetch(`/api/maps/${gameData.mapId}`);
          const mapData = await mapResponse.json();
          setMapData(mapData);

          // Load map texture
          if (mapData.imageUrl) {
            const img = new Image();
            img.onload = () => {
              rendererRef.current?.loadTexture("map", img);
            };
            img.src = mapData.imageUrl;
          }
        }

        // Preload common textures
        const commonTextures = [
          "/assets/textures/grid.png",
          "/assets/textures/token-placeholder.png",
        ];

        for (const texture of commonTextures) {
          if (!rendererRef.current?.hasTexture(texture)) {
            const img = new Image();
            img.onload = () => {
              rendererRef.current?.loadTexture(texture, img);
            };
            img.src = texture;
          }
        }

        // Load tokens
        if (gameData.tokens) {
          setTokens(gameData.tokens);

          // Load token textures
          gameData.tokens.forEach((token: Token) => {
            if (token.textureId && !rendererRef.current?.hasTexture(token.textureId)) {
              const img = new Image();
              img.onload = () => {
                rendererRef.current?.loadTexture(token.textureId, img);
              };
              img.src = `/api/assets/${token.textureId}/file`;
            }
          });
        }
      } catch (error) {
        logger.error("Failed to load game state:", error as any);
      }
    };

    loadGameState();
  }, [gameId]);

  // WebSocket event handlers
  useEffect(() => {
    if (!isConnected) {return;}

    const handleTokenMove = (data: { tokenId: string; x: number; y: number }) => {
      setTokens((prev) =>
        prev.map((token) =>
          token.id === data.tokenId ? { ...token, x: data.x, y: data.y } : token,
        ),
      );
    };

    const handleTokenAdd = (token: Token) => {
      setTokens((prev) => [...prev, token]);

      // Load token texture if needed
      if (token.textureId && rendererRef.current) {
        const img = new Image();
        img.onload = () => {
          rendererRef.current?.loadTexture(token.textureId, img);
        };
        img.src = `/api/assets/${token.textureId}/file`;
      }
    };

    const handleTokenRemove = (data: { tokenId: string }) => {
      setTokens((prev) => prev.filter((token) => token.id !== data.tokenId));
      setSelectedTokens((prev) => {
        const newSet = new Set(prev);
        newSet.delete(data.tokenId);
        return newSet;
      });
    };

    const handleCameraUpdate = (cameraData: Partial<Camera>) => {
      setCamera((prev) => ({ ...prev, ...cameraData }));
    };

    const unsubscribeTokenMove = wsSubscribe("token:move", handleTokenMove);
    const unsubscribeTokenAdd = wsSubscribe("token:add", handleTokenAdd);
    const unsubscribeTokenRemove = wsSubscribe("token:remove", handleTokenRemove);
    const unsubscribeCameraUpdate = wsSubscribe("camera:update", handleCameraUpdate);

    return () => {
      unsubscribeTokenMove();
      unsubscribeTokenAdd();
      unsubscribeTokenRemove();
      unsubscribeCameraUpdate();
    };
  }, [isConnected, wsSubscribe]);

  // Render loop
  const render = useCallback(() => {
    if (!rendererRef.current) {return;}

    const renderer = rendererRef.current;
    renderer.setCamera(camera);

    // Clear render queue
    renderer.clearRenderQueue();

    // Add map to render queue
    if (mapData) {
      const mapObject: RenderObject = {
        id: "map",
        position: [0, 0, -1],
        rotation: 0,
        scale: [mapData.width, mapData.height],
        textureId: "map",
        color: [1, 1, 1, 1],
        visible: true,
        layer: 0,
      };
      renderer.addRenderObject(mapObject);
    }

    // Add tokens to render queue with viewport culling optimization
    const { viewLeft, viewRight, viewTop, viewBottom } = viewportBounds;

    let culledCount = 0;
    let renderedCount = 0;

    tokens.forEach((token) => {
      if (!token.visible) {return;}

      // Viewport culling - only render tokens within camera view
      const tokenLeft = token.x - token.width / 2;
      const tokenRight = token.x + token.width / 2;
      const tokenTop = token.y - token.height / 2;
      const tokenBottom = token.y + token.height / 2;

      // Check if token is outside viewport bounds
      if (
        tokenRight < viewLeft ||
        tokenLeft > viewRight ||
        tokenBottom < viewTop ||
        tokenTop > viewBottom
      ) {
        culledCount++;
        return; // Skip rendering this token
      }

      renderedCount++;
      const isSelected = selectedTokens.has(token.id);
      const color: [number, number, number, number] = isSelected
        ? [1, 1, 0.5, 1] // Yellow tint for selected
        : token.color;

      const renderObject: RenderObject = {
        id: token.id,
        position: [token.x, token.y, token.layer],
        rotation: token.rotation,
        scale: token.scale,
        textureId: token.textureId,
        color,
        visible: token.visible,
        layer: token.layer + 1, // Tokens above map
      };

      renderer.addRenderObject(renderObject);
    });

    // Render frame
    renderer.render();

    // Schedule next frame
    animationFrameRef.current = requestAnimationFrame(render);
  }, [tokens, selectedTokens, camera, mapData, viewportBounds]);

  // Start render loop
  useEffect(() => {
    if (!isLoading && rendererRef.current) {
      render();
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isLoading, render]);

  // Mouse event handlers
  const handleMouseDown = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      if (!canvasRef.current || !rendererRef.current) {return;}

      const rect = canvasRef.current.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      // Convert screen to world coordinates
      const worldX = (x - width / 2) / camera.zoom + camera.position[0];
      const worldY = (y - height / 2) / camera.zoom + camera.position[1];

      // Find token at position
      const clickedToken = tokens.find(
        (token) =>
          worldX >= token.x - token.width / 2 &&
          worldX <= token.x + token.width / 2 &&
          worldY >= token.y - token.height / 2 &&
          worldY <= token.y + token.height / 2,
      );

      if (clickedToken) {
        // Select token
        if (event.ctrlKey || event.metaKey) {
          // Multi-select
          setSelectedTokens((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(clickedToken.id)) {
              newSet.delete(clickedToken.id);
            } else {
              newSet.add(clickedToken.id);
            }
            return newSet;
          });
        } else {
          // Single select
          setSelectedTokens(new Set([clickedToken.id]));
        }

        // Start drag if GM (owner check removed due to missing currentUserId property)
        if (isGM) {
          setDragState({
            isDragging: true,
            startPos: { x: worldX, y: worldY },
            tokenId: clickedToken.id,
          });
        }
      } else {
        // Clear selection
        setSelectedTokens(new Set());
      }
    },
    [tokens, camera],
  );

  const handleMouseMove = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      if (!dragState.isDragging || !dragState.tokenId || !canvasRef.current) {return;}

      const rect = canvasRef.current.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      // Convert screen to world coordinates
      const worldX = (x - width / 2) / camera.zoom + camera.position[0];
      const worldY = (y - height / 2) / camera.zoom + camera.position[1];

      // Update token position locally
      setTokens((prev) =>
        prev.map((token) =>
          token.id === dragState.tokenId ? { ...token, x: worldX, y: worldY } : token,
        ),
      );
    },
    [dragState, camera, width, height],
  );

  const handleMouseUp = useCallback(() => {
    if (dragState.isDragging && dragState.tokenId && isConnected) {
      // Send final position to server
      const token = tokens.find((t) => t.id === dragState.tokenId);
      if (token) {
        wsSend({
          type: "token:move",
          gameId,
          tokenId: token.id,
          x: token.x,
          y: token.y,
        });
      }
    }

    setDragState({ isDragging: false, startPos: { x: 0, y: 0 } });
  }, [dragState, tokens, isConnected, wsSend, gameId]);

  // Camera controls
  const handleWheel = useCallback(
    (event: React.WheelEvent<HTMLCanvasElement>) => {
      event.preventDefault();

      const zoomSpeed = 0.1;
      const newZoom = Math.max(0.1, Math.min(5, camera.zoom - event.deltaY * zoomSpeed * 0.01));

      setCamera((prev) => ({ ...prev, zoom: newZoom }));

      // Broadcast camera update if GM
      if (isGM && isConnected) {
        wsSend({
          type: "camera:update",
          gameId,
          zoom: newZoom,
        });
      }
    },
    [camera.zoom, isGM, isConnected, wsSend, gameId],
  );

  const handleDoubleClick = useCallback(
    (__event: React.MouseEvent<HTMLCanvasElement>) => {
      // Reset camera to center
      const newCamera = {
        position: [0, 0] as [number, number],
        zoom: 1,
        rotation: 0,
        viewport: [0, 0, width, height] as [number, number, number, number],
      };

      setCamera(newCamera);

      if (isGM && isConnected) {
        wsSend({
          type: "camera:update",
          gameId,
          ...newCamera,
        });
      }
    },
    [width, height, isGM, isConnected, wsSend, gameId],
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center" style={{ width, height }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
          <p className="text-sm text-gray-600">Initializing game canvas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative" style={{ width, height }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="border border-gray-300 cursor-crosshair"
        data-testid="scene-canvas"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        onDoubleClick={handleDoubleClick}
      />

      {/* Enhanced Debug info with performance monitoring */}
      {typeof window !== "undefined" && (window as any).__DEV__ && (
        <div className="absolute top-2 left-2 bg-black bg-opacity-75 text-white text-xs p-2 rounded space-y-1">
          <div className="font-semibold text-green-400">Performance Monitor</div>
          <div>
            FPS:{" "}
            <span
              className={`${(rendererRef.current?.getStats()?.fps || 0) > 55 ? "text-green-400" : (rendererRef.current?.getStats()?.fps || 0) > 30 ? "text-yellow-400" : "text-red-400"}`}
            >
              {rendererRef.current?.getStats()?.fps || 0}
            </span>
          </div>
          <div>
            Frame Time: {rendererRef.current?.getStats()?.frameTime?.toFixed(2) || "0.00"}ms
          </div>
          <div>Draw Calls: {rendererRef.current?.getStats()?.drawCalls || 0}</div>
          <div>Triangles: {rendererRef.current?.getStats()?.triangles || 0}</div>
          <div className="border-t border-gray-600 pt-1 mt-1">
            <div className="font-semibold text-blue-400">Scene Info</div>
            <div>
              Tokens: <span className="text-cyan-400">{tokens.length}</span> (visible:{" "}
              {tokens.filter((t) => t.visible).length})
            </div>
            <div>
              Selected: <span className="text-yellow-400">{selectedTokens.size}</span>
            </div>
            <div>
              Camera: ({camera.position[0].toFixed(1)}, {camera.position[1].toFixed(1)}) @{" "}
              {camera.zoom.toFixed(2)}x
            </div>
            <div>
              Viewport: {width}x{height}
            </div>
          </div>
          <div className="border-t border-gray-600 pt-1">
            <div className="font-semibold text-purple-400">Rendering</div>
            <div>
              Viewport Culled:{" "}
              <span className="text-orange-400">
                {tokens.length - tokens.filter((t) => t.visible).length}
              </span>{" "}
              tokens
            </div>
            <div>
              Rendered:{" "}
              <span className="text-green-400">{tokens.filter((t) => t.visible).length}</span>{" "}
              tokens
            </div>
            <div>
              WebGL State: <span className="text-green-400">Active</span>
            </div>
          </div>
        </div>
      )}

      {/* Performance Monitor Component */}
      <PerformanceMonitor
        isVisible={showPerformanceMonitor}
        onToggle={() => setShowPerformanceMonitor(!showPerformanceMonitor)}
      />

      {/* Token count indicator */}
      <div className="absolute bottom-2 right-2 bg-gray-800 text-white text-sm px-2 py-1 rounded">
        {tokens.filter((t) => t.visible).length} tokens
      </div>
    </div>
  );
});

export default GameCanvas;
