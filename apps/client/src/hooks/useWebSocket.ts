/**
 * WebSocket hook for real-time VTT communication
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { logger } from "@vtt/logging";

export interface VTTWebSocketMessage {
  type:
    | "token_move"
    | "token_add"
    | "token_remove"
    | "scene_update"
    | "combat_update"
    | "user_join"
    | "user_leave"
    | "ping"
    | "pong"
    | "error";
  payload: any;
  sessionId: string;
  userId: string;
  timestamp: number;
}

interface UseWebSocketOptions {
  sessionId?: string;
  userId?: string;
  campaignId?: string;
  isGM?: boolean;
  autoConnect?: boolean;
  reconnectAttempts?: number;
  reconnectInterval?: number;
}

interface UseWebSocketReturn {
  socket: {
    emit: (event: string, data: any) => void;
    on: (event: string, callback: (data: any) => void) => void;
    off: (event: string, callback?: (data: any) => void) => void;
  } | null;
  isConnected: boolean;
  isConnecting: boolean;
  send: (message: VTTWebSocketMessage) => void;
  lastMessage: VTTWebSocketMessage | null;
  error: string | null;
  connect: () => void;
  disconnect: () => void;
  connectedUsers: number;
}

export const useWebSocket = (options: UseWebSocketOptions = {}): UseWebSocketReturn => {
  const {
    sessionId,
    userId,
    campaignId,
    isGM = false,
    autoConnect = true,
    reconnectAttempts = 5,
    reconnectInterval = 3000,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [lastMessage, setLastMessage] = useState<VTTWebSocketMessage | null>(null);
  const [connectedUsers, setConnectedUsers] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectCountRef = useRef(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    if (!sessionId || !userId || !campaignId) {
      setError("Missing required connection parameters");
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      // Determine WebSocket URL based on environment
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = process.env.REACT_APP_WS_URL || window.location.host;
      const wsUrl = `${protocol}//${host}/ws?sessionId=${sessionId}&userId=${userId}&campaignId=${campaignId}&isGM=${isGM}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        setIsConnecting(false);
        setError(null);
        reconnectCountRef.current = 0;
        logger.info("WebSocket connected");
      };

      ws.onmessage = (event) => {
        try {
          const message: VTTWebSocketMessage = JSON.parse(event.data);
          setLastMessage(message);

          // Update connected users count
          if (message.type === "user_join" || message.type === "user_leave") {
            setConnectedUsers(message.payload.userCount || 0);
          }

          // Trigger event listeners
          const listeners = eventListenersRef.current.get(message.type);
          if (listeners) {
            listeners.forEach(callback => {
              try {
                callback(message.payload);
              } catch (err) {
                logger.error(`Error in event listener for ${message.type}:`, err);
              }
            });
          }
        } catch (err) {
          logger.error("Failed to parse WebSocket message:", err);
        }
      };

      ws.onclose = (event) => {
        setIsConnected(false);
        setIsConnecting(false);
        logger.info("WebSocket disconnected:", event.code, event.reason);

        // Attempt to reconnect if not manually closed
        if (event.code !== 1000 && reconnectCountRef.current < reconnectAttempts) {
          reconnectCountRef.current += 1;
          reconnectTimeoutRef.current = setTimeout(() => {
            logger.info(`Reconnecting... (${reconnectCountRef.current}/${reconnectAttempts})`);
            connect();
          }, reconnectInterval);
        }
      };

      ws.onerror = (event) => {
        setError("WebSocket connection error");
        setIsConnecting(false);
        logger.error("WebSocket error:", event);
      };
    } catch (err: any) {
      setError(err.message);
      setIsConnecting(false);
    }
  }, [sessionId, userId, campaignId, isGM, reconnectAttempts, reconnectInterval]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close(1000, "Manual disconnect");
      wsRef.current = null;
    }

    setIsConnected(false);
    setIsConnecting(false);
    reconnectCountRef.current = 0;
  }, []);

  const send = useCallback((message: VTTWebSocketMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      logger.warn("WebSocket not connected, message not sent:", message);
    }
  }, []);

  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  // Event listeners management
  const eventListenersRef = useRef<Map<string, Set<(data: any) => void>>>(new Map());

  // Create socket-like interface for compatibility
  const socketInterface = {
    emit: (event: string, data: any) => {
      const message: VTTWebSocketMessage = {
        type: event as any,
        payload: data,
        sessionId: sessionId || "",
        userId: userId || "",
        timestamp: Date.now(),
      };
      send(message);
    },
    on: (event: string, callback: (data: any) => void) => {
      const listeners = eventListenersRef.current;
      if (!listeners.has(event)) {
        listeners.set(event, new Set());
      }
      listeners.get(event)!.add(callback);
    },
    off: (event: string, callback?: (data: any) => void) => {
      const listeners = eventListenersRef.current;
      if (listeners.has(event)) {
        if (callback) {
          listeners.get(event)!.delete(callback);
        } else {
          listeners.delete(event);
        }
      }
    },
  };

  return {
    socket: socketInterface,
    isConnected,
    isConnecting,
    send,
    lastMessage,
    error,
    connect,
    disconnect,
    connectedUsers,
  };
};
