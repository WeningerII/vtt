import type { CharacterSheet } from "./types";

export function buildSystemPrompt() {
  return (
    "You are Genesis, a system that creates structured RPG character sheets. " +
    "Return ONLY strict JSON matching this structure: {\n" +
    "  name: string,\n" +
    "  ancestry?: string, class?: string, background?: string, alignment?: string, level?: number,\n" +
    "  personality?: { traits?: string[], ideals?: string[], bonds?: string[], flaws?: string[] },\n" +
    "  attributes?: { str?: number, dex?: number, con?: number, int?: number, wis?: number, cha?: number },\n" +
    "  skills?: string[], abilities?: string[], equipment?: string[], backstory?: string\n" +
    "}. Do not include markdown fences or commentary."
  );
}

export function buildUserPrompt(concept: string, name?: string) {
  let base = `Create a character matching this concept: ${concept}.`;
  if (name) {base += ` The character's name should be: ${name}.`;}
  base += " Ensure the JSON is complete and consistent.";
  return base;
}

export function safeJsonExtract<T = unknown>(raw: string): T {
  const trimmed = raw.trim();
  // Strip markdown code fences if present
  const fence = /^```[a-zA-Z]*\n([\s\S]*?)\n```$/m;
  const m = trimmed.match(fence);
  const content: string = m?.[1] ?? trimmed;
  try {
    return JSON.parse(content) as T;
  } catch {}
  // Fallback: try to extract the first JSON object
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    const slice = content.slice(start, end + 1);
    try {
      return JSON.parse(slice) as T;
    } catch {}
  }
  throw new Error("Failed to parse JSON from model response");
}

export function applyNameFallback(sheet: CharacterSheet, _name?: string): CharacterSheet {
  if (!sheet.name && name) {return { ...sheet, name };}
  return sheet;
}
