/**
 * Player Panel Component - Display player information, status, and controls
 */

import React, { useState } from "react";
import { useAuth } from "../../providers/AuthProvider";
import { useGame, type Player } from "../../providers/GameProvider";
import { useWebSocket } from "../../providers/WebSocketProvider";
import { Button } from "../ui/Button";
import {
  Crown,
  Users,
  Shield,
  Heart,
  Zap,
  Eye,
  EyeOff,
  Volume2,
  VolumeX,
  Settings,
  UserX,
  MoreVertical,
  Wifi,
  WifiOff,
} from "lucide-react";
import { cn } from "../../lib/utils";

interface PlayerPanelProps {
  className?: string;
}

interface PlayerStatusProps {
  player: Player;
  isCurrentUser: boolean;
  isGM: boolean;
  onKick?: (_playerId: string) => void;
  onUpdatePermissions?: (_playerId: string, permissions: Partial<Player["permissions"]>) => void;
}

function PlayerStatus({
  player,
  isCurrentUser,
  isGM,
  onKick,
  onUpdatePermissions,
}: PlayerStatusProps) {
  const [showOptions, setShowOptions] = useState(false);
  const [showPermissions, setShowPermissions] = useState(false);

  const getStatusColor = (isConnectedParam: boolean) => {
    return isConnectedParam ? "bg-success" : "bg-error";
  };

  const getAvatarFallback = (displayNameParam: string) => {
    return displayNameParam
      .split(" ")
      .map((word) => word.charAt(0))
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const togglePermission = (permission: keyof Player["permissions"]) => {
    if (!onUpdatePermissions) {return;}

    onUpdatePermissions(player.id, {
      [permission]: !player.permissions[permission],
    });
  };

  return (
    <div
      className={cn(
        "relative p-3 bg-bg-tertiary rounded-lg border",
        isCurrentUser ? "border-accent-primary bg-accent-light" : "border-border-primary",
      )}
    >
      {/* Player Info */}
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <div className="relative">
          <div className="w-10 h-10 rounded-full bg-accent-primary flex items-center justify-center text-white font-medium">
            {player.avatar ? (
              <img
                src={player.avatar}
                alt={player.displayName}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              getAvatarFallback(player.displayName)
            )}
          </div>

          {/* Connection Status */}
          <div
            className={cn(
              "absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-bg-tertiary",
              getStatusColor(player.isConnected),
            )}
          />
        </div>

        {/* Player Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-medium text-primary truncate">{player.displayName}</h4>
            {isCurrentUser && (
              <span className="text-xs bg-accent-primary text-white px-1.5 py-0.5 rounded">
                You
              </span>
            )}
          </div>

          <p className="text-sm text-secondary truncate">@{player.username}</p>

          {/* Character Info */}
          {player.character && (
            <div className="mt-1 text-xs text-text-tertiary">
              <span className="font-medium">{player.character.name}</span>
              <span className="mx-1">•</span>
              <span>
                Lv{player.character.level} {player.character.race} {player.character.class}
              </span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          {player.isConnected ? (
            <Wifi className="h-4 w-4 text-success" />
          ) : (
            <WifiOff className="h-4 w-4 text-error" />
          )}

          {isGM && !isCurrentUser && (
            <button
              onClick={() => setShowOptions(!showOptions)}
              className="p-1 hover:bg-bg-secondary rounded transition-colors"
              aria-label={showOptions ? "Hide options" : "Show options"}
            >
              <MoreVertical className="h-4 w-4 text-secondary" />
            </button>
          )}
        </div>
      </div>

      {/* Character Health/Status */}
      {player.character && (
        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-3">
            {/* Health Bar */}
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Heart className="h-3 w-3 text-error" />
                <span className="text-xs text-secondary">
                  {player.character.hitPoints}/{player.character.maxHitPoints} HP
                </span>
              </div>
              <div className="w-full bg-bg-secondary rounded-full h-2">
                <div
                  className="bg-error h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.max(0, (player.character.hitPoints / player.character.maxHitPoints) * 100)}%`,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Quick Actions for Current User */}
          {isCurrentUser && (
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" className="text-xs h-6">
                <Shield className="h-3 w-3 mr-1" />
                AC {player.character.level + 10}
              </Button>
              <Button variant="ghost" size="sm" className="text-xs h-6">
                <Zap className="h-3 w-3 mr-1" />
                Initiative
              </Button>
            </div>
          )}
        </div>
      )}

      {/* GM Options Dropdown */}
      {showOptions && isGM && !isCurrentUser && (
        <div className="absolute top-full right-0 mt-1 w-48 bg-bg-secondary border border-border-primary rounded-lg shadow-lg z-10">
          <div className="p-2 space-y-1">
            <button
              onClick={() => setShowPermissions(!showPermissions)}
              className="w-full text-left px-2 py-1.5 text-sm hover:bg-bg-tertiary rounded transition-colors"
              aria-label={showPermissions ? "Hide permissions" : "Show permissions"}
            >
              <Settings className="h-3 w-3 inline mr-2" />
              Permissions
            </button>

            <button
              onClick={() => onKick?.(player.id)}
              className="w-full text-left px-2 py-1.5 text-sm text-error hover:bg-error-light rounded transition-colors"
              aria-label="Kick player"
            >
              <UserX className="h-3 w-3 inline mr-2" />
              Kick Player
            </button>
          </div>

          {/* Permissions Panel */}
          {showPermissions && (
            <div className="border-t border-border-primary p-2">
              <h5 className="text-xs font-medium text-primary mb-2">Player Permissions</h5>
              <div className="space-y-1">
                {Object.entries(player.permissions).map(([key, value]) => (
                  <label key={key} className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={value}
                      onChange={() => togglePermission(key as keyof Player["permissions"])}
                      className="rounded"
                    />
                    <span className="capitalize">
                      {key.replace(/([A-Z])/g, " $1").toLowerCase()}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export const PlayerPanel = React.memo(({
  className,
}: PlayerPanelProps): JSX.Element => {
  const { user } = useAuth();
  const { session, isGM, kickPlayer, updatePlayerPermissions, pauseSession, resumeSession, endSession } = useGame();
  const { isConnected, latency } = useWebSocket();
  const [showOfflinePlayers, setShowOfflinePlayers] = useState(true);

  if (!session) {
    return (
      <div className={cn("bg-bg-secondary rounded-lg border border-border-primary p-4", className)}>
        <p className="text-secondary text-center">Join a game session to see players</p>
      </div>
    );
  }

  const connectedPlayers = session.players.filter((p) => p.isConnected);
  const offlinePlayers = session.players.filter((p) => !p.isConnected);

  return (
    <div className={cn("bg-bg-secondary rounded-lg border border-border-primary", className)}>
      {/* Header */}
      <div className="p-4 border-b border-border-primary">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-accent-primary" />
            <h3 className="font-semibold text-primary">
              Players ({session.players.length}/{session.settings.maxPlayers})
            </h3>
          </div>

          {/* Session Status */}
          <div className="flex items-center gap-2">
            <div className={cn("h-2 w-2 rounded-full", isConnected ? "bg-success" : "bg-error")} />
            <span className="text-xs text-secondary">
              {isConnected ? `${latency}ms` : "Disconnected"}
            </span>
          </div>
        </div>

        {/* Gamemaster Info */}
        <div className="mt-3 p-2 bg-gm-accent/10 border border-gm-accent/20 rounded-lg">
          <div className="flex items-center gap-2">
            <Crown className="h-4 w-4 text-gm-accent" />
            <span className="text-sm font-medium text-primary">
              {session.gamemaster.displayName}
            </span>
            <span className="text-xs text-secondary">Gamemaster</span>
          </div>
        </div>
      </div>

      {/* Players List */}
      <div className="p-4 space-y-3">
        {/* Connected Players */}
        {connectedPlayers.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-primary mb-2 flex items-center gap-2">
              <Wifi className="h-4 w-4 text-success" />
              Connected ({connectedPlayers.length})
            </h4>
            <div className="space-y-2">
              {connectedPlayers.map((player) => (
                <PlayerStatus
                  key={player.id}
                  player={player}
                  isCurrentUser={player.userId === user?.id}
                  isGM={isGM}
                  onKick={kickPlayer}
                  onUpdatePermissions={updatePlayerPermissions}
                />
              ))}
            </div>
          </div>
        )}

        {/* Offline Players */}
        {offlinePlayers.length > 0 && (
          <div>
            <button
              onClick={() => setShowOfflinePlayers(!showOfflinePlayers)}
              className="w-full text-left"
              aria-label={showOfflinePlayers ? "Hide offline players" : "Show offline players"}
            >
              <h4 className="text-sm font-medium text-secondary mb-2 flex items-center gap-2 hover:text-primary transition-colors">
                <WifiOff className="h-4 w-4 text-error" />
                Offline ({offlinePlayers.length})
                {showOfflinePlayers ? (
                  <EyeOff className="h-3 w-3 ml-auto" />
                ) : (
                  <Eye className="h-3 w-3 ml-auto" />
                )}
              </h4>
            </button>

            {showOfflinePlayers && (
              <div className="space-y-2 opacity-60">
                {offlinePlayers.map((player) => (
                  <PlayerStatus
                    key={player.id}
                    player={player}
                    isCurrentUser={player.userId === user?.id}
                    isGM={isGM}
                    onKick={kickPlayer}
                    onUpdatePermissions={updatePlayerPermissions}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Empty State */}
        {session.players.length === 0 && (
          <div className="text-center py-8">
            <Users className="h-8 w-8 text-text-tertiary mx-auto mb-2" />
            <p className="text-secondary">No players have joined yet</p>
            {isGM && (
              <p className="text-text-tertiary text-sm mt-1">
                Share the session link to invite players
              </p>
            )}
          </div>
        )}
      </div>

      {/* Session Controls */}
      {isGM && (
        <div className="p-4 border-t border-border-primary">
          <div className="flex gap-2">
            {session.status === "active" ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={pauseSession}
              >
                Pause Session
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                onClick={resumeSession}
              >
                Resume Session
              </Button>
            )}

            <Button
              variant="destructive"
              size="sm"
              onClick={endSession}
            >
              End Session
            </Button>
          </div>
        </div>
      )}
    </div>
  );
});
