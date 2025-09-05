/**
 * Interactive Map Editor with drawing tools for VTT
 */

import React, { useState, useRef, useEffect } from "react";
import { logger } from "@vtt/logging";
import AccessibleButton from "./AccessibleButton";
import AccessibleImage from "./AccessibleImage";

// Temporarily using any types until renderer package is available
type Canvas2DRenderer = any;
type GridConfig = any;
type MapLayer = any;
type Token = any;

export interface DrawingTool {
  type:
    | "select"
    | "pen"
    | "brush"
    | "line"
    | "rectangle"
    | "circle"
    | "text"
    | "token"
    | "wall"
    | "door";
  size: number;
  color: string;
  opacity: number;
}

export interface DrawingPath {
  id: string;
  tool: DrawingTool;
  points: Array<{ x: number; y: number }>;
  timestamp: number;
}

interface MapEditorProps {
  onMapChange?: (layers: MapLayer[], paths: DrawingPath[]) => void;
  onTokenChange?: (tokens: Token[]) => void;
  readOnly?: boolean;
  initialLayers?: MapLayer[];
  initialTokens?: Token[];
}

export const MapEditor: React.FC<MapEditorProps> = ({
  onMapChange,
  onTokenChange,
  readOnly = false,
  initialLayers = [],
  initialTokens = [],
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<Canvas2DRenderer | null>(null);
  const [currentTool, setCurrentTool] = useState<DrawingTool>({
    type: "select",
    size: 5,
    color: "#000000",
    opacity: 1,
  });

  const [layers, setLayers] = useState<MapLayer[]>(initialLayers);
  const [paths, setPaths] = useState<DrawingPath[]>([]);
  const [tokens, setTokens] = useState<Token[]>(initialTokens);
  const [activeTool, setActiveTool] = useState<"select" | "brush" | "eraser" | "token">("select");
  const [brushSize, setBrushSize] = useState(10);
  const [aiPrompt, setAiPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<
    Array<{ uri: string; width: number; height: number }>
  >([]);
  const [showGrid, setShowGrid] = useState(true);
  const [gridConfig, setGridConfig] = useState<GridConfig>({
    size: 50,
    color: "#cccccc",
    opacity: 0.5,
  });
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState<DrawingPath | null>(null);

  // Initialize renderer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {return;}

    try {
      // Mock renderer initialization since @vtt/renderer is not available
      const mockRenderer = {
        initialize: () => {},
        render: () => {},
        setLayers: () => {},
        setTokens: () => {},
        saveMap: () => {},
        destroy: () => {},
      };
      rendererRef.current = mockRenderer;
      logger.info("Map editor renderer initialized");
    } catch (error) {
      logger.error("Failed to save map:", error as any);
    }

    return () => {
      if (rendererRef.current) {
        rendererRef.current.destroy();
      }
    };
  }, []);

  // Handle canvas drawing
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) {return;}

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setIsDrawing(true);
    const newPath: DrawingPath = {
      id: `path-${Date.now()}`,
      tool: currentTool,
      points: [{ x, y }],
      timestamp: Date.now(),
    };
    setCurrentPath(newPath);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !currentPath) {return;}

    const canvas = canvasRef.current;
    if (!canvas) {return;}

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setCurrentPath((prev) =>
      prev
        ? {
            ...prev,
            points: [...prev.points, { x, y }],
          }
        : null,
    );
  };

  const handleMouseUp = () => {
    if (!isDrawing || !currentPath) {return;}

    setIsDrawing(false);
    setPaths((prev) => [...prev, currentPath]);
    setCurrentPath(null);

    // Notify parent of changes
    if (onMapChange) {
      onMapChange(layers, [...paths, currentPath]);
    }
  };

  const handleToolChange = (tool: "select" | "brush" | "eraser" | "token") => {
    setActiveTool(tool);
    setCurrentTool({
      type: tool === "brush" ? "brush" : tool === "eraser" ? "pen" : "select",
      size: brushSize,
      color: tool === "eraser" ? "#ffffff" : "#000000",
      opacity: 1,
    });
  };

  const generateMapWithAI = async () => {
    if (!aiPrompt.trim()) {return;}

    setIsGenerating(true);
    try {
      // Mock AI generation - replace with actual AI service call
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const mockImage = {
        uri: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxOCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkdlbmVyYXRlZCBNYXA8L3RleHQ+PC9zdmc+",
        width: 400,
        height: 300,
      };

      setGeneratedImages([mockImage]);
      logger.info("AI map generation completed");
    } catch (error) {
      logger.error("AI map generation failed:", error as any);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="map-editor" role="application" aria-label="Interactive map editor">
      {/* Toolbar */}
      <div className="map-toolbar" role="toolbar" aria-label="Map editing tools">
        <AccessibleButton
          onClick={() => handleToolChange("select")}
          disabled={readOnly}
          action="select"
        >
          Select
        </AccessibleButton>

        <AccessibleButton
          onClick={() => handleToolChange("brush")}
          disabled={readOnly}
          action="draw"
        >
          Brush
        </AccessibleButton>

        <AccessibleButton
          onClick={() => handleToolChange("eraser")}
          disabled={readOnly}
          action="erase"
        >
          Eraser
        </AccessibleButton>

        <AccessibleButton
          onClick={() => handleToolChange("token")}
          disabled={readOnly}
          action="place"
        >
          Token
        </AccessibleButton>

        <div className="brush-size-control">
          <label htmlFor="brush-size">Brush Size:</label>
          <input
            id="brush-size"
            type="range"
            min="1"
            max="50"
            value={brushSize}
            onChange={(e) => setBrushSize(Number(e.target.value))}
            aria-label={`Brush size: ${brushSize} pixels`}
            disabled={readOnly}
          />
          <span aria-live="polite">{brushSize}px</span>
        </div>

        <AccessibleButton
          onClick={() => setShowGrid(!showGrid)}
          aria-label={showGrid ? "Hide grid" : "Show grid"}
          aria-pressed={showGrid}
          action="toggle"
        >
          {showGrid ? "Hide Grid" : "Show Grid"}
        </AccessibleButton>
      </div>

      {/* AI Generation Panel */}
      <div className="ai-generation-panel">
        <div className="ai-prompt-input">
          <label htmlFor="ai-prompt">AI Map Generation:</label>
          <input
            id="ai-prompt"
            type="text"
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            placeholder="Describe the map you want to generate..."
            aria-label="Enter description for AI map generation"
            disabled={readOnly || isGenerating}
          />
          <AccessibleButton
            onClick={generateMapWithAI}
            loading={isGenerating}
            disabled={readOnly || !aiPrompt.trim()}
            action="generate"
          >
            {isGenerating ? "Generating..." : "Generate"}
          </AccessibleButton>
        </div>

        {generatedImages.length > 0 && (
          <div className="generated-images" role="region" aria-label="Generated map images">
            {generatedImages.map((image, index) => (
              <AccessibleImage
                key={index}
                src={image.uri}
                type="generated"
                context={{
                  name: `Generated map ${index + 1}`,
                  description: aiPrompt,
                  index: index + 1,
                }}
                width={image.width}
                height={image.height}
                className="generated-map-preview"
              />
            ))}
          </div>
        )}
      </div>

      {/* Canvas */}
      <div className="map-canvas-container">
        <canvas
          ref={canvasRef}
          width={800}
          height={600}
          className="map-canvas"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          role="img"
          aria-label="Interactive map canvas for drawing and token placement"
          tabIndex={0}
        />
      </div>

      {/* Status */}
      <div className="map-status" role="status" aria-live="polite">
        Active Tool: {activeTool} | Brush Size: {brushSize}px | Grid: {showGrid ? "On" : "Off"} |
        Layers: {layers.length} | Tokens: {tokens.length}
      </div>
    </div>
  );
};

export default MapEditor;
