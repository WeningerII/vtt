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
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef<number>(0);
  const lastPingRef = useRef<number>(0);

  const isConnected = state === "open";

  const startLatencyTracking = useCallback(() => {
    if (pingIntervalRef.current) return;

    pingIntervalRef.current = setInterval(() => {
      if (clientRef.current && isConnected) {
        lastPingRef.current = Date.now();
        clientRef.current.send({
          type: "PING",
          timestamp: lastPingRef.current,
        });
      }
    }, 30000); // Ping every 30 seconds
  }, [isConnected]);

  const stopLatencyTracking = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
  }, []);

  const scheduleReconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) return;

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

    const client = new WSClient(wsUrl);
    clientRef.current = client;

    client.onState((newState) => {
      setState(newState);

      if (newState === "open") {
        logger.info("WebSocket connected");
        cancelReconnect();
        startLatencyTracking();
      } else if (newState === "disconnected") {
        logger.info("WebSocket disconnected");
        stopLatencyTracking();

        // Auto-reconnect unless explicitly disconnected
        if (reconnectAttemptsRef.current < 10) {
          scheduleReconnect();
        }
      }
    });

    client.onMessage((message: AnyServerMessage) => {
      // Handle system messages
      if (message.type === "PONG") {
        const now = Date.now();
        const roundTripTime = now - lastPingRef.current;
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
  }, [wsUrl, cancelReconnect, startLatencyTracking, stopLatencyTracking, scheduleReconnect]);

  const disconnect = useCallback(() => {
    cancelReconnect();
    stopLatencyTracking();

    if (clientRef.current) {
      clientRef.current.close();
      clientRef.current = null;
    }

    setState("disconnected");
  }, [cancelReconnect, stopLatencyTracking]);

  const reconnect = useCallback(() => {
    disconnect();
    setTimeout(connect, 100);
  }, [disconnect, connect]);

  const send = useCallback(
    (message: AnyClientMessage) => {
      if (clientRef.current && isConnected) {
        clientRef.current.send(message);
      } else {
        logger.warn("Cannot send message: WebSocket not connected", message);
      }
    },
    [isConnected],
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

  // Auto-connect on mount
  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  // Handle page visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Page hidden, reduce activity
        stopLatencyTracking();
      } else {
        // Page visible, resume activity
        if (isConnected) {
          startLatencyTracking();
        } else {
          // Try to reconnect if disconnected while hidden
          connect();
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [isConnected, startLatencyTracking, stopLatencyTracking, connect]);

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
