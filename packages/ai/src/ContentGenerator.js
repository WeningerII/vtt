/**
 * Procedural Content Generator
 * Handles AI-driven generation of encounters, NPCs, loot, and environmental content
 */
export class ContentGenerator {
  constructor() {
    this.templates = new Map();
    this.generationHistory = [];
    this.nameGenerators = new Map();
    this.markovChains = new Map();
    this.initializeNameGenerators();
    this.initializeDefaultTemplates();
  }
  /**
   * Generate content from template
   */
  async generateContent(templateId, parameters) {
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
  validateParameters(templateParams, userParams) {
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
  initializeNameGenerators() {
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
  initializeDefaultTemplates() {
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
  generateRandomEncounter(params) {
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
    const creatures = environmentCreatures[environment] || environmentCreatures.forest;
    const selectedCreature = creatures[Math.floor(Math.random() * creatures.length)];
    const difficultyModifiers = {
      easy: 0.7,
      medium: 1.0,
      hard: 1.3,
      deadly: 1.6,
    };
    const modifier = difficultyModifiers[difficulty] || 1.0;
    const baseCount = Math.max(1, Math.floor((partyLevel / 3) * modifier));
    const count = baseCount + Math.floor(Math.random() * 3);
    return {
      name: `${selectedCreature.charAt(0).toUpperCase() + selectedCreature.slice(1)} Encounter`,
      description: `A group of ${count} ${selectedCreature}s blocks your path through the ${environment}.`,
      difficulty: Math.floor(partyLevel * modifier),
      enemies: [
        {
          name: selectedCreature,
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
  generateRandomNPC(params) {
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
          ]),
        ],
      },
      stats: this.generateNPCStats(role),
      skills: this.generateNPCSkills(role),
      equipment: this.generateNPCEquipment(role),
    };
  }
  generateTavern(params) {
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
    const rooms = roomCounts[size] || roomCounts.medium;
    return {
      name,
      type: "tavern",
      size,
      description: qualityDescriptions[quality] || qualityDescriptions.average,
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
          : undefined,
    };
  }
  generateNPCStats(role) {
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
    const modifiers = roleModifiers[role] || {};
    for (const [stat, modifier] of Object.entries(modifiers)) {
      baseStats[stat] += modifier;
    }
    return baseStats;
  }
  generateNPCSkills(role) {
    const roleSkills = {
      merchant: ["persuasion", "insight", "deception"],
      guard: ["athletics", "intimidation", "perception"],
      noble: ["history", "persuasion", "insight"],
      adventurer: ["acrobatics", "survival", "investigation"],
    };
    return roleSkills[role] || ["perception"];
  }
  generateNPCEquipment(role) {
    const roleEquipment = {
      merchant: ["fine clothes", "coin pouch", "ledger"],
      guard: ["chain mail", "sword", "shield"],
      noble: ["fine clothes", "jewelry", "signet ring"],
      adventurer: ["leather armor", "weapon", "adventuring gear"],
    };
    return roleEquipment[role] || ["simple clothes"];
  }
  generateRandomLoot(level) {
    const loot = [];
    const itemTypes = ["weapon", "armor", "potion", "scroll", "gem", "art object"];
    const numItems = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < numItems; i++) {
      const type = this.randomChoice(itemTypes);
      loot.push(`${type} (level ${level})`);
    }
    return loot;
  }
  randomChoice(array) {
    return array[Math.floor(Math.random() * array.length)];
  }
  /**
   * Register custom template
   */
  registerTemplate(template) {
    this.templates.set(template.id, template);
  }
  /**
   * Get all templates
   */
  getTemplates() {
    return Array.from(this.templates.values());
  }
  /**
   * Get templates by type
   */
  getTemplatesByType(type) {
    return Array.from(this.templates.values()).filter((t) => t.type === type);
  }
  /**
   * Get generation history
   */
  getGenerationHistory() {
    return [...this.generationHistory];
  }
  /**
   * Clear generation history
   */
  clearHistory() {
    this.generationHistory = [];
  }
}
// Simple Markov Chain for text generation
class MarkovChain {
  constructor(order = 2) {
    this.chains = new Map();
    this.order = order;
  }
  train(text) {
    const words = text.toLowerCase().split(/\s+/);
    for (let i = 0; i < words.length - this.order; i++) {
      const key = words.slice(i, i + this.order).join(" ");
      const next = words[i + this.order];
      if (!this.chains.has(key)) {
        this.chains.set(key, []);
      }
      this.chains.get(key).push(next);
    }
  }
  generate(startKey, maxLength = 50) {
    const keys = Array.from(this.chains.keys());
    if (keys.length === 0) return "";
    let currentKey =
      startKey && this.chains.has(startKey)
        ? startKey
        : keys[Math.floor(Math.random() * keys.length)];
    const result = currentKey.split(" ");
    for (let i = 0; i < maxLength - this.order; i++) {
      const possibleNext = this.chains.get(currentKey);
      if (!possibleNext || possibleNext.length === 0) break;
      const next = possibleNext[Math.floor(Math.random() * possibleNext.length)];
      result.push(next);
      // Update key for next iteration
      const keyWords = currentKey.split(" ");
      keyWords.shift();
      keyWords.push(next);
      currentKey = keyWords.join(" ");
      if (!this.chains.has(currentKey)) break;
    }
    return result.join(" ");
  }
}
//# sourceMappingURL=ContentGenerator.js.map
