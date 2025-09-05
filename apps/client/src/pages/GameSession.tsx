/**
 * Game Session Page - Main game interface with map, chat, and controls
 */

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../providers/AuthProvider";
import { useGame } from "../providers/GameProvider";
import { ChatSystem } from "../components/game/ChatSystem";
import { DiceRoller } from "../components/game/DiceRoller";
import { PlayerPanel } from "../components/game/PlayerPanel";
import { BattleMap } from "../components/map/BattleMap";
import { Button } from "../components/ui/Button";
import { LoadingSpinner } from "../components/ui/LoadingSpinner";
import { cn } from "../lib/utils";
import {
  MessageSquare,
  Dice6,
  Users,
  Map,
  ChevronLeft,
  ChevronRight,
  Settings,
  Maximize,
  Minimize,
  LogOut,
  Wifi,
  WifiOff,
  Menu,
  X,
  Home,
} from "lucide-react";

interface GameSessionProps {
  sessionId: string;
  router: {
    navigate: (path: string, replace?: boolean) => void;
    currentPath: string;
  };
}

type PanelType = "chat" | "dice" | "players" | "map" | null;

export function GameSession({ sessionId, router }: GameSessionProps) {
  const { user } = useAuth();
  const { session, joinSession, leaveSession, isLoading, isGM } = useGame();
  const [activePanel, setActivePanel] = useState<PanelType>("chat");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Event handlers with useCallback optimization
  const handleReturnToDashboard = useCallback(() => {
    router.navigate("/dashboard");
  }, [router]);

  const handleLeaveSession = useCallback(async () => {
    await leaveSession();
    router.navigate("/dashboard");
  }, [leaveSession, router]);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  const handleToggleSidebar = useCallback(() => {
    setSidebarCollapsed(!sidebarCollapsed);
  }, [sidebarCollapsed]);

  const handleSetActivePanel = useCallback((panel: PanelType) => {
    setActivePanel(panel);
  }, []);

  const handleOpenMapPanel = useCallback(() => {
    setActivePanel("map");
  }, []);

  const handleOpenChatPanel = useCallback(() => {
    setSidebarCollapsed(false);
    setActivePanel("chat");
  }, []);

  const handleOpenDicePanel = useCallback(() => {
    setSidebarCollapsed(false);
    setActivePanel("dice");
  }, []);

  // Join session on mount
  useEffect(() => {
    if (!session || session.id !== sessionId) {
      joinSession(sessionId);
    }
  }, [sessionId, session, joinSession]);

  // Handle session not found or loading
  if (isLoading) {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center">
        <LoadingSpinner size="xl" showLabel label="Loading game session..." />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-error mb-4">Session Not Found</h1>
          <p className="text-secondary mb-6">
            The game session "{sessionId}" could not be found or you don't have permission to access
            it.
          </p>
          <Button onClick={handleReturnToDashboard}>Return to Dashboard</Button>
        </div>
      </div>
    );
  }


  const renderActivePanel = () => {
    switch (activePanel) {
      case "chat":
        return <ChatSystem className="h-full" />;
      case "dice":
        return <DiceRoller className="h-full" />;
      case "players":
        return <PlayerPanel className="h-full" />;
      case "map":
        return (
          <div className="h-full bg-bg-secondary rounded-lg border border-border-primary flex items-center justify-center">
            <div className="text-center">
              <Map className="h-12 w-12 text-text-tertiary mx-auto mb-4" />
              <h3 className="text-lg font-medium text-primary mb-2">Tactical Map</h3>
              <p className="text-secondary">
                Map and grid system will be implemented in the next phase
              </p>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="h-screen bg-primary flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-bg-secondary border-b border-border-primary px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleToggleSidebar}
            leftIcon={sidebarCollapsed ? <Menu className="h-4 w-4" /> : <X className="h-4 w-4" />}
          >
            {sidebarCollapsed ? "Show" : "Hide"} Panels
          </Button>

          <div>
            <h1 className="font-semibold text-primary">{session.name}</h1>
            <p className="text-sm text-secondary">GM: {session.gamemaster.displayName}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleFullscreen}
            leftIcon={
              isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />
            }
          >
            {isFullscreen ? "Exit" : "Fullscreen"}
          </Button>

          <Button variant="ghost" size="sm" leftIcon={<Settings className="h-4 w-4" />}>
            Settings
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={handleLeaveSession}
            leftIcon={<Home className="h-4 w-4" />}
          >
            Leave Session
          </Button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        {!sidebarCollapsed && (
          <aside className="w-80 bg-bg-secondary border-r border-border-primary flex flex-col">
            {/* Panel Tabs */}
            <div className="border-b border-border-primary">
              <div className="flex">
                {[
                  { key: "chat", label: "Chat", icon: MessageSquare },
                  { key: "dice", label: "Dice", icon: Dice6 },
                  { key: "players", label: "Players", icon: Users },
                  { key: "map", label: "Map", icon: Map },
                ].map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    onClick={() => handleSetActivePanel(key as PanelType)}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2 px-3 py-3 text-sm font-medium transition-colors border-b-2",
                      activePanel === key
                        ? "text-accent-primary border-accent-primary bg-accent-light"
                        : "text-secondary border-transparent hover:text-primary hover:bg-bg-tertiary",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Panel Content */}
            <div className="flex-1 overflow-hidden">{renderActivePanel()}</div>
          </aside>
        )}

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Main Content Area - Map/Tactical View */}
          <div className="flex-1 bg-primary relative">
            {activePanel === "map" ? (
              <BattleMap className="h-full" isGM={isGM} />
            ) : (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <div className="w-32 h-32 bg-bg-tertiary rounded-lg flex items-center justify-center mb-4 mx-auto">
                    <Map className="h-16 w-16 text-text-tertiary" />
                  </div>
                  <h3 className="text-xl font-semibold text-primary mb-2">
                    Game Session Active
                  </h3>
                  <p className="text-secondary mb-4">
                    Use the sidebar panels to chat, roll dice, or manage your character.
                  </p>
                  <Button
                    variant="primary"
                    onClick={handleOpenMapPanel}
                    leftIcon={<Map className="h-4 w-4" />}
                  >
                    Open Battle Map
                  </Button>
                </div>
              </div>
            )}
            {/* Quick Actions Overlay */}
            <div className="absolute bottom-4 right-4 flex flex-col gap-2">
              {sidebarCollapsed && (
                <>
                  <Button
                    variant="primary"
                    onClick={handleOpenChatPanel}
                    leftIcon={<MessageSquare className="h-4 w-4" />}
                  >
                    Chat
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={handleOpenDicePanel}
                    leftIcon={<Dice6 className="h-4 w-4" />}
                  >
                    Dice
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Status Bar */}
          <div className="bg-bg-secondary border-t border-border-primary px-4 py-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-4">
                <span className="text-secondary">
                  Session: <span className="text-primary">{session.status}</span>
                </span>
                <span className="text-secondary">
                  Players:{" "}
                  <span className="text-primary">
                    {session.players.filter((p) => p.isConnected).length}/{session.players.length}
                  </span>
                </span>
              </div>

              <div className="flex items-center gap-4">
                {user && (
                  <span className="text-secondary">
                    Playing as: <span className="text-primary">{user.displayName}</span>
                  </span>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
