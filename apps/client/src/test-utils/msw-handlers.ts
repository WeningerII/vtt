import { http, HttpResponse } from "msw";
import { DiceRoll } from "../components/DiceRoller";

// Mock data
const mockCharacters = [
  {
    id: "char-1",
    name: "Aragorn",
    class: "Ranger",
    level: 10,
    race: "Human",
    background: "Outlander",
    alignment: "Lawful Good",
    experiencePoints: 64000,
    abilities: {
      strength: 16,
      dexterity: 14,
      constitution: 15,
      intelligence: 12,
      wisdom: 16,
      charisma: 13,
    },
    hitPoints: { current: 75, max: 100, temporary: 0 },
    armorClass: 16,
    initiative: 2,
    speed: 30,
    proficiencyBonus: 4,
    savingThrows: {
      strength: { proficient: true, value: 7 },
      dexterity: { proficient: true, value: 6 },
      constitution: { proficient: false, value: 2 },
      intelligence: { proficient: false, value: 1 },
      wisdom: { proficient: false, value: 3 },
      charisma: { proficient: false, value: 1 },
    },
    skills: {
      "Animal Handling": { proficient: true, expertise: false, value: 7 },
      Athletics: { proficient: true, expertise: false, value: 7 },
      Insight: { proficient: true, expertise: false, value: 7 },
      Investigation: { proficient: true, expertise: false, value: 5 },
      Nature: { proficient: true, expertise: false, value: 5 },
      Perception: { proficient: true, expertise: false, value: 7 },
      Survival: { proficient: true, expertise: false, value: 7 },
    },
    attacks: [
      {
        id: "attack-1",
        name: "Longsword",
        attackBonus: 7,
        damage: "1d8+3",
        damageType: "slashing",
      },
      {
        id: "attack-2",
        name: "Longbow",
        attackBonus: 6,
        damage: "1d8+2",
        damageType: "piercing",
      },
    ],
    spells: {
      spellcastingAbility: "wisdom" as const,
      spellSaveDC: 15,
      spellAttackBonus: 7,
      spellSlots: {
        1: { max: 4, current: 3 },
        2: { max: 3, current: 2 },
        3: { max: 3, current: 1 },
      },
      knownSpells: [
        {
          id: "spell-1",
          name: "Hunter's Mark",
          level: 1,
          school: "divination",
          castingTime: "1 bonus action",
          range: "90 feet",
          components: "V",
          duration: "Concentration, up to 1 hour",
          description:
            "You choose a creature you can see within range and mystically mark it as your quarry.",
          prepared: true,
        },
        {
          id: "spell-2",
          name: "Cure Wounds",
          level: 1,
          school: "evocation",
          castingTime: "1 action",
          range: "Touch",
          components: "V, S",
          duration: "Instantaneous",
          description:
            "A creature you touch regains a number of hit points equal to 1d8 + your spellcasting ability modifier.",
          prepared: true,
        },
      ],
    },
    equipment: [
      {
        id: "item-1",
        name: "Longsword",
        quantity: 1,
        weight: 3,
        description: "A versatile martial weapon",
      },
      {
        id: "item-2",
        name: "Longbow",
        quantity: 1,
        weight: 2,
        description: "A ranged martial weapon",
      },
      {
        id: "item-3",
        name: "Arrows",
        quantity: 60,
        weight: 3,
        description: "Ammunition for bows",
      },
    ],
    features: [
      {
        id: "feat-1",
        name: "Favored Enemy",
        description:
          "You have significant experience studying, tracking, hunting, and even talking to a certain type of creature.",
        source: "Ranger Level 1",
      },
      {
        id: "feat-2",
        name: "Natural Explorer",
        description: "You are particularly familiar with one type of natural environment.",
        source: "Ranger Level 1",
      },
    ],
    conditions: [],
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

const mockCampaigns = [
  {
    id: "campaign-1",
    name: "Lost Mine of Phandelver",
    description: "A classic D&D adventure",
    dmId: "user-1",
    isActive: true,
    system: "dnd5e",
    createdAt: "2023-01-01T00:00:00Z",
    characters: mockCharacters,
    encounters: mockEncounters,
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
  http.get("/api/characters", () => {
    return HttpResponse.json(mockCharacters);
  }),

  http.get("/api/characters/:id", ({ params }) => {
    const { id } = params;
    const character = mockCharacters.find((c) => c.id === id);

    if (!character) {
      return HttpResponse.json({ error: "Character not found" }, { status: 404 });
    }

    return HttpResponse.json(character);
  }),

  http.post("/api/characters", async ({ request }) => {
    const body = await request.json();
    const newCharacter = {
      id: `char-${Date.now()}`,
      ...body,
      createdAt: new Date().toISOString(),
    };

    mockCharacters.push(newCharacter);
    return HttpResponse.json(newCharacter, { status: 201 });
  }),

  http.put("/api/characters/:id", async ({ params, request }) => {
    const { id } = params;
    const body = await request.json();
    const characterIndex = mockCharacters.findIndex((c) => c.id === id);

    if (characterIndex === -1) {
      return HttpResponse.json({ error: "Character not found" }, { status: 404 });
    }

    const existingCharacter = mockCharacters[characterIndex];
    if (existingCharacter) {
      mockCharacters[characterIndex] = { ...existingCharacter, ...body };
      return HttpResponse.json(mockCharacters[characterIndex]);
    }

    return HttpResponse.json({ error: "Character not found" }, { status: 404 });
  }),

  http.delete("/api/characters/:id", ({ params }) => {
    const { id } = params;
    const characterIndex = mockCharacters.findIndex((c) => c.id === id);

    if (characterIndex === -1) {
      return HttpResponse.json({ error: "Character not found" }, { status: 404 });
    }

    mockCharacters.splice(characterIndex, 1);
    return new HttpResponse(null, { status: 204 });
  }),

  // Campaign endpoints
  http.get("/api/campaigns", () => {
    return HttpResponse.json(mockCampaigns);
  }),

  http.get("/api/campaigns/:id", ({ params }) => {
    const { id } = params;
    const campaign = mockCampaigns.find((c) => c.id === id);

    if (!campaign) {
      return HttpResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    return HttpResponse.json(campaign);
  }),

  http.post("/api/campaigns", async ({ request }) => {
    const body = (await request.json()) as any;
    const newCampaign = {
      id: `campaign-${Date.now()}`,
      ...body,
      createdAt: new Date().toISOString(),
    };

    mockCampaigns.push(newCampaign);
    return HttpResponse.json(newCampaign, { status: 201 });
  }),

  http.put("/api/campaigns/:id", async ({ params, request }) => {
    const { id } = params;
    const body = (await request.json()) as any;
    const campaignIndex = mockCampaigns.findIndex((c) => c.id === id);

    if (campaignIndex === -1) {
      return HttpResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    const existingCampaign = mockCampaigns[campaignIndex];
    if (existingCampaign) {
      mockCampaigns[campaignIndex] = { ...existingCampaign, ...body };
      return HttpResponse.json(mockCampaigns[campaignIndex]);
    }

    return HttpResponse.json({ error: "Campaign not found" }, { status: 404 });
  }),

  // Encounter endpoints
  http.get("/api/encounters", () => {
    return HttpResponse.json(mockEncounters);
  }),

  http.put("/api/encounters/:id", async ({ params, request }) => {
    const { id } = params;
    const body = (await request.json()) as any;
    const encounterIndex = mockEncounters.findIndex((e) => e.id === id);

    if (encounterIndex === -1) {
      return HttpResponse.json({ error: "Encounter not found" }, { status: 404 });
    }

    const existingEncounter = mockEncounters[encounterIndex];
    if (existingEncounter) {
      mockEncounters[encounterIndex] = { ...existingEncounter, ...body };
      return HttpResponse.json(mockEncounters[encounterIndex]);
    }

    return HttpResponse.json({ error: "Encounter not found" }, { status: 404 });
  }),

  http.post("/api/encounters/:id/start", ({ params }) => {
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

  http.post("/api/encounters/:id/end", ({ params }) => {
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
  http.post("/api/combat/suggestions", async ({ request }) => {
    const body = await request.json();

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

  http.post("/api/combat/analysis", async ({ request }) => {
    const body = await request.json();

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
  http.get("/api/test/server-error", () => {
    return HttpResponse.json({ error: "Internal server error" }, { status: 500 });
  }),

  http.get("/api/test/timeout", () => {
    // Simulate a timeout by never resolving
    return new Promise(() => {});
  }),

  http.get("/api/test/network-error", () => {
    return HttpResponse.error();
  }),

  // AI Assistant endpoints
  http.post("/api/assistant/query", async ({ request }) => {
    const body = await request.json();
    const { query, context } = body;

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
  rest.post("/api/dice/roll", async (req, res, ctx) => {
    const body = await req.json();
    const { expression, type = "custom", roller = "Player" } = body;

    // Simple dice rolling simulation
    const match = expression.match(/(\d+)?d(\d+)([+-]\d+)?/i);
    if (!match || !match[2]) {
      return res(ctx.status(400), ctx.json({ error: "Invalid dice expression" }));
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
    return res(ctx.json(roll));
  }),

  rest.get("/api/dice/recent", (req, res, ctx) => {
    const limit = parseInt(req.url.searchParams.get("limit") || "10");
    return res(ctx.json(mockRolls.slice(0, limit)));
  }),

  // Error simulation endpoints for testing
  rest.get("/api/test/error", (req, res, ctx) => {
    return res(ctx.status(500), ctx.json({ error: "Simulated server error" }));
  }),

  rest.get("/api/test/timeout", (req, res, ctx) => {
    // Simulate timeout by never resolving
    return new Promise(() => {});
  }),

  rest.get("/api/test/network-error", (req, res, ctx) => {
    return res.networkError("Network connection failed");
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
