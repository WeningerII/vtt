import { EntityId } from '../components/Combat';
import { AIDecision, AIBehavior } from './MonsterAISystem';

export interface ActionOutcome {
  actionType: string;
  success: boolean;
  damageDealt: number;
  damageTaken: number;
  healthPercentageBefore: number;
  healthPercentageAfter: number;
  enemiesDefeated: number;
  timestamp: number;
  context: {
    enemyCount: number;
    allyCount: number;
    turnNumber: number;
    roundNumber: number;
  };
}

export interface LearningParameters {
  learningRate: number;
  discountFactor: number;
  explorationRate: number;
  explorationDecay: number;
  minExplorationRate: number;
  memorySize: number;
  batchSize: number;
}

export interface QValueState {
  healthPercentage: number;
  enemyCount: number;
  allyCount: number;
  actionPoints: number;
  hasAdvantage: boolean;
}

export interface QValue {
  state: QValueState;
  action: string;
  value: number;
  confidence: number;
  sampleCount: number;
}

export class AILearningSystem {
  private qValues: Map<string, QValue> = new Map();
  private experienceReplay: ActionOutcome[] = [];
  private parameters: LearningParameters;
  private entityLearningData: Map<EntityId, {
    totalReward: number;
    actionCount: number;
    lastUpdate: number;
    personalityAdjustments: Partial<AIBehavior>;
  }> = new Map();

  constructor(parameters?: Partial<LearningParameters>) {
    this.parameters = {
      learningRate: 0.1,
      discountFactor: 0.95,
      explorationRate: 0.3,
      explorationDecay: 0.995,
      minExplorationRate: 0.05,
      memorySize: 10000,
      batchSize: 32,
      ...parameters
    };
  }

  /**
   * Record an action outcome for learning
   */
  recordOutcome(entityId: EntityId, decision: AIDecision, outcome: ActionOutcome): void {
    // Add to experience replay buffer
    this.experienceReplay.push(outcome);
    
    // Limit memory size
    if (this.experienceReplay.length > this.parameters.memorySize) {
      this.experienceReplay.shift();
    }

    // Update entity learning data
    const learningData = this.entityLearningData.get(entityId) || {
      totalReward: 0,
      actionCount: 0,
      lastUpdate: Date.now(),
      personalityAdjustments: {} as Record<string, any>
    };

    const reward = this.calculateReward(outcome);
    learningData.totalReward += reward;
    learningData.actionCount++;
    learningData.lastUpdate = Date.now();

    this.entityLearningData.set(entityId, learningData);

    // Update Q-values
    this.updateQValue(outcome, reward);

    // Trigger batch learning periodically
    if (this.experienceReplay.length % this.parameters.batchSize === 0) {
      this.performBatchLearning();
    }
  }

  /**
   * Get the best action based on learned Q-values with exploration
   */
  getBestAction(entityId: EntityId, state: QValueState, availableActions: string[]): string {
    if (availableActions.length === 0) {
      return 'wait';
    }

    // Exploration vs exploitation
    if (Math.random() < this.parameters.explorationRate) {
      return availableActions[Math.floor(Math.random() * availableActions.length)]!;
    }

    // Find best action based on Q-values
    let bestAction = availableActions[0]!;
    let bestValue = -Infinity;

    for (const action of availableActions) {
      const qValue = this.getQValue(state, action);
      if (qValue > bestValue) {
        bestValue = qValue;
        bestAction = action;
      }
    }

    return bestAction;
  }

  /**
   * Get adaptive behavior adjustments based on learning
   */
  getAdaptiveBehavior(entityId: EntityId, baseBehavior: AIBehavior): AIBehavior {
    const learningData = this.entityLearningData.get(entityId);
    if (!learningData) {
      return baseBehavior;
    }

    // Apply learned personality adjustments
    const adaptedBehavior = { ...baseBehavior };
    
    // Adjust based on success rate
    const averageReward = learningData.totalReward / Math.max(learningData.actionCount, 1);
    
    if (averageReward < -0.5) {
      // Poor performance - become more defensive
      adaptedBehavior.selfPreservation = Math.min(1, adaptedBehavior.selfPreservation + 0.2);
      adaptedBehavior.aggressiveness = Math.max(0, adaptedBehavior.aggressiveness - 0.1);
    } else if (averageReward > 0.5) {
      // Good performance - become more confident
      adaptedBehavior.aggressiveness = Math.min(1, adaptedBehavior.aggressiveness + 0.1);
      adaptedBehavior.spellPreference = Math.min(1, adaptedBehavior.spellPreference + 0.05);
    }

    // Apply stored personality adjustments
    Object.assign(adaptedBehavior, learningData.personalityAdjustments);

    return adaptedBehavior;
  }

  /**
   * Perform batch learning from experience replay
   */
  private performBatchLearning(): void {
    if (this.experienceReplay.length < this.parameters.batchSize) {
      return;
    }

    // Sample random batch from experience
    const batch = this.sampleExperience(this.parameters.batchSize);
    
    for (const experience of batch) {
      const reward = this.calculateReward(experience);
      this.updateQValue(experience, reward);
    }

    // Decay exploration rate
    this.parameters.explorationRate = Math.max(
      this.parameters.minExplorationRate,
      this.parameters.explorationRate * this.parameters.explorationDecay
    );
  }

  /**
   * Sample random experiences from replay buffer
   */
  private sampleExperience(batchSize: number): ActionOutcome[] {
    const batch: ActionOutcome[] = [];
    const stateFeatures: Record<string, number> = {};

    while (batch.length < batchSize) {
      const index = Math.floor(Math.random() * this.experienceReplay.length);
      const outcome = this.experienceReplay[index]!;
      const state = this.outcomeToState(outcome);
      const stateKey = this.stateToKey(state);

      if (!stateFeatures[stateKey]) {
        stateFeatures[stateKey] = 0;
      }

      stateFeatures[stateKey]++;

      if (stateFeatures[stateKey] < 2) {
        batch.push(outcome);
      }
    }

    return batch;
  }

  /**
   * Calculate reward based on action outcome
   */
  private calculateReward(outcome: ActionOutcome): number {
    let reward = 0;

    // Reward for success
    if (outcome.success) {
      reward += 1.0;
    }

    // Reward for damage dealt
    reward += outcome.damageDealt * 0.1;

    // Penalty for damage taken
    reward -= outcome.damageTaken * 0.15;

    // Bonus for defeating enemies
    reward += outcome.enemiesDefeated * 2.0;

    // Penalty for dying (health goes to 0)
    if (outcome.healthPercentageAfter <= 0) {
      reward -= 5.0;
    }

    // Bonus for maintaining health
    const healthChange = outcome.healthPercentageAfter - outcome.healthPercentageBefore;
    if (healthChange > 0) {
      reward += healthChange * 0.5;
    }

    // Context-based rewards
    if (outcome.context.enemyCount > outcome.context.allyCount) {
      // Bonus for performing well when outnumbered
      reward *= 1.2;
    }

    return reward;
  }

  /**
   * Update Q-value for a state-action pair
   */
  private updateQValue(outcome: ActionOutcome, reward: number): void {
    const state = this.outcomeToState(outcome);
    const stateKey = this.stateToKey(state);
    const actionKey = `${stateKey}:${outcome.actionType}`;

    const existingQValue = this.qValues.get(actionKey);
    
    if (existingQValue) {
      // Update existing Q-value using Q-learning formula
      const oldValue = existingQValue.value;
      const newValue = oldValue + this.parameters.learningRate * (
        reward + this.parameters.discountFactor * this.getMaxQValue(state) - oldValue
      );

      existingQValue.value = newValue;
      existingQValue.sampleCount++;
      existingQValue.confidence = Math.min(1, existingQValue.sampleCount / 100);
    } else {
      // Create new Q-value
      this.qValues.set(actionKey, {
        state,
        action: outcome.actionType,
        value: reward,
        confidence: 0.1,
        sampleCount: 1
      });
    }
  }

  /**
   * Get Q-value for state-action pair
   */
  private getQValue(state: QValueState, action: string): number {
    const stateKey = this.stateToKey(state);
    const actionKey = `${stateKey}:${action}`;
    const qValue = this.qValues.get(actionKey);
    return qValue ? qValue.value : 0;
  }

  /**
   * Get maximum Q-value for a state across all actions
   */
  private getMaxQValue(state: QValueState): number {
    const stateKey = this.stateToKey(state);
    let maxValue = 0;

    for (const [key, qValue] of this.qValues) {
      if (key.startsWith(stateKey + ':')) {
        maxValue = Math.max(maxValue, qValue.value);
      }
    }

    return maxValue;
  }

  /**
   * Convert outcome to state representation
   */
  private outcomeToState(outcome: ActionOutcome): QValueState {
    return {
      healthPercentage: Math.floor(outcome.healthPercentageBefore * 4) / 4, // Quantize to quarters
      enemyCount: Math.min(outcome.context.enemyCount, 10), // Cap at 10
      allyCount: Math.min(outcome.context.allyCount, 10), // Cap at 10
      actionPoints: Math.min(3, Math.max(0, 1)), // Assume 1 action point for simplicity
      hasAdvantage: outcome.context.allyCount > outcome.context.enemyCount
    };
  }

  /**
   * Convert state to string key for storage
   */
  private stateToKey(state: QValueState): string {
    return `h${state.healthPercentage}_e${state.enemyCount}_a${state.allyCount}_ap${state.actionPoints}_adv${state.hasAdvantage ? 1 : 0}`;
  }

  /**
   * Get learning statistics
   */
  getStats() {
    const entities = Array.from(this.entityLearningData.entries());
    const totalEntities = entities.length;
    const avgReward = entities.reduce((sum, [, data]) => 
      sum + (data.totalReward / Math.max(data.actionCount, 1)), 0) / Math.max(totalEntities, 1);

    return {
      totalEntities,
      totalQValues: this.qValues.size,
      experienceBufferSize: this.experienceReplay.length,
      explorationRate: this.parameters.explorationRate,
      averageReward: avgReward,
      highConfidenceQValues: Array.from(this.qValues.values()).filter(q => q.confidence > 0.8).length
    };
  }

  /**
   * Save learning data (for persistence)
   */
  exportLearningData() {
    return {
      qValues: Array.from(this.qValues.entries()),
      entityData: Array.from(this.entityLearningData.entries()),
      parameters: this.parameters,
      timestamp: Date.now()
    };
  }

  /**
   * Load learning data (for persistence)
   */
  importLearningData(data: any): void {
    if (data.qValues) {
      this.qValues = new Map(data.qValues);
    }
    if (data.entityData) {
      this.entityLearningData = new Map(data.entityData);
    }
    if (data.parameters) {
      this.parameters = { ...this.parameters, ...data.parameters };
    }
  }

  /**
   * Reset learning data for an entity
   */
  resetEntityLearning(entityId: EntityId): void {
    this.entityLearningData.delete(entityId);
  }

  /**
   * Clear all learning data
   */
  clearAllLearning(): void {
    this.qValues.clear();
    this.entityLearningData.clear();
    this.experienceReplay = [];
    this.parameters.explorationRate = 0.3;
  }
}
