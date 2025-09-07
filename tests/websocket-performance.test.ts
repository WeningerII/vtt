import WebSocket from 'ws';
import { performance } from 'perf_hooks';

interface TestConfig {
  serverUrl: string;
  numClients: number;
  testDuration: number; // in seconds
  messagesPerSecond: number;
}

interface TestResults {
  totalConnections: number;
  successfulConnections: number;
  failedConnections: number;
  totalMessages: number;
  messagesReceived: number;
  averageLatency: number;
  maxLatency: number;
  minLatency: number;
  connectionTime: number;
  errors: string[];
}

class WebSocketClient {
  private ws: WebSocket | null = null;
  private clientId: string;
  private messagesReceived = 0;
  private latencies: number[] = [];
  private connected = false;

  constructor(private url: string, private id: number) {
    this.clientId = `client-${id}`;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url);
      
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, 10000);

      this.ws.on('open', () => {
        clearTimeout(timeout);
        this.connected = true;
        
        // Send initial join message
        this.ws!.send(JSON.stringify({
          type: 'JOIN_GAME',
          gameId: 'perf-test-game',
          userId: this.clientId,
          displayName: `Player ${this.id}`
        }));
        
        resolve();
      });

      this.ws.on('message', (data) => {
        this.messagesReceived++;
        const message = JSON.parse(data.toString());
        
        // Track latency for ping-pong messages
        if (message.type === 'PONG' && message.timestamp) {
          const latency = Date.now() - message.timestamp;
          this.latencies.push(latency);
        }
      });

      this.ws.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });

      this.ws.on('close', () => {
        this.connected = false;
      });
    });
  }

  sendMessage(message: any): void {
    if (this.connected && this.ws) {
      this.ws.send(JSON.stringify(message));
    }
  }

  sendPing(): void {
    this.sendMessage({
      type: 'PING',
      timestamp: Date.now()
    });
  }

  moveToken(x: number, y: number): void {
    this.sendMessage({
      type: 'MOVE_TOKEN',
      tokenId: `token-${this.clientId}`,
      x,
      y
    });
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  getStats() {
    return {
      messagesReceived: this.messagesReceived,
      averageLatency: this.latencies.length > 0 
        ? this.latencies.reduce((a, b) => a + b, 0) / this.latencies.length 
        : 0,
      maxLatency: this.latencies.length > 0 ? Math.max(...this.latencies) : 0,
      minLatency: this.latencies.length > 0 ? Math.min(...this.latencies) : 0
    };
  }
}

class WebSocketPerformanceTest {
  private clients: WebSocketClient[] = [];
  private results: TestResults = {
    totalConnections: 0,
    successfulConnections: 0,
    failedConnections: 0,
    totalMessages: 0,
    messagesReceived: 0,
    averageLatency: 0,
    maxLatency: 0,
    minLatency: Number.MAX_VALUE,
    connectionTime: 0,
    errors: []
  };

  constructor(private config: TestConfig) {}

  async run(): Promise<TestResults> {
    console.log(`Starting WebSocket performance test with ${this.config.numClients} clients...`);
    
    // Phase 1: Connect all clients
    const connectionStart = performance.now();
    await this.connectClients();
    this.results.connectionTime = performance.now() - connectionStart;
    
    console.log(`Connected ${this.results.successfulConnections}/${this.config.numClients} clients in ${this.results.connectionTime.toFixed(2)}ms`);
    
    // Phase 2: Send messages for test duration
    await this.runMessageTest();
    
    // Phase 3: Collect results
    this.collectResults();
    
    // Phase 4: Disconnect all clients
    await this.disconnectClients();
    
    return this.results;
  }

  private async connectClients(): Promise<void> {
    const connectionPromises: Promise<void>[] = [];
    
    for (let i = 0; i < this.config.numClients; i++) {
      const client = new WebSocketClient(this.config.serverUrl, i);
      this.clients.push(client);
      
      connectionPromises.push(
        client.connect()
          .then(() => {
            this.results.successfulConnections++;
          })
          .catch((error) => {
            this.results.failedConnections++;
            this.results.errors.push(`Client ${i}: ${error.message}`);
          })
      );
      
      // Stagger connections slightly to avoid overwhelming the server
      if (i % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }
    
    this.results.totalConnections = this.config.numClients;
    await Promise.allSettled(connectionPromises);
  }

  private async runMessageTest(): Promise<void> {
    console.log(`Running message test for ${this.config.testDuration} seconds...`);
    
    const messageInterval = 1000 / this.config.messagesPerSecond;
    const testEndTime = Date.now() + (this.config.testDuration * 1000);
    
    const sendMessages = async () => {
      while (Date.now() < testEndTime) {
        const messagePromises: Promise<void>[] = [];
        
        for (const client of this.clients) {
          // Send different types of messages
          const messageType = Math.random();
          
          if (messageType < 0.3) {
            // 30% ping messages for latency measurement
            client.sendPing();
          } else if (messageType < 0.8) {
            // 50% movement messages (most common in game)
            const x = Math.random() * 1000;
            const y = Math.random() * 1000;
            client.moveToken(x, y);
          } else {
            // 20% other game messages
            client.sendMessage({
              type: 'CHAT',
              message: `Test message from ${Date.now()}`
            });
          }
          
          this.results.totalMessages++;
        }
        
        await new Promise(resolve => setTimeout(resolve, messageInterval));
      }
    };
    
    await sendMessages();
  }

  private collectResults(): void {
    let totalLatency = 0;
    let latencyCount = 0;
    
    for (const client of this.clients) {
      const stats = client.getStats();
      this.results.messagesReceived += stats.messagesReceived;
      
      if (stats.averageLatency > 0) {
        totalLatency += stats.averageLatency;
        latencyCount++;
        
        if (stats.maxLatency > this.results.maxLatency) {
          this.results.maxLatency = stats.maxLatency;
        }
        
        if (stats.minLatency < this.results.minLatency) {
          this.results.minLatency = stats.minLatency;
        }
      }
    }
    
    if (latencyCount > 0) {
      this.results.averageLatency = totalLatency / latencyCount;
    }
    
    if (this.results.minLatency === Number.MAX_VALUE) {
      this.results.minLatency = 0;
    }
  }

  private async disconnectClients(): Promise<void> {
    console.log('Disconnecting all clients...');
    
    for (const client of this.clients) {
      client.disconnect();
    }
    
    // Give some time for graceful disconnection
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

// Main test runner
async function runPerformanceTest() {
  const configs: TestConfig[] = [
    {
      serverUrl: 'ws://localhost:3000',
      numClients: 10,
      testDuration: 10,
      messagesPerSecond: 5
    },
    {
      serverUrl: 'ws://localhost:3000',
      numClients: 50,
      testDuration: 10,
      messagesPerSecond: 10
    },
    {
      serverUrl: 'ws://localhost:3000',
      numClients: 100,
      testDuration: 10,
      messagesPerSecond: 20
    },
    {
      serverUrl: 'ws://localhost:3000',
      numClients: 500,
      testDuration: 10,
      messagesPerSecond: 20
    }
  ];

  console.log('='.repeat(80));
  console.log('WebSocket Performance Test Suite');
  console.log('='.repeat(80));

  for (const config of configs) {
    console.log(`\n${  '-'.repeat(80)}`);
    console.log(`Test Configuration:`);
    console.log(`  Clients: ${config.numClients}`);
    console.log(`  Duration: ${config.testDuration}s`);
    console.log(`  Messages/sec: ${config.messagesPerSecond}`);
    console.log('-'.repeat(80));

    const test = new WebSocketPerformanceTest(config);
    
    try {
      const results = await test.run();
      
      console.log('\nTest Results:');
      console.log(`  Successful Connections: ${results.successfulConnections}/${results.totalConnections}`);
      console.log(`  Failed Connections: ${results.failedConnections}`);
      console.log(`  Connection Time: ${results.connectionTime.toFixed(2)}ms`);
      console.log(`  Total Messages Sent: ${results.totalMessages}`);
      console.log(`  Messages Received: ${results.messagesReceived}`);
      console.log(`  Average Latency: ${results.averageLatency.toFixed(2)}ms`);
      console.log(`  Min Latency: ${results.minLatency.toFixed(2)}ms`);
      console.log(`  Max Latency: ${results.maxLatency.toFixed(2)}ms`);
      
      if (results.errors.length > 0) {
        console.log(`  Errors: ${results.errors.length}`);
        results.errors.slice(0, 5).forEach(error => {
          console.log(`    - ${error}`);
        });
      }
      
      // Performance analysis
      const messageDeliveryRate = (results.messagesReceived / results.totalMessages) * 100;
      const connectionSuccessRate = (results.successfulConnections / results.totalConnections) * 100;
      
      console.log('\nPerformance Analysis:');
      console.log(`  Connection Success Rate: ${connectionSuccessRate.toFixed(2)}%`);
      console.log(`  Message Delivery Rate: ${messageDeliveryRate.toFixed(2)}%`);
      console.log(`  Avg Connection Time: ${(results.connectionTime / results.totalConnections).toFixed(2)}ms per client`);
      
      // Performance thresholds
      const passed = connectionSuccessRate >= 95 && 
                    messageDeliveryRate >= 95 && 
                    results.averageLatency < 100;
      
      console.log(`  Test Status: ${passed ? '✅ PASSED' : '❌ FAILED'}`);
      
    } catch (error) {
      console.error('Test failed:', error);
    }
    
    // Wait between tests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log(`\n${  '='.repeat(80)}`);
  console.log('Performance Test Suite Complete');
  console.log('='.repeat(80));
}

// Run if executed directly
if (require.main === module) {
  runPerformanceTest()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

export { WebSocketPerformanceTest };
export type { TestConfig, TestResults };
