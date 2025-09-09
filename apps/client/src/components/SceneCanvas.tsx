import React, { useRef, useEffect, useState } from "react";
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
  onTokenMove: (tokenId: string, x: number, y: number) => void;
  onTokenSelect: (tokenId: string) => void;
  readOnly?: boolean;
  canvasWidth?: number;
  canvasHeight?: number;
}

export const SceneCanvas: React.FC<SceneCanvasProps> = ({
  scene,
  socket,
  onTokenMove,
  onTokenSelect,
  readOnly = false,
  canvasWidth = 800,
  canvasHeight = 600,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tokens, setTokens] = useState<Token[]>(scene.tokens);
  const [isDragging, setIsDragging] = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    // Clear canvas
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    
    // Draw grid
    if (scene.gridSettings.type !== "none") {
      ctx.strokeStyle = "#444";
      ctx.lineWidth = 1;
      
      const gridSize = scene.gridSettings.size || 50;
      for (let x = 0; x < canvasWidth; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvasHeight);
        ctx.stroke();
      }
      for (let y = 0; y < canvasHeight; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvasWidth, y);
        ctx.stroke();
      }
    }

    // Draw tokens
    tokens.forEach(token => {
      ctx.fillStyle = token.color ? `#${token.color.toString(16).padStart(6, '0')}` : "#ff0000";
      ctx.fillRect(token.x, token.y, token.width, token.height);
      
      // Draw token name
      ctx.fillStyle = "#fff";
      ctx.font = "12px Arial";
      ctx.textAlign = "center";
      ctx.fillText(token.name, token.x + token.width / 2, token.y - 5);
    });

    // Socket event listeners
    const handleTokenMove = (data: { tokenId: string; x: number; y: number }) => {
      setTokens(prev => prev.map(token => 
        token.id === data.tokenId 
          ? { ...token, x: data.x, y: data.y }
          : token
      ));
      onTokenMove(data.tokenId, data.x, data.y);
    };

    const handleTokenAdd = (token: Token) => {
      setTokens(prev => [...prev, token]);
    };

    const handleTokenRemove = (tokenId: string) => {
      setTokens(prev => prev.filter(token => token.id !== tokenId));
    };

    socket.on("token:move", handleTokenMove);
    socket.on("token:add", handleTokenAdd);
    socket.on("token:remove", handleTokenRemove);

    return () => {
      socket.off("token:move", handleTokenMove);
      socket.off("token:add", handleTokenAdd);
      socket.off("token:remove", handleTokenRemove);
    };
  }, [scene, tokens, canvasWidth, canvasHeight, socket, onTokenMove]);

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (readOnly || isDragging) {
      return;
    }
    
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Check if clicking on a token
    const clickedToken = tokens.find(token => 
      x >= token.x && 
      x <= token.x + token.width && 
      y >= token.y && 
      y <= token.y + token.height
    );

    if (clickedToken) {
      onTokenSelect(clickedToken.id);
    }
  };

  return (
    <div className="scene-canvas">
      <canvas
        ref={canvasRef}
        width={canvasWidth}
        height={canvasHeight}
        onClick={handleCanvasClick}
        style={{
          border: "1px solid #ccc",
          cursor: isDragging ? "grabbing" : "grab",
        }}
      />
    </div>
  );
};

export default SceneCanvas;
