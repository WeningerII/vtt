import { RouteHandler } from "../router/types";
import { parseJsonBody, sendJson } from "../utils/json";
import { CreateUserRequestSchema } from "@vtt/core-schemas";

export const getUsersHandler: RouteHandler = async (ctx) => {
  const users = await ctx.prisma.user.findMany({
    take: 50,
    orderBy: { createdAt: "desc" },
  });
  sendJson(ctx.res, users);
};

export const createUserHandler: RouteHandler = async (ctx) => {
  const data = await parseJsonBody(ctx.req);
  const parsed = CreateUserRequestSchema.safeParse(data);
  if (!parsed.success) {
    return sendJson(ctx.res, { error: "Invalid body", details: parsed.error.flatten() }, 400);
  }
  const user = await ctx.prisma.user.create({
    data: { 
      email: `user-${Date.now()}@example.com`, // Generated email
      username: parsed.data.displayName.toLowerCase().replace(/\s+/g, '_'),
      displayName: parsed.data.displayName,
      passwordHash: 'temporary-hash' // Should be properly hashed in real implementation
    },
  });
  sendJson(ctx.res, user, 201);
};
