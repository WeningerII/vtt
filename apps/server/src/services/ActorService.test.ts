import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from "vitest";
import { ActorService, type ActorSearchOptions, type CreateActorRequest } from "./ActorService";
import {
  PrismaClient,
  Prisma,
  TokenType,
  TokenVisibility,
  type Token,
  type Monster,
  type Character,
} from "@prisma/client";

type TokenWithSession = Token & { gameSession?: { campaignId: string } };

type TokenFindManyArgs = Prisma.TokenFindManyArgs;
type TokenFindUniqueArgs = Prisma.TokenFindUniqueArgs;
type TokenCreateArgs = Prisma.TokenCreateArgs;
type TokenUpdateArgs = Prisma.TokenUpdateArgs;
type TokenDeleteArgs = Prisma.TokenDeleteArgs;
type TokenCountArgs = Prisma.TokenCountArgs;
type TokenGroupByArgs = Prisma.TokenGroupByArgs;
type MonsterFindUniqueArgs = Prisma.MonsterFindUniqueArgs;
type CharacterFindUniqueArgs = Prisma.CharacterFindUniqueArgs;

interface PrismaTokenMock {
  findMany: Mock<[args?: TokenFindManyArgs], Promise<TokenWithSession[]>>;
  findUnique: Mock<[args: TokenFindUniqueArgs], Promise<TokenWithSession | null>>;
  create: Mock<[args: TokenCreateArgs], Promise<TokenWithSession>>;
  update: Mock<[args: TokenUpdateArgs], Promise<TokenWithSession>>;
  delete: Mock<[args: TokenDeleteArgs], Promise<TokenWithSession>>;
  count: Mock<[args?: TokenCountArgs], Promise<number>>;
  groupBy: Mock<
    [args: TokenGroupByArgs],
    Promise<Array<{ type: TokenType | null; _count: { _all: number } }>>
  >;
}

interface PrismaMonsterMock {
  findUnique: Mock<[args: MonsterFindUniqueArgs], Promise<Monster | null>>;
}

interface PrismaCharacterMock {
  findUnique: Mock<[args: CharacterFindUniqueArgs], Promise<Character | null>>;
}

interface PrismaMock {
  token: PrismaTokenMock;
  monster: PrismaMonsterMock;
  character: PrismaCharacterMock;
}

const sampleToken = (overrides: Partial<TokenWithSession> = {}): TokenWithSession => ({
  id: "token-id",
  name: "Sample Token",
  type: TokenType.NPC,
  visibility: TokenVisibility.VISIBLE,
  gameSessionId: "session-1",
  sceneId: null,
  characterId: null,
  x: 0,
  y: 0,
  z: 0,
  rotation: 0,
  scale: 1,
  health: 10,
  maxHealth: 10,
  initiative: 0,
  speed: 30,
  imageUrl: null,
  metadata: null,
  createdAt: new Date("2024-01-01T00:00:00Z"),
  updatedAt: new Date("2024-01-01T00:00:00Z"),
  gameSession: { campaignId: "campaign-123" },
  ...overrides,
});

const sampleMonster = (overrides: Partial<Monster> = {}): Monster => ({
  id: "monster-1",
  stableId: "stable-monster",
  name: "Goblin",
  statblock: {},
  tags: [],
  createdAt: new Date("2024-01-01T00:00:00Z"),
  updatedAt: new Date("2024-01-01T00:00:00Z"),
  ...overrides,
});

const sampleCharacter = (overrides: Partial<Character> = {}): Character => ({
  id: "character-1",
  name: "Hero",
  sheet: {},
  prompt: "",
  provider: "provider",
  model: "model",
  cost: 0,
  latencyMs: 0,
  createdAt: new Date("2024-01-01T00:00:00Z"),
  ...overrides,
});

const createMockPrisma = (): PrismaMock => {
  const findMany = vi.fn<[args?: TokenFindManyArgs], Promise<TokenWithSession[]>>(() =>
    Promise.resolve([]),
  );
  const findUnique = vi.fn<[args: TokenFindUniqueArgs], Promise<TokenWithSession | null>>(() =>
    Promise.resolve(null),
  );
  const create = vi.fn<[args: TokenCreateArgs], Promise<TokenWithSession>>((args) =>
    Promise.resolve({
      ...sampleToken(),
      ...(args.data as TokenWithSession),
    }),
  );
  const update = vi.fn<[args: TokenUpdateArgs], Promise<TokenWithSession>>((args) =>
    Promise.resolve({
      ...sampleToken({ id: String(args.where.id) }),
      ...(args.data as TokenWithSession),
    }),
  );
  const remove = vi.fn<[args: TokenDeleteArgs], Promise<TokenWithSession>>((args) =>
    Promise.resolve(sampleToken({ id: String(args.where.id) })),
  );
  const count = vi.fn<[args?: TokenCountArgs], Promise<number>>(() => Promise.resolve(0));
  const groupBy = vi.fn<
    [args: TokenGroupByArgs],
    Promise<Array<{ type: TokenType | null; _count: { _all: number } }>>
  >(() => Promise.resolve([]));

  const monsterFindUnique = vi.fn<[args: MonsterFindUniqueArgs], Promise<Monster | null>>(() =>
    Promise.resolve(null),
  );
  const characterFindUnique = vi.fn<[args: CharacterFindUniqueArgs], Promise<Character | null>>(
    () => Promise.resolve(null),
  );

  return {
    token: {
      findMany,
      findUnique,
      create,
      update,
      delete: remove,
      count,
      groupBy,
    },
    monster: {
      findUnique: monsterFindUnique,
    },
    character: {
      findUnique: characterFindUnique,
    },
  };
};

describe("ActorService", () => {
  let service: ActorService;
  let prisma: PrismaMock;

  const campaignId = "campaign-123";
  const tokenId = "token-456";
  const monsterId = "monster-789";
  const characterId = "character-999";

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new ActorService(prisma as unknown as PrismaClient);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("searchActors", () => {
    it("returns tokens with default pagination", async () => {
      const tokens = [sampleToken({ id: "token-1" }), sampleToken({ id: "token-2" })];

      prisma.token.findMany.mockResolvedValue(tokens);
      prisma.token.count.mockResolvedValue(2);

      const options: ActorSearchOptions = { campaignId };
      const result = await service.searchActors(options);

      expect(result).toEqual({ items: tokens, total: 2, limit: 50, offset: 0 });
      expect(prisma.token.findMany).toHaveBeenCalledWith({
        where: {
          gameSession: { campaignId },
        },
        skip: 0,
        take: 50,
        orderBy: { name: "asc" },
      });
    });

    it("applies kind filter and limit cap", async () => {
      prisma.token.findMany.mockResolvedValue([]);
      prisma.token.count.mockResolvedValue(0);

      await service.searchActors({ campaignId, kind: "PC", limit: 500, offset: 10 });

      expect(prisma.token.findMany).toHaveBeenCalledWith({
        where: {
          gameSession: { campaignId },
          type: "PC",
        },
        skip: 10,
        take: 200,
        orderBy: { name: "asc" },
      });
    });
  });

  describe("getActor", () => {
    it("returns token when found", async () => {
      const token = sampleToken({ id: tokenId });
      prisma.token.findUnique.mockResolvedValue(token);

      const result = await service.getActor(tokenId);

      expect(result).toEqual(token);
      expect(prisma.token.findUnique).toHaveBeenCalledWith({
        where: { id: tokenId },
        include: { gameSession: true },
      });
    });

    it("returns null when not found", async () => {
      prisma.token.findUnique.mockResolvedValue(null);

      const result = await service.getActor("missing");

      expect(result).toBeNull();
    });
  });

  describe("createActor", () => {
    it("creates token with defaults", async () => {
      const created = sampleToken({ id: tokenId });
      prisma.token.create.mockResolvedValue(created);

      const request: CreateActorRequest = {
        name: "NPC",
        kind: "NPC",
        campaignId,
        userId: "user-1",
      };

      const result = await service.createActor(request);

      expect(result).toEqual(created);
      expect(prisma.token.create).toHaveBeenCalledWith({
        data: {
          name: "NPC",
          type: "NPC",
          gameSessionId: "default-session",
          characterId: undefined,
          health: 0,
          maxHealth: 0,
          initiative: 0,
        },
        include: { gameSession: true },
      });
    });

    it("validates monster reference", async () => {
      prisma.monster.findUnique.mockResolvedValue(sampleMonster({ id: monsterId }));
      prisma.token.create.mockResolvedValue(sampleToken());

      await service.createActor({
        name: "Goblin",
        kind: "MONSTER",
        campaignId,
        userId: "user-1",
        monsterId,
      });

      expect(prisma.monster.findUnique).toHaveBeenCalledWith({ where: { id: monsterId } });
    });

    it("throws when monster reference missing", async () => {
      prisma.monster.findUnique.mockResolvedValue(null);

      await expect(
        service.createActor({
          name: "Bad Goblin",
          kind: "MONSTER",
          campaignId,
          userId: "user-1",
          monsterId,
        }),
      ).rejects.toThrow("Monster not found");
    });

    it("validates character reference", async () => {
      prisma.character.findUnique.mockResolvedValue(sampleCharacter({ id: characterId }));

      await service.createActor({
        name: "Hero",
        kind: "PC",
        campaignId,
        userId: "user-1",
        characterId,
      });

      expect(prisma.character.findUnique).toHaveBeenCalledWith({ where: { id: characterId } });
    });
  });

  describe("createActorFromMonster", () => {
    it("creates token using monster statblock", async () => {
      const monster = sampleMonster({
        id: monsterId,
        statblock: { hp: { average: 12 }, ac: { value: 15 } },
      });

      prisma.monster.findUnique.mockResolvedValue(monster);
      prisma.token.create.mockResolvedValue(sampleToken({ id: tokenId }));

      await service.createActorFromMonster(monsterId, campaignId, "user-1", "Goblin Scout");

      expect(prisma.token.create).toHaveBeenCalledWith({
        data: {
          name: "Goblin Scout",
          type: "NPC",
          gameSessionId: "default-session",
          health: 12,
          maxHealth: 12,
          initiative: 0,
        },
        include: { gameSession: true },
      });
    });
  });

  describe("update and delete", () => {
    it("updates token fields", async () => {
      prisma.token.update.mockResolvedValue(sampleToken({ id: tokenId }));

      await service.updateActor(tokenId, {
        name: "Updated",
        currentHp: 5,
        maxHp: 8,
        initiative: 4,
      });

      expect(prisma.token.update).toHaveBeenCalledWith({
        where: { id: tokenId },
        data: {
          name: "Updated",
          health: 5,
          maxHealth: 8,
          initiative: 4,
        },
        include: { gameSession: true },
      });
    });

    it("deletes token by id", async () => {
      prisma.token.delete.mockResolvedValue(sampleToken({ id: tokenId }));

      await service.deleteActor(tokenId);

      expect(prisma.token.delete).toHaveBeenCalledWith({ where: { id: tokenId } });
    });
  });

  describe("health helpers", () => {
    it("heals without exceeding max", async () => {
      prisma.token.findUnique.mockResolvedValue(sampleToken({ health: 5, maxHealth: 8 }));
      prisma.token.update.mockResolvedValue(sampleToken({ health: 8, maxHealth: 8 }));

      await service.healActor(tokenId, 10);

      expect(prisma.token.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { health: 8 } }),
      );
    });

    it("applies damage and clamps to zero", async () => {
      prisma.token.findUnique.mockResolvedValue(sampleToken({ health: 5, maxHealth: 10 }));
      prisma.token.update.mockResolvedValue(sampleToken({ health: 0 }));

      await service.damageActor(tokenId, 7);

      expect(prisma.token.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { health: 0 } }),
      );
    });

    it("attempts to set temp HP (no-op in current model)", async () => {
      prisma.token.findUnique.mockResolvedValue(sampleToken());
      prisma.token.update.mockResolvedValue(sampleToken());

      await service.addTempHp(tokenId, 6);

      expect(prisma.token.update).toHaveBeenCalledWith(expect.objectContaining({ data: {} }));
    });
  });

  it("rolls initiative", async () => {
    prisma.token.update.mockResolvedValue(sampleToken({ initiative: 12 }));

    await service.rollInitiative(tokenId, 12);

    expect(prisma.token.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { initiative: 12 } }),
    );
  });

  it("computes actor stats", async () => {
    prisma.token.count.mockResolvedValueOnce(10).mockResolvedValueOnce(6);
    prisma.token.groupBy.mockResolvedValue([
      { type: TokenType.PC, _count: { _all: 4 } },
      { type: TokenType.NPC, _count: { _all: 2 } },
    ]);

    const stats = await service.getActorStats(campaignId);

    expect(stats).toEqual({
      total: 10,
      active: 6,
      byKind: {
        PC: 4,
        NPC: 2,
      },
    });
    expect(prisma.token.groupBy).toHaveBeenCalledWith({
      by: ["type"],
      _count: { _all: true },
      where: { gameSession: { campaignId } },
    });
  });
});
