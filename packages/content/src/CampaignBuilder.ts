/**
 * Advanced campaign creation and management system
 */

import { EventEmitter } from 'events';
import { AssetManager, _AssetMetadata} from './AssetManager';
import { Scene } from './ContentEditor';

export interface Character {
  id: string;
  name: string;
  type: 'pc' | 'npc' | 'monster';
  level: number;
  class: string;
  race: string;
  background: string;
  stats: {
    strength: number;
    dexterity: number;
    constitution: number;
    intelligence: number;
    wisdom: number;
    charisma: number;
  };
  hitPoints: { current: number; maximum: number; temporary: number };
  armorClass: number;
  speed: number;
  proficiencyBonus: number;
  skills: Record<string, { proficient: boolean; expertise: boolean; bonus: number }>;
  equipment: Array<{
    id: string;
    name: string;
    type: string;
    quantity: number;
    equipped: boolean;
    properties: Record<string, any>;
  }>;
  spells: Array<{
    id: string;
    name: string;
    level: number;
    school: string;
    castingTime: string;
    range: string;
    duration: string;
    description: string;
    prepared: boolean;
  }>;
  backstory: string;
  notes: string;
  portraitAssetId?: string;
  tokenAssetId?: string;
  created: Date;
  modified: Date;
}

export interface Quest {
  id: string;
  title: string;
  description: string;
  type: 'main' | 'side' | 'personal' | 'faction';
  status: 'not_started' | 'in_progress' | 'completed' | 'failed' | 'paused';
  giver: string;
  location: string;
  level: number;
  rewards: Array<{
    type: 'experience' | 'gold' | 'item' | 'reputation';
    amount: number;
    description: string;
  }>;
  objectives: Array<{
    id: string;
    description: string;
    completed: boolean;
    optional: boolean;
  }>;
  prerequisites: string[];
  dependencies: string[];
  notes: string;
  created: Date;
  modified: Date;
}

export interface Location {
  id: string;
  name: string;
  type: 'city' | 'town' | 'village' | 'dungeon' | 'wilderness' | 'plane' | 'landmark';
  description: string;
  population?: number;
  government?: string;
  economy?: string;
  defenses?: string;
  climate?: string;
  geography?: string;
  history: string;  
  culture?: string;
  notableNPCs: string[];
  availableServices: string[];
  rumors: string[];
  hooks: string[];
  connections: Array<{
    locationId: string;
    distance: number;
    travelTime: string;
    method: string;
    difficulty: string;
  }>;
  scenes: string[];
  mapAssetId?: string;
  imageAssets: string[];
  created: Date;
  modified: Date;
}

export interface Faction {
  id: string;
  name: string;
  type: 'guild' | 'government' | 'religion' | 'criminal' | 'military' | 'merchant' | 'noble' | 'cult';
  description: string;
  goals: string[];
  resources: string[];
  territory: string[];
  allies: string[];
  enemies: string[];
  neutrals: string[];
  reputation: number;
  influence: number;
  secrecy: number;
  members: Array<{
    characterId: string;
    rank: string;
    loyalty: number;
    influence: number;
  }>;
  headquarters?: string;
  activities: string[];
  secrets: string[];
  hooks: string[];
  created: Date;
  modified: Date;
}

export interface Campaign {
  id: string;
  name: string;
  description: string;
  system: string;
  theme: string;
  genre: string;
  setting: string;
  startDate: Date;
  endDate?: Date;
  status: 'planning' | 'active' | 'paused' | 'completed' | 'cancelled';
  
  // Content
  characters: Character[];
  quests: Quest[];
  locations: Location[];
  factions: Faction[];
  scenes: Scene[];
  
  // Session management
  sessions: Array<{
    id: string;
    number: number;
    title: string;
    date: Date;
    duration: number;
    summary: string;
    events: string[];
    experience: number;
    treasure: string[];
    notes: string;
  }>;
  
  // Player management
  players: Array<{
    id: string;
    name: string;
    email: string;
    characterIds: string[];
    permissions: string[];
    notes: string;
  }>;
  
  // Timeline and events
  timeline: Array<{
    id: string;
    date: string;
    title: string;
    description: string;
    type: 'historical' | 'current' | 'future' | 'personal';
    importance: number;
    secret: boolean;
    consequences: string[];
  }>;
  
  // Campaign settings
  settings: {
    experienceType: 'milestone' | 'encounter' | 'session' | 'story';
    restingRules: 'standard' | 'gritty' | 'epic' | 'custom';
    magicAvailability: 'rare' | 'standard' | 'high' | 'ubiquitous';
    deathRules: 'standard' | 'brutal' | 'forgiving' | 'heroic';
    startingLevel: number;
    maxLevel: number;
    allowedBooks: string[];
    bannedContent: string[];
    houseRules: string[];
  };
  
  // Assets and resources
  assetCollections: string[];
  handouts: Array<{
    id: string;
    name: string;
    description: string;
    assetId: string;
    public: boolean;
    recipients: string[];
  }>;
  
  // Notes and planning
  notes: Array<{
    id: string;
    title: string;
    content: string;
    type: 'general' | 'plot' | 'character' | 'session' | 'rules';
    tags: string[];
    secret: boolean;
    created: Date;
    modified: Date;
  }>;
  
  // Metadata
  created: Date;
  modified: Date;
  version: string;
  author: string;
  collaborators: string[];
}

export interface CampaignTemplate {
  id: string;
  name: string;
  description: string;
  system: string;
  theme: string;
  estimatedSessions: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  
  // Template content
  characters: Partial<Character>[];
  quests: Partial<Quest>[];
  locations: Partial<Location>[];
  factions: Partial<Faction>[];
  scenes: Partial<Scene>[];
  
  // Setup instructions
  setupInstructions: string[];
  requiredAssets: string[];
  optionalAssets: string[];
  
  created: Date;
  author: string;
  tags: string[];
}

export class CampaignBuilder extends EventEmitter {
  private assetManager: AssetManager;
  private campaign!: Campaign;
  private templates = new Map<string, CampaignTemplate>();

  constructor(assetManager: AssetManager) {
    super();
    this.assetManager = assetManager;
  }

  // Campaign management
  createCampaign(
    name: string,
    system: string,
    description: string = '',
    templateId?: string
  ): Campaign {
    this.campaign = {
      id: this.generateId(),
      name,
      description,
      system,
      theme: '',
      genre: '',
      setting: '',
      startDate: new Date(),
      status: 'planning',
      
      characters: [],
      quests: [],
      locations: [],
      factions: [],
      scenes: [],
      sessions: [],
      players: [],
      timeline: [],
      
      settings: {
        experienceType: 'milestone',
        restingRules: 'standard',
        magicAvailability: 'standard',
        deathRules: 'standard',
        startingLevel: 1,
        maxLevel: 20,
        allowedBooks: [],
        bannedContent: [],
        houseRules: []
      },
      
      assetCollections: [],
      handouts: [],
      notes: [],
      
      created: new Date(),
      modified: new Date(),
      version: '1.0.0',
      author: '',
      collaborators: []
    };

    // Apply template if provided
    if (templateId) {
      const template = this.templates.get(templateId);
      if (template) {
        this.applyTemplate(template);
      }
    }

    this.emit('campaignCreated', this.campaign);
    return this.campaign;
  }

  loadCampaign(campaign: Campaign): void {
    this.campaign = { ...campaign };
    this.emit('campaignLoaded', this.campaign);
  }

  updateCampaign(updates: Partial<Campaign>): void {
    Object.assign(this.campaign, updates, { modified: new Date() });
    this.emit('campaignUpdated', this.campaign);
  }

  // Character management
  addCharacter(character: Omit<Character, 'id' | 'created' | 'modified'>): Character {
    const newCharacter: Character = {
      ...character,
      id: this.generateId(),
      created: new Date(),
      modified: new Date()
    };

    this.campaign.characters.push(newCharacter);
    this.updateCampaign({});
    this.emit('characterAdded', newCharacter);
    return newCharacter;
  }

  updateCharacter(characterId: string, updates: Partial<Character>): void {
    const character = this.campaign.characters.find(c => c.id === characterId);
    if (!character) return;

    Object.assign(character, updates, { modified: new Date() });
    this.updateCampaign({});
    this.emit('characterUpdated', character);
  }

  removeCharacter(characterId: string): void {
    const index = this.campaign.characters.findIndex(c => c.id === characterId);
    if (index === -1) return;

    const character = this.campaign.characters[index];
    this.campaign.characters.splice(index, 1);
    this.updateCampaign({});
    this.emit('characterRemoved', character);
  }

  // Quest management
  addQuest(quest: Omit<Quest, 'id' | 'created' | 'modified'>): Quest {
    const newQuest: Quest = {
      ...quest,
      id: this.generateId(),
      created: new Date(),
      modified: new Date()
    };

    this.campaign.quests.push(newQuest);
    this.updateCampaign({});
    this.emit('questAdded', newQuest);
    return newQuest;
  }

  updateQuestStatus(questId: string, status: Quest['status']): void {
    const quest = this.campaign.quests.find(q => q.id === questId);
    if (!quest) return;

    quest.status = status;
    quest.modified = new Date();
    this.updateCampaign({});
    this.emit('questStatusChanged', quest);
  }

  completeQuestObjective(questId: string, objectiveId: string): void {
    const quest = this.campaign.quests.find(q => q.id === questId);
    if (!quest) return;

    const objective = quest.objectives.find(o => o.id === objectiveId);
    if (!objective) return;

    objective.completed = true;
    quest.modified = new Date();

    // Check if all required objectives are complete
    const requiredObjectives = quest.objectives.filter(o => !o.optional);
    const completedRequired = requiredObjectives.filter(o => o.completed);
    
    if (completedRequired.length === requiredObjectives.length && quest.status === 'in_progress') {
      quest.status = 'completed';
    }

    this.updateCampaign({});
    this.emit('questObjectiveCompleted', quest, objective);
  }

  // Location management
  addLocation(location: Omit<Location, 'id' | 'created' | 'modified'>): Location {
    const newLocation: Location = {
      ...location,
      id: this.generateId(),
      created: new Date(),
      modified: new Date()
    };

    this.campaign.locations.push(newLocation);
    this.updateCampaign({});
    this.emit('locationAdded', newLocation);
    return newLocation;
  }

  connectLocations(
    locationId1: string,
    locationId2: string,
    distance: number,
    travelTime: string,
    method: string = 'road',
    difficulty: string = 'easy'
  ): void {
    const location1 = this.campaign.locations.find(l => l.id === locationId1);
    const location2 = this.campaign.locations.find(l => l.id === locationId2);
    
    if (!location1 || !location2) return;

    // Add connection from location1 to location2
    location1.connections.push({
      locationId: locationId2,
      distance,
      travelTime,
      method,
      difficulty
    });

    // Add reverse connection
    location2.connections.push({
      locationId: locationId1,
      distance,
      travelTime,
      method,
      difficulty
    });

    this.updateCampaign({});
    this.emit('locationsConnected', location1, location2);
  }

  // Faction management
  addFaction(faction: Omit<Faction, 'id' | 'created' | 'modified'>): Faction {
    const newFaction: Faction = {
      ...faction,
      id: this.generateId(),
      created: new Date(),
      modified: new Date()
    };

    this.campaign.factions.push(newFaction);
    this.updateCampaign({});
    this.emit('factionAdded', newFaction);
    return newFaction;
  }

  setFactionRelationship(
    factionId1: string,
    factionId2: string,
    relationship: 'ally' | 'enemy' | 'neutral'
  ): void {
    const faction1 = this.campaign.factions.find(f => f.id === factionId1);
    const faction2 = this.campaign.factions.find(f => f.id === factionId2);
    
    if (!faction1 || !faction2) return;

    // Remove existing relationships
    faction1.allies = faction1.allies.filter(id => id !== factionId2);
    faction1.enemies = faction1.enemies.filter(id => id !== factionId2);
    faction1.neutrals = faction1.neutrals.filter(id => id !== factionId2);
    
    faction2.allies = faction2.allies.filter(id => id !== factionId1);
    faction2.enemies = faction2.enemies.filter(id => id !== factionId1);
    faction2.neutrals = faction2.neutrals.filter(id => id !== factionId1);

    // Add new relationship
    if (relationship === 'ally') {
      faction1.allies.push(factionId2);
      faction2.allies.push(factionId1);
    } else if (relationship === 'enemy') {
      faction1.enemies.push(factionId2);
      faction2.enemies.push(factionId1);
    } else {
      faction1.neutrals.push(factionId2);
      faction2.neutrals.push(factionId1);
    }

    this.updateCampaign({});
    this.emit('factionRelationshipChanged', faction1, faction2, relationship);
  }

  // Session management
  addSession(
    title: string,
    date: Date,
    summary: string = '',
    duration: number = 0
  ): void {
    const session = {
      id: this.generateId(),
      number: this.campaign.sessions.length + 1,
      title,
      date,
      duration,
      summary,
      events: [],
      experience: 0,
      treasure: [],
      notes: ''
    };

    this.campaign.sessions.push(session);
    this.updateCampaign({});
    this.emit('sessionAdded', session);
  }

  // Timeline management
  addTimelineEvent(
    date: string,
    title: string,
    description: string,
    type: 'historical' | 'current' | 'future' | 'personal' = 'current',
    importance: number = 1
  ): void {
    const event = {
      id: this.generateId(),
      date,
      title,
      description,
      type,
      importance,
      secret: false,
      consequences: []
    };

    this.campaign.timeline.push(event);
    this.campaign.timeline.sort((_a, _b) => a.date.localeCompare(b.date));
    this.updateCampaign({});
    this.emit('timelineEventAdded', event);
  }

  // Note management
  addNote(
    title: string,
    content: string,
    type: 'general' | 'plot' | 'character' | 'session' | 'rules' = 'general',
    tags: string[] = []
  ): void {
    const note = {
      id: this.generateId(),
      title,
      content,
      type,
      tags,
      secret: false,
      created: new Date(),
      modified: new Date()
    };

    this.campaign.notes.push(note);
    this.updateCampaign({});
    this.emit('noteAdded', note);
  }

  // Asset integration
  async addHandout(
    name: string,
    description: string,
    assetId: string,
    isPublic: boolean = true,
    recipients: string[] = []
  ): Promise<void> {
    const asset = this.assetManager.getAsset(assetId);
    if (!asset) {
      throw new Error(`Asset not found: ${assetId}`);
    }

    const handout = {
      id: this.generateId(),
      name,
      description,
      assetId,
      public: isPublic,
      recipients
    };

    this.campaign.handouts.push(handout);
    this.updateCampaign({});
    this.emit('handoutAdded', handout);
  }

  // Template system
  saveAsTemplate(
    name: string,
    description: string,
    includeCharacters: boolean = true,
    includeQuests: boolean = true,
    includeLocations: boolean = true,
    includeFactions: boolean = true
  ): CampaignTemplate {
    const template: CampaignTemplate = {
      id: this.generateId(),
      name,
      description,
      system: this.campaign.system,
      theme: this.campaign.theme,
      estimatedSessions: this.campaign.sessions.length || 10,
      difficulty: 'intermediate',
      
      characters: includeCharacters ? this.campaign.characters.map(this.sanitizeForTemplate) : [],
      quests: includeQuests ? this.campaign.quests.map(this.sanitizeForTemplate) : [],
      locations: includeLocations ? this.campaign.locations.map(this.sanitizeForTemplate) : [],
      factions: includeFactions ? this.campaign.factions.map(this.sanitizeForTemplate) : [],
      scenes: [],
      
      setupInstructions: [],
      requiredAssets: [],
      optionalAssets: [],
      
      created: new Date(),
      author: this.campaign.author,
      tags: []
    };

    this.templates.set(template.id, template);
    this.emit('templateCreated', template);
    return template;
  }

  private applyTemplate(template: CampaignTemplate): void {
    this.campaign.theme = template.theme;
    this.campaign.system = template.system;
    
    // Apply template content
    template.characters.forEach(char => {
      if (char.name) {
        this.addCharacter(char as any);
      }
    });
    
    template.quests.forEach(quest => {
      if (quest.title) {
        this.addQuest(quest as any);
      }
    });
    
    template.locations.forEach(location => {
      if (location.name) {
        this.addLocation(location as any);
      }
    });
    
    template.factions.forEach(faction => {
      if (faction.name) {
        this.addFaction(faction as any);
      }
    });
  }

  private sanitizeForTemplate(item: any): any {
    const sanitized = { ...item };
    delete sanitized.id;
    delete sanitized.created;
    delete sanitized.modified;
    return sanitized;
  }

  // Export and analysis
  exportCampaign(): Campaign {
    return { ...this.campaign };
  }

  generateCampaignReport(): {
    overview: any;
    characters: any;
    quests: any;
    locations: any;
    factions: any;
    sessions: any;
    timeline: any;
  } {
    return {
      overview: {
        name: this.campaign.name,
        system: this.campaign.system,
        status: this.campaign.status,
        totalSessions: this.campaign.sessions.length,
        totalCharacters: this.campaign.characters.length,
        totalQuests: this.campaign.quests.length,
        totalLocations: this.campaign.locations.length,
        totalFactions: this.campaign.factions.length,
        created: this.campaign.created,
        lastModified: this.campaign.modified
      },
      characters: {
        total: this.campaign.characters.length,
        byType: this.groupBy(this.campaign.characters, 'type'),
        byLevel: this.groupBy(this.campaign.characters, 'level'),
        byClass: this.groupBy(this.campaign.characters, 'class')
      },
      quests: {
        total: this.campaign.quests.length,
        byStatus: this.groupBy(this.campaign.quests, 'status'),
        byType: this.groupBy(this.campaign.quests, 'type'),
        completionRate: this.campaign.quests.length > 0 ? 
          this.campaign.quests.filter(q => q.status === 'completed').length / this.campaign.quests.length : 0
      },
      locations: {
        total: this.campaign.locations.length,
        byType: this.groupBy(this.campaign.locations, 'type'),
        connections: this.campaign.locations.reduce((_sum, _loc) => sum + loc.connections.length, 0) / 2
      },
      factions: {
        total: this.campaign.factions.length,
        byType: this.groupBy(this.campaign.factions, 'type'),
        relationships: {
          allies: this.campaign.factions.reduce((_sum, _f) => sum + f.allies.length, 0) / 2,
          enemies: this.campaign.factions.reduce((_sum, _f) => sum + f.enemies.length, 0) / 2,
          neutral: this.campaign.factions.reduce((_sum, _f) => sum + f.neutrals.length, 0) / 2
        }
      },
      sessions: {
        total: this.campaign.sessions.length,
        totalDuration: this.campaign.sessions.reduce((_sum, _s) => sum + s.duration, 0),
        averageDuration: this.campaign.sessions.length > 0 ? 
          this.campaign.sessions.reduce((_sum, _s) => sum + s.duration, 0) / this.campaign.sessions.length : 0
      },
      timeline: {
        total: this.campaign.timeline.length,
        byType: this.groupBy(this.campaign.timeline, 'type'),
        byImportance: this.groupBy(this.campaign.timeline, 'importance')
      }
    };
  }

  private groupBy(array: any[], key: string): Record<string, number> {
    return array.reduce((acc, item) => {
      const value = item[key]?.toString() || 'unknown';
      acc[value] = (acc[value] || 0) + 1;
      return acc;
    }, {});
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  // Getters
  getCampaign(): Campaign {
    return this.campaign;
  }

  getTemplates(): CampaignTemplate[] {
    return Array.from(this.templates.values());
  }
}
