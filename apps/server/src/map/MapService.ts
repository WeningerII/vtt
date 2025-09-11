/**
 * Map and grid management service with database persistence
 */

import { logger } from "@vtt/logging";
import {
  MapScene,
  GridSettings,
  LightSource,
  FogArea,
  TokenPosition,
  MeasurementTool,
  CombatGrid,
  GridEffect,
  MapUpdateEvent,
  LineOfSightResult,
  GridType,
  InitiativeEntry,
} from "./types";
import { PrismaClient, GameSessionStatus } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";
import { GameEventBridge } from "../integration/GameEventBridge";
import { SpellEngine } from '@vtt/spell-engine';
import { DiceEngine } from '@vtt/dice-engine';
import { ConditionsEngine } from '@vtt/conditions-engine';
// WebSocketManager removed - using VTTWebSocketServer directly
import { PhysicsWorld, RigidBody } from '@vtt/physics';

export class MapService {
  private scenes = new Map<string, MapScene>();
  private combatGrids = new Map<string, CombatGrid>();
  private measurements = new Map<string, MeasurementTool>();
  private eventBridge?: GameEventBridge;
  private physicsWorld: PhysicsWorld;
  private spellEngine: SpellEngine;
  private diceEngine: DiceEngine;
  private conditionsEngine: ConditionsEngine;
  private activeSpellEffects = new Map<string, any>();
  private spellProjectiles = new Map<string, any>();
  private spatialIndex = new Map<string, Map<string, Set<string>>>();
  private spellEffectPhysicsBodies = new Map<string, number>();
  private physicsUpdateInterval: NodeJS.Timeout | null = null;
  private visualEffectsBridge: any = null; // Would be PhysicsVisualBridge instance

  constructor(
    private prisma: PrismaClient,
    private webSocketManager?: any, // Legacy stub
  ) {
    // Initialize physics world
    this.physicsWorld = new PhysicsWorld();

    // Initialize spell engines
    this.spellEngine = new SpellEngine();
    this.diceEngine = new DiceEngine();
    this.conditionsEngine = new ConditionsEngine();

    this.initializeSpatialIndexing();
    this.setupPhysicsIntegration();
  }

  /**
   * Set the game event bridge for automation integration
   */
  setEventBridge(eventBridge: GameEventBridge): void {
    this.eventBridge = eventBridge;
  }

  /**
   * Create a new map scene with database persistence
   */
  async createScene(
    name: string,
    width: number,
    height: number,
    campaignId: string,
    mapId?: string,
    gridSettings?: Partial<GridSettings>,
    lightingSettings?: any,
    fogSettings?: any,
  ): Promise<MapScene> {
    const defaultGrid: GridSettings = {
      type: "square",
      size: 50,
      offsetX: 0,
      offsetY: 0,
      snapMode: "center",
      visible: true,
      color: "#000000",
      opacity: 0.3,
      ...gridSettings,
    };

    const _defaultLighting = {
      enabled: false,
      ambientLight: 0.2,
      darkvisionRange: 60,
      lightSources: [],
      ...lightingSettings,
    };

    const _defaultFog = {
      enabled: false,
      areas: [],
      exploredAreas: [],
      ...fogSettings,
    };

    // Create scene in database
    const dbScene = await this.prisma.scene.create({
      data: {
        name,
        campaignId,
        mapId: mapId || null,
        // Grid, lighting and fog settings stored as JSON in metadata for now
        // gridSettings: defaultGrid as any,
        // lightingSettings: defaultLighting as any,
        // fogSettings: defaultFog as any,
      },
      include: {
        campaign: true,
      },
    });

    const scene: MapScene = {
      id: dbScene.id,
      name: dbScene.name,
      width,
      height,
      campaignId: dbScene.campaignId,
      mapId: dbScene.mapId,
      grid: defaultGrid,
      layers: [
        {
          id: uuidv4(),
          name: "Background",
          type: "background",
          visible: true,
          locked: false,
          opacity: 1,
          zIndex: 0,
        },
        {
          id: uuidv4(),
          name: "Tokens",
          type: "tokens",
          visible: true,
          locked: false,
          opacity: 1,
          zIndex: 100,
        },
        {
          id: uuidv4(),
          name: "Effects",
          type: "effects",
          visible: true,
          locked: false,
          opacity: 0.8,
          zIndex: 200,
        },
        {
          id: uuidv4(),
          name: "Fog of War",
          type: "fog",
          visible: true,
          locked: false,
          opacity: 0.8,
          zIndex: 300,
        },
      ],
      lighting: {
        enabled: false,
        globalIllumination: 0.3,
        darkvision: false,
        lightSources: [],
      },
      fog: {
        enabled: false,
        mode: "exploration",
        exploredAreas: [],
        hiddenAreas: [],
        lineOfSight: false,
        sightRadius: 30,
      },
      tokens: [].map((token: any) => ({
        x: token.x,
        y: token.y,
        rotation: token.rotation,
        elevation: 0, // Default elevation
        id: token.id,
        name: token.name,
        width: token.width,
        height: token.height,
        scale: token.scale,
        disposition: token.disposition,
        isVisible: token.isVisible,
        isLocked: token.isLocked,
        layer: token.layer,
        actorId: token.actorId,
        assetId: token.assetId,
      })),
    };

    this.scenes.set(dbScene.id, scene);
    return scene;
  }

  /**
   * Get scene by ID with database lookup
   */
  async getScene(sceneId: string): Promise<MapScene | null> {
    // Check cache first
    const cached = this.scenes.get(sceneId);
    if (cached) {return cached;}

    // Load from database
    const dbScene = await this.prisma.scene.findUnique({
      where: { id: sceneId },
      include: {
        campaign: true,
        map: true,
      },
    });

    if (!dbScene) {return null;}

    // Get dimensions from map or use defaults
    let sceneWidth = 1920;
    let sceneHeight = 1080;
    if ((dbScene as any).map) {
      // Prefer map dimensions when available
      const m = (dbScene as any).map as { widthPx?: number; heightPx?: number };
      if (typeof m.widthPx === 'number' && typeof m.heightPx === 'number') {
        sceneWidth = m.widthPx;
        sceneHeight = m.heightPx;
      }
    }

    // Build MapScene object
    const scene: MapScene = {
      id: dbScene.id,
      name: dbScene.name,
      width: sceneWidth,
      height: sceneHeight,
      campaignId: dbScene.campaignId,
      mapId: dbScene.mapId,
      grid: (() => {
        try {
          // Type assertion for metadata field (may need to be added to Prisma schema)
          const sceneWithMetadata = dbScene as any;
          if (sceneWithMetadata.metadata) {
            const metadata =
              typeof sceneWithMetadata.metadata === "string"
                ? JSON.parse(sceneWithMetadata.metadata)
                : sceneWithMetadata.metadata;
            return (
              metadata.gridSettings || {
                type: "square",
                size: 50,
                offsetX: 0,
                offsetY: 0,
                snapMode: "center",
                visible: true,
                color: "#000000",
                opacity: 0.3,
              }
            );
          }
        } catch (error) {
          logger.warn("Failed to parse scene metadata:", error as Error);
        }
        return {
          type: "square",
          size: 50,
          offsetX: 0,
          offsetY: 0,
          snapMode: "center",
          visible: true,
          color: "#000000",
          opacity: 0.3,
        };
      })(),
      lighting: {
        enabled: false,
        globalIllumination: 0.3,
        darkvision: false,
        lightSources: [],
      },
      fog: {
        enabled: false,
        mode: "exploration",
        exploredAreas: [],
        hiddenAreas: [],
        lineOfSight: false,
        sightRadius: 30,
      },
      layers: [
        {
          id: "bg",
          name: "Background",
          type: "background",
          visible: true,
          locked: false,
          opacity: 1,
          zIndex: 0,
        },
        {
          id: "tokens",
          name: "Tokens",
          type: "tokens",
          visible: true,
          locked: false,
          opacity: 1,
          zIndex: 100,
        },
      ],
      tokens: [].map((token: any) => ({
        x: token.x,
        y: token.y,
        rotation: token.rotation,
        elevation: 0,
        id: token.id,
        name: token.name,
        width: token.width,
        height: token.height,
        scale: token.scale,
        disposition: token.disposition,
        isVisible: token.isVisible,
        isLocked: token.isLocked,
        layer: token.layer,
        actorId: token.actorId,
        assetId: token.assetId,
      })),
    };

    this.scenes.set(dbScene.id, scene);
    return scene;
  }

  /**
   * Calculate distance between two points
   */
  calculateDistance(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    gridSettings: any,
    unit: "feet" | "meters" | "pixels" | "grid",
  ): number {
    const pixelDistance = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));

    if (unit === "pixels") {return pixelDistance;}

    const gridSize = gridSettings?.size || 50;
    const gridDistance = pixelDistance / gridSize;

    // Convert to feet (assuming 5 feet per grid square in D&D)
    if (unit === "feet") {return gridDistance * 5;}
    if (unit === "meters") {return gridDistance * 1.5;}
    if (unit === "grid") {return gridDistance;}

    return pixelDistance;
  }

  /**
   * Add fog area
   */
  async addFogArea(_sceneId: string, _fogArea: any): Promise<any | null> {
    // Simplified implementation
    return null;
  }

  /**
   * Reveal fog area
   */
  async revealFogArea(_sceneId: string, _x: number, _y: number, _radius: number): Promise<boolean> {
    // Simplified implementation
    return true;
  }

  /**
   * Create measurement tool
   */
  async createMeasurement(
    sceneId: string,
    type: "distance" | "area",
    points: Array<{ x: number; y: number }>,
    ownerId: string,
  ): Promise<any> {
    const scene = await this.getScene(sceneId);
    if (!scene) {
      throw new Error("Scene not found");
    }

    let distance = 0;
    let area = 0;

    // Calculate measurements
    if (points.length >= 2) {
      for (let i = 1; i < points.length; i++) {
        const prevPoint = points[i - 1];
        const currentPoint = points[i];
        if (prevPoint && currentPoint) {
          distance += this.calculateDistance(
            prevPoint.x,
            prevPoint.y,
            currentPoint.x,
            currentPoint.y,
            scene.grid,
            "feet",
          );
        }
      }
    }

    if (type === "area" && points.length >= 3) {
      // Calculate polygon area using shoelace formula
      let sum = 0;
      for (let i = 0; i < points.length; i++) {
        const j = (i + 1) % points.length;
        const currentPoint = points[i];
        const nextPoint = points[j];
        if (currentPoint && nextPoint) {
          sum += currentPoint.x * nextPoint.y;
          sum -= nextPoint.x * currentPoint.y;
        }
      }
      area = Math.abs(sum) / 2;
      // Convert to grid squares
      const gridSize = scene.grid?.size || 50;
      area = area / (gridSize * gridSize);
    }

    const measurement = {
      id: uuidv4(),
      type,
      points,
      color: "#ff0000",
      visible: true,
      ownerId,
      measurements: {
        distance,
        ...(area > 0 && { area }),
        units: "feet",
      },
    };

    return measurement;
  }

  /**
   * Add a token to a scene with database persistence
   */
  async addToken(
    sceneId: string,
    tokenData: {
      name: string;
      x: number;
      y: number;
      width?: number;
      height?: number;
      disposition?: "FRIENDLY" | "NEUTRAL" | "HOSTILE" | "UNKNOWN";
      actorId?: string;
      assetId?: string;
    },
  ): Promise<string | null> {
    try {
      const scene = await this.getScene(sceneId);
      if (!scene) {return null;}

      // Snap token position to grid
      const alignedPosition = this.snapToGrid(tokenData.x, tokenData.y, scene.grid);
      const gridBounds = this.getGridBounds(scene.grid, scene.width, scene.height);

      // Ensure there is an active GameSession for this campaign (Token requires gameSessionId)
      let activeSession = await this.prisma.gameSession.findFirst({
        where: { campaignId: scene.campaignId, status: GameSessionStatus.ACTIVE },
      });
      
      if (!activeSession) {
        // Auto-create a WAITING session to preserve token placement workflow
        logger.info(`Auto-creating WAITING session for campaign ${scene.campaignId} to place token`);
        activeSession = await this.prisma.gameSession.create({
          data: {
            name: `Token Placement Session ${new Date().toISOString()}`,
            campaignId: scene.campaignId,
            status: GameSessionStatus.WAITING,
            currentSceneId: sceneId,
          },
        });
      }

      const tokenId = uuidv4();
      const token = await this.prisma.token.create({
        data: {
          id: tokenId,
          name: tokenData.name,
          sceneId,
          x: alignedPosition.x,
          y: alignedPosition.y,
          rotation: 0,
          scale: 1,
          type: 'NPC', // Default type
          gameSessionId: activeSession.id, // Link to the active session
          visibility: 'VISIBLE',
          characterId: tokenData.actorId,
          imageUrl: tokenData.assetId,
          metadata: {
            width: tokenData.width || 50,
            height: tokenData.height || 50,
            disposition: tokenData.disposition || 'NEUTRAL',
            layer: 1
          },
        },
      });

      const bodySize = Math.min(gridBounds.cellWidth, gridBounds.cellHeight) * 0.8;
      try {
        const numericId = this.generateNumericId(tokenId);
        const rigidBody = new RigidBody(
          numericId,
          alignedPosition.x,
          alignedPosition.y,
          bodySize,
          bodySize,
          {
            mass: 1,
            friction: 0.8,
            restitution: 0.3,
            isStatic: false,
            isTrigger: false,
            layer: 1,
            mask: 0xffffffff,
          }
        );
        this.physicsWorld.addBody(rigidBody);
      } catch (error) {
        logger.warn(`Failed to create physics body for token: ${tokenId}`, error as Error);
      }

      // Update spatial index for new token
      const tokenWidth = tokenData.width || 1;
      const tokenHeight = tokenData.height || 1;
      this.updateSpatialIndex(
        sceneId,
        tokenId,
        alignedPosition.x,
        alignedPosition.y,
        tokenWidth * 50,
        tokenHeight * 50,
      );

      // Emit real-time update
      this.emitMapUpdate(sceneId, {
        type: "token_add",
        token,
        timestamp: Date.now(),
      });

      return token.id;
    } catch (error) {
      logger.error("Failed to add token:", error as Error);
      return null;
    }
  }

  /**
   * Update grid settings for a scene with database persistence
   */
  async updateGridSettings(sceneId: string, settings: Partial<GridSettings>): Promise<boolean> {
    const scene = this.scenes.get(sceneId);
    if (!scene) {return false;}

    Object.assign(scene.grid, settings);

    // Update in database
    try {
      await this.prisma.scene.update({
        where: { id: sceneId },
        data: {
          // Note: metadata field may need to be added to Prisma schema
          ...(scene.grid &&
            {
              // Store grid settings in a compatible way until metadata field is added
            }),
        },
      });
    } catch (error) {
      logger.error("Failed to update grid settings in database:", error as Error);
      return false;
    }

    // Emit update event for real-time sync
    this.emitMapUpdate(sceneId, {
      type: "grid_settings_changed",
      sceneId,
      settings: scene.grid,
      timestamp: Date.now(),
    });

    return true;
  }

  /**
   * Remove a token from scene
   */
  async removeToken(sceneId: string, tokenId: string): Promise<boolean> {
    try {
      await this.prisma.token.delete({
        where: { id: tokenId },
      });

      // Remove corresponding physics body
      try {
        const numericId = this.generateNumericId(tokenId);
        this.physicsWorld.removeBody(numericId);
      } catch (error) {
        logger.warn(`Failed to remove physics body for token: ${tokenId}`, error as Error);
      }

      // Emit real-time update
      this.emitMapUpdate(sceneId, {
        type: "token_remove",
        tokenId,
        timestamp: Date.now(),
      });

      return true;
    } catch (error) {
      logger.error("Failed to remove token:", error as Error);
      return false;
    }
  }

  /**
   * Move a token to new position with automation hooks
   */
  async moveToken(sceneId: string, tokenId: string, x: number, y: number): Promise<boolean> {
    try {
      const scene = await this.getScene(sceneId);
      if (!scene) {return false;}

      const token = scene.tokens?.find((t) => t.id === tokenId);
      if (!token) {return false;}

      // Snap to grid for consistent positioning
      const alignedPosition = this.snapToGrid(x, y, scene.grid);

      // Update token position
      await this.prisma.token.update({
        where: { id: tokenId },
        data: {
          x: alignedPosition.x,
          y: alignedPosition.y,
        },
      });

      // Update physics body position
      try {
        const numericId = this.generateNumericId(tokenId);
        const physicsBody = this.physicsWorld.getBody(numericId);
        if (physicsBody) {
          physicsBody.position.x = alignedPosition.x;
          physicsBody.position.y = alignedPosition.y;
        }
      } catch (error) {
        logger.warn(`Failed to update physics body for token: ${tokenId}`, error as Error);
      }

      // Update spatial index for optimized collision detection
      const tokenWidth = token.width || 50;
      const tokenHeight = token.height || 50;
      this.updateSpatialIndex(
        sceneId,
        tokenId,
        alignedPosition.x,
        alignedPosition.y,
        tokenWidth * 50,
        tokenHeight * 50,
      );

      // Update in-memory scene
      if (scene.tokens) {
        const tokenIndex = scene.tokens.findIndex((t) => t.id === tokenId);
        if (tokenIndex >= 0) {
          scene.tokens[tokenIndex] = { ...token, x: alignedPosition.x, y: alignedPosition.y };
        }
      }

      // Emit real-time update
      this.emitMapUpdate(sceneId, {
        type: "token_move",
        tokenId,
        x: alignedPosition.x,
        y: alignedPosition.y,
        timestamp: Date.now(),
      });

      return true;
    } catch (error) {
      logger.error("Failed to move token:", error as Error);
      return false;
    }
  }

  /**
   * Update token properties
   */
  async updateToken(
    sceneId: string,
    tokenId: string,
    updates: Partial<Omit<TokenPosition, "id">>,
  ): Promise<boolean> {
    const scene = await this.getScene(sceneId);
    if (!scene) {return false;}

    // Update database
    await this.prisma.token.update({
      where: { id: tokenId },
      data: updates,
    });

    // Update cached scene
    if (scene.tokens) {
      const tokenIndex = scene.tokens.findIndex((t) => t.id === tokenId);
      if (tokenIndex >= 0 && scene.tokens[tokenIndex]) {
        Object.assign(scene.tokens[tokenIndex], updates);
      }
    }

    return true;
  }

  /**
   * Setup physics integration
   */
  private setupPhysicsIntegration(): void {
    // Set up physics world event listeners
    this.physicsWorld.on('collision', (data: any) => {
      this.handleTokenCollision(data);
    });

    // Start physics update loop
    this.physicsUpdateInterval = setInterval(() => {
      this.physicsWorld.update(1/60);
    }, 1000/60);
  }

  /**
   * Get targets in spell area using physics-based detection
   */
  private getTargetsInSpellArea(
    center: { x: number; y: number },
    radius: number,
    tokens: TokenPosition[],
    areaType: "sphere" | "cube" | "cylinder" | "line" | "cone",
  ): string[] {
    const targets: string[] = [];

    for (const token of tokens) {
      if (this.isTokenInSpellArea(token, center, radius, areaType)) {
        // Check line of sight using physics raycasting
        // Check line of sight using physics detection
        // Simplified for now - raycast API not available, assume line of sight
        targets.push(token.id);
      }
    }

    return targets;
  }

  /**
   * Check if token is in spell area
   */
  private isTokenInSpellArea(
    token: TokenPosition,
    center: { x: number; y: number },
    size: number,
    areaType: "sphere" | "cube" | "cylinder" | "line" | "cone",
  ): boolean {
    const distance = Math.sqrt(Math.pow(token.x - center.x, 2) + Math.pow(token.y - center.y, 2));

    switch (areaType) {
      case "sphere":
      case "cylinder":
        return distance <= size;
      case "cube":
        return Math.abs(token.x - center.x) <= size / 2 && Math.abs(token.y - center.y) <= size / 2;
      case "line":
        // Simplified line area check
        return distance <= size && this.isTokenInLine(token, center, size);
      case "cone":
        // Simplified cone area check
        return distance <= size && this.isTokenInCone(token, center, size);
      default:
        return distance <= size;
    }
  }

  private isTokenInLine(
    token: TokenPosition,
    center: { x: number; y: number },
    _length: number,
  ): boolean {
    // Simplified line check - would need direction vector in real implementation
    return Math.abs(token.y - center.y) <= 2.5; // 5-foot wide line
  }

  private isTokenInCone(
    token: TokenPosition,
    center: { x: number; y: number },
    _range: number,
  ): boolean {
    // Simplified cone check - would need direction and angle in real implementation
    const angle = Math.atan2(token.y - center.y, token.x - center.x);
    return Math.abs(angle) <= Math.PI / 6; // 60-degree cone
  }

  // Synchronize physics bodies with grid-aligned token positions
  private async synchronizePhysicsWithGrid(sceneId: string): Promise<void> {
    const scene = await this.getScene(sceneId);
    if (!scene || !scene.tokens) {return;}

    const _gridBounds = this.getGridBounds(scene.grid, scene.width, scene.height);

    for (const token of scene.tokens) {
      // Ensure token is grid-aligned
      const alignedPosition = this.snapToGrid(token.x, token.y, scene.grid);
      // Update physics body position if misaligned
      const numericId = this.generateNumericId(token.id);
      const physicsBody = this.physicsWorld.getBody(numericId);
      if (physicsBody) {
        physicsBody.position.x = alignedPosition.x;
        physicsBody.position.y = alignedPosition.y;
      }

      // Update token position if it was misaligned
      if (token.x !== alignedPosition.x || token.y !== alignedPosition.y) {
        await this.updateToken(sceneId, token.id, {
          x: alignedPosition.x,
          y: alignedPosition.y,
        });
      }
    }
  }

  /**
   * Initialize physics world for a scene with grid alignment
   */
  private async initializePhysicsForScene(sceneId: string): Promise<void> {
    const scene = await this.getScene(sceneId);
    if (!scene || !scene.tokens) {return;}

    const gridBounds = this.getGridBounds(scene.grid, scene.width, scene.height);

    // Clear existing physics bodies for this scene
    scene.tokens.forEach((token) => {
      const numericId = this.generateNumericId(token.id);
      this.physicsWorld.removeBody(numericId);
    });

    // Add physics bodies for all tokens with proper grid alignment
    scene.tokens.forEach((token) => {
      const alignedPosition = this.snapToGrid(token.x, token.y, scene.grid);
      const bodySize = Math.min(gridBounds.cellWidth, gridBounds.cellHeight) * token.scale * 0.8;

      try {
        const numericId = this.generateNumericId(token.id);
        const rigidBody = new RigidBody(
          numericId,
          alignedPosition.x,
          alignedPosition.y,
          bodySize,
          bodySize,
          {
            mass: 1,
            friction: 0.8,
            restitution: 0.3,
            isStatic: false,
            isTrigger: false,
            layer: 1,
            mask: 0xffffffff,
          }
        );
        this.physicsWorld.addBody(rigidBody);
      } catch (error) {
        logger.warn(`Failed to create physics body for token: ${token.id}`, error as Error);
      }
    });

    // Synchronize any misaligned tokens
    await this.synchronizePhysicsWithGrid(sceneId);
  }

  /**
   * Update physics world with scene changes
   */
  private async updatePhysicsWorld(sceneId: string): Promise<void> {
    const scene = await this.getScene(sceneId);
    if (!scene || !scene.tokens) {return;}

    // Sync physics bodies with token positions
    for (const token of scene.tokens) {
      const numericId = this.generateNumericId(token.id);
      const physicsBody = this.physicsWorld.getBody(numericId);
      if (physicsBody) {
        physicsBody.position.x = token.x;
        physicsBody.position.y = token.y;
      }
    }
  }

  /**
   * Get active spell effects for scene
   */
  private getActiveSpellEffects(sceneId: string): any[] {
    return Array.from(this.activeSpellEffects.values()).filter(
      (effect) => effect.sceneId === sceneId,
    );
  }

  /**
   * Get spell projectiles for scene
   */
  private getSpellProjectiles(sceneId: string): any[] {
    return Array.from(this.spellProjectiles.values()).filter(
      (projectile) => projectile.sceneId === sceneId,
    );
  }

  /**
   * Handle spell projectile hit events
   */
  private handleSpellProjectileHit(data: any): void {
    // Process projectile impact
    if (data.sceneId && data.targetId) {
      this.emitMapUpdate(data.sceneId, {
        type: "spell_projectile_hit",
        projectileId: data.projectileId,
        targetId: data.targetId,
        damage: data.damage,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Handle spell effect expiration
   */
  private handleSpellEffectExpired(data: any): void {
    // Clean up expired spell effects
    if (data.effectId) {
      this.activeSpellEffects.delete(data.effectId);

      if (data.sceneId) {
        this.emitMapUpdate(data.sceneId, {
          type: "spell_effect_expired",
          effectId: data.effectId,
          timestamp: Date.now(),
        });
      }
    }
  }

  /**
   * Handle token collision events
   */
  private handleTokenCollision(data: any): void {
    // Process token collisions
    if (data.sceneId && data.tokenAId && data.tokenBId) {
      this.emitMapUpdate(data.sceneId, {
        type: "token_collision",
        tokenAId: data.tokenAId,
        tokenBId: data.tokenBId,
        position: data.position,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Emit map update event for real-time synchronization
   */
  private emitMapUpdate(sceneId: string, data: any): void {
    // Broadcast to all connected clients in the scene
    if (this.webSocketManager) {
      try {
        this.webSocketManager.broadcast("map_update", {
          sceneId,
          ...data,
          timestamp: Date.now(),
        });
      } catch (error) {
        logger.error("Failed to broadcast map update:", error as Error);
      }
    }

    // Trigger automation if event bridge is available
    if (this.eventBridge) {
      try {
        this.eventBridge.processGameEvent({
          ...data,
          sceneId,
          source: "map_service",
        });
      } catch (error) {
        logger.error("Failed to trigger automation:", error as Error);
      }
    }
  }

  /**
   * Snap position to grid alignment
   */
  snapToGrid(x: number, y: number, gridSettings: GridSettings): { x: number; y: number } {
    const gridSize = gridSettings.size || 50;
    const offsetX = gridSettings.offsetX || 0;
    const offsetY = gridSettings.offsetY || 0;

    const alignedX = Math.round((x - offsetX) / gridSize) * gridSize + offsetX;
    const alignedY = Math.round((y - offsetY) / gridSize) * gridSize + offsetY;

    return { x: alignedX, y: alignedY };
  }

  /**
   * Initialize spatial indexing for optimized collision detection
   */
  private initializeSpatialIndexing(): void {
    // Initialize spatial index structure
    this.spatialIndex = new Map<string, Map<string, Set<string>>>();
  }

  /**
   * Update spatial index when tokens move
   */
  private updateSpatialIndex(
    sceneId: string,
    tokenId: string,
    x: number,
    y: number,
    width: number = 50,
    height: number = 50,
  ): void {
    if (!this.spatialIndex.has(sceneId)) {
      this.spatialIndex.set(sceneId, new Map());
    }

    const sceneIndex = this.spatialIndex.get(sceneId)!;
    const gridSize = 100; // Spatial grid cell size

    // Calculate grid cells this token occupies
    const minX = Math.floor(x / gridSize);
    const minY = Math.floor(y / gridSize);
    const maxX = Math.floor((x + width) / gridSize);
    const maxY = Math.floor((y + height) / gridSize);

    // Remove token from previous cells
    for (const [cellKey, tokenSet] of sceneIndex.entries()) {
      tokenSet.delete(tokenId);
      if (tokenSet.size === 0) {
        sceneIndex.delete(cellKey);
      }
    }

    // Add token to new cells
    for (let gx = minX; gx <= maxX; gx++) {
      for (let gy = minY; gy <= maxY; gy++) {
        const cellKey = `${gx},${gy}`;
        if (!sceneIndex.has(cellKey)) {
          sceneIndex.set(cellKey, new Set());
        }
        sceneIndex.get(cellKey)!.add(tokenId);
      }
    }
  }

  /**
   * Get nearby tokens using spatial index for collision detection
   */
  private getNearbyTokens(
    sceneId: string,
    x: number,
    y: number,
    radius: number = 100,
  ): Set<string> {
    const nearbyTokens = new Set<string>();
    const sceneIndex = this.spatialIndex.get(sceneId);
    if (!sceneIndex) {return nearbyTokens;}

    const gridSize = 100;
    const cellRadius = Math.ceil(radius / gridSize);
    const centerX = Math.floor(x / gridSize);
    const centerY = Math.floor(y / gridSize);

    // Check surrounding grid cells
    for (let gx = centerX - cellRadius; gx <= centerX + cellRadius; gx++) {
      for (let gy = centerY - cellRadius; gy <= centerY + cellRadius; gy++) {
        const cellKey = `${gx},${gy}`;
        const cellTokens = sceneIndex.get(cellKey);
        if (cellTokens) {
          cellTokens.forEach((tokenId) => nearbyTokens.add(tokenId));
        }
      }
    }

    return nearbyTokens;
  }

  /**
   * Apply damage to an entity
   */
  async applyDamage(
    sceneId: string,
    targetId: string,
    damage: number,
    damageType: string = "untyped",
  ): Promise<boolean> {
    try {
      const scene = await this.getScene(sceneId);
      if (!scene) {return false;}

      const token = scene.tokens?.find((t) => t.id === targetId);
      if (!token) {return false;}

      // Update token health in database
      await this.prisma.token.update({
        where: { id: targetId },
        data: {
          // Update health field
          health: Math.max(0, (token as any).health - damage),
        },
      });

      // Update cached scene
      if (scene.tokens) {
        const tokenIndex = scene.tokens.findIndex((t) => t.id === targetId);
        if (tokenIndex >= 0) {
          (scene.tokens[tokenIndex] as any).health = Math.max(
            0,
            ((scene.tokens[tokenIndex] as any).hitPoints || 100) - damage,
          );
        }
      }

      // Emit real-time update
      this.emitMapUpdate(sceneId, {
        type: "damage_applied",
        targetId,
        damage,
        damageType,
        timestamp: Date.now(),
      });

      return true;
    } catch (error) {
      logger.error("Failed to apply damage:", error as Error);
      return false;
    }
  }

  /**
   * Apply healing to an entity
   */
  async applyHealing(sceneId: string, targetId: string, healing: number): Promise<boolean> {
    try {
      const scene = await this.getScene(sceneId);
      if (!scene) {return false;}

      const token = scene.tokens?.find((t) => t.id === targetId);
      if (!token) {return false;}

      const currentHP = (token as any).hitPoints || 100;
      const maxHP = (token as any).maxHitPoints || 100;
      const newHP = Math.min(maxHP, currentHP + healing);

      // Update token health in database
      await this.prisma.token.update({
        where: { id: targetId },
        data: {
          // Update health field
          health: Math.max(0, Math.min((token as any).maxHealth || 100, (token as any).health + healing)),
        },
      });

      // Update cached scene
      if (scene.tokens) {
        const tokenIndex = scene.tokens.findIndex((t) => t.id === targetId);
        if (tokenIndex >= 0) {
          (scene.tokens[tokenIndex] as any).health = Math.max(
            0,
            (scene.tokens[tokenIndex] as any).health - 0,
          );
        }
      }

      // Emit real-time update
      this.emitMapUpdate(sceneId, {
        type: "healing_applied",
        targetId,
        healing,
        newHitPoints: newHP,
        timestamp: Date.now(),
      });

      return true;
    } catch (error) {
      logger.error("Failed to apply healing:", error as Error);
      return false;
    }
  }

  /**
   * Apply condition to an entity
   */
  async applyCondition(
    sceneId: string,
    targetId: string,
    condition: string,
    duration?: number,
  ): Promise<boolean> {
    try {
      const scene = await this.getScene(sceneId);
      if (!scene) {return false;}

      const token = scene.tokens?.find((t) => t.id === targetId);
      if (!token) {return false;}

      // Add condition to token (assuming conditions field exists or will be added)
      const conditions = (token as any).conditions || [];
      const newCondition = {
        id: uuidv4(),
        name: condition,
        duration: duration || -1, // -1 for permanent
        appliedAt: Date.now(),
      };

      conditions.push(newCondition);

      // Update token in database
      await this.prisma.token.update({
        where: { id: targetId },
        data: {
          // Store conditions as JSON
          // conditions field not available in current Token schema
          // conditions: JSON.stringify(conditions),
        },
      });

      // Update cached scene
      if (scene.tokens) {
        const tokenIndex = scene.tokens.findIndex((t) => t.id === targetId);
        if (tokenIndex >= 0) {
          (scene.tokens[tokenIndex] as any).conditions = conditions;
        }
      }

      // Emit real-time update
      this.emitMapUpdate(sceneId, {
        type: "condition_applied",
        targetId,
        metadata: { ...((token as any).metadata || {}), conditions },
        timestamp: Date.now(),
      });

      return true;
    } catch (error) {
      logger.error("Failed to apply condition:", error as Error);
      return false;
    }
  }

  /**
   * Execute attack action
   */
  async executeAttack(
    sceneId: string,
    attackerId: string,
    targetId: string,
    weaponId?: string,
  ): Promise<{
    success: boolean;
    hit: boolean;
    damage?: number;
    critical?: boolean;
    details: any;
  }> {
    try {
      const scene = await this.getScene(sceneId);
      if (!scene) {return { success: false, hit: false, details: { error: "Scene not found" } };}

      const attacker = scene.tokens?.find((t) => t.id === attackerId);
      const target = scene.tokens?.find((t) => t.id === targetId);

      if (!attacker || !target) {
        return { success: false, hit: false, details: { error: "Attacker or target not found" } };
      }

      // Basic attack calculation (would integrate with ActionSystem for full implementation)
      const attackRoll = Math.floor(Math.random() * 20) + 1;
      const attackBonus = (attacker as any).attackBonus || 5;
      const totalAttack = attackRoll + attackBonus;
      const targetAC = (target as any).armorClass || 15;

      const hit = totalAttack >= targetAC;
      const critical = attackRoll === 20;
      let damage = 0;

      if (hit) {
        // Basic damage calculation
        const baseDamage = Math.floor(Math.random() * 8) + 1; // 1d8
        const damageBonus = (attacker as any).damageBonus || 3;
        damage = baseDamage + damageBonus;

        if (critical) {
          damage *= 2;
        }

        // Apply damage
        await this.applyDamage(sceneId, targetId, damage);
      }

      const result: {
        success: boolean;
        hit: boolean;
        damage?: number;
        critical?: boolean;
        details: any;
      } = {
        success: true,
        hit,
        ...(hit && { damage }),
        ...(critical && { critical }),
        details: {
          attackRoll,
          attackBonus,
          totalAttack,
          targetAC,
          weaponId,
        },
      };

      // Emit real-time update
      this.emitMapUpdate(sceneId, {
        type: "attack_executed",
        attackerId,
        targetId,
        result,
        timestamp: Date.now(),
      });

      return result;
    } catch (error) {
      logger.error("Failed to execute attack:", error as Error);
      return { success: false, hit: false, details: { error: (error as Error).message } };
    }
  }

  /**
   * Cast spell with full integration
   */
  async castSpell(
    sceneId: string,
    casterId: string,
    spellId: string,
    targetId?: string,
    position?: { x: number; y: number },
  ): Promise<{
    success: boolean;
    effects: any[];
    details: any;
  }> {
    try {
      const scene = await this.getScene(sceneId);
      if (!scene) {return { success: false, effects: [], details: { error: "Scene not found" } };}

      const caster = scene.tokens?.find((t) => t.id === casterId);
      if (!caster) {
        return { success: false, effects: [], details: { error: "Caster not found" } };
      }

      // Use actual SpellEngine for spell casting
      const effects: any[] = [];

      // Get spell data (in a real implementation, this would come from a spell database)
      const spell = this.getSpellData(spellId);
      if (!spell) {
        return { success: false, effects: [], details: { error: "Spell not found" } };
      }

      // Cast spell using SpellEngine
      const castingResult = this.spellEngine?.castSpell?.(
        spell,
        caster,
        targetId ? [targetId] : [],
        undefined,
        position,
      );

      if (!castingResult.success) {
        return { success: false, effects: [], details: castingResult };
      }

      // Apply spell effects using existing methods
      for (const effect of castingResult.effects || []) {
        switch (effect.type) {
          case "damage":
            if (effect.target) {
              const damage = effect.result?.damage || 0;
              const damageType = effect.result?.damageType || "force";
              await this.applyDamage(sceneId, effect.target, damage, damageType);
              effects.push(effect);
            }
            break;
          case "healing":
            if (effect.target) {
              const healing = effect.result?.healing || 0;
              await this.applyHealing(sceneId, effect.target, healing);
              effects.push(effect);
            }
            break;
          case "condition":
            if (effect.target) {
              const condition = effect.result?.condition || "unknown";
              const duration = effect.result?.duration;
              await this.applyCondition(sceneId, effect.target, condition, duration);
              effects.push(effect);
            }
            break;
          case "movement":
            if (effect.target && effect.result?.position) {
              await this.moveToken(
                sceneId,
                effect.target,
                effect.result.position.x,
                effect.result.position.y,
              );
              effects.push(effect);
            }
            break;
          default:
            effects.push(effect);
        }
      }

      const result = {
        success: true,
        effects,
        details: {
          spellId,
          casterId,
          targetId,
          position,
        },
      };

      // Emit real-time update
      this.emitMapUpdate(sceneId, {
        type: "spell_cast",
        casterId,
        spellId,
        targetId,
        position,
        effects,
        timestamp: Date.now(),
      });

      return result;
    } catch (error) {
      logger.error("Failed to cast spell:", error as Error);
      return { success: false, effects: [], details: { error: (error as Error).message } };
    }
  }

  /**
   * Get spell data for casting (placeholder implementation)
   */
  private getSpellData(spellId: string): any {
    // Basic spell database - in production this would come from a proper spell database
    const spells: Record<string, any> = {
      fireball: {
        id: "fireball",
        name: "Fireball",
        level: 3,
        school: "evocation",
        castingTime: "1 action",
        range: 150,
        components: ["V", "S", "M"],
        duration: "instantaneous",
        description:
          "A bright streak flashes from your pointing finger to a point you choose within range and then blossoms with a low roar into an explosion of flame.",
        damage: { dice: "8d6", type: "fire" },
        area: { type: "sphere", radius: 20 },
        savingThrow: { ability: "dexterity", dc: 15 },
      },
      cure_wounds: {
        id: "cure_wounds",
        name: "Cure Wounds",
        level: 1,
        school: "evocation",
        castingTime: "1 action",
        range: "touch",
        components: ["V", "S"],
        duration: "instantaneous",
        description: "A creature you touch regains a number of hit points.",
        healing: { dice: "1d8", modifier: 3 },
      },
      hold_person: {
        id: "hold_person",
        name: "Hold Person",
        level: 2,
        school: "enchantment",
        castingTime: "1 action",
        range: 60,
        components: ["V", "S", "M"],
        duration: "concentration, up to 1 minute",
        description:
          "Choose a humanoid that you can see within range. The target must succeed on a Wisdom saving throw or be paralyzed for the duration.",
        condition: "paralyzed",
        savingThrow: { ability: "wisdom", dc: 15 },
        concentration: true,
      },
      misty_step: {
        id: "misty_step",
        name: "Misty Step",
        level: 2,
        school: "conjuration",
        castingTime: "1 bonus action",
        range: "self",
        components: ["V"],
        duration: "instantaneous",
        description:
          "Briefly surrounded by silvery mist, you teleport up to 30 feet to an unoccupied space that you can see.",
        teleport: { range: 30 },
      },
    };

    return spells[spellId] || null;
  }

  /**
   * Get basic spell effects (placeholder for full SpellEngine integration)
   */
  private getBasicSpellEffects(
    spellId: string,
    targetId?: string,
    position?: { x: number; y: number },
  ): any[] {
    const effects: any[] = [];

    switch (spellId) {
      case "fireball":
        if (position) {
          // Area damage effect
          effects.push({
            type: "damage",
            value: Math.floor(Math.random() * 6 * 8) + 8, // 8d6
            damageType: "fire",
            area: { center: position, radius: 20 },
          });
        }
        break;
      case "cure_wounds":
        if (targetId) {
          effects.push({
            type: "healing",
            targetId,
            value: Math.floor(Math.random() * 8) + 1 + 3, // 1d8 + 3
          });
        }
        break;
      case "hold_person":
        if (targetId) {
          effects.push({
            type: "condition",
            targetId,
            condition: "paralyzed",
            duration: 60000, // 1 minute
          });
        }
        break;
      case "misty_step":
        if (targetId && position) {
          effects.push({
            type: "movement",
            targetId,
            position,
          });
        }
        break;
      default:
        // Generic spell effect
        if (targetId) {
          effects.push({
            type: "damage",
            targetId,
            value: Math.floor(Math.random() * 6) + 1, // 1d6
            damageType: "force",
          });
        }
    }

    return effects;
  }

  /**
   * Add encounter to scene
   */
  async addEncounter(sceneId: string, encounterData: any): Promise<any> {
    try {
      // Add encounter tokens to scene
      const addedTokens: any[] = [];

      if (encounterData.monsters) {
        for (const monster of encounterData.monsters) {
          const tokenId = await this.addToken(sceneId, {
            name: monster.name,
            x: monster.position?.x || Math.random() * 1000,
            y: monster.position?.y || Math.random() * 1000,
            disposition: "HOSTILE",
            width: monster.size || 1,
            height: monster.size || 1,
          });

          if (tokenId) {
            addedTokens.push({ id: tokenId, ...monster });
          }
        }
      }

      return { id: uuidv4(), monsters: addedTokens, ...encounterData };
    } catch (error) {
      logger.error("Failed to add encounter:", error as Error);
      return null;
    }
  }

  /**
   * Add NPC to scene
   */
  async addNPC(sceneId: string, npcData: any): Promise<any> {
    try {
      const tokenId = await this.addToken(sceneId, {
        name: npcData.name,
        x: npcData.position?.x || Math.random() * 1000,
        y: npcData.position?.y || Math.random() * 1000,
        disposition: npcData.disposition || "NEUTRAL",
        width: 1,
        height: 1,
      });

      return { id: tokenId, ...npcData };
    } catch (error) {
      logger.error("Failed to add NPC:", error as Error);
      return null;
    }
  }

  /**
   * Add treasure to scene
   */
  async addTreasure(sceneId: string, treasureData: any): Promise<any> {
    try {
      const tokenId = await this.addToken(sceneId, {
        name: treasureData.name || "Treasure",
        x: treasureData.position?.x || Math.random() * 1000,
        y: treasureData.position?.y || Math.random() * 1000,
        disposition: "NEUTRAL",
        width: 0.5,
        height: 0.5,
      });

      return { id: tokenId, ...treasureData };
    } catch (error) {
      logger.error("Failed to add treasure:", error as Error);
      return null;
    }
  }

  /**
   * Add hazard to scene
   */
  async addHazard(sceneId: string, hazardData: any): Promise<any> {
    try {
      const effect = {
        id: uuidv4(),
        type: "hazard",
        name: hazardData.name,
        position: hazardData.position || { x: Math.random() * 1000, y: Math.random() * 1000 },
        area: hazardData.area || { radius: 10 },
        damage: hazardData.damage || { dice: "1d6", type: "fire" },
        ...hazardData,
      };

      this.activeSpellEffects.set(effect.id, effect);

      // Emit real-time update
      this.emitMapUpdate(sceneId, {
        type: "hazard_added",
        hazard: effect,
        timestamp: Date.now(),
      });

      return effect;
    } catch (error) {
      logger.error("Failed to add hazard:", error as Error);
      return null;
    }
  }

  /**
   * Get combat status for scene
   */
  async getCombatStatus(sceneId: string): Promise<any> {
    try {
      // Basic combat status - would integrate with combat engine
      const scene = await this.getScene(sceneId);
      if (!scene || !scene.tokens) {return null;}

      return {
        inCombat: false,
        round: 0,
        turn: 0,
        order: scene.tokens
          .map((t) => ({
            id: t.id,
            name: (t as any).name || "Unknown",
            initiative: (t as any).initiative || 10,
          }))
          .sort((a, b) => b.initiative - a.initiative),
        current: 0,
        delayed: [],
        surprised: [],
      };
    } catch (error) {
      logger.error("Failed to get combat status:", error as Error);
      return null;
    }
  }

  /**
   * Generate consistent numeric ID from string token ID
   */
  private generateNumericId(tokenId: string): number {
    // Create a consistent hash from the string ID
    let hash = 0;
    for (let i = 0; i < tokenId.length; i++) {
      const char = tokenId.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    // Ensure positive number
    return Math.abs(hash);
  }

  /**
   * Get grid bounds for scene
   */
  private getGridBounds(
    gridSettings: GridSettings,
    sceneWidth: number,
    sceneHeight: number,
  ): {
    cellWidth: number;
    cellHeight: number;
    columns: number;
    rows: number;
    totalWidth: number;
    totalHeight: number;
  } {
    const cellWidth = gridSettings.size || 50;
    const cellHeight = gridSettings.size || 50;
    const columns = Math.ceil(sceneWidth / cellWidth);
    const rows = Math.ceil(sceneHeight / cellHeight);

    return {
      cellWidth,
      cellHeight,
      columns,
      rows,
      totalWidth: columns * cellWidth,
      totalHeight: rows * cellHeight,
    };
  }

  /**
   * Create physics body for spell effect
   */
  async createSpellEffectPhysicsBody(
    sceneId: string,
    spellEffect: any,
    position: { x: number; y: number },
    size?: { width?: number; height?: number; radius?: number },
  ): Promise<number | null> {
    try {
      const bodyConfig = {
        mass: 0, // Static body for spell effects
        position,
        velocity: { x: 0, y: 0 },
        isStatic: true,
        isSensor: true, // Allows overlap detection without collision response
        userData: {
          type: "spell_effect",
          spellId: spellEffect.id,
          effectType: spellEffect.type,
          sceneId,
        },
      };

      // Determine body shape based on spell effect
      let bodyShape;
      if (size?.radius) {
        bodyShape = { type: "circle", radius: size.radius };
      } else {
        bodyShape = {
          type: "rectangle",
          width: size?.width || 50,
          height: size?.height || 50,
        };
      }

      // Create physics body for spell effect
      const numericId = this.generateNumericId(spellEffect.id);
      const physicsBody = new RigidBody(
        numericId,
        position.x,
        position.y,
        size?.width || 50,
        size?.height || 50,
        bodyConfig
      );
      this.physicsWorld.addBody(physicsBody);

      // Store mapping for cleanup
      this.spellEffectPhysicsBodies.set(spellEffect.id, numericId);

        // Emit physics body created event
      this.emitMapUpdate(sceneId, {
        type: "spell_effect_physics_created",
        spellEffectId: spellEffect.id,
        physicsBodyId: numericId,
        position,
        shape: bodyShape,
        timestamp: Date.now(),
      });

      return numericId;
    } catch (error) {
      logger.error("Failed to create spell effect physics body:", error as Error);
      return null;
    }
  }

  /**
   * Update spell effect physics body
   */
  async updateSpellEffectPhysicsBody(
    spellEffectId: string,
    position?: { x: number; y: number },
    size?: { width?: number; height?: number; radius?: number },
  ): Promise<boolean> {
    try {
      const physicsBodyId = this.spellEffectPhysicsBodies.get(spellEffectId);
      if (!physicsBodyId) {return false;}

      const physicsBody = this.physicsWorld.getBody(physicsBodyId);
      if (!physicsBody) {return false;}

      if (position) {
        physicsBody.position.x = position.x;
        physicsBody.position.y = position.y;
      }

      // Update size if changed
      if (size) {
        if (size.width !== undefined) {physicsBody.width = size.width;}
        if (size.height !== undefined) {physicsBody.height = size.height;}
      }

      return true;
    } catch (error) {
      logger.error("Failed to update spell effect physics body:", error as Error);
      return false;
    }
  }

  /**
   * Remove spell effect physics body
   */
  async removeSpellEffectPhysicsBody(spellEffectId: string): Promise<boolean> {
    try {
      const physicsBodyId = this.spellEffectPhysicsBodies.get(spellEffectId);
      if (!physicsBodyId) {return false;}

      const removed = this.physicsWorld.removeBody(physicsBodyId);
      this.spellEffectPhysicsBodies.delete(spellEffectId);
      
      return removed !== null;
    } catch (error) {
      logger.error("Failed to remove spell effect physics body:", error as Error);
      return false;
    }
  }

  /**
   * Check token collisions with spell effects
   */
  async checkTokenSpellCollisions(sceneId: string): Promise<
    Array<{
      tokenId: string;
      spellEffectId: string;
      collision: any;
    }>
  > {
    try {
      const collisions: Array<{
        tokenId: string;
        spellEffectId: string;
        collision: any;
      }> = [];

      const scene = await this.getScene(sceneId);
      if (!scene?.tokens) {return collisions;}

      // Check each token's physics body against spell effect bodies
      for (const token of scene.tokens) {
        const tokenPhysicsId = this.generateNumericId(token.id);
        const tokenPhysicsBody = this.physicsWorld.getBody(tokenPhysicsId);

        if (!tokenPhysicsBody) {continue;}

        // Check collisions with all spell effect bodies
        for (const [spellEffectId, spellBodyId] of this.spellEffectPhysicsBodies) {
          const spellBody = this.physicsWorld.getBody(spellBodyId);
          if (!spellBody) {continue;}

          // Check if bodies are overlapping using AABB
          const tokenAABB = tokenPhysicsBody.getAABB();
          const spellAABB = spellBody.getAABB();
          const overlapping = tokenAABB.minX < spellAABB.maxX && 
                            tokenAABB.maxX > spellAABB.minX &&
                            tokenAABB.minY < spellAABB.maxY && 
                            tokenAABB.maxY > spellAABB.minY;
          
          if (overlapping) {
            collisions.push({
              tokenId: token.id,
              spellEffectId,
              collision: true,
            });
          }
        }
      }

      return collisions;
    } catch (error) {
      logger.error("Failed to check token spell collisions:", error as Error);
      return [];
    }
  }

  /**
   * Apply physics-based spell area calculations
   */
  async calculateSpellAffectedTokens(
    sceneId: string,
    spellPosition: { x: number; y: number },
    spellArea: {
      type: "circle" | "cone" | "rectangle" | "line";
      radius?: number;
      width?: number;
      height?: number;
      length?: number;
      angle?: number;
    },
    casterPosition?: { x: number; y: number },
  ): Promise<string[]> {
    try {
      const scene = await this.getScene(sceneId);
      if (!scene?.tokens) {return [];}

      const affectedTokens: string[] = [];

      for (const token of scene.tokens) {
        const tokenPos = { x: token.x, y: token.y };
        let isAffected = false;

        switch (spellArea.type) {
          case "circle":
            if (spellArea.radius) {
              const distance = Math.sqrt(
                Math.pow(tokenPos.x - spellPosition.x, 2) +
                  Math.pow(tokenPos.y - spellPosition.y, 2),
              );
              isAffected = distance <= spellArea.radius;
            }
            break;

          case "rectangle":
            if (spellArea.width && spellArea.height) {
              const halfWidth = spellArea.width / 2;
              const halfHeight = spellArea.height / 2;
              isAffected =
                tokenPos.x >= spellPosition.x - halfWidth &&
                tokenPos.x <= spellPosition.x + halfWidth &&
                tokenPos.y >= spellPosition.y - halfHeight &&
                tokenPos.y <= spellPosition.y + halfHeight;
            }
            break;

          case "cone":
            if (spellArea.radius && spellArea.angle && casterPosition) {
              const distance = Math.sqrt(
                Math.pow(tokenPos.x - spellPosition.x, 2) +
                  Math.pow(tokenPos.y - spellPosition.y, 2),
              );

              if (distance <= spellArea.radius) {
                const casterToSpell = Math.atan2(
                  spellPosition.y - casterPosition.y,
                  spellPosition.x - casterPosition.x,
                );
                const casterToToken = Math.atan2(
                  tokenPos.y - casterPosition.y,
                  tokenPos.x - casterPosition.x,
                );

                let angleDiff = Math.abs(casterToToken - casterToSpell);
                if (angleDiff > Math.PI) {angleDiff = 2 * Math.PI - angleDiff;}

                isAffected = angleDiff <= (spellArea.angle * Math.PI) / 180 / 2;
              }
            }
            break;

          case "line":
            if (spellArea.length && spellArea.width && casterPosition) {
              // Calculate if token is within line area
              const lineVector = {
                x: spellPosition.x - casterPosition.x,
                y: spellPosition.y - casterPosition.y,
              };
              const lineLength = Math.sqrt(lineVector.x ** 2 + lineVector.y ** 2);

              if (lineLength > 0) {
                const normalizedLine = {
                  x: lineVector.x / lineLength,
                  y: lineVector.y / lineLength,
                };

                const tokenVector = {
                  x: tokenPos.x - casterPosition.x,
                  y: tokenPos.y - casterPosition.y,
                };

                // Project token position onto line
                const projection =
                  normalizedLine.x * tokenVector.x + normalizedLine.y * tokenVector.y;

                if (projection >= 0 && projection <= spellArea.length) {
                  // Calculate perpendicular distance
                  const perpDistance = Math.abs(
                    normalizedLine.y * tokenVector.x - normalizedLine.x * tokenVector.y,
                  );

                  isAffected = perpDistance <= (spellArea.width || 5) / 2;
                }
              }
            }
            break;
        }

        if (isAffected) {
          affectedTokens.push(token.id);
        }
      }

      return affectedTokens;
    } catch (error) {
      logger.error("Failed to calculate spell affected tokens:", error as Error);
      return [];
    }
  }

  /**
   * Update physics for active spell effects
   */
  async updateSpellEffectPhysics(deltaTime: number): Promise<void> {
    try {
      const now = Date.now();
      const expiredEffects: string[] = [];

      // Update each active spell effect
      for (const [effectId, effect] of this.activeSpellEffects) {
        // Check for expiration
        if (effect.expiresAt && now > effect.expiresAt) {
          expiredEffects.push(effectId);
          continue;
        }

        // Update physics-based properties
        if (effect.type === "area_effect" && effect.expanding) {
          const elapsed = now - effect.createdAt;
          const progress = Math.min(1, elapsed / (effect.expansionDuration || 1000));
          const currentRadius =
            effect.initialRadius + (effect.finalRadius - effect.initialRadius) * progress;

          // Update physics body size
          await this.updateSpellEffectPhysicsBody(effectId, undefined, { radius: currentRadius });

          // Update effect data
          effect.currentRadius = currentRadius;

          if (progress >= 1) {
            effect.expanding = false;
          }
        }

        // Update moving spell effects (projectiles, etc.)
        if (effect.velocity && (effect.velocity.x !== 0 || effect.velocity.y !== 0)) {
          const newPosition = {
            x: effect.position.x + effect.velocity.x * deltaTime,
            y: effect.position.y + effect.velocity.y * deltaTime,
          };

          await this.updateSpellEffectPhysicsBody(effectId, newPosition);
          effect.position = newPosition;
        }
      }

      // Clean up expired effects
      for (const effectId of expiredEffects) {
        // this.removeSpellEffect(spellEffectId); // Method not implemented
      }

      // Step physics simulation
      this.physicsWorld.update(deltaTime);

      // Check for collisions after physics step
      const collisions = await this.checkTokenSpellCollisions("current"); // Would need current scene ID

      // Emit collision events
      for (const collision of collisions) {
        this.emitMapUpdate("current", {
          type: "spell_token_collision",
          tokenId: collision.tokenId,
          spellEffectId: collision.spellEffectId,
          collision: collision.collision,
          timestamp: now,
        });
      }
    } catch (error) {
      logger.error("Failed to update spell effect physics:", error as Error);
    }
  }

  /**
   * Start physics update loop for spell effects
   */
  startSpellPhysicsLoop(): void {
    if (this.physicsUpdateInterval) {
      clearInterval(this.physicsUpdateInterval);
    }

    let lastTime = Date.now();

    this.physicsUpdateInterval = setInterval(async () => {
      const currentTime = Date.now();
      const deltaTime = (currentTime - lastTime) / 1000; // Convert to seconds
      lastTime = currentTime;

      await this.updateSpellEffectPhysics(deltaTime);
    }, 16); // ~60 FPS
  }

  /**
   * Stop physics update loop
   */
  stopSpellPhysicsLoop(): void {
    if (this.physicsUpdateInterval) {
      clearInterval(this.physicsUpdateInterval);
      this.physicsUpdateInterval = null;
    }
  }

  /**
   * Integrate with visual effects system
   */
  async createSpellWithVisualEffects(
    sceneId: string,
    spellData: any,
    casterPosition: { x: number; y: number },
    targetPosition?: { x: number; y: number },
  ): Promise<{
    spellEffectId: string;
    physicsBodyId: number | null;
    visualEffectIds: string[];
  }> {
    try {
      // Create spell effect (stubbed for build compatibility)
      const spellEffect = { id: uuidv4(), ...spellData };
      if (!spellEffect) {throw new Error("Failed to create spell effect");}

      // Create physics body
      const physicsBodyId = await this.createSpellEffectPhysicsBody(
        sceneId,
        spellEffect,
        targetPosition || casterPosition,
        spellData.area,
      );

      // Create visual effects (would integrate with PhysicsVisualBridge)
      const visualEffectIds: string[] = [];

      if (this.visualEffectsBridge) {
        const visualIds = this.visualEffectsBridge.createSpellVisualEffect(
          spellData.id,
          spellData.name,
          spellData.school || "evocation",
          casterPosition,
          targetPosition,
        );
        visualEffectIds.push(...visualIds);
      }

      // Emit comprehensive spell creation event
      this.emitMapUpdate(sceneId, {
        type: "spell_with_physics_created",
        spellEffectId: spellEffect.id,
        physicsBodyId,
        visualEffectIds,
        casterPosition,
        targetPosition,
        spellData,
        timestamp: Date.now(),
      });

      return {
        spellEffectId: spellEffect.id,
        physicsBodyId,
        visualEffectIds,
      };
    } catch (error) {
      logger.error("Failed to create spell with visual effects:", error as Error);
      return {
        spellEffectId: "",
        physicsBodyId: null,
        visualEffectIds: [],
      };
    }
  }

  /**
   * Initialize physics integration
   */
  initializePhysicsIntegration(visualEffectsBridge?: any): void {
    this.visualEffectsBridge = visualEffectsBridge;
    this.startSpellPhysicsLoop();

    // Setup physics event handlers
    this.physicsWorld.on("collision", (bodyA: any, bodyB: any, collision: any) => {
      this.handlePhysicsCollision(bodyA, bodyB, collision);
    });

    logger.info("MapService physics integration initialized");
  }

  /**
   * Handle physics collision events
   */
  private async handlePhysicsCollision(bodyA: any, bodyB: any, collision: any): Promise<void> {
    try {
      // Determine collision types
      const typeA = bodyA.userData?.type;
      const typeB = bodyB.userData?.type;

      // Token vs Spell Effect collision
      if (
        (typeA === "token" && typeB === "spell_effect") ||
        (typeA === "spell_effect" && typeB === "token")
      ) {
        const tokenBody = typeA === "token" ? bodyA : bodyB;
        const spellBody = typeA === "spell_effect" ? bodyA : bodyB;

        this.emitMapUpdate(spellBody.userData.sceneId, {
          type: "token_spell_collision",
          tokenId: tokenBody.userData.tokenId,
          spellEffectId: spellBody.userData.spellId,
          collision,
          timestamp: Date.now(),
        });
      }

      // Spell Effect vs Spell Effect collision
      if (typeA === "spell_effect" && typeB === "spell_effect") {
        this.emitMapUpdate(bodyA.userData.sceneId, {
          type: "spell_spell_collision",
          spellEffectAId: bodyA.userData.spellId,
          spellEffectBId: bodyB.userData.spellId,
          collision,
          timestamp: Date.now(),
        });
      }
    } catch (error) {
      logger.error("Failed to handle physics collision:", error as Error);
    }
  }

  /**
   * Get all scenes for a campaign
   */
  async getAllScenes(campaignId?: string): Promise<MapScene[]> {
    try {
      const whereClause = campaignId ? { campaignId } : {};
      const dbScenes = await this.prisma.scene.findMany({
        where: whereClause,
        include: {
          campaign: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      const scenes: MapScene[] = [];
      for (const dbScene of dbScenes) {
        const scene = await this.getScene(dbScene.id);
        if (scene) {
          scenes.push(scene);
        }
      }

      return scenes;
    } catch (error) {
      logger.error("Failed to get all scenes:", error as Error);
      return [];
    }
  }

  /**
   * Convert pixel coordinates to grid coordinates
   */
  pixelToGrid(x: number, y: number, gridSettings: GridSettings): { x: number; y: number } {
    const gridSize = gridSettings.size || 50;
    const offsetX = gridSettings.offsetX || 0;
    const offsetY = gridSettings.offsetY || 0;

    const gridX = Math.floor((x - offsetX) / gridSize);
    const gridY = Math.floor((y - offsetY) / gridSize);

    return { x: gridX, y: gridY };
  }

  /**
   * Convert grid coordinates to pixel coordinates
   */
  gridToPixel(x: number, y: number, gridSettings: GridSettings): { x: number; y: number } {
    const gridSize = gridSettings.size || 50;
    const offsetX = gridSettings.offsetX || 0;
    const offsetY = gridSettings.offsetY || 0;

    const pixelX = x * gridSize + offsetX;
    const pixelY = y * gridSize + offsetY;

    return { x: pixelX, y: pixelY };
  }

  /**
   * Calculate movement path avoiding obstacles
   */
  async getMovementPath(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    obstacles: Array<{ x: number; y: number; width: number; height: number }> = [],
    sceneId?: string
  ): Promise<Array<{ x: number; y: number }>> {
    try {
      // Simple pathfinding - in production would use A* algorithm
      const path: Array<{ x: number; y: number }> = [];
      
      // For now, return direct path with basic obstacle avoidance
      const dx = endX - startX;
      const dy = endY - startY;
      const steps = Math.max(Math.abs(dx), Math.abs(dy));
      
      if (steps === 0) {
        return [{ x: startX, y: startY }];
      }
      
      const stepX = dx / steps;
      const stepY = dy / steps;
      
      for (let i = 0; i <= steps; i++) {
        const x = startX + stepX * i;
        const y = startY + stepY * i;
        
        // Basic collision check
        let blocked = false;
        for (const obstacle of obstacles) {
          if (
            x >= obstacle.x && 
            x <= obstacle.x + obstacle.width &&
            y >= obstacle.y && 
            y <= obstacle.y + obstacle.height
          ) {
            blocked = true;
            break;
          }
        }
        
        if (!blocked) {
          path.push({ x: Math.round(x), y: Math.round(y) });
        }
      }
      
      return path.length > 0 ? path : [{ x: startX, y: startY }, { x: endX, y: endY }];
    } catch (error) {
      logger.error("Failed to calculate movement path:", error as Error);
      return [{ x: startX, y: startY }, { x: endX, y: endY }];
    }
  }

  /**
   * Calculate line of sight between two points
   */
  calculateLineOfSight(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    obstacles: Array<{ x: number; y: number; width: number; height: number }> = []
  ): LineOfSightResult {
    try {
      const dx = toX - fromX;
      const dy = toY - fromY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance === 0) {
        return { visible: true, partialCover: false, totalCover: false };
      }
      
      // Raycast algorithm
      const steps = Math.ceil(distance);
      const stepX = dx / steps;
      const stepY = dy / steps;
      
      const blockedPoints: Array<{ x: number; y: number }> = [];
      
      for (let i = 1; i < steps; i++) {
        const x = fromX + stepX * i;
        const y = fromY + stepY * i;
        
        // Check collision with obstacles
        for (const obstacle of obstacles) {
          if (
            x >= obstacle.x && 
            x <= obstacle.x + obstacle.width &&
            y >= obstacle.y && 
            y <= obstacle.y + obstacle.height
          ) {
            blockedPoints.push({ x: Math.round(x), y: Math.round(y) });
          }
        }
      }
      
      const hasBlockage = blockedPoints.length > 0;
      const partialCover = hasBlockage && blockedPoints.length < steps / 2;
      const totalCover = blockedPoints.length >= steps / 2;
      
      return { 
        visible: !totalCover, 
        blockedBy: hasBlockage ? blockedPoints : undefined,
        partialCover,
        totalCover
      };
    } catch (error) {
      logger.error("Failed to calculate line of sight:", error as Error);
      return { visible: false, partialCover: false, totalCover: true };
    }
  }

  /**
   * Add combatant to initiative order
   */
  async addCombatant(sceneId: string, tokenId: string, name: string, initiative: number): Promise<boolean> {
    try {
      const scene = await this.getScene(sceneId);
      if (!scene) {return false;}
      
      // Get or create combat grid for scene
      let combatGrid = this.combatGrids.get(sceneId);
      if (!combatGrid) {
        combatGrid = {
          sceneId,
          initiative: [],
          currentTurn: 0,
          round: 1,
          phase: 'setup',
          effects: []
        };
        this.combatGrids.set(sceneId, combatGrid);
      }
      
      // Add or update combatant
      const existingIndex = combatGrid.initiative.findIndex(init => init.tokenId === tokenId);
      const combatant: InitiativeEntry = {
        id: uuidv4(),
        tokenId,
        name,
        initiative,
        hasActed: false,
        conditions: []
      };
      
      if (existingIndex >= 0) {
        combatGrid.initiative[existingIndex] = combatant;
      } else {
        combatGrid.initiative.push(combatant);
      }
      
      // Sort by initiative (descending)
      combatGrid.initiative.sort((a, b) => b.initiative - a.initiative);
      
      // Emit update
      this.emitMapUpdate(sceneId, {
        type: "combat_combatant_added",
        sceneId,
        combatant,
        timestamp: Date.now(),
      });
      
      return true;
    } catch (error) {
      logger.error("Failed to add combatant:", error as Error);
      return false;
    }
  }

  /**
   * Advance to next turn in combat
   */
  async nextTurn(sceneId: string): Promise<boolean> {
    try {
      const combatGrid = this.combatGrids.get(sceneId);
      if (!combatGrid || combatGrid.initiative.length === 0) {
        return false;
      }
      
      // Advance turn
      combatGrid.currentTurn++;
      
      // Check if round is complete
      if (combatGrid.currentTurn >= combatGrid.initiative.length) {
        combatGrid.currentTurn = 0;
        combatGrid.round++;
        
        // Reset hasActed flags for new round
        combatGrid.initiative.forEach(init => {
          init.hasActed = false;
        });
      }
      
      // Mark current combatant as having acted
      if (combatGrid.initiative[combatGrid.currentTurn]) {
        combatGrid.initiative[combatGrid.currentTurn].hasActed = true;
      }
      
      // Emit update
      this.emitMapUpdate(sceneId, {
        type: "combat_turn_advanced",
        sceneId,
        currentTurn: combatGrid.currentTurn,
        round: combatGrid.round,
        currentCombatant: combatGrid.initiative[combatGrid.currentTurn],
        timestamp: Date.now(),
      });
      
      return true;
    } catch (error) {
      logger.error("Failed to advance turn:", error as Error);
      return false;
    }
  }

  /**
   * Add grid effect to scene
   */
  async addGridEffect(sceneId: string, effectData: Omit<GridEffect, "id">): Promise<GridEffect | null> {
    try {
      const scene = await this.getScene(sceneId);
      if (!scene) {return null;}
      
      const effect: GridEffect = {
        id: uuidv4(),
        ...effectData
      };
      
      // Store effect (in production would persist to database)
      // For now, emit as real-time update
      this.emitMapUpdate(sceneId, {
        type: "grid_effect_added",
        sceneId,
        effect,
        timestamp: Date.now(),
      });
      
      return effect;
    } catch (error) {
      logger.error("Failed to add grid effect:", error as Error);
      return null;
    }
  }

  /**
   * Add light source to scene
   */
  async addLightSource(sceneId: string, lightData: Omit<LightSource, "id">): Promise<boolean> {
    try {
      const scene = await this.getScene(sceneId);
      if (!scene) {return false;}
      
      const lightSource: LightSource = {
        id: uuidv4(),
        ...lightData
      };
      
      // Add to scene lighting
      scene.lighting.lightSources.push(lightSource);
      
      // Emit update
      this.emitMapUpdate(sceneId, {
        type: "light_source_added",
        sceneId,
        lightSource,
        timestamp: Date.now(),
      });
      
      return true;
    } catch (error) {
      logger.error("Failed to add light source:", error as Error);
      return false;
    }
  }

  /**
   * Update scene with new settings
   */
  async updateScene(sceneId: string, updates: Record<string, any>): Promise<MapScene | null> {
    try {
      const scene = await this.getScene(sceneId);
      if (!scene) {return null;}

      // Update scene in database
      await this.prisma.scene.update({
        where: { id: sceneId },
        data: {
          ...(updates.name && { name: updates.name }),
          ...(updates.grid && {
            // Store grid settings in metadata field if available
            metadata: JSON.stringify({ gridSettings: updates.grid }),
          }),
          ...(updates.lighting && {
            // Store lighting settings in metadata field if available
            metadata: JSON.stringify({
              ...((scene as any).metadata ? JSON.parse((scene as any).metadata) : {}),
              lightingSettings: updates.lighting,
            }),
          }),
          ...(updates.fog && {
            // Store fog settings in metadata field if available
            metadata: JSON.stringify({
              ...((scene as any).metadata ? JSON.parse((scene as any).metadata) : {}),
              fogSettings: updates.fog,
            }),
          }),
          updatedAt: new Date(),
        },
      });

      // Update cached scene
      if (updates.name) {scene.name = updates.name;}
      if (updates.grid) {Object.assign(scene.grid, updates.grid);}
      if (updates.lighting) {Object.assign(scene.lighting, updates.lighting);}
      if (updates.fog) {Object.assign(scene.fog, updates.fog);}

      // Emit real-time update
      this.emitMapUpdate(sceneId, {
        type: "scene_updated",
        sceneId,
        updates,
        timestamp: Date.now(),
      });

      return scene;
    } catch (error) {
      logger.error("Failed to update scene:", error as Error);
      return null;
    }
  }

  /**
   * Remove light source from scene
   */
  async removeLightSource(sceneId: string, lightId: string): Promise<boolean> {
    try {
      const scene = await this.getScene(sceneId);
      if (!scene) {return false;}
      
      // Remove from scene lighting (stored in metadata)
      const lightIndex = scene.lighting.lightSources?.findIndex(light => light.id === lightId);
      if (lightIndex !== undefined && lightIndex >= 0) {
        scene.lighting.lightSources.splice(lightIndex, 1);
      }
      
      // Emit update
      this.emitMapUpdate(sceneId, {
        type: "light_update",
        sceneId,
        lightId,
        action: "removed",
        timestamp: Date.now(),
      });
      
      return true;
    } catch (error) {
      logger.error("Failed to remove light source:", error as Error);
      return false;
    }
  }

  /**
   * Get measurements for scene
   */
  async getMeasurements(sceneId: string): Promise<MeasurementTool[]> {
    try {
      const scene = await this.getScene(sceneId);
      if (!scene) {return [];}
      
      // Return measurements from scene metadata or cache
      const measurements = this.measurements.get(sceneId);
      return Array.isArray(measurements) ? measurements : [];
    } catch (error) {
      logger.error("Failed to get measurements:", error as Error);
      return [];
    }
  }

  /**
   * Initialize combat for scene
   */
  async initializeCombat(sceneId: string): Promise<boolean> {
    try {
      const scene = await this.getScene(sceneId);
      if (!scene) {return false;}
      
      // Create or reset combat grid
      const combatGrid: CombatGrid = {
        sceneId,
        initiative: [],
        currentTurn: 0,
        round: 1,
        phase: 'setup',
        effects: []
      };
      
      this.combatGrids.set(sceneId, combatGrid);
      
      // Emit update
      this.emitMapUpdate(sceneId, {
        type: "combat_initialized",
        sceneId,
        combatGrid,
        timestamp: Date.now(),
      });
      
      return true;
    } catch (error) {
      logger.error("Failed to initialize combat:", error as Error);
      return false;
    }
  }

  /**
   * Cleanup physics integration
   */
  cleanup(): void {
    this.stopSpellPhysicsLoop();

    // Clean up all spell effect physics bodies
    for (const [_spellEffectId, physicsBodyId] of this.spellEffectPhysicsBodies) {
      this.physicsWorld.removeBody(physicsBodyId);
    }
    this.spellEffectPhysicsBodies.clear();

    logger.info("MapService physics integration cleaned up");
  }
}
