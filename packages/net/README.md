# @vtt/net

Real-time networking and multiplayer functionality for VTT applications.

## Installation

```bash
pnpm add @vtt/net
```

## Features

- **WebSocket Communication**: Real-time bidirectional communication
- **Game Sessions**: Multiplayer game session management
- **State Synchronization**: Automatic state sync between clients
- **Client Prediction**: Lag compensation and client-side prediction
- **Connection Management**: Automatic reconnection and error handling

## Usage

### Game Client

```typescript
import { GameClient } from '@vtt/net';

const client = new GameClient({
  serverUrl: 'ws://localhost:8080',
  playerId: 'player-123',
  playerName: 'John Doe',
  reconnectAttempts: 5,
  reconnectDelay: 1000,
});

// Connect to server
await client.connect();

// Listen for events
client.on('stateUpdated', (state) => {
  console.log('Game state updated:', state);
});

client.on('playerJoined', (player) => {
  console.log('Player joined:', player);
});

// Send actions
client.sendAction('move', { x: 10, y: 20 });
client.sendChatMessage('Hello world!');

// Disconnect
client.disconnect();
```

### Game Session (Server)

```typescript
import { GameSession } from '@vtt/net';

const session = new GameSession('session-123', {
  maxPlayers: 6,
  syncInterval: 50, // 20 FPS
  enableAI: true,
});

// Add player
session.addPlayer({
  id: 'player-123',
  name: 'John Doe',
  role: 'player',
});

// Handle player actions
session.handlePlayerAction('player-123', {
  type: 'move',
  data: { x: 10, y: 20 },
});

// Start session
session.start();

// Stop session
session.stop();
```

### Client Prediction

```typescript
import { ClientPrediction } from '@vtt/net/prediction';

const prediction = new ClientPrediction({
  serverUpdateRate: 20,
  inputBufferSize: 120,
  reconciliationWindow: 1000,
});

// Apply input prediction
prediction.applyInput({
  sequenceId: 1,
  timestamp: Date.now(),
  input: { move: { x: 1, y: 0 } },
});

// Reconcile with server state
prediction.reconcile(serverState);

// Get predicted state
const predictedState = prediction.getPredictedState();
```

### Lag Compensation

```typescript
import { LagCompensation } from '@vtt/net/prediction';

const lagComp = new LagCompensation({
  maxRewindTime: 1000,
  interpolationDelay: 100,
});

// Rewind to past state
const pastState = lagComp.rewindToTimestamp(timestamp);

// Validate action at past time
const isValid = lagComp.validateAction(action, timestamp);

// Get interpolated state
const interpolated = lagComp.getInterpolatedState(timestamp);
```

## API Reference

### GameClient

- `connect()`: Connect to game server
- `disconnect()`: Disconnect from server
- `sendAction(type, data)`: Send game action
- `sendChatMessage(message)`: Send chat message
- `updatePlayerState(state)`: Update local player state
- `on(event, handler)`: Listen for events
- `getState()`: Get current game state
- `getLatency()`: Get current latency

### GameSession

- `addPlayer(player)`: Add player to session
- `removePlayer(playerId)`: Remove player from session
- `handlePlayerAction(playerId, action)`: Process player action
- `broadcastUpdate(update)`: Broadcast update to all players
- `start()`: Start game session
- `stop()`: Stop game session
- `getState()`: Get session state

### ClientPrediction

- `applyInput(input)`: Apply client input
- `reconcile(serverState)`: Reconcile with server
- `getPredictedState()`: Get predicted state
- `clearHistory()`: Clear prediction history
- `setServerUpdateRate(rate)`: Update server tick rate

### LagCompensation

- `rewindToTimestamp(timestamp)`: Rewind to past state
- `validateAction(action, timestamp)`: Validate past action
- `getInterpolatedState(timestamp)`: Get interpolated state
- `addSnapshot(snapshot)`: Add state snapshot
- `detectSuspiciousActivity(playerId)`: Check for cheating

## Events

### GameClient Events

- `connected`: Connected to server
- `disconnected`: Disconnected from server
- `reconnecting`: Attempting to reconnect
- `stateUpdated`: Game state updated
- `playerJoined`: Player joined session
- `playerLeft`: Player left session
- `chatMessage`: Chat message received
- `error`: Error occurred
- `latencyUpdate`: Latency measurement updated

### GameSession Events

- `playerAdded`: Player added to session
- `playerRemoved`: Player removed from session
- `sessionStarted`: Session started
- `sessionEnded`: Session ended
- `stateChanged`: Session state changed

## Configuration

```typescript
interface NetworkConfig {
  // Connection
  serverUrl: string;
  reconnectAttempts: number;
  reconnectDelay: number;
  connectionTimeout: number;
  
  // Synchronization
  syncInterval: number;
  stateBufferSize: number;
  interpolationDelay: number;
  
  // Prediction
  enablePrediction: boolean;
  predictionWindow: number;
  reconciliationRate: number;
  
  // Security
  validateInputs: boolean;
  maxInputRate: number;
  antiCheatEnabled: boolean;
}
```

## Best Practices

1. **Use Client Prediction**: Improve responsiveness with client-side prediction
2. **Implement Lag Compensation**: Handle network latency gracefully
3. **Validate Inputs**: Always validate inputs on the server
4. **Optimize State Sync**: Only sync changed state properties
5. **Handle Disconnections**: Implement proper reconnection logic
6. **Monitor Latency**: Track and display connection quality
7. **Rate Limit**: Prevent spam and abuse with rate limiting

## License

MIT
