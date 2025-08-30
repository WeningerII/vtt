export interface MaterialComponent {
    id: string;
    name: string;
    description: string;
    cost?: number;
    consumed: boolean;
    rarity?: 'common' | 'uncommon' | 'rare' | 'very_rare' | 'legendary';
}
export interface SpellMaterialRequirement {
    spellId: string;
    spellName: string;
    level: number;
    components: MaterialComponent[];
    alternativeComponents?: MaterialComponent[][];
}
export declare const MATERIAL_COMPONENTS: Record<string, MaterialComponent>;
export declare const SPELL_MATERIAL_REQUIREMENTS: Record<string, SpellMaterialRequirement>;
export declare class MaterialComponentValidator {
    static validateSpellComponents(spellId: string, availableComponents: MaterialComponent[]): {
        valid: boolean;
        missing: MaterialComponent[];
        alternatives?: MaterialComponent[][];
    };
    static getComponentCost(spellId: string): number;
    static consumeComponents(spellId: string, availableComponents: MaterialComponent[]): MaterialComponent[];
}
export declare const materialComponentValidator: MaterialComponentValidator;
//# sourceMappingURL=MaterialComponentDatabase.d.ts.map