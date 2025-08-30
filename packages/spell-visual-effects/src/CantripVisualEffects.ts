/**
 * Cantrip-specific Visual Effects
 * Defines visual effects for all cantrips in the system
 */

import type { VisualEffect } from './index';

export interface CantripVisualEffect extends VisualEffect {
  spellId: string;
  spellName: string;
  canScaleWithLevel?: boolean;
}

export const cantripVisualEffects: Record<string, CantripVisualEffect> = {
  // DAMAGE CANTRIPS
  acidSplash: {
    id: 'acid_splash_effect',
    spellId: 'acid_splash',
    spellName: 'Acid Splash',
    type: 'projectile',
    position: { x: 0, y: 0 },
    duration: 2000,
    properties: {
      projectileType: 'acid_bubble',
      color: '#32CD32',
      size: 0.8,
      trail: {
        enabled: true,
        color: '#90EE90',
        fade: true
      },
      impact: {
        type: 'splash',
        radius: 2.5,
        color: '#32CD32',
        particleCount: 20,
        corrosiveEffect: true
      }
    },
    canScaleWithLevel: true
  },

  chillTouch: {
    id: 'chill_touch_effect', 
    spellId: 'chill_touch',
    spellName: 'Chill Touch',
    type: 'projectile',
    position: { x: 0, y: 0 },
    duration: 1500,
    properties: {
      projectileType: 'spectral_hand',
      color: '#4B0082',
      ethereal: true,
      shadowTrail: true,
      impact: {
        type: 'necrotic_touch',
        color: '#4B0082',
        healingPrevention: {
          duration: 6000,
          visualIndicator: true
        }
      }
    },
    canScaleWithLevel: true
  },

  firebolt: {
    id: 'firebolt_effect',
    spellId: 'firebolt', 
    spellName: 'Fire Bolt',
    type: 'projectile',
    position: { x: 0, y: 0 },
    duration: 1000,
    properties: {
      projectileType: 'fire_mote',
      color: '#FF4500',
      size: 0.6,
      flame: true,
      trail: {
        enabled: true,
        color: '#FF6347',
        flame: true
      },
      impact: {
        type: 'fire_burst',
        radius: 1,
        color: '#FF4500',
        igniteChance: 0.1
      }
    },
    canScaleWithLevel: true
  },

  eldritchBlast: {
    id: 'eldritch_blast_effect',
    spellId: 'eldritch_blast',
    spellName: 'Eldritch Blast', 
    type: 'projectile',
    position: { x: 0, y: 0 },
    duration: 1200,
    properties: {
      projectileType: 'eldritch_beam',
      color: '#8A2BE2',
      size: 0.8,
      crackling: true,
      warpedSpace: true,
      multipleBeams: {
        level5: 2,
        level11: 3, 
        level17: 4
      },
      impact: {
        type: 'force_impact',
        pushback: true,
        radius: 1.5
      }
    },
    canScaleWithLevel: true
  },

  poisonSpray: {
    id: 'poison_spray_effect',
    spellId: 'poison_spray',
    spellName: 'Poison Spray',
    type: 'area',
    position: { x: 0, y: 0 },
    duration: 2000,
    properties: {
      areaType: 'cone',
      range: 10,
      angle: 30,
      color: '#9ACD32',
      gasCloud: true,
      particles: {
        count: 50,
        movement: 'dispersal',
        toxic: true
      },
      poisonEffect: {
        lingering: true,
        duration: 1000
      }
    },
    canScaleWithLevel: true
  },

  produceFlame: {
    id: 'produce_flame_effect',
    spellId: 'produce_flame', 
    spellName: 'Produce Flame',
    type: 'persistent',
    position: { x: 0, y: 0 },
    duration: 600000, // 10 minutes
    properties: {
      persistentType: 'hand_flame',
      color: '#FF4500',
      brightness: 10,
      dimRadius: 20,
      flickering: true,
      followsCaster: true,
      throwable: {
        enabled: true,
        projectileEffect: 'firebolt_effect'
      }
    }
  },

  rayOfFrost: {
    id: 'ray_of_frost_effect',
    spellId: 'ray_of_frost',
    spellName: 'Ray of Frost',
    type: 'projectile',
    position: { x: 0, y: 0 },
    duration: 800,
    properties: {
      projectileType: 'frost_ray',
      color: '#00BFFF',
      size: 0.4,
      crystalline: true,
      trail: {
        enabled: true,
        color: '#87CEEB',
        crystalline: true
      },
      impact: {
        type: 'frost_impact',
        freezing: true,
        slowEffect: {
          duration: 6000,
          magnitude: 10
        }
      }
    },
    canScaleWithLevel: true
  },

  sacredFlame: {
    id: 'sacred_flame_effect',
    spellId: 'sacred_flame',
    spellName: 'Sacred Flame',
    type: 'area',
    position: { x: 0, y: 0 },
    duration: 1500,
    properties: {
      areaType: 'cylinder',
      radius: 2.5,
      color: '#FFD700',
      radiant: true,
      descendsFromAbove: true,
      ignoresCover: true,
      holyFlame: {
        intensity: 'high',
        purifying: true
      }
    },
    canScaleWithLevel: true
  },

  shockingGrasp: {
    id: 'shocking_grasp_effect',
    spellId: 'shocking_grasp',
    spellName: 'Shocking Grasp',
    type: 'melee',
    position: { x: 0, y: 0 },
    duration: 500,
    properties: {
      meleeType: 'lightning_touch',
      color: '#FFFF00',
      electrical: true,
      arcing: true,
      range: 5,
      impact: {
        type: 'electrical_shock',
        disruptive: true,
        metalAdvantage: true,
        noReactions: {
          duration: 6000
        }
      }
    },
    canScaleWithLevel: true
  },

  viciousMockery: {
    id: 'vicious_mockery_effect',
    spellId: 'vicious_mockery',
    spellName: 'Vicious Mockery',
    type: 'mental',
    position: { x: 0, y: 0 },
    duration: 1000,
    properties: {
      mentalType: 'psychic_words',
      color: '#8B008B',
      soundWaves: true,
      requiresHearing: true,
      psychicDamage: true,
      debuff: {
        type: 'disadvantage_attack',
        duration: 6000,
        visualIndicator: true
      }
    },
    canScaleWithLevel: true
  },

  // UTILITY CANTRIPS
  dancingLights: {
    id: 'dancing_lights_effect',
    spellId: 'dancing_lights',
    spellName: 'Dancing Lights',
    type: 'persistent',
    position: { x: 0, y: 0 },
    duration: 60000, // 1 minute
    properties: {
      persistentType: 'dancing_lights',
      lightCount: 4,
      brightness: 10,
      color: '#FFFFE0',
      dancing: true,
      controllable: true,
      combination: {
        enabled: true,
        combinedBrightness: 40
      }
    }
  },

  light: {
    id: 'light_effect',
    spellId: 'light',
    spellName: 'Light',
    type: 'persistent',
    position: { x: 0, y: 0 },
    duration: 3600000, // 1 hour
    properties: {
      persistentType: 'object_light',
      brightness: 20,
      dimRadius: 40,
      color: '#FFFFFF',
      attachesToObject: true,
      removable: true
    }
  },

  mageHand: {
    id: 'mage_hand_effect',
    spellId: 'mage_hand',
    spellName: 'Mage Hand',
    type: 'persistent',
    position: { x: 0, y: 0 },
    duration: 60000, // 1 minute
    properties: {
      persistentType: 'spectral_hand',
      color: '#9370DB',
      translucent: true,
      controllable: true,
      range: 30,
      actions: ['move', 'manipulate', 'carry'],
      weightLimit: 10
    }
  },

  mending: {
    id: 'mending_effect',
    spellId: 'mending',
    spellName: 'Mending',
    type: 'channeled',
    position: { x: 0, y: 0 },
    duration: 60000, // 1 minute casting
    properties: {
      channeledType: 'repair_magic',
      color: '#32CD32',
      particleFlow: true,
      repairAnimation: true,
      touchRange: true
    }
  },

  message: {
    id: 'message_effect',
    spellId: 'message',
    spellName: 'Message',
    type: 'instant',
    position: { x: 0, y: 0 },
    duration: 1000,
    properties: {
      instantType: 'telepathic_whisper',
      color: '#87CEEB',
      soundWaves: false,
      telepathic: true,
      range: 120,
      bidirectional: true
    }
  },

  minorIllusion: {
    id: 'minor_illusion_effect',
    spellId: 'minor_illusion',
    spellName: 'Minor Illusion',
    type: 'persistent',
    position: { x: 0, y: 0 },
    duration: 60000, // 1 minute
    properties: {
      persistentType: 'illusion',
      size: { width: 5, height: 5, depth: 5 },
      variants: {
        sound: {
          auditory: true,
          noVisual: true
        },
        image: {
          visual: true,
          noSound: true,
          immobile: true
        }
      },
      investigatable: true,
      detectionDC: 13
    }
  },

  prestidigitation: {
    id: 'prestidigitation_effect',
    spellId: 'prestidigitation',
    spellName: 'Prestidigitation',
    type: 'varied',
    position: { x: 0, y: 0 },
    duration: 3600000, // 1 hour for most effects
    properties: {
      variedType: 'cantrip_tricks',
      effects: {
        sensory: {
          sparks: true,
          colors: true,
          scents: true
        },
        temperature: {
          warmFood: true,
          chillFood: true
        },
        cleaning: {
          removeStains: true,
          volume: 1 // cubic foot
        },
        fire: {
          lightCandle: true,
          snuffFlame: true
        },
        telekinesis: {
          weightLimit: 1, // pound
          range: 10
        }
      }
    }
  },

  // SUPPORT/ENHANCEMENT CANTRIPS
  guidance: {
    id: 'guidance_effect',
    spellId: 'guidance',
    spellName: 'Guidance',
    type: 'buff',
    position: { x: 0, y: 0 },
    duration: 60000, // 1 minute
    properties: {
      buffType: 'ability_enhancement',
      color: '#FFD700',
      divine: true,
      glowing: true,
      bonus: {
        type: 'd4',
        applies: 'next_ability_check'
      }
    }
  },

  resistance: {
    id: 'resistance_effect',
    spellId: 'resistance',
    spellName: 'Resistance',
    type: 'buff',
    position: { x: 0, y: 0 },
    duration: 60000, // 1 minute
    properties: {
      buffType: 'saving_throw_enhancement',
      color: '#4169E1',
      protective: true,
      shimmering: true,
      bonus: {
        type: 'd4',
        applies: 'next_saving_throw'
      }
    }
  },

  trueStrike: {
    id: 'true_strike_effect',
    spellId: 'true_strike',
    spellName: 'True Strike',
    type: 'buff',
    position: { x: 0, y: 0 },
    duration: 6000, // Until end of next turn
    properties: {
      buffType: 'attack_enhancement',
      color: '#FF6347',
      targeting: true,
      focusAura: true,
      advantage: {
        applies: 'next_attack_roll',
        against: 'specific_target'
      }
    }
  },

  // NATURE/UTILITY CANTRIPS
  druidcraft: {
    id: 'druidcraft_effect',
    spellId: 'druidcraft',
    spellName: 'Druidcraft',
    type: 'varied',
    position: { x: 0, y: 0 },
    duration: 60000, // 1 minute for most effects
    properties: {
      variedType: 'nature_magic',
      color: '#228B22',
      natural: true,
      effects: {
        weather: {
          predict: true,
          range: 24 // hours
        },
        plants: {
          bloomFlowers: true,
          growSprouts: true
        },
        sensory: {
          createOdors: true,
          createSounds: true
        },
        fire: {
          lightCandle: true,
          snuffFlame: true
        }
      }
    }
  },

  shillelagh: {
    id: 'shillelagh_effect',
    spellId: 'shillelagh',
    spellName: 'Shillelagh',
    type: 'enchantment',
    position: { x: 0, y: 0 },
    duration: 60000, // 1 minute
    properties: {
      enchantmentType: 'weapon_enhancement',
      color: '#8FBC8F',
      natural: true,
      glowing: true,
      weaponChange: {
        damage: 'd8',
        ability: 'spellcasting_modifier',
        magical: true
      }
    }
  },

  thaumaturgy: {
    id: 'thaumaturgy_effect',
    spellId: 'thaumaturgy',
    spellName: 'Thaumaturgy',
    type: 'varied',
    position: { x: 0, y: 0 },
    duration: 60000, // 1 minute for most effects
    properties: {
      variedType: 'divine_wonders',
      color: '#DAA520',
      divine: true,
      effects: {
        voice: {
          amplify: true,
          range: 300 // feet
        },
        flames: {
          flicker: true,
          brighten: true,
          dim: true
        },
        sounds: {
          create: true,
          volume: 'loud'
        },
        doors: {
          openClose: true,
          unlocked: true
        },
        eyes: {
          colorChange: true,
          duration: 60000
        },
        tremors: {
          ground: true,
          harmless: true
        }
      }
    }
  }
};

/**
 * Get visual effect for a cantrip
 */
export function getCantripVisualEffect(_spellId: string): CantripVisualEffect | undefined {
  return cantripVisualEffects[spellId];
}

/**
 * Scale visual effect based on character level
 */
export function scaleVisualEffect(effect: CantripVisualEffect, _characterLevel: number): CantripVisualEffect {
  if (!effect.canScaleWithLevel) return effect;

  const scaledEffect = { ...effect };
  
  // Scale certain properties based on level for damage cantrips
  if (characterLevel >= 5) {
    if (effect.spellId === 'eldritch_blast' && effect.properties.multipleBeams) {
      scaledEffect.properties = {
        ...effect.properties,
        beamCount: characterLevel >= 17 ? 4 : characterLevel >= 11 ? 3 : 2
      };
    }
    
    // Increase visual intensity for higher levels
    if (effect.properties.size && typeof effect.properties.size === 'number') {
      scaledEffect.properties.size = effect.properties.size * (1 + Math.floor(characterLevel / 5) * 0.1);
    }
  }

  return scaledEffect;
}

/**
 * Create visual effect instance from cantrip effect template
 */
export function createCantripVisualInstance(
  _spellId: string, 
  _position: { x: number; y: number },
  _characterLevel: number = 1,
  _customProperties?: Record<string, _any>
): CantripVisualEffect | null {
  const template = getCantripVisualEffect(spellId);
  if (!template) return null;

  const scaledTemplate = scaleVisualEffect(template, characterLevel);
  
  return {
    ...scaledTemplate,
    id: `${template.id}_${Date.now()}_${Math.random()}`,
    position,
    properties: {
      ...scaledTemplate.properties,
      ...customProperties
    }
  };
}
