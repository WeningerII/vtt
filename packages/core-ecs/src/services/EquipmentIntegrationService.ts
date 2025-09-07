/**
 * Equipment Integration Service
 * Connects equipment effects to ECS components and combat systems
 */

import { EntityId, CombatStore } from "../components/Combat";
import { StatsStore } from "../components/Stats";
import { HealthStore } from "../components/Health";
// TODO: Implement equipment effects system
// import { equipmentEffectsEngine, type Equipment } from "@vtt/equipment-effects";
type Equipment = any;
const equipmentEffectsEngine = {
  processEquipmentEffects: () => ({ stats: {}, effects: [] }),
  initializeCharacterEquipment: (_characterId: string, _equipment: any[]) => {},
  processTriggers: (_characterId: string, _event: string, _character: any, _context: any) => [],
  processWeaponAttack: (_characterId: string, _weaponId: string, _attackType: string, _targetId: string, _context: any) => ({ attackBonus: 0, damageBonus: '0', effects: [] }),
  calculateEquipmentBonuses: (_characterId: string, _character: any) => ({ abilityScores: {}, ac: 0, attackBonus: 0 }),
  applyPassiveEffects: (_characterId: string, _character: any) => {},
  rechargeItems: (_characterId: string, _timeOfDay: string) => {},
  getEquippedItems: (_characterId: string) => []
};

export interface CharacterEquipmentState {
  characterId: string;
  entityId: EntityId;
  equipment: Equipment[];
  lastUpdated: number;
}

export class EquipmentIntegrationService {
  private characterStates = new Map<string, CharacterEquipmentState>();
  private statsStore: StatsStore;
  private healthStore: HealthStore;
  private combatStore: CombatStore;

  constructor(statsStore: StatsStore, healthStore: HealthStore, combatStore: CombatStore) {
    this.statsStore = statsStore;
    this.healthStore = healthStore;
    this.combatStore = combatStore;
  }

  /**
   * Initialize equipment for a character
   */
  initializeCharacterEquipment(
    characterId: string,
    entityId: EntityId,
    equipment: Equipment[],
  ): void {
    const state: CharacterEquipmentState = {
      characterId,
      entityId,
      equipment,
      lastUpdated: Date.now(),
    };

    this.characterStates.set(characterId, state);
    equipmentEffectsEngine.initializeCharacterEquipment(characterId, equipment);

    // Apply initial equipment bonuses
    this.updateCharacterBonuses(characterId);
  }

  /**
   * Update equipment for a character
   */
  updateEquipment(characterId: string, equipment: Equipment[]): void {
    const state = this.characterStates.get(characterId);
    if (!state) {return;}

    state.equipment = equipment;
    state.lastUpdated = Date.now();

    equipmentEffectsEngine.initializeCharacterEquipment(characterId, equipment);
    this.updateCharacterBonuses(characterId);
  }

  /**
   * Equip/unequip an item
   */
  toggleEquipment(characterId: string, itemId: string, equipped: boolean): boolean {
    const state = this.characterStates.get(characterId);
    if (!state) {return false;}

    const item = state.equipment.find((e) => e.id === itemId);
    if (!item) {return false;}

    item.equipped = equipped;
    state.lastUpdated = Date.now();

    this.updateCharacterBonuses(characterId);
    return true;
  }

  /**
   * Attune to a magical item
   */
  attuneToItem(characterId: string, itemId: string): boolean {
    const state = this.characterStates.get(characterId);
    if (!state) {return false;}

    const item = state.equipment.find((e) => e.id === itemId);
    if (!item || !item.requiresAttunement) {return false;}

    // Check attunement limits (typically 3 items)
    const currentlyAttuned = state.equipment.filter((e) => e.attuned).length;
    if (currentlyAttuned >= 3) {return false;}

    item.attuned = true;
    state.lastUpdated = Date.now();

    this.updateCharacterBonuses(characterId);
    return true;
  }

  /**
   * Process equipment triggers during combat events
   */
  processCombatTriggers(characterId: string, event: string, context?: any): any[] {
    const character = this.getCharacterData(characterId);
    if (!character) {return [];}

    return equipmentEffectsEngine.processTriggers(characterId, event, character, context);
  }

  /**
   * Handle weapon attack with equipment bonuses
   */
  processWeaponAttack(
    characterId: string,
    weaponId: string,
    targetId: string,
    context: any,
  ): {
    attackBonus: number;
    damageBonus: string;
    effects: any[];
  } {
    const character = this.getCharacterData(characterId);
    if (!character) {
      return { attackBonus: 0, damageBonus: "", effects: [] };
    }

    return equipmentEffectsEngine.processWeaponAttack(
      characterId,
      weaponId,
      character,
      targetId,
      context,
    );
  }

  /**
   * Apply equipment bonuses to character stats
   */
  private updateCharacterBonuses(characterId: string): void {
    const state = this.characterStates.get(characterId);
    if (!state) {return;}

    const character = this.getCharacterData(characterId);
    if (!character) {return;}

    // Calculate equipment bonuses
    const bonuses = equipmentEffectsEngine.calculateEquipmentBonuses(characterId, character);

    // Apply bonuses to ECS components
    const statsData = this.statsStore.get(state.entityId);
    if (statsData) {
      // Update ability scores with equipment bonuses
      Object.entries(bonuses.abilityScores).forEach(([ability, bonus]) => {
        if (bonus !== 0) {
          const abilityValue = statsData.abilities[ability as keyof typeof statsData.abilities];
          if (typeof abilityValue === 'number' && typeof bonus === 'number') {
            (statsData.abilities as any)[ability] = abilityValue + bonus;
          }
        }
      });

      // Update other stats
      statsData.armorClass += bonuses.ac;
      statsData.proficiencyBonus += bonuses.attackBonus; // Simplified for now
    }

    // Apply passive equipment effects
    equipmentEffectsEngine.applyPassiveEffects(characterId, character);
  }

  /**
   * Get character data for equipment calculations
   */
  private getCharacterData(characterId: string): any {
    const state = this.characterStates.get(characterId);
    if (!state) {return null;}

    const statsData = this.statsStore.get(state.entityId);
    const healthData = this.healthStore.get(state.entityId);
    const combatData = this.combatStore.get(state.entityId);

    if (!statsData || !healthData) {return null;}

    return {
      id: characterId,
      entityId: state.entityId,
      hitPoints: {
        current: (healthData as any).currentHitPoints || healthData.current || 0,
        max: (healthData as any).maxHitPoints || healthData.max || 0,
        temporary: (healthData as any).temporaryHitPoints || healthData.temporary || 0,
      },
      abilities: statsData.abilities,
      armorClass: statsData.armorClass,
      proficiencyBonus: statsData.proficiencyBonus,
      level: statsData.level || 1,
      class: (statsData as any).characterClass || 'Unknown',
      alignment: (statsData as any).alignment || 'Neutral',
      initiative: combatData?.initiative || 0,
      isInCombat: combatData?.isActive || false,
    };
  }

  /**
   * Recharge magic items at specified times
   */
  rechargeItems(characterId: string, timeOfDay: "dawn" | "dusk" | "midnight"): void {
    equipmentEffectsEngine.rechargeItems(characterId, timeOfDay);

    const state = this.characterStates.get(characterId);
    if (state) {
      state.lastUpdated = Date.now();
    }
  }

  /**
   * Get equipped items for a character
   */
  getEquippedItems(characterId: string): Equipment[] {
    return equipmentEffectsEngine.getEquippedItems(characterId);
  }

  /**
   * Get all equipment for a character
   */
  getAllEquipment(characterId: string): Equipment[] {
    const state = this.characterStates.get(characterId);
    return state ? [...state.equipment] : [];
  }
}
