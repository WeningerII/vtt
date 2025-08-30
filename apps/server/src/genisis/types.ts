export type CharacterSheet = {
  name: string;
  ancestry?: string; // race/species
  class?: string;
  background?: string;
  alignment?: string;
  level?: number;
  personality?: {
    traits?: string[];
    ideals?: string[];
    bonds?: string[];
    flaws?: string[];
  };
  attributes?: {
    str?: number;
    dex?: number;
    con?: number;
    int?: number;
    wis?: number;
    cha?: number;
  };
  skills?: string[];
  abilities?: string[];
  equipment?: string[];
  backstory?: string;
  [k: string]: unknown;
};

export type GenerateInput = {
  concept: string;
  name?: string;
  model?: string; // openrouter model id
};

export type ProviderResponse = {
  content: string;
  model: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  raw?: any;
};
