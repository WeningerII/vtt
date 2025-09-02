import { EventEmitter } from 'events';
import { EncounterGenerator, GeneratedEncounter, EncounterParameters } from '../encounter/EncounterGenerator';
import { logger } from '@vtt/logging';

export interface CampaignContext {
  id: string;
  name: string;
  theme: string;
  setting: string;
  partyLevel: number;
  partySize: number;
  partyComposition: Array<{
    class: string;
    level: number;
    role: 'tank' | 'damage' | 'support' | 'utility';
  }>;
  currentLocation: string;
  questLog: Quest[];
  npcs: NPC[];
  factions: Faction[];
  timeline: TimelineEvent[];
  sessionHistory: SessionSummary[];
}

export interface Quest {
  id: string;
  title: string;
  description: string;
  type: 'main' | 'side' | 'personal';
  status: 'active' | 'completed' | 'failed' | 'paused';
  objectives: QuestObjective[];
  rewards: QuestReward[];
  giver?: string;
  location?: string;
  deadline?: Date;
  priority: 'low' | 'medium' | 'high' | 'urgent';
}

export interface QuestObjective {
  id: string;
  description: string;
  completed: boolean;
  optional: boolean;
  progress?: number;
  maxProgress?: number;
}

export interface QuestReward {
  type: 'experience' | 'gold' | 'item' | 'reputation' | 'story';
  amount?: number;
  description: string;
}

export interface NPC {
  id: string;
  name: string;
  role: string;
  location: string;
  disposition: 'hostile' | 'unfriendly' | 'neutral' | 'friendly' | 'helpful';
  importance: 'minor' | 'major' | 'critical';
  description: string;
  motivations: string[];
  secrets?: string[];
  relationships: Array<{
    npcId: string;
    relationship: string;
    strength: number;
  }>;
}

export interface Faction {
  id: string;
  name: string;
  type: 'guild' | 'government' | 'religious' | 'criminal' | 'military' | 'merchant';
  influence: number;
  reputation: number;
  goals: string[];
  resources: string[];
  enemies: string[];
  allies: string[];
}

export interface TimelineEvent {
  id: string;
  date: Date;
  title: string;
  description: string;
  type: 'quest' | 'encounter' | 'social' | 'discovery' | 'milestone';
  participants: string[];
  consequences?: string[];
}

export interface SessionSummary {
  id: string;
  sessionNumber: number;
  date: Date;
  duration: number;
  participants: string[];
  events: string[];
  questProgress: Array<{
    questId: string;
    objectivesCompleted: string[];
  }>;
  npcsEncountered: string[];
  locationsVisited: string[];
  treasureFound: string[];
  experienceGained: number;
  notes: string;
}

export interface CampaignSuggestion {
  type: 'quest' | 'encounter' | 'npc' | 'location' | 'plot_twist' | 'reward';
  priority: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  reasoning: string;
  implementation: string[];
  consequences?: string[];
}

export interface PlotHook {
  id: string;
  title: string;
  description: string;
  type: 'mystery' | 'conflict' | 'discovery' | 'betrayal' | 'romance' | 'revenge';
  complexity: 'simple' | 'moderate' | 'complex';
  estimatedSessions: number;
  prerequisites?: string[];
  rewards: string[];
  npcsInvolved: string[];
  locationsInvolved: string[];
}

export class CampaignAssistant extends EventEmitter {
  private encounterGenerator: EncounterGenerator;
  private campaignContexts: Map<string, CampaignContext> = new Map();
  private plotHooks: Map<string, PlotHook> = new Map();

  constructor(encounterGenerator: EncounterGenerator) {
    super();
    this.encounterGenerator = encounterGenerator;
    this.setMaxListeners(100);
    this.initializePlotHooks();
  }

  /**
   * Analyze campaign context and provide suggestions
   */
  async analyzeCampaign(campaignId: string): Promise<CampaignSuggestion[]> {
    const context = this.campaignContexts.get(campaignId);
    if (!context) {
      throw new Error('Campaign context not found');
    }

    const suggestions: CampaignSuggestion[] = [];

    // Analyze quest progression
    suggestions.push(...this.analyzeQuestProgression(context));

    // Analyze party balance and challenges
    suggestions.push(...this.analyzePartyBalance(context));

    // Analyze NPC relationships
    suggestions.push(...this.analyzeNPCRelationships(context));

    // Analyze pacing and variety
    suggestions.push(...this.analyzePacing(context));

    // Analyze faction dynamics
    suggestions.push(...this.analyzeFactionDynamics(context));

    this.emit('campaignAnalyzed', campaignId, suggestions);
    return suggestions.sort((a, b) => this.getPriorityValue(b.priority) - this.getPriorityValue(a.priority));
  }

  /**
   * Generate next session content
   */
  async generateSessionContent(campaignId: string, sessionGoals?: string[]): Promise<{
    encounters: GeneratedEncounter[];
    quests: Quest[];
    npcs: NPC[];
    plotDevelopments: string[];
    rewards: QuestReward[];
  }> {
    const context = this.campaignContexts.get(campaignId);
    if (!context) {
      throw new Error('Campaign context not found');
    }

    // Generate encounters based on current context
    const encounters = await this.generateContextualEncounters(context);

    // Suggest quest developments
    const quests = this.generateQuestDevelopments(context);

    // Suggest new NPCs
    const npcs = this.generateContextualNPCs(context);

    // Generate plot developments
    const plotDevelopments = this.generatePlotDevelopments(context);

    // Generate appropriate rewards
    const rewards = this.generateSessionRewards(context);

    const sessionContent = {
      encounters,
      quests,
      npcs,
      plotDevelopments,
      rewards,
    };

    this.emit('sessionContentGenerated', campaignId, sessionContent);
    return sessionContent;
  }

  /**
   * Track session events and update campaign context
   */
  recordSessionEvents(campaignId: string, sessionSummary: SessionSummary): void {
    const context = this.campaignContexts.get(campaignId);
    if (!context) {
      return;
    }

    // Add session to history
    context.sessionHistory.push(sessionSummary);

    // Update quest progress
    sessionSummary.questProgress.forEach(progress => {
      const quest = context.questLog.find(q => q.id === progress.questId);
      if (quest) {
        progress.objectivesCompleted.forEach(objId => {
          const objective = quest.objectives.find(o => o.id === objId);
          if (objective) {
            objective.completed = true;
          }
        });

        // Check if quest is completed
        if (quest.objectives.every(obj => obj.completed || obj.optional)) {
          quest.status = 'completed';
        }
      }
    });

    // Update timeline
    const timelineEvent: TimelineEvent = {
      id: `session_${sessionSummary.sessionNumber}`,
      date: sessionSummary.date,
      title: `Session ${sessionSummary.sessionNumber}`,
      description: sessionSummary.notes,
      type: 'milestone',
      participants: sessionSummary.participants,
    };
    context.timeline.push(timelineEvent);

    this.emit('sessionRecorded', campaignId, sessionSummary);
  }

  /**
   * Generate adaptive encounters based on party performance
   */
  async generateAdaptiveEncounter(campaignId: string, recentPerformance: {
    averageCombatDuration: number;
    playerEngagement: number;
    difficultyRating: number;
  }): Promise<GeneratedEncounter> {
    const context = this.campaignContexts.get(campaignId);
    if (!context) {
      throw new Error('Campaign context not found');
    }

    // Adjust difficulty based on performance
    let difficulty: 'easy' | 'medium' | 'hard' | 'deadly' = 'medium';
    
    if (recentPerformance.difficultyRating < 3) {
      difficulty = 'easy';
    } else if (recentPerformance.difficultyRating > 7) {
      difficulty = 'hard';
    } else if (recentPerformance.difficultyRating > 8.5) {
      difficulty = 'deadly';
    }

    // Adjust encounter type based on engagement
    let theme: 'combat' | 'exploration' | 'social' | 'puzzle' | 'mixed' = 'combat';
    if (recentPerformance.playerEngagement < 5) {
      theme = 'mixed'; // More variety for low engagement
    }

    const encounterParams: EncounterParameters = {
      partyLevel: context.partyLevel,
      partySize: context.partySize,
      difficulty,
      environment: this.getContextualEnvironment(context),
      theme,
      duration: recentPerformance.averageCombatDuration > 60 ? 'short' : 'medium',
    };

    return this.encounterGenerator.generateEncounter(encounterParams);
  }

  /**
   * Generate plot hooks based on campaign context
   */
  generatePlotHooks(campaignId: string, count: number = 3): PlotHook[] {
    const context = this.campaignContexts.get(campaignId);
    if (!context) {
      return [];
    }

    const availableHooks = Array.from(this.plotHooks.values()).filter(hook => {
      // Filter based on campaign context
      return this.isPlotHookAppropriate(hook, context);
    });

    // Select diverse hooks
    const selectedHooks: PlotHook[] = [];
    const usedTypes = new Set<string>();

    for (const hook of availableHooks) {
      if (selectedHooks.length >= count) break;
      
      if (!usedTypes.has(hook.type)) {
        selectedHooks.push(hook);
        usedTypes.add(hook.type);
      }
    }

    // Fill remaining slots if needed
    while (selectedHooks.length < count && selectedHooks.length < availableHooks.length) {
      const remainingHooks = availableHooks.filter(h => !selectedHooks.includes(h));
      if (remainingHooks.length > 0) {
        const randomHook = remainingHooks[Math.floor(Math.random() * remainingHooks.length)];
        if (randomHook) {
          selectedHooks.push(randomHook);
        }
      } else {
        break;
      }
    }

    return selectedHooks;
  }

  /**
   * Update campaign context
   */
  updateCampaignContext(campaignId: string, updates: Partial<CampaignContext>): void {
    const context = this.campaignContexts.get(campaignId);
    if (context) {
      Object.assign(context, updates);
      this.emit('campaignContextUpdated', campaignId, context);
    }
  }

  /**
   * Set campaign context
   */
  setCampaignContext(context: CampaignContext): void {
    this.campaignContexts.set(context.id, context);
    this.emit('campaignContextSet', context.id);
  }

  private analyzeQuestProgression(context: CampaignContext): CampaignSuggestion[] {
    const suggestions: CampaignSuggestion[] = [];
    
    const activeQuests = context.questLog.filter(q => q.status === 'active');
    const completedQuests = context.questLog.filter(q => q.status === 'completed');

    if (activeQuests.length === 0) {
      suggestions.push({
        type: 'quest',
        priority: 'high',
        title: 'No Active Quests',
        description: 'The party has no active quests to pursue.',
        reasoning: 'Players need clear objectives and goals to drive the narrative forward.',
        implementation: [
          'Introduce a new main quest hook',
          'Have an NPC approach with urgent news',
          'Reveal consequences of completed quests',
        ],
      });
    }

    if (activeQuests.length > 5) {
      suggestions.push({
        type: 'quest',
        priority: 'medium',
        title: 'Quest Overload',
        description: 'The party has too many active quests.',
        reasoning: 'Too many concurrent quests can overwhelm players and dilute focus.',
        implementation: [
          'Provide clear quest priorities',
          'Set deadlines for time-sensitive quests',
          'Allow some quests to resolve naturally',
        ],
      });
    }

    return suggestions;
  }

  private analyzePartyBalance(context: CampaignContext): CampaignSuggestion[] {
    const suggestions: CampaignSuggestion[] = [];
    
    const roles = context.partyComposition.map(pc => pc.role);
    const roleCount = roles.reduce((acc, role) => {
      acc[role] = (acc[role] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    if (!roleCount.tank) {
      suggestions.push({
        type: 'encounter',
        priority: 'medium',
        title: 'No Tank in Party',
        description: 'The party lacks a dedicated tank character.',
        reasoning: 'Without a tank, the party may struggle with direct combat encounters.',
        implementation: [
          'Design encounters with multiple weak enemies instead of single strong ones',
          'Provide tactical terrain for cover and positioning',
          'Introduce NPC allies for combat support',
        ],
      });
    }

    if (!roleCount.support) {
      suggestions.push({
        type: 'reward',
        priority: 'medium',
        title: 'No Support in Party',
        description: 'The party lacks healing and support capabilities.',
        reasoning: 'Without support, the party may struggle with resource management.',
        implementation: [
          'Provide healing potions and magical items',
          'Include rest opportunities in encounters',
          'Design shorter adventuring days',
        ],
      });
    }

    return suggestions;
  }

  private analyzeNPCRelationships(context: CampaignContext): CampaignSuggestion[] {
    const suggestions: CampaignSuggestion[] = [];
    
    const majorNPCs = context.npcs.filter(npc => npc.importance === 'major' || npc.importance === 'critical');
    const recentSessions = context.sessionHistory.slice(-3);
    const recentNPCs = new Set(recentSessions.flatMap(s => s.npcsEncountered));

    const underutilizedNPCs = majorNPCs.filter(npc => !recentNPCs.has(npc.id));

    if (underutilizedNPCs.length > 0) {
      suggestions.push({
        type: 'npc',
        priority: 'medium',
        title: 'Underutilized Important NPCs',
        description: `Important NPCs haven't appeared recently: ${underutilizedNPCs.map(n => n.name).join(', ')}`,
        reasoning: 'Important NPCs should have regular presence to maintain narrative continuity.',
        implementation: [
          'Have these NPCs reach out to the party',
          'Include them in current quest developments',
          'Show consequences of their absence',
        ],
      });
    }

    return suggestions;
  }

  private analyzePacing(context: CampaignContext): CampaignSuggestion[] {
    const suggestions: CampaignSuggestion[] = [];
    
    const recentSessions = context.sessionHistory.slice(-5);
    const encounterTypes = recentSessions.flatMap(s => s.events.filter(e => e.includes('combat')));

    if (encounterTypes.length > recentSessions.length * 0.8) {
      suggestions.push({
        type: 'encounter',
        priority: 'medium',
        title: 'Too Much Combat',
        description: 'Recent sessions have been heavily combat-focused.',
        reasoning: 'Variety in encounter types keeps players engaged and prevents fatigue.',
        implementation: [
          'Include more social encounters',
          'Add exploration and puzzle elements',
          'Provide roleplay opportunities',
        ],
      });
    }

    return suggestions;
  }

  private analyzeFactionDynamics(context: CampaignContext): CampaignSuggestion[] {
    const suggestions: CampaignSuggestion[] = [];
    
    const activeFactions = context.factions.filter(f => f.influence > 0);
    
    if (activeFactions.length > 0) {
      const conflictPotential = activeFactions.some(f => 
        f.enemies.some(enemy => activeFactions.some(af => af.id === enemy))
      );

      if (conflictPotential) {
        suggestions.push({
          type: 'plot_twist',
          priority: 'high',
          title: 'Faction Conflict Opportunity',
          description: 'Current faction relationships suggest potential for interesting conflicts.',
          reasoning: 'Faction conflicts create dynamic political situations and meaningful choices.',
          implementation: [
            'Escalate tensions between opposing factions',
            'Force the party to choose sides',
            'Show consequences of faction actions',
          ],
        });
      }
    }

    return suggestions;
  }

  private async generateContextualEncounters(context: CampaignContext): Promise<GeneratedEncounter[]> {
    const encounters: GeneratedEncounter[] = [];
    
    // Generate 1-2 encounters based on current location and quests
    const encounterParams: EncounterParameters = {
      partyLevel: context.partyLevel,
      partySize: context.partySize,
      difficulty: 'medium',
      environment: this.getContextualEnvironment(context),
      theme: 'mixed',
    };

    const encounter = await this.encounterGenerator.generateEncounter(encounterParams);
    encounters.push(encounter);

    return encounters;
  }

  private generateQuestDevelopments(context: CampaignContext): Quest[] {
    // Generate quest developments based on current context
    return [];
  }

  private generateContextualNPCs(context: CampaignContext): NPC[] {
    // Generate NPCs that fit the current context
    return [];
  }

  private generatePlotDevelopments(context: CampaignContext): string[] {
    return [
      'A mysterious message arrives for one of the party members',
      'An old enemy resurfaces with new allies',
      'A trusted NPC reveals a hidden agenda',
    ];
  }

  private generateSessionRewards(context: CampaignContext): QuestReward[] {
    return [
      {
        type: 'experience',
        amount: context.partyLevel * 100,
        description: 'Experience points for session participation',
      },
      {
        type: 'gold',
        amount: context.partyLevel * 50,
        description: 'Gold pieces found during adventures',
      },
    ];
  }

  private getContextualEnvironment(context: CampaignContext): 'dungeon' | 'wilderness' | 'urban' | 'aquatic' | 'aerial' | 'planar' {
    // Determine environment based on current location
    if (context.currentLocation.toLowerCase().includes('city')) return 'urban';
    if (context.currentLocation.toLowerCase().includes('dungeon')) return 'dungeon';
    if (context.currentLocation.toLowerCase().includes('forest')) return 'wilderness';
    return 'wilderness';
  }

  private isPlotHookAppropriate(hook: PlotHook, context: CampaignContext): boolean {
    // Check if plot hook fits campaign context
    return hook.prerequisites?.every(req => 
      context.questLog.some(q => q.status === 'completed' && q.title.includes(req))
    ) ?? true;
  }

  private getPriorityValue(priority: string): number {
    const values = { low: 1, medium: 2, high: 3, urgent: 4 };
    return values[priority as keyof typeof values] || 1;
  }

  private initializePlotHooks(): void {
    const sampleHooks: PlotHook[] = [
      {
        id: 'missing_caravan',
        title: 'The Missing Caravan',
        description: 'A merchant caravan has disappeared on the trade route, and the merchants guild is offering a reward for information.',
        type: 'mystery',
        complexity: 'simple',
        estimatedSessions: 2,
        rewards: ['Gold reward', 'Merchant guild reputation'],
        npcsInvolved: ['Merchant Guild Leader', 'Caravan Guard Survivor'],
        locationsInvolved: ['Trade Route', 'Bandit Camp'],
      },
      {
        id: 'ancient_artifact',
        title: 'The Ancient Artifact',
        description: 'Scholars have discovered references to a powerful artifact hidden in nearby ruins.',
        type: 'discovery',
        complexity: 'moderate',
        estimatedSessions: 4,
        rewards: ['Magical artifact', 'Ancient knowledge'],
        npcsInvolved: ['Scholar', 'Rival Adventuring Party'],
        locationsInvolved: ['Ancient Ruins', 'Library'],
      },
    ];

    sampleHooks.forEach(hook => {
      this.plotHooks.set(hook.id, hook);
    });

    logger.info(`Initialized ${sampleHooks.length} plot hooks`);
  }
}
