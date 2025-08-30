/**
 * Game Provider - Manages game session state and real-time synchronization
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { logger } from "@vtt/logging";
import { useWebSocket } from "./WebSocketProvider";
import { useAuth } from "./AuthProvider";

export interface GameSession {
  id: string;
  name: string;
  description: string;
  gamemaster: {
    id: string;
    username: string;
    displayName: string;
  };
  players: Player[];
  currentScene?: {
    id: string;
    name: string;
    mapUrl?: string;
  };
  status: "waiting" | "active" | "paused" | "ended";
  settings: {
    maxPlayers: number;
    isPrivate: boolean;
    allowSpectators: boolean;
    voiceChatEnabled: boolean;
  };
  createdAt: string;
  lastActivity: string;
}

export interface Player {
  id: string;
  userId: string;
  username: string;
  displayName: string;
  avatar?: string;
  character?: {
    id: string;
    name: string;
    level: number;
    class: string;
    race: string;
    hitPoints: number;
    maxHitPoints: number;
  };
  isConnected: boolean;
  permissions: {
    canMoveTokens: boolean;
    canEditCharacter: boolean;
    canRollDice: boolean;
    canUseChat: boolean;
  };
  joinedAt: string;
}

export interface GameState {
  session: GameSession | null;
  isGM: boolean;
  isPlayer: boolean;
  isSpectator: boolean;
  isLoading: boolean;
  error: string | null;
  connectionStatus: "disconnected" | "connecting" | "connected" | "error";
}

interface GameContextType extends GameState {
  joinSession: (_sessionId: string) => Promise<void>;
  leaveSession: () => Promise<void>;
  createSession: (_data: CreateSessionData) => Promise<void>;
  sendGameMessage: (message: any) => void;
  updatePlayerPermissions: (
    _playerId: string,
    _permissions: Partial<Player["permissions"]>,
  ) => void;
  kickPlayer: (_playerId: string) => void;
  pauseSession: () => void;
  resumeSession: () => void;
  endSession: () => void;
}

interface CreateSessionData {
  name: string;
  description: string;
  maxPlayers: number;
  isPrivate: boolean;
  allowSpectators: boolean;
}

const GameContext = createContext<GameContextType | null>(null);

export function useGame() {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error("useGame must be used within a GameProvider");
  }
  return context;
}

interface GameProviderProps {
  children: React.ReactNode;
}

export function GameProvider({ children }: GameProviderProps) {
  const { user, isAuthenticated } = useAuth();
  const { send, subscribe, isConnected } = useWebSocket();

  const [state, setState] = useState<GameState>({
    session: null,
    isGM: false,
    isPlayer: false,
    isSpectator: false,
    isLoading: false,
    error: null,
    connectionStatus: "disconnected",
  });

  const setError = useCallback((error: string) => {
    setState((prev) => ({ ...prev, error, isLoading: false }));
  }, []);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  const setLoading = useCallback((isLoading: boolean) => {
    setState((prev) => ({ ...prev, isLoading }));
  }, []);

  // Update connection status based on WebSocket state
  useEffect(() => {
    setState((prev) => ({
      ...prev,
      connectionStatus: isConnected ? "connected" : "disconnected",
    }));
  }, [isConnected]);

  // Subscribe to game-related WebSocket messages
  useEffect(() => {
    if (!isConnected) return;

    const unsubscribers = [
      subscribe("GAME_SESSION_UPDATED", (message) => {
        setState((prev) => ({
          ...prev,
          session: message.session,
          isGM: message.session.gamemaster.id === user?.id,
          isPlayer: message.session.players.some((p: Player) => p.userId === user?.id),
          isSpectator:
            !message.session.players.some((p: Player) => p.userId === user?.id) &&
            message.session.gamemaster.id !== user?.id,
        }));
      }),

      subscribe("PLAYER_JOINED", (message) => {
        setState((prev) => {
          if (!prev.session) return prev;

          const updatedSession = {
            ...prev.session,
            players: [...prev.session.players, message.player],
          };

          return { ...prev, session: updatedSession };
        });
      }),

      subscribe("PLAYER_LEFT", (message) => {
        setState((prev) => {
          if (!prev.session) return prev;

          const updatedSession = {
            ...prev.session,
            players: prev.session.players.filter((p) => p.id !== message.playerId),
          };

          return { ...prev, session: updatedSession };
        });
      }),

      subscribe("PLAYER_UPDATED", (message) => {
        setState((prev) => {
          if (!prev.session) return prev;

          const updatedSession = {
            ...prev.session,
            players: prev.session.players.map((p) =>
              p.id === message.player.id ? message.player : p,
            ),
          };

          return { ...prev, session: updatedSession };
        });
      }),

      subscribe("SESSION_PAUSED", () => {
        setState((prev) => {
          if (!prev.session) return prev;
          return {
            ...prev,
            session: { ...prev.session, status: "paused" },
          };
        });
      }),

      subscribe("SESSION_RESUMED", () => {
        setState((prev) => {
          if (!prev.session) return prev;
          return {
            ...prev,
            session: { ...prev.session, status: "active" },
          };
        });
      }),

      subscribe("SESSION_ENDED", () => {
        setState((prev) => ({
          ...prev,
          session: null,
          isGM: false,
          isPlayer: false,
          isSpectator: false,
        }));
      }),

      subscribe("GAME_ERROR", (message) => {
        setError(message.error || "An unknown game error occurred");
      }),
    ];

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [isConnected, subscribe, user?.id, setError]);

  const joinSession = useCallback(
    async (sessionId: string) => {
      if (!isAuthenticated || !user) {
        setError("You must be logged in to join a session");
        return;
      }

      setLoading(true);
      clearError();

      try {
        send({
          type: "JOIN_SESSION",
          sessionId,
          userId: user.id,
        });
      } catch (_error) {
        setError("Failed to join session");
        setLoading(false);
      }
    },
    [isAuthenticated, user, setLoading, clearError, setError, send],
  );

  const leaveSession = useCallback(async () => {
    if (!state.session || !user) return;

    try {
      send({
        type: "LEAVE_SESSION",
        sessionId: state.session.id,
        userId: user.id,
      });

      setState((prev) => ({
        ...prev,
        session: null,
        isGM: false,
        isPlayer: false,
        isSpectator: false,
      }));
    } catch (_error) {
      setError("Failed to leave session");
    }
  }, [state.session, user, send, setError]);

  const createSession = useCallback(
    async (data: CreateSessionData) => {
      if (!isAuthenticated || !user) {
        setError("You must be logged in to create a session");
        return;
      }

      setLoading(true);
      clearError();

      try {
        send({
          type: "CREATE_SESSION",
          sessionData: {
            ...data,
            gamemasterId: user.id,
          },
        });
      } catch (_error) {
        setError("Failed to create session");
        setLoading(false);
      }
    },
    [isAuthenticated, user, setLoading, clearError, setError, send],
  );

  const sendGameMessage = useCallback(
    (message: any) => {
      if (!state.session) {
        logger.warn("Cannot send game message: not in a session");
        return;
      }

      send({
        ...message,
        sessionId: state.session.id,
        userId: user?.id,
      });
    },
    [state.session, user?.id, send],
  );

  const updatePlayerPermissions = useCallback(
    (_playerId: string, _permissions: Partial<Player["permissions"]>) => {
      if (!state.isGM) {
        setError("Only the game master can update player permissions");
        return;
      }

      sendGameMessage({
        type: "UPDATE_PLAYER_PERMISSIONS",
        playerId: _playerId,
        permissions: _permissions,
      });
    },
    [state.isGM, sendGameMessage, setError],
  );

  const kickPlayer = useCallback(
    (_playerId: string) => {
      if (!state.isGM) {
        setError("Only the game master can kick players");
        return;
      }

      sendGameMessage({
        type: "KICK_PLAYER",
        playerId: _playerId,
      });
    },
    [state.isGM, sendGameMessage, setError],
  );

  const pauseSession = useCallback(() => {
    if (!state.isGM) {
      setError("Only the game master can pause the session");
      return;
    }

    sendGameMessage({
      type: "PAUSE_SESSION",
    });
  }, [state.isGM, sendGameMessage, setError]);

  const resumeSession = useCallback(() => {
    if (!state.isGM) {
      setError("Only the game master can resume the session");
      return;
    }

    sendGameMessage({
      type: "RESUME_SESSION",
    });
  }, [state.isGM, sendGameMessage, setError]);

  const endSession = useCallback(() => {
    if (!state.isGM) {
      setError("Only the game master can end the session");
      return;
    }

    sendGameMessage({
      type: "END_SESSION",
    });
  }, [state.isGM, sendGameMessage, setError]);

  const contextValue: GameContextType = {
    ...state,
    joinSession,
    leaveSession,
    createSession,
    sendGameMessage,
    updatePlayerPermissions,
    kickPlayer,
    pauseSession,
    resumeSession,
    endSession,
  };

  return <GameContext.Provider value={contextValue}>{children}</GameContext.Provider>;
}
