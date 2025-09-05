export interface MaterialComponent {
  id: string;
  name: string;
  description: string;
  cost?: number; // in gold pieces
  consumed: boolean;
  rarity?: "common" | "uncommon" | "rare" | "very_rare" | "legendary";
}

export interface SpellMaterialRequirement {
  spellId: string;
  spellName: string;
  level: number;
  components: MaterialComponent[];
  alternativeComponents?: MaterialComponent[][]; // For spells with multiple component options
}

// Comprehensive material component database
export const MATERIAL_COMPONENTS: Record<string, MaterialComponent> = {
  // Cantrip Components (Level 0)
  melee_weapon_1sp: {
    id: "melee_weapon_1sp",
    name: "Melee Weapon",
    description: "A melee weapon worth at least 1 silver piece",
    cost: 0.1,
    consumed: false,
    rarity: "common",
  },
  bit_of_phosphorus: {
    id: "bit_of_phosphorus",
    name: "Bit of Phosphorus",
    description: "A small piece of phosphorus",
    consumed: true,
    rarity: "common",
  },
  bit_of_wytchwood: {
    id: "bit_of_wytchwood",
    name: "Bit of Wytchwood",
    description: "A small piece of wytchwood",
    consumed: true,
    rarity: "uncommon",
  },
  glowworm: {
    id: "glowworm",
    name: "Glowworm",
    description: "A living glowworm",
    consumed: true,
    rarity: "common",
  },
  makeup_face: {
    id: "makeup_face",
    name: "Makeup",
    description: "Small amount of makeup applied to face",
    consumed: true,
    rarity: "common",
  },
  living_flea: {
    id: "living_flea",
    name: "Living Flea",
    description: "A living flea",
    consumed: true,
    rarity: "common",
  },
  firefly: {
    id: "firefly",
    name: "Firefly",
    description: "A firefly",
    consumed: true,
    rarity: "common",
  },
  phosphorescent_moss: {
    id: "phosphorescent_moss",
    name: "Phosphorescent Moss",
    description: "Moss that glows with phosphorescence",
    consumed: true,
    rarity: "common",
  },
  two_lodestones: {
    id: "two_lodestones",
    name: "Two Lodestones",
    description: "A pair of lodestones",
    consumed: false,
    rarity: "common",
  },
  copper_wire_short: {
    id: "copper_wire_short",
    name: "Short Copper Wire",
    description: "A short piece of copper wire",
    consumed: false,
    rarity: "common",
  },
  bit_of_fleece: {
    id: "bit_of_fleece",
    name: "Bit of Fleece",
    description: "A small piece of fleece",
    consumed: false,
    rarity: "common",
  },
  miniature_cloak: {
    id: "miniature_cloak",
    name: "Miniature Cloak",
    description: "A tiny cloak",
    consumed: false,
    rarity: "common",
  },
  mistletoe: {
    id: "mistletoe",
    name: "Mistletoe",
    description: "A sprig of mistletoe",
    consumed: false,
    rarity: "common",
  },
  shamrock_leaf: {
    id: "shamrock_leaf",
    name: "Shamrock Leaf",
    description: "A leaf from a shamrock",
    consumed: false,
    rarity: "common",
  },
  club_or_quarterstaff: {
    id: "club_or_quarterstaff",
    name: "Club or Quarterstaff",
    description: "A club or quarterstaff weapon",
    consumed: false,
    rarity: "common",
  },
  thorn_stem: {
    id: "thorn_stem",
    name: "Thorny Plant Stem",
    description: "Stem of a plant with thorns",
    consumed: false,
    rarity: "common",
  },
  holy_symbol: {
    id: "holy_symbol",
    name: "Holy Symbol",
    description: "A holy symbol of your deity",
    consumed: false,
    rarity: "common",
  },

  // Level 1 Components
  tiny_bell: {
    id: "tiny_bell",
    name: "Tiny Bell",
    description: "A small bell",
    consumed: false,
    rarity: "common",
  },
  fine_silver_wire: {
    id: "fine_silver_wire",
    name: "Fine Silver Wire",
    description: "A piece of fine silver wire",
    consumed: false,
    rarity: "common",
  },
  morsel_of_food: {
    id: "morsel_of_food",
    name: "Morsel of Food",
    description: "A small piece of food",
    consumed: true,
    rarity: "common",
  },
  cup_of_water: {
    id: "cup_of_water",
    name: "Cup of Water",
    description: "A cup filled with water",
    consumed: true,
    rarity: "common",
  },
  drop_of_blood: {
    id: "drop_of_blood",
    name: "Drop of Blood",
    description: "A single drop of blood",
    consumed: true,
    rarity: "common",
  },
  bit_fur_cloth: {
    id: "bit_fur_cloth",
    name: "Fur in Cloth",
    description: "A bit of fur wrapped in cloth",
    consumed: false,
    rarity: "common",
  },
  holy_water_sprinkle: {
    id: "holy_water_sprinkle",
    name: "Holy Water",
    description: "A sprinkling of holy water",
    consumed: true,
    rarity: "common",
  },
  powdered_silver_25gp: {
    id: "powdered_silver_25gp",
    name: "Powdered Silver",
    description: "Powdered silver worth 25 gold pieces",
    cost: 25,
    consumed: true,
    rarity: "uncommon",
  },
  diamond_50gp: {
    id: "diamond_50gp",
    name: "Diamond",
    description: "A diamond worth 50 gold pieces",
    cost: 50,
    consumed: false,
    rarity: "rare",
  },

  // High-value components
  diamond_100gp: {
    id: "diamond_100gp",
    name: "Diamond (100gp)",
    description: "A diamond worth 100 gold pieces",
    cost: 100,
    consumed: false,
    rarity: "rare",
  },
  diamond_300gp: {
    id: "diamond_300gp",
    name: "Diamond (300gp)",
    description: "Diamonds worth 300 gold pieces",
    cost: 300,
    consumed: true,
    rarity: "very_rare",
  },
  diamond_500gp: {
    id: "diamond_500gp",
    name: "Diamond (500gp)",
    description: "A diamond worth 500 gold pieces",
    cost: 500,
    consumed: true,
    rarity: "very_rare",
  },
  diamond_1000gp: {
    id: "diamond_1000gp",
    name: "Diamond (1000gp)",
    description: "A diamond worth 1000 gold pieces",
    cost: 1000,
    consumed: true,
    rarity: "legendary",
  },
  diamonds_25000gp: {
    id: "diamonds_25000gp",
    name: "Diamonds (25,000gp)",
    description: "Diamonds worth 25,000 gold pieces",
    cost: 25000,
    consumed: true,
    rarity: "legendary",
  },
};

// Helper function to safely get material components
const getComponent = (id: string): MaterialComponent => {
  const component = MATERIAL_COMPONENTS[id];
  if (!component) {
    throw new Error(`Material component '${id}' not found`);
  }
  return component;
};

// Spell-specific material requirements
export const SPELL_MATERIAL_REQUIREMENTS: Record<string, SpellMaterialRequirement> = {
  // Cantrips
  booming_blade: {
    spellId: "booming_blade",
    spellName: "Booming Blade",
    level: 0,
    components: [getComponent("melee_weapon_1sp")],
  },
  dancing_lights: {
    spellId: "dancing_lights",
    spellName: "Dancing Lights",
    level: 0,
    components: [],
    alternativeComponents: [
      [getComponent("bit_of_phosphorus")],
      [getComponent("bit_of_wytchwood")],
      [getComponent("glowworm")],
    ],
  },
  friends: {
    spellId: "friends",
    spellName: "Friends",
    level: 0,
    components: [getComponent("makeup_face")],
  },
  green_flame_blade: {
    spellId: "green_flame_blade",
    spellName: "Green-Flame Blade",
    level: 0,
    components: [getComponent("melee_weapon_1sp")],
  },
  infestation: {
    spellId: "infestation",
    spellName: "Infestation",
    level: 0,
    components: [getComponent("living_flea")],
  },
  light: {
    spellId: "light",
    spellName: "Light",
    level: 0,
    components: [],
    alternativeComponents: [[getComponent("firefly")], [getComponent("phosphorescent_moss")]],
  },
  mending: {
    spellId: "mending",
    spellName: "Mending",
    level: 0,
    components: [getComponent("two_lodestones")],
  },
  message: {
    spellId: "message",
    spellName: "Message",
    level: 0,
    components: [getComponent("copper_wire_short")],
  },
  minor_illusion: {
    spellId: "minor_illusion",
    spellName: "Minor Illusion",
    level: 0,
    components: [getComponent("bit_of_fleece")],
  },
  prestidigitation: {
    spellId: "prestidigitation",
    spellName: "Prestidigitation",
    level: 0,
    components: [], // No material components
  },
  resistance: {
    spellId: "resistance",
    spellName: "Resistance",
    level: 0,
    components: [getComponent("miniature_cloak")],
  },
  shillelagh: {
    spellId: "shillelagh",
    spellName: "Shillelagh",
    level: 0,
    components: [],
    alternativeComponents: [
      [getComponent("mistletoe"), getComponent("club_or_quarterstaff")],
      [getComponent("shamrock_leaf"), getComponent("club_or_quarterstaff")],
    ],
  },
  thorn_whip: {
    spellId: "thorn_whip",
    spellName: "Thorn Whip",
    level: 0,
    components: [getComponent("thorn_stem")],
  },
  word_of_radiance: {
    spellId: "word_of_radiance",
    spellName: "Word of Radiance",
    level: 0,
    components: [getComponent("holy_symbol")],
  },

  // Level 1 spells (sample)
  alarm: {
    spellId: "alarm",
    spellName: "Alarm",
    level: 1,
    components: [],
    alternativeComponents: [[getComponent("tiny_bell")], [getComponent("fine_silver_wire")]],
  },
  animal_friendship: {
    spellId: "animal_friendship",
    spellName: "Animal Friendship",
    level: 1,
    components: [getComponent("morsel_of_food")],
  },
  armor_of_agathys: {
    spellId: "armor_of_agathys",
    spellName: "Armor of Agathys",
    level: 1,
    components: [getComponent("cup_of_water")],
  },
  bane: {
    spellId: "bane",
    spellName: "Bane",
    level: 1,
    components: [getComponent("drop_of_blood")],
  },
  beast_bond: {
    spellId: "beast_bond",
    spellName: "Beast Bond",
    level: 1,
    components: [getComponent("bit_fur_cloth")],
  },
  bless: {
    spellId: "bless",
    spellName: "Bless",
    level: 1,
    components: [getComponent("holy_water_sprinkle")],
  },
  ceremony: {
    spellId: "ceremony",
    spellName: "Ceremony",
    level: 1,
    components: [getComponent("powdered_silver_25gp")],
  },
  chromatic_orb: {
    spellId: "chromatic_orb",
    spellName: "Chromatic Orb",
    level: 1,
    components: [getComponent("diamond_50gp")],
  },

  // High-level spell examples
  revivify: {
    spellId: "revivify",
    spellName: "Revivify",
    level: 3,
    components: [getComponent("diamond_300gp")],
  },
  raise_dead: {
    spellId: "raise_dead",
    spellName: "Raise Dead",
    level: 5,
    components: [getComponent("diamond_500gp")],
  },
  resurrection: {
    spellId: "resurrection",
    spellName: "Resurrection",
    level: 7,
    components: [getComponent("diamond_1000gp")],
  },
  true_resurrection: {
    spellId: "true_resurrection",
    spellName: "True Resurrection",
    level: 9,
    components: [getComponent("diamonds_25000gp")],
  },
};

// Helper functions for material component validation
export class MaterialComponentValidator {
  static validateSpellComponents(
    spellId: string,
    availableComponents: MaterialComponent[],
  ): { valid: boolean; missing: MaterialComponent[]; alternatives?: MaterialComponent[][] } {
    const requirement = SPELL_MATERIAL_REQUIREMENTS[spellId];
    if (!requirement) {
      return { valid: true, missing: [] };
    }

    // Check primary components
    const missing = requirement.components.filter(
      (required) => !availableComponents.some((available) => available.id === required.id),
    );

    if (missing.length === 0) {
      return { valid: true, missing: [] };
    }

    // Check alternative components if primary missing
    if (requirement.alternativeComponents) {
      for (const alternative of requirement.alternativeComponents) {
        const altMissing = alternative.filter(
          (required) => !availableComponents.some((available) => available.id === required.id),
        );
        if (altMissing.length === 0) {
          return { valid: true, missing: [] };
        }
      }
      return {
        valid: false,
        missing,
        alternatives: requirement.alternativeComponents,
      };
    }

    return { valid: false, missing };
  }

  static getComponentCost(spellId: string): number {
    const requirement = SPELL_MATERIAL_REQUIREMENTS[spellId];
    if (!requirement) {return 0;}

    return requirement.components.reduce((total, component) => total + (component.cost || 0), 0);
  }

  static consumeComponents(
    spellId: string,
    availableComponents: MaterialComponent[],
  ): MaterialComponent[] {
    const requirement = SPELL_MATERIAL_REQUIREMENTS[spellId];
    if (!requirement) {return availableComponents;}

    const consumed = requirement.components.filter((comp) => comp.consumed);
    return availableComponents.filter(
      (available) => !consumed.some((consumedComp) => consumedComp.id === available.id),
    );
  }
}

export const _materialComponentValidator = new MaterialComponentValidator();
