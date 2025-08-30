// Helper functions for AI content generation

async function generateEncounterContent(
  _prompt: string,
  difficulty: string,
  partyLevel: number,
  partySize: number,
): Promise<any> {
  await new Promise((resolve) => setTimeout(resolve, 1000));

  return {
    id: `encounter_${Date.now()}`,
    difficulty: difficulty,
    partyLevel: partyLevel,
    partySize: partySize,
    totalXP: partyLevel * partySize * 100,
    enemies: [
      { name: "Goblin Ambusher", count: 3, cr: 0.25 },
      { name: "Goblin Boss", count: 1, cr: 1 },
    ],
    environment: "Forest path",
    tactics: "Goblins attack from hidden positions",
    treasures: ["50 gp", "Healing potion"],
  };
}

async function generateCampaignContent(
  _prompt: string,
  duration: string,
  startLevel: number,
  endLevel: number,
): Promise<any> {
  await new Promise((resolve) => setTimeout(resolve, 2000));

  return {
    id: `campaign_${Date.now()}`,
    title: "The Shattered Crown",
    duration: duration,
    levels: `${startLevel} to ${endLevel}`,
    acts: [
      {
        number: 1,
        title: "The Gathering Storm",
        levels: `${startLevel} to ${startLevel + 2}`,
        summary: "Heroes discover a conspiracy threatening the kingdom",
      },
      {
        number: 2,
        title: "Into the Shadows",
        levels: `${startLevel + 3} to ${endLevel - 2}`,
        summary: "Investigation leads to ancient ruins and dark secrets",
      },
      {
        number: 3,
        title: "The Final Stand",
        levels: `${endLevel - 1} to ${endLevel}`,
        summary: "Epic confrontation to save the realm",
      },
    ],
    themes: ["Political intrigue", "Ancient evil", "Heroic sacrifice"],
    majorNPCs: [
      { name: "Queen Alara", role: "Rightful ruler in exile" },
      { name: "Lord Blackthorne", role: "Usurper and main antagonist" },
    ],
  };
}

async function enhanceTextContent(
  _prompt: string,
  enhancement: string,
  originalText: string,
): Promise<{ text: string; tokens: number }> {
  await new Promise((resolve) => setTimeout(resolve, 500));

  let enhanced = originalText;

  switch (enhancement) {
    case "improve":
      enhanced = originalText.replace(/\b\w+/g, (word) => {
        if (word === "good") return "excellent";
        if (word === "bad") return "terrible";
        if (word === "big") return "massive";
        return word;
      });
      break;
    case "expand":
      enhanced = `${originalText} The air crackles with arcane energy, and shadows dance at the edges of perception. Ancient magic permeates this place, leaving those who enter forever changed by the experience.`;
      break;
    case "summarize":
      enhanced =
        originalText
          .split(" ")
          .slice(0, Math.ceil(originalText.split(" ").length / 2))
          .join(" ") + "...";
      break;
    default:
      enhanced = `Enhanced version: ${originalText}`;
  }

  return {
    text: enhanced,
    tokens: Math.floor(enhanced.length / 4), // Rough token estimate
  };
}

// Helper function to parse JSON from request body
async function parseJsonBody(req: any): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", (chunk: any) => {
      body += chunk.toString();
    });

    req.on("end", () => {
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(new Error("Invalid JSON"));
      }
    });

    req.on("error", reject);
  });
}

export { generateEncounterContent, generateCampaignContent, enhanceTextContent, parseJsonBody };
