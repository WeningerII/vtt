/**
 * VTT Production Load Testing Suite
 * Comprehensive performance validation for concurrent user scenarios
 */

import WebSocket from 'ws';
import fetch from 'node-fetch';
import { performance } from 'perf_hooks';

interface TestConfig {
  baseUrl: string;
  wsUrl: string;
  maxUsers: number;
  rampUpDuration: number; // seconds
  testDuration: number; // seconds
  scenarios: LoadTestScenario[];
}

interface LoadTestScenario {
  name: string;
  weight: number; // percentage of users
  actions: UserAction[];
}

interface UserAction {
  type: 'http' | 'websocket' | 'wait';
  endpoint?: string;
  method?: string;
  data?: any;
  message?: any;
  duration?: number;
  probability?: number;
}

interface TestMetrics {
  scenario: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  throughput: number; // requests per second
  errors: ErrorMetric[];
  websocketConnections: number;
  activeUsers: number;
}

interface ErrorMetric {
  type: string;
  count: number;
  percentage: number;
}

class LoadTestRunner {
  private config: TestConfig;
  private metrics: Map<string, TestMetrics> = new Map();
  private responseTimeDistribution: Map<string, number[]> = new Map();
  private users: VirtualUser[] = [];
  private startTime: number = 0;
  private isRunning: boolean = false;

  constructor(config: TestConfig) {
    this.config = config;
  }

  async run(): Promise<TestMetrics[]> {
    console.log(`🚀 Starting VTT Load Test - ${this.config.maxUsers} concurrent users`);
    console.log(`📊 Test Duration: ${this.config.testDuration}s, Ramp-up: ${this.config.rampUpDuration}s`);
    
    this.startTime = performance.now();
    this.isRunning = true;

    // Initialize metrics for each scenario
    this.config.scenarios.forEach(scenario => {
      this.metrics.set(scenario.name, {
        scenario: scenario.name,
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        throughput: 0,
        errors: [],
        websocketConnections: 0,
        activeUsers: 0,
      });
      this.responseTimeDistribution.set(scenario.name, []);
    });

    // Ramp up users gradually
    await this.rampUpUsers();
    
    // Run test for specified duration
    await new Promise(resolve => setTimeout(resolve, this.config.testDuration * 1000));
    
    // Graceful shutdown
    await this.shutdown();
    
    // Calculate final metrics
    const results = this.calculateFinalMetrics();
    this.printResults(results);
    
    return results;
  }

  private async rampUpUsers(): Promise<void> {
    const rampUpInterval = (this.config.rampUpDuration * 1000) / this.config.maxUsers;
    
    for (let i = 0; i < this.config.maxUsers; i++) {
      const scenario = this.selectScenarioForUser();
      const user = new VirtualUser(i, scenario, this.config, this);
      this.users.push(user);
      
      // Start user asynchronously
      user.start().catch(error => {
        console.error(`User ${i} failed:`, error);
      });
      
      // Wait before spawning next user
      await new Promise(resolve => setTimeout(resolve, rampUpInterval));
    }
    
    console.log(`✅ All ${this.config.maxUsers} users spawned`);
  }

  private selectScenarioForUser(): LoadTestScenario {
    const random = Math.random() * 100;
    let cumulative = 0;
    
    for (const scenario of this.config.scenarios) {
      cumulative += scenario.weight;
      if (random <= cumulative) {
        return scenario;
      }
    }
    
    return this.config.scenarios[0]!; // Fallback
  }

  private async shutdown(): Promise<void> {
    console.log('🛑 Shutting down load test...');
    this.isRunning = false;
    
    // Wait for all users to finish current actions
    await Promise.all(this.users.map(user => user.stop()));
    
    console.log('✅ All users stopped');
  }

  recordMetric(scenario: string, responseTime: number, success: boolean, error?: string): void {
    const metrics = this.metrics.get(scenario);
    if (!metrics) {return;}

    metrics.totalRequests++;
    
    if (success) {
      metrics.successfulRequests++;
    } else {
      metrics.failedRequests++;
      
      if (error) {
        const existingError = metrics.errors.find(e => e.type === error);
        if (existingError) {
          existingError.count++;
        } else {
          metrics.errors.push({ type: error, count: 1, percentage: 0 });
        }
      }
    }
    
    const responseTimes = this.responseTimeDistribution.get(scenario) || [];
    responseTimes.push(responseTime);
    this.responseTimeDistribution.set(scenario, responseTimes);
  }

  updateWebSocketConnections(scenario: string, delta: number): void {
    const metrics = this.metrics.get(scenario);
    if (metrics) {
      metrics.websocketConnections += delta;
    }
  }

  updateActiveUsers(scenario: string, delta: number): void {
    const metrics = this.metrics.get(scenario);
    if (metrics) {
      metrics.activeUsers += delta;
    }
  }

  isTestRunning(): boolean {
    return this.isRunning;
  }

  private calculateFinalMetrics(): TestMetrics[] {
    const testDurationMs = performance.now() - this.startTime;
    const results: TestMetrics[] = [];

    for (const [scenario, metrics] of this.metrics.entries()) {
      const responseTimes = this.responseTimeDistribution.get(scenario) || [];
      responseTimes.sort((a, b) => a - b);
      
      // Calculate percentiles
      const p95Index = Math.floor(responseTimes.length * 0.95);
      const p99Index = Math.floor(responseTimes.length * 0.99);
      
      const finalMetrics: TestMetrics = {
        ...metrics,
        averageResponseTime: responseTimes.length > 0 
          ? responseTimes.reduce((sum, rt) => sum + rt, 0) / responseTimes.length 
          : 0,
        p95ResponseTime: responseTimes[p95Index] || 0,
        p99ResponseTime: responseTimes[p99Index] || 0,
        throughput: metrics.totalRequests / (testDurationMs / 1000),
        errors: metrics.errors.map(error => ({
          ...error,
          percentage: (error.count / metrics.totalRequests) * 100,
        })),
      };
      
      results.push(finalMetrics);
    }
    
    return results;
  }

  private printResults(results: TestMetrics[]): void {
    console.log('\n🔍 LOAD TEST RESULTS');
    console.log('=====================\n');
    
    for (const result of results) {
      console.log(`📈 Scenario: ${result.scenario}`);
      console.log(`   Total Requests: ${result.totalRequests}`);
      console.log(`   Success Rate: ${((result.successfulRequests / result.totalRequests) * 100).toFixed(2)}%`);
      console.log(`   Average Response Time: ${result.averageResponseTime.toFixed(2)}ms`);
      console.log(`   P95 Response Time: ${result.p95ResponseTime.toFixed(2)}ms`);
      console.log(`   P99 Response Time: ${result.p99ResponseTime.toFixed(2)}ms`);
      console.log(`   Throughput: ${result.throughput.toFixed(2)} req/s`);
      console.log(`   Peak WebSocket Connections: ${result.websocketConnections}`);
      
      if (result.errors.length > 0) {
        console.log('   Errors:');
        result.errors.forEach(error => {
          console.log(`     - ${error.type}: ${error.count} (${error.percentage.toFixed(2)}%)`);
        });
      }
      
      console.log('');
    }
  }
}

class VirtualUser {
  private id: number;
  private scenario: LoadTestScenario;
  private config: TestConfig;
  private runner: LoadTestRunner;
  private ws: WebSocket | null = null;
  private isActive: boolean = false;

  constructor(id: number, scenario: LoadTestScenario, config: TestConfig, runner: LoadTestRunner) {
    this.id = id;
    this.scenario = scenario;
    this.config = config;
    this.runner = runner;
  }

  async start(): Promise<void> {
    this.isActive = true;
    this.runner.updateActiveUsers(this.scenario.name, 1);
    
    try {
      while (this.runner.isTestRunning() && this.isActive) {
        await this.executeActions();
        
        // Random pause between action cycles
        await this.wait(1000 + Math.random() * 2000);
      }
    } catch (error) {
      console.error(`User ${this.id} error:`, error);
    } finally {
      await this.cleanup();
    }
  }

  async stop(): Promise<void> {
    this.isActive = false;
    await this.cleanup();
  }

  private async executeActions(): Promise<void> {
    for (const action of this.scenario.actions) {
      if (!this.isActive || !this.runner.isTestRunning()) {break;}
      
      // Skip action based on probability
      if (action.probability && Math.random() > action.probability) {
        continue;
      }
      
      const startTime = performance.now();
      let success = false;
      let error: string | undefined;
      
      try {
        switch (action.type) {
          case 'http':
            await this.executeHttpAction(action);
            success = true;
            break;
            
          case 'websocket':
            await this.executeWebSocketAction(action);
            success = true;
            break;
            
          case 'wait':
            await this.wait(action.duration || 1000);
            success = true;
            break;
        }
      } catch (err: any) {
        error = err.message || 'Unknown error';
      }
      
      const responseTime = performance.now() - startTime;
      this.runner.recordMetric(this.scenario.name, responseTime, success, error);
    }
  }

  private async executeHttpAction(action: UserAction): Promise<void> {
    const url = `${this.config.baseUrl}${action.endpoint}`;
    
    const response = await fetch(url, {
      method: action.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token', // Use actual auth token generation
      },
      body: action.data ? JSON.stringify(action.data) : undefined,
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    await response.json(); // Consume response body
  }

  private async executeWebSocketAction(action: UserAction): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      await this.connectWebSocket();
    }
    
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket not connected'));
        return;
      }
      
      const timeout = setTimeout(() => {
        reject(new Error('WebSocket message timeout'));
      }, 5000);
      
      const onMessage = () => {
        clearTimeout(timeout);
        this.ws!.off('message', onMessage);
        resolve();
      };
      
      this.ws.on('message', onMessage);
      this.ws.send(JSON.stringify(action.message));
    });
  }

  private async connectWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.config.wsUrl);
        
        this.ws.on('open', () => {
          this.runner.updateWebSocketConnections(this.scenario.name, 1);
          resolve();
        });
        
        this.ws.on('error', (error) => {
          reject(error);
        });
        
        this.ws.on('close', () => {
          this.runner.updateWebSocketConnections(this.scenario.name, -1);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  private async wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async cleanup(): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.close();
    }
    this.runner.updateActiveUsers(this.scenario.name, -1);
  }
}

// Predefined test scenarios for VTT
export const VTT_TEST_SCENARIOS: LoadTestScenario[] = [
  {
    name: 'GameMaster',
    weight: 20, // 20% of users are GMs
    actions: [
      { type: 'http', endpoint: '/api/campaigns', method: 'GET' },
      { type: 'http', endpoint: '/api/maps', method: 'GET' },
      { type: 'websocket', message: { type: 'JOIN_GAME', gameId: 'test-game' } },
      { type: 'websocket', message: { type: 'MOVE_TOKEN', entityId: 1, x: 10, y: 10 } },
      { type: 'wait', duration: 2000 },
      { type: 'websocket', message: { type: 'UPDATE_INITIATIVE', entities: [{ id: 1, initiative: 15 }] } },
      { type: 'wait', duration: 3000 },
    ],
  },
  {
    name: 'Player',
    weight: 60, // 60% of users are players
    actions: [
      { type: 'http', endpoint: '/api/characters', method: 'GET' },
      { type: 'websocket', message: { type: 'JOIN_GAME', gameId: 'test-game' } },
      { type: 'wait', duration: 1000 },
      { type: 'websocket', message: { type: 'MOVE_TOKEN', entityId: 2, x: 5, y: 5 } },
      { type: 'wait', duration: 5000 },
      { type: 'websocket', message: { type: 'ROLL_DICE', formula: '1d20+5' }, probability: 0.3 },
    ],
  },
  {
    name: 'Observer',
    weight: 20, // 20% of users are observers
    actions: [
      { type: 'websocket', message: { type: 'JOIN_GAME', gameId: 'test-game' } },
      { type: 'wait', duration: 10000 },
    ],
  },
];

export const DEFAULT_LOAD_TEST_CONFIG: TestConfig = {
  baseUrl: 'http://localhost:3000',
  wsUrl: 'ws://localhost:3001',
  maxUsers: 100,
  rampUpDuration: 60, // 1 minute ramp-up
  testDuration: 300, // 5 minute test
  scenarios: VTT_TEST_SCENARIOS,
};

// CLI runner
if (require.main === module) {
  const config = { ...DEFAULT_LOAD_TEST_CONFIG };
  
  // Override config from environment variables
  config.maxUsers = parseInt(process.env.LOAD_TEST_USERS || '100');
  config.testDuration = parseInt(process.env.LOAD_TEST_DURATION || '300');
  config.baseUrl = process.env.LOAD_TEST_BASE_URL || config.baseUrl;
  config.wsUrl = process.env.LOAD_TEST_WS_URL || config.wsUrl;
  
  const runner = new LoadTestRunner(config);
  runner.run()
    .then((results) => {
      const overallSuccessRate = results.reduce((sum, r) => sum + r.successfulRequests, 0) / 
                                 results.reduce((sum, r) => sum + r.totalRequests, 0);
      
      console.log(`🎯 Overall Success Rate: ${(overallSuccessRate * 100).toFixed(2)}%`);
      
      if (overallSuccessRate < 0.95) {
        console.log('❌ Load test failed - success rate below 95%');
        process.exit(1);
      } else {
        console.log('✅ Load test passed - system meets performance requirements');
        process.exit(0);
      }
    })
    .catch((error) => {
      console.error('❌ Load test failed:', error);
      process.exit(1);
    });
}
