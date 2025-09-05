import { useEffect, useRef, useState } from "react";
import { logger } from "@vtt/logging";
import { io, Socket } from "socket.io-client";

export interface SocketUser {
  id: string;
  displayName: string;
  campaignId?: string;
  sceneId?: string;
}

export interface UseSocketReturn {
  socket: Socket | null;
  isConnected: boolean;
  user: SocketUser | null;
  authenticate: (userId: string, campaignId?: string) => void;
  joinScene: (sceneId: string) => void;
  sendMessage: (text: string, channel?: string) => void;
}

export const useSocket = (): UseSocketReturn => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [user, setUser] = useState<SocketUser | null>(null);
  const reconnectTimeoutRef = useRef<number>(null);

  useEffect(() => {
    const serverUrl = (window as any).REACT_APP_SERVER_URL || "http://localhost:8080";
    const newSocket = io(serverUrl, {
      autoConnect: false,
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    });

    // Connection events
    newSocket.on("connect", () => {
      logger.info("Connected to server:", newSocket.id);
      setIsConnected(true);

      // Clear any reconnection timeout
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    });

    newSocket.on("disconnect", (reason) => {
      logger.info("Disconnected from server:", reason);
      setIsConnected(false);
      setUser(null);
    });

    newSocket.on("connect_error", (error) => {
      logger.error("Connection error:", error);
      setIsConnected(false);
    });

    // Authentication events
    newSocket.on("authenticated", (data: { user: SocketUser }) => {
      logger.info("Authenticated as:", data.user);
      setUser(data.user);
    });

    newSocket.on("auth_error", (data: { message: string }) => {
      logger.error("Authentication failed:", data.message);
      setUser(null);
    });

    // Error handling
    newSocket.on("error", (data: { message: string }) => {
      logger.error("Socket error:", data.message);
    });

    // Set up reconnection logic
    newSocket.on("reconnect", (attemptNumber) => {
      logger.info(`Reconnected after ${attemptNumber} attempts`);

      // Re-authenticate if we had a user before
      const savedUser = localStorage.getItem("vtt_user");
      const savedCampaign = localStorage.getItem("vtt_campaign");

      if (savedUser && savedCampaign) {
        const userData = JSON.parse(savedUser);
        const campaignData = JSON.parse(savedCampaign);
        newSocket.emit("authenticate", {
          userId: userData.id,
          campaignId: campaignData.id,
        });
      }
    });

    newSocket.on("reconnect_failed", () => {
      logger.error("Failed to reconnect to server");
    });

    setSocket(newSocket);

    // Auto-connect
    newSocket.connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      newSocket.close();
    };
  }, []);

  const authenticate = (userId: string, campaignId?: string) => {
    if (!socket) {return;}

    socket.emit("authenticate", { userId, campaignId });

    // Save to localStorage for reconnection
    localStorage.setItem("vtt_user", JSON.stringify({ id: userId }));
    if (campaignId) {
      localStorage.setItem("vtt_campaign", JSON.stringify({ id: campaignId }));
    }
  };

  const joinScene = (sceneId: string) => {
    if (!socket) {return;}
    socket.emit("join_scene", { sceneId });
  };

  const sendMessage = (text: string, channel?: string) => {
    if (!socket) {return;}
    socket.emit("send_message", { text, channel });
  };

  return {
    socket,
    isConnected,
    user,
    authenticate,
    joinScene,
    sendMessage,
  };
};
