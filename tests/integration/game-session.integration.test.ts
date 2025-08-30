/**
 * Integration tests for game session management
 */
import { GameSession } from '../../packages/core/src/GameSession';
import { CharacterManager } from '../../packages/core/src/CharacterManager';
import { SceneManager } from '../../packages/scene-management/src/SceneManager';

describe('Game Session Integration', () => {
  let gameSession: GameSession;
  let characterManager: CharacterManager;
  let sceneManager: SceneManager;

  beforeEach(() => {
    characterManager = new CharacterManager();
    sceneManager = new SceneManager();
    gameSession = new GameSession({
      id: 'test-session',
      name: 'Test Campaign',
      characterManager,
      sceneManager
    });
  });

  describe('Session Lifecycle', () => {
    it('should create and initialize a new game session', async () => {
      await gameSession.initialize();
      
      expect(gameSession.isActive()).toBe(true);
      expect(gameSession.getId()).toBe('test-session');
      expect(gameSession.getName()).toBe('Test Campaign');
    });

    it('should handle player connections', async () => {
      await gameSession.initialize();
      
      const playerId = 'player-1';
      const connectionResult = await gameSession.connectPlayer(playerId, {
        username: 'TestPlayer',
        characterId: 'char-1'
      });
      
      expect(connectionResult.success).toBe(true);
      expect(gameSession.getConnectedPlayers()).toContain(playerId);
    });

    it('should manage session state transitions', async () => {
      await gameSession.initialize();
      
      expect(gameSession.getState()).toBe('lobby');
      
      await gameSession.startSession();
      expect(gameSession.getState()).toBe('active');
      
      await gameSession.pauseSession();
      expect(gameSession.getState()).toBe('paused');
      
      await gameSession.endSession();
      expect(gameSession.getState()).toBe('ended');
    });
  });

  describe('Character Integration', () => {
    beforeEach(async () => {
      await gameSession.initialize();
    });

    it('should add characters to session', async () => {
      const character = {
        id: 'char-1',
        name: 'Test Hero',
        level: 1,
        class: 'fighter',
        abilities: {
          strength: 16,
          dexterity: 14,
          constitution: 15,
          intelligence: 10,
          wisdom: 12,
          charisma: 8
        }
      };

      const result = await gameSession.addCharacter(character);
      
      expect(result.success).toBe(true);
      expect(gameSession.getCharacters()).toHaveLength(1);
      expect(gameSession.getCharacter('char-1')).toEqual(character);
    });

    it('should handle character updates during session', async () => {
      const character = {
        id: 'char-2',
        name: 'Test Wizard',
        level: 1,
        hitPoints: { current: 8, maximum: 8 }
      };

      await gameSession.addCharacter(character);
      
      const updateResult = await gameSession.updateCharacter('char-2', {
        hitPoints: { current: 5, maximum: 8 }
      });
      
      expect(updateResult.success).toBe(true);
      
      const updatedChar = gameSession.getCharacter('char-2');
      expect(updatedChar.hitPoints.current).toBe(5);
    });
  });

  describe('Scene Management Integration', () => {
    beforeEach(async () => {
      await gameSession.initialize();
    });

    it('should load and switch scenes', async () => {
      const scene = {
        id: 'scene-1',
        name: 'Tavern',
        mapUrl: '/maps/tavern.jpg',
        gridSize: 30,
        dimensions: { width: 1200, height: 800 }
      };

      const loadResult = await gameSession.loadScene(scene);
      
      expect(loadResult.success).toBe(true);
      expect(gameSession.getCurrentScene()).toEqual(scene);
    });

    it('should manage tokens on scene', async () => {
      const scene = {
        id: 'scene-2',
        name: 'Combat Arena',
        tokens: []
      };

      await gameSession.loadScene(scene);
      
      const token = {
        id: 'token-1',
        characterId: 'char-1',
        position: { x: 100, y: 150 },
        size: 'medium'
      };

      const addTokenResult = await gameSession.addToken(token);
      
      expect(addTokenResult.success).toBe(true);
      expect(gameSession.getCurrentScene().tokens).toContain(token);
    });
  });

  describe('Real-time Updates', () => {
    beforeEach(async () => {
      await gameSession.initialize();
      await gameSession.connectPlayer('player-1', { username: 'Player1' });
      await gameSession.connectPlayer('player-2', { username: 'Player2' });
    });

    it('should broadcast character updates to all players', async () => {
      const character = { id: 'char-1', name: 'Hero', hitPoints: { current: 10, maximum: 10 } };
      await gameSession.addCharacter(character);

      const updateSpy = jest.spyOn(gameSession, 'broadcastUpdate');
      
      await gameSession.updateCharacter('char-1', {
        hitPoints: { current: 7, maximum: 10 }
      });
      
      expect(updateSpy).toHaveBeenCalledWith('character_update', {
        characterId: 'char-1',
        changes: { hitPoints: { current: 7, maximum: 10 } }
      });
    });

    it('should handle dice roll broadcasts', async () => {
      const rollSpy = jest.spyOn(gameSession, 'broadcastUpdate');
      
      const rollResult = await gameSession.rollDice({
        playerId: 'player-1',
        dice: '1d20+5',
        type: 'attack'
      });
      
      expect(rollResult.success).toBe(true);
      expect(rollSpy).toHaveBeenCalledWith('dice_roll', expect.objectContaining({
        playerId: 'player-1',
        result: expect.any(Number),
        dice: '1d20+5'
      }));
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid character operations gracefully', async () => {
      await gameSession.initialize();
      
      const result = await gameSession.updateCharacter('nonexistent-char', {
        hitPoints: { current: 5, maximum: 10 }
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Character not found');
    });

    it('should handle scene loading failures', async () => {
      await gameSession.initialize();
      
      const invalidScene = {
        id: 'invalid-scene',
        name: 'Broken Scene',
        mapUrl: '/nonexistent/map.jpg'
      };

      const result = await gameSession.loadScene(invalidScene);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle player disconnections gracefully', async () => {
      await gameSession.initialize();
      await gameSession.connectPlayer('player-1', { username: 'Player1' });
      
      expect(gameSession.getConnectedPlayers()).toContain('player-1');
      
      await gameSession.disconnectPlayer('player-1');
      
      expect(gameSession.getConnectedPlayers()).not.toContain('player-1');
    });
  });
});
