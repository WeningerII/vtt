/**
 * Sessions Service - API client for game session management
 */

import { apiClient } from "../lib/api-client";
import { logger } from "@vtt/logging";

export interface GameSessionInfo {
  id: string;
  name: string;
  description: string;
  gamemaster: {
    id: string;
    username: string;
    displayName: string;
  };
  players: Array<{
    id: string;
    username: string;
    displayName: string;
  }>;
  maxPlayers: number;
  system: string;
  status: "waiting" | "active" | "paused" | "ended";
  settings: {
    maxPlayers: number;
    isPrivate: boolean;
    allowSpectators: boolean;
  };
  createdAt: string;
  lastActivity: string;
}

export interface CreateSessionRequest {
  name: string;
  description: string;
  system: string;
  maxPlayers: number;
  isPrivate: boolean;
  allowSpectators: boolean;
}

export interface SessionsFilter {
  status?: "all" | "active" | "waiting" | "joinable";
  system?: string;
  isPrivate?: boolean;
}

class SessionsService {
  /**
   * Fetch all available game sessions
   */
  async getSessions(filter: SessionsFilter = {}): Promise<GameSessionInfo[]> {
    try {
      const params = new URLSearchParams();
      
      if (filter.status && filter.status !== "all") {
        if (filter.status === "joinable") {
          params.append("status", "waiting");
          params.append("isPrivate", "false");
        } else {
          params.append("status", filter.status);
        }
      }
      
      if (filter.system) {
        params.append("system", filter.system);
      }
      
      if (filter.isPrivate !== undefined) {
        params.append("isPrivate", filter.isPrivate.toString());
      }

      const response = await apiClient.get<GameSessionInfo[]>(
        `/sessions?${params.toString()}`
      );

      // Handle ApiResponse format: response.data is the ApiResponse object
      const apiResponse = response.data;
      const sessions = apiResponse.data || [];
      
      // Ensure we always return an array
      return Array.isArray(sessions) ? sessions : [];
    } catch (error: any) {
      logger.error("Failed to fetch sessions:", error);
      
      // Check if this is an authentication error
      if (error.response?.status === 401) {
        logger.warn("Authentication required to fetch sessions");
        throw new Error("Please log in to view game sessions");
      }
      
      // Check if this is a network error
      if (!error.response) {
        logger.warn("Network error fetching sessions - using fallback data");
        return this.getFallbackSessions();
      }
      
      // For other errors, still throw to let the UI handle them
      throw error;
    }
  }

  /**
   * Get a specific session by ID
   */
  async getSession(sessionId: string): Promise<GameSessionInfo | null> {
    try {
      const response = await apiClient.get<GameSessionInfo>(`/sessions/${sessionId}`);
      // Handle ApiResponse format
      const apiResponse = response.data;
      const sessionData = apiResponse.data;
      // Ensure we return the correct type or null
      return (sessionData && typeof sessionData === 'object' && 'id' in sessionData) 
        ? sessionData 
        : null;
    } catch (error) {
      logger.error(`Failed to fetch session ${sessionId}:`, error);
      return null;
    }
  }

  /**
   * Create a new game session
   */
  async createSession(sessionData: CreateSessionRequest): Promise<GameSessionInfo> {
    try {
      const response = await apiClient.post<GameSessionInfo>("/sessions", sessionData);
      
      // Handle ApiResponse format: response.data is the ApiResponse object
      const apiResponse = response.data;
      if (apiResponse.success === false) {
        throw new Error(apiResponse.error || "Failed to create session");
      }

      // Extract session data from ApiResponse
      const createdSession = apiResponse.data;
      if (!createdSession || typeof createdSession !== 'object' || !('id' in createdSession)) {
        throw new Error("Invalid response: no session data received");
      }

      logger.info("Session created successfully:", createdSession.id);
      return createdSession;
    } catch (error: any) {
      logger.error("Failed to create session:", error);
      
      // Provide more specific error messages
      if (error.response?.status === 401) {
        throw new Error("Please log in to create a session");
      }
      if (error.response?.status === 403) {
        throw new Error("You don't have permission to create sessions");
      }
      if (error.response?.status === 400) {
        throw new Error(error.response.data?.error || "Invalid session data");
      }
      
      throw error;
    }
  }

  /**
   * Join a game session
   */
  async joinSession(sessionId: string): Promise<void> {
    try {
      const response = await apiClient.post(`/sessions/${sessionId}/join`);
      
      // Handle ApiResponse format
      const apiResponse = response.data;
      if (apiResponse.success === false) {
        throw new Error(apiResponse.error || "Failed to join session");
      }
      
      logger.info(`Successfully joined session: ${sessionId}`);
    } catch (error: any) {
      logger.error(`Failed to join session ${sessionId}:`, error);
      
      // Provide more specific error messages
      if (error.response?.status === 401) {
        throw new Error("Please log in to join a session");
      }
      if (error.response?.status === 403) {
        throw new Error("This session is private or you don't have permission to join");
      }
      if (error.response?.status === 409) {
        throw new Error("Session is full or you're already in this session");
      }
      if (error.response?.status === 404) {
        throw new Error("Session not found - it may have ended or been deleted");
      }
      
      throw error;
    }
  }

  /**
   * Leave a game session
   */
  async leaveSession(sessionId: string): Promise<void> {
    try {
      const response = await apiClient.post(`/sessions/${sessionId}/leave`);
      
      // Handle ApiResponse format
      const apiResponse = response.data;
      if (apiResponse.success === false) {
        throw new Error(apiResponse.error || "Failed to leave session");
      }
    } catch (error) {
      logger.error(`Failed to leave session ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * Update session settings (GM only)
   */
  async updateSession(sessionId: string, updates: Partial<CreateSessionRequest>): Promise<GameSessionInfo> {
    try {
      const response = await apiClient.patch<GameSessionInfo>(`/sessions/${sessionId}`, updates);
      
      // Handle ApiResponse format
      const apiResponse = response.data;
      if (apiResponse.success === false) {
        throw new Error(apiResponse.error || "Failed to update session");
      }

      // Extract session data from ApiResponse
      const updatedSession = apiResponse.data;
      if (!updatedSession || typeof updatedSession !== 'object' || !('id' in updatedSession)) {
        throw new Error("Invalid response: no session data received");
      }

      return updatedSession;
    } catch (error) {
      logger.error(`Failed to update session ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * Delete a session (GM only)
   */
  async deleteSession(sessionId: string): Promise<void> {
    try {
      const response = await apiClient.delete(`/sessions/${sessionId}`);
      
      // Handle ApiResponse format
      const apiResponse = response.data;
      if (apiResponse.success === false) {
        throw new Error(apiResponse.error || "Failed to delete session");
      }
    } catch (error) {
      logger.error(`Failed to delete session ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * Fallback mock data for development/testing
   * This provides a graceful fallback when the API is not yet available
   */
  private getFallbackSessions(): GameSessionInfo[] {
    return [
      {
        id: "session-1",
        name: "Lost Mine of Phandelver",
        description: "A classic D&D 5e adventure for new players. Join us for an epic journey through the forgotten mines!",
        gamemaster: {
          id: "gm-1",
          username: "dungeonmaster",
          displayName: "The Dungeon Master",
        },
        players: [
          {
            id: "player-1",
            username: "aragorn_ranger",
            displayName: "Aragorn",
          },
          {
            id: "player-2", 
            username: "legolas_archer",
            displayName: "Legolas",
          },
        ],
        maxPlayers: 6,
        system: "D&D 5e",
        status: "waiting",
        settings: {
          maxPlayers: 6,
          isPrivate: false,
          allowSpectators: true,
        },
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
        lastActivity: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 minutes ago
      },
      {
        id: "session-2",
        name: "Curse of Strahd",
        description: "A gothic horror campaign in the mysterious land of Barovia. Experienced players preferred.",
        gamemaster: {
          id: "gm-2",
          username: "gothic_master",
          displayName: "Master of Darkness",
        },
        players: [
          {
            id: "player-3",
            username: "paladin_light",
            displayName: "Sir Galahad",
          },
          {
            id: "player-4",
            username: "rogue_shadow",
            displayName: "Shadowstep",
          },
          {
            id: "player-5",
            username: "wizard_arcane",
            displayName: "Merlin",
          },
        ],
        maxPlayers: 5,
        system: "D&D 5e",
        status: "active",
        settings: {
          maxPlayers: 5,
          isPrivate: false,
          allowSpectators: true,
        },
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
        lastActivity: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 minutes ago
      },
      {
        id: "session-3",
        name: "Cyberpunk 2077: Night City Chronicles",
        description: "High-tech, low-life adventures in the dark future of Night City.",
        gamemaster: {
          id: "gm-3",
          username: "cyber_runner",
          displayName: "NetRunner",
        },
        players: [],
        maxPlayers: 4,
        system: "Cyberpunk Red",
        status: "waiting",
        settings: {
          maxPlayers: 4,
          isPrivate: true,
          allowSpectators: false,
        },
        createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(), // 6 hours ago
        lastActivity: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // 1 hour ago
      },
    ];
  }
}

// Export singleton instance
export const sessionsService = new SessionsService();
