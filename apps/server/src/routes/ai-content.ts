/**
 * AI Content Generation routes for VTT platform
 */

import { logger } from "@vtt/logging";
import {
  generateEncounterContent,
  generateCampaignContent,
  enhanceTextContent,
  parseJsonBody,
} from "./ai-content-helpers";
import { RouteHandler } from "../router/types";

/**
 * POST /ai/generate-npc - Generate NPC using AI
 */
export const generateNPCHandler: RouteHandler = async (ctx) => {
  try {
    const body = await parseJsonBody(ctx.req);

    if (!body.prompt && !body.type) {
      ctx.res.writeHead(400, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Missing prompt or NPC type" }));
      return;
    }

    const npcPrompt = body.prompt || `Generate a ${body.type || "random"} NPC for a D&D campaign`;
    const campaign = body.campaignId
      ? `in the context of campaign: ${body.campaignContext || "generic fantasy"}`
      : "";

    const fullPrompt = `${npcPrompt} ${campaign}. Include: name, race, class/profession, background, personality traits, motivations, appearance, and a brief backstory. Format as JSON.`;

    // Simulate AI response - in real implementation, call actual AI service
    const npc = await generateNPCContent(fullPrompt, body.level || 1);

    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(
      JSON.stringify({
        success: true,
        npc,
        usage: { tokens: 150 },
      }),
    );
  } catch (error: any) {
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(
      JSON.stringify({
        error: error.message || "Failed to generate NPC",
      }),
    );
  }
};

/**
 * POST /ai/generate-quest - Generate quest/adventure content
 */
export const generateQuestHandler: RouteHandler = async (ctx) => {
  try {
    const body = await parseJsonBody(ctx.req);

    if (!body.prompt && !body.type) {
      ctx.res.writeHead(400, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Missing prompt or quest type" }));
      return;
    }

    const questPrompt = body.prompt || `Generate a ${body.type || "adventure"} quest`;
    const level = body.level || 3;
    const duration = body.duration || "one-shot";

    const fullPrompt = `${questPrompt} for level ${level} characters, designed as a ${duration}. Include: title, summary, objectives, key NPCs, locations, potential challenges, rewards, and plot hooks. Format as structured JSON.`;

    const quest = await generateQuestContent(fullPrompt, level, duration);

    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(
      JSON.stringify({
        success: true,
        quest,
        usage: { tokens: 300 },
      }),
    );
  } catch (error: any) {
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(
      JSON.stringify({
        error: error.message || "Failed to generate quest",
      }),
    );
  }
};

/**
 * POST /ai/generate-location - Generate location/dungeon content
 */
export const generateLocationHandler: RouteHandler = async (ctx) => {
  try {
    const body = await parseJsonBody(ctx.req);

    if (!body.prompt && !body.type) {
      ctx.res.writeHead(400, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Missing prompt or location type" }));
      return;
    }

    const locPrompt = body.prompt || `Generate a ${body.type || "dungeon"} location`;
    const size = body.size || "medium";
    const theme = body.theme || "fantasy";

    const fullPrompt = `${locPrompt} with ${size} size and ${theme} theme. Include: name, description, layout, rooms/areas, inhabitants, traps/hazards, treasure, and interesting features. Format as JSON with room descriptions.`;

    const location = await generateLocationContent(fullPrompt, size, theme);

    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(
      JSON.stringify({
        success: true,
        location,
        usage: { tokens: 400 },
      }),
    );
  } catch (error: any) {
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(
      JSON.stringify({
        error: error.message || "Failed to generate location",
      }),
    );
  }
};

/**
 * POST /ai/generate-items - Generate magic items and equipment
 */
export const generateItemsHandler: RouteHandler = async (ctx) => {
  try {
    const body = await parseJsonBody(ctx.req);

    const itemType = body.type || "magic item";
    const rarity = body.rarity || "uncommon";
    const count = Math.min(body.count || 1, 5); // Limit to 5 items max

    const prompt = body.prompt || `Generate ${count} ${rarity} ${itemType}(s) for D&D 5e`;
    const fullPrompt = `${prompt}. Include: name, rarity, description, properties, mechanics, and flavor text. Format as JSON array.`;

    const items = await generateItemsContent(fullPrompt, count, rarity);

    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(
      JSON.stringify({
        success: true,
        items,
        count: items.length,
        usage: { tokens: 100 * count },
      }),
    );
  } catch (error: any) {
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(
      JSON.stringify({
        error: error.message || "Failed to generate items",
      }),
    );
  }
};

/**
 * POST /ai/generate-encounter - Generate combat encounters
 */
export const generateEncounterHandler: RouteHandler = async (ctx) => {
  try {
    const body = await parseJsonBody(ctx.req);

    const partyLevel = body.partyLevel || 3;
    const partySize = body.partySize || 4;
    const difficulty = body.difficulty || "medium";
    const environment = body.environment || "dungeon";

    const prompt =
      body.prompt ||
      `Generate a ${difficulty} encounter for ${partySize} level ${partyLevel} characters in a ${environment}`;
    const fullPrompt = `${prompt}. Include: creatures, tactics, terrain features, setup, and potential complications. Calculate CR appropriately. Format as JSON.`;

    const encounter = await generateEncounterContent(fullPrompt, partyLevel, partySize, difficulty);

    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(
      JSON.stringify({
        success: true,
        encounter,
        usage: { tokens: 200 },
      }),
    );
  } catch (error: any) {
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(
      JSON.stringify({
        error: error.message || "Failed to generate encounter",
      }),
    );
  }
};

/**
 * POST /ai/generate-campaign - Generate campaign outline
 */
export const generateCampaignHandler: RouteHandler = async (ctx) => {
  try {
    const body = await parseJsonBody(ctx.req);

    if (!body.theme && !body.prompt) {
      ctx.res.writeHead(400, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Missing theme or prompt for campaign" }));
      return;
    }

    const theme = body.theme || "high fantasy";
    const duration = body.duration || "medium"; // short, medium, long
    const startLevel = body.startLevel || 1;
    const endLevel = body.endLevel || 10;

    const prompt = body.prompt || `Generate a ${duration} campaign with ${theme} theme`;
    const fullPrompt = `${prompt} for characters starting at level ${startLevel} and ending around level ${endLevel}. Include: campaign overview, major story arcs, key NPCs, important locations, recurring themes, and session hooks. Format as structured JSON.`;

    const campaign = await generateCampaignContent(fullPrompt, startLevel, endLevel, duration);

    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(
      JSON.stringify({
        success: true,
        campaign,
        usage: { tokens: 500 },
      }),
    );
  } catch (error: any) {
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(
      JSON.stringify({
        error: error.message || "Failed to generate campaign",
      }),
    );
  }
};

/**
 * POST /ai/enhance-text - Enhance existing text content
 */
export const enhanceTextHandler: RouteHandler = async (ctx) => {
  try {
    const body = await parseJsonBody(ctx.req);

    if (!body.text) {
      ctx.res.writeHead(400, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Missing text to enhance" }));
      return;
    }

    const enhancement = body.enhancement || "improve"; // improve, expand, rewrite, summarize
    const style = body.style || "fantasy"; // fantasy, modern, sci-fi, horror

    const prompt = `${enhancement} the following text in a ${style} style for a tabletop RPG: "${body.text}"`;

    const enhanced = await enhanceTextContent(prompt, enhancement, body.text);

    ctx.res.writeHead(200, { "Content-Type": "application/json" });
    ctx.res.end(
      JSON.stringify({
        success: true,
        original: body.text,
        enhanced: enhanced.text,
        enhancement,
        usage: { tokens: enhanced.tokens },
      }),
    );
  } catch (error: any) {
    ctx.res.writeHead(500, { "Content-Type": "application/json" });
    ctx.res.end(
      JSON.stringify({
        error: error.message || "Failed to enhance text",
      }),
    );
  }
};

// Mock AI generation functions (replace with actual AI service calls)
async function generateNPCContent(_prompt: string, _level: number): Promise<any> {
  // Simulate AI delay
  await new Promise((resolve) => setTimeout(resolve, 1000));

  return {
    id: `npc_${Date.now()}`,
    name: "Elara Moonwhisper",
    race: "Half-Elf",
    scaling: `+1d6 per spell level above ${_level}`,
    background: "Entertainer",
    personality: {
      traits: ["Charming and eloquent", "Loves to tell stories"],
      ideals: ["Freedom of expression"],
      bonds: ["Seeks to preserve ancient songs"],
      flaws: ["Too trusting of strangers"],
    },
    appearance: "Silver hair, bright green eyes, carries an ornate lute",
    backstory: "A traveling bard who collects forgotten tales from across the realm.",
    stats: {
      ac: 12,
      hp: _level * 8 + 10,
      speed: 30,
      abilities: { str: 10, dex: 14, con: 12, int: 13, wis: 11, cha: 16 },
    },
    skills: ["Performance", "Persuasion", "History"],
    languages: ["Common", "Elvish", "Halfling"],
  };
}

async function generateQuestContent(
  _prompt: string,
  level: number,
  _duration: string,
): Promise<any> {
  await new Promise((resolve) => setTimeout(resolve, 1500));

  return {
    id: `quest_${Date.now()}`,
    title: "The Lost Song of Valdris",
    summary: "Ancient melodies hold the key to preventing a calamity",
    level,
    duration: _duration,
    objectives: [
      "Investigate strange magical resonances in the Whispering Woods",
      "Find the three fragments of the Song of Valdris",
      "Confront the entity trying to corrupt the song",
    ],
    keyNPCs: [
      { name: "Elder Thorne", role: "Quest giver, village elder" },
      { name: "Malachar the Discordant", role: "Primary antagonist" },
    ],
    locations: [
      { name: "Millhaven Village", description: "Starting location, peaceful farming community" },
      {
        name: "Whispering Woods",
        description: "Magical forest where sounds carry further than they should",
      },
      {
        name: "Resonance Caverns",
        description: "Underground network where the song fragments are hidden",
      },
    ],
    rewards: {
      experience: level * 300,
      damage: `${level * 2}d6`,
      items: ["Tuning Fork of True Pitch", "Cloak of Elvenkind"],
    },
    plotHooks: [
      "Strange dreams plague the villagers",
      "Animals are acting unusually",
      "Music sounds discordant in certain areas",
    ],
  };
}

async function generateLocationContent(_prompt: string, size: string, theme: string): Promise<any> {
  await new Promise((resolve) => setTimeout(resolve, 1200));

  return {
    id: `location_${Date.now()}`,
    name: "The Sunken Archive",
    type: "dungeon",
    size,
    theme,
    description:
      "A flooded library beneath an ancient tower, filled with waterlogged tomes and aquatic guardians.",
    damage: `${size}d6`,
    layout: "3 levels, partially flooded",
    rooms: [
      {
        id: "entrance",
        name: "Collapsed Entrance",
        description:
          "Stone stairs descend into murky water. Ancient runes glow faintly on the walls.",
        inhabitants: ["2 Giant Frogs"],
        features: ["Slippery stairs", "Dim light from runes"],
        exits: ["north to Reading Hall"],
      },
      {
        id: "hall",
        name: "Flooded Reading Hall",
        description: "Grand hall with floating bookshelves and waterlogged furniture.",
        inhabitants: ["Water Elemental"],
        treasure: ["Bag of Holding hidden in desk"],
        features: ["Waist-deep water", "Floating debris"],
        exits: ["south to entrance", "east to Archive Vault"],
      },
      {
        id: "vault",
        name: "Archive Vault",
        description:
          "Sealed chamber containing the most valuable texts, protected by magical wards.",
        inhabitants: ["Arcane Guardian"],
        treasure: ["Spellbook", "Scroll of Water Walk", "500 gp in crystal gems"],
        features: ["Magical barrier", "Preserved air pocket"],
        traps: ["Glyph of Warding on vault door"],
      },
    ],
    hazards: ["Unstable flooring", "Toxic water in some areas"],
    secrets: ["Hidden passage behind false bookshelf", "Underwater tunnel to surface"],
  };
}

async function generateItemsContent(
  _prompt: string,
  count: number,
  _rarity: string,
): Promise<any[]> {
  await new Promise((resolve) => setTimeout(resolve, 800));

  const items: any[] = [];
  for (let i = 0; i < count; i++) {
    items.push({
      id: `item_${Date.now()}_${i}`,
      name: "Cloak of the Trickster",
      type: "Wondrous Item",
      rarity: _rarity,
      requiresAttunement: true,
      description: "This shimmering cloak seems to ripple with barely contained mischief.",
      properties: [
        "As a bonus action, you can become invisible until the start of your next turn",
        "You can use this property 3 times per day",
        "While invisible, your next attack has advantage",
      ],
      flavorText:
        "Woven from the laughter of sprites and the shadows of twilight, this cloak delights in confounding enemies.",
      value:
        _rarity === "common" ? 50 : _rarity === "uncommon" ? 200 : _rarity === "rare" ? 1000 : 5000,
    });
  }

  return items;
}
