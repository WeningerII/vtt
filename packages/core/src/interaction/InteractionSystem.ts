import { EventEmitter } from 'events';
import { TokenManager, Token, TokenInteraction } from '../tokens/TokenManager';
import { MapManager } from '../maps/MapManager';
import { logger } from '@vtt/logging';

export interface MouseEvent {
  type: 'mousedown' | 'mousemove' | 'mouseup' | 'click' | 'dblclick' | 'wheel';
  button: number;
  position: { x: number; y: number };
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  deltaY?: number;
}

export interface KeyboardEvent {
  type: 'keydown' | 'keyup';
  key: string;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

export interface SelectionBox {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

export interface InteractionState {
  mode: 'select' | 'pan' | 'measure' | 'draw' | 'erase';
  tool: 'pointer' | 'hand' | 'ruler' | 'brush' | 'eraser';
  isMultiSelect: boolean;
  isDragging: boolean;
  isPanning: boolean;
  isSelecting: boolean;
  selectionBox?: SelectionBox;
  hoveredTokenId?: string;
  dragOffset?: { x: number; y: number };
}

export class InteractionSystem extends EventEmitter {
  private tokenManager: TokenManager;
  private mapManager: MapManager;
  private state: InteractionState = {
    mode: 'select',
    tool: 'pointer',
    isMultiSelect: false,
    isDragging: false,
    isPanning: false,
    isSelecting: false,
  };
  private userId: string;

  constructor(tokenManager: TokenManager, mapManager: MapManager, userId: string) {
    super();
    this.tokenManager = tokenManager;
    this.mapManager = mapManager;
    this.userId = userId;
    this.setMaxListeners(100);
    
    this.setupEventListeners();
  }

  /**
   * Handle mouse events
   */
  handleMouseEvent(event: MouseEvent): void {
    const worldPos = this.mapManager.screenToWorld(event.position.x, event.position.y);
    const snappedPos = this.mapManager.snapToGrid(worldPos);

    switch (event.type) {
      case 'mousedown':
        this.handleMouseDown(event, worldPos, snappedPos);
        break;
      case 'mousemove':
        this.handleMouseMove(event, worldPos, snappedPos);
        break;
      case 'mouseup':
        this.handleMouseUp(event, worldPos, snappedPos);
        break;
      case 'click':
        this.handleClick(event, worldPos, snappedPos);
        break;
      case 'dblclick':
        this.handleDoubleClick(event, worldPos, snappedPos);
        break;
      case 'wheel':
        this.handleWheel(event);
        break;
    }
  }

  /**
   * Handle keyboard events
   */
  handleKeyboardEvent(event: KeyboardEvent): void {
    switch (event.type) {
      case 'keydown':
        this.handleKeyDown(event);
        break;
      case 'keyup':
        this.handleKeyUp(event);
        break;
    }
  }

  /**
   * Set interaction mode
   */
  setMode(mode: InteractionState['mode']): void {
    this.state.mode = mode;
    this.emit('modeChanged', mode);
  }

  /**
   * Set interaction tool
   */
  setTool(tool: InteractionState['tool']): void {
    this.state.tool = tool;
    this.emit('toolChanged', tool);
  }

  /**
   * Get current interaction state
   */
  getState(): InteractionState {
    return { ...this.state };
  }

  private setupEventListeners(): void {
    // Listen to token manager events
    this.tokenManager.on('dragStart', (tokenId, position, userId) => {
      if (userId === this.userId) {
        this.state.isDragging = true;
        this.emit('interactionStateChanged', this.state);
      }
    });

    this.tokenManager.on('dragEnd', (tokenId, position, userId) => {
      if (userId === this.userId) {
        this.state.isDragging = false;
        this.emit('interactionStateChanged', this.state);
      }
    });

    // Listen to map manager events
    this.mapManager.on('viewportChanged', (viewport, userId) => {
      this.emit('viewportUpdated', viewport);
    });
  }

  private handleMouseDown(event: MouseEvent, worldPos: { x: number; y: number }, snappedPos: { x: number; y: number }): void {
    this.state.isMultiSelect = event.ctrlKey || event.shiftKey;

    switch (this.state.mode) {
      case 'select':
        this.handleSelectMouseDown(event, worldPos, snappedPos);
        break;
      case 'pan':
        this.handlePanMouseDown(event, worldPos);
        break;
      case 'measure':
        this.handleMeasureMouseDown(event, snappedPos);
        break;
    }
  }

  private handleMouseMove(event: MouseEvent, worldPos: { x: number; y: number }, snappedPos: { x: number; y: number }): void {
    // Update hovered token
    const hoveredToken = this.findTokenAtPosition(worldPos);
    if (hoveredToken?.id !== this.state.hoveredTokenId) {
      this.state.hoveredTokenId = hoveredToken?.id;
      this.emit('tokenHover', hoveredToken?.id);
    }

    if (this.state.isDragging) {
      this.tokenManager.updateDrag(snappedPos, this.userId);
    } else if (this.state.isPanning) {
      this.mapManager.updatePan(event.position, this.userId);
    } else if (this.state.isSelecting) {
      this.updateSelectionBox(worldPos);
    }
  }

  private handleMouseUp(event: MouseEvent, worldPos: { x: number; y: number }, snappedPos: { x: number; y: number }): void {
    if (this.state.isDragging) {
      this.tokenManager.endDrag(snappedPos, this.userId);
      this.state.isDragging = false;
    } else if (this.state.isPanning) {
      this.mapManager.endPan();
      this.state.isPanning = false;
    } else if (this.state.isSelecting) {
      this.finishSelection();
    }

    this.emit('interactionStateChanged', this.state);
  }

  private handleClick(event: MouseEvent, worldPos: { x: number; y: number }, snappedPos: { x: number; y: number }): void {
    if (this.state.mode === 'select') {
      const clickedToken = this.findTokenAtPosition(worldPos);
      
      if (clickedToken) {
        this.selectToken(clickedToken.id, this.state.isMultiSelect);
      } else if (!this.state.isMultiSelect) {
        this.tokenManager.selectTokens([], this.userId);
      }
    }
  }

  private handleDoubleClick(event: MouseEvent, worldPos: { x: number; y: number }, snappedPos: { x: number; y: number }): void {
    const clickedToken = this.findTokenAtPosition(worldPos);
    if (clickedToken) {
      this.emit('tokenDoubleClick', clickedToken.id);
    }
  }

  private handleWheel(event: MouseEvent): void {
    if (!event.deltaY) return;

    const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
    const currentViewport = this.mapManager.getViewport();
    const newZoom = Math.max(0.1, Math.min(5, currentViewport.zoom * zoomFactor));

    this.mapManager.updateViewport({ zoom: newZoom }, this.userId);
  }

  private handleKeyDown(event: KeyboardEvent): void {
    switch (event.key) {
      case 'Delete':
      case 'Backspace':
        this.deleteSelectedTokens();
        break;
      case 'Escape':
        this.cancelCurrentAction();
        break;
      case 'a':
        if (event.ctrlKey) {
          this.selectAllTokens();
        }
        break;
      case 'c':
        if (event.ctrlKey) {
          this.copySelectedTokens();
        }
        break;
      case 'v':
        if (event.ctrlKey) {
          this.pasteTokens();
        }
        break;
      case ' ':
        this.setTool('hand');
        break;
    }
  }

  private handleKeyUp(event: KeyboardEvent): void {
    if (event.key === ' ') {
      this.setTool('pointer');
    }
  }

  private handleSelectMouseDown(event: MouseEvent, worldPos: { x: number; y: number }, snappedPos: { x: number; y: number }): void {
    const clickedToken = this.findTokenAtPosition(worldPos);

    if (clickedToken) {
      const isSelected = this.tokenManager.getSelectedTokens().includes(clickedToken.id);
      
      if (!isSelected || !this.state.isMultiSelect) {
        this.selectToken(clickedToken.id, this.state.isMultiSelect);
      }

      // Start dragging
      if (this.tokenManager.startDrag(clickedToken.id, snappedPos, this.userId)) {
        this.state.isDragging = true;
        this.calculateDragOffset(clickedToken, worldPos);
      }
    } else {
      // Start selection box
      this.startSelectionBox(worldPos);
    }
  }

  private handlePanMouseDown(event: MouseEvent, worldPos: { x: number; y: number }): void {
    this.mapManager.startPan(event.position);
    this.state.isPanning = true;
  }

  private handleMeasureMouseDown(event: MouseEvent, snappedPos: { x: number; y: number }): void {
    this.emit('measureStart', snappedPos);
  }

  private findTokenAtPosition(position: { x: number; y: number }): Token | null {
    const tokens = this.tokenManager.getVisibleTokens(this.userId);
    
    // Check tokens in reverse order (top to bottom)
    for (let i = tokens.length - 1; i >= 0; i--) {
      const token = tokens[i];
      if (this.isPositionInToken(position, token)) {
        return token;
      }
    }
    
    return null;
  }

  private isPositionInToken(position: { x: number; y: number }, token: Token): boolean {
    const tokenSize = this.getTokenSize(token.size);
    const halfWidth = (tokenSize * token.scale.x) / 2;
    const halfHeight = (tokenSize * token.scale.y) / 2;

    return position.x >= token.position.x - halfWidth &&
           position.x <= token.position.x + halfWidth &&
           position.y >= token.position.y - halfHeight &&
           position.y <= token.position.y + halfHeight;
  }

  private getTokenSize(size: Token['size']): number {
    const sizeMap = {
      tiny: 0.5,
      small: 1,
      medium: 1,
      large: 2,
      huge: 3,
      gargantuan: 4,
    };
    return sizeMap[size] * 30; // 30 pixels per grid unit
  }

  private selectToken(tokenId: string, multiSelect: boolean): void {
    const currentSelection = this.tokenManager.getSelectedTokens();
    
    if (multiSelect) {
      if (currentSelection.includes(tokenId)) {
        // Remove from selection
        const newSelection = currentSelection.filter(id => id !== tokenId);
        this.tokenManager.selectTokens(newSelection, this.userId);
      } else {
        // Add to selection
        this.tokenManager.selectTokens([...currentSelection, tokenId], this.userId);
      }
    } else {
      this.tokenManager.selectTokens([tokenId], this.userId);
    }
  }

  private calculateDragOffset(token: Token, mousePos: { x: number; y: number }): void {
    this.state.dragOffset = {
      x: mousePos.x - token.position.x,
      y: mousePos.y - token.position.y,
    };
  }

  private startSelectionBox(position: { x: number; y: number }): void {
    this.state.isSelecting = true;
    this.state.selectionBox = {
      startX: position.x,
      startY: position.y,
      endX: position.x,
      endY: position.y,
    };
    this.emit('selectionBoxStart', this.state.selectionBox);
  }

  private updateSelectionBox(position: { x: number; y: number }): void {
    if (!this.state.selectionBox) return;

    this.state.selectionBox.endX = position.x;
    this.state.selectionBox.endY = position.y;
    this.emit('selectionBoxUpdate', this.state.selectionBox);
  }

  private finishSelection(): void {
    if (!this.state.selectionBox) return;

    const box = this.state.selectionBox;
    const area = {
      x: Math.min(box.startX, box.endX),
      y: Math.min(box.startY, box.endY),
      width: Math.abs(box.endX - box.startX),
      height: Math.abs(box.endY - box.startY),
    };

    const tokensInArea = this.tokenManager.getTokensInArea(area);
    const tokenIds = tokensInArea.map(token => token.id);

    if (this.state.isMultiSelect) {
      const currentSelection = this.tokenManager.getSelectedTokens();
      const newSelection = [...new Set([...currentSelection, ...tokenIds])];
      this.tokenManager.selectTokens(newSelection, this.userId);
    } else {
      this.tokenManager.selectTokens(tokenIds, this.userId);
    }

    this.state.isSelecting = false;
    this.state.selectionBox = undefined;
    this.emit('selectionBoxEnd');
  }

  private deleteSelectedTokens(): void {
    const selectedTokens = this.tokenManager.getSelectedTokens();
    selectedTokens.forEach(tokenId => {
      this.tokenManager.deleteToken(tokenId, this.userId);
    });
  }

  private selectAllTokens(): void {
    const allTokens = this.tokenManager.getVisibleTokens(this.userId);
    const tokenIds = allTokens.map(token => token.id);
    this.tokenManager.selectTokens(tokenIds, this.userId);
  }

  private copySelectedTokens(): void {
    const selectedTokens = this.tokenManager.getSelectedTokens();
    this.emit('tokensCopied', selectedTokens);
  }

  private pasteTokens(): void {
    this.emit('tokensPaste');
  }

  private cancelCurrentAction(): void {
    if (this.state.isDragging) {
      // Cancel drag operation
      this.state.isDragging = false;
    } else if (this.state.isSelecting) {
      this.state.isSelecting = false;
      this.state.selectionBox = undefined;
      this.emit('selectionBoxCancel');
    } else {
      // Clear selection
      this.tokenManager.selectTokens([], this.userId);
    }
    
    this.emit('interactionStateChanged', this.state);
  }
}
