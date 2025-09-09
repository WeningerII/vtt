// MSW handlers for testing
import { http, HttpResponse } from "msw";
import { DiceRoll } from "../components/DiceRoller";
import type { Character } from "@vtt/core-schemas/src/character";
import type { Campaign, User } from "@vtt/core-schemas/src/index";

// Mock data that matches the actual Character interface from core-schemas
const mockCharacters: Character[] = [
  {
    // Core Identity
    id: "char-1",
    userId: "user-1", 
    campaignId: "campaign-1",

    // Basic Information
    name: "Aragorn",
    race: "Human",
    class: "Ranger",
    level: 10,
    background: "Outlander",
    alignment: "Lawful Good",

    // Experience and Progression
    experience: 64000,

    // Core Combat Stats
    hitPoints: { current: 75, max: 100, temporary: 0 },
    armorClass: 16,
    proficiencyBonus: 4,
    speed: 30,
    initiative: 2,

    // Hit Dice for resting
    hitDice: { total: 10, current: 8, type: "d10" },

    // Core Abilities (matching interface structure)
    abilities: {
      STR: { name: "Strength", value: 16, modifier: 3 },
      DEX: { name: "Dexterity", value: 14, modifier: 2 },
      CON: { name: "Constitution", value: 15, modifier: 2 },
      INT: { name: "Intelligence", value: 12, modifier: 1 },
      WIS: { name: "Wisdom", value: 16, modifier: 3 },
      CHA: { name: "Charisma", value: 13, modifier: 1 },
    },

    // Skills and Saves
    skills: {
      "Animal Handling": { name: "Animal Handling", ability: "WIS", proficient: true, value: 7, modifier: 7 },
      Athletics: { name: "Athletics", ability: "STR", proficient: true, value: 7, modifier: 7 },
      Insight: { name: "Insight", ability: "WIS", proficient: true, value: 7, modifier: 7 },
      Investigation: { name: "Investigation", ability: "INT", proficient: true, value: 5, modifier: 5 },
      Nature: { name: "Nature", ability: "INT", proficient: true, value: 5, modifier: 5 },
      Perception: { name: "Perception", ability: "WIS", proficient: true, value: 7, modifier: 7 },
      Survival: { name: "Survival", ability: "WIS", proficient: true, value: 7, modifier: 7 },
    },
    savingThrows: {
      STR: { proficient: true, value: 7 },
      DEX: { proficient: true, value: 6 },
      CON: { proficient: false, value: 2 },
      INT: { proficient: false, value: 1 },
      WIS: { proficient: false, value: 3 },
      CHA: { proficient: false, value: 1 },
    },

    // Equipment and Wealth
    equipment: [
      {
        id: "item-1",
        name: "Longsword",
        type: "weapon",
        quantity: 1,
        weight: 3,
        description: "A versatile martial weapon",
        equipped: true,
        properties: ["Versatile (1d10)"],
        value: 15,
        attackBonus: 7,
        damage: {
          diceExpression: "1d8+3",
          damageType: "slashing",
          versatile: "1d10+3",
        },
      },
      {
        id: "item-2", 
        name: "Longbow",
        type: "weapon",
        quantity: 1,
        weight: 2,
        description: "A ranged martial weapon",
        equipped: true,
        properties: ["Heavy", "Two-handed", "Range (150/600)"],
        value: 50,
        attackBonus: 6,
        damage: {
          diceExpression: "1d8+2",
          damageType: "piercing",
        },
      },
    ],
    currency: { cp: 0, sp: 0, ep: 0, gp: 250, pp: 0 },

    // Magic (optional)
    spellcasting: {
      ability: "WIS",
      spellSaveDC: 15,
      spellAttackBonus: 7,
      spellSlots: {
        "1": { max: 4, current: 3 },
        "2": { max: 3, current: 2 },
        "3": { max: 2, current: 1 },
      },
      spells: [
        {
          id: "spell-1",
          name: "Hunter's Mark",
          level: 1,
          school: "Divination",
          castingTime: "1 bonus action",
          range: "90 feet",
          components: ["V"],
          duration: "Concentration, up to 1 hour",
          description: "You choose a creature you can see within range and mystically mark it as your quarry.",
          prepared: true,
          known: true,
          concentration: true,
        },
      ],
      cantripsKnown: 2,
      spellsKnown: 6,
      spellsPrepared: 7,
      ritualCasting: false,
    },

    // Features and Traits
    features: [
      {
        id: "feat-1",
        name: "Favored Enemy",
        description: "You have significant experience studying, tracking, hunting, and even talking to a certain type of creature.",
        source: "Ranger Level 1",
        type: "class",
        uses: { current: 0, max: 0, resetOn: "other" },
      },
    ],
    traits: ["Versatile", "Skilled"],

    // Roleplay
    personality: {
      traits: ["I am driven by a wanderlust that led me away from home."],
      ideals: ["Glory. I must earn glory in battle, for myself and my clan."],
      bonds: ["My honor is my life."],
      flaws: ["I have trouble trusting in my allies."],
    },
    notes: "Ranger of the North, heir to the throne of Gondor",
    avatar: "/avatars/aragorn.jpg",

    // Meta
    createdAt: new Date("2023-01-01T00:00:00Z"),
    updatedAt: new Date("2023-12-01T00:00:00Z"),
  },
];

const mockEncounters = [
  {
    id: "encounter-1",
    name: "Goblin Ambush",
    campaignId: "campaign-1",
    status: "active",
    currentTurn: 0,
    round: 1,
    actors: [
      {
        id: "actor-1",
        type: "character",
        characterId: "char-1",
        name: "Aragorn",
        initiative: 18,
        hitPoints: { current: 75, max: 100 },
        armorClass: 16,
        conditions: [],
        isActive: true,
      },
      {
        id: "actor-2",
        type: "monster",
        monsterId: "goblin",
        name: "Goblin #1",
        initiative: 12,
        hitPoints: { current: 7, max: 7 },
        armorClass: 15,
        conditions: [],
        isActive: false,
      },
    ],
  },
];

// Mock users to use in campaigns
const mockUsers: User[] = [
  {
    id: "user-1",
    displayName: "Dungeon Master",
    roles: ["dm", "player"],
  },
  {
    id: "user-2", 
    displayName: "Player One",
    roles: ["player"],
  },
];

const mockCampaigns: Campaign[] = [
  {
    id: "campaign-1",
    name: "The Fellowship of the Ring", 
    members: mockUsers,
    sessions: 12,
    totalHours: 36.5,
  },
];

const mockRolls: DiceRoll[] = [
  {
    id: "roll-1",
    expression: "1d20+5",
    result: 18,
    breakdown: "1d20 (13) +5 = 18",
    timestamp: new Date("2023-01-01T10:00:00Z"),
    roller: "Aragorn",
    type: "attack",
  },
  {
    id: "roll-2",
    expression: "1d8+3",
    result: 8,
    breakdown: "1d8 (5) +3 = 8",
    timestamp: new Date("2023-01-01T10:01:00Z"),
    roller: "Aragorn",
    type: "damage",
  },
];

// API handlers
export const handlers = [
  // Character endpoints
  http.get("/api/v1/characters", () => {
    return HttpResponse.json(mockCharacters);
  }),

  http.get("/api/v1/characters/:id", ({ params }) => {
    const { id } = params;
    const character = mockCharacters.find((c) => c.id === id);

    if (!character) {
      return HttpResponse.json({ error: "Character not found" }, { status: 404 });
    }

    return HttpResponse.json(character);
  }),

  http.post("/api/v1/characters", async ({ request }) => {
    const body = await request.json() as any;
    const newCharacter: Character = {
      // Core Identity
      id: `char-${Date.now()}`,
      userId: "user-1",
      campaignId: body.campaignId,

      // Basic Information  
      name: body.name || "New Character",
      race: body.race || "Human",
      class: body.class || "Fighter", 
      level: body.level || 1,
      background: body.background || "Folk Hero",
      alignment: body.alignment || "Lawful Good",

      // Experience and Progression
      experience: 0,

      // Core Combat Stats
      hitPoints: { current: 10, max: 10, temporary: 0 },
      armorClass: 14,
      proficiencyBonus: 2,
      speed: 30,
      initiative: 0,

      // Hit Dice
      hitDice: { total: 1, current: 1, type: "d10" },

      // Core Abilities
      abilities: {
        STR: { name: "Strength", value: 13, modifier: 1 },
        DEX: { name: "Dexterity", value: 12, modifier: 1 },
        CON: { name: "Constitution", value: 14, modifier: 2 },
        INT: { name: "Intelligence", value: 10, modifier: 0 },
        WIS: { name: "Wisdom", value: 13, modifier: 1 },
        CHA: { name: "Charisma", value: 11, modifier: 0 },
      },

      // Skills and Saves
      skills: {},
      savingThrows: {
        STR: { proficient: false, value: 1 },
        DEX: { proficient: false, value: 1 }, 
        CON: { proficient: true, value: 4 },
        INT: { proficient: false, value: 0 },
        WIS: { proficient: true, value: 3 },
        CHA: { proficient: false, value: 0 },
      },

      // Equipment and Wealth
      equipment: [],
      currency: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },

      // Features and Traits
      features: [],
      traits: [],

      // Roleplay
      personality: {
        traits: [],
        ideals: [],
        bonds: [],
        flaws: [],
      },
      notes: "",

      // Meta
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockCharacters.push(newCharacter);
    return HttpResponse.json(newCharacter, { status: 201 });
  }),

  http.put("/api/v1/characters/:id", async ({ params, request }) => {
    const { id } = params;
    const body = await request.json() as any;
    const characterIndex = mockCharacters.findIndex((c) => c.id === id);

    if (characterIndex === -1) {
      return HttpResponse.json({ error: "Character not found" }, { status: 404 });
    }

    const updatedCharacter = {
      ...mockCharacters[characterIndex],
      ...body,
      updatedAt: new Date().toISOString(),
    };
    mockCharacters[characterIndex] = updatedCharacter;

    return HttpResponse.json(updatedCharacter);
  }),

  http.delete("/api/v1/characters/:id", ({ params }) => {
    const { id } = params;
    const characterIndex = mockCharacters.findIndex((c) => c.id === id);

    if (characterIndex === -1) {
      return HttpResponse.json({ error: "Character not found" }, { status: 404 });
    }

    mockCharacters.splice(characterIndex, 1);
    return HttpResponse.json({ success: true });
  }),

  // Campaign endpoints
  http.get("/api/v1/campaigns", () => {
    return HttpResponse.json(mockCampaigns);
  }),

  http.get("/api/v1/campaigns/:id", ({ params }) => {
    const { id } = params;
    const campaign = mockCampaigns.find((c) => c.id === id);

    if (!campaign) {
      return HttpResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    return HttpResponse.json(campaign);
  }),

  http.post("/api/v1/campaigns", async ({ request }) => {
    const body = (await request.json()) as any;
    const newCampaign: Campaign = {
      id: `campaign-${Date.now()}`,
      name: body.name || "New Campaign",
      members: mockUsers.slice(0, 1), // Add DM as initial member
      sessions: 0,
      totalHours: 0,
    };
    mockCampaigns.push(newCampaign);
    return HttpResponse.json(newCampaign, { status: 201 });
  }),

  http.put("/api/v1/campaigns/:id", async ({ params, request }) => {
    const { id } = params;
    const body = (await request.json()) as any;
    const campaignIndex = mockCampaigns.findIndex((c) => c.id === id);

    if (campaignIndex === -1) {
      return HttpResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    const updatedCampaign = {
      ...mockCampaigns[campaignIndex],
      ...body,
      updatedAt: new Date().toISOString(),
    };
    mockCampaigns[campaignIndex] = updatedCampaign;

    return HttpResponse.json(updatedCampaign);
  }),

  // Encounter endpoints
  http.get("/api/v1/encounters", () => {
    return HttpResponse.json(mockEncounters);
  }),

  http.put("/api/v1/encounters/:id", async ({ params, request }) => {
    const { id } = params;
    const body = (await request.json()) as any;
    const encounterIndex = mockEncounters.findIndex((e) => e.id === id);

    if (encounterIndex === -1) {
      return HttpResponse.json({ error: "Encounter not found" }, { status: 404 });
    }

    const existingEncounter = mockEncounters[encounterIndex];
    if (existingEncounter) {
      mockEncounters[encounterIndex] = { ...existingEncounter, ...(body as any) };
      return HttpResponse.json(mockEncounters[encounterIndex]);
    }

    return HttpResponse.json({ error: "Encounter not found" }, { status: 404 });
  }),

  http.post("/api/v1/encounters/:id/start", ({ params }) => {
    const { id } = params;
    const encounterIndex = mockEncounters.findIndex((e) => e.id === id);

    if (encounterIndex === -1) {
      return HttpResponse.json({ error: "Encounter not found" }, { status: 404 });
    }

    const encounter = mockEncounters[encounterIndex];
    if (encounter) {
      encounter.status = "active";
      return HttpResponse.json(encounter);
    }

    return HttpResponse.json({ error: "Encounter not found" }, { status: 404 });
  }),

  http.post("/api/v1/encounters/:id/end", ({ params }) => {
    const { id } = params;
    const encounterIndex = mockEncounters.findIndex((e) => e.id === id);

    if (encounterIndex === -1) {
      return HttpResponse.json({ error: "Encounter not found" }, { status: 404 });
    }

    const encounter = mockEncounters[encounterIndex];
    if (encounter) {
      encounter.status = "completed";
      return HttpResponse.json(encounter);
    }

    return HttpResponse.json({ error: "Encounter not found" }, { status: 404 });
  }),

  // Combat AI endpoints
  http.post("/api/v1/combat/suggestions", async ({ request }) => {
    const body = await request.json() as any;

    return HttpResponse.json({
      suggestions: [
        {
          type: "action",
          description: "Attack with longsword",
          priority: "high",
          reasoning: "Target is within melee range and has low AC",
        },
        {
          type: "movement",
          description: "Move to flank the enemy",
          priority: "medium",
          reasoning: "Flanking would provide advantage on attack rolls",
        },
      ],
    });
  }),

  http.post("/api/v1/combat/analysis", async ({ request }) => {
    const body = await request.json() as any;

    return HttpResponse.json({
      analysis: {
        threatLevel: "moderate",
        recommendations: ["Focus fire on the spellcaster", "Use cover effectively"],
        tacticalAdvantages: ["High ground", "Numerical superiority"],
        risks: ["Enemy spellcaster", "Limited healing resources"],
      },
    });
  }),

  // Dice rolling endpoints
  http.post("/api/dice/roll", async ({ request }) => {
    const body = (await request.json()) as any;
    const { expression, type = "custom", roller = "Player" } = body;

    // Simple dice rolling simulation
    const match = expression.match(/(\d+)?d(\d+)([+-]\d+)?/i);
    if (!match || !match[2]) {
      return HttpResponse.json({ error: "Invalid dice expression" }, { status: 400 });
    }

    const numDice = parseInt(match[1] || "1");
    const dieSize = parseInt(match[2]);
    const modifier = match[3] ? parseInt(match[3]) : 0;

    const rolls = Array.from({ length: numDice }, () => Math.floor(Math.random() * dieSize) + 1);
    const total = rolls.reduce((sum, roll) => sum + roll, 0) + modifier;

    const newRoll: DiceRoll = {
      id: `roll-${Date.now()}`,
      expression,
      result: total,
      breakdown: `${expression} = ${total}`,
      timestamp: new Date(),
      roller,
      type,
    };

    mockRolls.unshift(newRoll);
    return HttpResponse.json(newRoll);
  }),

  // Error simulation endpoints
  http.get("/api/v1/test/server-error", () => {
    return HttpResponse.json({ error: "Internal server error" }, { status: 500 });
  }),

  http.get("/api/test/timeout", async ({ request }) => {
    await new Promise(resolve => setTimeout(resolve, 5000));
    return HttpResponse.json({ message: "This should timeout" });
  }),

  http.get("/api/test/network-error", async ({ request }) => {
    throw new Error("Network error");
  }),

  // AI Assistant endpoints
  http.post("/api/v1/assistant/query", async ({ request }) => {
    const body = await request.json() as any;
    const { query, context } = body as { query: string; context?: any };

    // Simulate AI processing
    await new Promise((resolve) => setTimeout(resolve, 1000));

    let response = "";

    if (query.toLowerCase().includes("spell")) {
      response =
        "Based on your character's spell list, I recommend using Hunter's Mark for consistent damage or Cure Wounds for healing when needed.";
    } else if (query.toLowerCase().includes("combat")) {
      response =
        "In combat, consider your positioning and action economy. Use your bonus action for Hunter's Mark and your action for attacks.";
    } else if (query.toLowerCase().includes("rule")) {
      response =
        "According to D&D 5e rules, you can move, take an action, and use a bonus action on your turn. You also get one reaction per round.";
    } else {
      response =
        "I can help you with character builds, combat tactics, spell usage, and D&D 5e rules. What specific aspect would you like assistance with?";
    }

    return HttpResponse.json({
      response,
      suggestions: [
        "Tell me about optimal spell usage",
        "What are the best combat tactics for my character?",
        "Explain action economy in D&D 5e",
        "What are the most common mistakes players make in combat?",
        "How can I improve my character's survivability?",
      ],
      confidence: 0.9,
    });
  }),

  // Dice rolling endpoints
  http.post("/api/dice/roll", async ({ request }) => {
    const body = await request.json() as Record<string, any>;
    const { expression, type = "custom", roller = "Player" } = body;

    // Simple dice rolling simulation
    const match = expression.match(/(\d+)?d(\d+)([+-]\d+)?/i);
    if (!match || !match[2]) {
      return HttpResponse.json({ error: "Invalid dice expression" }, { status: 400 });
    }

    const numDice = parseInt(match[1] || "1");
    const dieSize = parseInt(match[2]);
    const modifier = match[3] ? parseInt(match[3]) : 0;

    const rolls = Array.from({ length: numDice }, () => Math.floor(Math.random() * dieSize) + 1);

    const sum = rolls.reduce((acc, roll) => acc + roll, 0);
    const total = sum + modifier;

    let breakdown = `${numDice}d${dieSize}`;
    if (rolls.length <= 10) {
      breakdown += ` (${rolls.join(", ")})`;
    }
    if (modifier !== 0) {
      breakdown += ` ${modifier >= 0 ? "+" : ""}${modifier}`;
    }
    breakdown += ` = ${total}`;

    const roll: DiceRoll = {
      id: `roll-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      expression,
      result: total,
      breakdown,
      timestamp: new Date(),
      roller,
      type,
    };

    mockRolls.unshift(roll);
    return HttpResponse.json(HttpResponse.json(roll));
  }),

  http.get("/api/v1/dice/recent", async ({ request }) => {
    const limit = parseInt(new URL(request.url).searchParams.get("limit") || "10");
    return HttpResponse.json(HttpResponse.json(mockRolls.slice(0, limit)));
  }),

  // Error simulation endpoints for testing
  http.get("/api/v1/test/error", async ({ request }) => {
    return HttpResponse.json({ error: "Simulated server error" }, { status: 500 });
  }),

  http.get("/api/test/timeout", async ({ request }) => {
    // Simulate timeout by never resolving
    return new Promise(() => {});
  }),

  http.get("/api/test/network-error", async ({ request }) => {
    return new Response(null, { status: 500, statusText: "Network connection failed" });
  }),
];

// Helper functions for test setup
export const resetMockData = () => {
  const initialCharacter = mockCharacters[0];
  const initialEncounter = mockEncounters[0];
  const initialCampaign = mockCampaigns[0];
  const initialRolls = [mockRolls[0], mockRolls[1]];

  mockCharacters.length = 0;
  if (initialCharacter) {
    mockCharacters.push(initialCharacter);
  }

  mockEncounters.length = 0;
  if (initialEncounter) {
    mockEncounters.push(initialEncounter);
  }

  mockCampaigns.length = 0;
  if (initialCampaign) {
    mockCampaigns.push(initialCampaign);
  }

  mockRolls.length = 0;
  initialRolls.forEach((roll) => {
    if (roll) {
      mockRolls.push(roll);
    }
  });
};

export const addMockCharacter = (character: any) => {
  mockCharacters.push(character);
};

export const addMockEncounter = (encounter: any) => {
  mockEncounters.push(encounter);
};

export const getMockCharacters = () => [...mockCharacters];
export const getMockEncounters = () => [...mockEncounters];
export const getMockCampaigns = () => [...mockCampaigns];
export const getMockRolls = () => [...mockRolls];
