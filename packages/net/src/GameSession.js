/**
 * Real-time multiplayer game session with state synchronization
 */
import { EventEmitter } from 'events';
import { World } from '@vtt/core-ecs';
import { CombatEngine } from '@vtt/rules-5e';
import { AIEntity, NPCArchetypes } from '@vtt/ai';
export class GameSession extends EventEmitter {
    constructor(sessionId) {
        super();
        this.updateQueue = [];
        this.sequenceCounter = 0;
        this.lastSyncTime = 0;
        this.syncInterval = 50; // 20 FPS
        this.maxUpdateQueueSize = 1000;
        this.clientStates = new Map();
        this.state = {
            sessionId,
            players: new Map(),
            world: new World(),
            combat: new CombatEngine(),
            aiEntities: new Map(),
            currentScene: 'default',
            settings: {
                gridSize: 70,
                gridType: 'square',
                visionEnabled: true,
                initiativeTracking: true,
                aiEnabled: true,
            },
            lastUpdate: Date.now(),
        };
        this.setupCombatEventHandlers();
        this.startSyncLoop();
    }
    setupCombatEventHandlers() {
        this.state.combat.on('combatStarted', () => {
            this.queueUpdate('combat', 'system', { event: 'combatStarted' });
        });
        this.state.combat.on('turnStarted', (combatant) => {
            this.queueUpdate('combat', 'system', { event: 'turnStarted', combatant });
        });
        this.state.combat.on('attackExecuted', (data) => {
            this.queueUpdate('combat', 'system', { event: 'attackExecuted', data });
        });
        this.state.combat.on('damageApplied', (data) => {
            this.queueUpdate('combat', 'system', { event: 'damageApplied', data });
        });
    }
    startSyncLoop() {
        setInterval(() => {
            this.processSyncTick();
        }, this.syncInterval);
    }
    processSyncTick() {
        const now = Date.now();
        // Process queued updates
        if (this.updateQueue.length > 0) {
            this.broadcastDeltaSync();
        }
        // Clean up old client states
        this.cleanupClientStates(now);
        // Update world simulation
        this.state.world.update(this.syncInterval / 1000);
        // Update AI entities if enabled
        if (this.state.settings.aiEnabled) {
            this.updateAIEntities(this.syncInterval / 1000);
        }
        this.lastSyncTime = now;
    }
    cleanupClientStates(now) {
        const timeout = 30000; // 30 seconds
        for (const [playerId, clientState] of this.clientStates) {
            if (now - clientState.lastSeen > timeout) {
                this.handlePlayerDisconnect(playerId);
            }
        }
    }
    // Player management
    addPlayer(player) {
        this.state.players.set(player.id, player);
        this.clientStates.set(player.id, { lastSequenceId: 0, lastSeen: Date.now() });
        this.queueUpdate('player', 'system', {
            event: 'playerJoined',
            player: this.serializePlayer(player)
        });
        this.emit('playerJoined', player);
    }
    removePlayer(playerId) {
        const player = this.state.players.get(playerId);
        if (player) {
            this.state.players.delete(playerId);
            this.clientStates.delete(playerId);
            this.queueUpdate('player', 'system', {
                event: 'playerLeft',
                playerId
            });
            this.emit('playerLeft', player);
        }
    }
    updatePlayerConnection(playerId, connected) {
        const player = this.state.players.get(playerId);
        if (player) {
            player.connected = connected;
            player.lastSeen = Date.now();
            const clientState = this.clientStates.get(playerId);
            if (clientState) {
                clientState.lastSeen = Date.now();
            }
            this.queueUpdate('player', 'system', {
                event: 'playerConnectionChanged',
                playerId,
                connected
            });
        }
    }
    handlePlayerDisconnect(playerId) {
        this.updatePlayerConnection(playerId, false);
        this.emit('playerDisconnected', playerId);
    }
    // State management
    queueUpdate(type, playerId, data) {
        if (this.updateQueue.length >= this.maxUpdateQueueSize) {
            // Remove oldest updates to prevent memory issues
            this.updateQueue.splice(0, this.updateQueue.length - this.maxUpdateQueueSize + 1);
        }
        const update = {
            type,
            timestamp: Date.now(),
            playerId,
            data,
            sequenceId: ++this.sequenceCounter,
        };
        this.updateQueue.push(update);
        this.state.lastUpdate = update.timestamp;
    }
    applyUpdate(update) {
        try {
            switch (update.type) {
                case 'entity':
                    return this.applyEntityUpdate(update);
                case 'combat':
                    return this.applyCombatUpdate(update);
                case 'player':
                    return this.applyPlayerUpdate(update);
                case 'scene':
                    return this.applySceneUpdate(update);
                case 'settings':
                    return this.applySettingsUpdate(update);
                default:
                    console.warn('Unknown update type:', update.type);
                    return false;
            }
        }
        catch (error) {
            console.error('Error applying update:', error);
            return false;
        }
    }
    applyEntityUpdate(update) {
        const { action, entityId, componentType, data } = update.data;
        switch (action) {
            case 'create':
                this.state.world.createEntity(entityId);
                break;
            case 'destroy':
                this.state.world.destroyEntity(entityId);
                break;
            case 'addComponent':
                // Add component to entity
                const component = this.state.world.getComponent(componentType);
                if (component && component.add) {
                    component.add(entityId, data);
                }
                break;
            case 'updateComponent':
                // Update component data
                const updateComponent = this.state.world.getComponent(componentType);
                if (updateComponent && updateComponent.update) {
                    updateComponent.update(entityId, data);
                }
                break;
            case 'removeComponent':
                const removeComponent = this.state.world.getComponent(componentType);
                if (removeComponent && removeComponent.remove) {
                    removeComponent.remove(entityId);
                }
                break;
            default:
                return false;
        }
        return true;
    }
    applyCombatUpdate(update) {
        const { action, data } = update.data;
        switch (action) {
            case 'addCombatant':
                this.state.combat.addCombatant(data);
                break;
            case 'removeCombatant':
                this.state.combat.removeCombatant(data.id);
                break;
            case 'executeAction':
                this.state.combat.executeAction(data);
                break;
            case 'nextTurn':
                this.state.combat.nextTurn();
                break;
            case 'startCombat':
                this.state.combat.startCombat();
                break;
            case 'endCombat':
                this.state.combat.endCombat();
                break;
            default:
                return false;
        }
        return true;
    }
    applyPlayerUpdate(update) {
        const { action, playerId, data } = update.data;
        switch (action) {
            case 'updateCharacter':
                // Update player's character data
                const player = this.state.players.get(playerId);
                if (player && data.characterId && player.characterIds.includes(data.characterId)) {
                    // Apply character updates
                    this.emit('characterUpdated', { playerId, characterId: data.characterId, updates: data.updates });
                }
                break;
            default:
                return false;
        }
        return true;
    }
    applySceneUpdate(update) {
        const { action, data } = update.data;
        switch (action) {
            case 'changeScene':
                this.state.currentScene = data.sceneId;
                break;
            case 'updateSceneData':
                // Update scene-specific data
                this.emit('sceneDataUpdated', data);
                break;
            default:
                return false;
        }
        return true;
    }
    applySettingsUpdate(update) {
        const { settings } = update.data;
        this.state.settings = { ...this.state.settings, ...settings };
        return true;
    }
    // Synchronization
    getFullSync(playerId) {
        const player = this.state.players.get(playerId);
        if (!player) {
            throw new Error('Player not found');
        }
        return {
            type: 'full_sync',
            sessionId: this.state.sessionId,
            timestamp: Date.now(),
            data: {
                players: Array.from(this.state.players.values()).map(p => this.serializePlayer(p)),
                worldState: this.serializeWorldState(),
                combatState: this.serializeCombatState(),
                currentScene: this.state.currentScene,
                settings: this.state.settings,
                sequenceId: this.sequenceCounter,
            },
        };
    }
    getDeltaSync(playerId, lastSequenceId) {
        const relevantUpdates = this.updateQueue.filter(update => update.sequenceId > lastSequenceId &&
            this.isUpdateRelevantToPlayer(update, playerId));
        return {
            type: 'delta_sync',
            sessionId: this.state.sessionId,
            timestamp: Date.now(),
            data: {
                updates: relevantUpdates,
                sequenceId: this.sequenceCounter,
            },
        };
    }
    isUpdateRelevantToPlayer(update, playerId) {
        const player = this.state.players.get(playerId);
        if (!player)
            return false;
        // GM sees all updates
        if (player.role === 'gm')
            return true;
        // Players see updates relevant to their characters or public updates
        switch (update.type) {
            case 'player':
                return true; // All player updates are public
            case 'combat':
                return true; // All combat updates are public
            case 'scene':
                return true; // All scene updates are public
            case 'settings':
                return true; // All settings updates are public
            case 'entity':
                // Entity updates are visible if they affect visible entities
                // This would need more sophisticated visibility logic
                return true;
            default:
                return false;
        }
    }
    broadcastDeltaSync() {
        const updates = [...this.updateQueue];
        this.updateQueue = [];
        for (const [playerId, clientState] of this.clientStates) {
            const deltaSync = this.getDeltaSync(playerId, clientState.lastSequenceId);
            if (deltaSync.data.updates.length > 0) {
                this.emit('syncMessage', playerId, deltaSync);
                clientState.lastSequenceId = this.sequenceCounter;
            }
        }
    }
    handleClientMessage(playerId, message) {
        const player = this.state.players.get(playerId);
        if (!player) {
            console.warn('Message from unknown player:', playerId);
            return;
        }
        // Update client state
        const clientState = this.clientStates.get(playerId);
        if (clientState) {
            clientState.lastSeen = Date.now();
            if (message.sequenceId) {
                clientState.lastSequenceId = Math.max(clientState.lastSequenceId, message.sequenceId);
            }
        }
        switch (message.type) {
            case 'state_update':
                this.handleStateUpdate(playerId, message.data);
                break;
            case 'player_action':
                this.handlePlayerAction(playerId, message.data);
                break;
            default:
                console.warn('Unknown message type:', message.type);
        }
    }
    handleStateUpdate(playerId, data) {
        const player = this.state.players.get(playerId);
        if (!player)
            return;
        // Validate that player has permission to make this update
        if (!this.validatePlayerPermission(player, data)) {
            console.warn('Player lacks permission for update:', playerId, data);
            return;
        }
        // Queue the update
        this.queueUpdate(data.type, playerId, data);
    }
    handlePlayerAction(playerId, action) {
        const player = this.state.players.get(playerId);
        if (!player)
            return;
        switch (action.type) {
            case 'move_token':
                this.handleMoveToken(playerId, action.data);
                break;
            case 'combat_action':
                this.handleCombatAction(playerId, action.data);
                break;
            case 'chat_message':
                this.handleChatMessage(playerId, action.data);
                break;
            default:
                console.warn('Unknown player action:', action.type);
        }
    }
    handleMoveToken(playerId, data) {
        const player = this.state.players.get(playerId);
        if (!player)
            return;
        // Validate token ownership or GM permissions
        if (player.role !== 'gm' && !this.playerOwnsToken(player, data.tokenId)) {
            return;
        }
        this.queueUpdate('entity', playerId, {
            action: 'updateComponent',
            entityId: data.tokenId,
            componentType: 'Transform2D',
            data: { x: data.x, y: data.y }
        });
    }
    handleCombatAction(playerId, data) {
        const player = this.state.players.get(playerId);
        if (!player)
            return;
        // Validate that it's the player's turn or they're the GM
        const currentCombatant = this.state.combat.getCurrentCombatant();
        if (player.role !== 'gm' &&
            (!currentCombatant || !player.characterIds.includes(currentCombatant.id))) {
            return;
        }
        this.queueUpdate('combat', playerId, {
            action: 'executeAction',
            data: data.combatAction
        });
    }
    handleChatMessage(playerId, data) {
        this.queueUpdate('player', playerId, {
            event: 'chatMessage',
            playerId,
            message: data.message,
            timestamp: Date.now()
        });
    }
    validatePlayerPermission(player, update) {
        // GM can do anything
        if (player.role === 'gm')
            return true;
        // Players can only update their own characters and make certain actions
        switch (update.type) {
            case 'entity':
                // Players can only update entities they own
                return this.playerOwnsEntity(player, update.entityId);
            case 'player':
                // Players can only update their own player data
                return update.playerId === player.id;
            case 'combat':
                // Players can only take combat actions for their characters
                return update.action === 'executeAction' &&
                    player.characterIds.includes(update.data.actorId);
            default:
                return false;
        }
    }
    playerOwnsEntity(player, entityId) {
        // This would need to be implemented based on your entity ownership system
        return player.characterIds.includes(entityId);
    }
    playerOwnsToken(player, tokenId) {
        // This would need to be implemented based on your token ownership system
        return player.characterIds.includes(tokenId);
    }
    // Serialization helpers
    serializePlayer(player) {
        return {
            id: player.id,
            name: player.name,
            role: player.role,
            characterIds: player.characterIds,
            connected: player.connected,
        };
    }
    serializeWorldState() {
        // Serialize the ECS world state
        return {
            entities: this.state.world.getEntities(),
            // Add component data serialization here
        };
    }
    serializeCombatState() {
        return {
            combatants: this.state.combat.getCombatants(),
            turnOrder: this.state.combat.getTurnOrder(),
            currentRound: this.state.combat.getCurrentRound(),
            isActive: this.state.combat.isInCombat(),
        };
    }
    // Public API
    getSessionId() {
        return this.state.sessionId;
    }
    getPlayers() {
        return Array.from(this.state.players.values());
    }
    getPlayer(playerId) {
        return this.state.players.get(playerId);
    }
    getWorld() {
        return this.state.world;
    }
    getCombatEngine() {
        return this.state.combat;
    }
    getSettings() {
        return this.state.settings;
    }
    updateSettings(settings) {
        this.queueUpdate('settings', 'system', { settings });
    }
    // AI Entity Management
    addAIEntity(id, archetype = 'guard') {
        let personality;
        switch (archetype) {
            case 'guard':
                personality = NPCArchetypes.createGuard();
                break;
            case 'berserker':
                personality = NPCArchetypes.createBerserker();
                break;
            case 'scout':
                personality = NPCArchetypes.createScout();
                break;
            case 'healer':
                personality = NPCArchetypes.createHealer();
                break;
            case 'wildcard':
                personality = NPCArchetypes.createWildcard();
                break;
        }
        const aiEntity = new AIEntity(id, personality);
        this.state.aiEntities.set(id, aiEntity);
        // Create corresponding entity in ECS world (convert string ID to number)
        const numericId = parseInt(id, 10) || this.state.world.createEntity();
        this.state.world.createEntity(numericId);
        this.queueUpdate('entity', 'system', {
            event: 'aiEntityAdded',
            entityId: id,
            numericId,
            archetype
        });
    }
    removeAIEntity(id) {
        this.state.aiEntities.delete(id);
        // Convert string ID to numeric for ECS world
        const numericId = parseInt(id, 10);
        if (!isNaN(numericId)) {
            this.state.world.destroyEntity(numericId);
        }
        this.queueUpdate('entity', 'system', {
            event: 'aiEntityRemoved',
            entityId: id
        });
    }
    updateAIEntities(deltaTime) {
        for (const [entityId, aiEntity] of this.state.aiEntities) {
            // Create game state snapshot for this AI entity
            const gameState = this.createGameStateSnapshot(entityId);
            // Update AI entity
            aiEntity.update(gameState, deltaTime);
            // Check if AI wants to take any actions
            const aiState = aiEntity.getState();
            if (aiState.currentAction && aiState.behaviorTree) {
                this.handleAIAction(entityId, aiState.currentAction);
            }
        }
    }
    createGameStateSnapshot(entityId) {
        // This would need to be implemented based on your ECS component system
        // For now, return a basic snapshot
        return {
            nearbyEnemies: [],
            nearbyAllies: [],
            isUnderThreat: false,
            healthPercentage: 1.0,
            position: { x: 0, y: 0 },
            canMove: true,
            canAttack: true
        };
    }
    handleAIAction(entityId, action) {
        // Handle AI-initiated actions
        switch (action) {
            case 'attack':
                this.queueUpdate('combat', 'ai', {
                    action: 'executeAction',
                    data: {
                        actorId: entityId,
                        actionType: 'attack',
                        timestamp: Date.now()
                    }
                });
                break;
            case 'move':
                // Handle movement
                break;
            case 'defend':
                // Handle defensive actions
                break;
            // Add more action handlers as needed
        }
    }
    getAIEntities() {
        return Array.from(this.state.aiEntities.values());
    }
    getAIEntity(id) {
        return this.state.aiEntities.get(id);
    }
    destroy() {
        this.removeAllListeners();
        this.state.players.clear();
        this.state.aiEntities.clear();
        this.clientStates.clear();
        this.updateQueue = [];
    }
}
//# sourceMappingURL=GameSession.js.map