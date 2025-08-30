import { z } from "zod";
/**
 * WebSocket event schemas for real-time communication
 */
export declare const BaseEventSchema: z.ZodObject<{
    type: z.ZodString;
    sessionId: z.ZodString;
    userId: z.ZodString;
    timestamp: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    type: string;
    userId: string;
    timestamp: number;
    sessionId: string;
}, {
    type: string;
    userId: string;
    timestamp: number;
    sessionId: string;
}>;
export declare const TokenMoveEventSchema: z.ZodObject<{
    sessionId: z.ZodString;
    userId: z.ZodString;
    timestamp: z.ZodNumber;
} & {
    type: z.ZodLiteral<"TOKEN_MOVE">;
    payload: z.ZodObject<{
        tokenId: z.ZodString;
        position: z.ZodObject<{
            x: z.ZodNumber;
            y: z.ZodNumber;
            z: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            x: number;
            y: number;
            z?: number | undefined;
        }, {
            x: number;
            y: number;
            z?: number | undefined;
        }>;
        rotation: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        position: {
            x: number;
            y: number;
            z?: number | undefined;
        };
        tokenId: string;
        rotation?: number | undefined;
    }, {
        position: {
            x: number;
            y: number;
            z?: number | undefined;
        };
        tokenId: string;
        rotation?: number | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    type: "TOKEN_MOVE";
    payload: {
        position: {
            x: number;
            y: number;
            z?: number | undefined;
        };
        tokenId: string;
        rotation?: number | undefined;
    };
    userId: string;
    timestamp: number;
    sessionId: string;
}, {
    type: "TOKEN_MOVE";
    payload: {
        position: {
            x: number;
            y: number;
            z?: number | undefined;
        };
        tokenId: string;
        rotation?: number | undefined;
    };
    userId: string;
    timestamp: number;
    sessionId: string;
}>;
export declare const TokenCreateEventSchema: z.ZodObject<{
    sessionId: z.ZodString;
    userId: z.ZodString;
    timestamp: z.ZodNumber;
} & {
    type: z.ZodLiteral<"TOKEN_CREATE">;
    payload: z.ZodObject<{
        token: z.ZodObject<{
            id: z.ZodString;
            name: z.ZodString;
            textureId: z.ZodOptional<z.ZodString>;
            position: z.ZodObject<{
                x: z.ZodNumber;
                y: z.ZodNumber;
                z: z.ZodOptional<z.ZodNumber>;
            }, "strip", z.ZodTypeAny, {
                x: number;
                y: number;
                z?: number | undefined;
            }, {
                x: number;
                y: number;
                z?: number | undefined;
            }>;
            scale: z.ZodOptional<z.ZodObject<{
                x: z.ZodNumber;
                y: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                x: number;
                y: number;
            }, {
                x: number;
                y: number;
            }>>;
            rotation: z.ZodOptional<z.ZodNumber>;
            color: z.ZodOptional<z.ZodArray<z.ZodNumber, "many">>;
        }, "strip", z.ZodTypeAny, {
            id: string;
            name: string;
            position: {
                x: number;
                y: number;
                z?: number | undefined;
            };
            rotation?: number | undefined;
            textureId?: string | undefined;
            scale?: {
                x: number;
                y: number;
            } | undefined;
            color?: number[] | undefined;
        }, {
            id: string;
            name: string;
            position: {
                x: number;
                y: number;
                z?: number | undefined;
            };
            rotation?: number | undefined;
            textureId?: string | undefined;
            scale?: {
                x: number;
                y: number;
            } | undefined;
            color?: number[] | undefined;
        }>;
    }, "strip", z.ZodTypeAny, {
        token: {
            id: string;
            name: string;
            position: {
                x: number;
                y: number;
                z?: number | undefined;
            };
            rotation?: number | undefined;
            textureId?: string | undefined;
            scale?: {
                x: number;
                y: number;
            } | undefined;
            color?: number[] | undefined;
        };
    }, {
        token: {
            id: string;
            name: string;
            position: {
                x: number;
                y: number;
                z?: number | undefined;
            };
            rotation?: number | undefined;
            textureId?: string | undefined;
            scale?: {
                x: number;
                y: number;
            } | undefined;
            color?: number[] | undefined;
        };
    }>;
}, "strip", z.ZodTypeAny, {
    type: "TOKEN_CREATE";
    payload: {
        token: {
            id: string;
            name: string;
            position: {
                x: number;
                y: number;
                z?: number | undefined;
            };
            rotation?: number | undefined;
            textureId?: string | undefined;
            scale?: {
                x: number;
                y: number;
            } | undefined;
            color?: number[] | undefined;
        };
    };
    userId: string;
    timestamp: number;
    sessionId: string;
}, {
    type: "TOKEN_CREATE";
    payload: {
        token: {
            id: string;
            name: string;
            position: {
                x: number;
                y: number;
                z?: number | undefined;
            };
            rotation?: number | undefined;
            textureId?: string | undefined;
            scale?: {
                x: number;
                y: number;
            } | undefined;
            color?: number[] | undefined;
        };
    };
    userId: string;
    timestamp: number;
    sessionId: string;
}>;
export declare const TokenDeleteEventSchema: z.ZodObject<{
    sessionId: z.ZodString;
    userId: z.ZodString;
    timestamp: z.ZodNumber;
} & {
    type: z.ZodLiteral<"TOKEN_DELETE">;
    payload: z.ZodObject<{
        tokenId: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        tokenId: string;
    }, {
        tokenId: string;
    }>;
}, "strip", z.ZodTypeAny, {
    type: "TOKEN_DELETE";
    payload: {
        tokenId: string;
    };
    userId: string;
    timestamp: number;
    sessionId: string;
}, {
    type: "TOKEN_DELETE";
    payload: {
        tokenId: string;
    };
    userId: string;
    timestamp: number;
    sessionId: string;
}>;
export declare const GameStateSyncEventSchema: z.ZodObject<{
    sessionId: z.ZodString;
    userId: z.ZodString;
    timestamp: z.ZodNumber;
} & {
    type: z.ZodLiteral<"GAME_STATE_SYNC">;
    payload: z.ZodObject<{
        gameId: z.ZodString;
        state: z.ZodUnknown;
    }, "strip", z.ZodTypeAny, {
        gameId: string;
        state?: unknown;
    }, {
        gameId: string;
        state?: unknown;
    }>;
}, "strip", z.ZodTypeAny, {
    type: "GAME_STATE_SYNC";
    payload: {
        gameId: string;
        state?: unknown;
    };
    userId: string;
    timestamp: number;
    sessionId: string;
}, {
    type: "GAME_STATE_SYNC";
    payload: {
        gameId: string;
        state?: unknown;
    };
    userId: string;
    timestamp: number;
    sessionId: string;
}>;
export declare const UserJoinEventSchema: z.ZodObject<{
    sessionId: z.ZodString;
    userId: z.ZodString;
    timestamp: z.ZodNumber;
} & {
    type: z.ZodLiteral<"USER_JOIN">;
    payload: z.ZodObject<{
        user: z.ZodObject<{
            id: z.ZodString;
            name: z.ZodString;
            isGM: z.ZodOptional<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            id: string;
            name: string;
            isGM?: boolean | undefined;
        }, {
            id: string;
            name: string;
            isGM?: boolean | undefined;
        }>;
    }, "strip", z.ZodTypeAny, {
        user: {
            id: string;
            name: string;
            isGM?: boolean | undefined;
        };
    }, {
        user: {
            id: string;
            name: string;
            isGM?: boolean | undefined;
        };
    }>;
}, "strip", z.ZodTypeAny, {
    type: "USER_JOIN";
    payload: {
        user: {
            id: string;
            name: string;
            isGM?: boolean | undefined;
        };
    };
    userId: string;
    timestamp: number;
    sessionId: string;
}, {
    type: "USER_JOIN";
    payload: {
        user: {
            id: string;
            name: string;
            isGM?: boolean | undefined;
        };
    };
    userId: string;
    timestamp: number;
    sessionId: string;
}>;
export declare const UserLeaveEventSchema: z.ZodObject<{
    sessionId: z.ZodString;
    userId: z.ZodString;
    timestamp: z.ZodNumber;
} & {
    type: z.ZodLiteral<"USER_LEAVE">;
    payload: z.ZodObject<{
        userId: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        userId: string;
    }, {
        userId: string;
    }>;
}, "strip", z.ZodTypeAny, {
    type: "USER_LEAVE";
    payload: {
        userId: string;
    };
    userId: string;
    timestamp: number;
    sessionId: string;
}, {
    type: "USER_LEAVE";
    payload: {
        userId: string;
    };
    userId: string;
    timestamp: number;
    sessionId: string;
}>;
export declare const ChatMessageEventSchema: z.ZodObject<{
    sessionId: z.ZodString;
    userId: z.ZodString;
    timestamp: z.ZodNumber;
} & {
    type: z.ZodLiteral<"CHAT_MESSAGE">;
    payload: z.ZodObject<{
        message: z.ZodString;
        userName: z.ZodString;
        isPrivate: z.ZodOptional<z.ZodBoolean>;
        targetUserId: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        message: string;
        userName: string;
        isPrivate?: boolean | undefined;
        targetUserId?: string | undefined;
    }, {
        message: string;
        userName: string;
        isPrivate?: boolean | undefined;
        targetUserId?: string | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    type: "CHAT_MESSAGE";
    payload: {
        message: string;
        userName: string;
        isPrivate?: boolean | undefined;
        targetUserId?: string | undefined;
    };
    userId: string;
    timestamp: number;
    sessionId: string;
}, {
    type: "CHAT_MESSAGE";
    payload: {
        message: string;
        userName: string;
        isPrivate?: boolean | undefined;
        targetUserId?: string | undefined;
    };
    userId: string;
    timestamp: number;
    sessionId: string;
}>;
export declare const VTTEventSchema: z.ZodUnion<[z.ZodObject<{
    sessionId: z.ZodString;
    userId: z.ZodString;
    timestamp: z.ZodNumber;
} & {
    type: z.ZodLiteral<"TOKEN_MOVE">;
    payload: z.ZodObject<{
        tokenId: z.ZodString;
        position: z.ZodObject<{
            x: z.ZodNumber;
            y: z.ZodNumber;
            z: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            x: number;
            y: number;
            z?: number | undefined;
        }, {
            x: number;
            y: number;
            z?: number | undefined;
        }>;
        rotation: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        position: {
            x: number;
            y: number;
            z?: number | undefined;
        };
        tokenId: string;
        rotation?: number | undefined;
    }, {
        position: {
            x: number;
            y: number;
            z?: number | undefined;
        };
        tokenId: string;
        rotation?: number | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    type: "TOKEN_MOVE";
    payload: {
        position: {
            x: number;
            y: number;
            z?: number | undefined;
        };
        tokenId: string;
        rotation?: number | undefined;
    };
    userId: string;
    timestamp: number;
    sessionId: string;
}, {
    type: "TOKEN_MOVE";
    payload: {
        position: {
            x: number;
            y: number;
            z?: number | undefined;
        };
        tokenId: string;
        rotation?: number | undefined;
    };
    userId: string;
    timestamp: number;
    sessionId: string;
}>, z.ZodObject<{
    sessionId: z.ZodString;
    userId: z.ZodString;
    timestamp: z.ZodNumber;
} & {
    type: z.ZodLiteral<"TOKEN_CREATE">;
    payload: z.ZodObject<{
        token: z.ZodObject<{
            id: z.ZodString;
            name: z.ZodString;
            textureId: z.ZodOptional<z.ZodString>;
            position: z.ZodObject<{
                x: z.ZodNumber;
                y: z.ZodNumber;
                z: z.ZodOptional<z.ZodNumber>;
            }, "strip", z.ZodTypeAny, {
                x: number;
                y: number;
                z?: number | undefined;
            }, {
                x: number;
                y: number;
                z?: number | undefined;
            }>;
            scale: z.ZodOptional<z.ZodObject<{
                x: z.ZodNumber;
                y: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                x: number;
                y: number;
            }, {
                x: number;
                y: number;
            }>>;
            rotation: z.ZodOptional<z.ZodNumber>;
            color: z.ZodOptional<z.ZodArray<z.ZodNumber, "many">>;
        }, "strip", z.ZodTypeAny, {
            id: string;
            name: string;
            position: {
                x: number;
                y: number;
                z?: number | undefined;
            };
            rotation?: number | undefined;
            textureId?: string | undefined;
            scale?: {
                x: number;
                y: number;
            } | undefined;
            color?: number[] | undefined;
        }, {
            id: string;
            name: string;
            position: {
                x: number;
                y: number;
                z?: number | undefined;
            };
            rotation?: number | undefined;
            textureId?: string | undefined;
            scale?: {
                x: number;
                y: number;
            } | undefined;
            color?: number[] | undefined;
        }>;
    }, "strip", z.ZodTypeAny, {
        token: {
            id: string;
            name: string;
            position: {
                x: number;
                y: number;
                z?: number | undefined;
            };
            rotation?: number | undefined;
            textureId?: string | undefined;
            scale?: {
                x: number;
                y: number;
            } | undefined;
            color?: number[] | undefined;
        };
    }, {
        token: {
            id: string;
            name: string;
            position: {
                x: number;
                y: number;
                z?: number | undefined;
            };
            rotation?: number | undefined;
            textureId?: string | undefined;
            scale?: {
                x: number;
                y: number;
            } | undefined;
            color?: number[] | undefined;
        };
    }>;
}, "strip", z.ZodTypeAny, {
    type: "TOKEN_CREATE";
    payload: {
        token: {
            id: string;
            name: string;
            position: {
                x: number;
                y: number;
                z?: number | undefined;
            };
            rotation?: number | undefined;
            textureId?: string | undefined;
            scale?: {
                x: number;
                y: number;
            } | undefined;
            color?: number[] | undefined;
        };
    };
    userId: string;
    timestamp: number;
    sessionId: string;
}, {
    type: "TOKEN_CREATE";
    payload: {
        token: {
            id: string;
            name: string;
            position: {
                x: number;
                y: number;
                z?: number | undefined;
            };
            rotation?: number | undefined;
            textureId?: string | undefined;
            scale?: {
                x: number;
                y: number;
            } | undefined;
            color?: number[] | undefined;
        };
    };
    userId: string;
    timestamp: number;
    sessionId: string;
}>, z.ZodObject<{
    sessionId: z.ZodString;
    userId: z.ZodString;
    timestamp: z.ZodNumber;
} & {
    type: z.ZodLiteral<"TOKEN_DELETE">;
    payload: z.ZodObject<{
        tokenId: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        tokenId: string;
    }, {
        tokenId: string;
    }>;
}, "strip", z.ZodTypeAny, {
    type: "TOKEN_DELETE";
    payload: {
        tokenId: string;
    };
    userId: string;
    timestamp: number;
    sessionId: string;
}, {
    type: "TOKEN_DELETE";
    payload: {
        tokenId: string;
    };
    userId: string;
    timestamp: number;
    sessionId: string;
}>, z.ZodObject<{
    sessionId: z.ZodString;
    userId: z.ZodString;
    timestamp: z.ZodNumber;
} & {
    type: z.ZodLiteral<"GAME_STATE_SYNC">;
    payload: z.ZodObject<{
        gameId: z.ZodString;
        state: z.ZodUnknown;
    }, "strip", z.ZodTypeAny, {
        gameId: string;
        state?: unknown;
    }, {
        gameId: string;
        state?: unknown;
    }>;
}, "strip", z.ZodTypeAny, {
    type: "GAME_STATE_SYNC";
    payload: {
        gameId: string;
        state?: unknown;
    };
    userId: string;
    timestamp: number;
    sessionId: string;
}, {
    type: "GAME_STATE_SYNC";
    payload: {
        gameId: string;
        state?: unknown;
    };
    userId: string;
    timestamp: number;
    sessionId: string;
}>, z.ZodObject<{
    sessionId: z.ZodString;
    userId: z.ZodString;
    timestamp: z.ZodNumber;
} & {
    type: z.ZodLiteral<"USER_JOIN">;
    payload: z.ZodObject<{
        user: z.ZodObject<{
            id: z.ZodString;
            name: z.ZodString;
            isGM: z.ZodOptional<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            id: string;
            name: string;
            isGM?: boolean | undefined;
        }, {
            id: string;
            name: string;
            isGM?: boolean | undefined;
        }>;
    }, "strip", z.ZodTypeAny, {
        user: {
            id: string;
            name: string;
            isGM?: boolean | undefined;
        };
    }, {
        user: {
            id: string;
            name: string;
            isGM?: boolean | undefined;
        };
    }>;
}, "strip", z.ZodTypeAny, {
    type: "USER_JOIN";
    payload: {
        user: {
            id: string;
            name: string;
            isGM?: boolean | undefined;
        };
    };
    userId: string;
    timestamp: number;
    sessionId: string;
}, {
    type: "USER_JOIN";
    payload: {
        user: {
            id: string;
            name: string;
            isGM?: boolean | undefined;
        };
    };
    userId: string;
    timestamp: number;
    sessionId: string;
}>, z.ZodObject<{
    sessionId: z.ZodString;
    userId: z.ZodString;
    timestamp: z.ZodNumber;
} & {
    type: z.ZodLiteral<"USER_LEAVE">;
    payload: z.ZodObject<{
        userId: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        userId: string;
    }, {
        userId: string;
    }>;
}, "strip", z.ZodTypeAny, {
    type: "USER_LEAVE";
    payload: {
        userId: string;
    };
    userId: string;
    timestamp: number;
    sessionId: string;
}, {
    type: "USER_LEAVE";
    payload: {
        userId: string;
    };
    userId: string;
    timestamp: number;
    sessionId: string;
}>, z.ZodObject<{
    sessionId: z.ZodString;
    userId: z.ZodString;
    timestamp: z.ZodNumber;
} & {
    type: z.ZodLiteral<"CHAT_MESSAGE">;
    payload: z.ZodObject<{
        message: z.ZodString;
        userName: z.ZodString;
        isPrivate: z.ZodOptional<z.ZodBoolean>;
        targetUserId: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        message: string;
        userName: string;
        isPrivate?: boolean | undefined;
        targetUserId?: string | undefined;
    }, {
        message: string;
        userName: string;
        isPrivate?: boolean | undefined;
        targetUserId?: string | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    type: "CHAT_MESSAGE";
    payload: {
        message: string;
        userName: string;
        isPrivate?: boolean | undefined;
        targetUserId?: string | undefined;
    };
    userId: string;
    timestamp: number;
    sessionId: string;
}, {
    type: "CHAT_MESSAGE";
    payload: {
        message: string;
        userName: string;
        isPrivate?: boolean | undefined;
        targetUserId?: string | undefined;
    };
    userId: string;
    timestamp: number;
    sessionId: string;
}>]>;
export type VTTEvent = z.infer<typeof VTTEventSchema>;
export type TokenMoveEvent = z.infer<typeof TokenMoveEventSchema>;
export type TokenCreateEvent = z.infer<typeof TokenCreateEventSchema>;
export type TokenDeleteEvent = z.infer<typeof TokenDeleteEventSchema>;
export type GameStateSyncEvent = z.infer<typeof GameStateSyncEventSchema>;
export type UserJoinEvent = z.infer<typeof UserJoinEventSchema>;
export type UserLeaveEvent = z.infer<typeof UserLeaveEventSchema>;
export type ChatMessageEvent = z.infer<typeof ChatMessageEventSchema>;
//# sourceMappingURL=events.d.ts.map