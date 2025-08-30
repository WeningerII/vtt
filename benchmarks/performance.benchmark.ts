/**
 * Performance benchmarks for VTT core systems
 */
import { performance } from 'perf_hooks';
import { DiceEngine } from '../packages/dice-engine/src/DiceEngine';
import { ConditionsEngine } from '../packages/conditions-engine/src/index';
import { SpellEngine } from '../packages/spell-engine/src/index';

interface BenchmarkResult {
  name: string;
  operations: number;
  totalTime: number;
  averageTime: number;
  opsPerSecond: number;
}

class PerformanceBenchmark {
  private results: BenchmarkResult[] = [];

  async runBenchmark(name: string, operation: () => Promise<void> | void, iterations = 1000): Promise<BenchmarkResult> {
    console.log(`Running benchmark: ${name} (${iterations} iterations)`);
    
    // Warm up
    for (let i = 0; i < 10; i++) {
      await operation();
    }

    const startTime = performance.now();
    
    for (let i = 0; i < iterations; i++) {
      await operation();
    }
    
    const endTime = performance.now();
    const totalTime = endTime - startTime;
    const averageTime = totalTime / iterations;
    const opsPerSecond = 1000 / averageTime;

    const result: BenchmarkResult = {
      name,
      operations: iterations,
      totalTime,
      averageTime,
      opsPerSecond
    };

    this.results.push(result);
    return result;
  }

  getResults(): BenchmarkResult[] {
    return this.results;
  }

  printResults(): void {
    console.log('\n=== Performance Benchmark Results ===');
    console.log('Name'.padEnd(30) + 'Ops/sec'.padEnd(12) + 'Avg Time (ms)'.padEnd(15) + 'Total Time (ms)');
    console.log('-'.repeat(70));
    
    this.results.forEach(result => {
      console.log(
        result.name.padEnd(30) +
        result.opsPerSecond.toFixed(0).padEnd(12) +
        result.averageTime.toFixed(3).padEnd(15) +
        result.totalTime.toFixed(2)
      );
    });
  }
}

async function runDiceEngineBenchmarks(benchmark: PerformanceBenchmark) {
  const diceEngine = new DiceEngine();

  await benchmark.runBenchmark('Simple d20 roll', () => {
    diceEngine.roll('1d20');
  }, 10000);

  await benchmark.runBenchmark('Complex dice expression', () => {
    diceEngine.roll('3d6+2d4+5');
  }, 5000);

  await benchmark.runBenchmark('Damage roll with modifiers', () => {
    diceEngine.rollDamage('2d6+3', 'slashing');
  }, 5000);

  await benchmark.runBenchmark('Attack roll with advantage', () => {
    diceEngine.rollWithAdvantage('1d20+5');
  }, 5000);
}

async function runConditionsEngineBenchmarks(benchmark: PerformanceBenchmark) {
  const conditionsEngine = new ConditionsEngine();
  const entityId = 'test-entity';

  await benchmark.runBenchmark('Apply condition', () => {
    conditionsEngine.applyCondition(entityId, 'poisoned', 10);
  }, 5000);

  await benchmark.runBenchmark('Check condition', () => {
    conditionsEngine.hasCondition(entityId, 'poisoned');
  }, 10000);

  await benchmark.runBenchmark('Get active conditions', () => {
    conditionsEngine.getActiveConditions(entityId);
  }, 10000);

  await benchmark.runBenchmark('Process turn effects', () => {
    conditionsEngine.processTurnStart(entityId);
  }, 5000);

  await benchmark.runBenchmark('Apply condition effects', () => {
    conditionsEngine.applyConditionEffects(entityId, 'attack_rolls');
  }, 5000);
}

async function runSpellEngineBenchmarks(benchmark: PerformanceBenchmark) {
  const spellEngine = new SpellEngine();
  const casterId = 'test-caster';

  // Initialize spell slots
  spellEngine.initializeSpellSlots(casterId, {
    1: { current: 4, maximum: 4 },
    2: { current: 3, maximum: 3 },
    3: { current: 2, maximum: 2 }
  });

  const testSpell = {
    id: 'fireball',
    name: 'Fireball',
    level: 3,
    school: 'evocation' as const,
    castingTime: '1 action',
    range: '150 feet',
    components: { verbal: true, somatic: true, material: 'bat guano' },
    duration: 'Instantaneous',
    damage: { dice: '8d6', type: 'fire' },
    savingThrow: { ability: 'dexterity', dc: 15 },
    areaOfEffect: { type: 'sphere', size: 20 }
  };

  await benchmark.runBenchmark('Cast spell', () => {
    spellEngine.castSpell(casterId, testSpell, 3);
  }, 1000);

  await benchmark.runBenchmark('Check spell slots', () => {
    spellEngine.getAvailableSpellSlots(casterId);
  }, 10000);

  await benchmark.runBenchmark('Calculate spell damage', () => {
    spellEngine.calculateSpellDamage(testSpell, 3);
  }, 5000);
}

async function runMemoryBenchmarks(benchmark: PerformanceBenchmark) {
  const largeArray = new Array(10000).fill(0).map((_, i) => ({ id: i, data: `item-${i}` }));
  const largeMap = new Map(largeArray.map(item => [item.id, item]));
  const largeSet = new Set(largeArray.map(item => item.id));

  await benchmark.runBenchmark('Array search (10k items)', () => {
    largeArray.find(item => item.id === 5000);
  }, 1000);

  await benchmark.runBenchmark('Map lookup (10k items)', () => {
    largeMap.get(5000);
  }, 10000);

  await benchmark.runBenchmark('Set has check (10k items)', () => {
    largeSet.has(5000);
  }, 10000);

  await benchmark.runBenchmark('Array filter (10k items)', () => {
    largeArray.filter(item => item.id > 5000);
  }, 100);

  await benchmark.runBenchmark('JSON stringify (10k items)', () => {
    JSON.stringify(largeArray);
  }, 100);

  await benchmark.runBenchmark('JSON parse (10k items)', () => {
    JSON.parse(JSON.stringify(largeArray));
  }, 100);
}

async function runConcurrencyBenchmarks(benchmark: PerformanceBenchmark) {
  const asyncOperation = () => new Promise(resolve => setTimeout(resolve, 1));
  
  await benchmark.runBenchmark('Sequential async operations', async () => {
    for (let i = 0; i < 10; i++) {
      await asyncOperation();
    }
  }, 100);

  await benchmark.runBenchmark('Parallel async operations', async () => {
    const promises = Array(10).fill(0).map(() => asyncOperation());
    await Promise.all(promises);
  }, 100);

  await benchmark.runBenchmark('Promise creation overhead', () => {
    return new Promise(resolve => resolve(undefined));
  }, 5000);
}

export async function runAllBenchmarks(): Promise<void> {
  const benchmark = new PerformanceBenchmark();

  console.log('Starting VTT Performance Benchmarks...\n');

  try {
    console.log('Running Dice Engine benchmarks...');
    await runDiceEngineBenchmarks(benchmark);

    console.log('Running Conditions Engine benchmarks...');
    await runConditionsEngineBenchmarks(benchmark);

    console.log('Running Spell Engine benchmarks...');
    await runSpellEngineBenchmarks(benchmark);

    console.log('Running Memory benchmarks...');
    await runMemoryBenchmarks(benchmark);

    console.log('Running Concurrency benchmarks...');
    await runConcurrencyBenchmarks(benchmark);

    benchmark.printResults();

    // Performance thresholds
    const results = benchmark.getResults();
    const criticalBenchmarks = results.filter(result => result.opsPerSecond < 1000);
    
    if (criticalBenchmarks.length > 0) {
      console.log('\n⚠️  Performance Issues Detected:');
      criticalBenchmarks.forEach(result => {
        console.log(`- ${result.name}: ${result.opsPerSecond.toFixed(0)} ops/sec (< 1000 threshold)`);
      });
    } else {
      console.log('\n✅ All benchmarks passed performance thresholds');
    }

  } catch (error) {
    console.error('Benchmark failed:', error);
    throw error;
  }
}

// Run benchmarks if called directly
if (require.main === module) {
  runAllBenchmarks().catch(console.error);
}
