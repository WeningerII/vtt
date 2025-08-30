/**
 * Computational Spells - Machine-Executable D&D 5e Spell Definitions
 * Every spell effect is defined as computational primitives that can be executed algorithmically
 */
import { ComputationalSpell } from "./ComputationalSpellSystem.js";
export declare const cantripComputationalSpells: Record<string, ComputationalSpell>;
export declare const Level1ComputationalSpells: {
  guidingBolt: {
    id: string;
    validationRules: {
      target: (_target: any) => boolean;
      range: (_distance: number) => boolean;
      lineOfSight: boolean;
    };
    effectPrimitives: {
      type: string;
      modifier: string;
      onHit: (
        | {
            type: string;
            dice: string;
            damageType: string;
            condition?: never;
            duration?: never;
          }
        | {
            type: string;
            condition: string;
            duration: number;
            dice?: never;
            damageType?: never;
          }
      )[];
    }[];
    scaling: {
      damage: string;
    };
  };
  burningHands: {
    id: string;
    validationRules: {
      target: (_target: any) => boolean;
      shape: string;
      size: number;
    };
    effectPrimitives: {
      type: string;
      shape: string;
      size: number;
      savingThrow: {
        ability: string;
        dc: string;
      };
      onFail: {
        type: string;
        dice: string;
        damageType: string;
      };
      onSuccess: {
        type: string;
        dice: string;
        damageType: string;
        modifier: number;
      };
    }[];
    scaling: {
      damage: string;
    };
  };
  magicMissile: {
    id: string;
    validationRules: {
      target: (_target: any) => boolean;
      range: (_distance: number) => boolean;
      lineOfSight: boolean;
      autoHit: boolean;
    };
    effectPrimitives: {
      type: string;
      count: number;
      effects: {
        type: string;
        dice: string;
        damageType: string;
      }[];
    }[];
    scaling: {
      projectiles: number;
    };
  };
  cureWounds: {
    id: string;
    validationRules: {
      target: (_target: any) => boolean;
      range: (_distance: number) => boolean;
      touch: boolean;
    };
    effectPrimitives: {
      type: string;
      dice: string;
      modifier: string;
    }[];
    scaling: {
      healing: string;
    };
  };
  command: {
    id: string;
    validationRules: {
      target: (_target: any) => boolean;
      range: (_distance: number) => boolean;
      language: boolean;
    };
    effectPrimitives: {
      type: string;
      savingThrow: {
        ability: string;
        dc: string;
      };
      onFail: {
        type: string;
        command: string;
        duration: number;
      };
    }[];
    scaling: {
      targets: number;
    };
  };
};
//# sourceMappingURL=ComputationalSpells.d.ts.map
