/**
 * WebSocket Provider - Manages real-time communication with game server
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { logger } from "@vtt/logging";
import { WSClient, WSState } from "../net/ws";
// Type definitions for WebSocket messages
type AnyServerMessage = {
  type: string;
  [key: string]: any;
};

type AnyClientMessage = {
  type: string;
  timestamp?: number;
  [key: string]: any;
};

interface WebSocketContextType {
  state: WSState;
  isConnected: boolean;
  latency: number;
  send: (message: AnyClientMessage) => void;
  subscribe: (type: string, handler: (message: any) => void) => () => void;
  connect: () => void;
  disconnect: () => void;
  reconnect: () => void;
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

export function useWebSocket() {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error("useWebSocket must be used within a WebSocketProvider");
  }
  return context;
}

interface WebSocketProviderProps {
  children: React.ReactNode;
  wsUrl: string;
}

interface MessageHandler {
  type: string;
  handler: (message: any) => void;
}

export function WebSocketProvider({ children, wsUrl }: WebSocketProviderProps) {
  const [state, setState] = useState<WSState>("disconnected");
  const [latency, setLatency] = useState<number>(0);
  const clientRef = useRef<WSClient | null>(null);
  const handlersRef = useRef<MessageHandler[]>([]);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef<number>(0);

  const isConnected = state === "open";

  // Track latency through WSClient's built-in ping mechanism
  const latencyRef = useRef<number>(0);

  const scheduleReconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {return;}

    const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
    reconnectAttemptsRef.current++;

    reconnectTimeoutRef.current = setTimeout(() => {
      reconnectTimeoutRef.current = null;
      connect();
    }, delay);
  }, []);

  const cancelReconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    reconnectAttemptsRef.current = 0;
  }, []);

  const connect = useCallback(() => {
    if (clientRef.current) {
      clientRef.current.close();
    }

    const client = new WSClient(wsUrl, {
      autoReconnect: true,
      reconnectBaseMs: 1000,
      reconnectMaxMs: 30000,
      pingIntervalMs: 15000
    });
    clientRef.current = client;

    client.onState((newState) => {
      setState(newState);

      if (newState === "open") {
        logger.info("WebSocket connected");
        cancelReconnect();
      } else if (newState === "disconnected") {
        logger.info("WebSocket disconnected");

        // Auto-reconnect unless explicitly disconnected
        if (reconnectAttemptsRef.current < 10) {
          scheduleReconnect();
        }
      }
    });

    client.onMessage((message: AnyServerMessage) => {
      // Handle system messages
      if (message.type === "PONG" && typeof message.t === "number") {
        const now = Date.now();
        const roundTripTime = now - message.t;
        latencyRef.current = roundTripTime;
        setLatency(roundTripTime);
        return;
      }

      if (message.type === "ERROR") {
        logger.error("WebSocket error:", message);
        return;
      }

      // Distribute message to registered handlers
      handlersRef.current.forEach(({ type, handler }) => {
        if (type === message.type || type === "*") {
          try {
            handler(message);
          } catch (error) {
            logger.error(`Error in message handler for ${message.type}:`, error);
          }
        }
      });
    });

    client.connect();
  }, [wsUrl, cancelReconnect, scheduleReconnect]);

  const disconnect = useCallback(() => {
    cancelReconnect();

    if (clientRef.current) {
      clientRef.current.close();
      clientRef.current = null;
    }

    setState("disconnected");
  }, [cancelReconnect]);

  const reconnect = useCallback(() => {
    disconnect();
    setTimeout(connect, 100);
  }, [disconnect, connect]);

  const send = useCallback(
    (message: AnyClientMessage) => {
      if (clientRef.current && isConnected) {
        // WSClient.send() handles validation internally, so we can safely cast
        const success = clientRef.current.send(message as any);
        if (!success) {
          logger.warn("Failed to send message - invalid format or connection issue", message);
          // Attempt to reconnect if send fails
          if (reconnectAttemptsRef.current < 5) {
            logger.info("Attempting to reconnect WebSocket after send failure");
            reconnect();
          }
        }
        return success;
      } else {
        logger.warn("Cannot send message: WebSocket not connected", message);
        // Attempt connection if not connected and message is critical
        if (message.type === "JOIN_GAME" || message.type === "LEAVE_GAME") {
          logger.info("Attempting to connect WebSocket for critical message");
          connect();
        }
        return false;
      }
    },
    [isConnected, reconnect, connect],
  );

  const subscribe = useCallback((type: string, handler: (message: any) => void) => {
    const messageHandler: MessageHandler = { type, handler };
    handlersRef.current.push(messageHandler);

    return () => {
      const index = handlersRef.current.indexOf(messageHandler);
      if (index > -1) {
        handlersRef.current.splice(index, 1);
      }
    };
  }, []);

  // Auto-connect on mount with retry logic
  useEffect(() => {
    const connectWithRetry = async () => {
      try {
        connect();
      } catch (error) {
        logger.error("Initial WebSocket connection failed:", error);
        // Don't prevent app from loading if WebSocket fails
      }
    };

    connectWithRetry();

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  // Handle page visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && !isConnected) {
        // Page visible and disconnected, try to reconnect
        connect();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [isConnected, connect]);

  // Handle online/offline events
  useEffect(() => {
    const handleOnline = () => {
      if (!isConnected) {
        connect();
      }
    };

    const handleOffline = () => {
      // Don't disconnect immediately, but stop trying to reconnect
      cancelReconnect();
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [isConnected, connect, cancelReconnect]);

  const contextValue: WebSocketContextType = {
    state,
    isConnected,
    latency,
    send,
    subscribe,
    connect,
    disconnect,
    reconnect,
  };

  return <WebSocketContext.Provider value={contextValue}>{children}</WebSocketContext.Provider>;
}
