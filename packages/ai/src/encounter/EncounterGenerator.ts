import { EventEmitter } from 'events';
import { logger } from '@vtt/logging';

export interface EncounterParameters {
  partyLevel: number;
  partySize: number;
  difficulty: 'easy' | 'medium' | 'hard' | 'deadly';
  environment: 'dungeon' | 'wilderness' | 'urban' | 'aquatic' | 'aerial' | 'planar';
  theme?: 'combat' | 'exploration' | 'social' | 'puzzle' | 'mixed';
  duration?: 'short' | 'medium' | 'long';
  constraints?: {
    noUndead?: boolean;
    noBeasts?: boolean;
    maxCR?: number;
    requiredTypes?: string[];
    forbiddenTypes?: string[];
  };
}

export interface GeneratedEncounter {
  id: string;
  name: string;
  description: string;
  difficulty: string;
  estimatedDuration: number; // minutes
  xpBudget: number;
  xpAwarded: number;
  
  // Creatures
  creatures: EncounterCreature[];
  
  // Environment
  environment: {
    type: string;
    description: string;
    terrain: string[];
    lighting: 'bright' | 'dim' | 'darkness';
    weather?: string;
    temperature?: string;
  };
  
  // Tactical elements
  tactics: {
    setup: string;
    objectives: string[];
    complications?: string[];
    terrain_features: TerrainFeature[];
  };
  
  // Rewards
  rewards: {
    treasure?: TreasureReward[];
    experience: number;
    story?: string[];
  };
  
  // Scaling options
  scaling: {
    easier: string[];
    harder: string[];
  };
  
  createdAt: Date;
}

export interface EncounterCreature {
  id: string;
  name: string;
  cr: number;
  type: string;
  size: string;
  alignment: string;
  hitPoints: number;
  armorClass: number;
  speed: string;
  abilities: {
    strength: number;
    dexterity: number;
    constitution: number;
    intelligence: number;
    wisdom: number;
    charisma: number;
  };
  quantity: number;
  role: 'minion' | 'soldier' | 'elite' | 'boss' | 'legendary';
  tactics: string;
  motivation: string;
  position?: { x: number; y: number };
}

export interface TerrainFeature {
  id: string;
  name: string;
  type: 'cover' | 'difficult_terrain' | 'hazard' | 'interactive' | 'elevation';
  description: string;
  position: { x: number; y: number; width: number; height: number };
  effects: string[];
}

export interface TreasureReward {
  type: 'coins' | 'gems' | 'art' | 'magic_item' | 'mundane_item';
  name: string;
  value: number;
  rarity?: 'common' | 'uncommon' | 'rare' | 'very_rare' | 'legendary' | 'artifact';
  description: string;
}

export class EncounterGenerator extends EventEmitter {
  private creaturesDatabase: Map<string, EncounterCreature> = new Map();
  private encounterTemplates: Map<string, any> = new Map();
  private treasureTable: Map<string, TreasureReward[]> = new Map();

  constructor() {
    super();
    this.setMaxListeners(100);
    this.initializeDatabase();
  }

  /**
   * Generate a complete encounter based on parameters
   */
  async generateEncounter(params: EncounterParameters): Promise<GeneratedEncounter> {
    logger.info(`Generating encounter: Level ${params.partyLevel}, Size ${params.partySize}, ${params.difficulty}`);

    const xpBudget = this.calculateXPBudget(params.partyLevel, params.partySize, params.difficulty);
    const creatures = await this.selectCreatures(params, xpBudget);
    const environment = this.generateEnvironment(params.environment);
    const tactics = this.generateTactics(creatures, environment);
    const rewards = this.generateRewards(params, xpBudget);
    const scaling = this.generateScalingOptions(params, creatures);

    const encounter: GeneratedEncounter = {
      id: this.generateEncounterId(),
      name: this.generateEncounterName(creatures, environment),
      description: this.generateEncounterDescription(creatures, environment, tactics),
      difficulty: params.difficulty,
      estimatedDuration: this.estimateDuration(params, creatures.length),
      xpBudget,
      xpAwarded: creatures.reduce((sum, c) => sum + this.getCreatureXP(c.cr) * c.quantity, 0),
      creatures,
      environment,
      tactics,
      rewards,
      scaling,
      createdAt: new Date(),
    };

    this.emit('encounterGenerated', encounter);
    return encounter;
  }

  /**
   * Generate multiple encounter variants
   */
  async generateEncounterVariants(params: EncounterParameters, count: number = 3): Promise<GeneratedEncounter[]> {
    const variants: GeneratedEncounter[] = [];
    
    for (let i = 0; i < count; i++) {
      // Slightly vary parameters for each variant
      const variantParams = { ...params };
      
      if (i === 1) {
        // More combat-focused variant
        variantParams.theme = 'combat';
      } else if (i === 2) {
        // More tactical variant with terrain
        variantParams.environment = this.getRandomEnvironment() as any;
      }
      
      const encounter = await this.generateEncounter(variantParams);
      variants.push(encounter);
    }
    
    return variants;
  }

  /**
   * Adjust encounter difficulty dynamically
   */
  adjustEncounterDifficulty(
    encounter: GeneratedEncounter,
    newDifficulty: 'easy' | 'medium' | 'hard' | 'deadly'
  ): GeneratedEncounter {
    const adjustedEncounter = { ...encounter };
    const difficultyMultipliers = { easy: 0.5, medium: 1.0, hard: 1.5, deadly: 2.0 };
    const currentMultiplier = difficultyMultipliers[encounter.difficulty as keyof typeof difficultyMultipliers];
    const newMultiplier = difficultyMultipliers[newDifficulty];
    const scaleFactor = newMultiplier / currentMultiplier;

    // Adjust creature quantities or add/remove creatures
    if (scaleFactor > 1.2) {
      // Make harder - add creatures or increase quantities
      adjustedEncounter.creatures = adjustedEncounter.creatures.map(creature => ({
        ...creature,
        quantity: Math.ceil(creature.quantity * scaleFactor),
      }));
    } else if (scaleFactor < 0.8) {
      // Make easier - reduce quantities or remove creatures
      adjustedEncounter.creatures = adjustedEncounter.creatures
        .map(creature => ({
          ...creature,
          quantity: Math.max(1, Math.floor(creature.quantity * scaleFactor)),
        }))
        .filter(creature => creature.quantity > 0);
    }

    adjustedEncounter.difficulty = newDifficulty;
    adjustedEncounter.xpAwarded = adjustedEncounter.creatures.reduce(
      (sum, c) => sum + this.getCreatureXP(c.cr) * c.quantity, 0
    );

    return adjustedEncounter;
  }

  /**
   * Generate random encounter for exploration
   */
  async generateRandomEncounter(environment: string, partyLevel: number): Promise<GeneratedEncounter | null> {
    const randomTable = this.getRandomEncounterTable(environment, partyLevel);
    
    if (!randomTable || randomTable.length === 0) {
      return null;
    }

    const roll = Math.random();
    let cumulativeProbability = 0;
    
    for (const entry of randomTable) {
      cumulativeProbability += entry.probability;
      if (roll <= cumulativeProbability) {
        return this.generateEncounter({
          partyLevel,
          partySize: 4, // Default party size
          difficulty: entry.difficulty,
          environment: environment as any,
          theme: entry.theme,
        });
      }
    }

    return null;
  }

  private calculateXPBudget(partyLevel: number, partySize: number, difficulty: string): number {
    const baseXP = [25, 50, 75, 125, 250, 300, 350, 450, 550, 600, 800, 1000, 1100, 1250, 1400, 1600, 2000, 2100, 2400, 2800];
    const multipliers = { easy: 1, medium: 1.5, hard: 2, deadly: 3 };
    
    const levelIndex = Math.min(partyLevel - 1, baseXP.length - 1);
    const baseXPPerCharacter = baseXP[levelIndex] || 25;
    const difficultyMultiplier = multipliers[difficulty as keyof typeof multipliers];
    
    return baseXPPerCharacter * partySize * difficultyMultiplier;
  }

  private async selectCreatures(params: EncounterParameters, xpBudget: number): Promise<EncounterCreature[]> {
    const availableCreatures = this.filterCreaturesByConstraints(params);
    const selectedCreatures: EncounterCreature[] = [];
    let remainingBudget = xpBudget;

    // Strategy: Select a mix of creature roles
    const roleDistribution = this.getRoleDistribution(params.difficulty);
    
    for (const [role, percentage] of Object.entries(roleDistribution)) {
      const roleBudget = xpBudget * percentage;
      const creature = availableCreatures[0];
      if (!creature) {continue;}
      
      if (creature) {
        const selected = this.selectCreaturesForRole([creature], roleBudget, params.partyLevel);
        selectedCreatures.push(...selected);
        remainingBudget -= selected.reduce((sum, c) => sum + this.getCreatureXP(c.cr) * c.quantity, 0);
      }
    }

    // Fill remaining budget with appropriate creatures
    if (remainingBudget > 0) {
      const fillerCreatures = this.selectFillerCreatures(availableCreatures, remainingBudget, params.partyLevel);
      selectedCreatures.push(...fillerCreatures);
    }

    return selectedCreatures.length > 0 ? selectedCreatures : this.getDefaultCreatures(params);
  }

  private filterCreaturesByConstraints(params: EncounterParameters): EncounterCreature[] {
    return Array.from(this.creaturesDatabase.values()).filter(creature => {
      if (params.constraints?.maxCR && creature.cr > params.constraints.maxCR) {
        return false;
      }
      if (params.constraints?.noUndead && creature.type === 'undead') {
        return false;
      }
      if (params.constraints?.noBeasts && creature.type === 'beast') {
        return false;
      }
      if (params.constraints?.requiredTypes && !params.constraints.requiredTypes.includes(creature.type)) {
        return false;
      }
      if (params.constraints?.forbiddenTypes && params.constraints.forbiddenTypes.includes(creature.type)) {
        return false;
      }
      
      // CR should be appropriate for party level
      const maxCR = Math.max(1, params.partyLevel + 2);
      return creature.cr <= maxCR;
    });
  }

  private generateEnvironment(environmentType: string): GeneratedEncounter['environment'] {
    const environments = {
      dungeon: {
        type: 'dungeon',
        description: 'A dark, confined underground space with stone walls and limited visibility.',
        terrain: ['stone floor', 'narrow corridors', 'chambers'],
        lighting: 'dim' as const,
      },
      wilderness: {
        type: 'wilderness',
        description: 'An open natural area with varied terrain and weather conditions.',
        terrain: ['grass', 'trees', 'rocks', 'streams'],
        lighting: 'bright' as const,
        weather: 'clear',
      },
      urban: {
        type: 'urban',
        description: 'A populated area with buildings, streets, and civilian activity.',
        terrain: ['cobblestone', 'buildings', 'alleys'],
        lighting: 'bright' as const,
      },
    };

    return environments[environmentType as keyof typeof environments] || environments.wilderness;
  }

  private generateTactics(creatures: EncounterCreature[], environment: any): GeneratedEncounter['tactics'] {
    const terrainFeatures = this.generateTerrainFeatures(environment);
    
    return {
      setup: this.generateTacticalSetup(creatures, environment),
      objectives: this.generateObjectives(creatures),
      complications: this.generateComplications(environment),
      terrain_features: terrainFeatures,
    };
  }

  private generateRewards(params: EncounterParameters, xpBudget: number): GeneratedEncounter['rewards'] {
    const treasureLevel = Math.floor(params.partyLevel / 4) + 1;
    const treasure = this.generateTreasure(treasureLevel, xpBudget);
    
    return {
      treasure,
      experience: xpBudget,
      story: this.generateStoryRewards(params),
    };
  }

  private generateScalingOptions(params: EncounterParameters, creatures: EncounterCreature[]): GeneratedEncounter['scaling'] {
    return {
      easier: [
        'Remove one creature from each group',
        'Reduce creature hit points by 25%',
        'Add environmental advantages for players',
      ],
      harder: [
        'Add reinforcements after 3 rounds',
        'Increase creature damage by 50%',
        'Add environmental hazards',
      ],
    };
  }

  private initializeDatabase(): void {
    // Initialize with sample creatures
    const sampleCreatures: EncounterCreature[] = [
      {
        id: 'goblin',
        name: 'Goblin',
        cr: 0.25,
        type: 'humanoid',
        size: 'small',
        alignment: 'neutral evil',
        hitPoints: 7,
        armorClass: 15,
        speed: '30 ft',
        abilities: { strength: 8, dexterity: 14, constitution: 10, intelligence: 10, wisdom: 8, charisma: 8 },
        quantity: 1,
        role: 'minion',
        tactics: 'Uses ranged attacks and seeks cover',
        motivation: 'Territorial defense',
      },
      {
        id: 'orc',
        name: 'Orc',
        cr: 1,
        type: 'humanoid',
        size: 'medium',
        alignment: 'chaotic evil',
        hitPoints: 15,
        armorClass: 13,
        speed: '30 ft',
        abilities: { strength: 16, dexterity: 12, constitution: 16, intelligence: 7, wisdom: 11, charisma: 10 },
        quantity: 1,
        role: 'soldier',
        tactics: 'Charges into melee combat',
        motivation: 'Raiding and pillaging',
      },
      {
        id: 'owlbear',
        name: 'Owlbear',
        cr: 3,
        type: 'monstrosity',
        size: 'large',
        alignment: 'unaligned',
        hitPoints: 59,
        armorClass: 13,
        speed: '40 ft',
        abilities: { strength: 20, dexterity: 12, constitution: 17, intelligence: 3, wisdom: 12, charisma: 7 },
        quantity: 1,
        role: 'elite',
        tactics: 'Aggressive melee attacker with keen sight',
        motivation: 'Territorial predator',
      },
    ];

    sampleCreatures.forEach(creature => {
      this.creaturesDatabase.set(creature.id, creature);
    });

    logger.info(`Initialized creature database with ${sampleCreatures.length} creatures`);
  }

  private getCreatureXP(cr: number): number {
    const xpTable: { [key: number]: number } = {
      0: 10, 0.125: 25, 0.25: 50, 0.5: 100,
      1: 200, 2: 450, 3: 700, 4: 1100, 5: 1800,
      6: 2300, 7: 2900, 8: 3900, 9: 5000, 10: 5900,
    };
    return xpTable[cr] || 100;
  }

  private getRoleDistribution(difficulty: string): { [role: string]: number } {
    const distributions = {
      easy: { minion: 0.6, soldier: 0.3, elite: 0.1, boss: 0 },
      medium: { minion: 0.4, soldier: 0.4, elite: 0.2, boss: 0 },
      hard: { minion: 0.3, soldier: 0.3, elite: 0.3, boss: 0.1 },
      deadly: { minion: 0.2, soldier: 0.2, elite: 0.4, boss: 0.2 },
    };
    return distributions[difficulty as keyof typeof distributions] || distributions.medium;
  }

  private selectCreaturesForRole(creatures: EncounterCreature[], budget: number, partyLevel: number): EncounterCreature[] {
    const selected: EncounterCreature[] = [];
    let remainingBudget = budget;

    while (remainingBudget > 0 && creatures.length > 0) {
      const creature = creatures[Math.floor(Math.random() * creatures.length)];
      if (!creature) {break;}
      
      const creatureXP = this.getCreatureXP(creature.cr || 1);
      
      if (creatureXP <= remainingBudget) {
        const quantity = Math.floor(remainingBudget / creatureXP);
        selected.push({ 
          id: creature.id || `creature-${selected.length}`,
          name: creature.name || 'Unknown Creature',
          cr: creature.cr || 1,
          type: creature.type || 'beast',
          size: creature.size || 'medium',
          alignment: creature.alignment || 'neutral',
          hitPoints: creature.hitPoints || 10,
          armorClass: creature.armorClass || 10,
          speed: creature.speed || '30 ft',
          abilities: creature.abilities || {
            strength: 10,
            dexterity: 10,
            constitution: 10,
            intelligence: 10,
            wisdom: 10,
            charisma: 10
          },
          role: creature.role || 'minion',
          tactics: creature.tactics || 'aggressive',
          motivation: creature.motivation || 'territorial',
          quantity: Math.min(quantity, 8)
        });
        remainingBudget -= creatureXP * quantity;
      }
      
      break; // Prevent infinite loop
    }

    return selected;
  }

  private selectFillerCreatures(creatures: EncounterCreature[], budget: number, partyLevel: number): EncounterCreature[] {
    // Simple filler selection - would be more sophisticated in practice
    return [];
  }

  private getDefaultCreatures(params: EncounterParameters): EncounterCreature[] {
    // Return default creatures if generation fails
    return [this.creaturesDatabase.get('goblin')!];
  }

  private generateTerrainFeatures(environment: any): TerrainFeature[] {
    const features: TerrainFeature[] = [];
    
    // Generate 2-4 terrain features
    const count = Math.floor(Math.random() * 3) + 2;
    
    for (let i = 0; i < count; i++) {
      features.push({
        id: `terrain_${i}`,
        name: 'Rock Outcropping',
        type: 'cover',
        description: 'A large rock that provides half cover',
        position: { x: Math.random() * 30, y: Math.random() * 30, width: 5, height: 5 },
        effects: ['Half cover to creatures behind it'],
      });
    }
    
    return features;
  }

  private generateEncounterName(creatures: EncounterCreature[], environment: any): string {
    const creatureNames = creatures.map(c => c.name).join(' and ');
    return `${creatureNames} in the ${environment.type}`;
  }

  private generateEncounterDescription(creatures: EncounterCreature[], environment: any, tactics: any): string {
    return `A ${environment.description.toLowerCase()} where ${creatures.length} different types of creatures have made their lair. ${tactics.setup}`;
  }

  private estimateDuration(params: EncounterParameters, creatureCount: number): number {
    const baseDuration = 30; // 30 minutes base
    const creatureFactor = creatureCount * 5;
    const difficultyFactor = { easy: 0.8, medium: 1.0, hard: 1.2, deadly: 1.5 }[params.difficulty] || 1.0;
    
    return Math.round(baseDuration * difficultyFactor + creatureFactor);
  }

  private generateTacticalSetup(creatures: EncounterCreature[], environment: any): string {
    return `The creatures are positioned strategically throughout the ${environment.type}, using the terrain to their advantage.`;
  }

  private generateObjectives(creatures: EncounterCreature[]): string[] {
    return [
      'Defeat all hostile creatures',
      'Protect innocent bystanders',
      'Prevent enemies from escaping',
    ];
  }

  private generateComplications(environment: any): string[] {
    return [
      'Reinforcements may arrive',
      'Environmental hazards present',
      'Limited visibility',
    ];
  }

  private generateTreasure(level: number, xpBudget: number): TreasureReward[] {
    const treasure: TreasureReward[] = [];
    
    // Add coins based on encounter value
    const coinValue = Math.floor(xpBudget / 10);
    treasure.push({
      type: 'coins',
      name: 'Gold Pieces',
      value: coinValue,
      description: `${coinValue} gold pieces`,
    });
    
    return treasure;
  }

  private generateStoryRewards(params: EncounterParameters): string[] {
    return [
      'Information about local threats',
      'Reputation with local faction',
      'Access to new areas',
    ];
  }

  private getRandomEnvironment(): string {
    const environments = ['dungeon', 'wilderness', 'urban', 'aquatic', 'aerial', 'planar'];
    return environments[Math.floor(Math.random() * environments.length)] || 'dungeon';
  }

  private getRandomEncounterTable(environment: string, partyLevel: number): Array<{
    probability: number;
    difficulty: 'easy' | 'medium' | 'hard' | 'deadly';
    theme: 'combat' | 'exploration' | 'social';
  }> {
    return [
      { probability: 0.4, difficulty: 'easy', theme: 'combat' },
      { probability: 0.3, difficulty: 'medium', theme: 'combat' },
      { probability: 0.2, difficulty: 'hard', theme: 'combat' },
      { probability: 0.1, difficulty: 'deadly', theme: 'combat' },
    ];
  }

  private generateEncounterId(): string {
    return `encounter_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
