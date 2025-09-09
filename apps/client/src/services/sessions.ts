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
      // CRITICAL: Don't log the raw error object if it's empty - it crashes React
      const errorToLog = error instanceof Error ? error : 
                        error?.message ? { message: error.message } : 
                        { message: 'Unknown error', raw: String(error) };
      logger.error("Failed to fetch sessions:", errorToLog);
      
      // Check if this is an authentication error
      if (error?.response?.status === 401) {
        logger.warn("Authentication required to fetch sessions");
        throw new Error("Please log in to view game sessions");
      }
      
      // Check if this is a network error  
      if (error && !error.response && error.message) {
        throw new Error(error.message || "Network error fetching sessions. Check server availability and network.");
      }
      
      // Ensure we always throw a proper Error object, never undefined or empty objects
      if (error instanceof Error) {
        throw error;
      } else if (error?.message) {
        throw new Error(error.message);
      } else {
        throw new Error("Failed to fetch sessions. Please try again.");
      }
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
    } catch (error: any) {
      logger.error(`Failed to fetch session ${sessionId}:`, error);
      // Return null instead of throwing to avoid crashing the app
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
      
      // Ensure proper Error object
      if (error instanceof Error) {
        throw error;
      } else if (error?.message) {
        throw new Error(error.message);
      } else {
        throw new Error("Operation failed");
      }
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
      
      // Ensure proper Error object
      if (error instanceof Error) {
        throw error;
      } else if (error?.message) {
        throw new Error(error.message);
      } else {
        throw new Error("Operation failed");
      }
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
    } catch (error: any) {
      logger.error(`Failed to leave session ${sessionId}:`, error);
      // Ensure proper Error object
      if (error instanceof Error) {
        throw error;
      } else if (error?.message) {
        throw new Error(error.message);
      } else {
        throw new Error("Operation failed");
      }
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
    } catch (error: any) {
      logger.error(`Failed to update session ${sessionId}:`, error);
      // Ensure proper Error object
      if (error instanceof Error) {
        throw error;
      } else if (error?.message) {
        throw new Error(error.message);
      } else {
        throw new Error("Operation failed");
      }
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
    } catch (error: any) {
      logger.error(`Failed to delete session ${sessionId}:`, error);
      // Ensure proper Error object
      if (error instanceof Error) {
        throw error;
      } else if (error?.message) {
        throw new Error(error.message);
      } else {
        throw new Error("Operation failed");
      }
    }
  }

  // Removed fallback mock data - we should surface real errors, not hide them
}

// Export singleton instance
export const sessionsService = new SessionsService();
