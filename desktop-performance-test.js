#!/usr/bin/env node
/**
 * Desktop VTT Performance Test Suite
 * Focus: Core systems for D&D sessions on desktop
 */

const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

class DesktopVTTBenchmark {
  constructor() {
    this.results = [];
  }

  async runBenchmark(name, operation, iterations = 1000) {
    console.log(`🔍 Testing: ${name} (${iterations} iterations)`);
    
    // Warmup
    for (let i = 0; i < Math.min(10, iterations / 10); i++) {
      await operation();
    }

    const startTime = performance.now();
    const startMemory = process.memoryUsage();

    for (let i = 0; i < iterations; i++) {
      await operation();
    }

    const endTime = performance.now();
    const endMemory = process.memoryUsage();

    const result = {
      name,
      iterations,
      totalTime: endTime - startTime,
      averageTime: (endTime - startTime) / iterations,
      opsPerSecond: 1000 / ((endTime - startTime) / iterations),
      memoryDelta: {
        rss: endMemory.rss - startMemory.rss,
        heapUsed: endMemory.heapUsed - startMemory.heapUsed,
        heapTotal: endMemory.heapTotal - startMemory.heapTotal
      }
    };

    this.results.push(result);
    console.log(`  ⚡ ${result.opsPerSecond.toFixed(0)} ops/sec | ${result.averageTime.toFixed(3)}ms avg`);
    return result;
  }

  // Simulate WebSocket message processing
  async testWebSocketMessages() {
    console.log('\n🔗 WebSocket Performance Tests');
    
    const mockMessage = {
      type: 'token_move',
      payload: {
        tokenId: 'token_123',
        position: { x: 100, y: 200, z: 0 },
        rotation: 45,
        scale: 1.0
      },
      sessionId: 'session_abc',
      userId: 'user_456',
      timestamp: Date.now()
    };

    await this.runBenchmark('WebSocket JSON Parse', () => {
      const parsed = JSON.parse(JSON.stringify(mockMessage));
      return parsed;
    }, 10000);

    await this.runBenchmark('Message Validation', () => {
      const msg = mockMessage;
      const isValid = msg.type && msg.payload && msg.sessionId && msg.userId;
      return isValid;
    }, 10000);

    await this.runBenchmark('Token State Update', () => {
      const tokenState = {
        id: mockMessage.payload.tokenId,
        x: mockMessage.payload.position.x,
        y: mockMessage.payload.position.y,
        rotation: mockMessage.payload.rotation,
        lastUpdate: Date.now()
      };
      return tokenState;
    }, 5000);
  }

  // Simulate 3D rendering calculations
  async testRenderingPerformance() {
    console.log('\n🎨 3D Rendering Performance Tests');

    const tokens = Array(50).fill().map((_, i) => ({
      id: `token_${i}`,
      x: Math.random() * 1000,
      y: Math.random() * 1000,
      z: 0,
      visible: true,
      scale: 1.0 + Math.random() * 0.5
    }));

    await this.runBenchmark('Viewport Culling (50 tokens)', () => {
      const viewport = { x: 0, y: 0, width: 800, height: 600 };
      const visible = tokens.filter(token => 
        token.x >= viewport.x - 50 &&
        token.x <= viewport.x + viewport.width + 50 &&
        token.y >= viewport.y - 50 &&
        token.y <= viewport.y + viewport.height + 50
      );
      return visible.length;
    }, 2000);

    await this.runBenchmark('Distance Calculations (50 tokens)', () => {
      const center = { x: 400, y: 300 };
      const distances = tokens.map(token => {
        const dx = token.x - center.x;
        const dy = token.y - center.y;
        return Math.sqrt(dx * dx + dy * dy);
      });
      return distances;
    }, 1000);

    await this.runBenchmark('Matrix Transformations', () => {
      const matrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
      const translation = [100, 200, 0];
      const rotation = Math.PI / 4;
      
      // Simple matrix operations
      matrix[12] = translation[0];
      matrix[13] = translation[1];
      matrix[14] = translation[2];
      
      return matrix;
    }, 5000);
  }

  // Simulate database/API operations
  async testDatabaseOperations() {
    console.log('\n💾 Database/API Performance Tests');

    const characterSheet = {
      id: 'char_123',
      name: 'Gandalf',
      class: 'Wizard',
      level: 10,
      stats: { str: 10, dex: 12, con: 14, int: 20, wis: 16, cha: 14 },
      spells: Array(30).fill().map((_, i) => ({ id: i, name: `Spell ${i}`, level: Math.floor(i/10) + 1 })),
      equipment: Array(20).fill().map((_, i) => ({ id: i, name: `Item ${i}`, quantity: 1 }))
    };

    await this.runBenchmark('Character Sheet Serialization', () => {
      return JSON.stringify(characterSheet);
    }, 1000);

    await this.runBenchmark('Character Sheet Parsing', () => {
      const serialized = JSON.stringify(characterSheet);
      return JSON.parse(serialized);
    }, 1000);

    await this.runBenchmark('Spell Lookup (30 spells)', () => {
      const spellId = Math.floor(Math.random() * 30);
      return characterSheet.spells.find(s => s.id === spellId);
    }, 5000);

    await this.runBenchmark('Equipment Search (20 items)', () => {
      const query = 'Item';
      return characterSheet.equipment.filter(item => 
        item.name.toLowerCase().includes(query.toLowerCase())
      );
    }, 2000);
  }

  // Test memory intensive operations
  async testMemoryPerformance() {
    console.log('\n🧠 Memory Performance Tests');

    await this.runBenchmark('Large Array Creation (10k elements)', () => {
      const arr = new Array(10000).fill().map((_, i) => ({
        id: i,
        data: `item_${i}`,
        timestamp: Date.now()
      }));
      return arr.length;
    }, 100);

    await this.runBenchmark('Map Operations (1k entries)', () => {
      const map = new Map();
      for (let i = 0; i < 1000; i++) {
        map.set(`key_${i}`, `value_${i}`);
      }
      return map.get('key_500');
    }, 500);

    await this.runBenchmark('Set Operations (1k entries)', () => {
      const set = new Set();
      for (let i = 0; i < 1000; i++) {
        set.add(`item_${i}`);
      }
      return set.has('item_500');
    }, 500);
  }

  // Bundle size simulation
  async testBundleOperations() {
    console.log('\n📦 Bundle/Loading Performance Tests');

    const mockModules = {
      'react': { size: 45000, exports: ['React', 'Component', 'useState'] },
      'three': { size: 580000, exports: ['Scene', 'WebGLRenderer', 'PerspectiveCamera'] },
      'dnd5e': { size: 120000, exports: ['spells', 'monsters', 'classes'] },
      'ui-components': { size: 80000, exports: ['Button', 'Modal', 'Form'] }
    };

    await this.runBenchmark('Module Resolution', () => {
      const modules = Object.keys(mockModules);
      const resolved = modules.map(name => mockModules[name]);
      return resolved.length;
    }, 2000);

    await this.runBenchmark('Tree Shaking Simulation', () => {
      const usedExports = ['React', 'Scene', 'spells', 'Button'];
      const optimized = Object.entries(mockModules).reduce((acc, [name, mod]) => {
        const usedFromMod = mod.exports.filter(exp => usedExports.includes(exp));
        if (usedFromMod.length > 0) {
          acc[name] = { ...mod, exports: usedFromMod };
        }
        return acc;
      }, {});
      return Object.keys(optimized).length;
    }, 1000);
  }

  printResults() {
    console.log('\n📊 Desktop VTT Performance Report');
    console.log('='.repeat(80));
    
    const categories = {
      'WebSocket': this.results.filter(r => r.name.includes('WebSocket') || r.name.includes('Message') || r.name.includes('Token State')),
      'Rendering': this.results.filter(r => r.name.includes('Viewport') || r.name.includes('Distance') || r.name.includes('Matrix')),
      'Database': this.results.filter(r => r.name.includes('Character') || r.name.includes('Spell') || r.name.includes('Equipment')),
      'Memory': this.results.filter(r => r.name.includes('Array') || r.name.includes('Map') || r.name.includes('Set')),
      'Bundle': this.results.filter(r => r.name.includes('Module') || r.name.includes('Tree'))
    };

    Object.entries(categories).forEach(([category, results]) => {
      if (results.length === 0) return;
      
      console.log(`\n${category} Performance:`);
      console.log('-'.repeat(40));
      
      results.forEach(result => {
        const status = result.opsPerSecond > 10000 ? '🟢' : 
                     result.opsPerSecond > 1000 ? '🟡' : '🔴';
        
        console.log(`${status} ${result.name.padEnd(35)} ${result.opsPerSecond.toFixed(0).padStart(8)} ops/sec`);
        
        if (result.memoryDelta.heapUsed > 1024 * 1024) {
          console.log(`   ⚠️  Memory: +${(result.memoryDelta.heapUsed / 1024 / 1024).toFixed(1)}MB heap`);
        }
      });
    });

    console.log('\n🎯 Desktop VTT Performance Summary:');
    
    const critical = this.results.filter(r => r.opsPerSecond < 1000);
    const good = this.results.filter(r => r.opsPerSecond >= 10000);
    
    console.log(`✅ High Performance: ${good.length} tests (>10k ops/sec)`);
    console.log(`⚠️  Needs Attention: ${this.results.length - critical.length - good.length} tests (1k-10k ops/sec)`);
    console.log(`🔴 Critical Issues: ${critical.length} tests (<1k ops/sec)`);
    
    if (critical.length > 0) {
      console.log('\nCritical Performance Issues:');
      critical.forEach(result => {
        console.log(`- ${result.name}: ${result.opsPerSecond.toFixed(0)} ops/sec`);
      });
    }
  }
}

async function runDesktopPerformanceAudit() {
  console.log('🚀 Starting Desktop VTT Performance Audit');
  console.log('Focus: Core D&D session systems on desktop hardware\n');
  
  const benchmark = new DesktopVTTBenchmark();
  
  try {
    await benchmark.testWebSocketMessages();
    await benchmark.testRenderingPerformance();
    await benchmark.testDatabaseOperations();
    await benchmark.testMemoryPerformance();
    await benchmark.testBundleOperations();
    
    benchmark.printResults();
    
  } catch (error) {
    console.error('❌ Performance audit failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  runDesktopPerformanceAudit();
}

module.exports = { DesktopVTTBenchmark };
