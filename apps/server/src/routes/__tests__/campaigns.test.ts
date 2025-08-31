import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { RouteContext } from "../../utils/router";
import { Readable } from "stream";

// Mock dependencies
jest.mock("@vtt/logging", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock("@prisma/client", () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    campaign: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    character: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    $disconnect: jest.fn(),
  })),
}));

// Helper to create mock request/response
function createMockContext(method: string, url: string, body?: any): RouteContext {
  const req = {
    method,
    url,
    headers: { "content-type": "application/json" },
    user: { id: "user-1", email: "test@example.com" }, // Mock authenticated user
  } as any;

  if (body) {
    req.body = JSON.stringify(body);
    Object.assign(
      req,
      new Readable({
        read() {
          this.push(JSON.stringify(body));
          this.push(null);
        },
      }),
    );
  }

  const res = {
    writeHead: jest.fn(),
    end: jest.fn(),
    setHeader: jest.fn(),
  } as any;

  return { req, res, params: {} };
}

describe("Campaign Routes", () => {
  let mockPrisma: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma = {
      campaign: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      character: {
        findMany: jest.fn(),
        update: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
    };
  });

  describe("POST /campaigns - createCampaignHandler", () => {
    it("creates a new campaign successfully", async () => {
      const mockCampaign = {
        id: "campaign-1",
        name: "Test Campaign",
        description: "A test campaign",
        dmId: "user-1",
        isActive: true,
        createdAt: new Date(),
      };

      mockPrisma.campaign.create.mockResolvedValue(mockCampaign);

      const ctx = createMockContext("POST", "/campaigns", {
        name: "Test Campaign",
        description: "A test campaign",
        system: "dnd5e",
      });

      const createCampaignHandler = jest.fn(async (ctx: RouteContext) => {
        const body = JSON.parse(ctx.req.body);
        const campaign = await mockPrisma.campaign.create({
          data: {
            name: body.name,
            description: body.description,
            system: body.system,
            dmId: ctx.req.user.id,
          },
        });
        ctx.res.writeHead(201, { "Content-Type": "application/json" });
        ctx.res.end(JSON.stringify(campaign));
      });

      await createCampaignHandler(ctx);

      expect(mockPrisma.campaign.create).toHaveBeenCalledWith({
        data: {
          name: "Test Campaign",
          description: "A test campaign",
          system: "dnd5e",
          dmId: "user-1",
        },
      });
      expect(ctx.res.writeHead).toHaveBeenCalledWith(201, { "Content-Type": "application/json" });
      expect(ctx.res.end).toHaveBeenCalledWith(JSON.stringify(mockCampaign));
    });

    it("returns 400 when name is missing", async () => {
      const ctx = createMockContext("POST", "/campaigns", {
        description: "A test campaign",
      });

      const createCampaignHandler = jest.fn(async (ctx: RouteContext) => {
        const body = JSON.parse(ctx.req.body);
        if (!body.name) {
          ctx.res.writeHead(400, { "Content-Type": "application/json" });
          ctx.res.end(JSON.stringify({ error: "Campaign name is required" }));
          return;
        }
      });

      await createCampaignHandler(ctx);

      expect(ctx.res.writeHead).toHaveBeenCalledWith(400, { "Content-Type": "application/json" });
      expect(ctx.res.end).toHaveBeenCalledWith(
        JSON.stringify({ error: "Campaign name is required" }),
      );
    });

    it("handles database errors gracefully", async () => {
      mockPrisma.campaign.create.mockRejectedValue(new Error("Database error"));

      const ctx = createMockContext("POST", "/campaigns", {
        name: "Test Campaign",
        description: "A test campaign",
      });

      const createCampaignHandler = jest.fn(async (ctx: RouteContext) => {
        try {
          const body = JSON.parse(ctx.req.body);
          await mockPrisma.campaign.create({
            data: {
              name: body.name,
              description: body.description,
              dmId: ctx.req.user.id,
            },
          });
        } catch (error) {
          ctx.res.writeHead(500, { "Content-Type": "application/json" });
          ctx.res.end(JSON.stringify({ error: "Failed to create campaign" }));
        }
      });

      await createCampaignHandler(ctx);

      expect(ctx.res.writeHead).toHaveBeenCalledWith(500, { "Content-Type": "application/json" });
      expect(ctx.res.end).toHaveBeenCalledWith(
        JSON.stringify({ error: "Failed to create campaign" }),
      );
    });
  });

  describe("GET /campaigns/:id - getCampaignHandler", () => {
    it("retrieves a campaign successfully", async () => {
      const mockCampaign = {
        id: "campaign-1",
        name: "Test Campaign",
        description: "A test campaign",
        dmId: "user-1",
        isActive: true,
        characters: [
          { id: "char-1", name: "Aragorn", playerId: "player-1" },
          { id: "char-2", name: "Legolas", playerId: "player-2" },
        ],
        encounters: [{ id: "enc-1", name: "Goblin Ambush", status: "completed" }],
      };

      mockPrisma.campaign.findUnique.mockResolvedValue(mockCampaign);

      const ctx = createMockContext("GET", "/campaigns/campaign-1");
      ctx.params = { id: "campaign-1" };

      const getCampaignHandler = jest.fn(async (ctx: RouteContext) => {
        const campaign = await mockPrisma.campaign.findUnique({
          where: { id: ctx.params.id },
          include: {
            characters: true,
            encounters: true,
          },
        });
        if (!campaign) {
          ctx.res.writeHead(404, { "Content-Type": "application/json" });
          ctx.res.end(JSON.stringify({ error: "Campaign not found" }));
          return;
        }
        ctx.res.writeHead(200, { "Content-Type": "application/json" });
        ctx.res.end(JSON.stringify(campaign));
      });

      await getCampaignHandler(ctx);

      expect(mockPrisma.campaign.findUnique).toHaveBeenCalledWith({
        where: { id: "campaign-1" },
        include: {
          characters: true,
          encounters: true,
        },
      });
      expect(ctx.res.writeHead).toHaveBeenCalledWith(200, { "Content-Type": "application/json" });
      expect(ctx.res.end).toHaveBeenCalledWith(JSON.stringify(mockCampaign));
    });

    it("returns 404 when campaign not found", async () => {
      mockPrisma.campaign.findUnique.mockResolvedValue(null);

      const ctx = createMockContext("GET", "/campaigns/nonexistent");
      ctx.params = { id: "nonexistent" };

      const getCampaignHandler = jest.fn(async (ctx: RouteContext) => {
        const campaign = await mockPrisma.campaign.findUnique({
          where: { id: ctx.params.id },
        });
        if (!campaign) {
          ctx.res.writeHead(404, { "Content-Type": "application/json" });
          ctx.res.end(JSON.stringify({ error: "Campaign not found" }));
          return;
        }
      });

      await getCampaignHandler(ctx);

      expect(ctx.res.writeHead).toHaveBeenCalledWith(404, { "Content-Type": "application/json" });
      expect(ctx.res.end).toHaveBeenCalledWith(JSON.stringify({ error: "Campaign not found" }));
    });
  });

  describe("GET /campaigns - listCampaignsHandler", () => {
    it("lists user campaigns successfully", async () => {
      const mockCampaigns = [
        {
          id: "campaign-1",
          name: "Campaign 1",
          dmId: "user-1",
          isActive: true,
        },
        {
          id: "campaign-2",
          name: "Campaign 2",
          dmId: "user-2",
          isActive: false,
          players: [{ userId: "user-1" }],
        },
      ];

      mockPrisma.campaign.findMany.mockResolvedValue(mockCampaigns);

      const ctx = createMockContext("GET", "/campaigns");

      const listCampaignsHandler = jest.fn(async (ctx: RouteContext) => {
        const campaigns = await mockPrisma.campaign.findMany({
          where: {
            OR: [{ dmId: ctx.req.user.id }, { players: { some: { userId: ctx.req.user.id } } }],
          },
          include: {
            _count: {
              select: { characters: true, encounters: true },
            },
          },
        });
        ctx.res.writeHead(200, { "Content-Type": "application/json" });
        ctx.res.end(JSON.stringify(campaigns));
      });

      await listCampaignsHandler(ctx);

      expect(mockPrisma.campaign.findMany).toHaveBeenCalledWith({
        where: {
          OR: [{ dmId: "user-1" }, { players: { some: { userId: "user-1" } } }],
        },
        include: {
          _count: {
            select: { characters: true, encounters: true },
          },
        },
      });
      expect(ctx.res.writeHead).toHaveBeenCalledWith(200, { "Content-Type": "application/json" });
      expect(ctx.res.end).toHaveBeenCalledWith(JSON.stringify(mockCampaigns));
    });

    it("filters campaigns by status", async () => {
      const ctx = createMockContext("GET", "/campaigns?status=active");

      const listCampaignsHandler = jest.fn(async (ctx: RouteContext) => {
        const url = new URL(ctx.req.url, "http://localhost");
        const status = url.searchParams.get("status");

        const whereClause: any = {
          OR: [{ dmId: ctx.req.user.id }, { players: { some: { userId: ctx.req.user.id } } }],
        };

        if (status === "active") {
          whereClause.isActive = true;
        } else if (status === "inactive") {
          whereClause.isActive = false;
        }

        const campaigns = await mockPrisma.campaign.findMany({
          where: whereClause,
        });
        ctx.res.writeHead(200, { "Content-Type": "application/json" });
        ctx.res.end(JSON.stringify(campaigns));
      });

      await listCampaignsHandler(ctx);

      expect(mockPrisma.campaign.findMany).toHaveBeenCalledWith({
        where: {
          OR: [{ dmId: "user-1" }, { players: { some: { userId: "user-1" } } }],
          isActive: true,
        },
      });
    });
  });

  describe("PUT /campaigns/:id - updateCampaignHandler", () => {
    it("updates a campaign successfully", async () => {
      const updatedCampaign = {
        id: "campaign-1",
        name: "Updated Campaign",
        description: "Updated description",
        isActive: false,
      };

      mockPrisma.campaign.update.mockResolvedValue(updatedCampaign);

      const ctx = createMockContext("PUT", "/campaigns/campaign-1", {
        name: "Updated Campaign",
        description: "Updated description",
        isActive: false,
      });
      ctx.params = { id: "campaign-1" };

      const updateCampaignHandler = jest.fn(async (ctx: RouteContext) => {
        const body = JSON.parse(ctx.req.body);
        const campaign = await mockPrisma.campaign.update({
          where: { id: ctx.params.id },
          data: body,
        });
        ctx.res.writeHead(200, { "Content-Type": "application/json" });
        ctx.res.end(JSON.stringify(campaign));
      });

      await updateCampaignHandler(ctx);

      expect(mockPrisma.campaign.update).toHaveBeenCalledWith({
        where: { id: "campaign-1" },
        data: {
          name: "Updated Campaign",
          description: "Updated description",
          isActive: false,
        },
      });
      expect(ctx.res.writeHead).toHaveBeenCalledWith(200, { "Content-Type": "application/json" });
      expect(ctx.res.end).toHaveBeenCalledWith(JSON.stringify(updatedCampaign));
    });

    it("validates campaign ownership", async () => {
      const ctx = createMockContext("PUT", "/campaigns/campaign-1", {
        name: "Updated Campaign",
      });
      ctx.params = { id: "campaign-1" };

      // Mock campaign owned by different user
      mockPrisma.campaign.findUnique.mockResolvedValue({
        id: "campaign-1",
        dmId: "other-user",
      });

      const updateCampaignHandler = jest.fn(async (ctx: RouteContext) => {
        const campaign = await mockPrisma.campaign.findUnique({
          where: { id: ctx.params.id },
        });

        if (!campaign) {
          ctx.res.writeHead(404, { "Content-Type": "application/json" });
          ctx.res.end(JSON.stringify({ error: "Campaign not found" }));
          return;
        }

        if (campaign.dmId !== ctx.req.user.id) {
          ctx.res.writeHead(403, { "Content-Type": "application/json" });
          ctx.res.end(JSON.stringify({ error: "Not authorized to update this campaign" }));
          return;
        }
      });

      await updateCampaignHandler(ctx);

      expect(ctx.res.writeHead).toHaveBeenCalledWith(403, { "Content-Type": "application/json" });
      expect(ctx.res.end).toHaveBeenCalledWith(
        JSON.stringify({ error: "Not authorized to update this campaign" }),
      );
    });
  });

  describe("DELETE /campaigns/:id - deleteCampaignHandler", () => {
    it("deletes a campaign successfully", async () => {
      mockPrisma.campaign.findUnique.mockResolvedValue({
        id: "campaign-1",
        dmId: "user-1",
      });
      mockPrisma.campaign.delete.mockResolvedValue({ id: "campaign-1" });

      const ctx = createMockContext("DELETE", "/campaigns/campaign-1");
      ctx.params = { id: "campaign-1" };

      const deleteCampaignHandler = jest.fn(async (ctx: RouteContext) => {
        const campaign = await mockPrisma.campaign.findUnique({
          where: { id: ctx.params.id },
        });

        if (!campaign || campaign.dmId !== ctx.req.user.id) {
          ctx.res.writeHead(404, { "Content-Type": "application/json" });
          ctx.res.end(JSON.stringify({ error: "Campaign not found" }));
          return;
        }

        await mockPrisma.campaign.delete({
          where: { id: ctx.params.id },
        });

        ctx.res.writeHead(204);
        ctx.res.end();
      });

      await deleteCampaignHandler(ctx);

      expect(mockPrisma.campaign.delete).toHaveBeenCalledWith({
        where: { id: "campaign-1" },
      });
      expect(ctx.res.writeHead).toHaveBeenCalledWith(204);
      expect(ctx.res.end).toHaveBeenCalled();
    });

    it("prevents deletion by non-owner", async () => {
      mockPrisma.campaign.findUnique.mockResolvedValue({
        id: "campaign-1",
        dmId: "other-user",
      });

      const ctx = createMockContext("DELETE", "/campaigns/campaign-1");
      ctx.params = { id: "campaign-1" };

      const deleteCampaignHandler = jest.fn(async (ctx: RouteContext) => {
        const campaign = await mockPrisma.campaign.findUnique({
          where: { id: ctx.params.id },
        });

        if (!campaign || campaign.dmId !== ctx.req.user.id) {
          ctx.res.writeHead(404, { "Content-Type": "application/json" });
          ctx.res.end(JSON.stringify({ error: "Campaign not found" }));
          return;
        }
      });

      await deleteCampaignHandler(ctx);

      expect(ctx.res.writeHead).toHaveBeenCalledWith(404, { "Content-Type": "application/json" });
      expect(ctx.res.end).toHaveBeenCalledWith(JSON.stringify({ error: "Campaign not found" }));
    });
  });

  describe("Player Management", () => {
    it("adds player to campaign", async () => {
      const ctx = createMockContext("POST", "/campaigns/campaign-1/players", {
        userId: "player-1",
      });
      ctx.params = { id: "campaign-1" };

      const addPlayerHandler = jest.fn(async (ctx: RouteContext) => {
        const body = JSON.parse(ctx.req.body);
        const campaign = await mockPrisma.campaign.update({
          where: { id: ctx.params.id },
          data: {
            players: {
              create: {
                userId: body.userId,
                role: "player",
              },
            },
          },
          include: { players: true },
        });
        ctx.res.writeHead(200, { "Content-Type": "application/json" });
        ctx.res.end(JSON.stringify(campaign));
      });

      await addPlayerHandler(ctx);

      expect(mockPrisma.campaign.update).toHaveBeenCalledWith({
        where: { id: "campaign-1" },
        data: {
          players: {
            create: {
              userId: "player-1",
              role: "player",
            },
          },
        },
        include: { players: true },
      });
    });

    it("removes player from campaign", async () => {
      const ctx = createMockContext("DELETE", "/campaigns/campaign-1/players/player-1");
      ctx.params = { id: "campaign-1", playerId: "player-1" };

      const removePlayerHandler = jest.fn(async (ctx: RouteContext) => {
        await mockPrisma.campaign.update({
          where: { id: ctx.params.id },
          data: {
            players: {
              delete: {
                campaignId_userId: {
                  campaignId: ctx.params.id,
                  userId: ctx.params.playerId,
                },
              },
            },
          },
        });
        ctx.res.writeHead(204);
        ctx.res.end();
      });

      await removePlayerHandler(ctx);

      expect(mockPrisma.campaign.update).toHaveBeenCalledWith({
        where: { id: "campaign-1" },
        data: {
          players: {
            delete: {
              campaignId_userId: {
                campaignId: "campaign-1",
                userId: "player-1",
              },
            },
          },
        },
      });
      expect(ctx.res.writeHead).toHaveBeenCalledWith(204);
    });
  });

  describe("Error Handling", () => {
    it("handles invalid JSON requests", async () => {
      const ctx = createMockContext("POST", "/campaigns");
      ctx.req.body = "invalid json";

      const createCampaignHandler = jest.fn(async (ctx: RouteContext) => {
        try {
          JSON.parse(ctx.req.body);
        } catch (error) {
          ctx.res.writeHead(400, { "Content-Type": "application/json" });
          ctx.res.end(JSON.stringify({ error: "Invalid JSON body" }));
        }
      });

      await createCampaignHandler(ctx);

      expect(ctx.res.writeHead).toHaveBeenCalledWith(400, { "Content-Type": "application/json" });
      expect(ctx.res.end).toHaveBeenCalledWith(JSON.stringify({ error: "Invalid JSON body" }));
    });

    it("handles unauthorized requests", async () => {
      const ctx = createMockContext("POST", "/campaigns", {
        name: "Test Campaign",
      });
      ctx.req.user = null; // No authenticated user

      const createCampaignHandler = jest.fn(async (ctx: RouteContext) => {
        if (!ctx.req.user) {
          ctx.res.writeHead(401, { "Content-Type": "application/json" });
          ctx.res.end(JSON.stringify({ error: "Authentication required" }));
          return;
        }
      });

      await createCampaignHandler(ctx);

      expect(ctx.res.writeHead).toHaveBeenCalledWith(401, { "Content-Type": "application/json" });
      expect(ctx.res.end).toHaveBeenCalledWith(
        JSON.stringify({ error: "Authentication required" }),
      );
    });
  });
});
