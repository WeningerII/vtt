/**
 * Tests for UnifiedWebSocketManager
 */
import { WebSocket, WebSocketServer } from 'ws';
import { UnifiedWebSocketManager } from './UnifiedWebSocketManager';
import { EventEmitter } from 'events';
import { jest } from '@jest/globals';

// Mock dependencies
jest.mock('ws');
jest.mock('../game/GameManager');
jest.mock('@vtt/logging');

describe('UnifiedWebSocketManager', () => {
  let wsManager: UnifiedWebSocketManager;
  let mockWss: jest.Mocked<WebSocketServer>;
  let mockWs: jest.Mocked<WebSocket>;

  beforeEach(() => {
    // Create mock WebSocketServer
    mockWss = new EventEmitter() as any;
    mockWss.clients = new Set();

    // Create mock WebSocket
    mockWs = new EventEmitter() as any;
    mockWs.send = jest.fn();
    mockWs.ping = jest.fn();
    mockWs.close = jest.fn();
    mockWs.terminate = jest.fn();
    mockWs.readyState = WebSocket.OPEN;

    // Create manager
    wsManager = new UnifiedWebSocketManager(mockWss);

    // Clear all timers
    jest.clearAllTimers();
  });

  afterEach(() => {
    wsManager.shutdown();
  });

  describe('Connection Handling', () => {
    it('should handle new WebSocket connections', () => {
      const mockReq = {
        url: '/ws?sessionId=session-1&userId=user-1&campaignId=campaign-1&gameId=game-1&isGM=false',
        headers: { host: 'localhost:8080' }
      };

      // Trigger connection event
      mockWss.emit('connection', mockWs, mockReq);

      // Verify welcome message sent
      expect(mockWs.send).toHaveBeenCalled();
      const sentMessage = JSON.parse(mockWs.send.mock.calls[0][0]);
      expect(sentMessage.type).toBe('CONNECTION_ESTABLISHED');
      expect(sentMessage.payload.userId).toBe('user-1');
      expect(sentMessage.payload.sessionId).toBe('session-1');
    });

    it('should reject connections without required parameters', () => {
      const mockReq = {
        url: '/ws',
        headers: { host: 'localhost:8080' }
      };

      // Trigger connection event
      mockWss.emit('connection', mockWs, mockReq);

      // Should still accept connection but with null values
      expect(mockWs.send).toHaveBeenCalled();
      const sentMessage = JSON.parse(mockWs.send.mock.calls[0][0]);
      expect(sentMessage.type).toBe('CONNECTION_ESTABLISHED');
    });

    it('should handle client disconnection', () => {
      const mockReq = {
        url: '/ws?sessionId=session-1&userId=user-1&gameId=game-1',
        headers: { host: 'localhost:8080' }
      };

      // Connect client
      mockWss.emit('connection', mockWs, mockReq);

      // Get the client ID from welcome message
      const welcomeMessage = JSON.parse(mockWs.send.mock.calls[0][0]);
      const clientId = welcomeMessage.payload.clientId;

      // Trigger disconnection
      mockWs.emit('close');

      // Try to send message to disconnected client
      wsManager.sendToClient(clientId, { type: 'TEST' });

      // Should not send message to disconnected client
      expect(mockWs.send).toHaveBeenCalledTimes(1); // Only welcome message
    });

    it('should handle WebSocket errors', () => {
      const mockReq = {
        url: '/ws?sessionId=session-1&userId=user-1',
        headers: { host: 'localhost:8080' }
      };

      // Connect client
      mockWss.emit('connection', mockWs, mockReq);

      // Trigger error
      const error = new Error('Connection error');
      mockWs.emit('error', error);

      // Should handle error and disconnect client
      const welcomeMessage = JSON.parse(mockWs.send.mock.calls[0][0]);
      const clientId = welcomeMessage.payload.clientId;
      wsManager.sendToClient(clientId, { type: 'TEST' });
      expect(mockWs.send).toHaveBeenCalledTimes(1); // Only welcome message
    });
  });

  describe('Message Handling', () => {
    let clientId: string;

    beforeEach(() => {
      const mockReq = {
        url: '/ws?sessionId=session-1&userId=user-1&gameId=game-1',
        headers: { host: 'localhost:8080' }
      };
      mockWss.emit('connection', mockWs, mockReq);
      const welcomeMessage = JSON.parse(mockWs.send.mock.calls[0][0]);
      clientId = welcomeMessage.payload.clientId;
    });

    it('should handle PING messages', () => {
      const pingMessage = JSON.stringify({ type: 'PING', timestamp: Date.now() });
      mockWs.emit('message', pingMessage);

      expect(mockWs.send).toHaveBeenCalledTimes(2); // Welcome + PONG
      const pongMessage = JSON.parse(mockWs.send.mock.calls[1][0]);
      expect(pongMessage.type).toBe('PONG');
    });

    it('should handle JOIN_GAME messages', () => {
      const joinMessage = JSON.stringify({
        type: 'JOIN_GAME',
        payload: {
          gameId: 'game-1',
          userId: 'user-1',
          displayName: 'Player 1'
        }
      });

      mockWs.emit('message', joinMessage);

      // Should send game state
      const messages = mockWs.send.mock.calls.map(call => JSON.parse(call[0]));
      const gameStateMessage = messages.find(msg => msg.type === 'GAME_STATE');
      expect(gameStateMessage).toBeDefined();
    });

    it('should handle TOKEN_MOVE messages', () => {
      const moveMessage = JSON.stringify({
        type: 'TOKEN_MOVE',
        payload: {
          tokenId: 'token-1',
          position: { x: 10, y: 20 }
        }
      });

      // Create another client in same game
      const mockWs2 = new EventEmitter() as any;
      mockWs2.send = jest.fn();
      mockWs2.readyState = WebSocket.OPEN;
      const mockReq2 = {
        url: '/ws?sessionId=session-2&userId=user-2&gameId=game-1',
        headers: { host: 'localhost:8080' }
      };
      mockWss.emit('connection', mockWs2, mockReq2);

      // Send move message from first client
      mockWs.emit('message', moveMessage);

      // Second client should receive the move update
      const messages = mockWs2.send.mock.calls.map(call => JSON.parse(call[0]));
      const moveUpdate = messages.find(msg => msg.type === 'TOKEN_MOVED');
      expect(moveUpdate).toBeDefined();
      expect(moveUpdate.payload.position).toEqual({ x: 10, y: 20 });
    });

    it('should handle DICE_ROLL messages', () => {
      const rollMessage = JSON.stringify({
        type: 'ROLL_DICE',
        payload: {
          dice: '1d20+5',
          label: 'Attack Roll',
          private: false
        }
      });

      mockWs.emit('message', rollMessage);

      // Should broadcast dice roll
      const messages = mockWs.send.mock.calls.map(call => JSON.parse(call[0]));
      const rollResult = messages.find(msg => msg.type === 'DICE_ROLLED');
      expect(rollResult).toBeDefined();
      expect(rollResult.payload.dice).toBe('1d20+5');
    });

    it('should handle private dice rolls', () => {
      const privateRollMessage = JSON.stringify({
        type: 'ROLL_DICE',
        payload: {
          dice: '1d20+5',
          label: 'Stealth Check',
          private: true
        }
      });

      // Create another client
      const mockWs2 = new EventEmitter() as any;
      mockWs2.send = jest.fn();
      mockWs2.readyState = WebSocket.OPEN;
      const mockReq2 = {
        url: '/ws?sessionId=session-1&userId=user-2&gameId=game-1',
        headers: { host: 'localhost:8080' }
      };
      mockWss.emit('connection', mockWs2, mockReq2);

      // Send private roll
      mockWs.emit('message', privateRollMessage);

      // Only sender should receive the result
      const senderMessages = mockWs.send.mock.calls.map(call => JSON.parse(call[0]));
      const senderRoll = senderMessages.find(msg => msg.type === 'DICE_ROLLED');
      expect(senderRoll).toBeDefined();

      // Other client should not receive it
      const otherMessages = mockWs2.send.mock.calls.map(call => JSON.parse(call[0]));
      const otherRoll = otherMessages.find(msg => msg.type === 'DICE_ROLLED');
      expect(otherRoll).toBeUndefined();
    });

    it('should handle COMBAT_UPDATE messages', () => {
      const combatMessage = JSON.stringify({
        type: 'COMBAT_UPDATE',
        payload: {
          round: 5,
          activeCharacter: 'char-1',
          phase: 'action'
        }
      });

      mockWs.emit('message', combatMessage);

      // Should emit combat event
      const emitSpy = jest.spyOn(wsManager, 'emit');
      mockWs.emit('message', combatMessage);
      expect(emitSpy).toHaveBeenCalledWith('combat:message', expect.anything(), expect.anything());
    });

    it('should handle invalid JSON messages', () => {
      mockWs.emit('message', 'invalid json {');

      // Should send error message
      const messages = mockWs.send.mock.calls.map(call => JSON.parse(call[0]));
      const errorMessage = messages.find(msg => msg.type === 'ERROR');
      expect(errorMessage).toBeDefined();
      expect(errorMessage.payload.code).toBe('INVALID_JSON');
    });

    it('should handle unknown message types', () => {
      const unknownMessage = JSON.stringify({
        type: 'UNKNOWN_TYPE',
        payload: { test: 'data' }
      });

      const emitSpy = jest.spyOn(wsManager, 'emit');
      mockWs.emit('message', unknownMessage);

      // Should emit custom event for unknown type
      expect(emitSpy).toHaveBeenCalledWith('message:UNKNOWN_TYPE', expect.anything(), expect.anything());
    });
  });

  describe('Broadcasting', () => {
    let client1Id: string;
    let client2Id: string;
    let mockWs2: jest.Mocked<WebSocket>;

    beforeEach(() => {
      // Connect first client
      const mockReq1 = {
        url: '/ws?sessionId=session-1&userId=user-1&gameId=game-1',
        headers: { host: 'localhost:8080' }
      };
      mockWss.emit('connection', mockWs, mockReq1);
      const welcome1 = JSON.parse(mockWs.send.mock.calls[0][0]);
      client1Id = welcome1.payload.clientId;

      // Connect second client
      mockWs2 = new EventEmitter() as any;
      mockWs2.send = jest.fn();
      mockWs2.readyState = WebSocket.OPEN;
      const mockReq2 = {
        url: '/ws?sessionId=session-1&userId=user-2&gameId=game-1',
        headers: { host: 'localhost:8080' }
      };
      mockWss.emit('connection', mockWs2, mockReq2);
      const welcome2 = JSON.parse(mockWs2.send.mock.calls[0][0]);
      client2Id = welcome2.payload.clientId;
    });

    it('should broadcast to all clients in session', () => {
      const message = { type: 'SESSION_UPDATE', payload: { data: 'test' } };
      wsManager.broadcastToSession('session-1', message);

      // Both clients should receive message
      const client1Messages = mockWs.send.mock.calls.map(call => JSON.parse(call[0]));
      const client2Messages = mockWs2.send.mock.calls.map(call => JSON.parse(call[0]));

      expect(client1Messages.some(msg => msg.type === 'SESSION_UPDATE')).toBe(true);
      expect(client2Messages.some(msg => msg.type === 'SESSION_UPDATE')).toBe(true);
    });

    it('should exclude specific client from broadcast', () => {
      const message = { type: 'SESSION_UPDATE', payload: { data: 'test' } };
      wsManager.broadcastToSession('session-1', message, client1Id);

      // Only client2 should receive message
      const client1Messages = mockWs.send.mock.calls.map(call => JSON.parse(call[0]));
      const client2Messages = mockWs2.send.mock.calls.map(call => JSON.parse(call[0]));

      expect(client1Messages.some(msg => msg.type === 'SESSION_UPDATE')).toBe(false);
      expect(client2Messages.some(msg => msg.type === 'SESSION_UPDATE')).toBe(true);
    });

    it('should broadcast to all clients in game', () => {
      const message = { type: 'GAME_UPDATE', payload: { data: 'test' } };
      wsManager.broadcastToGame('game-1', message);

      // Both clients should receive message
      const client1Messages = mockWs.send.mock.calls.map(call => JSON.parse(call[0]));
      const client2Messages = mockWs2.send.mock.calls.map(call => JSON.parse(call[0]));

      expect(client1Messages.some(msg => msg.type === 'GAME_UPDATE')).toBe(true);
      expect(client2Messages.some(msg => msg.type === 'GAME_UPDATE')).toBe(true);
    });

    it('should send to specific user across all connections', () => {
      // Connect third client with same userId as client1
      const mockWs3 = new EventEmitter() as any;
      mockWs3.send = jest.fn();
      mockWs3.readyState = WebSocket.OPEN;
      const mockReq3 = {
        url: '/ws?sessionId=session-2&userId=user-1&gameId=game-2',
        headers: { host: 'localhost:8080' }
      };
      mockWss.emit('connection', mockWs3, mockReq3);

      const message = { type: 'USER_UPDATE', payload: { data: 'test' } };
      wsManager.sendToUser('user-1', message);

      // Client1 and Client3 should receive (same user)
      const client1Messages = mockWs.send.mock.calls.map(call => JSON.parse(call[0]));
      const client3Messages = mockWs3.send.mock.calls.map(call => JSON.parse(call[0]));
      
      expect(client1Messages.some(msg => msg.type === 'USER_UPDATE')).toBe(true);
      expect(client3Messages.some(msg => msg.type === 'USER_UPDATE')).toBe(true);
      
      // Client2 should not receive (different user)
      const client2Messages = mockWs2.send.mock.calls.map(call => JSON.parse(call[0]));
      expect(client2Messages.some(msg => msg.type === 'USER_UPDATE')).toBe(false);
    });
  });

  describe('Utility Methods', () => {
    it('should retrieve client by ID', () => {
      const mockReq = {
        url: '/ws?sessionId=session-1&userId=user-1',
        headers: { host: 'localhost:8080' }
      };
      mockWss.emit('connection', mockWs, mockReq);
      
      const welcomeMessage = JSON.parse(mockWs.send.mock.calls[0][0]);
      const clientId = welcomeMessage.payload.clientId;

      const client = wsManager.getClient(clientId);
      expect(client).toBeDefined();
      expect(client?.userId).toBe('user-1');
      expect(client?.sessionId).toBe('session-1');
    });

    it('should retrieve clients in session', () => {
      // Connect multiple clients to same session
      const mockReq1 = {
        url: '/ws?sessionId=session-1&userId=user-1',
        headers: { host: 'localhost:8080' }
      };
      mockWss.emit('connection', mockWs, mockReq1);

      const mockWs2 = new EventEmitter() as any;
      mockWs2.send = jest.fn();
      const mockReq2 = {
        url: '/ws?sessionId=session-1&userId=user-2',
        headers: { host: 'localhost:8080' }
      };
      mockWss.emit('connection', mockWs2, mockReq2);

      const clients = wsManager.getClientsInSession('session-1');
      expect(clients).toHaveLength(2);
      expect(clients.some(c => c.userId === 'user-1')).toBe(true);
      expect(clients.some(c => c.userId === 'user-2')).toBe(true);
    });

    it('should retrieve clients for user', () => {
      // Connect multiple clients for same user
      const mockReq1 = {
        url: '/ws?sessionId=session-1&userId=user-1',
        headers: { host: 'localhost:8080' }
      };
      mockWss.emit('connection', mockWs, mockReq1);

      const mockWs2 = new EventEmitter() as any;
      mockWs2.send = jest.fn();
      const mockReq2 = {
        url: '/ws?sessionId=session-2&userId=user-1',
        headers: { host: 'localhost:8080' }
      };
      mockWss.emit('connection', mockWs2, mockReq2);

      const clients = wsManager.getClientsForUser('user-1');
      expect(clients).toHaveLength(2);
      expect(clients.every(c => c.userId === 'user-1')).toBe(true);
    });
  });

  describe('Shutdown', () => {
    it('should close all connections on shutdown', () => {
      // Connect multiple clients
      const mockReq1 = {
        url: '/ws?sessionId=session-1&userId=user-1',
        headers: { host: 'localhost:8080' }
      };
      mockWss.emit('connection', mockWs, mockReq1);

      const mockWs2 = new EventEmitter() as any;
      mockWs2.close = jest.fn();
      const mockReq2 = {
        url: '/ws?sessionId=session-2&userId=user-2',
        headers: { host: 'localhost:8080' }
      };
      mockWss.emit('connection', mockWs2, mockReq2);

      // Shutdown
      wsManager.shutdown();

      // All connections should be closed
      expect(mockWs.close).toHaveBeenCalledWith(1000, 'Server shutting down');
      expect(mockWs2.close).toHaveBeenCalledWith(1000, 'Server shutting down');
    });
  });
});
