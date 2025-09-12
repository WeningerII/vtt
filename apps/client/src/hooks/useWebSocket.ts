/**
 * DEPRECATED: Legacy WebSocket hook - DO NOT USE
 * 
 * This hook has been replaced by WebSocketProvider.
 * Use `import { useWebSocket } from "../providers/WebSocketProvider"` instead.
 * 
 * This file is kept temporarily to prevent import errors during migration.
 * It will be removed in a future cleanup.
 */

import { logger } from "@vtt/logging";

export interface VTTWebSocketMessage {
  type: string;
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
  socket: null;
  isConnected: false;
  isConnecting: false;
  send: (message: VTTWebSocketMessage) => void;
  lastMessage: null;
  error: string;
  connect: () => void;
  disconnect: () => void;
  connectedUsers: 0;
}

export const useWebSocket = (options: UseWebSocketOptions = {}): UseWebSocketReturn => {
  logger.error(
    "DEPRECATED: Legacy useWebSocket hook used. Please migrate to WebSocketProvider. " +
    "Import from '../providers/WebSocketProvider' instead."
  );

  const connect = () => {
    logger.warn("Legacy WebSocket hook connect() called - no operation performed");
  };

  const disconnect = () => {
    logger.warn("Legacy WebSocket hook disconnect() called - no operation performed");
  };

  const send = (message: VTTWebSocketMessage) => {
    logger.warn("Legacy WebSocket hook send() called - message not sent:", message);
  };

  return {
    socket: null,
    isConnected: false,
    isConnecting: false,
    send,
    lastMessage: null,
    error: "DEPRECATED: Use WebSocketProvider instead",
    connect,
    disconnect,
    connectedUsers: 0,
  };
};
