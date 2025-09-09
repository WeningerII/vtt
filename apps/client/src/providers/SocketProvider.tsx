import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { logger } from "@vtt/logging";

interface User {
  id: string;
  displayName: string;
  email: string;
  avatarUrl?: string;
}

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  user: User | null;
  authenticate: (userId: string, campaignId: string) => void;
  joinScene: (sceneId: string) => void;
  leaveScene: (sceneId: string) => void;
  sendMessage: (message: string) => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    // Initialize socket connection
    const socketUrl = process.env.REACT_APP_SOCKET_URL || "http://localhost:8080";
    const newSocket = io(socketUrl, {
      transports: ["websocket"],
      autoConnect: true,
    });

    newSocket.on("connect", () => {
      logger.info("Socket connected");
      setIsConnected(true);
    });

    newSocket.on("disconnect", () => {
      logger.info("Socket disconnected");
      setIsConnected(false);
    });

    newSocket.on("authenticated", (data: { user: User }) => {
      logger.info("User authenticated:", data.user);
      setUser(data.user);
    });

    newSocket.on("error", (error: any) => {
      logger.error("Socket error:", error);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, []);

  const authenticate = useCallback(
    (userId: string, campaignId: string) => {
      if (socket) {
        socket.emit("authenticate", { userId, campaignId });
      }
    },
    [socket],
  );

  const joinScene = useCallback(
    (sceneId: string) => {
      if (socket) {
        socket.emit("join_scene", { sceneId });
      }
    },
    [socket],
  );

  const leaveScene = useCallback(
    (sceneId: string) => {
      if (socket) {
        socket.emit("leave_scene", { sceneId });
      }
    },
    [socket],
  );

  const sendMessage = useCallback(
    (message: string) => {
      if (socket) {
        socket.emit("send_message", { text: message });
      }
    },
    [socket],
  );

  const value: SocketContextType = {
    socket,
    isConnected,
    user,
    authenticate,
    joinScene,
    leaveScene,
    sendMessage,
  };

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error("useSocket must be used within a SocketProvider");
  }
  return context;
};
