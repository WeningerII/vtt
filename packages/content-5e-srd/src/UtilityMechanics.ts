/**
 * Interactive Utility Mechanics for Cantrips
 * Handles complex interactive behaviors for utility spells like Mage Hand, Dancing Lights, etc.
 */

import { EventEmitter } from 'events';

export interface UtilitySpellEntity {
  id: string;
  spellId: string;
  casterId: string;
  type: 'spectral_hand' | 'dancing_lights' | 'minor_illusion' | 'light_source';
  position: { x: number; y: number };
  properties: Record<string, any>;
  duration: number;
  expiresAt: number;
  commands: string[];
}

export interface InteractionCommand {
  entityId: string;
  command: string;
  parameters: Record<string, any>;
  casterId: string;
}

export class UtilityMechanics extends EventEmitter {
  private activeEntities: Map<string, UtilitySpellEntity> = new Map();
  private entitysByType: Map<string, Set<string>> = new Map();
  private entitiesByCaster: Map<string, Set<string>> = new Map();

  constructor() {
    super();
    this.setupCleanupInterval();
  }

  /**
   * Create a utility spell entity (Mage Hand, Dancing Lights, etc.)
   */
  createUtilityEntity(entity: Omit<UtilitySpellEntity, 'expiresAt'>): string {
    const fullEntity: UtilitySpellEntity = {
      ...entity,
      expiresAt: Date.now() + entity.duration
    };

    this.activeEntities.set(entity.id, fullEntity);

    // Index by type
    if (!this.entitysByType.has(entity.type)) {
      this.entitysByType.set(entity.type, new Set());
    }
    this.entitysByType.get(entity.type)!.add(entity.id);

    // Index by caster
    if (!this.entitiesByCaster.has(entity.casterId)) {
      this.entitiesByCaster.set(entity.casterId, new Set());
    }
    this.entitiesByCaster.get(entity.casterId)!.add(entity.id);

    this.emit('entityCreated', fullEntity);
    return entity.id;
  }

  /**
   * Execute a command on a utility entity
   */
  async executeCommand(command: InteractionCommand): Promise<{ success: boolean; result?: any; error?: string }> {
    const entity = this.activeEntities.get(command.entityId);
    if (!entity) {
      return { success: false, error: 'Entity not found' };
    }

    if (entity.casterId !== command.casterId) {
      return { success: false, error: 'Not authorized to control this entity' };
    }

    if (!entity.commands.includes(command.command)) {
      return { success: false, error: 'Command not supported by this entity' };
    }

    try {
      const result = await this.handleCommand(entity, command);
      this.emit('commandExecuted', entity, command, result);
      return { success: true, result };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Command failed' };
    }
  }

  /**
   * Handle specific commands for different entity types
   */
  private async handleCommand(entity: UtilitySpellEntity, command: InteractionCommand): Promise<any> {
    switch (entity.type) {
      case 'spectral_hand':
        return this.handleMageHandCommand(entity, command);
      case 'dancing_lights':
        return this.handleDancingLightsCommand(entity, command);
      case 'minor_illusion':
        return this.handleMinorIllusionCommand(entity, command);
      case 'light_source':
        return this.handleLightSourceCommand(entity, command);
      default:
        throw new Error('Unknown entity type');
    }
  }

  /**
   * Handle Mage Hand commands
   */
  private async handleMageHandCommand(entity: UtilitySpellEntity, command: InteractionCommand): Promise<any> {
    const { command: cmd,  parameters  } = command;

    switch (cmd) {
      case 'move': {
        const newPosition = parameters.position;
        const distance = Math.sqrt(
          Math.pow(newPosition.x - entity.position.x, 2) + 
          Math.pow(newPosition.y - entity.position.y, 2)
        );

        if (distance > entity.properties.movementSpeed) {
          throw new Error('Movement exceeds speed limit');
        }

        entity.position = newPosition;
        this.emit('entityMoved', entity, newPosition);
        return { position: newPosition };

    }
      case 'manipulate': {
        const targetId = parameters.targetId;
        const action = parameters.action; // 'open', 'close', 'pull', 'push'
        
        // Check weight limit and restrictions
        if (parameters.weight && parameters.weight > entity.properties.weightLimit) {
          throw new Error('Object too heavy for Mage Hand');
        }

        this.emit('objectManipulated', {
          handId: entity.id,
          targetId,
          action,
          success: true
        });

        return { action, targetId, success: true };

    }
      case 'carry': {
        const objectId = parameters.objectId;
        const destination = parameters.destination;

        if (parameters.weight > entity.properties.weightLimit) {
          throw new Error('Object too heavy');
        }

        this.emit('objectCarried', {
          handId: entity.id,
          objectId,
          from: entity.position,
          to: destination
        });

        entity.position = destination;
        return { carried: objectId, to: destination };

    }
      case 'activate_object': {
        const activateTargetId = parameters.targetId;
        
        this.emit('objectActivated', {
          handId: entity.id,
          targetId: activateTargetId,
          activationType: parameters.activationType
        });

        return { activated: activateTargetId };

    }
      default:
        throw new Error(`Unknown Mage Hand command: ${cmd}`);
    }
  }

  /**
   * Handle Dancing Lights commands
   */
  private async handleDancingLightsCommand(entity: UtilitySpellEntity, command: InteractionCommand): Promise<any> {
    const { command: cmd,  parameters  } = command;

    switch (cmd) {
      case 'move_lights': {
        const lightPositions = parameters.positions;
        if (lightPositions.length > 4) {
          throw new Error('Cannot have more than 4 dancing lights');
        }

        entity.properties.lightPositions = lightPositions;
        this.emit('lightsRepositioned', entity, lightPositions);
        return { positions: lightPositions };

    }
      case 'combine_lights': {
        // Combine lights into a single brighter light
        const combinedPosition = parameters.position;
        entity.properties.combined = true;
        entity.properties.lightPositions = [combinedPosition];
        entity.properties.brightness = 40; // Brighter when combined

        this.emit('lightsCombined', entity, combinedPosition);
        return { combined: true, position: combinedPosition };

    }
      case 'separate_lights': {
        // Separate back into individual lights
        const separatePositions = parameters.positions || [
          { x: entity.position.x, y: entity.position.y },
          { x: entity.position.x + 5, y: entity.position.y },
          { x: entity.position.x, y: entity.position.y + 5 },
          { x: entity.position.x + 5, y: entity.position.y + 5 }
        ];

        entity.properties.combined = false;
        entity.properties.lightPositions = separatePositions;
        entity.properties.brightness = 10; // Normal brightness

        this.emit('lightsSeparated', entity, separatePositions);
        return { separated: true, positions: separatePositions };

    }
      default:
        throw new Error(`Unknown Dancing Lights command: ${cmd}`);
    }
  }

  /**
   * Handle Minor Illusion commands
   */
  private async handleMinorIllusionCommand(entity: UtilitySpellEntity, command: InteractionCommand): Promise<any> {
    const { command: cmd,  parameters  } = command;

    switch (cmd) {
      case 'change_sound':
        if (entity.properties.type !== 'sound') {
          throw new Error('This illusion is not a sound');
        }

        entity.properties.soundDescription = parameters.soundDescription;
        entity.properties.volume = parameters.volume || 'normal';

        this.emit('illusionSoundChanged', entity, parameters.soundDescription);
        return { soundChanged: true };

      case 'investigation_check': {
        const investigatorId = parameters.investigatorId;
        const checkResult = parameters.checkResult;
        const dc = entity.properties.detectableDC || 13;

        const detected = checkResult >= dc;
        
        this.emit('illusionInvestigated', {
          entityId: entity.id,
          investigatorId,
          detected,
          checkResult,
          dc
        });

        return { detected, checkResult, dc };

    }
      default:
        throw new Error(`Unknown Minor Illusion command: ${cmd}`);
    }
  }

  /**
   * Handle Light Source commands
   */
  private async handleLightSourceCommand(entity: UtilitySpellEntity, command: InteractionCommand): Promise<any> {
    const { command: cmd,  parameters  } = command;

    switch (cmd) {
      case 'cover_light':
        entity.properties.covered = parameters.covered;
        
        this.emit('lightCovered', entity, parameters.covered);
        return { covered: parameters.covered };

      case 'change_color':
        entity.properties.color = parameters.color;
        
        this.emit('lightColorChanged', entity, parameters.color);
        return { color: parameters.color };

      default:
        throw new Error(`Unknown Light Source command: ${cmd}`);
    }
  }

  /**
   * Get all entities controlled by a caster
   */
  getEntitiesByCaster(casterId: string): UtilitySpellEntity[] {
    const entityIds = this.entitiesByCaster.get(casterId) || new Set();
    return Array.from(entityIds)
      .map(id => this.activeEntities.get(id))
      .filter(entity => entity !== undefined) as UtilitySpellEntity[];
  }

  /**
   * Get entities by type
   */
  getEntitiesByType(type: string): UtilitySpellEntity[] {
    const entityIds = this.entitysByType.get(type) || new Set();
    return Array.from(entityIds)
      .map(id => this.activeEntities.get(id))
      .filter(entity => entity !== undefined) as UtilitySpellEntity[];
  }

  /**
   * Get specific entity
   */
  getEntity(entityId: string): UtilitySpellEntity | undefined {
    return this.activeEntities.get(entityId);
  }

  /**
   * Remove entity (spell ends, dispelled, etc.)
   */
  removeEntity(entityId: string): boolean {
    const entity = this.activeEntities.get(entityId);
    if (!entity) return false;

    // Remove from indexes
    this.entitysByType.get(entity.type)?.delete(entityId);
    this.entitiesByCaster.get(entity.casterId)?.delete(entityId);
    this.activeEntities.delete(entityId);

    this.emit('entityRemoved', entity);
    return true;
  }

  /**
   * Clean up expired entities
   */
  private cleanupExpiredEntities(): void {
    const now = Date.now();
    const expiredEntities: string[] = [];

    for (const [id, entity] of this.activeEntities.entries()) {
      if (now > entity.expiresAt) {
        expiredEntities.push(id);
      }
    }

    for (const id of expiredEntities) {
      this.removeEntity(id);
    }
  }

  /**
   * Setup cleanup interval
   */
  private setupCleanupInterval(): void {
    setInterval(() => {
      this.cleanupExpiredEntities();
    }, 5000); // Check every 5 seconds
  }

  /**
   * Extend entity duration (concentration maintained, etc.)
   */
  extendDuration(entityId: string, additionalTime: number): boolean {
    const entity = this.activeEntities.get(entityId);
    if (!entity) return false;

    entity.expiresAt += additionalTime;
    this.emit('durationExtended', entity, additionalTime);
    return true;
  }

  /**
   * Check if position is within range of caster
   */
  isWithinRange(casterId: string, position: { x: number; y: number }, maxRange: number): boolean {
    // This would integrate with the actual game map to get caster position
    // For now, assume we can get caster position somehow
    const casterPosition = this.getCasterPosition(casterId);
    if (!casterPosition) return false;

    const distance = Math.sqrt(
      Math.pow(position.x - casterPosition.x, 2) + 
      Math.pow(position.y - casterPosition.y, 2)
    );

    return distance <= maxRange;
  }

  /**
   * Get caster position (would integrate with map/token system)
   */
  private getCasterPosition(_casterId: string): { x: number; y: number } | null {
    // This would query the map service for the caster's token position
    // For now, return null to indicate we need map integration
    return null;
  }

  /**
   * Handle Prestidigitation effects
   */
  async handlePrestidigitationEffect(effect: {
    type: string;
    caster: string;
    target?: string;
    position: { x: number; y: number };
    parameters: Record<string, any>;
  }): Promise<{ success: boolean; result?: any; error?: string }> {
    switch (effect.type) {
      case 'light_fire':
        this.emit('environmentalChange', {
          type: 'ignite_fire',
          position: effect.position,
          size: 'small',
          duration: effect.parameters.duration || 3600000
        });
        return { success: true, result: { fireIgnited: true } };

      case 'clean_object':
        this.emit('objectStateChange', {
          type: 'clean',
          targetId: effect.target,
          area: effect.parameters.area || { volume: 1 }
        });
        return { success: true, result: { cleaned: effect.target } };

      case 'flavor_food':
        this.emit('objectPropertyChange', {
          type: 'alter_taste_temperature',
          targetId: effect.target,
          properties: effect.parameters.properties
        });
        return { success: true, result: { flavored: effect.target } };

      case 'sensory_effect':
        this.emit('sensoryEffect', {
          type: effect.parameters.sensoryType || 'harmless_effect',
          position: effect.position,
          duration: effect.parameters.duration || 3600000
        });
        return { success: true, result: { effectCreated: true } };

      default:
        return { success: false, error: 'Unknown prestidigitation effect' };
    }
  }

  /**
   * Handle Mending repair
   */
  async handleMendingRepair(repair: {
    caster: string;
    targetId: string;
    repairType: string;
  }): Promise<{ success: boolean; result?: any; error?: string }> {
    // Check if target is repairable
    this.emit('objectRepair', {
      targetId: repair.targetId,
      repairType: repair.repairType,
      casterId: repair.caster,
      restrictions: ['cosmetic_only', 'no_functionality_restore']
    });

    return { 
      success: true, 
      result: { 
        repaired: repair.targetId,
        type: repair.repairType 
      } 
    };
  }

  /**
   * Get all active utility entities (for debugging/admin)
   */
  getAllActiveEntities(): UtilitySpellEntity[] {
    return Array.from(this.activeEntities.values());
  }
}

export const _utilityMechanics = new UtilityMechanics();
