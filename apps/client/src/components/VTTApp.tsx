import React, { useState, useEffect } from "react";
import { logger } from "@vtt/logging";
import { SceneCanvas, Scene } from "./SceneCanvas";
import { useSocket } from "../providers/SocketProvider";

interface Campaign {
  id: string;
  name: string;
  activeSceneId?: string;
}

interface VTTAppProps {
  userId: string;
  campaignId: string;
}

export const VTTApp: React.FC<VTTAppProps> = ({ userId, campaignId }) => {
  const { socket, isConnected, user, authenticate, joinScene } = useSocket();
  const [currentScene, setCurrentScene] = useState<Scene | null>(null);
  const [_campaign, _setCampaign] = useState<Campaign | null>(null);
  const [isGM, setIsGM] = useState(false);

  // Initialize authentication
  useEffect(() => {
    if (socket && !user) {
      authenticate(userId, campaignId);
    }
  }, [socket, user, userId, campaignId, authenticate]);

  // Socket event handlers
  useEffect(() => {
    if (!socket) return;

    socket.on("scene_joined", (data: { scene: Scene }) => {
      logger.info("Joined scene:", data.scene);
      setCurrentScene(data.scene);
    });

    socket.on("user_joined_scene", (data: { user: any; _sceneId: string }) => {
      logger.info("User joined scene:", data.user.displayName);
    });

    socket.on("user_left_scene", (data: { userId: string; _sceneId: string }) => {
      logger.info("User left scene:", data.userId);
    });

    socket.on("new_message", (message: any) => {
      logger.info("New chat message:", message);
      // Handle chat messages here
    });

    return () => {
      socket.off("scene_joined");
      socket.off("user_joined_scene");
      socket.off("user_left_scene");
      socket.off("new_message");
    };
  }, [socket]);

  // Mock scene for development
  useEffect(() => {
    if (user && !currentScene) {
      // Create a mock scene for testing
      const mockScene: Scene = {
        id: "mock-scene-1",
        name: "Test Scene",
        gridSettings: {
          type: "square",
          size: 70,
          offsetX: 0,
          offsetY: 0,
        },
        tokens: [
          {
            id: "token-1",
            name: "Hero",
            x: 350,
            y: 350,
            width: 1,
            height: 1,
            rotation: 0,
            scale: 1,
            color: 0x00ff00,
          },
          {
            id: "token-2",
            name: "Goblin",
            x: 560,
            y: 420,
            width: 1,
            height: 1,
            rotation: 0,
            scale: 1,
            color: 0xff0000,
          },
        ],
      };
      setCurrentScene(mockScene);
      setIsGM(true); // Mock GM status
    }
  }, [user, currentScene]);

  if (!socket || !isConnected) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
          <p>Connecting to VTT server...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
        <div className="text-center">
          <p>Authenticating...</p>
        </div>
      </div>
    );
  }

  if (!currentScene) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
        <div className="text-center">
          <p>Loading scene...</p>
          <button
            onClick={() => joinScene("mock-scene-1")}
            className="mt-4 px-4 py-2 bg-blue-600 rounded hover:bg-blue-700"
            tabIndex={0}
          >
            Join Test Scene
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-900 text-white flex flex-col">
      {/* Header */}
      <header className="bg-gray-800 p-4 border-b border-gray-700">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold">{currentScene.name}</h1>
            <p className="text-sm text-gray-400">
              Connected as {user.displayName} {isGM && "(GM)"}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div
              className={`w-3 h-3 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`}
            ></div>
            <span className="text-sm">{isConnected ? "Connected" : "Disconnected"}</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex">
        {/* Scene Canvas */}
        <div className="flex-1 p-4">
          <SceneCanvas
            scene={currentScene}
            socket={socket}
            canvasWidth={800}
            canvasHeight={600}
            isGM={isGM}
          />
        </div>

        {/* Right Panel */}
        <div className="w-80 bg-gray-800 border-l border-gray-700">
          {/* Tokens Panel */}
          <div className="p-4 border-b border-gray-700">
            <h3 className="font-semibold mb-3">Tokens</h3>
            <div className="space-y-2">
              {currentScene.tokens.map((token) => (
                <div
                  key={token.id}
                  className="flex items-center justify-between p-2 bg-gray-700 rounded"
                >
                  <span className="text-sm">{token.name}</span>
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{
                      backgroundColor: `#${token.color?.toString(16).padStart(6, "0") || "666666"}`,
                    }}
                  ></div>
                </div>
              ))}
            </div>
          </div>

          {/* Chat Panel */}
          <div className="flex-1 flex flex-col">
            <div className="p-4 border-b border-gray-700">
              <h3 className="font-semibold">Chat</h3>
            </div>
            <div className="flex-1 p-4">
              <div className="text-sm text-gray-400 mb-4">Chat messages will appear here...</div>
            </div>
            <div className="p-4 border-t border-gray-700">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Type a message..."
                  className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                  onKeyPress={(e) => {
                    if (e.key === "Enter") {
                      const target = e.target as HTMLInputElement;
                      if (target.value.trim()) {
                        socket.emit("send_message", { text: target.value.trim() });
                        target.value = "";
                      }
                    }
                  }}
                />
                <button
                  className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  aria-label="Send message"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
