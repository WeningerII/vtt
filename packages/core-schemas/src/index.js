import { z } from "zod";
/**
 * Core domain schemas for the virtual tabletop. These are used on
 * both client and server to validate and parse data. They can also be
 * compiled to protobuf or flatbuffers if desired.
 */
export const UserSchema = z.object({
    id: z.string(),
    displayName: z.string(),
    roles: z.array(z.string()),
});
export const CampaignSchema = z.object({
    id: z.string(),
    name: z.string(),
    members: z.array(UserSchema),
});
export const SceneSchema = z.object({
    id: z.string(),
    campaignId: z.string(),
    mapId: z.string().optional(),
    tickRate: z.number().int().positive().default(15),
});
// Map domain schemas
export const AssetKindSchema = z.enum([
    "ORIGINAL",
    "DEPTH",
    "MASK",
    "TILE",
    "THUMBNAIL",
    "METADATA",
]);
export const GameMapSchema = z.object({
    id: z.string(),
    name: z.string(),
    widthPx: z.number().int().positive(),
    heightPx: z.number().int().positive(),
    gridSizePx: z.number().int().positive().default(70),
});
export const AssetSchema = z.object({
    id: z.string(),
    mapId: z.string().optional(),
    kind: AssetKindSchema,
    uri: z.string(),
    mimeType: z.string().optional(),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
    sizeBytes: z.number().int().nonnegative().optional(),
    checksum: z.string().optional(),
});
export const JobTypeSchema = z.enum(["TEXT_TO_IMAGE", "DEPTH", "SEGMENTATION"]);
export const JobStatusSchema = z.enum(["QUEUED", "RUNNING", "SUCCEEDED", "FAILED", "CANCELED"]);
export const GenerationJobSchema = z.object({
    id: z.string(),
    type: JobTypeSchema,
    status: JobStatusSchema,
    input: z.unknown(),
    output: z.unknown().optional(),
    error: z.string().optional(),
    mapId: z.string().optional(),
});
export const ProviderCallSchema = z.object({
    id: z.string(),
    jobId: z.string(),
    provider: z.string(),
    model: z.string().optional(),
    costUSD: z.number().nonnegative().default(0),
    latencyMs: z.number().int().nonnegative().optional(),
    success: z.boolean().default(true),
    error: z.string().optional(),
});
// ==========================================
// D&D 5e Monster Stat Block Schemas
// These schemas model common 5e monster fields while
// staying generic enough for VTT usage.
// ==========================================
// Core enums and primitives
export const SizeSchema = z.enum(["TINY", "SMALL", "MEDIUM", "LARGE", "HUGE", "GARGANTUAN"]);
export const CreatureTypeSchema = z.enum([
    "ABERRATION",
    "BEAST",
    "CELESTIAL",
    "CONSTRUCT",
    "DRAGON",
    "ELEMENTAL",
    "FEY",
    "FIEND",
    "GIANT",
    "HUMANOID",
    "MONSTROSITY",
    "OOZE",
    "PLANT",
    "UNDEAD",
]);
export const AbilityKeySchema = z.enum(["STR", "DEX", "CON", "INT", "WIS", "CHA"]);
export const AbilityScoresSchema = z.object({
    STR: z.number().int().min(1).max(30),
    DEX: z.number().int().min(1).max(30),
    CON: z.number().int().min(1).max(30),
    INT: z.number().int().min(1).max(30),
    WIS: z.number().int().min(1).max(30),
    CHA: z.number().int().min(1).max(30),
});
export const SavingThrowsSchema = z.object({
    STR: z.number().int().optional(),
    DEX: z.number().int().optional(),
    CON: z.number().int().optional(),
    INT: z.number().int().optional(),
    WIS: z.number().int().optional(),
    CHA: z.number().int().optional(),
});
export const SkillNameSchema = z.enum([
    "ACROBATICS",
    "ANIMAL_HANDLING",
    "ARCANA",
    "ATHLETICS",
    "DECEPTION",
    "HISTORY",
    "INSIGHT",
    "INTIMIDATION",
    "INVESTIGATION",
    "MEDICINE",
    "NATURE",
    "PERCEPTION",
    "PERFORMANCE",
    "PERSUASION",
    "RELIGION",
    "SLEIGHT_OF_HAND",
    "STEALTH",
    "SURVIVAL",
]);
// Explicit optional keys so only valid skills are accepted
export const SkillsBonusSchema = z.object({
    ACROBATICS: z.number().int().optional(),
    ANIMAL_HANDLING: z.number().int().optional(),
    ARCANA: z.number().int().optional(),
    ATHLETICS: z.number().int().optional(),
    DECEPTION: z.number().int().optional(),
    HISTORY: z.number().int().optional(),
    INSIGHT: z.number().int().optional(),
    INTIMIDATION: z.number().int().optional(),
    INVESTIGATION: z.number().int().optional(),
    MEDICINE: z.number().int().optional(),
    NATURE: z.number().int().optional(),
    PERCEPTION: z.number().int().optional(),
    PERFORMANCE: z.number().int().optional(),
    PERSUASION: z.number().int().optional(),
    RELIGION: z.number().int().optional(),
    SLEIGHT_OF_HAND: z.number().int().optional(),
    STEALTH: z.number().int().optional(),
    SURVIVAL: z.number().int().optional(),
});
export const DamageTypeSchema = z.enum([
    "ACID",
    "BLUDGEONING",
    "COLD",
    "FIRE",
    "FORCE",
    "LIGHTNING",
    "NECROTIC",
    "PIERCING",
    "POISON",
    "PSYCHIC",
    "RADIANT",
    "SLASHING",
    "THUNDER",
]);
export const ArmorClassSchema = z.object({
    value: z.number().int().positive(),
    type: z.string().optional(), // e.g., Natural Armor, Leather, Mage Armor, with shield
    notes: z.string().optional(),
});
export const HitPointsSchema = z.object({
    average: z.number().int().nonnegative(),
    formula: z.string().optional(), // e.g., 5 (2d6-2)
});
export const SpeedSchema = z.object({
    walk: z.number().int().nonnegative().optional(),
    burrow: z.number().int().nonnegative().optional(),
    climb: z.number().int().nonnegative().optional(),
    fly: z.number().int().nonnegative().optional(),
    swim: z.number().int().nonnegative().optional(),
    hover: z.boolean().optional(),
    notes: z.string().optional(),
});
export const SenseTypeSchema = z.enum(["BLINDSIGHT", "DARKVISION", "TREMORSENSE", "TRUESIGHT"]);
export const SenseEntrySchema = z.object({
    type: SenseTypeSchema,
    rangeFt: z.number().int().positive(),
});
export const UsageSchema = z.object({
    kind: z.enum(["AT_WILL", "PER_DAY", "PER_REST", "RECHARGE"]),
    per: z.number().int().positive().optional(), // used with PER_DAY
    rest: z.enum(["SHORT", "LONG"]).optional(), // used with PER_REST
    rechargeOn: z.string().optional(), // e.g., "5-6"
});
export const DamageComponentSchema = z.object({
    average: z.number().int().nonnegative(),
    formula: z.string().optional(), // e.g., 1d8+3
    type: DamageTypeSchema,
});
export const AttackKindSchema = z.enum([
    "MELEE_WEAPON",
    "RANGED_WEAPON",
    "MELEE_SPELL",
    "RANGED_SPELL",
]);
export const AttackActionSchema = z.object({
    name: z.string(),
    kind: z.literal("ATTACK"),
    attackType: AttackKindSchema,
    toHitBonus: z.number().int(),
    reachFt: z.number().int().positive().optional(),
    rangeFt: z.tuple([z.number().int().positive(), z.number().int().positive()]).optional(), // normal, long
    target: z.string().default("one target"),
    onHit: z.array(DamageComponentSchema).min(1),
    onHitText: z.string().optional(),
    description: z.string().optional(),
    usage: UsageSchema.optional(),
});
export const SaveActionSchema = z.object({
    name: z.string(),
    kind: z.literal("SAVE"),
    ability: AbilityKeySchema,
    dc: z.number().int().positive(),
    effectOnFailure: z.string(),
    effectOnSuccess: z.string().optional(),
    usage: UsageSchema.optional(),
});
export const TextActionSchema = z.object({
    name: z.string(),
    kind: z.literal("TEXT"),
    description: z.string(),
    usage: UsageSchema.optional(),
});
export const MultiattackActionSchema = z.object({
    name: z.string().default("Multiattack"),
    kind: z.literal("MULTIATTACK"),
    description: z.string(),
});
export const ActionSchema = z.union([
    AttackActionSchema,
    SaveActionSchema,
    TextActionSchema,
    MultiattackActionSchema,
]);
export const LegendaryActionSchema = z.object({
    name: z.string(),
    description: z.string(),
    cost: z.number().int().positive().max(3).default(1),
});
export const ChallengeRatingSchema = z.enum([
    "0",
    "1/8",
    "1/4",
    "1/2",
    "1",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "10",
    "11",
    "12",
    "13",
    "14",
    "15",
    "16",
    "17",
    "18",
    "19",
    "20",
    "21",
    "22",
    "23",
    "24",
    "25",
    "26",
    "27",
    "28",
    "29",
    "30",
]);
export const MonsterSchema = z.object({
    id: z.string(),
    name: z.string(),
    size: SizeSchema,
    type: CreatureTypeSchema,
    alignment: z.string().min(1), // free text to capture SRD variations
    ac: ArmorClassSchema,
    hp: HitPointsSchema,
    speed: SpeedSchema,
    abilities: AbilityScoresSchema,
    savingThrows: SavingThrowsSchema.optional(),
    skills: SkillsBonusSchema.optional(),
    damageResistances: z.array(z.string()).optional(),
    damageImmunities: z.array(z.string()).optional(),
    damageVulnerabilities: z.array(z.string()).optional(),
    conditionImmunities: z.array(z.string()).optional(),
    senses: z.array(SenseEntrySchema).optional(),
    passivePerception: z.number().int().optional(),
    languages: z.array(z.string()).optional(),
    telepathyFt: z.number().int().positive().optional(),
    languageNote: z.string().optional(),
    challengeRating: ChallengeRatingSchema,
    xp: z.number().int().nonnegative().optional(),
    proficiencyBonus: z.number().int().optional(), // override when needed
    traits: z.array(TextActionSchema).default([]),
    actions: z.array(ActionSchema).default([]),
    bonusActions: z.array(TextActionSchema).default([]),
    reactions: z.array(TextActionSchema).default([]),
    legendaryActions: z.array(LegendaryActionSchema).default([]),
    legendaryActionsPerRound: z.number().int().nonnegative().default(0),
    source: z.string().optional(), // e.g., SRD 5.1
    tags: z.array(z.string()).optional(),
});
// Re-exports for shared protocol schemas
export * from './messages';
export * from './events';
export * from './character';
//# sourceMappingURL=index.js.map