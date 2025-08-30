/**
 * Complete Procedural Generation Algorithms
 * Advanced algorithms for creating game content automatically
 */

export interface NoiseConfig {
  seed: number;
  octaves: number;
  persistence: number;
  scale: number;
}

export class PerlinNoise {
  private permutation: number[];
  
  constructor(seed: number = Math.random()) {
    this.permutation = this.generatePermutation(seed);
  }
  
  private generatePermutation(seed: number): number[] {
    const p = Array.from({ length: 256 }, (_, _i) => i);
    
    // Shuffle using seed
    let random = seed;
    for (let i = p.length - 1; i > 0; i--) {
      random = (random * 9301 + 49297) % 233280;
      const j = Math.floor((random / 233280) * (i + 1));
      [p[i], p[j]] = [p[j], p[i]];
    }
    
    return [...p, ...p]; // Duplicate for wraparound
  }
  
  noise2D(x: number, y: number): number {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    
    x -= Math.floor(x);
    y -= Math.floor(y);
    
    const u = this.fade(x);
    const v = this.fade(y);
    
    const A = this.permutation[X] + Y;
    const AA = this.permutation[A];
    const AB = this.permutation[A + 1];
    const B = this.permutation[X + 1] + Y;
    const BA = this.permutation[B];
    const BB = this.permutation[B + 1];
    
    return this.lerp(v,
      this.lerp(u, this.grad2D(this.permutation[AA], x, y), this.grad2D(this.permutation[BA], x - 1, y)),
      this.lerp(u, this.grad2D(this.permutation[AB], x, y - 1), this.grad2D(this.permutation[BB], x - 1, y - 1))
    );
  }
  
  private fade(t: number): number {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }
  
  private lerp(t: number, a: number, b: number): number {
    return a + t * (b - a);
  }
  
  private grad2D(hash: number, x: number, y: number): number {
    const h = hash & 3;
    const u = h < 2 ? x : y;
    const v = h < 2 ? y : x;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }
  
  fbm(x: number, y: number, config: NoiseConfig): number {
    let value = 0;
    let amplitude = 1;
    let frequency = config.scale;
    
    for (let i = 0; i < config.octaves; i++) {
      value += amplitude * this.noise2D(x * frequency, y * frequency);
      amplitude *= config.persistence;
      frequency *= 2;
    }
    
    return value;
  }
}

export class BiomeGenerator {
  private temperatureNoise: PerlinNoise;
  private humidityNoise: PerlinNoise;
  private elevationNoise: PerlinNoise;
  
  constructor(seed: number) {
    this.temperatureNoise = new PerlinNoise(seed);
    this.humidityNoise = new PerlinNoise(seed + 1000);
    this.elevationNoise = new PerlinNoise(seed + 2000);
  }
  
  generateBiome(x: number, y: number): BiomeType {
    const temperature = this.temperatureNoise.fbm(x, y, { seed: 0, octaves: 4, persistence: 0.5, scale: 0.01 });
    const humidity = this.humidityNoise.fbm(x, y, { seed: 0, octaves: 4, persistence: 0.5, scale: 0.008 });
    const elevation = this.elevationNoise.fbm(x, y, { seed: 0, octaves: 6, persistence: 0.6, scale: 0.005 });
    
    // Normalize values to 0-1 range
    const temp = (temperature + 1) / 2;
    const humid = (humidity + 1) / 2;
    const elev = (elevation + 1) / 2;
    
    // High elevation = mountains
    if (elev > 0.7) {
      return temp < 0.3 ? 'arctic_mountains' : 'mountains';
    }
    
    // Water bodies
    if (elev < 0.3) {
      return 'water';
    }
    
    // Land biomes based on temperature and humidity
    if (temp < 0.3) {
      return humid > 0.5 ? 'tundra' : 'arctic';
    } else if (temp < 0.6) {
      if (humid < 0.3) return 'desert';
      if (humid < 0.6) return 'grassland';
      return 'temperate_forest';
    } else {
      if (humid < 0.4) return 'desert';
      if (humid < 0.7) return 'savanna';
      return 'tropical_forest';
    }
  }
}

export type BiomeType = 'water' | 'desert' | 'grassland' | 'temperate_forest' | 'tropical_forest' | 
  'tundra' | 'arctic' | 'mountains' | 'arctic_mountains' | 'savanna';

export class NameGenerator {
  private nameComponents = {
    fantasy: {
      prefixes: ['Aer', 'Bel', 'Cel', 'Dor', 'Eld', 'Fel', 'Gal', 'Hal', 'Ith', 'Jor', 'Kel', 'Lor', 'Mal', 'Nor', 'Oth', 'Pel'],
      suffixes: ['ador', 'beth', 'crest', 'duin', 'elin', 'ford', 'grim', 'helm', 'ion', 'kar', 'leth', 'mor', 'nal', 'oth', 'rin', 'wyn'],
      vowels: ['a', 'e', 'i', 'o', 'u', 'y'],
      consonants: ['b', 'c', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'm', 'n', 'p', 'r', 's', 't', 'v', 'w', 'z']
    },
    places: {
      descriptors: ['Ancient', 'Dark', 'Forgotten', 'Hidden', 'Lost', 'Mystic', 'Sacred', 'Shadow', 'Silent', 'Whispered'],
      features: ['Bridge', 'Castle', 'Cavern', 'Crypt', 'Falls', 'Forest', 'Gate', 'Grove', 'Hall', 'Keep', 'Lake', 'Peak', 'Ruins', 'Spire', 'Tower', 'Vale']
    }
  };
  
  private random: number;
  
  constructor(seed: number = Date.now()) {
    this.random = seed;
  }
  
  private nextRandom(): number {
    this.random = (this.random * 9301 + 49297) % 233280;
    return this.random / 233280;
  }
  
  generateFantasyName(): string {
    const { prefixes,  suffixes  } = this.nameComponents.fantasy;
    const prefix = prefixes[Math.floor(this.nextRandom() * prefixes.length)];
    const suffix = suffixes[Math.floor(this.nextRandom() * suffixes.length)];
    return prefix + suffix;
  }
  
  generatePlaceName(): string {
    const { descriptors,  features  } = this.nameComponents.places;
    const descriptor = descriptors[Math.floor(this.nextRandom() * descriptors.length)];
    const feature = features[Math.floor(this.nextRandom() * features.length)];
    return `${descriptor} ${feature}`;
  }
  
  generateCreatureName(type: 'humanoid' | 'beast' | 'dragon' | 'elemental'): string {
    switch (type) {
      case 'humanoid':
        return this.generateFantasyName();
      case 'beast':
        return `${this.generateFantasyName()} the ${['Fierce', 'Swift', 'Mighty', 'Ancient'][Math.floor(this.nextRandom() * 4)]}`;
      case 'dragon':
        return `${this.generateFantasyName()}${['wyrm', 'drake', 'wing', 'fire', 'storm'][Math.floor(this.nextRandom() * 5)]}`;
      case 'elemental':
        return `${['Blazing', 'Flowing', 'Earthen', 'Howling'][Math.floor(this.nextRandom() * 4)]} ${this.generateFantasyName()}`;
      default:
        return this.generateFantasyName();
    }
  }
}

export class TreasureGenerator {
  private treasureTables = {
    common: {
      coins: { copper: [10, 100], silver: [1, 20], gold: [0, 5] },
      items: ['Hemp Rope', 'Iron Rations', 'Torch', 'Candle', 'Oil Flask', 'Blanket', 'Tinderbox']
    },
    uncommon: {
      coins: { copper: [50, 200], silver: [10, 50], gold: [1, 10], platinum: [0, 2] },
      items: ['Potion of Healing', 'Scroll of Light', 'Silver Dagger', 'Chain Shirt', 'Shield +1']
    },
    rare: {
      coins: { silver: [100, 500], gold: [20, 100], platinum: [1, 10] },
      items: ['Sword +1', 'Armor +1', 'Ring of Protection', 'Wand of Magic Missiles', 'Bag of Holding']
    },
    legendary: {
      coins: { gold: [500, 2000], platinum: [50, 200] },
      items: ['Sword +2', 'Armor +2', 'Ring of Invisibility', 'Staff of Power', 'Cloak of Elvenkind']
    }
  };
  
  private random: number;
  
  constructor(seed: number = Date.now()) {
    this.random = seed;
  }
  
  private nextRandom(): number {
    this.random = (this.random * 9301 + 49297) % 233280;
    return this.random / 233280;
  }
  
  generateTreasure(rarity: 'common' | 'uncommon' | 'rare' | 'legendary', quantity: number = 1): any {
    const table = this.treasureTables[rarity];
    const treasure = {
      coins: {} as Record<string, number>,
      items: [] as string[]
    };
    
    // Generate coins
    for (const [coinType, range] of Object.entries(table.coins)) {
      const [min, max] = range;
      const amount = Math.floor(this.nextRandom() * (max - min + 1)) + min;
      if (amount > 0) {
        treasure.coins[coinType] = amount * quantity;
      }
    }
    
    // Generate items
    for (let i = 0; i < quantity; i++) {
      if (this.nextRandom() < 0.7) { // 70% chance of item
        const item = table.items[Math.floor(this.nextRandom() * table.items.length)];
        treasure.items.push(item);
      }
    }
    
    return treasure;
  }
}

export class QuestGenerator {
  private questTemplates = {
    fetch: {
      objectives: ['Retrieve the {item} from {location}', 'Collect {quantity} {items} for {npc}'],
      complications: ['guarded by {monster}', 'hidden in {dangerous_location}', 'cursed with {curse}'],
      rewards: ['gold', 'magic_item', 'information', 'reputation']
    },
    kill: {
      objectives: ['Eliminate {monster} terrorizing {location}', 'Clear {location} of {monster_type}'],
      complications: ['has minions', 'is magically protected', 'can only be harmed by {special_weapon}'],
      rewards: ['bounty', 'territory', 'magic_item', 'reputation']
    },
    escort: {
      objectives: ['Escort {npc} safely to {destination}', 'Guide {group} through {dangerous_area}'],
      complications: ['ambushed by {enemies}', 'terrible weather', 'mechanical breakdown'],
      rewards: ['payment', 'favor', 'information', 'contacts']
    },
    mystery: {
      objectives: ['Investigate {mystery} in {location}', 'Uncover the truth behind {event}'],
      complications: ['false leads', 'hostile witnesses', 'supernatural interference'],
      rewards: ['truth', 'justice', 'treasure', 'knowledge']
    }
  };
  
  private nameGen: NameGenerator;
  private random: number;
  
  constructor(seed: number = Date.now()) {
    this.nameGen = new NameGenerator(seed);
    this.random = seed + 1000;
  }
  
  private nextRandom(): number {
    this.random = (this.random * 9301 + 49297) % 233280;
    return this.random / 233280;
  }
  
  generateQuest(type?: keyof typeof this.questTemplates): any {
    const questType = type || this.randomChoice(Object.keys(this.questTemplates)) as keyof typeof this.questTemplates;
    const template = this.questTemplates[questType];
    
    const quest = {
      type: questType,
      title: this.generateQuestTitle(questType),
      objective: this.randomChoice(template.objectives),
      complication: this.randomChoice(template.complications),
      reward: this.randomChoice(template.rewards),
      difficulty: this.randomChoice(['easy', 'medium', 'hard', 'deadly']),
      estimatedDuration: Math.floor(this.nextRandom() * 4) + 1, // 1-4 hours
      requiredLevel: Math.floor(this.nextRandom() * 20) + 1
    };
    
    return this.fillPlaceholders(quest);
  }
  
  private generateQuestTitle(type: string): string {
    const titles = {
      fetch: ['The Lost Artifact', 'Treasures of the Deep', 'The Missing Piece'],
      kill: ['Beast Hunt', 'The Terror of', 'Extermination Contract'],
      escort: ['Safe Passage', 'The Long Road', 'Guardian Duty'],
      mystery: ['The Mystery of', 'Secrets Unveiled', 'Hidden Truth']
    };
    
    return this.randomChoice(titles[type as keyof typeof titles] || ['Adventure Awaits']);
  }
  
  private randomChoice<T>(array: T[]): T {
    return array[Math.floor(this.nextRandom() * array.length)];
  }
  
  private fillPlaceholders(quest: any): any {
    const placeholders = {
      '{item}': () => this.randomChoice(['Ancient Tome', 'Crystal Orb', 'Golden Chalice', 'Sacred Relic']),
      '{location}': () => this.nameGen.generatePlaceName(),
      '{npc}': () => this.nameGen.generateFantasyName(),
      '{monster}': () => this.nameGen.generateCreatureName('beast'),
      '{quantity}': () => (Math.floor(this.nextRandom() * 10) + 1).toString(),
      '{items}': () => this.randomChoice(['herbs', 'gems', 'scrolls', 'potions']),
      '{monster_type}': () => this.randomChoice(['goblins', 'undead', 'bandits', 'wolves']),
      '{dangerous_location}': () => this.randomChoice(['cursed swamp', 'haunted forest', 'abandoned mine', 'ancient ruins']),
      '{curse}': () => this.randomChoice(['eternal slumber', 'stone transformation', 'memory loss', 'aging']),
      '{special_weapon}': () => this.randomChoice(['silver blade', 'blessed weapon', 'magic sword', 'holy water']),
      '{enemies}': () => this.randomChoice(['bandits', 'wild beasts', 'rival adventurers', 'cultists']),
      '{group}': () => this.randomChoice(['merchant caravan', 'pilgrims', 'refugees', 'scholars']),
      '{destination}': () => this.nameGen.generatePlaceName(),
      '{dangerous_area}': () => this.randomChoice(['haunted woods', 'monster-infested swamp', 'treacherous mountains', 'cursed desert']),
      '{mystery}': () => this.randomChoice(['disappearances', 'strange lights', 'unusual deaths', 'missing persons']),
      '{event}': () => this.randomChoice(['the great fire', 'the vanishing', 'the curse', 'the betrayal'])
    };
    
    const questStr = JSON.stringify(quest);
    let result = questStr;
    
    for (const [placeholder, generator] of Object.entries(placeholders)) {
      result = result.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), generator());
    }
    
    return JSON.parse(result);
  }
}
