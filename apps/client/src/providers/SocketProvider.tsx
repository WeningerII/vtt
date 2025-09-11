import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
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
  const cleanupRef = useRef<() => void>(() => {});

  useEffect(() => {
    // Determine socket base URL with sensible defaults for dev and prod
    const explicitWs = (import.meta as any).env?.VITE_WS_URL as string | undefined;
    const explicitApi = (import.meta as any).env?.VITE_SERVER_URL as string | undefined;
    let socketUrl: string;
    if (explicitWs) {
      socketUrl = explicitWs;
    } else if (explicitApi) {
      socketUrl = explicitApi;
    } else if (typeof window !== "undefined") {
      if (window.location.hostname === "localhost") {
        socketUrl = "http://localhost:8080";
      } else {
        const protocol = window.location.protocol; // http: or https:
        const host = window.location.host;
        const apiHost = host.startsWith("api.") ? host : `api.${host}`;
        socketUrl = `${protocol}//${apiHost}`;
      }
    } else {
      socketUrl = "http://localhost:8080";
    }

    const token = (() => {
      try {
        return typeof window !== "undefined" ? localStorage.getItem("accessToken") || "" : "";
      } catch {
        return "";
      }
    })();

    const newSocket = io(socketUrl, {
      path: "/socket.io",
      transports: ["websocket"],
      autoConnect: true,
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      timeout: 20000,
      ...(token ? { auth: { token } } : {}),
    });

    const onConnect = () => {
      logger.info("Socket connected", { url: socketUrl });
      setIsConnected(true);
    };
    const onDisconnect = (reason: string) => {
      logger.warn("Socket disconnected", { reason });
      setIsConnected(false);
    };
    const onConnectError = (error: any) => {
      logger.error("Socket connect_error", error);
    };
    const onError = (error: any) => {
      logger.error("Socket error", error);
    };
    const onAuthenticated = (data: { user: User }) => {
      logger.info("User authenticated", { id: data.user.id, displayName: data.user.displayName });
      setUser(data.user);
    };

    newSocket.on("connect", onConnect);
    newSocket.on("disconnect", onDisconnect);
    newSocket.on("connect_error", onConnectError);
    newSocket.on("error", onError);
    newSocket.on("authenticated", onAuthenticated);
    // Manager-level reconnection diagnostics
    newSocket.io.on("reconnect_attempt", (attempt: number) => logger.warn("Socket reconnect_attempt", { attempt }));
    newSocket.io.on("reconnect", (attempt: number) => logger.info("Socket reconnect", { attempt }));
    newSocket.io.on("reconnect_error", (err: any) => logger.error("Socket reconnect_error", err));
    newSocket.io.on("reconnect_failed", () => logger.error("Socket reconnect_failed"));

    setSocket(newSocket);

    cleanupRef.current = () => {
      newSocket.off("connect", onConnect);
      newSocket.off("disconnect", onDisconnect);
      newSocket.off("connect_error", onConnectError);
      newSocket.off("error", onError);
      newSocket.off("authenticated", onAuthenticated);
      newSocket.disconnect();
    };

    return () => {
      cleanupRef.current?.();
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
