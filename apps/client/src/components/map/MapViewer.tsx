/**
 * Interactive Map Viewer for VTT sessions
 * Handles grid rendering, token placement, and real-time collaboration
 */
import React, { useRef, useEffect, useState, useCallback } from "react";
import { logger } from "@vtt/logging";
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Move,
  Square,
  Circle,
  MousePointer,
  Grid3X3,
  Lightbulb,
  Eye,
  Ruler,
  Settings,
  Users,
} from "lucide-react";
import { Button } from "../ui/Button";
import { cn } from "../../lib/utils";
import { useAuth } from "../../providers/AuthProvider";
import { useWebSocket } from "../../providers/WebSocketProvider";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/Card";

interface MapViewerProps {
  sceneId: string;
  campaignId: string;
  isGM: boolean;
  onTokenSelect?: (_tokenId: string) => void;
  onTokenMove?: (_tokenId: string, x: number, _y: number) => void;
}

interface Token {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  scale: number;
  disposition: "FRIENDLY" | "NEUTRAL" | "HOSTILE" | "UNKNOWN";
  isVisible: boolean;
  isLocked: boolean;
  layer: number;
  actorId?: string;
  assetId?: string;
}

interface SpellEffect {
  id: string;
  type:
    | "spell_cast"
    | "area_effect"
    | "spell_impact"
    | "projectile_hit"
    | "spell_effect_expired"
    | "projectile";
  position: { x: number; y: number };
  spell?: string;
  school?: string;
  duration: number;
  animation: "pulse" | "expand" | "flash" | "projectile" | "beam";
  color: string;
  opacity?: number;
  area?: {
    type: "sphere" | "cube" | "cylinder" | "line" | "cone";
    size: number;
  };
  targetId?: string;
  startTime: number;
  // Projectile-specific properties
  targetPosition?: { x: number; y: number };
  speed?: number;
  trail?: boolean;
}

interface SpellProjectile {
  id: string;
  spell: string;
  startPosition: { x: number; y: number };
  targetPosition: { x: number; y: number };
  currentPosition: { x: number; y: number };
  speed: number;
  color: string;
  size: number;
  trail: { x: number; y: number }[];
  startTime: number;
  duration: number;
  active: boolean;
}

interface SpellTemplate {
  id: string;
  spell: string;
  area: {
    type: "sphere" | "cube" | "cylinder" | "line" | "cone";
    size: number;
  };
  position: { x: number; y: number };
  color: string;
  opacity: number;
}

interface GridSettings {
  type: "square" | "hex" | "none";
  size: number;
  offsetX: number;
  offsetY: number;
  visible: boolean;
  color: string;
  opacity: number;
}

interface MapScene {
  id: string;
  name: string;
  width: number;
  height: number;
  campaignId: string;
  mapId: string | null;
  grid: GridSettings;
  tokens?: Token[];
  map?: {
    id: string;
    name: string;
    widthPx: number;
    heightPx: number;
    assets: Array<{
      uri: string;
      mimeType: string;
      width: number;
      height: number;
    }>;
  } | null;
}

type Tool = "select" | "move" | "measure" | "draw" | "fog";

export const MapViewer: React.FC<MapViewerProps> = ({
  sceneId,
  campaignId,
  isGM,
  onTokenSelect,
  onTokenMove,
}) => {
  const { user } = useAuth();
  const wsUrl = `ws://localhost:8080/campaigns/${campaignId}/scenes/${sceneId}`;

  // WebSocket integration for real-time collaboration
  const { isConnected, send, subscribe } = useWebSocket();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [scene, setScene] = useState<MapScene | null>(null);
  const [selectedTool, setSelectedTool] = useState<Tool>("select");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [selectedToken, setSelectedToken] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isGridVisible, setIsGridVisible] = useState(true);
  const [mapImage, setMapImage] = useState<HTMLImageElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [spellEffects, setSpellEffects] = useState<SpellEffect[]>([]);
  const [spellProjectiles, setSpellProjectiles] = useState<SpellProjectile[]>([]);
  const [spellTemplate, setSpellTemplate] = useState<SpellTemplate | null>(null);
  const [castingMode, setCastingMode] = useState<{
    active: boolean;
    spell?: any;
    step: "select_spell" | "target" | "position";
  }>({ active: false, step: "select_spell" });

  // Load scene data
  useEffect(() => {
    const loadScene = async () => {
      try {
        const response = await fetch(`/api/maps/scenes/${sceneId}`);
        if (response.ok) {
          const data = await response.json();
          setScene(data.scene);
        }
      } catch (error) {
        logger.error("Failed to load scene:", error);
      } finally {
        setLoading(false);
      }
    };

    loadScene();
  }, [sceneId]);

  // Load map image when scene changes
  useEffect(() => {
    if (scene?.map?.assets?.[0]?.uri) {
      const img = new Image();
      img.onload = () => {
        setMapImage(img);
      };
      img.onerror = () => {
        logger.error("Failed to load map image");
        setMapImage(null);
      };
      img.src = scene.map.assets[0].uri;
    } else {
      setMapImage(null);
    }
  }, [scene?.map]);

  // Handle WebSocket messages for real-time collaboration
  const sendTokenAdd = (token: Token) => {
    send({
      type: "TOKEN_ADD",
      payload: {
        token,
        sceneId,
      },
      timestamp: Date.now(),
    });
  };

  const sendTokenMove = (tokenId: string, x: number, y: number) => {
    send({
      type: "TOKEN_MOVE",
      payload: {
        tokenId,
        x,
        y,
        sceneId,
      },
      timestamp: Date.now(),
    });
  };

  const handleRemoteTokenMove = (payload: any) => {
    const { tokenId, x, y } = payload;
    setScene((prevScene) => {
      if (!prevScene || !prevScene.tokens) {return prevScene;}
      const updatedTokens = prevScene.tokens.map((token) =>
        token.id === tokenId ? { ...token, x, y } : token,
      );
      return { ...prevScene, tokens: updatedTokens };
    });
  };

  const handleRemoteTokenAdd = (payload: any) => {
    const { token } = payload;
    setScene((prevScene) => {
      if (!prevScene) {return prevScene;}
      const currentTokens = prevScene.tokens || [];
      return { ...prevScene, tokens: [...currentTokens, token] };
    });
  };

  const handleRemoteTokenRemove = (payload: any) => {
    const { tokenId } = payload;
    setScene((prevScene) => {
      if (!prevScene || !prevScene.tokens) {return prevScene;}
      const updatedTokens = prevScene.tokens.filter((token) => token.id !== tokenId);
      return { ...prevScene, tokens: updatedTokens };
    });
  };

  const handleSceneUpdate = (payload: any) => {
    const { updates } = payload;
    setScene((prevScene) => {
      if (!prevScene) {return prevScene;}
      return { ...prevScene, ...updates };
    });
  };

  useEffect(() => {
    const unsubscribeTokenMove = subscribe("token_move", (payload) => {
      handleRemoteTokenMove(payload);
    });

    const unsubscribeTokenAdd = subscribe("token_add", (payload) => {
      handleRemoteTokenAdd(payload);
    });

    const unsubscribeTokenRemove = subscribe("token_remove", (payload) => {
      handleRemoteTokenRemove(payload);
    });

    const unsubscribeSceneUpdate = subscribe("scene_update", (payload) => {
      handleSceneUpdate(payload);
    });

    return () => {
      unsubscribeTokenMove();
      unsubscribeTokenAdd();
      unsubscribeTokenRemove();
      unsubscribeSceneUpdate();
    };
  }, [subscribe]);

  // Convert screen coordinates to world coordinates
  const screenToWorld = useCallback(
    (screenX: number, screenY: number) => {
      if (!containerRef.current) {return { x: 0, y: 0 };}

      const rect = containerRef.current.getBoundingClientRect();
      const x = (screenX - rect.left - pan.x) / zoom;
      const y = (screenY - rect.top - pan.y) / zoom;

      return { x, y };
    },
    [zoom, pan],
  );

  // Convert world coordinates to grid coordinates
  const worldToGrid = useCallback(
    (worldX: number, worldY: number) => {
      if (!scene) {return { gridX: 0, gridY: 0 };}

      const { grid } = scene;
      const adjustedX = worldX - grid.offsetX;
      const adjustedY = worldY - grid.offsetY;

      return {
        gridX: Math.floor(adjustedX / grid.size),
        gridY: Math.floor(adjustedY / grid.size),
      };
    },
    [scene],
  );

  // Snap coordinates to grid
  const snapToGrid = useCallback(
    (worldX: number, worldY: number) => {
      if (!scene || scene.grid.type === "none") {return { x: worldX, y: worldY };}

      const { gridX, gridY } = worldToGrid(worldX, worldY);
      const { grid } = scene;

      return {
        x: gridX * grid.size + grid.offsetX + grid.size / 2,
        y: gridY * grid.size + grid.offsetY + grid.size / 2,
      };
    },
    [scene, worldToGrid],
  );

  // Render grid
  const renderGrid = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      if (!scene || !isGridVisible || scene.grid.type === "none") {return;}

      const { grid, width, height } = scene;

      ctx.save();
      ctx.strokeStyle = grid.color;
      ctx.globalAlpha = grid.opacity;
      ctx.lineWidth = 1 / zoom;

      // Draw vertical lines
      for (let x = grid.offsetX; x < width; x += grid.size) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      // Draw horizontal lines
      for (let y = grid.offsetY; y < height; y += grid.size) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      ctx.restore();
    },
    [scene, isGridVisible, zoom],
  );

  // Render tokens
  const renderTokens = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      if (!scene?.tokens) {return;}

      scene.tokens.forEach((token) => {
        if (!token.isVisible && !isGM) {return;}

        ctx.save();

        // Token appearance based on disposition
        const colors = {
          FRIENDLY: "#22c55e",
          NEUTRAL: "#6b7280",
          HOSTILE: "#ef4444",
          UNKNOWN: "#8b5cf6",
        };

        const size = scene.grid.size * token.scale;
        const _x = token.x - size / 2;
        const _y = token.y - size / 2;

        // Token background
        ctx.fillStyle = colors[token.disposition];
        ctx.globalAlpha = token.isVisible ? 1 : 0.5;

        if (scene.grid.type === "hex") {
          // Draw hexagon
          ctx.beginPath();
          for (let i = 0; i < 6; i++) {
            const angle = (i * Math.PI) / 3;
            const px = token.x + (size / 2) * Math.cos(angle);
            const py = token.y + (size / 2) * Math.sin(angle);
            if (i === 0) {ctx.moveTo(px, py);}
            else {ctx.lineTo(px, py);}
          }
          ctx.closePath();
          ctx.fill();
        } else {
          // Draw circle
          ctx.beginPath();
          ctx.arc(token.x, token.y, size / 2, 0, 2 * Math.PI);
          ctx.fill();
        }

        // Token border if selected
        if (selectedToken === token.id) {
          ctx.strokeStyle = "#3b82f6";
          ctx.lineWidth = 3 / zoom;
          ctx.stroke();
        }

        // Token name
        if (isGM || token.isVisible) {
          ctx.fillStyle = "#ffffff";
          ctx.font = `${12 / zoom}px sans-serif`;
          ctx.textAlign = "center";
          ctx.fillText(token.name, token.x, token.y + size / 2 + 15 / zoom);
        }

        ctx.restore();
      });
    },
    [scene, selectedToken, isGM, zoom],
  );

  // Render spell effects
  const renderSpellEffects = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      const now = Date.now();

      spellEffects.forEach((effect) => {
        const elapsed = now - effect.startTime;
        if (elapsed > effect.duration) {return;} // Effect expired

        const progress = elapsed / effect.duration;
        const alpha = effect.opacity || 1 - progress; // Fade out over time

        ctx.save();
        ctx.globalAlpha = alpha;

        switch (effect.type) {
          case "spell_cast":
            {
              // Pulsing circle at caster position
              const pulseRadius = 20 + Math.sin(elapsed / 100) * 5;
              ctx.strokeStyle = effect.color;
              ctx.lineWidth = 3;
              ctx.setLineDash([5, 5]);
              ctx.beginPath();
              ctx.arc(effect.position.x, effect.position.y, pulseRadius, 0, 2 * Math.PI);
              ctx.stroke();
              ctx.setLineDash([]);
            }
            break;

          case "area_effect":
            // Expanding area effect
            if (effect.area) {
              const size = effect.area.size * progress;
              ctx.fillStyle = effect.color;
              ctx.globalAlpha = alpha * 0.3;

              switch (effect.area.type) {
                case "sphere":
                case "cylinder":
                  ctx.beginPath();
                  ctx.arc(effect.position.x, effect.position.y, size, 0, 2 * Math.PI);
                  ctx.fill();
                  break;
                case "cube":
                  ctx.fillRect(
                    effect.position.x - size / 2,
                    effect.position.y - size / 2,
                    size,
                    size,
                  );
                  break;
                case "cone":
                  // Draw cone shape
                  ctx.beginPath();
                  ctx.moveTo(effect.position.x, effect.position.y);
                  ctx.arc(effect.position.x, effect.position.y, size, -Math.PI / 6, Math.PI / 6);
                  ctx.closePath();
                  ctx.fill();
                  break;
                case "line":
                  // Draw line
                  ctx.fillRect(effect.position.x, effect.position.y - 2.5, size, 5);
                  break;
              }

              // Add border
              ctx.globalAlpha = alpha;
              ctx.strokeStyle = effect.color;
              ctx.lineWidth = 2;
              ctx.stroke();
            }
            break;

          case "spell_impact":
            {
              // Flash effect at target
              const flashIntensity = Math.max(0, 1 - progress * 2);
              ctx.fillStyle = effect.color;
              ctx.globalAlpha = flashIntensity;
              ctx.beginPath();
              ctx.arc(effect.position.x, effect.position.y, 15, 0, 2 * Math.PI);
              ctx.fill();

              // Add sparks
              for (let i = 0; i < 8; i++) {
                const angle = (i / 8) * Math.PI * 2;
                const sparkDistance = 20 * progress;
                const sparkX = effect.position.x + Math.cos(angle) * sparkDistance;
                const sparkY = effect.position.y + Math.sin(angle) * sparkDistance;

                ctx.fillStyle = effect.color;
                ctx.globalAlpha = flashIntensity * 0.7;
                ctx.beginPath();
                ctx.arc(sparkX, sparkY, 2, 0, 2 * Math.PI);
                ctx.fill();
              }
            }
            break;

          case "projectile":
            // Moving projectile effect
            if (effect.targetPosition) {
              const totalDistance = Math.sqrt(
                Math.pow(effect.targetPosition.x - effect.position.x, 2) +
                  Math.pow(effect.targetPosition.y - effect.position.y, 2),
              );
              const currentDistance = totalDistance * progress;
              const angle = Math.atan2(
                effect.targetPosition.y - effect.position.y,
                effect.targetPosition.x - effect.position.x,
              );

              const currentX = effect.position.x + Math.cos(angle) * currentDistance;
              const currentY = effect.position.y + Math.sin(angle) * currentDistance;

              // Draw projectile
              ctx.fillStyle = effect.color;
              ctx.globalAlpha = alpha;
              ctx.beginPath();
              ctx.arc(currentX, currentY, 6, 0, 2 * Math.PI);
              ctx.fill();

              // Draw trail if enabled
              if (effect.trail) {
                ctx.strokeStyle = effect.color;
                ctx.lineWidth = 3;
                ctx.globalAlpha = alpha * 0.5;
                ctx.beginPath();
                ctx.moveTo(effect.position.x, effect.position.y);
                ctx.lineTo(currentX, currentY);
                ctx.stroke();
              }
            }
            break;
        }

        ctx.restore();
      });

      // Clean up expired effects
      setSpellEffects((prev) => prev.filter((effect) => now - effect.startTime < effect.duration));
    },
    [spellEffects],
  );

  // Render spell projectiles
  const renderSpellProjectiles = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      const now = Date.now();

      spellProjectiles.forEach((projectile) => {
        if (!projectile.active) {return;}

        const elapsed = now - projectile.startTime;
        if (elapsed > projectile.duration) {return;}

        // Calculate current position
        const progress = Math.min(elapsed / projectile.duration, 1);
        const totalDistance = Math.sqrt(
          Math.pow(projectile.targetPosition.x - projectile.startPosition.x, 2) +
            Math.pow(projectile.targetPosition.y - projectile.startPosition.y, 2),
        );

        const angle = Math.atan2(
          projectile.targetPosition.y - projectile.startPosition.y,
          projectile.targetPosition.x - projectile.startPosition.x,
        );

        const currentDistance = totalDistance * progress;
        const currentX = projectile.startPosition.x + Math.cos(angle) * currentDistance;
        const currentY = projectile.startPosition.y + Math.sin(angle) * currentDistance;

        // Update projectile position for trail
        projectile.currentPosition = { x: currentX, y: currentY };
        projectile.trail.push({ x: currentX, y: currentY });

        // Keep trail length manageable
        if (projectile.trail.length > 10) {
          projectile.trail.shift();
        }

        ctx.save();

        // Draw trail
        if (projectile.trail.length > 1) {
          ctx.strokeStyle = projectile.color;
          ctx.lineWidth = projectile.size / 2;
          ctx.globalAlpha = 0.6;
          ctx.beginPath();

          for (let i = 0; i < projectile.trail.length - 1; i++) {
            const trailAlpha = (i / projectile.trail.length) * 0.6;
            ctx.globalAlpha = trailAlpha;

            const point = projectile.trail[i];
            if (point) {
              if (i === 0) {
                ctx.moveTo(point.x, point.y);
              } else {
                ctx.lineTo(point.x, point.y);
              }
            }
          }
          ctx.stroke();
        }

        // Draw projectile body
        ctx.fillStyle = projectile.color;
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.arc(currentX, currentY, projectile.size, 0, 2 * Math.PI);
        ctx.fill();

        // Add glow effect
        ctx.shadowColor = projectile.color;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(currentX, currentY, projectile.size * 0.7, 0, 2 * Math.PI);
        ctx.fill();

        ctx.restore();
      });

      // Clean up inactive projectiles
      setSpellProjectiles((prev) =>
        prev.filter(
          (projectile) => projectile.active && now - projectile.startTime < projectile.duration,
        ),
      );
    },
    [spellProjectiles],
  );

  // Render spell template preview
  const renderSpellTemplate = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      if (!spellTemplate) {return;}

      ctx.save();
      ctx.globalAlpha = spellTemplate.opacity;
      ctx.fillStyle = spellTemplate.color;
      ctx.strokeStyle = spellTemplate.color;
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);

      const size = spellTemplate.area.size;

      switch (spellTemplate.area.type) {
        case "sphere":
        case "cylinder":
          ctx.beginPath();
          ctx.arc(spellTemplate.position.x, spellTemplate.position.y, size, 0, 2 * Math.PI);
          ctx.fill();
          ctx.stroke();
          break;
        case "cube":
          ctx.fillRect(
            spellTemplate.position.x - size / 2,
            spellTemplate.position.y - size / 2,
            size,
            size,
          );
          ctx.strokeRect(
            spellTemplate.position.x - size / 2,
            spellTemplate.position.y - size / 2,
            size,
            size,
          );
          break;
        case "cone":
          ctx.beginPath();
          ctx.moveTo(spellTemplate.position.x, spellTemplate.position.y);
          ctx.arc(
            spellTemplate.position.x,
            spellTemplate.position.y,
            size,
            -Math.PI / 6,
            Math.PI / 6,
          );
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          break;
        case "line":
          ctx.fillRect(spellTemplate.position.x, spellTemplate.position.y - 2.5, size, 5);
          ctx.strokeRect(spellTemplate.position.x, spellTemplate.position.y - 2.5, size, 5);
          break;
      }

      ctx.setLineDash([]);
      ctx.restore();
    },
    [spellTemplate],
  );

  // Main render function
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !scene) {return;}

    const ctx = canvas.getContext("2d");
    if (!ctx) {return;}

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Apply transform
    ctx.save();
    ctx.scale(zoom, zoom);
    ctx.translate(pan.x / zoom, pan.y / zoom);

    // Render background
    if (mapImage && scene.map) {
      // Draw the map image scaled to scene dimensions
      ctx.drawImage(
        mapImage,
        0,
        0,
        scene.map.widthPx,
        scene.map.heightPx,
        0,
        0,
        scene.width,
        scene.height,
      );
    } else {
      // Fallback background
      ctx.fillStyle = "#f3f4f6";
      ctx.fillRect(0, 0, scene.width, scene.height);
    }

    // Render grid
    renderGrid(ctx);

    // Render tokens
    renderTokens(ctx);

    // Render spell template preview
    renderSpellTemplate(ctx);

    // Render spell effects
    renderSpellEffects(ctx);

    // Render spell projectiles
    renderSpellProjectiles(ctx);

    ctx.restore();
  }, [scene, zoom, pan, renderGrid, renderTokens]);

  // Handle canvas resize
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) {return;}

    const resizeCanvas = () => {
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      render();
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    return () => window.removeEventListener("resize", resizeCanvas);
  }, [render]);

  // Render when dependencies change
  useEffect(() => {
    render();
  }, [render]);

  // Handle spell casting
  const handleCastSpell = useCallback(
    async (spell: any, targets?: string[], position?: { x: number; y: number }) => {
      if (!scene || !selectedToken) {return;}

      try {
        const response = await fetch(`/api/maps/scenes/${scene.id}/cast-spell`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            casterId: selectedToken,
            spell,
            targets,
            position,
            spellLevel: spell.level,
          }),
        });

        if (response.ok) {
          const _result = await response.json();
          // Visual effects will be handled via WebSocket
          setCastingMode({ active: false, step: "select_spell" });
          setSpellTemplate(null);
        }
      } catch (error) {
        logger.error("Failed to cast spell:", error);
      }
    },
    [scene, selectedToken],
  );

  // Handle spell template preview
  const handleSpellPreview = useCallback((spell: any, position: { x: number; y: number }) => {
    if (!spell.area) {
      setSpellTemplate(null);
      return;
    }

    const schoolColors: Record<string, string> = {
      abjuration: "#4169E1",
      conjuration: "#FFD700",
      divination: "#E6E6FA",
      enchantment: "#FF69B4",
      evocation: "#FF4500",
      illusion: "#9932CC",
      necromancy: "#2F4F2F",
      transmutation: "#32CD32",
    };

    setSpellTemplate({
      id: `template_${spell.id}`,
      spell: spell.name,
      area: spell.area,
      position,
      color: schoolColors[spell.school] || "#FFFFFF",
      opacity: 0.3,
    });
  }, []);

  // Mouse event handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    const { x, y } = screenToWorld(e.clientX, e.clientY);
    setDragStart({ x: e.clientX, y: e.clientY });
    setIsDragging(true);

    if (selectedTool === "select") {
      // Check for token selection
      const token = scene?.tokens?.find((t) => {
        const distance = Math.sqrt((t.x - x) ** 2 + (t.y - y) ** 2);
        return distance < scene.grid.size / 2;
      });

      if (token) {
        setSelectedToken(token.id);
        onTokenSelect?.(token.id);
      } else {
        setSelectedToken(null);
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const { x, y } = screenToWorld(e.clientX, e.clientY);

    // Handle spell template preview
    if (castingMode.active && castingMode.step === "position" && castingMode.spell) {
      handleSpellPreview(castingMode.spell, { x, y });
    }

    if (!isDragging) {return;}

    if (selectedTool === "move" || (selectedTool === "select" && !selectedToken)) {
      // Pan the map
      const deltaX = e.clientX - dragStart.x;
      const deltaY = e.clientY - dragStart.y;
      setPan((prev) => ({ x: prev.x + deltaX, y: prev.y + deltaY }));
      setDragStart({ x: e.clientX, y: e.clientY });
    } else if (selectedTool === "select" && selectedToken) {
      // Move selected token
      const snapped = snapToGrid(x, y);

      if (scene?.tokens) {
        setScene((prev) => {
          if (!prev) {return prev;}
          return {
            ...prev,
            tokens:
              prev.tokens?.map((t) =>
                t.id === selectedToken ? { ...t, x: snapped.x, y: snapped.y } : t,
              ) || [],
          };
        });
      }
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    const { x, y } = screenToWorld(e.clientX, e.clientY);

    // Handle spell casting
    if (castingMode.active && castingMode.step === "position" && castingMode.spell) {
      handleCastSpell(castingMode.spell, [], { x, y });
      return;
    }

    if (selectedTool === "select" && selectedToken && isDragging) {
      const snapped = snapToGrid(x, y);
      onTokenMove?.(selectedToken, snapped.x, snapped.y);
    }

    setIsDragging(false);
  };

  // Zoom controls
  const handleZoomIn = () => setZoom((prev) => Math.min(prev * 1.2, 5));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev / 1.2, 0.1));

  if (loading) {
    return (
      <Card className="h-full">
        <CardContent className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4"></div>
            <p className="text-neutral-600">Loading map...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!scene) {
    return (
      <Card className="h-full">
        <CardContent className="flex items-center justify-center h-full">
          <div className="text-center">
            <p className="text-neutral-600 mb-4">No scene found</p>
            <Button>Create Scene</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="h-full flex flex-col bg-neutral-100">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-4 bg-white border-b">
        <div className="flex items-center gap-2">
          <h3 className="font-medium">{scene.name}</h3>
          <span className="text-sm text-neutral-500">{scene.tokens?.length || 0} tokens</span>
        </div>

        {/* Tools */}
        <div className="flex items-center gap-2">
          <div className="flex border border-neutral-300 rounded-lg p-1">
            <Button
              variant={selectedTool === "select" ? "primary" : "ghost"}
              size="sm"
              onClick={() => setSelectedTool("select")}
            >
              <MousePointer className="h-4 w-4" />
            </Button>
            <Button
              variant={selectedTool === "move" ? "primary" : "ghost"}
              size="sm"
              onClick={() => setSelectedTool("move")}
            >
              <Move className="h-4 w-4" />
            </Button>
            <Button
              variant={selectedTool === "measure" ? "primary" : "ghost"}
              size="sm"
              onClick={() => setSelectedTool("measure")}
            >
              <Ruler className="h-4 w-4" />
            </Button>
          </div>

          {/* Spell Casting UI */}
          {isGM && (
            <div className="flex items-center gap-2 ml-4 px-3 py-1 bg-purple-100 rounded-lg">
              <Button
                variant={castingMode.active ? "primary" : "ghost"}
                size="sm"
                onClick={() =>
                  setCastingMode((prev) => ({
                    active: !prev.active,
                    step: "select_spell",
                  }))
                }
              >
                <Lightbulb className="h-4 w-4" />
                <span className="ml-1">Cast Spell</span>
              </Button>

              {castingMode.active && (
                <div className="flex items-center gap-2">
                  <select
                    className="text-sm border rounded px-2 py-1"
                    onChange={(e) => {
                      const spellData = JSON.parse(e.target.value || "{}");
                      setCastingMode({
                        active: true,
                        spell: spellData,
                        step: spellData.target === "area" ? "position" : "target",
                      });
                    }}
                  >
                    <option value="">Select Spell...</option>
                    <option
                      value={JSON.stringify({
                        id: "fireball",
                        name: "Fireball",
                        level: 3,
                        school: "evocation",
                        target: "area",
                        area: { type: "sphere", size: 20 },
                      })}
                    >
                      Fireball
                    </option>
                    <option
                      value={JSON.stringify({
                        id: "magic_missile",
                        name: "Magic Missile",
                        level: 1,
                        school: "evocation",
                        target: "single",
                      })}
                    >
                      Magic Missile
                    </option>
                    <option
                      value={JSON.stringify({
                        id: "cone_of_cold",
                        name: "Cone of Cold",
                        level: 5,
                        school: "evocation",
                        target: "area",
                        area: { type: "cone", size: 60 },
                      })}
                    >
                      Cone of Cold
                    </option>
                  </select>

                  {castingMode.spell && castingMode.step === "position" && (
                    <span className="text-sm text-purple-600">
                      Click to place {castingMode.spell.name}
                    </span>
                  )}

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setCastingMode({ active: false, step: "select_spell" });
                      setSpellTemplate(null);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          )}

          <Button
            variant={isGridVisible ? "primary" : "ghost"}
            size="sm"
            onClick={() => setIsGridVisible(!isGridVisible)}
          >
            <Grid3X3 className="h-4 w-4" />
          </Button>

          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={handleZoomOut}>
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-sm min-w-12 text-center">{Math.round(zoom * 100)}%</span>
            <Button variant="ghost" size="sm" onClick={handleZoomIn}>
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>

          {isGM && (
            <Button variant="ghost" size="sm">
              <Settings className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Map Canvas */}
      <div ref={containerRef} className="flex-1 relative overflow-hidden cursor-crosshair">
        <canvas
          ref={canvasRef}
          className="absolute inset-0"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onContextMenu={(e) => e.preventDefault()}
        />
      </div>

      {/* Status Bar */}
      <div className="flex items-center justify-between p-2 bg-white border-t text-sm text-neutral-600">
        <div className="flex items-center gap-4">
          <span>
            Grid: {scene.grid.size}px {scene.grid.type}
          </span>
          <span>
            Size: {scene.width}×{scene.height}
          </span>
          {(spellEffects.length > 0 || spellProjectiles.length > 0) && (
            <span className="text-purple-600">
              {spellEffects.length} effect{spellEffects.length !== 1 ? "s" : ""}
              {spellProjectiles.length > 0 && (
                <>
                  , {spellProjectiles.length} projectile{spellProjectiles.length !== 1 ? "s" : ""}
                </>
              )}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4" />
          <span>Campaign: {campaignId}</span>
        </div>
      </div>
    </div>
  );
};
