/**
 * Enhanced D&D 5e Spells with Full Physics Integration
 * Complete spell definitions leveraging physics, visual effects, and game mechanics
 */

import type { PhysicsSpellEffect } from '../../../packages/physics-spell-bridge/src';

export const ENHANCED_DND5E_SPELLS: Record<string, PhysicsSpellEffect> = {
  // CANTRIPS
  message: {
    id: 'message',
    name: 'Message',
    level: 0,
    school: 'transmutation',
    castingTime: '1 action',
    range: '120 feet',
    components: ['verbal', 'somatic', 'material'],
    duration: '1 round',
    description: 'You whisper a message to a creature within range that only they can hear.',
    effects: [{
      type: 'communication',
      target: 'single',
      range: 120
    }],
    physics: {
      type: 'mental_effect',
      mental: {
        requiresLineOfSight: true,
        audible: false,
        telepathic: true
      },
      sound: {
        directional: true,
        range: 120,
        private: true
      }
    }
  },

  minorIllusion: {
    id: 'minor_illusion', 
    name: 'Minor Illusion',
    level: 0,
    school: 'illusion',
    castingTime: '1 action',
    range: '30 feet',
    components: ['somatic', 'material'],
    duration: '1 minute',
    description: 'You create a sound or image illusion within range.',
    effects: [{
      type: 'illusion',
      target: 'area',
      duration: 60000
    }],
    physics: {
      type: 'persistent_effect',
      persistent: {
        followsCaster: false,
        duration: 60000,
        illusory: true
      },
      illusion: {
        type: 'sound_or_image',
        detectable: true,
        investigationDC: 13
      }
    }
  },

  resistance: {
    id: 'resistance',
    name: 'Resistance', 
    level: 0,
    school: 'abjuration',
    castingTime: '1 action',
    range: 'Touch',
    components: ['verbal', 'somatic', 'material'],
    duration: '1 minute',
    concentration: true,
    description: 'Target gains +1d4 to one saving throw before spell ends.',
    effects: [{
      type: 'buff',
      target: 'single',
      modifier: {
        target: 'saving_throw',
        value: '1d4',
        duration: 60000
      }
    }],
    physics: {
      type: 'persistent_effect',
      persistent: {
        followsCaster: false,
        duration: 60000,
        protective: true
      },
      aura: {
        radius: 5,
        color: '#4169E1',
        subtle: true
      }
    }
  },

  shillelagh: {
    id: 'shillelagh',
    name: 'Shillelagh',
    level: 0,
    school: 'transmutation',
    castingTime: '1 bonus action',
    range: 'Touch',
    components: ['verbal', 'somatic', 'material'],
    duration: '1 minute',
    description: 'Weapon uses spellcasting ability for attacks and deals 1d8 damage.',
    effects: [{
      type: 'weapon_enhancement',
      target: 'weapon',
      duration: 60000
    }],
    physics: {
      type: 'persistent_effect',
      persistent: {
        followsCaster: false,
        duration: 60000,
        enhancement: true
      },
      weapon: {
        magicalDamage: true,
        abilityOverride: 'spellcasting',
        damageDie: 'd8'
      }
    }
  },

  eldritchBlast: {
    id: 'eldritch_blast',
    name: 'Eldritch Blast',
    level: 0,
    school: 'evocation',
    castingTime: '1 action',
    range: '120 feet',
    components: ['verbal', 'somatic'],
    duration: 'Instantaneous',
    description: 'A beam of crackling energy streaks toward a creature within range, pushing them back on hit.',
    effects: [{
      type: 'damage',
      target: 'single',
      damage: {
        dice: '1d10',
        type: 'force'
      }
    }],
    physics: {
      type: 'projectile',
      projectile: {
        speed: 300,
        gravity: false,
        piercing: false
      },
      force: {
        magnitude: 50,
        direction: { x: 0, y: -1 }, // Away from caster
        duration: 0
      }
    },
    scaling: {
      damage: '1d10', // Additional beam every 5th level
      effects: 'multiple_beams'
    }
  },

  firebolt: {
    id: 'firebolt',
    name: 'Fire Bolt',
    level: 0,
    school: 'evocation',
    castingTime: '1 action',
    range: '120 feet',
    components: ['verbal', 'somatic'],
    duration: 'Instantaneous',
    description: 'You hurl a mote of fire at a creature or object within range.',
    effects: [{
      type: 'damage',
      target: 'single',
      damage: {
        dice: '1d10',
        type: 'fire'
      }
    }],
    physics: {
      type: 'projectile',
      projectile: {
        speed: 250,
        gravity: false,
        piercing: false
      }
    },
    scaling: {
      damage: '1d10'
    }
  },

  // Additional damage cantrips with physics
  acidSplash: {
    id: 'acid_splash',
    name: 'Acid Splash',
    level: 0,
    school: 'conjuration',
    castingTime: '1 action',
    range: '60 feet',
    components: ['verbal', 'somatic'],
    duration: 'Instantaneous',
    description: 'You hurl a bubble of acid at targets within range.',
    effects: [{
      type: 'damage',
      target: 'area',
      damage: {
        dice: '1d6',
        type: 'acid'
      }
    }],
    physics: {
      type: 'projectile',
      projectile: {
        speed: 200,
        gravity: true,
        piercing: false,
        splash: true
      },
      area: {
        type: 'circle',
        radius: 2.5, // 5-foot radius between two creatures
        affectsMultiple: true
      }
    },
    scaling: {
      damage: '1d6'
    }
  },

  chillTouch: {
    id: 'chill_touch',
    name: 'Chill Touch',
    level: 0,
    school: 'necromancy',
    castingTime: '1 action',
    range: '120 feet',
    components: ['verbal', 'somatic'],
    duration: 'Instantaneous',
    description: 'A ghostly, skeletal hand reaches out to touch a creature.',
    effects: [{
      type: 'damage',
      target: 'single',
      damage: {
        dice: '1d8',
        type: 'necrotic'
      }
    }, {
      type: 'condition',
      target: 'single',
      condition: 'healing_prevented',
      duration: 1 // Until start of next turn
    }],
    physics: {
      type: 'projectile',
      projectile: {
        speed: 180,
        gravity: false,
        piercing: false,
        ethereal: true
      }
    },
    scaling: {
      damage: '1d8'
    }
  },

  poisonSpray: {
    id: 'poison_spray',
    name: 'Poison Spray',
    level: 0,
    school: 'conjuration',
    castingTime: '1 action',
    range: '10 feet',
    components: ['verbal', 'somatic'],
    duration: 'Instantaneous',
    description: 'You project a puff of noxious gas from your palm.',
    effects: [{
      type: 'damage',
      target: 'single',
      damage: {
        dice: '1d12',
        type: 'poison'
      }
    }],
    physics: {
      type: 'area_effect',
      area: {
        type: 'cone',
        radius: 10,
        angle: 30,
        origin: 'caster'
      },
      particles: {
        type: 'gas_cloud',
        density: 'medium',
        dispersal: 'fast'
      }
    },
    scaling: {
      damage: '1d12'
    }
  },

  produceFlame: {
    id: 'produce_flame',
    name: 'Produce Flame',
    level: 0,
    school: 'conjuration',
    castingTime: '1 action',
    range: 'Self',
    components: ['verbal', 'somatic'],
    duration: '10 minutes',
    description: 'A flickering flame appears in your hand that can be thrown.',
    effects: [{
      type: 'light',
      target: 'caster',
      radius: 10,
      dimRadius: 20
    }, {
      type: 'damage',
      target: 'single',
      damage: {
        dice: '1d8',
        type: 'fire'
      },
      conditional: 'when_thrown'
    }],
    physics: {
      type: 'persistent_effect',
      persistent: {
        followsCaster: true,
        duration: 600000, // 10 minutes
        light: {
          bright: 10,
          dim: 20
        }
      },
      projectile: {
        speed: 200,
        gravity: true,
        piercing: false,
        onThrow: true
      }
    },
    scaling: {
      damage: '1d8'
    }
  },

  rayOfFrost: {
    id: 'ray_of_frost',
    name: 'Ray of Frost',
    level: 0,
    school: 'evocation',
    castingTime: '1 action',
    range: '60 feet',
    components: ['verbal', 'somatic'],
    duration: 'Instantaneous',
    description: 'A frigid beam of blue-white light streaks toward a creature.',
    effects: [{
      type: 'damage',
      target: 'single',
      damage: {
        dice: '1d8',
        type: 'cold'
      }
    }, {
      type: 'movement_modifier',
      target: 'single',
      modifier: -10,
      duration: 1 // Until start of next turn
    }],
    physics: {
      type: 'projectile',
      projectile: {
        speed: 300,
        gravity: false,
        piercing: false,
        freezing: true
      },
      movementModifier: {
        type: 'slow',
        magnitude: 10,
        duration: 6000 // 1 round in milliseconds
      }
    },
    scaling: {
      damage: '1d8'
    }
  },

  sacredFlame: {
    id: 'sacred_flame',
    name: 'Sacred Flame',
    level: 0,
    school: 'evocation',
    castingTime: '1 action',
    range: '60 feet',
    components: ['verbal', 'somatic'],
    duration: 'Instantaneous',
    description: 'Flame-like radiance descends on a creature, ignoring cover.',
    effects: [{
      type: 'damage',
      target: 'single',
      damage: {
        dice: '1d8',
        type: 'radiant'
      }
    }],
    physics: {
      type: 'area_effect',
      area: {
        type: 'cylinder',
        radius: 2.5,
        height: 'infinite',
        ignoresCover: true,
        originatesFromAbove: true
      },
      radiant: {
        intensity: 'high',
        piercesCover: true
      }
    },
    scaling: {
      damage: '1d8'
    }
  },

  shockingGrasp: {
    id: 'shocking_grasp',
    name: 'Shocking Grasp',
    level: 0,
    school: 'evocation',
    castingTime: '1 action',
    range: 'Touch',
    components: ['verbal', 'somatic'],
    duration: 'Instantaneous',
    description: 'Lightning springs from your hand to shock a creature you touch.',
    effects: [{
      type: 'damage',
      target: 'single',
      damage: {
        dice: '1d8',
        type: 'lightning'
      }
    }, {
      type: 'condition',
      target: 'single',
      condition: 'no_reactions',
      duration: 1 // Until start of next turn
    }],
    physics: {
      type: 'melee_effect',
      melee: {
        range: 5, // Touch range
        electrical: true,
        advantageAgainstMetal: true
      },
      electrical: {
        arcing: true,
        conductivity: true,
        disruptive: true
      }
    },
    scaling: {
      damage: '1d8'
    }
  },

  viciousMockery: {
    id: 'vicious_mockery',
    name: 'Vicious Mockery',
    level: 0,
    school: 'enchantment',
    castingTime: '1 action',
    range: '60 feet',
    components: ['verbal'],
    duration: 'Instantaneous',
    description: 'You unleash insults laced with subtle enchantments.',
    effects: [{
      type: 'damage',
      target: 'single',
      damage: {
        dice: '1d4',
        type: 'psychic'
      }
    }, {
      type: 'condition',
      target: 'single',
      condition: 'disadvantage_next_attack',
      duration: 1
    }],
    physics: {
      type: 'mental_effect',
      mental: {
        requiresHearing: true,
        psychic: true,
        debuff: 'disadvantage'
      },
      sound: {
        audible: true,
        range: 60,
        requiresLineOfSight: true
      }
    },
    scaling: {
      damage: '1d4'
    }
  },

  // 1ST LEVEL SPELLS
  guidingBolt: {
    id: 'guiding_bolt',
    name: 'Guiding Bolt',
    level: 1,
    school: 'evocation',
    castingTime: '1 action',
    range: '120 feet',
    components: ['verbal', 'somatic'],
    duration: 'Instantaneous',
    description: 'A flash of light streaks toward a creature, dealing radiant damage and granting advantage on next attack.',
    effects: [{
      type: 'damage',
      target: 'single',
      damage: { dice: '4d6', type: 'radiant' }
    }, {
      type: 'condition',
      target: 'single',
      condition: 'advantage_next_attack',
      duration: 1
    }],
    physics: {
      type: 'projectile',
      projectile: {
        speed: 350,
        gravity: false,
        piercing: false
      }
    },
    scaling: { damage: '1d6' }
  },

  burningHands: {
    id: 'burning_hands',
    name: 'Burning Hands',
    level: 1,
    school: 'evocation',
    castingTime: '1 action',
    range: '15 feet',
    components: ['verbal', 'somatic'],
    duration: 'Instantaneous',
    description: 'A thin sheet of flames shoots forth from your outstretched fingertips.',
    effects: [{
      type: 'damage',
      target: 'area',
      area: { type: 'cone', size: 15 },
      damage: {
        dice: '3d6',
        type: 'fire',
        savingThrow: { ability: 'DEX', onSuccess: 'half' }
      }
    }],
    physics: {
      type: 'area_effect',
      area: {
        type: 'cone',
        radius: 15,
        angle: 60,
        origin: 'caster'
      }
    },
    scaling: { damage: '1d6' }
  },

  inflictWounds: {
    id: 'inflict_wounds',
    name: 'Inflict Wounds',
    level: 1,
    school: 'necromancy',
    castingTime: '1 action',
    range: 'Touch',
    components: ['verbal', 'somatic'],
    duration: 'Instantaneous',
    description: 'Make a melee spell attack to deal massive necrotic damage.',
    effects: [{
      type: 'damage',
      target: 'single',
      damage: { dice: '3d10', type: 'necrotic' }
    }],
    physics: {
      type: 'melee_effect',
      melee: {
        range: 5
      }
    },
    scaling: { damage: '1d10' }
  },

  mageArmor: {
    id: 'mage_armor',
    name: 'Mage Armor',
    level: 1,
    school: 'abjuration',
    castingTime: '1 action',
    range: 'Touch',
    components: ['verbal', 'somatic', 'material'],
    duration: '8 hours',
    description: 'Protective magical force surrounds target, setting base AC to 13 + Dex.',
    effects: [{
      type: 'buff',
      target: 'single',
      modifier: {
        target: 'ac_base',
        value: 13,
        duration: 28800000
      }
    }],
    physics: {
      type: 'persistent_effect',
      persistent: {
        followsCaster: false,
        duration: 28800000
      }
    }
  },

  faerieFire: {
    id: 'faerie_fire',
    name: 'Faerie Fire',
    level: 1,
    school: 'evocation',
    castingTime: '1 action',
    range: '60 feet',
    components: ['verbal'],
    duration: '1 minute',
    concentration: true,
    description: 'Objects and creatures in area are outlined in colored light, granting advantage on attacks.',
    effects: [{
      type: 'condition',
      target: 'area',
      area: { type: 'cube', size: 20 },
      condition: {
        id: 'outlined',
        duration: 60000,
        savingThrow: { ability: 'DEX' }
      }
    }],
    physics: {
      type: 'area_effect',
      area: {
        type: 'circle',
        radius: 20
      }
    }
  },

  entangle: {
    id: 'entangle',
    name: 'Entangle',
    level: 1,
    school: 'conjuration',
    castingTime: '1 action',
    range: '90 feet',
    components: ['verbal', 'somatic'],
    duration: '1 minute',
    concentration: true,
    description: 'Grasping weeds and vines sprout from ground, restraining creatures.',
    effects: [{
      type: 'condition',
      target: 'area',
      area: { type: 'cube', size: 20 },
      condition: {
        id: 'restrained',
        duration: 60000,
        savingThrow: { ability: 'STR', endOfTurn: true }
      }
    }],
    physics: {
      type: 'constraint',
      constraint: {
        type: 'entangle',
        strength: 0.7,
        duration: 60000
      }
    }
  },

  magicMissile: {
    id: 'magic_missile',
    name: 'Magic Missile',
    level: 1,
    school: 'evocation',
    castingTime: '1 action',
    range: '120 feet',
    components: ['verbal', 'somatic'],
    duration: 'Instantaneous',
    description: 'Three glowing darts of magical force strike unerringly.',
    effects: [{
      type: 'damage',
      target: 'multiple',
      damage: {
        dice: '1d4+1',
        type: 'force'
      }
    }],
    physics: {
      type: 'projectile',
      projectile: {
        speed: 400,
        gravity: false,
        piercing: true // Magic missiles never miss
      }
    },
    scaling: {
      damage: '1d4+1',
      effects: 'additional_missiles'
    }
  },

  shield: {
    id: 'shield',
    name: 'Shield',
    level: 1,
    school: 'abjuration',
    castingTime: '1 reaction',
    range: 'Self',
    components: ['verbal', 'somatic'],
    duration: '1 round',
    description: 'An invisible barrier of magical force appears and protects you.',
    effects: [{
      type: 'buff',
      target: 'self',
      modifier: {
        target: 'ac',
        value: 5,
        duration: 6000 // 1 round = 6 seconds
      }
    }],
    physics: {
      type: 'constraint',
      constraint: {
        type: 'immobilize',
        strength: 0.0, // No movement restriction
        duration: 6000
      }
    }
  },

  thunderwave: {
    id: 'thunderwave',
    name: 'Thunderwave',
    level: 1,
    school: 'evocation',
    castingTime: '1 action',
    range: 'Self (15-foot cube)',
    components: ['verbal', 'somatic'],
    duration: 'Instantaneous',
    description: 'A wave of thunderous force sweeps out from you, pushing creatures away.',
    effects: [{
      type: 'damage',
      target: 'area',
      area: { type: 'cube', size: 15 },
      damage: {
        dice: '2d8',
        type: 'thunder',
        savingThrow: {
          ability: 'CON',
          onSuccess: 'half'
        }
      }
    }],
    physics: {
      type: 'force',
      force: {
        magnitude: 200,
        duration: 500
      }
    },
    scaling: {
      damage: '1d8'
    }
  },

  // 2ND LEVEL SPELLS
  mistyStep: {
    id: 'misty_step',
    name: 'Misty Step',
    level: 2,
    school: 'conjuration',
    castingTime: '1 bonus action',
    range: 'Self',
    components: ['verbal'],
    duration: 'Instantaneous',
    description: 'Surrounded by silver mist, you teleport up to 30 feet to an unoccupied space.',
    effects: [{
      type: 'teleport',
      target: 'self'
    }],
    physics: {
      type: 'teleport',
      teleport: {
        range: 30,
        requiresLineOfSight: false
      }
    }
  },

  web: {
    id: 'web',
    name: 'Web',
    level: 2,
    school: 'conjuration',
    castingTime: '1 action',
    range: '60 feet',
    components: ['verbal', 'somatic', 'material'],
    duration: 'Concentration, up to 1 hour',
    concentration: true,
    description: 'Thick, sticky webs fill a 20-foot cube, restraining creatures.',
    effects: [{
      type: 'condition',
      target: 'area',
      area: { type: 'cube', size: 20 },
      condition: {
        id: 'restrained',
        duration: 3600000, // 1 hour in ms
        savingThrow: {
          ability: 'DEX',
          endOfTurn: true
        }
      }
    }],
    physics: {
      type: 'constraint',
      constraint: {
        type: 'entangle',
        strength: 0.8,
        duration: 3600000
      }
    }
  },

  scorchingRay: {
    id: 'scorching_ray',
    name: 'Scorching Ray',
    level: 2,
    school: 'evocation',
    castingTime: '1 action',
    range: '120 feet',
    components: ['verbal', 'somatic'],
    duration: 'Instantaneous',
    description: 'You create three rays of fire and hurl them at targets within range.',
    effects: [{
      type: 'damage',
      target: 'multiple',
      damage: {
        dice: '2d6',
        type: 'fire'
      }
    }],
    physics: {
      type: 'projectile',
      projectile: {
        speed: 350,
        gravity: false,
        piercing: false
      }
    },
    scaling: {
      damage: '2d6',
      effects: 'additional_rays'
    }
  },

  // 3RD LEVEL SPELLS
  fireball: {
    id: 'fireball',
    name: 'Fireball',
    level: 3,
    school: 'evocation',
    castingTime: '1 action',
    range: '150 feet',
    components: ['verbal', 'somatic', 'material'],
    duration: 'Instantaneous',
    description: 'A bright flash and thunderous boom as fire explodes in a 20-foot radius.',
    effects: [{
      type: 'damage',
      target: 'area',
      area: { type: 'sphere', size: 20 },
      damage: {
        dice: '8d6',
        type: 'fire',
        savingThrow: {
          ability: 'DEX',
          onSuccess: 'half'
        }
      }
    }],
    physics: {
      type: 'projectile',
      projectile: {
        speed: 200,
        gravity: true,
        piercing: false
      },
      force: {
        magnitude: 150,
        duration: 1000
      }
    },
    scaling: {
      damage: '1d6'
    }
  },

  lightningBolt: {
    id: 'lightning_bolt',
    name: 'Lightning Bolt',
    level: 3,
    school: 'evocation',
    castingTime: '1 action',
    range: 'Self (100-foot line)',
    components: ['verbal', 'somatic', 'material'],
    duration: 'Instantaneous',
    description: 'A stroke of lightning forming a line 100 feet long and 5 feet wide.',
    effects: [{
      type: 'damage',
      target: 'line',
      area: { type: 'line', size: 100 },
      damage: {
        dice: '8d6',
        type: 'lightning',
        savingThrow: {
          ability: 'DEX',
          onSuccess: 'half'
        }
      }
    }],
    physics: {
      type: 'force',
      force: {
        magnitude: 100,
        direction: { x: 1, y: 0 },
        duration: 200
      }
    },
    scaling: {
      damage: '1d6'
    }
  },

  // 4TH LEVEL SPELLS
  wallOfFire: {
    id: 'wall_of_fire',
    name: 'Wall of Fire',
    level: 4,
    school: 'evocation',
    castingTime: '1 action',
    range: '120 feet',
    components: ['verbal', 'somatic', 'material'],
    duration: 'Concentration, up to 1 minute',
    concentration: true,
    description: 'A wall of fire springs into existence, blocking movement and dealing damage.',
    effects: [{
      type: 'damage',
      target: 'area',
      damage: {
        dice: '5d8',
        type: 'fire'
      }
    }],
    physics: {
      type: 'area_barrier',
      barrier: {
        thickness: 5,
        height: 20,
        duration: 600000, // 10 minutes
        passable: false
      }
    },
    scaling: {
      damage: '1d8'
    }
  },

  dimensionDoor: {
    id: 'dimension_door',
    name: 'Dimension Door',
    level: 4,
    school: 'conjuration',
    castingTime: '1 action',
    range: '500 feet',
    components: ['verbal'],
    duration: 'Instantaneous',
    description: 'You teleport yourself and up to one willing creature to any spot within range.',
    effects: [{
      type: 'teleport',
      target: 'multiple'
    }],
    physics: {
      type: 'teleport',
      teleport: {
        range: 500,
        requiresLineOfSight: false
      }
    }
  },

  // 5TH LEVEL SPELLS
  wallOfForce: {
    id: 'wall_of_force',
    name: 'Wall of Force',
    level: 5,
    school: 'evocation',
    castingTime: '1 action',
    range: '120 feet',
    components: ['verbal', 'somatic', 'material'],
    duration: 'Concentration, up to 10 minutes',
    concentration: true,
    description: 'An invisible wall of force springs into existence.',
    effects: [{
      type: 'utility',
      target: 'area'
    }],
    physics: {
      type: 'area_barrier',
      barrier: {
        thickness: 1,
        height: 20,
        duration: 600000, // 10 minutes
        passable: false
      }
    }
  },

  bigbysHand: {
    id: 'bigbys_hand',
    name: "Bigby's Hand",
    level: 5,
    school: 'evocation',
    castingTime: '1 action',
    range: '120 feet',
    components: ['verbal', 'somatic', 'material'],
    duration: 'Concentration, up to 1 minute',
    concentration: true,
    description: 'You create a Large hand of shimmering, translucent force.',
    effects: [{
      type: 'utility',
      target: 'area'
    }],
    physics: {
      type: 'force',
      force: {
        magnitude: 300,
        duration: 60000 // 1 minute
      }
    }
  },

  // MOVEMENT AND CONTROL SPELLS
  slow: {
    id: 'slow',
    name: 'Slow',
    level: 3,
    school: 'transmutation',
    castingTime: '1 action',
    range: '120 feet',
    components: ['verbal', 'somatic', 'material'],
    duration: 'Concentration, up to 1 minute',
    concentration: true,
    description: 'You alter time around up to six creatures, slowing their movements.',
    effects: [{
      type: 'condition',
      target: 'multiple',
      condition: {
        id: 'slowed',
        duration: 60000,
        savingThrow: {
          ability: 'WIS',
          endOfTurn: true
        }
      }
    }],
    physics: {
      type: 'movement_modifier',
      movementModifier: {
        speedMultiplier: 0.5,
        duration: 60000
      }
    }
  },

  haste: {
    id: 'haste',
    name: 'Haste',
    level: 3,
    school: 'transmutation',
    castingTime: '1 action',
    range: '30 feet',
    components: ['verbal', 'somatic', 'material'],
    duration: 'Concentration, up to 1 minute',
    concentration: true,
    description: 'Choose a willing creature. Its speed is doubled and it gains additional actions.',
    effects: [{
      type: 'buff',
      target: 'single',
      modifier: {
        target: 'speed',
        value: 2.0,
        duration: 60000
      }
    }],
    physics: {
      type: 'movement_modifier',
      movementModifier: {
        speedMultiplier: 2.0,
        jumpMultiplier: 1.5,
        duration: 60000
      }
    }
  },

  holdPerson: {
    id: 'hold_person',
    name: 'Hold Person',
    level: 2,
    school: 'enchantment',
    castingTime: '1 action',
    range: '60 feet',
    components: ['verbal', 'somatic', 'material'],
    duration: 'Concentration, up to 1 minute',
    concentration: true,
    description: 'Choose a humanoid that you can see within range. The target must succeed on a Wisdom saving throw or be paralyzed.',
    effects: [{
      type: 'condition',
      target: 'single',
      condition: {
        id: 'paralyzed',
        duration: 60000,
        savingThrow: {
          ability: 'WIS',
          endOfTurn: true
        }
      }
    }],
    physics: {
      type: 'constraint',
      constraint: {
        type: 'immobilize',
        strength: 1.0,
        duration: 60000
      }
    }
  },

  entangle: {
    id: 'entangle',
    name: 'Entangle',
    level: 1,
    school: 'conjuration',
    castingTime: '1 action',
    range: '90 feet',
    components: ['verbal', 'somatic'],
    duration: 'Concentration, up to 1 minute',
    concentration: true,
    description: 'Grasping weeds and vines sprout from the ground in a 20-foot square.',
    effects: [{
      type: 'condition',
      target: 'area',
      area: { type: 'cube', size: 20 },
      condition: {
        id: 'restrained',
        duration: 60000,
        savingThrow: {
          ability: 'STR',
          endOfTurn: true
        }
      }
    }],
    physics: {
      type: 'constraint',
      constraint: {
        type: 'entangle',
        strength: 0.7,
        duration: 60000
      }
    }
  },

  // HEALING AND SUPPORT
  healingWord: {
    id: 'healing_word',
    name: 'Healing Word',
    level: 1,
    school: 'evocation',
    castingTime: '1 bonus action',
    range: '60 feet',
    components: ['verbal'],
    duration: 'Instantaneous',
    description: 'A creature of your choice regains hit points.',
    effects: [{
      type: 'healing',
      target: 'single',
      healing: {
        dice: '1d4',
        maxTargets: 1
      }
    }],
    scaling: {
      healing: '1d4'
    }
  },

  spiritualWeapon: {
    id: 'spiritual_weapon',
    name: 'Spiritual Weapon',
    level: 2,
    school: 'evocation',
    castingTime: '1 bonus action',
    range: '60 feet',
    components: ['verbal', 'somatic'],
    duration: '1 minute',
    description: 'You create a floating, spectral weapon that attacks enemies.',
    effects: [{
      type: 'damage',
      target: 'single',
      damage: {
        dice: '1d8',
        type: 'force'
      }
    }],
    physics: {
      type: 'projectile',
      projectile: {
        speed: 150,
        gravity: false,
        piercing: false
      }
    },
    scaling: {
      damage: '1d8'
    }
  }
};

/**
 * Spell utility functions
 */
export const _getSpellsByLevel = (level: number): PhysicsSpellEffect[] => {
  return Object.values(ENHANCED_DND5E_SPELLS).filter(spell => spell.level === level);
};

export const _getSpellsBySchool = (school: string): PhysicsSpellEffect[] => {
  return Object.values(ENHANCED_DND5E_SPELLS).filter(spell => spell.school === school);
};

export const _getConcentrationSpells = (): PhysicsSpellEffect[] => {
  return Object.values(ENHANCED_DND5E_SPELLS).filter(spell => spell.concentration);
};

export const _getPhysicsSpells = (): PhysicsSpellEffect[] => {
  return Object.values(ENHANCED_DND5E_SPELLS).filter(spell => spell.physics);
};

export const _getProjectileSpells = (): PhysicsSpellEffect[] => {
  return Object.values(ENHANCED_DND5E_SPELLS).filter(
    spell => spell.physics?.type === 'projectile'
  );
};

export const _getAreaSpells = (): PhysicsSpellEffect[] => {
  return Object.values(ENHANCED_DND5E_SPELLS).filter(spell => 
    spell.effects?.some(effect => effect.target === 'area')
  );
};

export const _getMovementSpells = (): PhysicsSpellEffect[] => {
  return Object.values(ENHANCED_DND5E_SPELLS).filter(spell => 
    spell.physics?.type === 'movement_modifier' || 
    spell.physics?.type === 'teleport' ||
    spell.physics?.type === 'constraint'
  );
};
