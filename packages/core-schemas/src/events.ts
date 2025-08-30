import { z } from "zod";

/**
 * WebSocket event schemas for real-time communication
 */

// Base event schema
export const BaseEventSchema = z.object({
  type: z.string(),
  sessionId: z.string(),
  userId: z.string(),
  timestamp: z.number(),
});

// Token movement events
export const TokenMoveEventSchema = BaseEventSchema.extend({
  type: z.literal("TOKEN_MOVE"),
  payload: z.object({
    tokenId: z.string(),
    position: z.object({
      x: z.number(),
      y: z.number(),
      z: z.number().optional(),
    }),
    rotation: z.number().optional(),
  }),
});

// Token creation events
export const TokenCreateEventSchema = BaseEventSchema.extend({
  type: z.literal("TOKEN_CREATE"),
  payload: z.object({
    token: z.object({
      id: z.string(),
      name: z.string(),
      textureId: z.string().optional(),
      position: z.object({
        x: z.number(),
        y: z.number(),
        z: z.number().optional(),
      }),
      scale: z
        .object({
          x: z.number(),
          y: z.number(),
        })
        .optional(),
      rotation: z.number().optional(),
      color: z.array(z.number()).optional(),
    }),
  }),
});

// Token deletion events
export const TokenDeleteEventSchema = BaseEventSchema.extend({
  type: z.literal("TOKEN_DELETE"),
  payload: z.object({
    tokenId: z.string(),
  }),
});

// Game state sync events
export const GameStateSyncEventSchema = BaseEventSchema.extend({
  type: z.literal("GAME_STATE_SYNC"),
  payload: z.object({
    gameId: z.string(),
    state: z.unknown(),
  }),
});

// User connection events
export const UserJoinEventSchema = BaseEventSchema.extend({
  type: z.literal("USER_JOIN"),
  payload: z.object({
    user: z.object({
      id: z.string(),
      name: z.string(),
      isGM: z.boolean().optional(),
    }),
  }),
});

export const UserLeaveEventSchema = BaseEventSchema.extend({
  type: z.literal("USER_LEAVE"),
  payload: z.object({
    userId: z.string(),
  }),
});

// Chat events
export const ChatMessageEventSchema = BaseEventSchema.extend({
  type: z.literal("CHAT_MESSAGE"),
  payload: z.object({
    message: z.string(),
    userName: z.string(),
    isPrivate: z.boolean().optional(),
    targetUserId: z.string().optional(),
  }),
});

// Union of all event types
export const VTTEventSchema = z.union([
  TokenMoveEventSchema,
  TokenCreateEventSchema,
  TokenDeleteEventSchema,
  GameStateSyncEventSchema,
  UserJoinEventSchema,
  UserLeaveEventSchema,
  ChatMessageEventSchema,
]);

export type VTTEvent = z.infer<typeof VTTEventSchema>;
export type TokenMoveEvent = z.infer<typeof TokenMoveEventSchema>;
export type TokenCreateEvent = z.infer<typeof TokenCreateEventSchema>;
export type TokenDeleteEvent = z.infer<typeof TokenDeleteEventSchema>;
export type GameStateSyncEvent = z.infer<typeof GameStateSyncEventSchema>;
export type UserJoinEvent = z.infer<typeof UserJoinEventSchema>;
export type UserLeaveEvent = z.infer<typeof UserLeaveEventSchema>;
export type ChatMessageEvent = z.infer<typeof ChatMessageEventSchema>;
