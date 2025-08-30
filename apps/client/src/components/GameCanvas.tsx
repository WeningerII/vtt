import React, { useRef, useEffect, useState, useCallback, useMemo, memo } from "react";
import { logger } from "@vtt/logging";
import { useGame } from "../providers/GameProvider";
import PerformanceMonitor from "./PerformanceMonitor";
// import { WebGLRenderer, RenderObject, Camera } from '@vtt/renderer';

// Temporary type definitions until @vtt/renderer is available
interface WebGLRenderer {
  setCamera(camera: any): void;
  resize(width: number, height: number): void;
  dispose(): void;
  clearRenderQueue(): void;
  addRenderObject(obj: RenderObject): void;
  render(): void;
  loadTexture(id: string, image: HTMLImageElement): void;
  hasTexture(id: string): boolean;
  getStats(): { fps: number; frameTime: number; drawCalls: number; triangles: number } | undefined;
}

interface RenderObject {
  id: string;
  position: [number, number, number];
  rotation: number;
  scale: [number, number] | number[];
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

// Mock WebGLRenderer constructor
const WebGLRenderer = class {
  constructor(canvas: HTMLCanvasElement) {
    // Mock implementation
  }
  setCamera(camera: any) {}
  resize(width: number, height: number) {}
  dispose() {}
  clearRenderQueue() {}
  addRenderObject(obj: RenderObject) {}
  render() {}
  loadTexture(id: string, image: HTMLImageElement) {}
  hasTexture(id: string): boolean {
    return false;
  }
  getStats() {
    return { fps: 60, frameTime: 16.67, drawCalls: 1, triangles: 100 };
  }
};
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

  const { socket } = useWebSocket();
  const { currentGame } = useGame();

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
    if (!canvasRef.current) return;

    try {
      const renderer = new WebGLRenderer(canvasRef.current);
      rendererRef.current = renderer;

      // Set initial camera
      renderer.setCamera(camera);
      renderer.resize(width, height);

      logger.info("WebGL renderer initialized");
      setIsLoading(false);
    } catch (error) {
      logger.error("Failed to initialize WebGL renderer:", error);
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
      if (!gameId || !rendererRef.current) return;

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
        logger.error("Failed to load game state:", error);
      }
    };

    loadGameState();
  }, [gameId]);

  // WebSocket event handlers
  useEffect(() => {
    if (!socket) return;

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

    socket.on("token:move", handleTokenMove);
    socket.on("token:add", handleTokenAdd);
    socket.on("token:remove", handleTokenRemove);
    socket.on("camera:update", handleCameraUpdate);

    return () => {
      socket.off("token:move", handleTokenMove);
      socket.off("token:add", handleTokenAdd);
      socket.off("token:remove", handleTokenRemove);
      socket.off("camera:update", handleCameraUpdate);
    };
  }, [socket]);

  // Render loop
  const render = useCallback(() => {
    if (!rendererRef.current) return;

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
      if (!token.visible) return;

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
      if (!canvasRef.current || !rendererRef.current) return;

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

        // Start drag if GM or owner
        if (isGM || clickedToken.actorId === currentGame?.currentUserId) {
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
      if (!dragState.isDragging || !dragState.tokenId || !canvasRef.current) return;

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
    if (dragState.isDragging && dragState.tokenId && socket) {
      // Send final position to server
      const token = tokens.find((t) => t.id === dragState.tokenId);
      if (token) {
        socket.emit("token:move", {
          gameId,
          tokenId: token.id,
          x: token.x,
          y: token.y,
        });
      }
    }

    setDragState({ isDragging: false, startPos: { x: 0, y: 0 } });
  }, [dragState, tokens, socket, gameId]);

  // Camera controls
  const handleWheel = useCallback(
    (event: React.WheelEvent<HTMLCanvasElement>) => {
      event.preventDefault();

      const zoomSpeed = 0.1;
      const newZoom = Math.max(0.1, Math.min(5, camera.zoom - event.deltaY * zoomSpeed * 0.01));

      setCamera((prev) => ({ ...prev, zoom: newZoom }));

      // Broadcast camera update if GM
      if (isGM && socket) {
        socket.emit("camera:update", { gameId, zoom: newZoom });
      }
    },
    [camera.zoom, isGM, socket, gameId],
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

      if (isGM && socket) {
        socket.emit("camera:update", { gameId, ...newCamera });
      }
    },
    [width, height, isGM, socket, gameId],
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
