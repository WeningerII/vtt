/**
 * Procedural Content Generator
 * Handles AI-driven generation of encounters, NPCs, loot, and environmental content
 */

export interface GenerationTemplate {
  id: string;
  name: string;
  type: "encounter" | "npc" | "loot" | "location" | "quest" | "dialogue";
  description: string;
  parameters: GenerationParameter[];
  generateContent: (params: Record<string, any>) => Promise<GeneratedContent>;
  tags: string[];
  difficulty?: "easy" | "medium" | "hard";
}

export interface GenerationParameter {
  name: string;
  type: "string" | "number" | "boolean" | "select" | "multi-select";
  label: string;
  description?: string;
  required: boolean;
  defaultValue?: any;
  options?: Array<{ label: string; value: any }>;
  min?: number;
  max?: number;
}

export interface GeneratedContent {
  id: string;
  type: string;
  name: string;
  description: string;
  data: any;
  metadata: {
    generatedAt: number;
    templateId: string;
    parameters: Record<string, any>;
    version: string;
  };
}

export interface EncounterData {
  name: string;
  description: string;
  difficulty: number;
  enemies: Array<{
    name: string;
    count: number;
    level: number;
    type: string;
    stats: Record<string, number>;
  }>;
  environment: {
    terrain: string;
    weather: string;
    lighting: string;
    hazards: string[];
  };
  objectives: string[];
  rewards: {
    experience: number;
    gold: number;
    items: string[];
  };
  tactics: string[];
}

export interface NPCData {
  name: string;
  race: string;
  class: string;
  level: number;
  personality: {
    traits: string[];
    ideals: string[];
    bonds: string[];
    flaws: string[];
  };
  appearance: {
    age: string;
    height: string;
    weight: string;
    eyes: string;
    hair: string;
    skin: string;
    distinguishing_features: string[];
  };
  background: {
    occupation: string;
    history: string;
    motivations: string[];
    secrets: string[];
  };
  stats: Record<string, number>;
  skills: string[];
  equipment: string[];
  spells?: string[];
}

export interface LocationData {
  name: string;
  type: string;
  size: string;
  description: string;
  features: Array<{
    name: string;
    description: string;
    interactive: boolean;
    hidden?: boolean;
  }>;
  inhabitants: Array<{
    name: string;
    role: string;
    disposition: string;
  }>;
  connections: Array<{
    direction: string;
    destination: string;
    travel_time: string;
  }>;
  atmosphere: {
    lighting: string;
    sounds: string[];
    smells: string[];
    temperature: string;
  };
  secrets?: string[];
}

export class ContentGenerator {
  private templates: Map<string, GenerationTemplate> = new Map();
  private generationHistory: GeneratedContent[] = [];
  private nameGenerators: Map<string, string[]> = new Map();
  private markovChains: Map<string, MarkovChain> = new Map();

  constructor() {
    this.initializeNameGenerators();
    this.initializeDefaultTemplates();
  }

  /**
   * Generate content from template
   */
  async generateContent(
    templateId: string,
    parameters: Record<string, any>,
  ): Promise<GeneratedContent> {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template '${templateId}' not found`);
    }

    // Validate parameters
    this.validateParameters(template.parameters, parameters);

    // Generate content using template
    const content = await template.generateContent(parameters);

    // Add to generation history
    this.generationHistory.push(content);

    // Limit history size
    if (this.generationHistory.length > 100) {
      this.generationHistory = this.generationHistory.slice(-100);
    }

    return content;
  }

  private validateParameters(
    templateParams: GenerationParameter[],
    userParams: Record<string, any>,
  ): void {
    for (const param of templateParams) {
      if (param.required && !(param.name in userParams)) {
        throw new Error(`Required parameter '${param.name}' is missing`);
      }

      const value = userParams[param.name];
      if (value !== undefined) {
        switch (param.type) {
          case "number":
            if (typeof value !== "number") {
              throw new Error(`Parameter '${param.name}' must be a number`);
            }
            if (param.min !== undefined && value < param.min) {
              throw new Error(`Parameter '${param.name}' must be at least ${param.min}`);
            }
            if (param.max !== undefined && value > param.max) {
              throw new Error(`Parameter '${param.name}' must be at most ${param.max}`);
            }
            break;
          case "string":
            if (typeof value !== "string") {
              throw new Error(`Parameter '${param.name}' must be a string`);
            }
            break;
          case "boolean":
            if (typeof value !== "boolean") {
              throw new Error(`Parameter '${param.name}' must be a boolean`);
            }
            break;
        }
      }
    }
  }

  private initializeNameGenerators(): void {
    // Fantasy names
    this.nameGenerators.set("human_male", [
      "Aiden",
      "Aldric",
      "Bran",
      "Cedric",
      "Dain",
      "Gareth",
      "Hector",
      "Ivan",
      "Joren",
      "Kael",
      "Leoric",
      "Magnus",
      "Nolan",
      "Owen",
      "Percival",
      "Quinton",
      "Roderick",
      "Soren",
      "Theron",
      "Ulric",
      "Viktor",
      "Willem",
      "Xavier",
      "Yorick",
      "Zander",
    ]);

    this.nameGenerators.set("human_female", [
      "Aria",
      "Brenna",
      "Celia",
      "Diana",
      "Elara",
      "Fiona",
      "Gwen",
      "Helena",
      "Isla",
      "Jessa",
      "Kira",
      "Luna",
      "Mira",
      "Nora",
      "Ophelia",
      "Petra",
      "Quinn",
      "Rhea",
      "Sera",
      "Tessa",
      "Una",
      "Vera",
      "Willa",
      "Xara",
      "Yara",
      "Zara",
    ]);

    this.nameGenerators.set("elf_male", [
      "Aelar",
      "Beiro",
      "Carric",
      "Drannor",
      "Enna",
      "Galinndan",
      "Hadarai",
      "Immeral",
      "Ivellios",
      "Korfel",
      "Lamlis",
      "Mindartis",
      "Naal",
      "Nutae",
      "Paelynn",
      "Peren",
      "Quarion",
      "Riardon",
      "Silvyr",
      "Suhnaal",
      "Thamior",
      "Theriatis",
    ]);

    this.nameGenerators.set("tavern", [
      "The Prancing Pony",
      "The Dragon's Den",
      "The Laughing Griffin",
      "The Golden Goblet",
      "The Rusty Anchor",
      "The Weary Traveler",
      "The Dancing Bear",
      "The Silver Stag",
      "The Crooked Crown",
      "The Merry Merchant",
      "The Drunken Dragon",
      "The Singing Swan",
    ]);
  }

  private initializeDefaultTemplates(): void {
    // Random Encounter Template
    this.templates.set("random_encounter", {
      id: "random_encounter",
      name: "Random Encounter",
      type: "encounter",
      description: "Generate a random combat encounter",
      parameters: [
        {
          name: "party_level",
          type: "number",
          label: "Party Level",
          description: "Average level of the party",
          required: true,
          defaultValue: 5,
          min: 1,
          max: 20,
        },
        {
          name: "party_size",
          type: "number",
          label: "Party Size",
          description: "Number of players in the party",
          required: true,
          defaultValue: 4,
          min: 1,
          max: 8,
        },
        {
          name: "environment",
          type: "select",
          label: "Environment",
          description: "Where the encounter takes place",
          required: true,
          defaultValue: "forest",
          options: [
            { label: "Forest", value: "forest" },
            { label: "Dungeon", value: "dungeon" },
            { label: "Mountains", value: "mountains" },
            { label: "Desert", value: "desert" },
            { label: "Swamp", value: "swamp" },
            { label: "Urban", value: "urban" },
          ],
        },
        {
          name: "difficulty",
          type: "select",
          label: "Difficulty",
          description: "Encounter difficulty",
          required: true,
          defaultValue: "medium",
          options: [
            { label: "Easy", value: "easy" },
            { label: "Medium", value: "medium" },
            { label: "Hard", value: "hard" },
            { label: "Deadly", value: "deadly" },
          ],
        },
      ],
      generateContent: async (params) => {
        const encounter = this.generateRandomEncounter(params);
        return {
          id: `encounter-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: "encounter",
          name: encounter.name,
          description: encounter.description,
          data: encounter,
          metadata: {
            generatedAt: Date.now(),
            templateId: "random_encounter",
            parameters: params,
            version: "1.0",
          },
        };
      },
      tags: ["combat", "random"],
      difficulty: "medium",
    });

    // NPC Generator Template
    this.templates.set("random_npc", {
      id: "random_npc",
      name: "Random NPC",
      type: "npc",
      description: "Generate a random non-player character",
      parameters: [
        {
          name: "race",
          type: "select",
          label: "Race",
          description: "Character race",
          required: false,
          options: [
            { label: "Random", value: "random" },
            { label: "Human", value: "human" },
            { label: "Elf", value: "elf" },
            { label: "Dwarf", value: "dwarf" },
            { label: "Halfling", value: "halfling" },
          ],
        },
        {
          name: "role",
          type: "select",
          label: "Role",
          description: "Character role or occupation",
          required: false,
          options: [
            { label: "Random", value: "random" },
            { label: "Merchant", value: "merchant" },
            { label: "Guard", value: "guard" },
            { label: "Noble", value: "noble" },
            { label: "Commoner", value: "commoner" },
            { label: "Adventurer", value: "adventurer" },
          ],
        },
      ],
      generateContent: async (params) => {
        const npc = this.generateRandomNPC(params);
        return {
          id: `npc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: "npc",
          name: npc.name,
          description: `${npc.race} ${npc.background.occupation}`,
          data: npc,
          metadata: {
            generatedAt: Date.now(),
            templateId: "random_npc",
            parameters: params,
            version: "1.0",
          },
        };
      },
      tags: ["npc", "character"],
      difficulty: "easy",
    });

    // Tavern Generator Template
    this.templates.set("tavern", {
      id: "tavern",
      name: "Tavern",
      type: "location",
      description: "Generate a tavern or inn",
      parameters: [
        {
          name: "quality",
          type: "select",
          label: "Quality",
          description: "Quality of the establishment",
          required: true,
          defaultValue: "average",
          options: [
            { label: "Poor", value: "poor" },
            { label: "Average", value: "average" },
            { label: "Good", value: "good" },
            { label: "Excellent", value: "excellent" },
          ],
        },
        {
          name: "size",
          type: "select",
          label: "Size",
          description: "Size of the tavern",
          required: true,
          defaultValue: "medium",
          options: [
            { label: "Small", value: "small" },
            { label: "Medium", value: "medium" },
            { label: "Large", value: "large" },
          ],
        },
      ],
      generateContent: async (params) => {
        const tavern = this.generateTavern(params);
        return {
          id: `tavern-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: "location",
          name: tavern.name,
          description: tavern.description,
          data: tavern,
          metadata: {
            generatedAt: Date.now(),
            templateId: "tavern",
            parameters: params,
            version: "1.0",
          },
        };
      },
      tags: ["location", "social"],
      difficulty: "easy",
    });
  }

  private generateRandomEncounter(params: Record<string, any>): EncounterData {
    const environment = params.environment || "forest";
    const difficulty = params.difficulty || "medium";
    const partyLevel = params.party_level || 5;

    const environmentCreatures = {
      forest: ["wolf", "bear", "bandit", "orc", "goblin"],
      dungeon: ["skeleton", "zombie", "goblin", "orc", "troll"],
      mountains: ["giant", "dragon", "harpy", "griffon", "orc"],
      desert: ["scorpion", "mummy", "djinn", "sphinx", "bandit"],
      swamp: ["lizardfolk", "troll", "will-o-wisp", "giant_frog", "black_dragon"],
      urban: ["bandit", "cultist", "assassin", "thief", "guard"],
    };

    const creatures =
      environmentCreatures[environment as keyof typeof environmentCreatures] ||
      environmentCreatures.forest;
    const selectedCreature = creatures[Math.floor(Math.random() * creatures.length)];

    const difficultyModifiers = {
      easy: 0.7,
      medium: 1.0,
      hard: 1.3,
      deadly: 1.6,
    };

    const modifier = difficultyModifiers[difficulty as keyof typeof difficultyModifiers] || 1.0;
    const baseCount = Math.max(1, Math.floor((partyLevel / 3) * modifier));
    const count = baseCount + Math.floor(Math.random() * 3);

    return {
      name: `${(selectedCreature || 'Unknown').charAt(0).toUpperCase() + (selectedCreature || 'Unknown').slice(1)} Encounter`,
      description: `A group of ${count} ${selectedCreature}s blocks your path through the ${environment}.`,
      difficulty: Math.floor(partyLevel * modifier),
      enemies: [
        {
          name: selectedCreature || 'Unknown Creature',
          count,
          level: Math.max(1, partyLevel - 2 + Math.floor(Math.random() * 4)),
          type: "hostile",
          stats: {
            hp: 20 + partyLevel * 5,
            ac: 12 + Math.floor(partyLevel / 3),
            attack: partyLevel + 3,
            damage: 6 + Math.floor(partyLevel / 2),
          },
        },
      ],
      environment: {
        terrain: environment,
        weather: this.randomChoice(["clear", "overcast", "light rain", "fog"]),
        lighting: this.randomChoice(["bright", "dim", "dark"]),
        hazards:
          environment === "swamp"
            ? ["difficult terrain", "poisonous gas"]
            : environment === "mountains"
              ? ["loose rocks", "steep cliffs"]
              : [],
      },
      objectives: ["Defeat all enemies", "Survive the encounter"],
      rewards: {
        experience: count * (50 + partyLevel * 10),
        gold: Math.floor(Math.random() * 100) + partyLevel * 10,
        items: this.generateRandomLoot(partyLevel),
      },
      tactics: [
        `${selectedCreature}s prefer to attack in groups`,
        "They will focus fire on isolated targets",
        "They may attempt to flee if reduced to less than 25% health",
      ],
    };
  }

  private generateRandomNPC(params: Record<string, any>): NPCData {
    const race =
      params.race === "random"
        ? this.randomChoice(["human", "elf", "dwarf", "halfling"])
        : params.race || "human";
    const role =
      params.role === "random"
        ? this.randomChoice(["merchant", "guard", "noble", "commoner", "adventurer"])
        : params.role || "commoner";

    const gender = this.randomChoice(["male", "female"]);
    const nameKey = `${race}_${gender}`;
    const names = this.nameGenerators.get(nameKey) ||
      this.nameGenerators.get("human_male") || ["Unknown"];
    const name = this.randomChoice(names);

    const personalities = {
      traits: [
        "brave",
        "cautious",
        "greedy",
        "generous",
        "hot-tempered",
        "calm",
        "curious",
        "secretive",
      ],
      ideals: ["honor", "freedom", "justice", "power", "knowledge", "beauty", "nature", "order"],
      bonds: [
        "family",
        "mentor",
        "homeland",
        "temple",
        "guild",
        "friends",
        "rival",
        "organization",
      ],
      flaws: ["pride", "greed", "cowardice", "wrath", "envy", "gluttony", "sloth", "lust"],
    };

    return {
      name,
      race,
      class:
        role === "adventurer"
          ? this.randomChoice(["fighter", "wizard", "rogue", "cleric"])
          : "commoner",
      level: role === "adventurer" ? 1 + Math.floor(Math.random() * 10) : 0,
      personality: {
        traits: [this.randomChoice(personalities.traits)],
        ideals: [this.randomChoice(personalities.ideals)],
        bonds: [this.randomChoice(personalities.bonds)],
        flaws: [this.randomChoice(personalities.flaws)],
      },
      appearance: {
        age: this.randomChoice(["young", "middle-aged", "elderly"]),
        height: this.randomChoice(["short", "average", "tall"]),
        weight: this.randomChoice(["thin", "average", "heavy"]),
        eyes: this.randomChoice(["brown", "blue", "green", "hazel", "gray"]),
        hair: this.randomChoice(["black", "brown", "blonde", "red", "gray", "white"]),
        skin: this.randomChoice(["pale", "fair", "olive", "dark", "tanned"]),
        distinguishing_features: [
          this.randomChoice(["scar", "tattoo", "birthmark", "jewelry", "unusual clothing"]),
        ],
      },
      background: {
        occupation: role,
        history: `A ${race} who works as a ${role} in the local area.`,
        motivations: [
          this.randomChoice(["survival", "wealth", "knowledge", "power", "family", "adventure"]),
        ],
        secrets: [
          this.randomChoice([
            "hidden wealth",
            "secret identity",
            "dark past",
            "forbidden knowledge",
            "family shame",
          ])
        ],
      },
      stats: {
        level: Math.max(1, Math.floor(Math.random() * 20) + 1),
        hp: 8 + Math.floor(Math.random() * 12),
        ac: 10 + Math.floor(Math.random() * 8),
        str: 10 + Math.floor(Math.random() * 8),
        dex: 10 + Math.floor(Math.random() * 8),
        con: 10 + Math.floor(Math.random() * 8),
        int: 10 + Math.floor(Math.random() * 8),
        wis: 10 + Math.floor(Math.random() * 8),
        cha: 10 + Math.floor(Math.random() * 8)
      },
      skills: this.generateNPCSkills(role),
      equipment: this.generateNPCEquipment(role),
    };
  }

  private generateTavern(params: Record<string, any>): LocationData {
    const quality = params.quality || "average";
    const size = params.size || "medium";

    const tavernNames = this.nameGenerators.get("tavern") || ["The Generic Tavern"];
    const name = this.randomChoice(tavernNames);

    const qualityDescriptions = {
      poor: "A run-down establishment with creaky floors and questionable hygiene.",
      average: "A typical tavern with decent food and ale, frequented by locals.",
      good: "A well-maintained establishment known for its quality food and drink.",
      excellent: "A premier establishment with the finest food, drink, and accommodations.",
    };

    const roomCounts = {
      small: { common: 1, private: 2 },
      medium: { common: 1, private: 5 },
      large: { common: 2, private: 8 },
    };

    const rooms = roomCounts[size as keyof typeof roomCounts] || roomCounts.medium;

    return {
      name,
      type: "tavern",
      size,
      description:
        qualityDescriptions[quality as keyof typeof qualityDescriptions] ||
        qualityDescriptions.average,
      features: [
        {
          name: "Common Room",
          description: "A large room with tables, chairs, and a fireplace where patrons gather.",
          interactive: true,
        },
        {
          name: "Bar",
          description: "Where drinks are served and information is exchanged.",
          interactive: true,
        },
        {
          name: "Kitchen",
          description: "Where meals are prepared.",
          interactive: false,
        },
        ...Array.from({ length: rooms.private }, (_, i) => ({
          name: `Room ${i + 1}`,
          description: "A private room for guests.",
          interactive: true,
        })),
      ],
      inhabitants: [
        {
          name: this.randomChoice(["Gareth", "Mara", "Finn", "Nora"]),
          role: "tavern keeper",
          disposition: this.randomChoice(["friendly", "neutral", "gruff"]),
        },
        {
          name: this.randomChoice(["Tom", "Sarah", "Ben", "Lisa"]),
          role: "server",
          disposition: "friendly",
        },
      ],
      connections: [
        {
          direction: "outside",
          destination: "town square",
          travel_time: "2 minutes",
        },
      ],
      atmosphere: {
        lighting: quality === "poor" ? "dim" : quality === "excellent" ? "bright" : "moderate",
        sounds: ["conversation", "laughter", "clinking of mugs", "crackling fire"],
        smells: ["cooking food", "ale", "wood smoke"],
        temperature: "warm",
      },
      secrets:
        Math.random() < 0.3
          ? [
              this.randomChoice([
                "Hidden room behind the bar",
                "Smuggling operation in the basement",
                "The tavern keeper is actually a retired adventurer",
                "Secret meetings happen here after midnight",
              ]),
            ]
          : [],
    };
  }

  private generateNPCStats(role: string): Record<string, number> {
    const baseStats = {
      strength: 10,
      dexterity: 10,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 10,
    };

    const roleModifiers = {
      guard: { strength: 2, constitution: 1 },
      merchant: { charisma: 2, intelligence: 1 },
      noble: { charisma: 2, intelligence: 1 },
      adventurer: { strength: 1, dexterity: 1, constitution: 1 },
    };

    const modifiers = roleModifiers[role as keyof typeof roleModifiers] || {};

    for (const [stat, modifier] of Object.entries(modifiers)) {
      baseStats[stat as keyof typeof baseStats] += modifier;
    }

    return baseStats;
  }

  private generateNPCSkills(role: string): string[] {
    const roleSkills = {
      merchant: ["persuasion", "insight", "deception"],
      guard: ["athletics", "intimidation", "perception"],
      noble: ["history", "persuasion", "insight"],
      adventurer: ["acrobatics", "survival", "investigation"],
    };

    return roleSkills[role as keyof typeof roleSkills] || ["perception"];
  }

  private generateNPCEquipment(role: string): string[] {
    const roleEquipment = {
      merchant: ["fine clothes", "coin pouch", "ledger"],
      guard: ["chain mail", "sword", "shield"],
      noble: ["fine clothes", "jewelry", "signet ring"],
      adventurer: ["leather armor", "weapon", "adventuring gear"],
    };

    return roleEquipment[role as keyof typeof roleEquipment] || ["simple clothes"];
  }

  private generateRandomLoot(level: number): string[] {
    const loot = [];
    const itemTypes = ["weapon", "armor", "potion", "scroll", "gem", "art object"];
    const numItems = 1 + Math.floor(Math.random() * 3);

    for (let i = 0; i < numItems; i++) {
      const type = this.randomChoice(itemTypes);
      (loot as string[]).push(`${type} (level ${level})`);
    }

    return loot;
  }

  private randomChoice<T>(array: T[]): T {
    const result = array[Math.floor(Math.random() * array.length)];
    if (result === undefined) {
      throw new Error('Cannot select from empty array');
    }
    return result;
  }

  /**
   * Register custom template
   */
  registerTemplate(template: GenerationTemplate): void {
    this.templates.set(template.id, template);
  }

  /**
   * Get all templates
   */
  getTemplates(): GenerationTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Get templates by type
   */
  getTemplatesByType(type: GenerationTemplate["type"]): GenerationTemplate[] {
    return Array.from(this.templates.values()).filter((t) => t.type === type);
  }

  /**
   * Get generation history
   */
  getGenerationHistory(): GeneratedContent[] {
    return [...this.generationHistory];
  }

  /**
   * Clear generation history
   */
  clearHistory(): void {
    this.generationHistory = [];
  }
}

// Simple Markov Chain for text generation
class MarkovChain {
  private chains: Map<string, string[]> = new Map();
  private order: number;

  constructor(order: number = 2) {
    this.order = order;
  }

  train(text: string): void {
    const words = text.toLowerCase().split(/\s+/);

    for (let i = 0; i < words.length - this.order; i++) {
      const key = words.slice(i, i + this.order).join(" ");
      const next = words[i + this.order];

      if (!this.chains.has(key)) {
        this.chains.set(key, []);
      }
      const chain = this.chains.get(key);
      if (chain && next) {
        chain.push(next);
      }
    }
  }

  generate(startKey?: string, maxLength: number = 50): string {
    const keys = Array.from(this.chains.keys());
    if (keys.length === 0) {return "";}

    let currentKey =
      startKey && this.chains.has(startKey)
        ? startKey
        : keys[Math.floor(Math.random() * keys.length)];
    if (!currentKey) {return '';}
    const result = currentKey.split(" ");

    for (let i = 0; i < maxLength - this.order; i++) {
      const possibleNext = currentKey ? this.chains.get(currentKey) : undefined;
      if (!possibleNext || possibleNext.length === 0) {break;}

      const next = possibleNext[Math.floor(Math.random() * possibleNext.length)];
      if (next) {
        result.push(next);
      }

      // Update key for next iteration
      const keyWords = currentKey ? currentKey.split(" ") : [];
      keyWords.shift();
      if (next) {
        keyWords.push(next);
      }
      currentKey = keyWords.join(" ");

      if (!currentKey || !this.chains.has(currentKey)) {break;}
    }

    return result.join(" ");
  }
}
