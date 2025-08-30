import { PrismaClient } from '@prisma/client';
import { testDb } from './database';

export interface TestUser {
  id: string;
  displayName: string;
}

export interface TestCampaign {
  id: string;
  name: string;
  description: string;
  gameSystem: string;
  isActive: boolean;
}

export interface TestScene {
  id: string;
  name: string;
  campaignId: string;
  mapId: string | null;
}

export interface TestActor {
  id: string;
  name: string;
  kind: 'PC' | 'NPC' | 'MONSTER';
  userId: string;
  campaignId: string;
  currentHp: number;
  maxHp: number;
  ac: number;
  initiative: number;
}

export class TestDataFactory {
  private get db(): PrismaClient {
    return testDb.getClient();
  }

  constructor() {}

  async createUser(overrides: Partial<TestUser> = {}): Promise<TestUser> {
    const userData = {
      displayName: 'Test User',
      ...overrides,
    };

    const user = await this.db.user.create({
      data: userData,
    });

    return user;
  }

  async createGMUser(overrides: Partial<TestUser> = {}): Promise<TestUser> {
    return this.createUser({
      displayName: 'Test GM',
      ...overrides,
    });
  }

  async createPlayerUser(overrides: Partial<TestUser> = {}): Promise<TestUser> {
    return this.createUser({
      displayName: 'Test Player',
      ...overrides,
    });
  }

  async createMap(overrides: Partial<any> = {}) {
    const mapData = {
      name: 'Test Map',
      widthPx: 1000,
      heightPx: 800,
      gridSizePx: 50,
      ...overrides,
    };

    return this.db.map.create({
      data: mapData,
    });
  }

  async createCampaign(overrides: Partial<TestCampaign> = {}): Promise<TestCampaign> {
    const campaignData = {
      name: 'Test Campaign',
      description: 'A test campaign for e2e testing',
      gameSystem: 'dnd5e',
      isActive: true,
      ...overrides,
    };

    const campaign = await this.db.campaign.create({
      data: campaignData,
    });

    return campaign;
  }

  async createCampaignMember(userId: string, campaignId: string, role: string = 'player') {
    return this.db.campaignMember.create({
      data: {
        userId,
        campaignId,
        role,
      },
    });
  }

  async createScene(campaignId: string, overrides: Partial<TestScene> = {}): Promise<TestScene> {
    const map = await this.createMap();
    
    const sceneData = {
      name: 'Test Scene',
      campaignId,
      mapId: map.id,
      gridSettings: '{"size": 50, "type": "square"}',
      lightingSettings: '{"globalLight": true}',
      fogSettings: '{"enabled": false}',
      ...overrides,
    };

    const scene = await this.db.scene.create({
      data: sceneData,
    });

    return scene;
  }

  async createActor(userId: string, campaignId: string, overrides: Partial<TestActor> = {}): Promise<TestActor> {
    const actorData = {
      name: 'Test Character',
      kind: 'PC' as const,
      userId,
      campaignId,
      currentHp: 25,
      maxHp: 25,
      ac: 15,
      initiative: 12,
      ...overrides,
    };

    const actor = await this.db.actor.create({
      data: actorData,
    });

    return actor;
  }

  async createToken(sceneId: string, actorId?: string, overrides: Partial<any> = {}) {
    const tokenData = {
      name: 'Test Token',
      sceneId,
      actorId,
      x: 100,
      y: 100,
      width: 1,
      height: 1,
      disposition: 'FRIENDLY' as const,
      isVisible: true,
      ...overrides,
    };

    return this.db.token.create({
      data: tokenData,
    });
  }

  async createEncounter(campaignId: string, overrides: Partial<any> = {}) {
    const encounterData = {
      name: 'Test Encounter',
      description: 'A test encounter',
      campaignId,
      currentRound: 0,
      currentTurn: 0,
      isActive: false,
      ...overrides,
    };

    return this.db.encounter.create({
      data: encounterData,
    });
  }

  async createEncounterParticipant(encounterId: string, actorId: string, initiative: number = 10) {
    return this.db.encounterParticipant.create({
      data: {
        encounterId,
        actorId,
        initiative,
        isActive: true,
        hasActed: false,
      },
    });
  }

  async createAsset(mapId?: string, overrides: Partial<any> = {}) {
    const assetData = {
      mapId,
      kind: 'ORIGINAL' as const,
      uri: 'test://asset.png',
      mimeType: 'image/png',
      width: 256,
      height: 256,
      sizeBytes: 1024,
      checksum: 'test-checksum',
      ...overrides,
    };

    return this.db.asset.create({
      data: assetData,
    });
  }

  // Composite factory methods for common scenarios
  async createCompleteGameSession() {
    // Create users
    const gm = await this.createGMUser();
    const player1 = await this.createPlayerUser({ displayName: 'Player 1' });
    const player2 = await this.createPlayerUser({ displayName: 'Player 2' });

    // Create campaign
    const campaign = await this.createCampaign();

    // Add members to campaign
    await this.createCampaignMember(gm.id, campaign.id, 'gm');
    await this.createCampaignMember(player1.id, campaign.id, 'player');
    await this.createCampaignMember(player2.id, campaign.id, 'player');

    // Create scene
    const scene = await this.createScene(campaign.id);

    // Create actors
    const gmActor = await this.createActor(gm.id, campaign.id, {
      name: 'GM Character',
      kind: 'NPC',
    });
    const player1Actor = await this.createActor(player1.id, campaign.id, {
      name: 'Player 1 Character',
    });
    const player2Actor = await this.createActor(player2.id, campaign.id, {
      name: 'Player 2 Character',
    });

    // Create tokens
    const gmToken = await this.createToken(scene.id, gmActor.id, {
      name: 'GM Token',
      x: 200,
      y: 200,
    });
    const player1Token = await this.createToken(scene.id, player1Actor.id, {
      name: 'Player 1 Token',
      x: 150,
      y: 150,
    });
    const player2Token = await this.createToken(scene.id, player2Actor.id, {
      name: 'Player 2 Token',
      x: 250,
      y: 150,
    });

    // Create encounter
    const encounter = await this.createEncounter(campaign.id, {
      name: 'Test Combat',
      isActive: true,
    });

    // Add participants to encounter
    await this.createEncounterParticipant(encounter.id, gmActor.id, 15);
    await this.createEncounterParticipant(encounter.id, player1Actor.id, 12);
    await this.createEncounterParticipant(encounter.id, player2Actor.id, 8);

    return {
      users: { gm, player1, player2 },
      campaign,
      scene,
      actors: { gmActor, player1Actor, player2Actor },
      tokens: { gmToken, player1Token, player2Token },
      encounter,
    };
  }

  async createMinimalGameSession() {
    const gm = await this.createGMUser();
    const player = await this.createPlayerUser();
    const campaign = await this.createCampaign();
    
    await this.createCampaignMember(gm.id, campaign.id, 'gm');
    await this.createCampaignMember(player.id, campaign.id, 'player');
    
    const scene = await this.createScene(campaign.id);
    const actor = await this.createActor(player.id, campaign.id);
    const token = await this.createToken(scene.id, actor.id);

    return {
      users: { gm, player },
      campaign,
      scene,
      actor,
      token,
    };
  }
}

export const _factory = new TestDataFactory();
