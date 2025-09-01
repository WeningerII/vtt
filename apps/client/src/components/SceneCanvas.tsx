import React, { useRef, useEffect, useState } from "react";
import { Application, Container, Sprite, Graphics, Text } from "pixi.js";
import { Viewport } from "pixi-viewport";
import { Socket } from "socket.io-client";

export interface Token {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  scale: number;
  assetUrl?: string;
  color?: number;
}

export interface Scene {
  id: string;
  name: string;
  gridSettings: {
    type: "square" | "hex" | "none";
    size: number;
    offsetX: number;
    offsetY: number;
  };
  tokens: Token[];
}

interface SceneCanvasProps {
  scene: Scene;
  socket: Socket;
  canvasWidth: number;
  canvasHeight: number;
  isGM: boolean;
}

export const SceneCanvas: React.FC<SceneCanvasProps> = ({
  scene,
  socket,
  canvasWidth,
  canvasHeight,
  isGM,
}) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const viewportRef = useRef<Viewport | null>(null);
  const tokensContainerRef = useRef<Container | null>(null);
  const gridContainerRef = useRef<Container | null>(null);
  const [tokens, setTokens] = useState<Map<string, Sprite>>(new Map());
  const [isDragging, setIsDragging] = useState<string | null>(null);

  
  const drawGrid = () => {
    if (!gridGraphics.current) return;
    gridGraphics.current.clear();
    gridGraphics.current.lineStyle(1, 0x444444, 0.5);
    
    const gridSize = 50;
    for (let x = 0; x < canvasWidth; x += gridSize) {
      gridGraphics.current.moveTo(x, 0);
      gridGraphics.current.lineTo(x, canvasHeight);
    }
    for (let y = 0; y < canvasHeight; y += gridSize) {
      gridGraphics.current.moveTo(0, y);
      gridGraphics.current.lineTo(canvasWidth, y);
    }
  };

  const addToken = (token: any) => {
    if (!tokensContainer.current) return;
    const sprite = new PIXI.Sprite(PIXI.Texture.WHITE);
    sprite.width = 50;
    sprite.height = 50;
    sprite.x = token.x;
    sprite.y = token.y;
    sprite.name = token.id || 'token';
    tokensContainer.current.addChild(sprite);
  };

  const drawHexagon = (graphics: PIXI.Graphics, x: number, y: number, radius: number) => {
    const points = [];
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i;
      points.push(
        centerX + radius * Math.cos(angle),
        centerY + radius * Math.sin(angle)
      );
    }
    graphics.drawPolygon(points);
  };


  useEffect(() => {
    if (!canvasRef.current) return;

    // Initialize PixiJS Application
    const app = new Application();

    const initApp = async () => {
      await app.init({
        width: canvasWidth,
        height: canvasHeight,
        backgroundColor: 0x1a1a1a,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      });

      canvasRef.current?.appendChild(app.canvas);
      appRef.current = app;

      // Create viewport for pan/zoom
      const viewport = new Viewport({
        screenWidth: canvasWidth,
        screenHeight: canvasHeight,
        worldWidth: 5000,
        worldHeight: 5000,
        events: app.renderer.events,
      });

      app.stage.addChild(viewport);
      viewportRef.current = viewport;

      // Enable viewport plugins
      viewport.drag().pinch().wheel().decelerate().clampZoom({
        minWidth: 100,
        minHeight: 100,
        maxWidth: 10000,
        maxHeight: 10000,
      });

      // Create containers for different layers
      const gridContainer = new Container();
      const tokensContainer = new Container();

      viewport.addChild(gridContainer);
      viewport.addChild(tokensContainer);

      gridContainerRef.current = gridContainer;
      tokensContainerRef.current = tokensContainer;

      // Draw grid
      drawGrid();

      // Add existing tokens
      scene.tokens.forEach((token) => {
        addToken(token);
      });

      // Center viewport on scene
      viewport.moveCenter(2500, 2500);
    };

    initApp();

    return () => {
      if (appRef.current) {
        appRef.current.destroy();
      }
    };
  }, [canvasWidth, canvasHeight]);

  // Socket event handlers
  useEffect(() => {
    socket.on(
      "token_moved",
      (data: { tokenId: string; _x: number; _y: number; _rotation: number; scale: number }) => {
        const tokenSprite = tokens.get(data.token.id);
        if (tokenSprite && data.token.id !== isDragging) {
          tokenSprite.x = data.x;
          tokenSprite.y = data.y;
          tokenSprite.rotation = data.rotation;
          tokenSprite.scale.set(data.scale);
        }
      },
    );

    socket.on("scene_updated", (data: { scene: Scene }) => {
      // Handle scene updates (grid changes, lighting, etc.)
      if (data.scene.id === scene.id) {
        drawGrid();
      }
    });

    return () => {
      socket.off("token_moved");
      socket.off("scene_updated");
    };
  }, [socket, tokens, isDragging]);

  const _drawGrid = () => {
    if (!gridContainerRef.current) return;

    gridContainerRef.current.removeChildren();

    if (scene.gridSettings.type === "none") return;

    const grid = new Graphics();
    const gridSize = scene.gridSettings.size;
    const offsetX = scene.gridSettings.offsetX || 0;
    const offsetY = scene.gridSettings.offsetY || 0;

    grid.stroke({ width: 1, color: 0x444444, alpha: 0.5 });

    if (scene.gridSettings.type === "square") {
      // Draw square grid
      for (let x = offsetX; x < 5000; x += gridSize) {
        grid.moveTo(x, 0);
        grid.lineTo(x, 5000);
      }
      for (let y = offsetY; y < 5000; y += gridSize) {
        grid.moveTo(0, y);
        grid.lineTo(5000, y);
      }
    } else if (scene.gridSettings.type === "hex") {
      // Draw hexagonal grid (simplified - would need proper hex math)
      const hexHeight = gridSize * Math.sqrt(3);
      const hexWidth = gridSize * 2;

      for (let row = 0; row < 5000 / hexHeight; row++) {
        for (let col = 0; col < 5000 / hexWidth; col++) {
          const x = col * hexWidth * 0.75 + offsetX;
          const y = row * hexHeight + (col % 2) * hexHeight * 0.5 + offsetY;

          drawHexagon(grid, x, y, gridSize);
        }
      }
    }

    gridContainerRef.current.addChild(grid);
  };

  const _drawHexagon = (graphics: Graphics, _x: number, _y: number, _radius: number) => {
    const points: number[] = [];
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i;
      points.push(centerX + radius * Math.cos(angle));
      points.push(centerY + radius * Math.sin(angle));
    }
    graphics.drawPolygon(points);
  };

  const _addToken = (token: Token) => {
    if (!tokensContainerRef.current || tokens.has(token.id)) return;

    let tokenSprite: Sprite;

    if (token.assetUrl) {
      // Load token image
      tokenSprite = Sprite.from(token.assetUrl);
    } else {
      // Create colored circle for token
      const graphics = new Graphics();
      graphics.circle(0, 0, 25);
      graphics.fill(token.color || 0xff0000);

      const texture = appRef.current?.renderer.generateTexture(graphics);
      tokenSprite = new Sprite(texture);
    }

    tokenSprite.x = token.x;
    tokenSprite.y = token.y;
    tokenSprite.width = token.width * scene.gridSettings.size;
    tokenSprite.height = token.height * scene.gridSettings.size;
    tokenSprite.rotation = token.rotation;
    tokenSprite.scale.set(token.scale);
    tokenSprite.anchor.set(0.5);
    tokenSprite.interactive = true;
    tokenSprite.cursor = "pointer";

    // Add token label
    const label = new Text({
      text: token.name,
      style: {
        fontSize: 12,
        fill: 0xffffff,
        stroke: { color: 0x000000, width: 2 },
      },
    });
    label.anchor.set(0.5);
    label.y = tokenSprite.height / 2 + 10;
    tokenSprite.addChild(label);

    // Add drag functionality for GM
    if (isGM) {
      let dragData: any = null;

      tokenSprite.on("pointerdown", (event) => {
        dragData = {
          tokenId: token.id,
          offset: {
            x: event.global.x - tokenSprite.x,
            y: event.global.y - tokenSprite.y,
          },
        };
        setIsDragging(token.id);
        tokenSprite.alpha = 0.8;
      });

      tokenSprite.on("pointermove", (event) => {
        if (dragData && isDragging === token.id) {
          const viewport = viewportRef.current;
          if (viewport) {
            const localPos = viewport.toLocal(event.global);
            tokenSprite.x = localPos.x - dragData.offset.x;
            tokenSprite.y = localPos.y - dragData.offset.y;
          }
        }
      });

      tokenSprite.on("pointerup", () => {
        if (dragData && isDragging === token.id) {
          // Snap to grid
          const gridSize = scene.gridSettings.size;
          const snappedX = Math.round(tokenSprite.x / gridSize) * gridSize;
          const snappedY = Math.round(tokenSprite.y / gridSize) * gridSize;

          tokenSprite.x = snappedX;
          tokenSprite.y = snappedY;
          tokenSprite.alpha = 1;

          // Emit move event to server
          socket.emit("move_token", {
            id: token.id,
            x: snappedX,
            y: snappedY,
            rotation: tokenSprite.rotation,
            scale: tokenSprite.scale.x,
          });

          setIsDragging(null);
          dragData = null;
        }
      });

      tokenSprite.on("pointerupoutside", () => {
        if (dragData && isDragging === token.id) {
          tokenSprite.alpha = 1;
          setIsDragging(null);
          dragData = null;
        }
      });
    }

    tokensContainerRef.current.addChild(tokenSprite);
    setTokens((prev) => new Map(prev).set(token.id, tokenSprite));
  };

  const _removeToken = (_tokenId: string) => {
    const tokenSprite = tokens.get(token.id);
    if (tokenSprite && tokensContainerRef.current) {
      tokensContainerRef.current.removeChild(tokenSprite);
      tokenSprite.destroy();
      setTokens((prev) => {
        const newMap = new Map(prev);
        newMap.delete(token.id);
        return newMap;
      });
    }
  };

  return (
    <div
      ref={canvasRef}
      style={{
        width: canvasWidth,
        height: canvasHeight,
        border: "1px solid #333",
        borderRadius: "8px",
        overflow: "hidden",
      }}
    />
  );
};

export default SceneCanvas;
