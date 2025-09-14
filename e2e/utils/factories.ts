import { testDb } from "./database";

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
  kind: "PC" | "NPC" | "MONSTER";
  userId: string;
  campaignId: string;
  currentHp: number;
  maxHp: number;
  ac: number;
  initiative: number;
}

export class TestDataFactory {
  private async getDb(): Promise<any> {
    return await testDb.getClient();
  }

  constructor() {}

  async createUser(overrides: Record<string, any> = {}): Promise<TestUser> {
    const username = (overrides as any).username ?? `user-${Date.now()}`;
    const email = (overrides as any).email ?? `user-${Date.now()}@test.com`;
    const displayName = (overrides as any).displayName ?? username;
    const userData = {
      email,
      username,
      displayName,
      passwordHash: "hashedpassword",
      ...overrides,
    };

    const db = await this.getDb();
    const user = await db.user.create({
      data: userData,
    });

    // Ensure TestUser shape for caller (include displayName for UI/auth mocks)
    return {
      ...user,
      displayName: (overrides as any).displayName ?? user.username,
    } as TestUser;
  }

  async createGMUser(overrides: Record<string, any> = {}): Promise<TestUser> {
    return this.createUser({
      email: `gm-${Date.now()}@test.com`,
      username: `gm-${Date.now()}`,
      ...overrides,
    });
  }

  async createPlayerUser(overrides: Record<string, any> = {}): Promise<TestUser> {
    return this.createUser({
      email: `player-${Date.now()}@test.com`,
      username: `player-${Date.now()}`,
      ...overrides,
    });
  }

  async createMap(overrides: Partial<any> = {}) {
    const mapData = {
      name: "Test Map",
      widthPx: 1000,
      heightPx: 800,
      gridSizePx: 50,
      ...overrides,
    };

    const db = await this.getDb();
    return db.map.create({
      data: mapData,
    });
  }

  async createCampaign(overrides: Partial<TestCampaign> = {}): Promise<TestCampaign> {
    const db = await this.getDb();
    const name = overrides.name ?? "Test Campaign";
    // Create campaign with settings that carry description/gameSystem/isActive
    const created = await db.campaign.create({
      data: {
        name,
        settings: {
          create: {
            description: (overrides as any).description ?? "A test campaign for e2e testing",
            gameSystem: (overrides as any).gameSystem ?? "dnd5e",
            isActive: (overrides as any).isActive ?? true,
          },
        },
      },
    });

    // Return a TestCampaign shape for tests
    return {
      id: created.id,
      name,
      description: (overrides as any).description ?? "A test campaign for e2e testing",
      gameSystem: (overrides as any).gameSystem ?? "dnd5e",
      isActive: (overrides as any).isActive ?? true,
    } as TestCampaign;
  }

  async createCampaignMember(userId: string, campaignId: string, role: string = "player") {
    const db = await this.getDb();
    return db.campaignMember.create({
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
      name: "Test Scene",
      campaignId,
      mapId: map.id,
      ...overrides,
    };

    const db = await this.getDb();
    const scene = await db.scene.create({
      data: sceneData,
    });

    return scene;
  }

  async createActor(
    userId: string,
    campaignId: string,
    overrides: Record<string, any> = {},
  ): Promise<TestActor> {
    const db = await this.getDb();
    const name = (overrides as any).name ?? "Test Character";
    // Create Character and link to Campaign via CampaignCharacter
    const character = await db.character.create({
      data: {
        name,
        sheet: {},
        prompt: "",
        provider: "local",
        model: "test",
        latencyMs: 0,
      },
    });

    await db.campaignCharacter.create({
      data: {
        campaignId,
        characterId: character.id,
        addedBy: userId,
        role: (overrides as any).kind === "NPC" ? "npc" : "player",
      },
    });

    // Return a TestActor-shaped object for compatibility
    return {
      id: character.id,
      name,
      kind: ((overrides as any).kind as any) ?? "PC",
      userId,
      campaignId,
      currentHp: (overrides as any).currentHp ?? 25,
      maxHp: (overrides as any).maxHp ?? 25,
      ac: (overrides as any).ac ?? 15,
      initiative: (overrides as any).initiative ?? 12,
    } as TestActor;
  }

  async createToken(sceneId: string, actorId?: string, overrides: Partial<any> = {}) {
    const db = await this.getDb();

    // Ensure we have a session for this scene's campaign
    const scene = await db.scene.findUnique({ where: { id: sceneId } });
    if (!scene) { throw new Error(`Scene not found: ${sceneId}`); }

    let session = await db.gameSession.findFirst({
      where: { campaignId: scene.campaignId, status: { in: ["ACTIVE", "WAITING"] } },
      orderBy: { createdAt: "desc" },
    });

    if (!session) {
      session = await db.gameSession.create({
        data: {
          name: `Session ${new Date().toISOString()}`,
          campaignId: scene.campaignId,
          status: "WAITING",
          currentSceneId: sceneId,
        },
      });
    }

    const name = (overrides as any).name ?? "Test Token";
    const x = (overrides as any).x ?? 100;
    const y = (overrides as any).y ?? 100;
    const width = (overrides as any).width ?? 1;
    const height = (overrides as any).height ?? 1;
    const disposition = (overrides as any).disposition ?? "FRIENDLY";
    const isVisible = (overrides as any).isVisible ?? true;

    return db.token.create({
      data: {
        name,
        sceneId,
        gameSessionId: session.id,
        characterId: actorId,
        x,
        y,
        type: actorId ? "PC" : "NPC",
        visibility: isVisible ? "VISIBLE" : "HIDDEN",
        metadata: {
          width,
          height,
          disposition,
        },
      },
    });
  }

  async createEncounter(campaignId: string, overrides: Partial<any> = {}) {
    const db = await this.getDb();
    // Resolve or create a session to attach the encounter
    let session = await db.gameSession.findFirst({
      where: { campaignId, status: { in: ["ACTIVE", "WAITING"] } },
      orderBy: { createdAt: "desc" },
    });
    if (!session) {
      // Create a minimal session without scene if needed
      session = await db.gameSession.create({
        data: {
          name: `Session ${new Date().toISOString()}`,
          campaignId,
          status: "WAITING",
        },
      });
    }

    return db.encounter.create({
      data: {
        name: (overrides as any).name ?? "Test Encounter",
        gameSessionId: session.id,
        sceneId: session.currentSceneId,
        status: (overrides as any).isActive ? "ACTIVE" : "PLANNED",
        initiativeOrder: null,
      },
    });
  }

  async createEncounterParticipant(encounterId: string, actorId: string, initiative: number = 10) {
    const db = await this.getDb();
    // Find a token associated with the character (actorId)
    const token = await db.token.findFirst({ where: { characterId: actorId } });
    if (!token) { throw new Error(`No token found for character ${actorId}`); }

    return db.encounterToken.create({
      data: {
        encounterId,
        tokenId: token.id,
        initiative,
        turnOrder: null,
        isActive: true,
      },
    });
  }

  async createAsset(mapId?: string, overrides: Partial<any> = {}) {
    const db = await this.getDb();

    // Only allow fields that exist in the Prisma schema for Asset
    const allowed = {
      kind: (overrides as any).kind ?? "ORIGINAL",
      uri: (overrides as any).uri ?? "test://asset.png",
      mimeType: (overrides as any).mimeType ?? "image/png",
      width: (overrides as any).width ?? 256,
      height: (overrides as any).height ?? 256,
      sizeBytes: (overrides as any).sizeBytes ?? 1024,
      checksum: (overrides as any).checksum ?? "test-checksum",
    } as any;

    const data: any = { ...allowed };
    if (mapId) {
      data.map = { connect: { id: mapId } };
    }

    return db.asset.create({ data });
  }

  // Composite factory methods for common scenarios
  async createCompleteGameSession() {
    // Create users
    const gm = await this.createGMUser();
    const player1 = await this.createPlayerUser({ displayName: "Player 1" });
    const player2 = await this.createPlayerUser({ displayName: "Player 2" });

    // Create campaign
    const campaign = await this.createCampaign();

    // Add members to campaign
    await this.createCampaignMember(gm.id, campaign.id, "gm");
    await this.createCampaignMember(player1.id, campaign.id, "player");
    await this.createCampaignMember(player2.id, campaign.id, "player");

    // Create scene
    const scene = await this.createScene(campaign.id);

    // Create a session linked to this campaign/scene
    const db = await this.getDb();
    const session = await db.gameSession.create({
      data: {
        name: `Session ${new Date().toISOString()}`,
        campaignId: campaign.id,
        status: "WAITING",
        currentSceneId: scene.id,
      },
    });

    // Create actors
    const gmActor = await this.createActor(gm.id, campaign.id, {
      name: "GM Character",
      kind: "NPC",
    });
    const player1Actor = await this.createActor(player1.id, campaign.id, {
      name: "Player 1 Character",
    });
    const player2Actor = await this.createActor(player2.id, campaign.id, {
      name: "Player 2 Character",
    });

    // Create tokens
    const gmToken = await this.createToken(scene.id, gmActor.id, {
      name: "GM Token",
      x: 200,
      y: 200,
    });
    const player1Token = await this.createToken(scene.id, player1Actor.id, {
      name: "Player 1 Token",
      x: 150,
      y: 150,
    });
    const player2Token = await this.createToken(scene.id, player2Actor.id, {
      name: "Player 2 Token",
      x: 250,
      y: 150,
    });

    // Create encounter
    const encounter = await this.createEncounter(campaign.id, {
      name: "Test Combat",
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

    await this.createCampaignMember(gm.id, campaign.id, "gm");
    await this.createCampaignMember(player.id, campaign.id, "player");

    const scene = await this.createScene(campaign.id);
    const db = await this.getDb();
    await db.gameSession.create({
      data: {
        name: `Session ${new Date().toISOString()}`,
        campaignId: campaign.id,
        status: "WAITING",
        currentSceneId: scene.id,
      },
    });
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
export const factory = _factory;
export default _factory;
