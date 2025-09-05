/**
 * Battle Map Component - Interactive tactical grid for combat encounters
 */

import React, { useState, useRef, useCallback, useEffect, useMemo, memo, Suspense, lazy } from "react";
import { cn } from "../../lib/utils";
import { useWebSocket } from "../../providers/WebSocketProvider";
import { useGame } from "../../providers/GameProvider";
import { useTouchGestures, type TouchPoint } from "../../hooks/useTouchGestures";
import { SimpleErrorBoundary } from "../ui/SimpleErrorBoundary";
import {
  MousePointer,
  Move,
  Ruler,
  Plus,
  ZoomIn,
  ZoomOut,
  Grid3X3,
  Eye,
  RotateCw,
  Target,
  Layers,
  Settings,
  Trash2,
  Hand,
  RotateCcw,
  Circle,
  Square,
} from "../ui/Icons";
import { Button } from "../ui/Button";
import { LoadingSpinner } from "../ui/LoadingSpinner";

// Lazy load heavy components for better initial bundle size
const TokenPropertiesPanel = lazy(() => import("./TokenPropertiesPanel"));
const MapLayersPanel = lazy(() => import("./MapLayersPanel"));

export interface Token {
  id: string;
  name: string;
  x: number;
  y: number;
  size: number; // Grid squares (1 = Medium, 2 = Large, etc.)
  color: string;
  avatar?: string;
  characterId?: string;
  playerId?: string;
  isVisible: boolean;
  rotation: number; // Degrees
  conditions: string[];
  hitPoints?: {
    current: number;
    max: number;
  };
}

export interface MapLayer {
  id: string;
  name: string;
  type: "background" | "overlay" | "tokens" | "effects";
  visible: boolean;
  opacity: number;
  locked: boolean;
  imageUrl?: string;
}

interface BattleMapProps {
  className?: string;
  isGM?: boolean;
}

type Tool = "select" | "pan" | "measure" | "add-token" | "grid";

const GRID_SIZE = 40; // pixels per grid square
const DEFAULT_MAP_SIZE = { width: 40, height: 30 }; // grid squares

// Enhanced Token component with comprehensive touch support
const MemoizedToken = memo<{
  token: Token;
  isSelected: boolean;
  activeTool: Tool;
  isGM: boolean;
  sessionId: string | undefined;
  onTokenSelect: (tokenId: string, multiSelect: boolean) => void;
  onTokenDoubleClick: (token: Token) => void;
  onTokenMouseDown: (e: React.MouseEvent, token: Token) => void;
  onTokenTouchStart: (token: Token, point: { x: number; y: number }) => void;
}>(({ token, isSelected, activeTool, isGM, sessionId, onTokenSelect, onTokenDoubleClick, onTokenMouseDown, onTokenTouchStart }) => {
  const tokenStyle = useMemo(() => {
    const size = token.size * GRID_SIZE;
    return {
      position: "absolute" as const,
      left: token.x * GRID_SIZE,
      top: token.y * GRID_SIZE,
      width: size,
      height: size,
      backgroundColor: token.color,
      border: isSelected ? "3px solid #fbbf24" : "2px solid #000",
      borderRadius: token.size === 1 ? "50%" : "8px",
      transform: `rotate(${token.rotation}deg)`,
      opacity: token.isVisible ? 1 : isGM ? 0.5 : 0,
      cursor: activeTool === "select" ? "move" : "pointer",
      zIndex: isSelected ? 10 : 5,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "white",
      fontSize: `${Math.max(10, size / 4)}px`,
      fontWeight: "bold",
      textShadow: "1px 1px 2px rgba(0,0,0,0.8)",
      transition: "all 0.1s ease",
    };
  }, [token, isSelected, activeTool, isGM]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onTokenSelect(token.id, e.shiftKey);
  }, [token.id, onTokenSelect]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (isGM || token.playerId === sessionId) {
      onTokenDoubleClick(token);
    }
  }, [token, isGM, sessionId, onTokenDoubleClick]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    onTokenMouseDown(e, token);
  }, [token, onTokenMouseDown]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.stopPropagation();
    if (e.touches.length === 1) {
      const touch = e.touches[0]!;
      onTokenTouchStart(token, { x: touch.clientX, y: touch.clientY });
    }
  }, [token, onTokenTouchStart]);

  const tooltipText = useMemo(() => {
    let tooltip = token.name;
    if (token.hitPoints) {
      tooltip += ` (${token.hitPoints.current}/${token.hitPoints.max} HP)`;
    }
    if (token.conditions.length > 0) {
      tooltip += ` [${token.conditions.join(", ")}]`;
    }
    return tooltip;
  }, [token.name, token.hitPoints, token.conditions]);

  return (
    <div
      role="button"
      style={tokenStyle}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      title={tooltipText}
    >
      {token.avatar ? (
        <img
          src={token.avatar}
          alt={token.name}
          className="w-full h-full object-cover rounded-inherit"
        />
      ) : (
        <span>{token.name.charAt(0).toUpperCase()}</span>
      )}

      {/* Conditions */}
      {token.conditions.length > 0 && (
        <div className="absolute -top-1 -right-1 w-3 h-3 bg-warning rounded-full border border-white text-xs flex items-center justify-center text-white">
          {token.conditions.length}
        </div>
      )}

      {/* Health Bar (if damaged) */}
      {token.hitPoints && token.hitPoints.current < token.hitPoints.max && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-black bg-opacity-50">
          <div
            className="h-full bg-red-500"
            style={{
              width: `${(token.hitPoints.current / token.hitPoints.max) * 100}%`,
            }}
          />
        </div>
      )}
    </div>
  );
});

export const BattleMap = memo<BattleMapProps>(({ className, isGM = false }) => {
  const { send } = useWebSocket();
  const { session } = useGame();
  const mapRef = useRef<HTMLDivElement>(null);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [selectedTokens, setSelectedTokens] = useState<string[]>([]);
  const [activeTool, setActiveTool] = useState<Tool>("select");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [showGrid, setShowGrid] = useState(true);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [draggedToken, setDraggedToken] = useState<string | null>(null);
  const [selectedToken, setSelectedToken] = useState<Token | null>(null);
  const [showTokenProperties, setShowTokenProperties] = useState(false);
  const [showMapLayers, setShowMapLayers] = useState(false);
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const [layers, setLayers] = useState<MapLayer[]>([
    {
      id: "background",
      name: "Background",
      type: "background",
      visible: true,
      opacity: 1,
      locked: false,
    },
    {
      id: "grid",
      name: "Grid",
      type: "overlay",
      visible: true,
      opacity: 0.3,
      locked: false,
    },
    {
      id: "tokens",
      name: "Tokens",
      type: "tokens",
      visible: true,
      opacity: 1,
      locked: false,
    },
  ]);

  // Initialize with some demo tokens
  useEffect(() => {
    setTokens([
      {
        id: "token1",
        name: "Thorin",
        x: 5,
        y: 5,
        size: 1,
        color: "#3b82f6",
        isVisible: true,
        rotation: 0,
        conditions: [],
        hitPoints: { current: 28, max: 28 },
      },
      {
        id: "token2",
        name: "Goblin 1",
        x: 10,
        y: 8,
        size: 1,
        color: "#ef4444",
        isVisible: true,
        rotation: 0,
        conditions: ["poisoned"],
        hitPoints: { current: 7, max: 7 },
      },
      {
        id: "token3",
        name: "Dragon",
        x: 15,
        y: 12,
        size: 3,
        color: "#dc2626",
        isVisible: isGM,
        rotation: 45,
        conditions: [],
        hitPoints: { current: 184, max: 200 },
      },
    ]);
  }, [isGM]);

  const snapToGridCoords = useCallback(
    (x: number, y: number) => {
      if (!snapToGrid) {return { x, y };}
      return {
        x: Math.round(x / GRID_SIZE) * GRID_SIZE,
        y: Math.round(y / GRID_SIZE) * GRID_SIZE,
      };
    },
    [snapToGrid],
  );

  const _handleTokenMove = useCallback(
    (tokenId: string, newX: number, newY: number) => {
      const gridX = Math.round(newX / GRID_SIZE);
      const gridY = Math.round(newY / GRID_SIZE);

      setTokens((prev) =>
        prev.map((token) => (token.id === tokenId ? { ...token, x: gridX, y: gridY } : token)),
      );

      // Send movement to server
      send({
        type: "MOVE_TOKEN",
        entityId: parseInt(tokenId.replace("token", "")) || 0,
        x: gridX,
        y: gridY,
        animate: false,
      });
    },
    [send],
  );

  const handleTokenSelect = useCallback((tokenId: string, multiSelect = false) => {
    setSelectedTokens((prev) => {
      if (multiSelect) {
        return prev.includes(tokenId) ? prev.filter((id) => id !== tokenId) : [...prev, tokenId];
      }
      return [tokenId];
    });
  }, []);

  const handleTokenDoubleClick = useCallback((token: Token) => {
    setSelectedToken(token);
    setShowTokenProperties(true);
  }, []);

  const handleTokenUpdate = useCallback(
    (tokenId: string, updates: Partial<Token>) => {
      setTokens((prev) =>
        prev.map((token) => (token.id === tokenId ? { ...token, ...updates } : token)),
      );

      // Send update to server
      send({
        type: "MOVE_TOKEN",
        entityId: parseInt(tokenId.replace("token", "")) || 0,
        x: updates.x || 0,
        y: updates.y || 0,
        animate: false,
      });
    },
    [send],
  );

  const handleTokenDelete = useCallback((tokenId: string) => {
    setTokens((prev) => prev.filter((token) => token.id !== tokenId));
    setSelectedTokens((prev) => prev.filter((id) => id !== tokenId));
  }, []);

  const handleBackgroundUpload = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setBackgroundImage(result);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleLayersUpdate = useCallback((newLayers: MapLayer[]) => {
    setLayers(newLayers);
  }, []);

  const handleMapClick = useCallback(
    (event: React.MouseEvent) => {
      if (!mapRef.current) {return;}

      const rect = mapRef.current.getBoundingClientRect();
      const x = (event.clientX - rect.left - pan.x) / zoom;
      const y = (event.clientY - rect.top - pan.y) / zoom;

      if (activeTool === "add-token") {
        const gridPos = snapToGridCoords(x, y);
        const newToken: Token = {
          id: `token_${Date.now()}`,
          name: "New Token",
          x: Math.round(gridPos.x / GRID_SIZE),
          y: Math.round(gridPos.y / GRID_SIZE),
          size: 1,
          color: "#6b7280",
          isVisible: true,
          rotation: 0,
          conditions: [],
        };
        setTokens((prev) => [...prev, newToken]);
      } else if (activeTool === "select") {
        // Clear selection if clicking empty space
        setSelectedTokens([]);
      }
    },
    [activeTool, pan, zoom, snapToGridCoords],
  );

  const _handleZoomIn = () => setZoom((prev) => Math.min(prev * 1.2, 3));
  const _handleZoomOut = () => setZoom((prev) => Math.max(prev / 1.2, 0.5));

  const deleteSelectedTokens = () => {
    setTokens((prev) => prev.filter((token) => !selectedTokens.includes(token.id)));
    setSelectedTokens([]);
  };

  const rotateSelectedTokens = (degrees: number) => {
    setTokens((prev) =>
      prev.map((token) =>
        selectedTokens.includes(token.id)
          ? { ...token, rotation: (token.rotation + degrees) % 360 }
          : token,
      ),
    );
  };

  const toggleTokenVisibility = (tokenId: string) => {
    setTokens((prev) =>
      prev.map((token) =>
        token.id === tokenId ? { ...token, isVisible: !token.isVisible } : token,
      ),
    );
  };

  // Comprehensive touch gesture support
  const { gestureState, touchHandlers } = useTouchGestures({
    onPanStart: useCallback((point: TouchPoint) => {
      if (activeTool === "pan" || activeTool === "select") {
        setIsDragging(true);
        setDragStart({ x: point.x, y: point.y });
      }
    }, [activeTool]),
    
    onPanMove: useCallback((delta: { x: number; y: number }, velocity: { x: number; y: number }) => {
      if (activeTool === "pan") {
        // Pan the map
        setPan(prev => ({
          x: prev.x + delta.x / zoom,
          y: prev.y + delta.y / zoom,
        }));
      } else if (activeTool === "select" && draggedToken) {
        // Move selected token
        const token = tokens.find(t => t.id === draggedToken);
        if (token && mapRef.current) {
          const rect = mapRef.current.getBoundingClientRect();
          const newX = Math.round(((dragStart.x + delta.x - rect.left - pan.x) / zoom) / GRID_SIZE);
          const newY = Math.round(((dragStart.y + delta.y - rect.top - pan.y) / zoom) / GRID_SIZE);
          
          setTokens(prev =>
            prev.map(t => t.id === draggedToken ? { ...t, x: newX, y: newY } : t)
          );
        }
      }
    }, [activeTool, draggedToken, tokens, zoom, pan, dragStart]),
    
    onPanEnd: useCallback((velocity: { x: number; y: number }) => {
      if (draggedToken) {
        // Send final token position to server
        const token = tokens.find(t => t.id === draggedToken);
        if (token) {
          send({
            type: "MOVE_TOKEN",
            entityId: parseInt(draggedToken.replace("token", "")) || 0,
            x: token.x,
            y: token.y,
            animate: false,
          });
        }
        setDraggedToken(null);
      }
      setIsDragging(false);
    }, [draggedToken, tokens, send]),
    
    onPinchStart: useCallback((center: { x: number; y: number }) => {
      // Store pinch start state
    }, []),
    
    onPinchMove: useCallback((scale: number, center: { x: number; y: number }) => {
      // Smooth zoom with center point
      const newZoom = Math.max(0.25, Math.min(4, scale * zoom));
      setZoom(newZoom);
      
      // Adjust pan to keep zoom centered on pinch point
      if (mapRef.current) {
        const rect = mapRef.current.getBoundingClientRect();
        const centerX = center.x - rect.left;
        const centerY = center.y - rect.top;
        
        setPan(prev => ({
          x: prev.x + (centerX - rect.width / 2) * (1 - scale) * 0.1,
          y: prev.y + (centerY - rect.height / 2) * (1 - scale) * 0.1,
        }));
      }
    }, [zoom]),
    
    onPinchEnd: useCallback((finalScale: number) => {
      // Finalize zoom level
      setZoom(prev => Math.max(0.25, Math.min(4, prev * finalScale)));
    }, []),
    
    onTap: useCallback((point: TouchPoint) => {
      if (activeTool === "select") {
        // Clear selection on empty tap
        setSelectedTokens([]);
      } else if (activeTool === "add-token" && isGM && mapRef.current) {
        // Add new token on tap
        const rect = mapRef.current.getBoundingClientRect();
        const x = Math.round(((point.x - rect.left - pan.x) / zoom) / GRID_SIZE);
        const y = Math.round(((point.y - rect.top - pan.y) / zoom) / GRID_SIZE);
        
        const newToken: Token = {
          id: `token_${Date.now()}`,
          name: "New Token",
          x,
          y,
          size: 1,
          color: "#6b7280",
          isVisible: true,
          rotation: 0,
          conditions: [],
        };
        setTokens(prev => [...prev, newToken]);
      }
    }, [activeTool, isGM, pan, zoom]),
    
    onDoubleTap: useCallback((point: TouchPoint) => {
      if (activeTool === "select") {
        // Double tap to zoom to token or center view
        setZoom(prev => prev < 1.5 ? 2 : 1);
      }
    }, [activeTool]),
    
    onLongPress: useCallback((point: TouchPoint) => {
      // Long press for context menu (future enhancement)
      console.log("Long press detected at", point);
    }, []),
  });

  // Enhanced token selection with touch support
  const handleTokenMouseDown = useCallback((e: React.MouseEvent, token: Token) => {
    if (activeTool === "select") {
      setIsDragging(true);
      setDraggedToken(token.id);
      setDragStart({
        x: e.clientX,
        y: e.clientY,
      });
    }
  }, [activeTool]);

  // Touch-specific token interaction handler
  const handleTokenTouchStart = useCallback((token: Token, point: { x: number; y: number }) => {
    if (activeTool === "select") {
      setSelectedTokens([token.id]);
      setDraggedToken(token.id);
      setDragStart(point);
      setIsDragging(true);
    }
  }, [activeTool]);

  // Memoize expensive style calculations with better precision
  const mapContainerStyle = useMemo(() => ({
    transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
    transformOrigin: "0 0",
  }), [zoom, pan.x, pan.y]);

  // Memoize grid calculations to avoid expensive re-renders
  const gridDimensions = useMemo(() => ({
    mapWidth: DEFAULT_MAP_SIZE.width * GRID_SIZE,
    mapHeight: DEFAULT_MAP_SIZE.height * GRID_SIZE,
    totalGridSquares: DEFAULT_MAP_SIZE.width * DEFAULT_MAP_SIZE.height,
  }), []);

  // Memoize visible tokens based on viewport and zoom level
  const visibleTokens = useMemo(() => {
    // For high zoom levels, filter tokens outside viewport for better performance
    if (zoom < 0.5) {
      const viewportBuffer = 200; // pixels
      return tokens.filter(token => {
        const tokenX = token.x * GRID_SIZE;
        const tokenY = token.y * GRID_SIZE;
        const tokenSize = token.size * GRID_SIZE;
        
        return tokenX + tokenSize >= -viewportBuffer && 
               tokenX <= gridDimensions.mapWidth + viewportBuffer &&
               tokenY + tokenSize >= -viewportBuffer && 
               tokenY <= gridDimensions.mapHeight + viewportBuffer;
      });
    }
    return tokens;
  }, [tokens, zoom, gridDimensions]);

  const backgroundLayerStyle = useMemo(() => ({
    opacity: layers.find((l) => l.id === "background")?.opacity || 1,
    backgroundImage: backgroundImage ? `url(${backgroundImage})` : undefined,
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
  }), [backgroundImage, layers]);

  const gridLayerStyle = useMemo(() => ({
    opacity: layers.find((l) => l.id === "grid")?.opacity || 0.3,
  }), [layers]);

  // Memoized grid rendering - only recalculate when grid settings change
  const renderedGrid = useMemo(() => {
    if (!showGrid) {return null;}

    const lines: React.ReactElement[] = [];
    const { mapWidth, mapHeight } = gridDimensions;

    // Vertical lines - optimized loop
    for (let i = 0; i <= DEFAULT_MAP_SIZE.width; i++) {
      lines.push(
        <line
          key={`v${i}`}
          x1={i * GRID_SIZE}
          y1={0}
          x2={i * GRID_SIZE}
          y2={mapHeight}
          stroke="rgba(0,0,0,0.2)"
          strokeWidth="1"
        />,
      );
    }

    // Horizontal lines - optimized loop
    for (let i = 0; i <= DEFAULT_MAP_SIZE.height; i++) {
      lines.push(
        <line
          key={`h${i}`}
          x1={0}
          y1={i * GRID_SIZE}
          x2={mapWidth}
          y2={i * GRID_SIZE}
          stroke="rgba(0,0,0,0.2)"
          strokeWidth="1"
        />,
      );
    }

    return (
      <svg className="absolute inset-0 pointer-events-none" width={mapWidth} height={mapHeight}>
        {lines}
      </svg>
    );
  }, [showGrid, gridDimensions]);

  return (
    <div className={cn("flex flex-col h-full bg-bg-primary", className)}>
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-2 bg-bg-secondary border-b border-border-primary">
        {/* Tools */}
        <div className="flex items-center gap-1">
          <Button
            variant={activeTool === "select" ? "primary" : "ghost"}
            size="sm"
            onClick={() => setActiveTool("select")}
          >
            <MousePointer className="h-4 w-4" />
          </Button>
          <Button
            variant={activeTool === "pan" ? "primary" : "ghost"}
            size="sm"
            onClick={() => setActiveTool("pan")}
          >
            <Hand className="h-4 w-4" />
          </Button>
          <Button
            variant={activeTool === "measure" ? "primary" : "ghost"}
            size="sm"
            onClick={() => setActiveTool("measure")}
          >
            <Ruler className="h-4 w-4" />
          </Button>
          {isGM && (
            <Button
              variant={activeTool === "add-token" ? "primary" : "ghost"}
              size="sm"
              onClick={() => setActiveTool("add-token")}
            >
              <Plus className="h-4 w-4" />
            </Button>
          )}
        </div>

        <div className="h-6 w-px bg-border-primary" />

        {/* Grid Controls */}
        <Button
          variant={showGrid ? "primary" : "ghost"}
          size="sm"
          onClick={() => setShowGrid(!showGrid)}
          title="Toggle Grid"
        >
          <Grid3X3 className="h-4 w-4" />
        </Button>

        {isGM && (
          <Button
            variant={showMapLayers ? "primary" : "ghost"}
            size="sm"
            onClick={() => setShowMapLayers(!showMapLayers)}
            title="Map Layers"
          >
            <Layers className="h-4 w-4" />
          </Button>
        )}

        <div className="border-l border-border-primary h-6" />

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setZoom(Math.max(0.25, zoom - 0.25))}
          title="Zoom Out"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>

        <span className="text-xs text-text-secondary px-2">{Math.round(zoom * 100)}%</span>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setZoom(Math.min(4, zoom + 0.25))}
          title="Zoom In"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>

        <div className="h-6 w-px bg-border-primary" />

        {/* Token Controls (when tokens selected) */}
        {selectedTokens.length > 0 && (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => rotateSelectedTokens(-45)}>
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => rotateSelectedTokens(45)}>
              <RotateCw className="h-4 w-4" />
            </Button>
            {isGM && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => selectedTokens.forEach((id) => toggleTokenVisibility(id))}
                >
                  <Eye className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={deleteSelectedTokens}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            )}
            <span className="text-sm text-text-secondary">{selectedTokens.length} selected</span>
          </div>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Snap to Grid */}
        <label className="flex items-center gap-2 text-sm text-text-secondary">
          <input
            type="checkbox"
            checked={snapToGrid}
            onChange={(e) => setSnapToGrid(e.target.checked)}
            className="rounded border-border-primary"
          />
          Snap to Grid
        </label>
      </div>

      {/* Map Canvas */}
      <div className="flex-1 relative overflow-hidden bg-gray-100">
        <div
          role="button"
          ref={mapRef}
          className="absolute inset-0 cursor-crosshair touch-none"
          onClick={handleMapClick}
          onTouchStart={touchHandlers.onTouchStart}
          onTouchMove={touchHandlers.onTouchMove}
          onTouchEnd={touchHandlers.onTouchEnd}
          style={mapContainerStyle}
        >
          {/* Background */}
          <div
            className="relative flex-1 overflow-hidden bg-bg-primary"
            style={mapContainerStyle}
          >
            {/* Background Image Layer */}
            {backgroundImage && layers.find((l) => l.id === "background")?.visible && (
              <div
                className="absolute inset-0"
                style={backgroundLayerStyle}
              />
            )}

            {/* Grid Layer - Use pattern for better performance */}
            {showGrid && layers.find((l) => l.id === "grid")?.visible && (
              <svg
                className="absolute inset-0 pointer-events-none"
                style={{
                  width: gridDimensions.mapWidth,
                  height: gridDimensions.mapHeight,
                  ...gridLayerStyle,
                }}
              >
                <defs>
                  <pattern
                    id="grid"
                    width={GRID_SIZE}
                    height={GRID_SIZE}
                    patternUnits="userSpaceOnUse"
                  >
                    <path
                      d={`M ${GRID_SIZE} 0 L 0 0 0 ${GRID_SIZE}`}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1"
                      className="text-border-primary"
                    />
                  </pattern>
                </defs>
                <rect 
                  width={gridDimensions.mapWidth} 
                  height={gridDimensions.mapHeight} 
                  fill="url(#grid)" 
                />
              </svg>
            )}

            {/* Tokens - Render only visible tokens for performance */}
            {visibleTokens.map((token) => (
              <MemoizedToken
                key={token.id}
                token={token}
                isSelected={selectedTokens.includes(token.id)}
                activeTool={activeTool}
                isGM={isGM}
                sessionId={session?.id}
                onTokenSelect={handleTokenSelect}
                onTokenDoubleClick={handleTokenDoubleClick}
                onTokenMouseDown={handleTokenMouseDown}
                onTokenTouchStart={handleTokenTouchStart}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Token Properties Panel - Lazy loaded */}
      {showTokenProperties && selectedToken && (
        <Suspense
          fallback={
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <LoadingSpinner size="lg" variant="primary" showLabel label="Loading token properties..." />
            </div>
          }
        >
          <TokenPropertiesPanel
            token={selectedToken}
            onClose={() => {
              setShowTokenProperties(false);
              setSelectedToken(null);
            }}
            onUpdate={handleTokenUpdate}
            onDelete={handleTokenDelete}
            isGM={isGM}
          />
        </Suspense>
      )}

      {/* Map Layers Panel - Lazy loaded */}
      {showMapLayers && isGM && (
        <div className="absolute top-16 right-4 w-80 z-50">
          <Suspense
            fallback={
              <div className="w-80 h-64 bg-bg-secondary border border-border-primary rounded-lg p-4 flex items-center justify-center">
                <LoadingSpinner size="md" variant="primary" showLabel label="Loading layers..." />
              </div>
            }
          >
            <MapLayersPanel
              layers={layers}
              onLayersUpdate={handleLayersUpdate}
              onBackgroundUpload={handleBackgroundUpload}
              isGM={isGM}
            />
          </Suspense>
        </div>
      )}
    </div>
  );
});

export default BattleMap;
