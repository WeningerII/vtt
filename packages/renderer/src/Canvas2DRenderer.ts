import type { MouseEvent } from "react";
/**
 * Core 2D Canvas renderer for the VTT with grid system and token rendering
 */

export interface GridConfig {
  cellSize: number;
  offsetX: number;
  offsetY: number;
  color: string;
  lineWidth: number;
  type: "square" | "hex";
}

export interface Token {
  id: string;
  x: number;
  y: number;
  size: number; // grid cells (1 = medium, 2 = large, etc.)
  sprite: string; // image URL or sprite ID
  rotation: number;
  tint: { r: number; g: number; b: number; a: number };
  selected: boolean;
  health?: { current: number; max: number };
  conditions: string[];
}

export interface MapLayer {
  id: string;
  name: string;
  visible: boolean;
  opacity: number;
  image?: HTMLImageElement;
  tiles?: Array<{ x: number; y: number; sprite: string }>;
}

export interface ViewPort {
  x: number;
  y: number;
  zoom: number;
  width: number;
  height: number;
}

export class Canvas2DRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private viewport: ViewPort;
  private gridConfig: GridConfig;
  private layers: MapLayer[] = [];
  private tokens: Map<string, Token> = new Map();
  private spriteCache: Map<string, HTMLImageElement> = new Map();
  private animationFrame: number | null = null;
  private dirty = true;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not get 2D context");
    this.ctx = ctx;

    this.viewport = {
      x: 0,
      y: 0,
      zoom: 1,
      width: canvas.width,
      height: canvas.height,
    };

    this.gridConfig = {
      cellSize: 70,
      offsetX: 0,
      offsetY: 0,
      color: "#333333",
      lineWidth: 1,
      type: "square",
    };

    this.setupEventHandlers();
    this.startRenderLoop();
  }

  private setupEventHandlers(): void {
    // Handle canvas resize
    const resizeObserver = new ResizeObserver(() => {
      this.handleResize();
    });
    resizeObserver.observe(this.canvas);

    // Mouse events for panning and zooming
    this.canvas.addEventListener("wheel", this.handleWheel.bind(this));
    this.canvas.addEventListener("mousedown", this.handleMouseDown.bind(this));
    this.canvas.addEventListener("mousemove", this.handleMouseMove.bind(this));
    this.canvas.addEventListener("mouseup", this.handleMouseUp.bind(this));
  }

  private handleResize(): void {
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width * devicePixelRatio;
    this.canvas.height = rect.height * devicePixelRatio;
    this.ctx.scale(devicePixelRatio, devicePixelRatio);
    this.viewport.width = rect.width;
    this.viewport.height = rect.height;
    this.markDirty();
  }

  private isDragging = false;
  private lastMousePos = { x: 0, y: 0 };

  private handleWheel(e: WheelEvent): void {
    e.preventDefault();
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.1, Math.min(5, this.viewport.zoom * zoomFactor));

    // Zoom towards mouse position
    const rect = this.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const worldX = this.screenToWorldX(mouseX);
    const worldY = this.screenToWorldY(mouseY);

    this.viewport.zoom = newZoom;

    // Adjust viewport to keep mouse position stable
    this.viewport.x = worldX - mouseX / this.viewport.zoom;
    this.viewport.y = worldY - mouseY / this.viewport.zoom;

    this.markDirty();
  }

  private handleMouseDown(e: MouseEvent): void {
    this.isDragging = true;
    this.lastMousePos = { x: e.clientX, y: e.clientY };
    this.canvas.style.cursor = "grabbing";
  }

  private handleMouseMove(e: MouseEvent): void {
    if (this.isDragging) {
      const deltaX = e.clientX - this.lastMousePos.x;
      const deltaY = e.clientY - this.lastMousePos.y;

      this.viewport.x -= deltaX / this.viewport.zoom;
      this.viewport.y -= deltaY / this.viewport.zoom;

      this.lastMousePos = { x: e.clientX, y: e.clientY };
      this.markDirty();
    }
  }

  private handleMouseUp(): void {
    this.isDragging = false;
    this.canvas.style.cursor = "grab";
  }

  private startRenderLoop(): void {
    const render = () => {
      if (this.dirty) {
        this.render();
        this.dirty = false;
      }
      this.animationFrame = requestAnimationFrame(render);
    };
    render();
  }

  public markDirty(): void {
    this.dirty = true;
  }

  private render(): void {
    this.ctx.save();

    // Clear canvas
    this.ctx.fillStyle = "#1a1a1a";
    this.ctx.fillRect(0, 0, this.viewport.width, this.viewport.height);

    // Apply viewport transformation
    this.ctx.scale(this.viewport.zoom, this.viewport.zoom);
    this.ctx.translate(-this.viewport.x, -this.viewport.y);

    // Render layers
    this.renderLayers();

    // Render grid
    this.renderGrid();

    // Render tokens
    this.renderTokens();

    this.ctx.restore();
  }

  private renderLayers(): void {
    for (const layer of this.layers) {
      if (!layer.visible) continue;

      this.ctx.save();
      this.ctx.globalAlpha = layer.opacity;

      if (layer.image) {
        this.ctx.drawImage(layer.image, 0, 0);
      }

      if (layer.tiles) {
        for (const tile of layer.tiles) {
          const sprite = this.spriteCache.get(tile.sprite);
          if (sprite) {
            const x = tile.x * this.gridConfig.cellSize;
            const y = tile.y * this.gridConfig.cellSize;
            this.ctx.drawImage(sprite, x, y, this.gridConfig.cellSize, this.gridConfig.cellSize);
          }
        }
      }

      this.ctx.restore();
    }
  }

  private renderGrid(): void {
    const { cellSize, offsetX, offsetY, color, lineWidth, type } = this.gridConfig;

    this.ctx.save();
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = lineWidth / this.viewport.zoom;
    this.ctx.beginPath();

    if (type === "square") {
      this.renderSquareGrid(cellSize, offsetX, offsetY);
    } else {
      this.renderHexGrid(cellSize, offsetX, offsetY);
    }

    this.ctx.stroke();
    this.ctx.restore();
  }

  private renderSquareGrid(cellSize: number, offsetX: number, offsetY: number): void {
    const startX = Math.floor((this.viewport.x - offsetX) / cellSize) * cellSize + offsetX;
    const startY = Math.floor((this.viewport.y - offsetY) / cellSize) * cellSize + offsetY;
    const endX = this.viewport.x + this.viewport.width / this.viewport.zoom;
    const endY = this.viewport.y + this.viewport.height / this.viewport.zoom;

    // Vertical lines
    for (let x = startX; x <= endX + cellSize; x += cellSize) {
      this.ctx.moveTo(x, this.viewport.y);
      this.ctx.lineTo(x, endY);
    }

    // Horizontal lines
    for (let y = startY; y <= endY + cellSize; y += cellSize) {
      this.ctx.moveTo(this.viewport.x, y);
      this.ctx.lineTo(endX, y);
    }
  }

  private renderHexGrid(cellSize: number, offsetX: number, offsetY: number): void {
    const hexWidth = cellSize;
    const hexHeight = (cellSize * Math.sqrt(3)) / 2;
    const hexHorizontalSpacing = (hexWidth * 3) / 4;
    const hexVerticalSpacing = hexHeight;

    const startCol = Math.floor((this.viewport.x - offsetX) / hexHorizontalSpacing) - 1;
    const endCol =
      Math.ceil(
        (this.viewport.x + this.viewport.width / this.viewport.zoom - offsetX) /
          hexHorizontalSpacing,
      ) + 1;
    const startRow = Math.floor((this.viewport.y - offsetY) / hexVerticalSpacing) - 1;
    const endRow =
      Math.ceil(
        (this.viewport.y + this.viewport.height / this.viewport.zoom - offsetY) /
          hexVerticalSpacing,
      ) + 1;

    for (let col = startCol; col <= endCol; col++) {
      for (let row = startRow; row <= endRow; row++) {
        const x = offsetX + col * hexHorizontalSpacing;
        const y = offsetY + row * hexVerticalSpacing + ((col % 2) * hexVerticalSpacing) / 2;
        this.drawHexagon(x, y, hexWidth / 2);
      }
    }
  }

  private drawHexagon(centerX: number, centerY: number, radius: number): void {
    this.ctx.moveTo(centerX + radius, centerY);
    for (let i = 1; i < 6; i++) {
      const angle = (i * Math.PI) / 3;
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);
      this.ctx.lineTo(x, y);
    }
    this.ctx.closePath();
  }

  private renderTokens(): void {
    // Sort tokens by z-index (selected tokens on top)
    const sortedTokens = Array.from(this.tokens.values()).sort((a, b) => {
      if (a.selected && !b.selected) return 1;
      if (!a.selected && b.selected) return -1;
      return 0;
    });

    for (const token of sortedTokens) {
      this.renderToken(token);
    }
  }

  private renderToken(token: Token): void {
    const { cellSize } = this.gridConfig;
    const tokenSize = cellSize * token.size;
    const x = token.x * cellSize;
    const y = token.y * cellSize;

    this.ctx.save();

    // Apply token transformation
    this.ctx.translate(x + tokenSize / 2, y + tokenSize / 2);
    this.ctx.rotate(token.rotation);
    this.ctx.translate(-tokenSize / 2, -tokenSize / 2);

    // Apply tint
    this.ctx.globalAlpha = token.tint.a;
    if (token.tint.r !== 1 || token.tint.g !== 1 || token.tint.b !== 1) {
      this.ctx.filter = `hue-rotate(${(Math.atan2(token.tint.g - token.tint.r, token.tint.b - token.tint.r) * 180) / Math.PI}deg)`;
    }

    // Render sprite
    const sprite = this.spriteCache.get(token.sprite);
    if (sprite) {
      this.ctx.drawImage(sprite, 0, 0, tokenSize, tokenSize);
    } else {
      // Fallback: colored circle
      this.ctx.fillStyle = `rgb(${token.tint.r * 255}, ${token.tint.g * 255}, ${token.tint.b * 255})`;
      this.ctx.beginPath();
      this.ctx.arc(tokenSize / 2, tokenSize / 2, tokenSize / 2 - 2, 0, Math.PI * 2);
      this.ctx.fill();
    }

    this.ctx.restore();

    // Render selection highlight
    if (token.selected) {
      this.ctx.save();
      this.ctx.strokeStyle = "#00ff00";
      this.ctx.lineWidth = 3 / this.viewport.zoom;
      this.ctx.strokeRect(x - 2, y - 2, tokenSize + 4, tokenSize + 4);
      this.ctx.restore();
    }

    // Render health bar
    if (token.health) {
      this.renderHealthBar(token, x, y, tokenSize);
    }

    // Render condition indicators
    if (token.conditions.length > 0) {
      this.renderConditions(token, x, y, tokenSize);
    }
  }

  private renderHealthBar(token: Token, x: number, y: number, size: number): void {
    if (!token.health) return;

    const barWidth = size;
    const barHeight = 6;
    const barY = y - barHeight - 4;
    const healthPercent = token.health.current / token.health.max;

    this.ctx.save();

    // Background
    this.ctx.fillStyle = "#333333";
    this.ctx.fillRect(x, barY, barWidth, barHeight);

    // Health bar
    const healthColor =
      healthPercent > 0.6 ? "#00ff00" : healthPercent > 0.3 ? "#ffff00" : "#ff0000";
    this.ctx.fillStyle = healthColor;
    this.ctx.fillRect(x, barY, barWidth * healthPercent, barHeight);

    // Border
    this.ctx.strokeStyle = "#ffffff";
    this.ctx.lineWidth = 1 / this.viewport.zoom;
    this.ctx.strokeRect(x, barY, barWidth, barHeight);

    this.ctx.restore();
  }

  private renderConditions(token: Token, x: number, y: number, size: number): void {
    const iconSize = 16;
    const spacing = 2;
    const startX = x + size - token.conditions.length * (iconSize + spacing);

    for (let i = 0; i < token.conditions.length; i++) {
      const iconX = startX + i * (iconSize + spacing);
      const iconY = y - iconSize - 4;

      this.ctx.save();
      this.ctx.fillStyle = this.getConditionColor(token.conditions[i]!);
      this.ctx.fillRect(iconX, iconY, iconSize, iconSize);
      this.ctx.strokeStyle = "#ffffff";
      this.ctx.lineWidth = 1 / this.viewport.zoom;
      this.ctx.strokeRect(iconX, iconY, iconSize, iconSize);
      this.ctx.restore();
    }
  }

  private getConditionColor(condition: string): string {
    const colors: Record<string, string> = {
      poisoned: "#8b5cf6",
      stunned: "#fbbf24",
      paralyzed: "#ef4444",
      charmed: "#ec4899",
      frightened: "#6b7280",
      restrained: "#f97316",
    };
    return colors[condition] || "#64748b";
  }

  // Coordinate conversion methods
  public screenToWorldX(screenX: number): number {
    return this.viewport.x + screenX / this.viewport.zoom;
  }

  public screenToWorldY(screenY: number): number {
    return this.viewport.y + screenY / this.viewport.zoom;
  }

  public worldToScreenX(worldX: number): number {
    return (worldX - this.viewport.x) * this.viewport.zoom;
  }

  public worldToScreenY(worldY: number): number {
    return (worldY - this.viewport.y) * this.viewport.zoom;
  }

  public screenToGrid(screenX: number, screenY: number): { x: number; y: number } {
    const worldX = this.screenToWorldX(screenX);
    const worldY = this.screenToWorldY(screenY);
    return this.worldToGrid(worldX, worldY);
  }

  public worldToGrid(worldX: number, worldY: number): { x: number; y: number } {
    const { cellSize, offsetX, offsetY, type } = this.gridConfig;

    if (type === "square") {
      return {
        x: Math.floor((worldX - offsetX) / cellSize),
        y: Math.floor((worldY - offsetY) / cellSize),
      };
    } else {
      // Hex grid conversion (simplified)
      const hexWidth = cellSize;
      const hexHeight = (cellSize * Math.sqrt(3)) / 2;
      const hexHorizontalSpacing = (hexWidth * 3) / 4;
      const hexVerticalSpacing = hexHeight;

      const col = Math.round((worldX - offsetX) / hexHorizontalSpacing);
      const row = Math.round(
        (worldY - offsetY - ((col % 2) * hexVerticalSpacing) / 2) / hexVerticalSpacing,
      );

      return { x: col, y: row };
    }
  }

  public gridToWorld(gridX: number, gridY: number): { x: number; y: number } {
    const { cellSize, offsetX, offsetY, type } = this.gridConfig;

    if (type === "square") {
      return {
        x: gridX * cellSize + offsetX,
        y: gridY * cellSize + offsetY,
      };
    } else {
      const hexWidth = cellSize;
      const hexHeight = (cellSize * Math.sqrt(3)) / 2;
      const hexHorizontalSpacing = (hexWidth * 3) / 4;
      const hexVerticalSpacing = hexHeight;

      return {
        x: gridX * hexHorizontalSpacing + offsetX,
        y: gridY * hexVerticalSpacing + ((gridX % 2) * hexVerticalSpacing) / 2 + offsetY,
      };
    }
  }

  // Public API methods
  public setGridConfig(config: Partial<GridConfig>): void {
    this.gridConfig = { ...this.gridConfig, ...config };
    this.markDirty();
  }

  public addLayer(layer: MapLayer): void {
    this.layers.push(layer);
    this.markDirty();
  }

  public removeLayer(layerId: string): void {
    this.layers = this.layers.filter((layer) => layer.id !== layerId);
    this.markDirty();
  }

  public updateLayer(layerId: string, updates: Partial<MapLayer>): void {
    const layer = this.layers.find((l) => l.id === layerId);
    if (layer) {
      Object.assign(layer, updates);
      this.markDirty();
    }
  }

  public addToken(token: Token): void {
    this.tokens.set(token.id, token);
    this.markDirty();
  }

  public removeToken(tokenId: string): void {
    this.tokens.delete(tokenId);
    this.markDirty();
  }

  public updateToken(tokenId: string, updates: Partial<Token>): void {
    const token = this.tokens.get(tokenId);
    if (token) {
      Object.assign(token, updates);
      this.markDirty();
    }
  }

  public getToken(tokenId: string): Token | undefined {
    return this.tokens.get(tokenId);
  }

  public getTokenAt(gridX: number, gridY: number): Token | undefined {
    for (const token of this.tokens.values()) {
      const tokenEndX = token.x + token.size;
      const tokenEndY = token.y + token.size;

      if (gridX >= token.x && gridX < tokenEndX && gridY >= token.y && gridY < tokenEndY) {
        return token;
      }
    }
    return undefined;
  }

  public async loadSprite(id: string, url: string): Promise<void> {
    return new Promise((_resolve, __reject) => {
      const img = new Image();
      img.onload = () => {
        this.spriteCache.set(id, img);
        this.markDirty();
        resolve();
      };
      img.onerror = reject;
      img.src = url;
    });
  }

  public setViewport(viewport: Partial<ViewPort>): void {
    this.viewport = { ...this.viewport, ...viewport };
    this.markDirty();
  }

  public centerOnGrid(gridX: number, gridY: number): void {
    const world = this.gridToWorld(gridX, gridY);
    this.viewport.x = world.x - this.viewport.width / (2 * this.viewport.zoom);
    this.viewport.y = world.y - this.viewport.height / (2 * this.viewport.zoom);
    this.markDirty();
  }

  public destroy(): void {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }
  }
}
