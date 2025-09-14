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
  } | undefined;
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
  } | null;
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
  joinSession: (sessionId: string) => Promise<void>;
  leaveSession: () => Promise<void>;
  createSession: (data: CreateSessionData) => Promise<void>;
  sendGameMessage: (message: any) => void;
  updatePlayerPermissions: (
    playerId: string,
    permissions: Partial<Player["permissions"]>,
  ) => void;
  kickPlayer: (playerId: string) => void;
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
  const { send, subscribe, isConnected, connect } = useWebSocket();

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
    if (!isConnected) {
      // Set connection status when WebSocket is disconnected but don't clear session
      setState((prev) => ({
        ...prev,
        connectionStatus: "disconnected",
      }));
      return;
    }

    setState((prev) => ({
      ...prev,
      connectionStatus: "connected",
    }));
  }, [isConnected]);

  // Subscribe to game-related WebSocket messages
  useEffect(() => {
    if (!isConnected) {return;}

    const unsubscribers = [
      // Handle actual core schema messages
      // Legacy/game-state style updates (kept for compatibility)
      subscribe("GAME_STATE", (message) => {
        logger.info("Received GAME_STATE:", message);
        // Convert GAME_STATE message to session format
        if (message.gameId && message.players) {
          const sessionData: GameSession = {
            id: message.gameId,
            name: `Game Session ${message.gameId}`,
            description: "Active game session",
            gamemaster: {
              id: `gm-${  message.gameId}`,
              username: "gamemaster",
              displayName: "Game Master",
            },
            players: message.players.map((p: any, index: number) => ({
              id: `player-${index}`,
              userId: p.userId || `unknown-${index}`,
              username: (p.displayName || `Player${index}`).toLowerCase().replace(/\s+/g, '_'),
              displayName: p.displayName || `Player ${index + 1}`,
              character: p.character || null, // Character data from server or null
              isConnected: p.connected ?? true,
              permissions: {
                canMoveTokens: true,
                canEditCharacter: true,
                canRollDice: true,
                canUseChat: true,
              },
              joinedAt: new Date().toISOString(),
            })),
            status: message.phase === "combat" ? "active" : "waiting",
            settings: {
              maxPlayers: 6,
              isPrivate: false,
              allowSpectators: true,
              voiceChatEnabled: false,
            },
            createdAt: new Date().toISOString(),
            lastActivity: new Date().toISOString(),
          };

          // Only update state if user is authenticated and has valid ID
          if (user?.id) {
            // Determine GM status with consistent logic
            const isGM = message.gamemaster?.userId === user.id || 
                        message.isGM === true ||
                        sessionData.gamemaster.id === user.id;
            
            // Check if user is a regular player (not including GM)
            const isRegularPlayer = message.players.some((p: any) => p.userId === user.id);
            
            setState((prev) => ({
              ...prev,
              session: sessionData,
              isGM,
              isPlayer: isGM || isRegularPlayer, // GM is always considered a player
              isSpectator: !isGM && !isRegularPlayer, // Not GM and not in players list = spectator
              connectionStatus: "connected",
              isLoading: false, // Clear loading state when we get game state
            }));
          } else {
            logger.warn("Received GAME_STATE but user not properly authenticated - ignoring");
          }
        }
      }),

      // Server-side session join confirmation
      subscribe("SESSION_JOINED", async (message) => {
        try {
          const sessionId = message?.session?.id;
          if (!sessionId) {return;}

          // Prefer fetching full session details via HTTP API
          const { sessionsService } = await import('../services/sessions');
          const apiSession = await sessionsService.getSession(sessionId);

          const fallbackName = message?.session?.name || `Game Session ${sessionId}`;
          const nowIso = new Date().toISOString();

          // Map API shape to in-memory GameSession shape
          const sessionData: GameSession = apiSession
            ? {
                id: apiSession.id,
                name: apiSession.name,
                description: apiSession.description,
                gamemaster: apiSession.gamemaster,
                players: (apiSession.players || []).map((p, index) => ({
                  id: p.id,
                  userId: p.id || `unknown-${index}`,
                  username: p.username,
                  displayName: p.displayName,
                  character: null,
                  isConnected: false,
                  permissions: {
                    canMoveTokens: true,
                    canEditCharacter: true,
                    canRollDice: true,
                    canUseChat: true,
                  },
                  joinedAt: nowIso,
                })),
                currentScene: undefined,
                status: apiSession.status,
                settings: {
                  maxPlayers: apiSession.settings.maxPlayers,
                  isPrivate: apiSession.settings.isPrivate,
                  allowSpectators: apiSession.settings.allowSpectators,
                  voiceChatEnabled: false,
                },
                createdAt: apiSession.createdAt,
                lastActivity: apiSession.lastActivity,
              }
            : {
                id: sessionId,
                name: fallbackName,
                description: "Active game session",
                gamemaster: {
                  id: user?.id || 'unknown',
                  username: user?.username || 'gamemaster',
                  displayName: user?.displayName || 'Game Master',
                },
                players: [],
                currentScene: undefined,
                status: (message?.session?.status?.toLowerCase?.() as any) || 'active',
                settings: {
                  maxPlayers: 6,
                  isPrivate: false,
                  allowSpectators: true,
                  voiceChatEnabled: false,
                },
                createdAt: nowIso,
                lastActivity: nowIso,
              };

          setState((prev) => ({
            ...prev,
            session: sessionData,
            isGM: sessionData.gamemaster.id === user?.id,
            isPlayer: true,
            isSpectator: false,
            connectionStatus: "connected",
            isLoading: false,
          }));
        } catch (err) {
          logger.error("Failed handling SESSION_JOINED:", err as any);
        }
      }),

      subscribe("PLAYER_JOINED", (message) => {
        setState((prev) => {
          if (!prev.session) {return prev;}

          const newPlayer: Player = {
            id: `player-${Date.now()}`,
            userId: message.userId || `unknown-${Date.now()}`,
            username: (message.displayName || 'Unknown Player').toLowerCase().replace(/\s+/g, '_'),
            displayName: message.displayName || 'Unknown Player',
            ...(message.avatar && { avatar: message.avatar }), // Only include avatar if provided
            character: message.character || null, // Load actual character data from server
            isConnected: true,
            permissions: {
              canMoveTokens: true,
              canEditCharacter: true,
              canRollDice: true,
              canUseChat: true,
            },
            joinedAt: new Date().toISOString(),
          };

          const updatedSession = {
            ...prev.session,
            players: [...prev.session.players, newPlayer],
          };

          return { ...prev, session: updatedSession };
        });
      }),

      subscribe("PLAYER_LEFT", (message) => {
        setState((prev) => {
          if (!prev.session) {return prev;}

          const updatedSession = {
            ...prev.session,
            players: prev.session.players.filter((p) => p.userId !== message.userId),
          };

          // If the leaving player was the current user, update status accordingly
          const isCurrentUser = user?.id && message.userId === user.id;
          
          // If current user left, they become spectator (unless they're still GM)
          const newIsPlayer = isCurrentUser ? prev.isGM : prev.isPlayer;
          const newIsSpectator = isCurrentUser ? !prev.isGM : prev.isSpectator;
          
          return { 
            ...prev, 
            session: updatedSession,
            isPlayer: newIsPlayer,
            isSpectator: newIsSpectator,
          };
        });
      }),

      subscribe("ERROR", (message) => {
        const msg = message?.error || message?.message || "An unknown game error occurred";
        setError(msg);
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
        // Ensure the server authorizes the join via HTTP first (mirrors Dashboard flow)
        try {
          const { sessionsService } = await import('../services/sessions');
          await sessionsService.joinSession(sessionId);
          logger.info(`HTTP join authorized for session ${sessionId}`);
        } catch (httpError: any) {
          logger.error("HTTP join failed:", httpError);
          // Provide clear UI feedback and abort WS join
          const msg = httpError?.message || 'Failed to join session';
          setError(msg);
          setLoading(false);
          return; // CRITICAL: Stop here if HTTP authorization fails
        }

        // Ensure connection before proceeding
        if (!isConnected) {
          connect();
          // Wait for connection to establish
          await new Promise<void>((resolve) => {
            let timeoutId: ReturnType<typeof setTimeout>;
            const checkConnection = setInterval(() => {
              if (isConnected) {
                clearInterval(checkConnection);
                clearTimeout(timeoutId);
                resolve();
              }
            }, 100);
            // Timeout after 5 seconds
            timeoutId = setTimeout(() => {
              clearInterval(checkConnection);
              resolve();
            }, 5000);
          });
        }

        if (!isConnected) {
          setError("Unable to establish WebSocket connection");
          setLoading(false);
          return;
        }

        // Authenticate WebSocket connection with access token
        const token = localStorage.getItem('accessToken');
        if (token) {
          send({ type: "AUTHENTICATE", token } as any);
          // Wait for authentication confirmation
          await new Promise((resolve) => setTimeout(resolve, 500));
        }

        // Setup error handler for WebSocket join failures
        let joinSuccessful = false;
        let timeoutId: ReturnType<typeof setTimeout> | null = null;
        
        const errorHandler = subscribe("ERROR", (message) => {
          const errorMsg = message?.error || message?.message || "WebSocket join failed";
          logger.error("WebSocket join error:", errorMsg);
          setError(errorMsg);
          setLoading(false);
          joinSuccessful = true; // Prevent timeout from firing
          if (timeoutId) {clearTimeout(timeoutId);}
          errorHandler(); // Unsubscribe
        });

        // Setup success handler
        const successHandler = subscribe("SESSION_JOINED", (message) => {
          joinSuccessful = true;
          if (timeoutId) {clearTimeout(timeoutId);}
          successHandler(); // Unsubscribe
          errorHandler(); // Clean up error handler
        });

        // Request to join the session on the server
        send({ type: "JOIN_SESSION", sessionId } as any);
        logger.info("JOIN_SESSION message sent via WebSocket");

        // Wait for response with timeout
        timeoutId = setTimeout(() => {
          if (!joinSuccessful) {
            setError("Session join timed out - please try again");
            setLoading(false);
            successHandler(); // Clean up handlers
            errorHandler();
          }
          timeoutId = null;
        }, 3000);

      } catch (error) {
        logger.error("Error in joinSession:", error);
        setError("Failed to join session");
        setLoading(false);
      }
    },
    [isAuthenticated, user, setLoading, clearError, setError, send, isConnected, connect, subscribe],
  );

  const leaveSession = useCallback(async () => {
    if (!state.session || !user) {return;}

    try {
      // Inform server we're leaving the session
      send({ type: "LEAVE_SESSION" } as any);

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
        // Import sessionsService dynamically to avoid circular imports
        const { sessionsService } = await import('../services/sessions');
        
        // Create session via HTTP API first
        const newSession = await sessionsService.createSession({
          name: data.name,
          description: data.description,
          system: 'D&D 5e', // Default system - should be configurable
          maxPlayers: data.maxPlayers,
          isPrivate: data.isPrivate,
          allowSpectators: data.allowSpectators,
        });

        logger.info('Session created successfully:', newSession.id);
        
        // Store session data but don't update full state until WebSocket confirms
        const sessionData = {
          id: newSession.id,
          name: newSession.name,
          description: newSession.description,
          gamemaster: {
            id: newSession.gamemaster.id,
            username: newSession.gamemaster.username,
            displayName: newSession.gamemaster.displayName,
          },
          players: [], // Will be populated when users join via WebSocket
          currentScene: undefined,
          status: 'waiting' as const,
          settings: {
            ...newSession.settings,
            voiceChatEnabled: false, // Default voice chat setting
          },
          createdAt: newSession.createdAt,
          lastActivity: newSession.lastActivity,
        };
        
        // Auto-join the created session via WebSocket if connected
        if (isConnected) {
          // Send join message - GAME_STATE handler will update state when confirmed
          send({
            type: "JOIN_SESSION",
            sessionId: newSession.id,
          });
        } else {
          // No WebSocket connection, update state immediately
          setState((prev) => ({
            ...prev,
            session: sessionData,
            isGM: newSession.gamemaster.id === user.id,
            isPlayer: true,
            isSpectator: false,
          }));
        }
        
        setLoading(false);
      } catch (error: any) {
        logger.error('Failed to create session:', error);
        setError(error.message || "Failed to create session");
        setLoading(false);
      }
    },
    [isAuthenticated, user, setLoading, clearError, setError, isConnected, send],
  );

  const sendGameMessage = useCallback(
    (message: any) => {
      if (!state.session) {
        logger.warn("Cannot send game message: not in a session");
        return;
      }

      send({ type: "GAME_MESSAGE", data: { ...message, sessionId: state.session.id, userId: user?.id } } as any);
    },
    [state.session, user?.id, send],
  );

  const updatePlayerPermissions = useCallback(
    (playerId: string, permissions: Partial<Player["permissions"]>) => {
      if (!state.isGM) {
        setError("Only the game master can update player permissions");
        return;
      }

      sendGameMessage({
        type: "UPDATE_PLAYER_PERMISSIONS",
        playerId,
        permissions,
      });
    },
    [state.isGM, sendGameMessage, setError],
  );

  const kickPlayer = useCallback(
    (playerId: string) => {
      if (!state.isGM) {
        setError("Only the game master can kick players");
        return;
      }

      sendGameMessage({
        type: "KICK_PLAYER",
        playerId,
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
