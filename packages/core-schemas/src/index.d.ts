import { z } from "zod";
/**
 * Core domain schemas for the virtual tabletop. These are used on
 * both client and server to validate and parse data. They can also be
 * compiled to protobuf or flatbuffers if desired.
 */
export declare const UserSchema: z.ZodObject<{
    id: z.ZodString;
    displayName: z.ZodString;
    roles: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    id: string;
    displayName: string;
    roles: string[];
}, {
    id: string;
    displayName: string;
    roles: string[];
}>;
export type User = z.infer<typeof UserSchema>;
export declare const CampaignSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    members: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        displayName: z.ZodString;
        roles: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        id: string;
        displayName: string;
        roles: string[];
    }, {
        id: string;
        displayName: string;
        roles: string[];
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    id: string;
    name: string;
    members: {
        id: string;
        displayName: string;
        roles: string[];
    }[];
}, {
    id: string;
    name: string;
    members: {
        id: string;
        displayName: string;
        roles: string[];
    }[];
}>;
export type Campaign = z.infer<typeof CampaignSchema>;
export declare const SceneSchema: z.ZodObject<{
    id: z.ZodString;
    campaignId: z.ZodString;
    mapId: z.ZodOptional<z.ZodString>;
    tickRate: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    tickRate: number;
    id: string;
    campaignId: string;
    mapId?: string | undefined;
}, {
    id: string;
    campaignId: string;
    tickRate?: number | undefined;
    mapId?: string | undefined;
}>;
export type Scene = z.infer<typeof SceneSchema>;
export declare const AssetKindSchema: z.ZodEnum<["ORIGINAL", "DEPTH", "MASK", "TILE", "THUMBNAIL", "METADATA"]>;
export type AssetKind = z.infer<typeof AssetKindSchema>;
export declare const GameMapSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    widthPx: z.ZodNumber;
    heightPx: z.ZodNumber;
    gridSizePx: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    id: string;
    name: string;
    widthPx: number;
    heightPx: number;
    gridSizePx: number;
}, {
    id: string;
    name: string;
    widthPx: number;
    heightPx: number;
    gridSizePx?: number | undefined;
}>;
export type GameMap = z.infer<typeof GameMapSchema>;
export declare const AssetSchema: z.ZodObject<{
    id: z.ZodString;
    mapId: z.ZodOptional<z.ZodString>;
    kind: z.ZodEnum<["ORIGINAL", "DEPTH", "MASK", "TILE", "THUMBNAIL", "METADATA"]>;
    uri: z.ZodString;
    mimeType: z.ZodOptional<z.ZodString>;
    width: z.ZodOptional<z.ZodNumber>;
    height: z.ZodOptional<z.ZodNumber>;
    sizeBytes: z.ZodOptional<z.ZodNumber>;
    checksum: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    id: string;
    kind: "ORIGINAL" | "DEPTH" | "MASK" | "TILE" | "THUMBNAIL" | "METADATA";
    uri: string;
    mapId?: string | undefined;
    mimeType?: string | undefined;
    width?: number | undefined;
    height?: number | undefined;
    sizeBytes?: number | undefined;
    checksum?: string | undefined;
}, {
    id: string;
    kind: "ORIGINAL" | "DEPTH" | "MASK" | "TILE" | "THUMBNAIL" | "METADATA";
    uri: string;
    mapId?: string | undefined;
    mimeType?: string | undefined;
    width?: number | undefined;
    height?: number | undefined;
    sizeBytes?: number | undefined;
    checksum?: string | undefined;
}>;
export type Asset = z.infer<typeof AssetSchema>;
export declare const JobTypeSchema: z.ZodEnum<["TEXT_TO_IMAGE", "DEPTH", "SEGMENTATION"]>;
export type JobType = z.infer<typeof JobTypeSchema>;
export declare const JobStatusSchema: z.ZodEnum<["QUEUED", "RUNNING", "SUCCEEDED", "FAILED", "CANCELED"]>;
export type JobStatus = z.infer<typeof JobStatusSchema>;
export declare const GenerationJobSchema: z.ZodObject<{
    id: z.ZodString;
    type: z.ZodEnum<["TEXT_TO_IMAGE", "DEPTH", "SEGMENTATION"]>;
    status: z.ZodEnum<["QUEUED", "RUNNING", "SUCCEEDED", "FAILED", "CANCELED"]>;
    input: z.ZodUnknown;
    output: z.ZodOptional<z.ZodUnknown>;
    error: z.ZodOptional<z.ZodString>;
    mapId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: "DEPTH" | "TEXT_TO_IMAGE" | "SEGMENTATION";
    status: "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELED";
    id: string;
    mapId?: string | undefined;
    input?: unknown;
    output?: unknown;
    error?: string | undefined;
}, {
    type: "DEPTH" | "TEXT_TO_IMAGE" | "SEGMENTATION";
    status: "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELED";
    id: string;
    mapId?: string | undefined;
    input?: unknown;
    output?: unknown;
    error?: string | undefined;
}>;
export type GenerationJob = z.infer<typeof GenerationJobSchema>;
export declare const ProviderCallSchema: z.ZodObject<{
    id: z.ZodString;
    jobId: z.ZodString;
    provider: z.ZodString;
    model: z.ZodOptional<z.ZodString>;
    costUSD: z.ZodDefault<z.ZodNumber>;
    latencyMs: z.ZodOptional<z.ZodNumber>;
    success: z.ZodDefault<z.ZodBoolean>;
    error: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    id: string;
    jobId: string;
    provider: string;
    costUSD: number;
    success: boolean;
    error?: string | undefined;
    model?: string | undefined;
    latencyMs?: number | undefined;
}, {
    id: string;
    jobId: string;
    provider: string;
    error?: string | undefined;
    model?: string | undefined;
    costUSD?: number | undefined;
    latencyMs?: number | undefined;
    success?: boolean | undefined;
}>;
export type ProviderCall = z.infer<typeof ProviderCallSchema>;
export declare const SizeSchema: z.ZodEnum<["TINY", "SMALL", "MEDIUM", "LARGE", "HUGE", "GARGANTUAN"]>;
export type Size = z.infer<typeof SizeSchema>;
export declare const CreatureTypeSchema: z.ZodEnum<["ABERRATION", "BEAST", "CELESTIAL", "CONSTRUCT", "DRAGON", "ELEMENTAL", "FEY", "FIEND", "GIANT", "HUMANOID", "MONSTROSITY", "OOZE", "PLANT", "UNDEAD"]>;
export type CreatureType = z.infer<typeof CreatureTypeSchema>;
export declare const AbilityKeySchema: z.ZodEnum<["STR", "DEX", "CON", "INT", "WIS", "CHA"]>;
export type AbilityKey = z.infer<typeof AbilityKeySchema>;
export declare const AbilityScoresSchema: z.ZodObject<{
    STR: z.ZodNumber;
    DEX: z.ZodNumber;
    CON: z.ZodNumber;
    INT: z.ZodNumber;
    WIS: z.ZodNumber;
    CHA: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    STR: number;
    DEX: number;
    CON: number;
    INT: number;
    WIS: number;
    CHA: number;
}, {
    STR: number;
    DEX: number;
    CON: number;
    INT: number;
    WIS: number;
    CHA: number;
}>;
export type AbilityScores = z.infer<typeof AbilityScoresSchema>;
export declare const SavingThrowsSchema: z.ZodObject<{
    STR: z.ZodOptional<z.ZodNumber>;
    DEX: z.ZodOptional<z.ZodNumber>;
    CON: z.ZodOptional<z.ZodNumber>;
    INT: z.ZodOptional<z.ZodNumber>;
    WIS: z.ZodOptional<z.ZodNumber>;
    CHA: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    STR?: number | undefined;
    DEX?: number | undefined;
    CON?: number | undefined;
    INT?: number | undefined;
    WIS?: number | undefined;
    CHA?: number | undefined;
}, {
    STR?: number | undefined;
    DEX?: number | undefined;
    CON?: number | undefined;
    INT?: number | undefined;
    WIS?: number | undefined;
    CHA?: number | undefined;
}>;
export type SavingThrows = z.infer<typeof SavingThrowsSchema>;
export declare const SkillNameSchema: z.ZodEnum<["ACROBATICS", "ANIMAL_HANDLING", "ARCANA", "ATHLETICS", "DECEPTION", "HISTORY", "INSIGHT", "INTIMIDATION", "INVESTIGATION", "MEDICINE", "NATURE", "PERCEPTION", "PERFORMANCE", "PERSUASION", "RELIGION", "SLEIGHT_OF_HAND", "STEALTH", "SURVIVAL"]>;
export type SkillName = z.infer<typeof SkillNameSchema>;
export declare const SkillsBonusSchema: z.ZodObject<{
    ACROBATICS: z.ZodOptional<z.ZodNumber>;
    ANIMAL_HANDLING: z.ZodOptional<z.ZodNumber>;
    ARCANA: z.ZodOptional<z.ZodNumber>;
    ATHLETICS: z.ZodOptional<z.ZodNumber>;
    DECEPTION: z.ZodOptional<z.ZodNumber>;
    HISTORY: z.ZodOptional<z.ZodNumber>;
    INSIGHT: z.ZodOptional<z.ZodNumber>;
    INTIMIDATION: z.ZodOptional<z.ZodNumber>;
    INVESTIGATION: z.ZodOptional<z.ZodNumber>;
    MEDICINE: z.ZodOptional<z.ZodNumber>;
    NATURE: z.ZodOptional<z.ZodNumber>;
    PERCEPTION: z.ZodOptional<z.ZodNumber>;
    PERFORMANCE: z.ZodOptional<z.ZodNumber>;
    PERSUASION: z.ZodOptional<z.ZodNumber>;
    RELIGION: z.ZodOptional<z.ZodNumber>;
    SLEIGHT_OF_HAND: z.ZodOptional<z.ZodNumber>;
    STEALTH: z.ZodOptional<z.ZodNumber>;
    SURVIVAL: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    ACROBATICS?: number | undefined;
    ANIMAL_HANDLING?: number | undefined;
    ARCANA?: number | undefined;
    ATHLETICS?: number | undefined;
    DECEPTION?: number | undefined;
    HISTORY?: number | undefined;
    INSIGHT?: number | undefined;
    INTIMIDATION?: number | undefined;
    INVESTIGATION?: number | undefined;
    MEDICINE?: number | undefined;
    NATURE?: number | undefined;
    PERCEPTION?: number | undefined;
    PERFORMANCE?: number | undefined;
    PERSUASION?: number | undefined;
    RELIGION?: number | undefined;
    SLEIGHT_OF_HAND?: number | undefined;
    STEALTH?: number | undefined;
    SURVIVAL?: number | undefined;
}, {
    ACROBATICS?: number | undefined;
    ANIMAL_HANDLING?: number | undefined;
    ARCANA?: number | undefined;
    ATHLETICS?: number | undefined;
    DECEPTION?: number | undefined;
    HISTORY?: number | undefined;
    INSIGHT?: number | undefined;
    INTIMIDATION?: number | undefined;
    INVESTIGATION?: number | undefined;
    MEDICINE?: number | undefined;
    NATURE?: number | undefined;
    PERCEPTION?: number | undefined;
    PERFORMANCE?: number | undefined;
    PERSUASION?: number | undefined;
    RELIGION?: number | undefined;
    SLEIGHT_OF_HAND?: number | undefined;
    STEALTH?: number | undefined;
    SURVIVAL?: number | undefined;
}>;
export type SkillsBonus = z.infer<typeof SkillsBonusSchema>;
export declare const DamageTypeSchema: z.ZodEnum<["ACID", "BLUDGEONING", "COLD", "FIRE", "FORCE", "LIGHTNING", "NECROTIC", "PIERCING", "POISON", "PSYCHIC", "RADIANT", "SLASHING", "THUNDER"]>;
export type DamageType = z.infer<typeof DamageTypeSchema>;
export declare const ArmorClassSchema: z.ZodObject<{
    value: z.ZodNumber;
    type: z.ZodOptional<z.ZodString>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    value: number;
    type?: string | undefined;
    notes?: string | undefined;
}, {
    value: number;
    type?: string | undefined;
    notes?: string | undefined;
}>;
export type ArmorClass = z.infer<typeof ArmorClassSchema>;
export declare const HitPointsSchema: z.ZodObject<{
    average: z.ZodNumber;
    formula: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    average: number;
    formula?: string | undefined;
}, {
    average: number;
    formula?: string | undefined;
}>;
export type HitPoints = z.infer<typeof HitPointsSchema>;
export declare const SpeedSchema: z.ZodObject<{
    walk: z.ZodOptional<z.ZodNumber>;
    burrow: z.ZodOptional<z.ZodNumber>;
    climb: z.ZodOptional<z.ZodNumber>;
    fly: z.ZodOptional<z.ZodNumber>;
    swim: z.ZodOptional<z.ZodNumber>;
    hover: z.ZodOptional<z.ZodBoolean>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    notes?: string | undefined;
    walk?: number | undefined;
    burrow?: number | undefined;
    climb?: number | undefined;
    fly?: number | undefined;
    swim?: number | undefined;
    hover?: boolean | undefined;
}, {
    notes?: string | undefined;
    walk?: number | undefined;
    burrow?: number | undefined;
    climb?: number | undefined;
    fly?: number | undefined;
    swim?: number | undefined;
    hover?: boolean | undefined;
}>;
export type Speed = z.infer<typeof SpeedSchema>;
export declare const SenseTypeSchema: z.ZodEnum<["BLINDSIGHT", "DARKVISION", "TREMORSENSE", "TRUESIGHT"]>;
export type SenseType = z.infer<typeof SenseTypeSchema>;
export declare const SenseEntrySchema: z.ZodObject<{
    type: z.ZodEnum<["BLINDSIGHT", "DARKVISION", "TREMORSENSE", "TRUESIGHT"]>;
    rangeFt: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    type: "BLINDSIGHT" | "DARKVISION" | "TREMORSENSE" | "TRUESIGHT";
    rangeFt: number;
}, {
    type: "BLINDSIGHT" | "DARKVISION" | "TREMORSENSE" | "TRUESIGHT";
    rangeFt: number;
}>;
export type SenseEntry = z.infer<typeof SenseEntrySchema>;
export declare const UsageSchema: z.ZodObject<{
    kind: z.ZodEnum<["AT_WILL", "PER_DAY", "PER_REST", "RECHARGE"]>;
    per: z.ZodOptional<z.ZodNumber>;
    rest: z.ZodOptional<z.ZodEnum<["SHORT", "LONG"]>>;
    rechargeOn: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    kind: "AT_WILL" | "PER_DAY" | "PER_REST" | "RECHARGE";
    per?: number | undefined;
    rest?: "SHORT" | "LONG" | undefined;
    rechargeOn?: string | undefined;
}, {
    kind: "AT_WILL" | "PER_DAY" | "PER_REST" | "RECHARGE";
    per?: number | undefined;
    rest?: "SHORT" | "LONG" | undefined;
    rechargeOn?: string | undefined;
}>;
export type Usage = z.infer<typeof UsageSchema>;
export declare const DamageComponentSchema: z.ZodObject<{
    average: z.ZodNumber;
    formula: z.ZodOptional<z.ZodString>;
    type: z.ZodEnum<["ACID", "BLUDGEONING", "COLD", "FIRE", "FORCE", "LIGHTNING", "NECROTIC", "PIERCING", "POISON", "PSYCHIC", "RADIANT", "SLASHING", "THUNDER"]>;
}, "strip", z.ZodTypeAny, {
    type: "ACID" | "BLUDGEONING" | "COLD" | "FIRE" | "FORCE" | "LIGHTNING" | "NECROTIC" | "PIERCING" | "POISON" | "PSYCHIC" | "RADIANT" | "SLASHING" | "THUNDER";
    average: number;
    formula?: string | undefined;
}, {
    type: "ACID" | "BLUDGEONING" | "COLD" | "FIRE" | "FORCE" | "LIGHTNING" | "NECROTIC" | "PIERCING" | "POISON" | "PSYCHIC" | "RADIANT" | "SLASHING" | "THUNDER";
    average: number;
    formula?: string | undefined;
}>;
export type DamageComponent = z.infer<typeof DamageComponentSchema>;
export declare const AttackKindSchema: z.ZodEnum<["MELEE_WEAPON", "RANGED_WEAPON", "MELEE_SPELL", "RANGED_SPELL"]>;
export type AttackKind = z.infer<typeof AttackKindSchema>;
export declare const AttackActionSchema: z.ZodObject<{
    name: z.ZodString;
    kind: z.ZodLiteral<"ATTACK">;
    attackType: z.ZodEnum<["MELEE_WEAPON", "RANGED_WEAPON", "MELEE_SPELL", "RANGED_SPELL"]>;
    toHitBonus: z.ZodNumber;
    reachFt: z.ZodOptional<z.ZodNumber>;
    rangeFt: z.ZodOptional<z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>>;
    target: z.ZodDefault<z.ZodString>;
    onHit: z.ZodArray<z.ZodObject<{
        average: z.ZodNumber;
        formula: z.ZodOptional<z.ZodString>;
        type: z.ZodEnum<["ACID", "BLUDGEONING", "COLD", "FIRE", "FORCE", "LIGHTNING", "NECROTIC", "PIERCING", "POISON", "PSYCHIC", "RADIANT", "SLASHING", "THUNDER"]>;
    }, "strip", z.ZodTypeAny, {
        type: "ACID" | "BLUDGEONING" | "COLD" | "FIRE" | "FORCE" | "LIGHTNING" | "NECROTIC" | "PIERCING" | "POISON" | "PSYCHIC" | "RADIANT" | "SLASHING" | "THUNDER";
        average: number;
        formula?: string | undefined;
    }, {
        type: "ACID" | "BLUDGEONING" | "COLD" | "FIRE" | "FORCE" | "LIGHTNING" | "NECROTIC" | "PIERCING" | "POISON" | "PSYCHIC" | "RADIANT" | "SLASHING" | "THUNDER";
        average: number;
        formula?: string | undefined;
    }>, "many">;
    onHitText: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    usage: z.ZodOptional<z.ZodObject<{
        kind: z.ZodEnum<["AT_WILL", "PER_DAY", "PER_REST", "RECHARGE"]>;
        per: z.ZodOptional<z.ZodNumber>;
        rest: z.ZodOptional<z.ZodEnum<["SHORT", "LONG"]>>;
        rechargeOn: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        kind: "AT_WILL" | "PER_DAY" | "PER_REST" | "RECHARGE";
        per?: number | undefined;
        rest?: "SHORT" | "LONG" | undefined;
        rechargeOn?: string | undefined;
    }, {
        kind: "AT_WILL" | "PER_DAY" | "PER_REST" | "RECHARGE";
        per?: number | undefined;
        rest?: "SHORT" | "LONG" | undefined;
        rechargeOn?: string | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    kind: "ATTACK";
    attackType: "MELEE_WEAPON" | "RANGED_WEAPON" | "MELEE_SPELL" | "RANGED_SPELL";
    toHitBonus: number;
    target: string;
    onHit: {
        type: "ACID" | "BLUDGEONING" | "COLD" | "FIRE" | "FORCE" | "LIGHTNING" | "NECROTIC" | "PIERCING" | "POISON" | "PSYCHIC" | "RADIANT" | "SLASHING" | "THUNDER";
        average: number;
        formula?: string | undefined;
    }[];
    rangeFt?: [number, number] | undefined;
    reachFt?: number | undefined;
    onHitText?: string | undefined;
    description?: string | undefined;
    usage?: {
        kind: "AT_WILL" | "PER_DAY" | "PER_REST" | "RECHARGE";
        per?: number | undefined;
        rest?: "SHORT" | "LONG" | undefined;
        rechargeOn?: string | undefined;
    } | undefined;
}, {
    name: string;
    kind: "ATTACK";
    attackType: "MELEE_WEAPON" | "RANGED_WEAPON" | "MELEE_SPELL" | "RANGED_SPELL";
    toHitBonus: number;
    onHit: {
        type: "ACID" | "BLUDGEONING" | "COLD" | "FIRE" | "FORCE" | "LIGHTNING" | "NECROTIC" | "PIERCING" | "POISON" | "PSYCHIC" | "RADIANT" | "SLASHING" | "THUNDER";
        average: number;
        formula?: string | undefined;
    }[];
    rangeFt?: [number, number] | undefined;
    reachFt?: number | undefined;
    target?: string | undefined;
    onHitText?: string | undefined;
    description?: string | undefined;
    usage?: {
        kind: "AT_WILL" | "PER_DAY" | "PER_REST" | "RECHARGE";
        per?: number | undefined;
        rest?: "SHORT" | "LONG" | undefined;
        rechargeOn?: string | undefined;
    } | undefined;
}>;
export type AttackAction = z.infer<typeof AttackActionSchema>;
export declare const SaveActionSchema: z.ZodObject<{
    name: z.ZodString;
    kind: z.ZodLiteral<"SAVE">;
    ability: z.ZodEnum<["STR", "DEX", "CON", "INT", "WIS", "CHA"]>;
    dc: z.ZodNumber;
    effectOnFailure: z.ZodString;
    effectOnSuccess: z.ZodOptional<z.ZodString>;
    usage: z.ZodOptional<z.ZodObject<{
        kind: z.ZodEnum<["AT_WILL", "PER_DAY", "PER_REST", "RECHARGE"]>;
        per: z.ZodOptional<z.ZodNumber>;
        rest: z.ZodOptional<z.ZodEnum<["SHORT", "LONG"]>>;
        rechargeOn: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        kind: "AT_WILL" | "PER_DAY" | "PER_REST" | "RECHARGE";
        per?: number | undefined;
        rest?: "SHORT" | "LONG" | undefined;
        rechargeOn?: string | undefined;
    }, {
        kind: "AT_WILL" | "PER_DAY" | "PER_REST" | "RECHARGE";
        per?: number | undefined;
        rest?: "SHORT" | "LONG" | undefined;
        rechargeOn?: string | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    kind: "SAVE";
    ability: "STR" | "DEX" | "CON" | "INT" | "WIS" | "CHA";
    dc: number;
    effectOnFailure: string;
    usage?: {
        kind: "AT_WILL" | "PER_DAY" | "PER_REST" | "RECHARGE";
        per?: number | undefined;
        rest?: "SHORT" | "LONG" | undefined;
        rechargeOn?: string | undefined;
    } | undefined;
    effectOnSuccess?: string | undefined;
}, {
    name: string;
    kind: "SAVE";
    ability: "STR" | "DEX" | "CON" | "INT" | "WIS" | "CHA";
    dc: number;
    effectOnFailure: string;
    usage?: {
        kind: "AT_WILL" | "PER_DAY" | "PER_REST" | "RECHARGE";
        per?: number | undefined;
        rest?: "SHORT" | "LONG" | undefined;
        rechargeOn?: string | undefined;
    } | undefined;
    effectOnSuccess?: string | undefined;
}>;
export type SaveAction = z.infer<typeof SaveActionSchema>;
export declare const TextActionSchema: z.ZodObject<{
    name: z.ZodString;
    kind: z.ZodLiteral<"TEXT">;
    description: z.ZodString;
    usage: z.ZodOptional<z.ZodObject<{
        kind: z.ZodEnum<["AT_WILL", "PER_DAY", "PER_REST", "RECHARGE"]>;
        per: z.ZodOptional<z.ZodNumber>;
        rest: z.ZodOptional<z.ZodEnum<["SHORT", "LONG"]>>;
        rechargeOn: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        kind: "AT_WILL" | "PER_DAY" | "PER_REST" | "RECHARGE";
        per?: number | undefined;
        rest?: "SHORT" | "LONG" | undefined;
        rechargeOn?: string | undefined;
    }, {
        kind: "AT_WILL" | "PER_DAY" | "PER_REST" | "RECHARGE";
        per?: number | undefined;
        rest?: "SHORT" | "LONG" | undefined;
        rechargeOn?: string | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    kind: "TEXT";
    description: string;
    usage?: {
        kind: "AT_WILL" | "PER_DAY" | "PER_REST" | "RECHARGE";
        per?: number | undefined;
        rest?: "SHORT" | "LONG" | undefined;
        rechargeOn?: string | undefined;
    } | undefined;
}, {
    name: string;
    kind: "TEXT";
    description: string;
    usage?: {
        kind: "AT_WILL" | "PER_DAY" | "PER_REST" | "RECHARGE";
        per?: number | undefined;
        rest?: "SHORT" | "LONG" | undefined;
        rechargeOn?: string | undefined;
    } | undefined;
}>;
export type TextAction = z.infer<typeof TextActionSchema>;
export declare const MultiattackActionSchema: z.ZodObject<{
    name: z.ZodDefault<z.ZodString>;
    kind: z.ZodLiteral<"MULTIATTACK">;
    description: z.ZodString;
}, "strip", z.ZodTypeAny, {
    name: string;
    kind: "MULTIATTACK";
    description: string;
}, {
    kind: "MULTIATTACK";
    description: string;
    name?: string | undefined;
}>;
export type MultiattackAction = z.infer<typeof MultiattackActionSchema>;
export declare const ActionSchema: z.ZodUnion<[z.ZodObject<{
    name: z.ZodString;
    kind: z.ZodLiteral<"ATTACK">;
    attackType: z.ZodEnum<["MELEE_WEAPON", "RANGED_WEAPON", "MELEE_SPELL", "RANGED_SPELL"]>;
    toHitBonus: z.ZodNumber;
    reachFt: z.ZodOptional<z.ZodNumber>;
    rangeFt: z.ZodOptional<z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>>;
    target: z.ZodDefault<z.ZodString>;
    onHit: z.ZodArray<z.ZodObject<{
        average: z.ZodNumber;
        formula: z.ZodOptional<z.ZodString>;
        type: z.ZodEnum<["ACID", "BLUDGEONING", "COLD", "FIRE", "FORCE", "LIGHTNING", "NECROTIC", "PIERCING", "POISON", "PSYCHIC", "RADIANT", "SLASHING", "THUNDER"]>;
    }, "strip", z.ZodTypeAny, {
        type: "ACID" | "BLUDGEONING" | "COLD" | "FIRE" | "FORCE" | "LIGHTNING" | "NECROTIC" | "PIERCING" | "POISON" | "PSYCHIC" | "RADIANT" | "SLASHING" | "THUNDER";
        average: number;
        formula?: string | undefined;
    }, {
        type: "ACID" | "BLUDGEONING" | "COLD" | "FIRE" | "FORCE" | "LIGHTNING" | "NECROTIC" | "PIERCING" | "POISON" | "PSYCHIC" | "RADIANT" | "SLASHING" | "THUNDER";
        average: number;
        formula?: string | undefined;
    }>, "many">;
    onHitText: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    usage: z.ZodOptional<z.ZodObject<{
        kind: z.ZodEnum<["AT_WILL", "PER_DAY", "PER_REST", "RECHARGE"]>;
        per: z.ZodOptional<z.ZodNumber>;
        rest: z.ZodOptional<z.ZodEnum<["SHORT", "LONG"]>>;
        rechargeOn: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        kind: "AT_WILL" | "PER_DAY" | "PER_REST" | "RECHARGE";
        per?: number | undefined;
        rest?: "SHORT" | "LONG" | undefined;
        rechargeOn?: string | undefined;
    }, {
        kind: "AT_WILL" | "PER_DAY" | "PER_REST" | "RECHARGE";
        per?: number | undefined;
        rest?: "SHORT" | "LONG" | undefined;
        rechargeOn?: string | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    kind: "ATTACK";
    attackType: "MELEE_WEAPON" | "RANGED_WEAPON" | "MELEE_SPELL" | "RANGED_SPELL";
    toHitBonus: number;
    target: string;
    onHit: {
        type: "ACID" | "BLUDGEONING" | "COLD" | "FIRE" | "FORCE" | "LIGHTNING" | "NECROTIC" | "PIERCING" | "POISON" | "PSYCHIC" | "RADIANT" | "SLASHING" | "THUNDER";
        average: number;
        formula?: string | undefined;
    }[];
    rangeFt?: [number, number] | undefined;
    reachFt?: number | undefined;
    onHitText?: string | undefined;
    description?: string | undefined;
    usage?: {
        kind: "AT_WILL" | "PER_DAY" | "PER_REST" | "RECHARGE";
        per?: number | undefined;
        rest?: "SHORT" | "LONG" | undefined;
        rechargeOn?: string | undefined;
    } | undefined;
}, {
    name: string;
    kind: "ATTACK";
    attackType: "MELEE_WEAPON" | "RANGED_WEAPON" | "MELEE_SPELL" | "RANGED_SPELL";
    toHitBonus: number;
    onHit: {
        type: "ACID" | "BLUDGEONING" | "COLD" | "FIRE" | "FORCE" | "LIGHTNING" | "NECROTIC" | "PIERCING" | "POISON" | "PSYCHIC" | "RADIANT" | "SLASHING" | "THUNDER";
        average: number;
        formula?: string | undefined;
    }[];
    rangeFt?: [number, number] | undefined;
    reachFt?: number | undefined;
    target?: string | undefined;
    onHitText?: string | undefined;
    description?: string | undefined;
    usage?: {
        kind: "AT_WILL" | "PER_DAY" | "PER_REST" | "RECHARGE";
        per?: number | undefined;
        rest?: "SHORT" | "LONG" | undefined;
        rechargeOn?: string | undefined;
    } | undefined;
}>, z.ZodObject<{
    name: z.ZodString;
    kind: z.ZodLiteral<"SAVE">;
    ability: z.ZodEnum<["STR", "DEX", "CON", "INT", "WIS", "CHA"]>;
    dc: z.ZodNumber;
    effectOnFailure: z.ZodString;
    effectOnSuccess: z.ZodOptional<z.ZodString>;
    usage: z.ZodOptional<z.ZodObject<{
        kind: z.ZodEnum<["AT_WILL", "PER_DAY", "PER_REST", "RECHARGE"]>;
        per: z.ZodOptional<z.ZodNumber>;
        rest: z.ZodOptional<z.ZodEnum<["SHORT", "LONG"]>>;
        rechargeOn: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        kind: "AT_WILL" | "PER_DAY" | "PER_REST" | "RECHARGE";
        per?: number | undefined;
        rest?: "SHORT" | "LONG" | undefined;
        rechargeOn?: string | undefined;
    }, {
        kind: "AT_WILL" | "PER_DAY" | "PER_REST" | "RECHARGE";
        per?: number | undefined;
        rest?: "SHORT" | "LONG" | undefined;
        rechargeOn?: string | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    kind: "SAVE";
    ability: "STR" | "DEX" | "CON" | "INT" | "WIS" | "CHA";
    dc: number;
    effectOnFailure: string;
    usage?: {
        kind: "AT_WILL" | "PER_DAY" | "PER_REST" | "RECHARGE";
        per?: number | undefined;
        rest?: "SHORT" | "LONG" | undefined;
        rechargeOn?: string | undefined;
    } | undefined;
    effectOnSuccess?: string | undefined;
}, {
    name: string;
    kind: "SAVE";
    ability: "STR" | "DEX" | "CON" | "INT" | "WIS" | "CHA";
    dc: number;
    effectOnFailure: string;
    usage?: {
        kind: "AT_WILL" | "PER_DAY" | "PER_REST" | "RECHARGE";
        per?: number | undefined;
        rest?: "SHORT" | "LONG" | undefined;
        rechargeOn?: string | undefined;
    } | undefined;
    effectOnSuccess?: string | undefined;
}>, z.ZodObject<{
    name: z.ZodString;
    kind: z.ZodLiteral<"TEXT">;
    description: z.ZodString;
    usage: z.ZodOptional<z.ZodObject<{
        kind: z.ZodEnum<["AT_WILL", "PER_DAY", "PER_REST", "RECHARGE"]>;
        per: z.ZodOptional<z.ZodNumber>;
        rest: z.ZodOptional<z.ZodEnum<["SHORT", "LONG"]>>;
        rechargeOn: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        kind: "AT_WILL" | "PER_DAY" | "PER_REST" | "RECHARGE";
        per?: number | undefined;
        rest?: "SHORT" | "LONG" | undefined;
        rechargeOn?: string | undefined;
    }, {
        kind: "AT_WILL" | "PER_DAY" | "PER_REST" | "RECHARGE";
        per?: number | undefined;
        rest?: "SHORT" | "LONG" | undefined;
        rechargeOn?: string | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    kind: "TEXT";
    description: string;
    usage?: {
        kind: "AT_WILL" | "PER_DAY" | "PER_REST" | "RECHARGE";
        per?: number | undefined;
        rest?: "SHORT" | "LONG" | undefined;
        rechargeOn?: string | undefined;
    } | undefined;
}, {
    name: string;
    kind: "TEXT";
    description: string;
    usage?: {
        kind: "AT_WILL" | "PER_DAY" | "PER_REST" | "RECHARGE";
        per?: number | undefined;
        rest?: "SHORT" | "LONG" | undefined;
        rechargeOn?: string | undefined;
    } | undefined;
}>, z.ZodObject<{
    name: z.ZodDefault<z.ZodString>;
    kind: z.ZodLiteral<"MULTIATTACK">;
    description: z.ZodString;
}, "strip", z.ZodTypeAny, {
    name: string;
    kind: "MULTIATTACK";
    description: string;
}, {
    kind: "MULTIATTACK";
    description: string;
    name?: string | undefined;
}>]>;
export type Action = z.infer<typeof ActionSchema>;
export declare const LegendaryActionSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodString;
    cost: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    name: string;
    description: string;
    cost: number;
}, {
    name: string;
    description: string;
    cost?: number | undefined;
}>;
export type LegendaryAction = z.infer<typeof LegendaryActionSchema>;
export declare const ChallengeRatingSchema: z.ZodEnum<["0", "1/8", "1/4", "1/2", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20", "21", "22", "23", "24", "25", "26", "27", "28", "29", "30"]>;
export type ChallengeRating = z.infer<typeof ChallengeRatingSchema>;
export declare const MonsterSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    size: z.ZodEnum<["TINY", "SMALL", "MEDIUM", "LARGE", "HUGE", "GARGANTUAN"]>;
    type: z.ZodEnum<["ABERRATION", "BEAST", "CELESTIAL", "CONSTRUCT", "DRAGON", "ELEMENTAL", "FEY", "FIEND", "GIANT", "HUMANOID", "MONSTROSITY", "OOZE", "PLANT", "UNDEAD"]>;
    alignment: z.ZodString;
    ac: z.ZodObject<{
        value: z.ZodNumber;
        type: z.ZodOptional<z.ZodString>;
        notes: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        value: number;
        type?: string | undefined;
        notes?: string | undefined;
    }, {
        value: number;
        type?: string | undefined;
        notes?: string | undefined;
    }>;
    hp: z.ZodObject<{
        average: z.ZodNumber;
        formula: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        average: number;
        formula?: string | undefined;
    }, {
        average: number;
        formula?: string | undefined;
    }>;
    speed: z.ZodObject<{
        walk: z.ZodOptional<z.ZodNumber>;
        burrow: z.ZodOptional<z.ZodNumber>;
        climb: z.ZodOptional<z.ZodNumber>;
        fly: z.ZodOptional<z.ZodNumber>;
        swim: z.ZodOptional<z.ZodNumber>;
        hover: z.ZodOptional<z.ZodBoolean>;
        notes: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        notes?: string | undefined;
        walk?: number | undefined;
        burrow?: number | undefined;
        climb?: number | undefined;
        fly?: number | undefined;
        swim?: number | undefined;
        hover?: boolean | undefined;
    }, {
        notes?: string | undefined;
        walk?: number | undefined;
        burrow?: number | undefined;
        climb?: number | undefined;
        fly?: number | undefined;
        swim?: number | undefined;
        hover?: boolean | undefined;
    }>;
    abilities: z.ZodObject<{
        STR: z.ZodNumber;
        DEX: z.ZodNumber;
        CON: z.ZodNumber;
        INT: z.ZodNumber;
        WIS: z.ZodNumber;
        CHA: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        STR: number;
        DEX: number;
        CON: number;
        INT: number;
        WIS: number;
        CHA: number;
    }, {
        STR: number;
        DEX: number;
        CON: number;
        INT: number;
        WIS: number;
        CHA: number;
    }>;
    savingThrows: z.ZodOptional<z.ZodObject<{
        STR: z.ZodOptional<z.ZodNumber>;
        DEX: z.ZodOptional<z.ZodNumber>;
        CON: z.ZodOptional<z.ZodNumber>;
        INT: z.ZodOptional<z.ZodNumber>;
        WIS: z.ZodOptional<z.ZodNumber>;
        CHA: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        STR?: number | undefined;
        DEX?: number | undefined;
        CON?: number | undefined;
        INT?: number | undefined;
        WIS?: number | undefined;
        CHA?: number | undefined;
    }, {
        STR?: number | undefined;
        DEX?: number | undefined;
        CON?: number | undefined;
        INT?: number | undefined;
        WIS?: number | undefined;
        CHA?: number | undefined;
    }>>;
    skills: z.ZodOptional<z.ZodObject<{
        ACROBATICS: z.ZodOptional<z.ZodNumber>;
        ANIMAL_HANDLING: z.ZodOptional<z.ZodNumber>;
        ARCANA: z.ZodOptional<z.ZodNumber>;
        ATHLETICS: z.ZodOptional<z.ZodNumber>;
        DECEPTION: z.ZodOptional<z.ZodNumber>;
        HISTORY: z.ZodOptional<z.ZodNumber>;
        INSIGHT: z.ZodOptional<z.ZodNumber>;
        INTIMIDATION: z.ZodOptional<z.ZodNumber>;
        INVESTIGATION: z.ZodOptional<z.ZodNumber>;
        MEDICINE: z.ZodOptional<z.ZodNumber>;
        NATURE: z.ZodOptional<z.ZodNumber>;
        PERCEPTION: z.ZodOptional<z.ZodNumber>;
        PERFORMANCE: z.ZodOptional<z.ZodNumber>;
        PERSUASION: z.ZodOptional<z.ZodNumber>;
        RELIGION: z.ZodOptional<z.ZodNumber>;
        SLEIGHT_OF_HAND: z.ZodOptional<z.ZodNumber>;
        STEALTH: z.ZodOptional<z.ZodNumber>;
        SURVIVAL: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        ACROBATICS?: number | undefined;
        ANIMAL_HANDLING?: number | undefined;
        ARCANA?: number | undefined;
        ATHLETICS?: number | undefined;
        DECEPTION?: number | undefined;
        HISTORY?: number | undefined;
        INSIGHT?: number | undefined;
        INTIMIDATION?: number | undefined;
        INVESTIGATION?: number | undefined;
        MEDICINE?: number | undefined;
        NATURE?: number | undefined;
        PERCEPTION?: number | undefined;
        PERFORMANCE?: number | undefined;
        PERSUASION?: number | undefined;
        RELIGION?: number | undefined;
        SLEIGHT_OF_HAND?: number | undefined;
        STEALTH?: number | undefined;
        SURVIVAL?: number | undefined;
    }, {
        ACROBATICS?: number | undefined;
        ANIMAL_HANDLING?: number | undefined;
        ARCANA?: number | undefined;
        ATHLETICS?: number | undefined;
        DECEPTION?: number | undefined;
        HISTORY?: number | undefined;
        INSIGHT?: number | undefined;
        INTIMIDATION?: number | undefined;
        INVESTIGATION?: number | undefined;
        MEDICINE?: number | undefined;
        NATURE?: number | undefined;
        PERCEPTION?: number | undefined;
        PERFORMANCE?: number | undefined;
        PERSUASION?: number | undefined;
        RELIGION?: number | undefined;
        SLEIGHT_OF_HAND?: number | undefined;
        STEALTH?: number | undefined;
        SURVIVAL?: number | undefined;
    }>>;
    damageResistances: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    damageImmunities: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    damageVulnerabilities: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    conditionImmunities: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    senses: z.ZodOptional<z.ZodArray<z.ZodObject<{
        type: z.ZodEnum<["BLINDSIGHT", "DARKVISION", "TREMORSENSE", "TRUESIGHT"]>;
        rangeFt: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        type: "BLINDSIGHT" | "DARKVISION" | "TREMORSENSE" | "TRUESIGHT";
        rangeFt: number;
    }, {
        type: "BLINDSIGHT" | "DARKVISION" | "TREMORSENSE" | "TRUESIGHT";
        rangeFt: number;
    }>, "many">>;
    passivePerception: z.ZodOptional<z.ZodNumber>;
    languages: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    telepathyFt: z.ZodOptional<z.ZodNumber>;
    languageNote: z.ZodOptional<z.ZodString>;
    challengeRating: z.ZodEnum<["0", "1/8", "1/4", "1/2", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20", "21", "22", "23", "24", "25", "26", "27", "28", "29", "30"]>;
    xp: z.ZodOptional<z.ZodNumber>;
    proficiencyBonus: z.ZodOptional<z.ZodNumber>;
    traits: z.ZodDefault<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        kind: z.ZodLiteral<"TEXT">;
        description: z.ZodString;
        usage: z.ZodOptional<z.ZodObject<{
            kind: z.ZodEnum<["AT_WILL", "PER_DAY", "PER_REST", "RECHARGE"]>;
            per: z.ZodOptional<z.ZodNumber>;
            rest: z.ZodOptional<z.ZodEnum<["SHORT", "LONG"]>>;
            rechargeOn: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            kind: "AT_WILL" | "PER_DAY" | "PER_REST" | "RECHARGE";
            per?: number | undefined;
            rest?: "SHORT" | "LONG" | undefined;
            rechargeOn?: string | undefined;
        }, {
            kind: "AT_WILL" | "PER_DAY" | "PER_REST" | "RECHARGE";
            per?: number | undefined;
            rest?: "SHORT" | "LONG" | undefined;
            rechargeOn?: string | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        kind: "TEXT";
        description: string;
        usage?: {
            kind: "AT_WILL" | "PER_DAY" | "PER_REST" | "RECHARGE";
            per?: number | undefined;
            rest?: "SHORT" | "LONG" | undefined;
            rechargeOn?: string | undefined;
        } | undefined;
    }, {
        name: string;
        kind: "TEXT";
        description: string;
        usage?: {
            kind: "AT_WILL" | "PER_DAY" | "PER_REST" | "RECHARGE";
            per?: number | undefined;
            rest?: "SHORT" | "LONG" | undefined;
            rechargeOn?: string | undefined;
        } | undefined;
    }>, "many">>;
    actions: z.ZodDefault<z.ZodArray<z.ZodUnion<[z.ZodObject<{
        name: z.ZodString;
        kind: z.ZodLiteral<"ATTACK">;
        attackType: z.ZodEnum<["MELEE_WEAPON", "RANGED_WEAPON", "MELEE_SPELL", "RANGED_SPELL"]>;
        toHitBonus: z.ZodNumber;
        reachFt: z.ZodOptional<z.ZodNumber>;
        rangeFt: z.ZodOptional<z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>>;
        target: z.ZodDefault<z.ZodString>;
        onHit: z.ZodArray<z.ZodObject<{
            average: z.ZodNumber;
            formula: z.ZodOptional<z.ZodString>;
            type: z.ZodEnum<["ACID", "BLUDGEONING", "COLD", "FIRE", "FORCE", "LIGHTNING", "NECROTIC", "PIERCING", "POISON", "PSYCHIC", "RADIANT", "SLASHING", "THUNDER"]>;
        }, "strip", z.ZodTypeAny, {
            type: "ACID" | "BLUDGEONING" | "COLD" | "FIRE" | "FORCE" | "LIGHTNING" | "NECROTIC" | "PIERCING" | "POISON" | "PSYCHIC" | "RADIANT" | "SLASHING" | "THUNDER";
            average: number;
            formula?: string | undefined;
        }, {
            type: "ACID" | "BLUDGEONING" | "COLD" | "FIRE" | "FORCE" | "LIGHTNING" | "NECROTIC" | "PIERCING" | "POISON" | "PSYCHIC" | "RADIANT" | "SLASHING" | "THUNDER";
            average: number;
            formula?: string | undefined;
        }>, "many">;
        onHitText: z.ZodOptional<z.ZodString>;
        description: z.ZodOptional<z.ZodString>;
        usage: z.ZodOptional<z.ZodObject<{
            kind: z.ZodEnum<["AT_WILL", "PER_DAY", "PER_REST", "RECHARGE"]>;
            per: z.ZodOptional<z.ZodNumber>;
            rest: z.ZodOptional<z.ZodEnum<["SHORT", "LONG"]>>;
            rechargeOn: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            kind: "AT_WILL" | "PER_DAY" | "PER_REST" | "RECHARGE";
            per?: number | undefined;
            rest?: "SHORT" | "LONG" | undefined;
            rechargeOn?: string | undefined;
        }, {
            kind: "AT_WILL" | "PER_DAY" | "PER_REST" | "RECHARGE";
            per?: number | undefined;
            rest?: "SHORT" | "LONG" | undefined;
            rechargeOn?: string | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        kind: "ATTACK";
        attackType: "MELEE_WEAPON" | "RANGED_WEAPON" | "MELEE_SPELL" | "RANGED_SPELL";
        toHitBonus: number;
        target: string;
        onHit: {
            type: "ACID" | "BLUDGEONING" | "COLD" | "FIRE" | "FORCE" | "LIGHTNING" | "NECROTIC" | "PIERCING" | "POISON" | "PSYCHIC" | "RADIANT" | "SLASHING" | "THUNDER";
            average: number;
            formula?: string | undefined;
        }[];
        rangeFt?: [number, number] | undefined;
        reachFt?: number | undefined;
        onHitText?: string | undefined;
        description?: string | undefined;
        usage?: {
            kind: "AT_WILL" | "PER_DAY" | "PER_REST" | "RECHARGE";
            per?: number | undefined;
            rest?: "SHORT" | "LONG" | undefined;
            rechargeOn?: string | undefined;
        } | undefined;
    }, {
        name: string;
        kind: "ATTACK";
        attackType: "MELEE_WEAPON" | "RANGED_WEAPON" | "MELEE_SPELL" | "RANGED_SPELL";
        toHitBonus: number;
        onHit: {
            type: "ACID" | "BLUDGEONING" | "COLD" | "FIRE" | "FORCE" | "LIGHTNING" | "NECROTIC" | "PIERCING" | "POISON" | "PSYCHIC" | "RADIANT" | "SLASHING" | "THUNDER";
            average: number;
            formula?: string | undefined;
        }[];
        rangeFt?: [number, number] | undefined;
        reachFt?: number | undefined;
        target?: string | undefined;
        onHitText?: string | undefined;
        description?: string | undefined;
        usage?: {
            kind: "AT_WILL" | "PER_DAY" | "PER_REST" | "RECHARGE";
            per?: number | undefined;
            rest?: "SHORT" | "LONG" | undefined;
            rechargeOn?: string | undefined;
        } | undefined;
    }>, z.ZodObject<{
        name: z.ZodString;
        kind: z.ZodLiteral<"SAVE">;
        ability: z.ZodEnum<["STR", "DEX", "CON", "INT", "WIS", "CHA"]>;
        dc: z.ZodNumber;
        effectOnFailure: z.ZodString;
        effectOnSuccess: z.ZodOptional<z.ZodString>;
        usage: z.ZodOptional<z.ZodObject<{
            kind: z.ZodEnum<["AT_WILL", "PER_DAY", "PER_REST", "RECHARGE"]>;
            per: z.ZodOptional<z.ZodNumber>;
            rest: z.ZodOptional<z.ZodEnum<["SHORT", "LONG"]>>;
            rechargeOn: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            kind: "AT_WILL" | "PER_DAY" | "PER_REST" | "RECHARGE";
            per?: number | undefined;
            rest?: "SHORT" | "LONG" | undefined;
            rechargeOn?: string | undefined;
        }, {
            kind: "AT_WILL" | "PER_DAY" | "PER_REST" | "RECHARGE";
            per?: number | undefined;
            rest?: "SHORT" | "LONG" | undefined;
            rechargeOn?: string | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        kind: "SAVE";
        ability: "STR" | "DEX" | "CON" | "INT" | "WIS" | "CHA";
        dc: number;
        effectOnFailure: string;
        usage?: {
            kind: "AT_WILL" | "PER_DAY" | "PER_REST" | "RECHARGE";
            per?: number | undefined;
            rest?: "SHORT" | "LONG" | undefined;
            rechargeOn?: string | undefined;
        } | undefined;
        effectOnSuccess?: string | undefined;
    }, {
        name: string;
        kind: "SAVE";
        ability: "STR" | "DEX" | "CON" | "INT" | "WIS" | "CHA";
        dc: number;
        effectOnFailure: string;
        usage?: {
            kind: "AT_WILL" | "PER_DAY" | "PER_REST" | "RECHARGE";
            per?: number | undefined;
            rest?: "SHORT" | "LONG" | undefined;
            rechargeOn?: string | undefined;
        } | undefined;
        effectOnSuccess?: string | undefined;
    }>, z.ZodObject<{
        name: z.ZodString;
        kind: z.ZodLiteral<"TEXT">;
        description: z.ZodString;
        usage: z.ZodOptional<z.ZodObject<{
            kind: z.ZodEnum<["AT_WILL", "PER_DAY", "PER_REST", "RECHARGE"]>;
            per: z.ZodOptional<z.ZodNumber>;
            rest: z.ZodOptional<z.ZodEnum<["SHORT", "LONG"]>>;
            rechargeOn: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            kind: "AT_WILL" | "PER_DAY" | "PER_REST" | "RECHARGE";
            per?: number | undefined;
            rest?: "SHORT" | "LONG" | undefined;
            rechargeOn?: string | undefined;
        }, {
            kind: "AT_WILL" | "PER_DAY" | "PER_REST" | "RECHARGE";
            per?: number | undefined;
            rest?: "SHORT" | "LONG" | undefined;
            rechargeOn?: string | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        kind: "TEXT";
        description: string;
        usage?: {
            kind: "AT_WILL" | "PER_DAY" | "PER_REST" | "RECHARGE";
            per?: number | undefined;
            rest?: "SHORT" | "LONG" | undefined;
            rechargeOn?: string | undefined;
        } | undefined;
    }, {
        name: string;
        kind: "TEXT";
        description: string;
        usage?: {
            kind: "AT_WILL" | "PER_DAY" | "PER_REST" | "RECHARGE";
            per?: number | undefined;
            rest?: "SHORT" | "LONG" | undefined;
            rechargeOn?: string | undefined;
        } | undefined;
    }>, z.ZodObject<{
        name: z.ZodDefault<z.ZodString>;
        kind: z.ZodLiteral<"MULTIATTACK">;
        description: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        kind: "MULTIATTACK";
        description: string;
    }, {
        kind: "MULTIATTACK";
        description: string;
        name?: string | undefined;
    }>]>, "many">>;
    bonusActions: z.ZodDefault<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        kind: z.ZodLiteral<"TEXT">;
        description: z.ZodString;
        usage: z.ZodOptional<z.ZodObject<{
            kind: z.ZodEnum<["AT_WILL", "PER_DAY", "PER_REST", "RECHARGE"]>;
            per: z.ZodOptional<z.ZodNumber>;
            rest: z.ZodOptional<z.ZodEnum<["SHORT", "LONG"]>>;
            rechargeOn: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            kind: "AT_WILL" | "PER_DAY" | "PER_REST" | "RECHARGE";
            per?: number | undefined;
            rest?: "SHORT" | "LONG" | undefined;
            rechargeOn?: string | undefined;
        }, {
            kind: "AT_WILL" | "PER_DAY" | "PER_REST" | "RECHARGE";
            per?: number | undefined;
            rest?: "SHORT" | "LONG" | undefined;
            rechargeOn?: string | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        kind: "TEXT";
        description: string;
        usage?: {
            kind: "AT_WILL" | "PER_DAY" | "PER_REST" | "RECHARGE";
            per?: number | undefined;
            rest?: "SHORT" | "LONG" | undefined;
            rechargeOn?: string | undefined;
        } | undefined;
    }, {
        name: string;
        kind: "TEXT";
        description: string;
        usage?: {
            kind: "AT_WILL" | "PER_DAY" | "PER_REST" | "RECHARGE";
            per?: number | undefined;
            rest?: "SHORT" | "LONG" | undefined;
            rechargeOn?: string | undefined;
        } | undefined;
    }>, "many">>;
    reactions: z.ZodDefault<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        kind: z.ZodLiteral<"TEXT">;
        description: z.ZodString;
        usage: z.ZodOptional<z.ZodObject<{
            kind: z.ZodEnum<["AT_WILL", "PER_DAY", "PER_REST", "RECHARGE"]>;
            per: z.ZodOptional<z.ZodNumber>;
            rest: z.ZodOptional<z.ZodEnum<["SHORT", "LONG"]>>;
            rechargeOn: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            kind: "AT_WILL" | "PER_DAY" | "PER_REST" | "RECHARGE";
            per?: number | undefined;
            rest?: "SHORT" | "LONG" | undefined;
            rechargeOn?: string | undefined;
        }, {
            kind: "AT_WILL" | "PER_DAY" | "PER_REST" | "RECHARGE";
            per?: number | undefined;
            rest?: "SHORT" | "LONG" | undefined;
            rechargeOn?: string | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        kind: "TEXT";
        description: string;
        usage?: {
            kind: "AT_WILL" | "PER_DAY" | "PER_REST" | "RECHARGE";
            per?: number | undefined;
            rest?: "SHORT" | "LONG" | undefined;
            rechargeOn?: string | undefined;
        } | undefined;
    }, {
        name: string;
        kind: "TEXT";
        description: string;
        usage?: {
            kind: "AT_WILL" | "PER_DAY" | "PER_REST" | "RECHARGE";
            per?: number | undefined;
            rest?: "SHORT" | "LONG" | undefined;
            rechargeOn?: string | undefined;
        } | undefined;
    }>, "many">>;
    legendaryActions: z.ZodDefault<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        description: z.ZodString;
        cost: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        description: string;
        cost: number;
    }, {
        name: string;
        description: string;
        cost?: number | undefined;
    }>, "many">>;
    legendaryActionsPerRound: z.ZodDefault<z.ZodNumber>;
    source: z.ZodOptional<z.ZodString>;
    tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    type: "ABERRATION" | "BEAST" | "CELESTIAL" | "CONSTRUCT" | "DRAGON" | "ELEMENTAL" | "FEY" | "FIEND" | "GIANT" | "HUMANOID" | "MONSTROSITY" | "OOZE" | "PLANT" | "UNDEAD";
    id: string;
    name: string;
    size: "TINY" | "SMALL" | "MEDIUM" | "LARGE" | "HUGE" | "GARGANTUAN";
    alignment: string;
    ac: {
        value: number;
        type?: string | undefined;
        notes?: string | undefined;
    };
    hp: {
        average: number;
        formula?: string | undefined;
    };
    speed: {
        notes?: string | undefined;
        walk?: number | undefined;
        burrow?: number | undefined;
        climb?: number | undefined;
        fly?: number | undefined;
        swim?: number | undefined;
        hover?: boolean | undefined;
    };
    abilities: {
        STR: number;
        DEX: number;
        CON: number;
        INT: number;
        WIS: number;
        CHA: number;
    };
    challengeRating: "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "11" | "12" | "13" | "14" | "15" | "16" | "17" | "1/8" | "1/4" | "1/2" | "18" | "19" | "20" | "21" | "22" | "23" | "24" | "25" | "26" | "27" | "28" | "29" | "30";
    traits: {
        name: string;
        kind: "TEXT";
        description: string;
        usage?: {
            kind: "AT_WILL" | "PER_DAY" | "PER_REST" | "RECHARGE";
            per?: number | undefined;
            rest?: "SHORT" | "LONG" | undefined;
            rechargeOn?: string | undefined;
        } | undefined;
    }[];
    actions: ({
        name: string;
        kind: "ATTACK";
        attackType: "MELEE_WEAPON" | "RANGED_WEAPON" | "MELEE_SPELL" | "RANGED_SPELL";
        toHitBonus: number;
        target: string;
        onHit: {
            type: "ACID" | "BLUDGEONING" | "COLD" | "FIRE" | "FORCE" | "LIGHTNING" | "NECROTIC" | "PIERCING" | "POISON" | "PSYCHIC" | "RADIANT" | "SLASHING" | "THUNDER";
            average: number;
            formula?: string | undefined;
        }[];
        rangeFt?: [number, number] | undefined;
        reachFt?: number | undefined;
        onHitText?: string | undefined;
        description?: string | undefined;
        usage?: {
            kind: "AT_WILL" | "PER_DAY" | "PER_REST" | "RECHARGE";
            per?: number | undefined;
            rest?: "SHORT" | "LONG" | undefined;
            rechargeOn?: string | undefined;
        } | undefined;
    } | {
        name: string;
        kind: "SAVE";
        ability: "STR" | "DEX" | "CON" | "INT" | "WIS" | "CHA";
        dc: number;
        effectOnFailure: string;
        usage?: {
            kind: "AT_WILL" | "PER_DAY" | "PER_REST" | "RECHARGE";
            per?: number | undefined;
            rest?: "SHORT" | "LONG" | undefined;
            rechargeOn?: string | undefined;
        } | undefined;
        effectOnSuccess?: string | undefined;
    } | {
        name: string;
        kind: "TEXT";
        description: string;
        usage?: {
            kind: "AT_WILL" | "PER_DAY" | "PER_REST" | "RECHARGE";
            per?: number | undefined;
            rest?: "SHORT" | "LONG" | undefined;
            rechargeOn?: string | undefined;
        } | undefined;
    } | {
        name: string;
        kind: "MULTIATTACK";
        description: string;
    })[];
    bonusActions: {
        name: string;
        kind: "TEXT";
        description: string;
        usage?: {
            kind: "AT_WILL" | "PER_DAY" | "PER_REST" | "RECHARGE";
            per?: number | undefined;
            rest?: "SHORT" | "LONG" | undefined;
            rechargeOn?: string | undefined;
        } | undefined;
    }[];
    reactions: {
        name: string;
        kind: "TEXT";
        description: string;
        usage?: {
            kind: "AT_WILL" | "PER_DAY" | "PER_REST" | "RECHARGE";
            per?: number | undefined;
            rest?: "SHORT" | "LONG" | undefined;
            rechargeOn?: string | undefined;
        } | undefined;
    }[];
    legendaryActions: {
        name: string;
        description: string;
        cost: number;
    }[];
    legendaryActionsPerRound: number;
    savingThrows?: {
        STR?: number | undefined;
        DEX?: number | undefined;
        CON?: number | undefined;
        INT?: number | undefined;
        WIS?: number | undefined;
        CHA?: number | undefined;
    } | undefined;
    skills?: {
        ACROBATICS?: number | undefined;
        ANIMAL_HANDLING?: number | undefined;
        ARCANA?: number | undefined;
        ATHLETICS?: number | undefined;
        DECEPTION?: number | undefined;
        HISTORY?: number | undefined;
        INSIGHT?: number | undefined;
        INTIMIDATION?: number | undefined;
        INVESTIGATION?: number | undefined;
        MEDICINE?: number | undefined;
        NATURE?: number | undefined;
        PERCEPTION?: number | undefined;
        PERFORMANCE?: number | undefined;
        PERSUASION?: number | undefined;
        RELIGION?: number | undefined;
        SLEIGHT_OF_HAND?: number | undefined;
        STEALTH?: number | undefined;
        SURVIVAL?: number | undefined;
    } | undefined;
    damageResistances?: string[] | undefined;
    damageImmunities?: string[] | undefined;
    damageVulnerabilities?: string[] | undefined;
    conditionImmunities?: string[] | undefined;
    senses?: {
        type: "BLINDSIGHT" | "DARKVISION" | "TREMORSENSE" | "TRUESIGHT";
        rangeFt: number;
    }[] | undefined;
    passivePerception?: number | undefined;
    languages?: string[] | undefined;
    telepathyFt?: number | undefined;
    languageNote?: string | undefined;
    xp?: number | undefined;
    proficiencyBonus?: number | undefined;
    source?: string | undefined;
    tags?: string[] | undefined;
}, {
    type: "ABERRATION" | "BEAST" | "CELESTIAL" | "CONSTRUCT" | "DRAGON" | "ELEMENTAL" | "FEY" | "FIEND" | "GIANT" | "HUMANOID" | "MONSTROSITY" | "OOZE" | "PLANT" | "UNDEAD";
    id: string;
    name: string;
    size: "TINY" | "SMALL" | "MEDIUM" | "LARGE" | "HUGE" | "GARGANTUAN";
    alignment: string;
    ac: {
        value: number;
        type?: string | undefined;
        notes?: string | undefined;
    };
    hp: {
        average: number;
        formula?: string | undefined;
    };
    speed: {
        notes?: string | undefined;
        walk?: number | undefined;
        burrow?: number | undefined;
        climb?: number | undefined;
        fly?: number | undefined;
        swim?: number | undefined;
        hover?: boolean | undefined;
    };
    abilities: {
        STR: number;
        DEX: number;
        CON: number;
        INT: number;
        WIS: number;
        CHA: number;
    };
    challengeRating: "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "11" | "12" | "13" | "14" | "15" | "16" | "17" | "1/8" | "1/4" | "1/2" | "18" | "19" | "20" | "21" | "22" | "23" | "24" | "25" | "26" | "27" | "28" | "29" | "30";
    savingThrows?: {
        STR?: number | undefined;
        DEX?: number | undefined;
        CON?: number | undefined;
        INT?: number | undefined;
        WIS?: number | undefined;
        CHA?: number | undefined;
    } | undefined;
    skills?: {
        ACROBATICS?: number | undefined;
        ANIMAL_HANDLING?: number | undefined;
        ARCANA?: number | undefined;
        ATHLETICS?: number | undefined;
        DECEPTION?: number | undefined;
        HISTORY?: number | undefined;
        INSIGHT?: number | undefined;
        INTIMIDATION?: number | undefined;
        INVESTIGATION?: number | undefined;
        MEDICINE?: number | undefined;
        NATURE?: number | undefined;
        PERCEPTION?: number | undefined;
        PERFORMANCE?: number | undefined;
        PERSUASION?: number | undefined;
        RELIGION?: number | undefined;
        SLEIGHT_OF_HAND?: number | undefined;
        STEALTH?: number | undefined;
        SURVIVAL?: number | undefined;
    } | undefined;
    damageResistances?: string[] | undefined;
    damageImmunities?: string[] | undefined;
    damageVulnerabilities?: string[] | undefined;
    conditionImmunities?: string[] | undefined;
    senses?: {
        type: "BLINDSIGHT" | "DARKVISION" | "TREMORSENSE" | "TRUESIGHT";
        rangeFt: number;
    }[] | undefined;
    passivePerception?: number | undefined;
    languages?: string[] | undefined;
    telepathyFt?: number | undefined;
    languageNote?: string | undefined;
    xp?: number | undefined;
    proficiencyBonus?: number | undefined;
    traits?: {
        name: string;
        kind: "TEXT";
        description: string;
        usage?: {
            kind: "AT_WILL" | "PER_DAY" | "PER_REST" | "RECHARGE";
            per?: number | undefined;
            rest?: "SHORT" | "LONG" | undefined;
            rechargeOn?: string | undefined;
        } | undefined;
    }[] | undefined;
    actions?: ({
        name: string;
        kind: "ATTACK";
        attackType: "MELEE_WEAPON" | "RANGED_WEAPON" | "MELEE_SPELL" | "RANGED_SPELL";
        toHitBonus: number;
        onHit: {
            type: "ACID" | "BLUDGEONING" | "COLD" | "FIRE" | "FORCE" | "LIGHTNING" | "NECROTIC" | "PIERCING" | "POISON" | "PSYCHIC" | "RADIANT" | "SLASHING" | "THUNDER";
            average: number;
            formula?: string | undefined;
        }[];
        rangeFt?: [number, number] | undefined;
        reachFt?: number | undefined;
        target?: string | undefined;
        onHitText?: string | undefined;
        description?: string | undefined;
        usage?: {
            kind: "AT_WILL" | "PER_DAY" | "PER_REST" | "RECHARGE";
            per?: number | undefined;
            rest?: "SHORT" | "LONG" | undefined;
            rechargeOn?: string | undefined;
        } | undefined;
    } | {
        name: string;
        kind: "SAVE";
        ability: "STR" | "DEX" | "CON" | "INT" | "WIS" | "CHA";
        dc: number;
        effectOnFailure: string;
        usage?: {
            kind: "AT_WILL" | "PER_DAY" | "PER_REST" | "RECHARGE";
            per?: number | undefined;
            rest?: "SHORT" | "LONG" | undefined;
            rechargeOn?: string | undefined;
        } | undefined;
        effectOnSuccess?: string | undefined;
    } | {
        name: string;
        kind: "TEXT";
        description: string;
        usage?: {
            kind: "AT_WILL" | "PER_DAY" | "PER_REST" | "RECHARGE";
            per?: number | undefined;
            rest?: "SHORT" | "LONG" | undefined;
            rechargeOn?: string | undefined;
        } | undefined;
    } | {
        kind: "MULTIATTACK";
        description: string;
        name?: string | undefined;
    })[] | undefined;
    bonusActions?: {
        name: string;
        kind: "TEXT";
        description: string;
        usage?: {
            kind: "AT_WILL" | "PER_DAY" | "PER_REST" | "RECHARGE";
            per?: number | undefined;
            rest?: "SHORT" | "LONG" | undefined;
            rechargeOn?: string | undefined;
        } | undefined;
    }[] | undefined;
    reactions?: {
        name: string;
        kind: "TEXT";
        description: string;
        usage?: {
            kind: "AT_WILL" | "PER_DAY" | "PER_REST" | "RECHARGE";
            per?: number | undefined;
            rest?: "SHORT" | "LONG" | undefined;
            rechargeOn?: string | undefined;
        } | undefined;
    }[] | undefined;
    legendaryActions?: {
        name: string;
        description: string;
        cost?: number | undefined;
    }[] | undefined;
    legendaryActionsPerRound?: number | undefined;
    source?: string | undefined;
    tags?: string[] | undefined;
}>;
export type Monster = z.infer<typeof MonsterSchema>;
export * from './messages';
export * from './events';
export * from './character';
//# sourceMappingURL=index.d.ts.map