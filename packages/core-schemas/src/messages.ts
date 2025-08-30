import { z } from "zod";

// WebSocket message schemas used by both client and server.
// Keep in sync with server protocol. These start minimal and will grow as features land.

export const HelloMessageSchema = z.object({
  type: z.literal("HELLO"),
  tickRate: z.number().int().positive(),
  snapshotVersion: z.number().int().nonnegative(),
});
export type HelloMessage = z.infer<typeof HelloMessageSchema>;

export const EchoMessageSchema = z.object({
  type: z.literal("ECHO"),
  payload: z.string(),
});
export type EchoMessage = z.infer<typeof EchoMessageSchema>;

export const PingMessageSchema = z.object({
  type: z.literal("PING"),
  t: z.number().int().nonnegative().optional(),
});
export type PingMessage = z.infer<typeof PingMessageSchema>;

export const PongMessageSchema = z.object({
  type: z.literal("PONG"),
  t: z.number().int().nonnegative().optional(),
});
export type PongMessage = z.infer<typeof PongMessageSchema>;

export const ErrorMessageSchema = z.object({
  type: z.literal("ERROR"),
  code: z.string(),
  message: z.string(),
  id: z.string().optional(),
});
export type ErrorMessage = z.infer<typeof ErrorMessageSchema>;

// Network sync messages
export const NetEntitySchema = z.object({
  id: z.number().int().nonnegative(),
  x: z.number(),
  y: z.number(),
  rot: z.number(),
  sx: z.number(),
  sy: z.number(),
  zIndex: z.number().int(),
  sprite: z.number().int().optional(),
  tintR: z.number().optional(),
  tintG: z.number().optional(),
  tintB: z.number().optional(),
  alpha: z.number().optional(),
  frame: z.number().int().optional(),
});
export type NetEntity = z.infer<typeof NetEntitySchema>;

export const SnapshotMessageSchema = z.object({
  type: z.literal("SNAPSHOT"),
  seq: z.number().int().nonnegative(),
  entities: z.array(NetEntitySchema),
});
export type SnapshotMessage = z.infer<typeof SnapshotMessageSchema>;

export const DeltaMessageSchema = z.object({
  type: z.literal("DELTA"),
  seq: z.number().int().nonnegative(),
  baseSeq: z.number().int().nonnegative(),
  created: z.array(NetEntitySchema),
  updated: z.array(NetEntitySchema),
  removed: z.array(z.number().int().nonnegative()),
});
export type DeltaMessage = z.infer<typeof DeltaMessageSchema>;

// Game-specific server messages
export const DiceRollResultMessageSchema = z.object({
  type: z.literal("DICE_ROLL_RESULT"),
  rollId: z.string(),
  userId: z.string(),
  displayName: z.string(),
  dice: z.string(),
  label: z.string().optional(),
  total: z.number().int(),
  rolls: z.array(z.number().int()),
  modifier: z.number().int().default(0),
  timestamp: z.number(),
  private: z.boolean().default(false),
});
export type DiceRollResultMessage = z.infer<typeof DiceRollResultMessageSchema>;

export const ChatBroadcastMessageSchema = z.object({
  type: z.literal("CHAT_BROADCAST"),
  messageId: z.string(),
  userId: z.string(),
  displayName: z.string(),
  message: z.string(),
  channel: z.string(),
  timestamp: z.number(),
});
export type ChatBroadcastMessage = z.infer<typeof ChatBroadcastMessageSchema>;

export const GameStateMessageSchema = z.object({
  type: z.literal("GAME_STATE"),
  gameId: z.string(),
  mapId: z.string().optional(),
  players: z.array(z.object({
    userId: z.string(),
    displayName: z.string(),
    connected: z.boolean(),
  })),
  turnOrder: z.array(z.string()).optional(), // entity IDs
  currentTurn: z.string().optional(), // entity ID
  phase: z.enum(["exploration", "combat", "downtime"]).default("exploration"),
});
export type GameStateMessage = z.infer<typeof GameStateMessageSchema>;

export const PlayerJoinedMessageSchema = z.object({
  type: z.literal("PLAYER_JOINED"),
  userId: z.string(),
  displayName: z.string(),
  gameId: z.string(),
});
export type PlayerJoinedMessage = z.infer<typeof PlayerJoinedMessageSchema>;

export const PlayerLeftMessageSchema = z.object({
  type: z.literal("PLAYER_LEFT"),
  userId: z.string(),
  gameId: z.string(),
});
export type PlayerLeftMessage = z.infer<typeof PlayerLeftMessageSchema>;

export const AnyServerMessageSchema = z.union([
  HelloMessageSchema,
  EchoMessageSchema,
  PongMessageSchema,
  ErrorMessageSchema,
  SnapshotMessageSchema,
  DeltaMessageSchema,
  DiceRollResultMessageSchema,
  ChatBroadcastMessageSchema,
  GameStateMessageSchema,
  PlayerJoinedMessageSchema,
  PlayerLeftMessageSchema,
]);
export type AnyServerMessage = z.infer<typeof AnyServerMessageSchema>;

// Game-specific client messages
export const MoveTokenMessageSchema = z.object({
  type: z.literal("MOVE_TOKEN"),
  entityId: z.number().int().nonnegative(),
  x: z.number(),
  y: z.number(),
  animate: z.boolean().default(true),
});
export type MoveTokenMessage = z.infer<typeof MoveTokenMessageSchema>;

export const RollDiceMessageSchema = z.object({
  type: z.literal("ROLL_DICE"),
  dice: z.string(), // e.g., "2d6+3", "1d20"
  label: z.string().optional(),
  private: z.boolean().default(false),
});
export type RollDiceMessage = z.infer<typeof RollDiceMessageSchema>;

export const ChatMessageSchema = z.object({
  type: z.literal("CHAT_MESSAGE"),
  message: z.string(),
  channel: z.string().default("general"),
});
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

export const JoinGameMessageSchema = z.object({
  type: z.literal("JOIN_GAME"),
  gameId: z.string(),
  userId: z.string(),
  displayName: z.string(),
});
export type JoinGameMessage = z.infer<typeof JoinGameMessageSchema>;

export const LeaveGameMessageSchema = z.object({
  type: z.literal("LEAVE_GAME"),
  gameId: z.string(),
});
export type LeaveGameMessage = z.infer<typeof LeaveGameMessageSchema>;

export const AnyClientMessageSchema = z.union([
  PingMessageSchema,
  EchoMessageSchema,
  MoveTokenMessageSchema,
  RollDiceMessageSchema,
  ChatMessageSchema,
  JoinGameMessageSchema,
  LeaveGameMessageSchema,
]);
export type AnyClientMessage = z.infer<typeof AnyClientMessageSchema>;
