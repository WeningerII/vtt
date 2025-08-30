import { z } from "zod";
export declare const HelloMessageSchema: z.ZodObject<
  {
    type: z.ZodLiteral<"HELLO">;
    tickRate: z.ZodNumber;
    snapshotVersion: z.ZodNumber;
  },
  "strip",
  z.ZodTypeAny,
  {
    type: "HELLO";
    tickRate: number;
    snapshotVersion: number;
  },
  {
    type: "HELLO";
    tickRate: number;
    snapshotVersion: number;
  }
>;
export type HelloMessage = z.infer<typeof HelloMessageSchema>;
export declare const EchoMessageSchema: z.ZodObject<
  {
    type: z.ZodLiteral<"ECHO">;
    payload: z.ZodString;
  },
  "strip",
  z.ZodTypeAny,
  {
    type: "ECHO";
    payload: string;
  },
  {
    type: "ECHO";
    payload: string;
  }
>;
export type EchoMessage = z.infer<typeof EchoMessageSchema>;
export declare const PingMessageSchema: z.ZodObject<
  {
    type: z.ZodLiteral<"PING">;
    t: z.ZodOptional<z.ZodNumber>;
  },
  "strip",
  z.ZodTypeAny,
  {
    type: "PING";
    t?: number | undefined;
  },
  {
    type: "PING";
    t?: number | undefined;
  }
>;
export type PingMessage = z.infer<typeof PingMessageSchema>;
export declare const PongMessageSchema: z.ZodObject<
  {
    type: z.ZodLiteral<"PONG">;
    t: z.ZodOptional<z.ZodNumber>;
  },
  "strip",
  z.ZodTypeAny,
  {
    type: "PONG";
    t?: number | undefined;
  },
  {
    type: "PONG";
    t?: number | undefined;
  }
>;
export type PongMessage = z.infer<typeof PongMessageSchema>;
export declare const ErrorMessageSchema: z.ZodObject<
  {
    type: z.ZodLiteral<"ERROR">;
    code: z.ZodString;
    message: z.ZodString;
    id: z.ZodOptional<z.ZodString>;
  },
  "strip",
  z.ZodTypeAny,
  {
    type: "ERROR";
    code: string;
    message: string;
    id?: string | undefined;
  },
  {
    type: "ERROR";
    code: string;
    message: string;
    id?: string | undefined;
  }
>;
export type ErrorMessage = z.infer<typeof ErrorMessageSchema>;
export declare const NetEntitySchema: z.ZodObject<
  {
    id: z.ZodNumber;
    x: z.ZodNumber;
    y: z.ZodNumber;
    rot: z.ZodNumber;
    sx: z.ZodNumber;
    sy: z.ZodNumber;
    zIndex: z.ZodNumber;
    sprite: z.ZodOptional<z.ZodNumber>;
    tintR: z.ZodOptional<z.ZodNumber>;
    tintG: z.ZodOptional<z.ZodNumber>;
    tintB: z.ZodOptional<z.ZodNumber>;
    alpha: z.ZodOptional<z.ZodNumber>;
    frame: z.ZodOptional<z.ZodNumber>;
  },
  "strip",
  z.ZodTypeAny,
  {
    id: number;
    x: number;
    y: number;
    rot: number;
    sx: number;
    sy: number;
    zIndex: number;
    sprite?: number | undefined;
    tintR?: number | undefined;
    tintG?: number | undefined;
    tintB?: number | undefined;
    alpha?: number | undefined;
    frame?: number | undefined;
  },
  {
    id: number;
    x: number;
    y: number;
    rot: number;
    sx: number;
    sy: number;
    zIndex: number;
    sprite?: number | undefined;
    tintR?: number | undefined;
    tintG?: number | undefined;
    tintB?: number | undefined;
    alpha?: number | undefined;
    frame?: number | undefined;
  }
>;
export type NetEntity = z.infer<typeof NetEntitySchema>;
export declare const SnapshotMessageSchema: z.ZodObject<
  {
    type: z.ZodLiteral<"SNAPSHOT">;
    seq: z.ZodNumber;
    entities: z.ZodArray<
      z.ZodObject<
        {
          id: z.ZodNumber;
          x: z.ZodNumber;
          y: z.ZodNumber;
          rot: z.ZodNumber;
          sx: z.ZodNumber;
          sy: z.ZodNumber;
          zIndex: z.ZodNumber;
          sprite: z.ZodOptional<z.ZodNumber>;
          tintR: z.ZodOptional<z.ZodNumber>;
          tintG: z.ZodOptional<z.ZodNumber>;
          tintB: z.ZodOptional<z.ZodNumber>;
          alpha: z.ZodOptional<z.ZodNumber>;
          frame: z.ZodOptional<z.ZodNumber>;
        },
        "strip",
        z.ZodTypeAny,
        {
          id: number;
          x: number;
          y: number;
          rot: number;
          sx: number;
          sy: number;
          zIndex: number;
          sprite?: number | undefined;
          tintR?: number | undefined;
          tintG?: number | undefined;
          tintB?: number | undefined;
          alpha?: number | undefined;
          frame?: number | undefined;
        },
        {
          id: number;
          x: number;
          y: number;
          rot: number;
          sx: number;
          sy: number;
          zIndex: number;
          sprite?: number | undefined;
          tintR?: number | undefined;
          tintG?: number | undefined;
          tintB?: number | undefined;
          alpha?: number | undefined;
          frame?: number | undefined;
        }
      >,
      "many"
    >;
  },
  "strip",
  z.ZodTypeAny,
  {
    type: "SNAPSHOT";
    seq: number;
    entities: {
      id: number;
      x: number;
      y: number;
      rot: number;
      sx: number;
      sy: number;
      zIndex: number;
      sprite?: number | undefined;
      tintR?: number | undefined;
      tintG?: number | undefined;
      tintB?: number | undefined;
      alpha?: number | undefined;
      frame?: number | undefined;
    }[];
  },
  {
    type: "SNAPSHOT";
    seq: number;
    entities: {
      id: number;
      x: number;
      y: number;
      rot: number;
      sx: number;
      sy: number;
      zIndex: number;
      sprite?: number | undefined;
      tintR?: number | undefined;
      tintG?: number | undefined;
      tintB?: number | undefined;
      alpha?: number | undefined;
      frame?: number | undefined;
    }[];
  }
>;
export type SnapshotMessage = z.infer<typeof SnapshotMessageSchema>;
export declare const DeltaMessageSchema: z.ZodObject<
  {
    type: z.ZodLiteral<"DELTA">;
    seq: z.ZodNumber;
    baseSeq: z.ZodNumber;
    created: z.ZodArray<
      z.ZodObject<
        {
          id: z.ZodNumber;
          x: z.ZodNumber;
          y: z.ZodNumber;
          rot: z.ZodNumber;
          sx: z.ZodNumber;
          sy: z.ZodNumber;
          zIndex: z.ZodNumber;
          sprite: z.ZodOptional<z.ZodNumber>;
          tintR: z.ZodOptional<z.ZodNumber>;
          tintG: z.ZodOptional<z.ZodNumber>;
          tintB: z.ZodOptional<z.ZodNumber>;
          alpha: z.ZodOptional<z.ZodNumber>;
          frame: z.ZodOptional<z.ZodNumber>;
        },
        "strip",
        z.ZodTypeAny,
        {
          id: number;
          x: number;
          y: number;
          rot: number;
          sx: number;
          sy: number;
          zIndex: number;
          sprite?: number | undefined;
          tintR?: number | undefined;
          tintG?: number | undefined;
          tintB?: number | undefined;
          alpha?: number | undefined;
          frame?: number | undefined;
        },
        {
          id: number;
          x: number;
          y: number;
          rot: number;
          sx: number;
          sy: number;
          zIndex: number;
          sprite?: number | undefined;
          tintR?: number | undefined;
          tintG?: number | undefined;
          tintB?: number | undefined;
          alpha?: number | undefined;
          frame?: number | undefined;
        }
      >,
      "many"
    >;
    updated: z.ZodArray<
      z.ZodObject<
        {
          id: z.ZodNumber;
          x: z.ZodNumber;
          y: z.ZodNumber;
          rot: z.ZodNumber;
          sx: z.ZodNumber;
          sy: z.ZodNumber;
          zIndex: z.ZodNumber;
          sprite: z.ZodOptional<z.ZodNumber>;
          tintR: z.ZodOptional<z.ZodNumber>;
          tintG: z.ZodOptional<z.ZodNumber>;
          tintB: z.ZodOptional<z.ZodNumber>;
          alpha: z.ZodOptional<z.ZodNumber>;
          frame: z.ZodOptional<z.ZodNumber>;
        },
        "strip",
        z.ZodTypeAny,
        {
          id: number;
          x: number;
          y: number;
          rot: number;
          sx: number;
          sy: number;
          zIndex: number;
          sprite?: number | undefined;
          tintR?: number | undefined;
          tintG?: number | undefined;
          tintB?: number | undefined;
          alpha?: number | undefined;
          frame?: number | undefined;
        },
        {
          id: number;
          x: number;
          y: number;
          rot: number;
          sx: number;
          sy: number;
          zIndex: number;
          sprite?: number | undefined;
          tintR?: number | undefined;
          tintG?: number | undefined;
          tintB?: number | undefined;
          alpha?: number | undefined;
          frame?: number | undefined;
        }
      >,
      "many"
    >;
    removed: z.ZodArray<z.ZodNumber, "many">;
  },
  "strip",
  z.ZodTypeAny,
  {
    type: "DELTA";
    seq: number;
    baseSeq: number;
    created: {
      id: number;
      x: number;
      y: number;
      rot: number;
      sx: number;
      sy: number;
      zIndex: number;
      sprite?: number | undefined;
      tintR?: number | undefined;
      tintG?: number | undefined;
      tintB?: number | undefined;
      alpha?: number | undefined;
      frame?: number | undefined;
    }[];
    updated: {
      id: number;
      x: number;
      y: number;
      rot: number;
      sx: number;
      sy: number;
      zIndex: number;
      sprite?: number | undefined;
      tintR?: number | undefined;
      tintG?: number | undefined;
      tintB?: number | undefined;
      alpha?: number | undefined;
      frame?: number | undefined;
    }[];
    removed: number[];
  },
  {
    type: "DELTA";
    seq: number;
    baseSeq: number;
    created: {
      id: number;
      x: number;
      y: number;
      rot: number;
      sx: number;
      sy: number;
      zIndex: number;
      sprite?: number | undefined;
      tintR?: number | undefined;
      tintG?: number | undefined;
      tintB?: number | undefined;
      alpha?: number | undefined;
      frame?: number | undefined;
    }[];
    updated: {
      id: number;
      x: number;
      y: number;
      rot: number;
      sx: number;
      sy: number;
      zIndex: number;
      sprite?: number | undefined;
      tintR?: number | undefined;
      tintG?: number | undefined;
      tintB?: number | undefined;
      alpha?: number | undefined;
      frame?: number | undefined;
    }[];
    removed: number[];
  }
>;
export type DeltaMessage = z.infer<typeof DeltaMessageSchema>;
export declare const DiceRollResultMessageSchema: z.ZodObject<
  {
    type: z.ZodLiteral<"DICE_ROLL_RESULT">;
    rollId: z.ZodString;
    userId: z.ZodString;
    displayName: z.ZodString;
    dice: z.ZodString;
    label: z.ZodOptional<z.ZodString>;
    total: z.ZodNumber;
    rolls: z.ZodArray<z.ZodNumber, "many">;
    modifier: z.ZodDefault<z.ZodNumber>;
    timestamp: z.ZodNumber;
    private: z.ZodDefault<z.ZodBoolean>;
  },
  "strip",
  z.ZodTypeAny,
  {
    type: "DICE_ROLL_RESULT";
    rollId: string;
    userId: string;
    displayName: string;
    dice: string;
    total: number;
    rolls: number[];
    modifier: number;
    timestamp: number;
    private: boolean;
    label?: string | undefined;
  },
  {
    type: "DICE_ROLL_RESULT";
    rollId: string;
    userId: string;
    displayName: string;
    dice: string;
    total: number;
    rolls: number[];
    timestamp: number;
    label?: string | undefined;
    modifier?: number | undefined;
    private?: boolean | undefined;
  }
>;
export type DiceRollResultMessage = z.infer<typeof DiceRollResultMessageSchema>;
export declare const ChatBroadcastMessageSchema: z.ZodObject<
  {
    type: z.ZodLiteral<"CHAT_BROADCAST">;
    messageId: z.ZodString;
    userId: z.ZodString;
    displayName: z.ZodString;
    message: z.ZodString;
    channel: z.ZodString;
    timestamp: z.ZodNumber;
  },
  "strip",
  z.ZodTypeAny,
  {
    type: "CHAT_BROADCAST";
    message: string;
    userId: string;
    displayName: string;
    timestamp: number;
    messageId: string;
    channel: string;
  },
  {
    type: "CHAT_BROADCAST";
    message: string;
    userId: string;
    displayName: string;
    timestamp: number;
    messageId: string;
    channel: string;
  }
>;
export type ChatBroadcastMessage = z.infer<typeof ChatBroadcastMessageSchema>;
export declare const GameStateMessageSchema: z.ZodObject<
  {
    type: z.ZodLiteral<"GAME_STATE">;
    gameId: z.ZodString;
    mapId: z.ZodOptional<z.ZodString>;
    players: z.ZodArray<
      z.ZodObject<
        {
          userId: z.ZodString;
          displayName: z.ZodString;
          connected: z.ZodBoolean;
        },
        "strip",
        z.ZodTypeAny,
        {
          userId: string;
          displayName: string;
          connected: boolean;
        },
        {
          userId: string;
          displayName: string;
          connected: boolean;
        }
      >,
      "many"
    >;
    turnOrder: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    currentTurn: z.ZodOptional<z.ZodString>;
    phase: z.ZodDefault<z.ZodEnum<["exploration", "combat", "downtime"]>>;
  },
  "strip",
  z.ZodTypeAny,
  {
    type: "GAME_STATE";
    gameId: string;
    players: {
      userId: string;
      displayName: string;
      connected: boolean;
    }[];
    phase: "exploration" | "combat" | "downtime";
    mapId?: string | undefined;
    turnOrder?: string[] | undefined;
    currentTurn?: string | undefined;
  },
  {
    type: "GAME_STATE";
    gameId: string;
    players: {
      userId: string;
      displayName: string;
      connected: boolean;
    }[];
    mapId?: string | undefined;
    turnOrder?: string[] | undefined;
    currentTurn?: string | undefined;
    phase?: "exploration" | "combat" | "downtime" | undefined;
  }
>;
export type GameStateMessage = z.infer<typeof GameStateMessageSchema>;
export declare const PlayerJoinedMessageSchema: z.ZodObject<
  {
    type: z.ZodLiteral<"PLAYER_JOINED">;
    userId: z.ZodString;
    displayName: z.ZodString;
    gameId: z.ZodString;
  },
  "strip",
  z.ZodTypeAny,
  {
    type: "PLAYER_JOINED";
    userId: string;
    displayName: string;
    gameId: string;
  },
  {
    type: "PLAYER_JOINED";
    userId: string;
    displayName: string;
    gameId: string;
  }
>;
export type PlayerJoinedMessage = z.infer<typeof PlayerJoinedMessageSchema>;
export declare const PlayerLeftMessageSchema: z.ZodObject<
  {
    type: z.ZodLiteral<"PLAYER_LEFT">;
    userId: z.ZodString;
    gameId: z.ZodString;
  },
  "strip",
  z.ZodTypeAny,
  {
    type: "PLAYER_LEFT";
    userId: string;
    gameId: string;
  },
  {
    type: "PLAYER_LEFT";
    userId: string;
    gameId: string;
  }
>;
export type PlayerLeftMessage = z.infer<typeof PlayerLeftMessageSchema>;
export declare const AnyServerMessageSchema: z.ZodUnion<
  [
    z.ZodObject<
      {
        type: z.ZodLiteral<"HELLO">;
        tickRate: z.ZodNumber;
        snapshotVersion: z.ZodNumber;
      },
      "strip",
      z.ZodTypeAny,
      {
        type: "HELLO";
        tickRate: number;
        snapshotVersion: number;
      },
      {
        type: "HELLO";
        tickRate: number;
        snapshotVersion: number;
      }
    >,
    z.ZodObject<
      {
        type: z.ZodLiteral<"ECHO">;
        payload: z.ZodString;
      },
      "strip",
      z.ZodTypeAny,
      {
        type: "ECHO";
        payload: string;
      },
      {
        type: "ECHO";
        payload: string;
      }
    >,
    z.ZodObject<
      {
        type: z.ZodLiteral<"PONG">;
        t: z.ZodOptional<z.ZodNumber>;
      },
      "strip",
      z.ZodTypeAny,
      {
        type: "PONG";
        t?: number | undefined;
      },
      {
        type: "PONG";
        t?: number | undefined;
      }
    >,
    z.ZodObject<
      {
        type: z.ZodLiteral<"ERROR">;
        code: z.ZodString;
        message: z.ZodString;
        id: z.ZodOptional<z.ZodString>;
      },
      "strip",
      z.ZodTypeAny,
      {
        type: "ERROR";
        code: string;
        message: string;
        id?: string | undefined;
      },
      {
        type: "ERROR";
        code: string;
        message: string;
        id?: string | undefined;
      }
    >,
    z.ZodObject<
      {
        type: z.ZodLiteral<"SNAPSHOT">;
        seq: z.ZodNumber;
        entities: z.ZodArray<
          z.ZodObject<
            {
              id: z.ZodNumber;
              x: z.ZodNumber;
              y: z.ZodNumber;
              rot: z.ZodNumber;
              sx: z.ZodNumber;
              sy: z.ZodNumber;
              zIndex: z.ZodNumber;
              sprite: z.ZodOptional<z.ZodNumber>;
              tintR: z.ZodOptional<z.ZodNumber>;
              tintG: z.ZodOptional<z.ZodNumber>;
              tintB: z.ZodOptional<z.ZodNumber>;
              alpha: z.ZodOptional<z.ZodNumber>;
              frame: z.ZodOptional<z.ZodNumber>;
            },
            "strip",
            z.ZodTypeAny,
            {
              id: number;
              x: number;
              y: number;
              rot: number;
              sx: number;
              sy: number;
              zIndex: number;
              sprite?: number | undefined;
              tintR?: number | undefined;
              tintG?: number | undefined;
              tintB?: number | undefined;
              alpha?: number | undefined;
              frame?: number | undefined;
            },
            {
              id: number;
              x: number;
              y: number;
              rot: number;
              sx: number;
              sy: number;
              zIndex: number;
              sprite?: number | undefined;
              tintR?: number | undefined;
              tintG?: number | undefined;
              tintB?: number | undefined;
              alpha?: number | undefined;
              frame?: number | undefined;
            }
          >,
          "many"
        >;
      },
      "strip",
      z.ZodTypeAny,
      {
        type: "SNAPSHOT";
        seq: number;
        entities: {
          id: number;
          x: number;
          y: number;
          rot: number;
          sx: number;
          sy: number;
          zIndex: number;
          sprite?: number | undefined;
          tintR?: number | undefined;
          tintG?: number | undefined;
          tintB?: number | undefined;
          alpha?: number | undefined;
          frame?: number | undefined;
        }[];
      },
      {
        type: "SNAPSHOT";
        seq: number;
        entities: {
          id: number;
          x: number;
          y: number;
          rot: number;
          sx: number;
          sy: number;
          zIndex: number;
          sprite?: number | undefined;
          tintR?: number | undefined;
          tintG?: number | undefined;
          tintB?: number | undefined;
          alpha?: number | undefined;
          frame?: number | undefined;
        }[];
      }
    >,
    z.ZodObject<
      {
        type: z.ZodLiteral<"DELTA">;
        seq: z.ZodNumber;
        baseSeq: z.ZodNumber;
        created: z.ZodArray<
          z.ZodObject<
            {
              id: z.ZodNumber;
              x: z.ZodNumber;
              y: z.ZodNumber;
              rot: z.ZodNumber;
              sx: z.ZodNumber;
              sy: z.ZodNumber;
              zIndex: z.ZodNumber;
              sprite: z.ZodOptional<z.ZodNumber>;
              tintR: z.ZodOptional<z.ZodNumber>;
              tintG: z.ZodOptional<z.ZodNumber>;
              tintB: z.ZodOptional<z.ZodNumber>;
              alpha: z.ZodOptional<z.ZodNumber>;
              frame: z.ZodOptional<z.ZodNumber>;
            },
            "strip",
            z.ZodTypeAny,
            {
              id: number;
              x: number;
              y: number;
              rot: number;
              sx: number;
              sy: number;
              zIndex: number;
              sprite?: number | undefined;
              tintR?: number | undefined;
              tintG?: number | undefined;
              tintB?: number | undefined;
              alpha?: number | undefined;
              frame?: number | undefined;
            },
            {
              id: number;
              x: number;
              y: number;
              rot: number;
              sx: number;
              sy: number;
              zIndex: number;
              sprite?: number | undefined;
              tintR?: number | undefined;
              tintG?: number | undefined;
              tintB?: number | undefined;
              alpha?: number | undefined;
              frame?: number | undefined;
            }
          >,
          "many"
        >;
        updated: z.ZodArray<
          z.ZodObject<
            {
              id: z.ZodNumber;
              x: z.ZodNumber;
              y: z.ZodNumber;
              rot: z.ZodNumber;
              sx: z.ZodNumber;
              sy: z.ZodNumber;
              zIndex: z.ZodNumber;
              sprite: z.ZodOptional<z.ZodNumber>;
              tintR: z.ZodOptional<z.ZodNumber>;
              tintG: z.ZodOptional<z.ZodNumber>;
              tintB: z.ZodOptional<z.ZodNumber>;
              alpha: z.ZodOptional<z.ZodNumber>;
              frame: z.ZodOptional<z.ZodNumber>;
            },
            "strip",
            z.ZodTypeAny,
            {
              id: number;
              x: number;
              y: number;
              rot: number;
              sx: number;
              sy: number;
              zIndex: number;
              sprite?: number | undefined;
              tintR?: number | undefined;
              tintG?: number | undefined;
              tintB?: number | undefined;
              alpha?: number | undefined;
              frame?: number | undefined;
            },
            {
              id: number;
              x: number;
              y: number;
              rot: number;
              sx: number;
              sy: number;
              zIndex: number;
              sprite?: number | undefined;
              tintR?: number | undefined;
              tintG?: number | undefined;
              tintB?: number | undefined;
              alpha?: number | undefined;
              frame?: number | undefined;
            }
          >,
          "many"
        >;
        removed: z.ZodArray<z.ZodNumber, "many">;
      },
      "strip",
      z.ZodTypeAny,
      {
        type: "DELTA";
        seq: number;
        baseSeq: number;
        created: {
          id: number;
          x: number;
          y: number;
          rot: number;
          sx: number;
          sy: number;
          zIndex: number;
          sprite?: number | undefined;
          tintR?: number | undefined;
          tintG?: number | undefined;
          tintB?: number | undefined;
          alpha?: number | undefined;
          frame?: number | undefined;
        }[];
        updated: {
          id: number;
          x: number;
          y: number;
          rot: number;
          sx: number;
          sy: number;
          zIndex: number;
          sprite?: number | undefined;
          tintR?: number | undefined;
          tintG?: number | undefined;
          tintB?: number | undefined;
          alpha?: number | undefined;
          frame?: number | undefined;
        }[];
        removed: number[];
      },
      {
        type: "DELTA";
        seq: number;
        baseSeq: number;
        created: {
          id: number;
          x: number;
          y: number;
          rot: number;
          sx: number;
          sy: number;
          zIndex: number;
          sprite?: number | undefined;
          tintR?: number | undefined;
          tintG?: number | undefined;
          tintB?: number | undefined;
          alpha?: number | undefined;
          frame?: number | undefined;
        }[];
        updated: {
          id: number;
          x: number;
          y: number;
          rot: number;
          sx: number;
          sy: number;
          zIndex: number;
          sprite?: number | undefined;
          tintR?: number | undefined;
          tintG?: number | undefined;
          tintB?: number | undefined;
          alpha?: number | undefined;
          frame?: number | undefined;
        }[];
        removed: number[];
      }
    >,
    z.ZodObject<
      {
        type: z.ZodLiteral<"DICE_ROLL_RESULT">;
        rollId: z.ZodString;
        userId: z.ZodString;
        displayName: z.ZodString;
        dice: z.ZodString;
        label: z.ZodOptional<z.ZodString>;
        total: z.ZodNumber;
        rolls: z.ZodArray<z.ZodNumber, "many">;
        modifier: z.ZodDefault<z.ZodNumber>;
        timestamp: z.ZodNumber;
        private: z.ZodDefault<z.ZodBoolean>;
      },
      "strip",
      z.ZodTypeAny,
      {
        type: "DICE_ROLL_RESULT";
        rollId: string;
        userId: string;
        displayName: string;
        dice: string;
        total: number;
        rolls: number[];
        modifier: number;
        timestamp: number;
        private: boolean;
        label?: string | undefined;
      },
      {
        type: "DICE_ROLL_RESULT";
        rollId: string;
        userId: string;
        displayName: string;
        dice: string;
        total: number;
        rolls: number[];
        timestamp: number;
        label?: string | undefined;
        modifier?: number | undefined;
        private?: boolean | undefined;
      }
    >,
    z.ZodObject<
      {
        type: z.ZodLiteral<"CHAT_BROADCAST">;
        messageId: z.ZodString;
        userId: z.ZodString;
        displayName: z.ZodString;
        message: z.ZodString;
        channel: z.ZodString;
        timestamp: z.ZodNumber;
      },
      "strip",
      z.ZodTypeAny,
      {
        type: "CHAT_BROADCAST";
        message: string;
        userId: string;
        displayName: string;
        timestamp: number;
        messageId: string;
        channel: string;
      },
      {
        type: "CHAT_BROADCAST";
        message: string;
        userId: string;
        displayName: string;
        timestamp: number;
        messageId: string;
        channel: string;
      }
    >,
    z.ZodObject<
      {
        type: z.ZodLiteral<"GAME_STATE">;
        gameId: z.ZodString;
        mapId: z.ZodOptional<z.ZodString>;
        players: z.ZodArray<
          z.ZodObject<
            {
              userId: z.ZodString;
              displayName: z.ZodString;
              connected: z.ZodBoolean;
            },
            "strip",
            z.ZodTypeAny,
            {
              userId: string;
              displayName: string;
              connected: boolean;
            },
            {
              userId: string;
              displayName: string;
              connected: boolean;
            }
          >,
          "many"
        >;
        turnOrder: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        currentTurn: z.ZodOptional<z.ZodString>;
        phase: z.ZodDefault<z.ZodEnum<["exploration", "combat", "downtime"]>>;
      },
      "strip",
      z.ZodTypeAny,
      {
        type: "GAME_STATE";
        gameId: string;
        players: {
          userId: string;
          displayName: string;
          connected: boolean;
        }[];
        phase: "exploration" | "combat" | "downtime";
        mapId?: string | undefined;
        turnOrder?: string[] | undefined;
        currentTurn?: string | undefined;
      },
      {
        type: "GAME_STATE";
        gameId: string;
        players: {
          userId: string;
          displayName: string;
          connected: boolean;
        }[];
        mapId?: string | undefined;
        turnOrder?: string[] | undefined;
        currentTurn?: string | undefined;
        phase?: "exploration" | "combat" | "downtime" | undefined;
      }
    >,
    z.ZodObject<
      {
        type: z.ZodLiteral<"PLAYER_JOINED">;
        userId: z.ZodString;
        displayName: z.ZodString;
        gameId: z.ZodString;
      },
      "strip",
      z.ZodTypeAny,
      {
        type: "PLAYER_JOINED";
        userId: string;
        displayName: string;
        gameId: string;
      },
      {
        type: "PLAYER_JOINED";
        userId: string;
        displayName: string;
        gameId: string;
      }
    >,
    z.ZodObject<
      {
        type: z.ZodLiteral<"PLAYER_LEFT">;
        userId: z.ZodString;
        gameId: z.ZodString;
      },
      "strip",
      z.ZodTypeAny,
      {
        type: "PLAYER_LEFT";
        userId: string;
        gameId: string;
      },
      {
        type: "PLAYER_LEFT";
        userId: string;
        gameId: string;
      }
    >,
  ]
>;
export type AnyServerMessage = z.infer<typeof AnyServerMessageSchema>;
export declare const MoveTokenMessageSchema: z.ZodObject<
  {
    type: z.ZodLiteral<"MOVE_TOKEN">;
    entityId: z.ZodNumber;
    x: z.ZodNumber;
    y: z.ZodNumber;
    animate: z.ZodDefault<z.ZodBoolean>;
  },
  "strip",
  z.ZodTypeAny,
  {
    type: "MOVE_TOKEN";
    x: number;
    y: number;
    entityId: number;
    animate: boolean;
  },
  {
    type: "MOVE_TOKEN";
    x: number;
    y: number;
    entityId: number;
    animate?: boolean | undefined;
  }
>;
export type MoveTokenMessage = z.infer<typeof MoveTokenMessageSchema>;
export declare const RollDiceMessageSchema: z.ZodObject<
  {
    type: z.ZodLiteral<"ROLL_DICE">;
    dice: z.ZodString;
    label: z.ZodOptional<z.ZodString>;
    private: z.ZodDefault<z.ZodBoolean>;
  },
  "strip",
  z.ZodTypeAny,
  {
    type: "ROLL_DICE";
    dice: string;
    private: boolean;
    label?: string | undefined;
  },
  {
    type: "ROLL_DICE";
    dice: string;
    label?: string | undefined;
    private?: boolean | undefined;
  }
>;
export type RollDiceMessage = z.infer<typeof RollDiceMessageSchema>;
export declare const ChatMessageSchema: z.ZodObject<
  {
    type: z.ZodLiteral<"CHAT_MESSAGE">;
    message: z.ZodString;
    channel: z.ZodDefault<z.ZodString>;
  },
  "strip",
  z.ZodTypeAny,
  {
    type: "CHAT_MESSAGE";
    message: string;
    channel: string;
  },
  {
    type: "CHAT_MESSAGE";
    message: string;
    channel?: string | undefined;
  }
>;
export type ChatMessage = z.infer<typeof ChatMessageSchema>;
export declare const JoinGameMessageSchema: z.ZodObject<
  {
    type: z.ZodLiteral<"JOIN_GAME">;
    gameId: z.ZodString;
    userId: z.ZodString;
    displayName: z.ZodString;
  },
  "strip",
  z.ZodTypeAny,
  {
    type: "JOIN_GAME";
    userId: string;
    displayName: string;
    gameId: string;
  },
  {
    type: "JOIN_GAME";
    userId: string;
    displayName: string;
    gameId: string;
  }
>;
export type JoinGameMessage = z.infer<typeof JoinGameMessageSchema>;
export declare const LeaveGameMessageSchema: z.ZodObject<
  {
    type: z.ZodLiteral<"LEAVE_GAME">;
    gameId: z.ZodString;
  },
  "strip",
  z.ZodTypeAny,
  {
    type: "LEAVE_GAME";
    gameId: string;
  },
  {
    type: "LEAVE_GAME";
    gameId: string;
  }
>;
export type LeaveGameMessage = z.infer<typeof LeaveGameMessageSchema>;
export declare const AnyClientMessageSchema: z.ZodUnion<
  [
    z.ZodObject<
      {
        type: z.ZodLiteral<"PING">;
        t: z.ZodOptional<z.ZodNumber>;
      },
      "strip",
      z.ZodTypeAny,
      {
        type: "PING";
        t?: number | undefined;
      },
      {
        type: "PING";
        t?: number | undefined;
      }
    >,
    z.ZodObject<
      {
        type: z.ZodLiteral<"ECHO">;
        payload: z.ZodString;
      },
      "strip",
      z.ZodTypeAny,
      {
        type: "ECHO";
        payload: string;
      },
      {
        type: "ECHO";
        payload: string;
      }
    >,
    z.ZodObject<
      {
        type: z.ZodLiteral<"MOVE_TOKEN">;
        entityId: z.ZodNumber;
        x: z.ZodNumber;
        y: z.ZodNumber;
        animate: z.ZodDefault<z.ZodBoolean>;
      },
      "strip",
      z.ZodTypeAny,
      {
        type: "MOVE_TOKEN";
        x: number;
        y: number;
        entityId: number;
        animate: boolean;
      },
      {
        type: "MOVE_TOKEN";
        x: number;
        y: number;
        entityId: number;
        animate?: boolean | undefined;
      }
    >,
    z.ZodObject<
      {
        type: z.ZodLiteral<"ROLL_DICE">;
        dice: z.ZodString;
        label: z.ZodOptional<z.ZodString>;
        private: z.ZodDefault<z.ZodBoolean>;
      },
      "strip",
      z.ZodTypeAny,
      {
        type: "ROLL_DICE";
        dice: string;
        private: boolean;
        label?: string | undefined;
      },
      {
        type: "ROLL_DICE";
        dice: string;
        label?: string | undefined;
        private?: boolean | undefined;
      }
    >,
    z.ZodObject<
      {
        type: z.ZodLiteral<"CHAT_MESSAGE">;
        message: z.ZodString;
        channel: z.ZodDefault<z.ZodString>;
      },
      "strip",
      z.ZodTypeAny,
      {
        type: "CHAT_MESSAGE";
        message: string;
        channel: string;
      },
      {
        type: "CHAT_MESSAGE";
        message: string;
        channel?: string | undefined;
      }
    >,
    z.ZodObject<
      {
        type: z.ZodLiteral<"JOIN_GAME">;
        gameId: z.ZodString;
        userId: z.ZodString;
        displayName: z.ZodString;
      },
      "strip",
      z.ZodTypeAny,
      {
        type: "JOIN_GAME";
        userId: string;
        displayName: string;
        gameId: string;
      },
      {
        type: "JOIN_GAME";
        userId: string;
        displayName: string;
        gameId: string;
      }
    >,
    z.ZodObject<
      {
        type: z.ZodLiteral<"LEAVE_GAME">;
        gameId: z.ZodString;
      },
      "strip",
      z.ZodTypeAny,
      {
        type: "LEAVE_GAME";
        gameId: string;
      },
      {
        type: "LEAVE_GAME";
        gameId: string;
      }
    >,
  ]
>;
export type AnyClientMessage = z.infer<typeof AnyClientMessageSchema>;
//# sourceMappingURL=messages.d.ts.map
