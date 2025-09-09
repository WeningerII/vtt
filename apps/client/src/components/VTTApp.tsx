import React, { useState, useEffect } from "react";
import { logger } from "@vtt/logging";
import { toErrorObject } from "../utils/error-utils";
import { io, Socket } from 'socket.io-client';
import SceneCanvas from './SceneCanvas';
import TokensPanel from './TokensPanel';
import ChatPanel from './ChatPanel';
import { useVTTLayout, useTouchGestures } from '../hooks/useVTTLayout';
import './VTTApp.css';
import { VTTHeader } from "./vtt/VTTHeader";
import { LoadingScreen } from "./vtt/LoadingScreen";
import { useVTTTranslation } from "../hooks/useTranslation";
import { useSocket } from '../providers/SocketProvider';
import { Scene, Campaign, ChatMessage, User } from '../types/vtt';

interface VTTAppProps {
  userId: string;
  campaignId: string;
}

export const VTTApp: React.FC<VTTAppProps> = ({ userId, campaignId }) => {
  const { socket, isConnected, user, authenticate, joinScene } = useSocket();
  const { t } = useVTTTranslation();
  const [currentScene, setCurrentScene] = useState<Scene | null>(null);
  const [_campaign, _setCampaign] = useState<Campaign | null>(null);
  const [isGM, setIsGM] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  // Initialize authentication
  useEffect(() => {
    if (socket && !user) {
      authenticate(userId, campaignId);
    }
  }, [socket, user, userId, campaignId, authenticate]);

  // Socket event handlers
  useEffect(() => {
    if (!socket) {return;}

    try {
      socket.on("scene_joined", (data: { scene: Scene }) => {
        logger.info("Joined scene:", data.scene);
        setCurrentScene(data.scene);
      });

      socket.on("user_joined_scene", (data: { user: any; _sceneId: string }) => {
        logger.info("User joined scene:", { displayName: data.user.displayName });
      });

      socket.on("user_left_scene", (data: { userId: string; _sceneId: string }) => {
        logger.info("User left scene:", { userId: data.userId });
      });

      socket.on("new_message", (message: ChatMessage) => {
        logger.info("New chat message:", message);
        setChatMessages(prev => [...prev, message]);
      });

      return () => {
        socket.off("scene_joined");
        socket.off("user_joined_scene");
        socket.off("user_left_scene");
        socket.off("new_message");
      };
    } catch (error) {
      logger.error("Failed to initialize VTT:", toErrorObject(error));
    }
  }, [socket]);

  // Load user's active scene from server
  useEffect(() => {
    if (user && !currentScene) {
      const loadActiveScene = async () => {
        try {
          const response = await fetch(`${import.meta.env?.VITE_SERVER_URL || 'http://localhost:8080'}/api/scenes/active`, {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
            },
          });
          
          if (response.ok) {
            const sceneData = await response.json();
            setCurrentScene(sceneData.scene);
            setIsGM(sceneData.isGameMaster || false);
          } else {
            // No active scene, user needs to join or create one
            console.log('No active scene found for user');
          }
        } catch (error) {
          console.error('Failed to load active scene:', error);
        }
      };
      
      loadActiveScene();
    }
  }, [user, currentScene]);

  const handleSendMessage = (message: string) => {
    if (socket) {
      socket.emit("send_message", { 
        text: message,
        type: 'message',
        author: user?.displayName || 'Unknown',
        timestamp: new Date()
      });
    }
  };

  if (!socket || !isConnected) {
    return <LoadingScreen message={t("connecting")} />;
  }

  if (!user) {
    return <LoadingScreen message={t("authenticating")} />;
  }

  if (!currentScene) {
    return (
      <LoadingScreen message={t("loadingScene")} showSpinner={false}>
        <button
          onClick={() => joinScene("mock-scene-1")}
          className="mt-4 px-4 py-2 bg-accent rounded transition-colors hover:scale-105"
          tabIndex={0}
        >
          {t("joinTestScene")}
        </button>
      </LoadingScreen>
    );
  }

  return (
    <div className="h-screen surface-base text-white flex flex-col">
      <VTTHeader
        sceneName={currentScene.name}
        userDisplayName={user.displayName}
        isGM={isGM}
        isConnected={isConnected}
      />

      {/* Main Content */}
      <div className="flex-1 flex">
        {/* Scene Canvas */}
        <div className="flex-1 p-4">
          <SceneCanvas
            scene={currentScene}
            socket={socket}
            canvasWidth={800}
            canvasHeight={600}
            onTokenMove={() => {}}
            onTokenSelect={() => {}}
          />
        </div>

        {/* Right Panel */}
        <div className="w-80 surface-elevated border-l border-subtle flex flex-col">
          <TokensPanel tokens={currentScene.tokens} />
          <ChatPanel messages={chatMessages} onSendMessage={handleSendMessage} />
        </div>
      </div>
    </div>
  );
};

export default VTTApp;
