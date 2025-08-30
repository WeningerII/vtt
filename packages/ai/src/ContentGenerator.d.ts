/**
 * Procedural Content Generator
 * Handles AI-driven generation of encounters, NPCs, loot, and environmental content
 */
export interface GenerationTemplate {
    id: string;
    name: string;
    type: 'encounter' | 'npc' | 'loot' | 'location' | 'quest' | 'dialogue';
    description: string;
    parameters: GenerationParameter[];
    generateContent: (_params: Record<string, _any>) => Promise<GeneratedContent>;
    tags: string[];
    difficulty?: 'easy' | 'medium' | 'hard';
}
export interface GenerationParameter {
    name: string;
    type: 'string' | 'number' | 'boolean' | 'select' | 'multi-select';
    label: string;
    description?: string;
    required: boolean;
    defaultValue?: any;
    options?: Array<{
        label: string;
        value: any;
    }>;
    min?: number;
    max?: number;
}
export interface GeneratedContent {
    id: string;
    type: string;
    name: string;
    description: string;
    data: any;
    metadata: {
        generatedAt: number;
        templateId: string;
        parameters: Record<string, any>;
        version: string;
    };
}
export interface EncounterData {
    name: string;
    description: string;
    difficulty: number;
    enemies: Array<{
        name: string;
        count: number;
        level: number;
        type: string;
        stats: Record<string, number>;
    }>;
    environment: {
        terrain: string;
        weather: string;
        lighting: string;
        hazards: string[];
    };
    objectives: string[];
    rewards: {
        experience: number;
        gold: number;
        items: string[];
    };
    tactics: string[];
}
export interface NPCData {
    name: string;
    race: string;
    class: string;
    level: number;
    personality: {
        traits: string[];
        ideals: string[];
        bonds: string[];
        flaws: string[];
    };
    appearance: {
        age: string;
        height: string;
        weight: string;
        eyes: string;
        hair: string;
        skin: string;
        distinguishing_features: string[];
    };
    background: {
        occupation: string;
        history: string;
        motivations: string[];
        secrets: string[];
    };
    stats: Record<string, number>;
    skills: string[];
    equipment: string[];
    spells?: string[];
}
export interface LocationData {
    name: string;
    type: string;
    size: string;
    description: string;
    features: Array<{
        name: string;
        description: string;
        interactive: boolean;
        hidden?: boolean;
    }>;
    inhabitants: Array<{
        name: string;
        role: string;
        disposition: string;
    }>;
    connections: Array<{
        direction: string;
        destination: string;
        travel_time: string;
    }>;
    atmosphere: {
        lighting: string;
        sounds: string[];
        smells: string[];
        temperature: string;
    };
    secrets?: string[];
}
export declare class ContentGenerator {
    private templates;
    private generationHistory;
    private nameGenerators;
    private markovChains;
    constructor();
    /**
     * Generate content from template
     */
    generateContent(templateId: string, parameters: Record<string, any>): Promise<GeneratedContent>;
    private validateParameters;
    private initializeNameGenerators;
    private initializeDefaultTemplates;
    private generateRandomEncounter;
    private generateRandomNPC;
    private generateTavern;
    private generateNPCStats;
    private generateNPCSkills;
    private generateNPCEquipment;
    private generateRandomLoot;
    private randomChoice;
    /**
     * Register custom template
     */
    registerTemplate(template: GenerationTemplate): void;
    /**
     * Get all templates
     */
    getTemplates(): GenerationTemplate[];
    /**
     * Get templates by type
     */
    getTemplatesByType(type: GenerationTemplate['type']): GenerationTemplate[];
    /**
     * Get generation history
     */
    getGenerationHistory(): GeneratedContent[];
    /**
     * Clear generation history
     */
    clearHistory(): void;
}
//# sourceMappingURL=ContentGenerator.d.ts.map