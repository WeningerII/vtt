# @vtt/combat

Combat system management for the Virtual Tabletop platform.

## Overview

Handles combat mechanics, turn order, damage calculation, and combat state management for D&D 5e and other systems.

## Installation

```bash
npm install @vtt/combat
```

## Usage

```typescript
import { CombatManager, Initiative, CombatAction, Condition } from '@vtt/combat';

// Initialize combat manager
const combat = new CombatManager({
  system: 'dnd5e',
  autoAdvanceTurns: true,
  trackResources: true
});

// Add participants
combat.addParticipant({
  id: 'player1',
  name: 'Aragorn',
  initiative: 18,
  hp: 45,
  maxHp: 45,
  ac: 16
});

combat.addParticipant({
  id: 'orc1',
  name: 'Orc Warrior',
  initiative: 12,
  hp: 15,
  maxHp: 15,
  ac: 13
});

// Start combat
combat.startCombat();

// Execute actions
const attackAction = new CombatAction({
  type: 'attack',
  actor: 'player1',
  target: 'orc1',
  weapon: 'longsword',
  damage: '1d8+3'
});

combat.executeAction(attackAction);
```

## API Reference

### CombatManager

Main class for managing combat encounters.

#### Constructor Options
- `system: string` - Rule system ('dnd5e', 'pathfinder', etc.)
- `autoAdvanceTurns?: boolean` - Automatically advance turns (default: true)
- `trackResources?: boolean` - Track spell slots, abilities (default: true)
- `enforceRules?: boolean` - Enforce system rules (default: true)

#### Methods
- `addParticipant(participant: CombatParticipant): void`
- `removeParticipant(id: string): void`
- `startCombat(): void`
- `endCombat(): void`
- `nextTurn(): void`
- `previousTurn(): void`
- `executeAction(action: CombatAction): ActionResult`
- `applyDamage(targetId: string, damage: number): void`
- `applyHealing(targetId: string, healing: number): void`
- `addCondition(targetId: string, condition: Condition): void`
- `removeCondition(targetId: string, conditionId: string): void`

### CombatParticipant

Represents a character or creature in combat.

#### Properties
- `id: string` - Unique identifier
- `name: string` - Display name
- `initiative: number` - Initiative score
- `hp: number` - Current hit points
- `maxHp: number` - Maximum hit points
- `ac: number` - Armor class
- `conditions: Condition[]` - Active conditions
- `resources: ResourceTracker` - Spell slots, abilities, etc.

#### Methods
- `takeDamage(amount: number, type?: DamageType): void`
- `heal(amount: number): void`
- `rollInitiative(): number`
- `canAct(): boolean`
- `getAvailableActions(): CombatAction[]`

### CombatAction

Represents an action taken during combat.

#### Types
- `attack` - Weapon or spell attack
- `cast` - Cast a spell
- `dash` - Move extra distance
- `dodge` - Gain defensive benefits
- `help` - Assist another character
- `hide` - Attempt to hide
- `ready` - Prepare an action
- `search` - Look for something
- `use` - Use an item or feature

#### Properties
- `type: ActionType` - Type of action
- `actor: string` - ID of acting participant
- `target?: string` - ID of target (if applicable)
- `description: string` - Action description
- `cost: ActionCost` - Action economy cost

### Initiative

Initiative tracking and management.

```typescript
import { Initiative } from '@vtt/combat';

const initiative = new Initiative();

// Roll initiative for all participants
initiative.rollAll(participants);

// Manual initiative setting
initiative.setInitiative('player1', 18);

// Get turn order
const turnOrder = initiative.getTurnOrder();

// Advance to next participant
const nextParticipant = initiative.next();
```

### Condition Management

Track and apply conditions like poisoned, stunned, etc.

```typescript
import { Condition, ConditionType } from '@vtt/combat';

// Create condition
const poisoned = new Condition({
  type: ConditionType.Poisoned,
  duration: 3, // rounds
  source: 'Poison Dart',
  effects: {
    disadvantageOnAttacks: true,
    disadvantageOnAbilityChecks: true
  }
});

// Apply to participant
combat.applyCondition('player1', poisoned);

// Conditions automatically tick down each round
combat.on('roundEnd', () => {
  combat.tickConditions();
});
```

### Damage and Healing

Comprehensive damage calculation with resistances and vulnerabilities.

```typescript
import { DamageCalculator, DamageType } from '@vtt/combat';

const calculator = new DamageCalculator();

// Calculate damage with resistances
const damage = calculator.calculate({
  base: 12,
  type: DamageType.Fire,
  target: participant,
  source: 'Fireball'
});

// Apply damage
participant.takeDamage(damage.total, damage.type);
```

### Resource Tracking

Track spell slots, class abilities, and other limited resources.

```typescript
import { ResourceTracker } from '@vtt/combat';

const resources = new ResourceTracker({
  spellSlots: {
    1: { max: 4, current: 4 },
    2: { max: 3, current: 2 },
    3: { max: 2, current: 1 }
  },
  abilities: {
    'action-surge': { max: 1, current: 1, rechargeOn: 'short-rest' },
    'second-wind': { max: 1, current: 0, rechargeOn: 'short-rest' }
  }
});

// Use resource
resources.spend('spellSlots', 2, 1); // Use 1 second-level spell slot

// Check availability
if (resources.canSpend('abilities', 'action-surge')) {
  // Use Action Surge
}
```

## Events

The combat system emits events for real-time updates:

```typescript
combat.on('combatStart', () => {
  console.log('Combat has begun!');
});

combat.on('turnStart', (participant) => {
  console.log(`${participant.name}'s turn`);
});

combat.on('actionExecuted', (action, result) => {
  console.log(`${action.actor} used ${action.type}`);
});

combat.on('participantDefeated', (participant) => {
  console.log(`${participant.name} has been defeated`);
});

combat.on('combatEnd', (result) => {
  console.log('Combat ended:', result);
});
```

## Integration Examples

### With Dice Rolling

```typescript
import { DiceRoller } from '@vtt/dice-engine';

const roller = new DiceRoller();

// Attack roll with advantage
const attackRoll = roller.roll('1d20+5', { advantage: true });
if (attackRoll.total >= target.ac) {
  const damage = roller.roll('1d8+3');
  combat.applyDamage(target.id, damage.total);
}
```

### With Character Sheets

```typescript
// Sync combat participant with character sheet
combat.on('participantUpdated', (participant) => {
  characterSheet.updateHitPoints(participant.hp);
  characterSheet.updateConditions(participant.conditions);
});
```

### With AI

```typescript
import { CombatAI } from '@vtt/ai';

const ai = new CombatAI();

// Get AI suggestions for NPC actions
combat.on('turnStart', async (participant) => {
  if (participant.type === 'npc') {
    const suggestion = await ai.suggestAction(participant, combat.getState());
    combat.executeAction(suggestion);
  }
});
```

## Rule System Support

### D&D 5e Features
- Action economy (Action, Bonus Action, Reaction, Movement)
- Advantage/Disadvantage mechanics
- Spell slot tracking
- Concentration checks
- Death saving throws
- Opportunity attacks

### Pathfinder Features
- Three-action system
- Reaction timing
- Multiple attack penalty
- Hero points

### Custom Rules
```typescript
// Define custom rule
combat.addRule('custom-crit', {
  trigger: 'attack-roll',
  condition: (roll) => roll.natural === 20,
  effect: (action) => {
    action.damage *= 2;
    action.addEffect('critical-hit');
  }
});
```

## Performance Features

- **Lazy Loading**: Only load rules for active game system
- **Event Batching**: Batch multiple updates for efficiency
- **State Snapshots**: Quick save/restore combat state
- **Memory Management**: Automatic cleanup of ended combats

## Development

```bash
# Install dependencies
npm install

# Build the package
npm run build

# Run tests
npm test

# Watch mode for development
npm run dev

# Run integration tests
npm run test:integration
```

## Testing

Comprehensive test suite covering:
- Initiative tracking
- Action resolution
- Condition management
- Resource tracking
- Rule enforcement
- Edge cases and error handling
- `applyDamage(targetId, amount, type)` - Apply damage to target
- `endCombat()` - End combat and clean up

## License

MIT
