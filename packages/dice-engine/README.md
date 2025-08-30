# @vtt/dice-engine

Dice rolling engine for the Virtual Tabletop platform.

## Overview

Comprehensive dice rolling system supporting D&D 5e and custom dice notation with modifiers, advantage/disadvantage, and roll history.

## Installation

```bash
npm install @vtt/dice-engine
```

## Usage

```typescript
import { DiceRoller, DiceExpression, RollResult } from '@vtt/dice-engine';

// Create dice roller
const roller = new DiceRoller();

// Simple rolls
const d20Roll = roller.roll('1d20');
const damageRoll = roller.roll('2d6+3');

// Complex expressions
const complexRoll = roller.roll('4d6kh3+2'); // Keep highest 3 of 4d6, add 2

// Advantage/Disadvantage
const advantageRoll = roller.roll('1d20', { advantage: true });
const disadvantageRoll = roller.roll('1d20', { disadvantage: true });

// Multiple rolls
const multipleRolls = roller.rollMultiple('1d20+5', 3);

console.log(`Roll result: ${d20Roll.total}`);
console.log(`Individual dice: ${d20Roll.dice.map(d => d.value).join(', ')}`);
```

## API Reference

### DiceRoller

Main class for executing dice rolls.

#### Constructor Options
- `seed?: number` - Random seed for reproducible results
- `explodeOn?: number[]` - Dice values that trigger explosion
- `maxExplodes?: number` - Maximum number of explosions per die (default: 10)

#### Methods
- `roll(expression: string, options?: RollOptions): RollResult`
- `rollMultiple(expression: string, count: number): RollResult[]`
- `rollAdvantage(expression: string): RollResult`
- `rollDisadvantage(expression: string): RollResult`
- `rollWithModifiers(expression: string, modifiers: Modifier[]): RollResult`

### Dice Notation Support

#### Basic Notation
- `1d20` - Roll one 20-sided die
- `2d6` - Roll two 6-sided dice
- `3d8+2` - Roll three 8-sided dice and add 2
- `1d10-1` - Roll one 10-sided die and subtract 1

#### Advanced Notation
- `4d6kh3` - Keep highest 3 of 4d6 (ability score generation)
- `4d6kl1` - Keep lowest 1 of 4d6
- `2d20kh1` - Advantage (keep highest of 2d20)
- `2d20kl1` - Disadvantage (keep lowest of 2d20)
- `1d6!` - Exploding die (reroll on max value)
- `1d6!!` - Compounding exploding die
- `3d6r1` - Reroll 1s once
- `3d6rr1` - Reroll 1s indefinitely
- `1d100cs>95` - Count successes (values > 95)
- `5d10f<3` - Count failures (values < 3)

#### Complex Expressions
```typescript
// Fireball damage with save
roller.roll('8d6', { 
  saveType: 'dexterity', 
  saveDC: 15,
  halfOnSave: true 
});

// Critical hit damage
roller.roll('1d8+3', { critical: true }); // Doubles dice

// Sneak attack with advantage
roller.roll('1d20+8', { advantage: true })
  .then(attackRoll => {
    if (attackRoll.total >= targetAC) {
      return roller.roll('1d6+3+3d6'); // Weapon + sneak attack
    }
  });
```

### RollResult

Contains detailed information about a dice roll.

#### Properties
- `total: number` - Final result after all modifiers
- `dice: Die[]` - Individual die results
- `expression: string` - Original expression
- `modifiers: number` - Sum of all modifiers
- `metadata: RollMetadata` - Additional roll information

#### Methods
- `toString(): string` - Human-readable result
- `toDetailedString(): string` - Detailed breakdown
- `getStatistics(): RollStatistics` - Statistical analysis
- `reroll(indices?: number[]): RollResult` - Reroll specific dice

### Die

Represents a single die result.

#### Properties
- `value: number` - Final value
- `sides: number` - Number of sides
- `rolled: number[]` - All values rolled (for exploding dice)
- `kept: boolean` - Whether die was kept in final result
- `exploded: boolean` - Whether die exploded
- `rerolled: boolean` - Whether die was rerolled

### Advantage/Disadvantage

Built-in support for D&D 5e advantage and disadvantage mechanics.

```typescript
// Advantage - roll twice, keep higher
const advantage = roller.rollAdvantage('1d20+5');

// Disadvantage - roll twice, keep lower  
const disadvantage = roller.rollDisadvantage('1d20+5');

// Manual advantage/disadvantage
const manualAdvantage = roller.roll('2d20kh1+5');
const manualDisadvantage = roller.roll('2d20kl1+5');
```

### Statistical Analysis

Comprehensive statistical analysis of dice expressions.

```typescript
import { DiceAnalyzer } from '@vtt/dice-engine';

const analyzer = new DiceAnalyzer();

// Analyze expression
const stats = analyzer.analyze('2d6+3');

console.log(`Average: ${stats.average}`);
console.log(`Min: ${stats.minimum}, Max: ${stats.maximum}`);
console.log(`Standard Deviation: ${stats.standardDeviation}`);
console.log(`Probability of rolling 10+: ${stats.getProbability(10, Infinity)}`);

// Generate probability distribution
const distribution = stats.getDistribution();
distribution.forEach((prob, value) => {
  console.log(`${value}: ${(prob * 100).toFixed(2)}%`);
});
```

### Custom Dice Types

Support for custom dice and game-specific mechanics.

```typescript
// Fate/Fudge dice (-1, 0, +1)
const fateDie = new CustomDie([-1, 0, 0, 1, 1, 1]);
roller.addCustomDie('dF', fateDie);
const fateRoll = roller.roll('4dF+2');

// Genesys narrative dice
const abilityDie = new CustomDie([
  { success: 0, advantage: 0 },
  { success: 1, advantage: 0 },
  { success: 1, advantage: 1 },
  // ... more faces
]);

// Dice pools (World of Darkness, Shadowrun)
const dicePool = roller.rollPool('8d10', { 
  target: 8, 
  explodeOn: [10],
  botchOn: [1] 
});
```

### Modifiers and Conditions

Apply dynamic modifiers based on game state.

```typescript
import { Modifier, Condition } from '@vtt/dice-engine';

// Conditional modifiers
const modifiers = [
  new Modifier('flanking', 2, { condition: 'target is flanked' }),
  new Modifier('cover', -2, { condition: 'target has cover' }),
  new Modifier('magic weapon', 1, { type: 'enhancement' })
];

const roll = roller.rollWithModifiers('1d20+5', modifiers);

// Situational bonuses
const situationalRoll = roller.roll('1d20+5', {
  bonuses: [
    { name: 'Bless', value: '1d4' },
    { name: 'Guidance', value: '1d4' }
  ]
});
```

### Dice History and Logging

Track and replay dice rolls for auditing and debugging.

```typescript
import { DiceLogger } from '@vtt/dice-engine';

const logger = new DiceLogger();
roller.setLogger(logger);

// All rolls are automatically logged
roller.roll('1d20+5');
roller.roll('2d6+3');

// Retrieve history
const history = logger.getHistory();
const lastRoll = logger.getLastRoll();

// Replay rolls with same seed
const replay = logger.replay(rollId);

// Export/import for persistence
const exported = logger.export();
logger.import(exported);
```

### Integration with Game Systems

#### D&D 5e Integration
```typescript
import { DnD5eRoller } from '@vtt/dice-engine/systems';

const dnd5e = new DnD5eRoller();

// Ability checks with proficiency
const skillCheck = dnd5e.rollSkill('stealth', {
  abilityScore: 16, // Dexterity
  proficiencyBonus: 3,
  expertise: true
});

// Attack rolls with critical hits
const attack = dnd5e.rollAttack('longsword', {
  attackBonus: 8,
  damageExpression: '1d8+5',
  criticalRange: 19 // Champion fighter
});

// Saving throws
const save = dnd5e.rollSave('constitution', {
  abilityScore: 14,
  proficiencyBonus: 3,
  advantage: true
});
```

#### Pathfinder Integration
```typescript
import { PathfinderRoller } from '@vtt/dice-engine/systems';

const pf = new PathfinderRoller();

// Multiple attack penalty
const attacks = pf.rollMultipleAttacks([
  { bonus: 10, penalty: 0 },
  { bonus: 10, penalty: -5 },
  { bonus: 10, penalty: -10 }
]);
```

### Performance Features

- **Lazy Evaluation**: Complex expressions only calculated when needed
- **Caching**: Statistical analysis results cached for repeated expressions
- **Batch Rolling**: Efficient processing of multiple rolls
- **Memory Management**: Automatic cleanup of old roll history

### Events and Hooks

```typescript
// Listen for roll events
roller.on('beforeRoll', (expression, options) => {
  console.log(`About to roll: ${expression}`);
});

roller.on('afterRoll', (result) => {
  console.log(`Rolled ${result.total}`);
  
  // Check for critical success/failure
  if (result.dice.some(d => d.value === d.sides)) {
    console.log('Natural 20!');
  }
});

roller.on('explode', (die, explosionCount) => {
  console.log(`Die exploded ${explosionCount} times!`);
});
```

### Validation and Error Handling

```typescript
import { DiceValidator, DiceError } from '@vtt/dice-engine';

const validator = new DiceValidator();

try {
  // Validate expression before rolling
  if (validator.isValid('1d20+5')) {
    const result = roller.roll('1d20+5');
  }
} catch (error) {
  if (error instanceof DiceError) {
    console.error(`Dice error: ${error.message}`);
    console.error(`Expression: ${error.expression}`);
  }
}

// Common validation checks
validator.hasValidSyntax('2d6+3'); // true
validator.hasReasonableLimits('1000d1000'); // false - too many dice
validator.isSecure('1d20; DROP TABLE users'); // false - injection attempt
```

## Development

```bash
# Install dependencies
npm install

# Build the package
npm run build

# Run tests
npm test

# Run performance benchmarks
npm run benchmark

# Watch mode for development
npm run dev

# Generate statistical tables
npm run generate-tables
```

## Testing

Comprehensive test suite including:
- Expression parsing accuracy
- Statistical correctness
- Performance benchmarks
- Edge case handling
- Cross-platform compatibility

## Browser Support

- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+
- Node.js 14+
- `rollWithDisadvantage(notation)` - Roll with disadvantage
- `rollAttack(notation, options)` - Roll attack with crit detection
- `getHistory()` - Get roll history

## License

MIT
