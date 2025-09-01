/**
 * Game lobby component for joining and managing games
 */

import React, { useState, useEffect } from "react";
import { logger } from "@vtt/logging";
import "./GameLobby.css";

export interface GameSession {
  id: string;
  name: string;
  description: string;
  gameSystem: string;
  gameMaster: {
    id: string;
    username: string;
    displayName: string;
  };
  players: Array<{
    id: string;
    username: string;
    displayName: string;
    character?: {
      name: string;
      level: number;
      class: string;
    };
  }>;
  maxPlayers: number;
  isPrivate: boolean;
  status: "waiting" | "active" | "paused" | "ended";
  createdAt: Date;
  lastActivity: Date;
}

export interface GameLobbyProps {
  onJoinGame: (_gameId: string) => void;
  onCreateGame: () => void;
  onSpectateGame: (_gameId: string) => void;
  currentUserId?: string;
}

export const GameLobby: React.FC<GameLobbyProps> = ({
  onJoinGame,
  onCreateGame,
  onSpectateGame,
  currentUserId,
}) => {
  const [games, setGames] = useState<GameSession[]>([]);
  const [filter, setFilter] = useState<"all" | "open" | "active" | "my-games">("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadGames();
  }, [filter]);

  const loadGames = async () => {
    setLoading(true);
    try {
      // Mock data - replace with actual API call
      const mockGames: GameSession[] = [
        {
          id: "1",
          name: "The Lost Mines of Phandelver",
          description: "A classic D&D 5e adventure for new players",
          gameSystem: "D&D 5e",
          gameMaster: {
            id: "gm1",
            username: "dungeonmaster",
            displayName: "The DM",
          },
          players: [
            {
              id: "p1",
              username: "fighter123",
              displayName: "Bob",
              character: { name: "Thorin", level: 3, class: "Fighter" },
            },
            {
              id: "p2",
              username: "wizard456",
              displayName: "Alice",
              character: { name: "Elara", level: 3, class: "Wizard" },
            },
          ],
          maxPlayers: 5,
          isPrivate: false,
          status: "waiting",
          createdAt: new Date("2024-01-15"),
          lastActivity: new Date(),
        },
        {
          id: "2",
          name: "Curse of Strahd",
          description: "Gothic horror campaign in Barovia",
          gameSystem: "D&D 5e",
          gameMaster: {
            id: "gm2",
            username: "horrormaster",
            displayName: "Count GM",
          },
          players: [
            {
              id: "p3",
              username: "paladin789",
              displayName: "Charlie",
              character: { name: "Sir Gareth", level: 8, class: "Paladin" },
            },
          ],
          maxPlayers: 4,
          isPrivate: false,
          status: "active",
          createdAt: new Date("2024-01-10"),
          lastActivity: new Date(),
        },
      ];

      setGames(mockGames);
    } catch (error) {
      logger.error("Failed to load games:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredGames = games
    .filter((game) => {
      // Apply filter
      switch (filter) {
        case "open":
          return game.status === "waiting" && game.players.length < game.maxPlayers;
        case "active":
          return game.status === "active";
        case "my-games":
          return (
            game.gameMaster.id === currentUserId || game.players.some((p) => p.id === currentUserId)
          );
        default:
          return true;
      }
    })
    .filter((game) => {
      // Apply search
      if (!searchTerm) return true;
      const search = searchTerm.toLowerCase();
      return (
        game.name.toLowerCase().includes(search) ||
        game.description.toLowerCase().includes(search) ||
        game.gameSystem.toLowerCase().includes(search) ||
        game.gameMaster.displayName.toLowerCase().includes(search)
      );
    });

  const getStatusBadge = (_status: GameSession["status"]) => {
    const statusClasses = {
      waiting: "status-waiting",
      active: "status-active",
      paused: "status-paused",
      ended: "status-ended",
    };

    const statusLabels = {
      waiting: "Waiting for Players",
      active: "Active",
      paused: "Paused",
      ended: "Ended",
    };

    return <span className={`status-badge ${statusClasses[status]}`}>{statusLabels[status]}</span>;
  };

  const canJoinGame = (game: GameSession) => {
    return (
      game.status === "waiting" &&
      game.players.length < game.maxPlayers &&
      !game.players.some((p) => p.id === currentUserId) &&
      game.gameMaster.id !== currentUserId
    );
  };

  const canSpectateGame = (game: GameSession) => {
    return (
      game.status === "active" &&
      !game.isPrivate &&
      !game.players.some((p) => p.id === currentUserId) &&
      game.gameMaster.id !== currentUserId
    );
  };

  if (loading) {
    return (
      <div className="game-lobby loading">
        <div className="loading-spinner">Loading games...</div>
      </div>
    );
  }

  return (
    <div className="game-lobby">
      <div className="lobby-header">
        <h1>Game Lobby</h1>
        <button className="create-game-btn" onClick={onCreateGame}>
          Create New Game
        </button>
      </div>

      <div className="lobby-filters">
        <div className="filter-tabs">
          {[
            { key: "all", label: "All Games" },
            { key: "open", label: "Open Games" },
            { key: "active", label: "Active Games" },
            { key: "my-games", label: "My Games" },
          ].map((tab) => (
            <button
              key={tab.key}
              className={`filter-tab ${filter === tab.key ? "active" : ""}`}
              onClick={() => setFilter(tab.key as typeof filter)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="search-bar">
          <input
            type="text"
            placeholder="Search games..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
      </div>

      <div className="games-list">
        {filteredGames.length === 0 ? (
          <div className="no-games">
            <p>No games found matching your criteria.</p>
            {filter === "all" && (
              <button
                onClick={onCreateGame}
                className="create-first-game"
                aria-label="create the first game!"
              >
                Create the first game!
              </button>
            )}
          </div>
        ) : (
          filteredGames.map((game) => (
            <div key={game.id} className="game-card">
              <div className="game-header">
                <div className="game-title">
                  <h3>{game.name}</h3>
                  {getStatusBadge(game.status)}
                </div>
                <div className="game-system">{game.gameSystem}</div>
              </div>

              <div className="game-description">{game.description}</div>

              <div className="game-info">
                <div className="game-master">
                  <strong>GM:</strong> {game.gameMaster.displayName}
                </div>
                <div className="player-count">
                  <strong>Players:</strong> {game.players.length}/{game.maxPlayers}
                </div>
                <div className="last-activity">
                  <strong>Last Activity:</strong> {game.lastActivity.toLocaleDateString()}
                </div>
              </div>

              <div className="players-list">
                <h4>Players:</h4>
                {game.players.length === 0 ? (
                  <p className="no-players">No players yet</p>
                ) : (
                  <div className="players">
                    {game.players.map((player) => (
                      <div key={player.id} className="player">
                        <span className="player-name">{player.displayName}</span>
                        {player.character && (
                          <span className="character-info">
                            ({player.character.name}, Level {player.character.level}{" "}
                            {player.character.class})
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="game-actions">
                {canJoinGame(game) && (
                  <button className="join-btn" onClick={() => onJoinGame(game.id)}>
                    Join Game
                  </button>
                )}
                {canSpectateGame(game) && (
                  <button className="spectate-btn" onClick={() => onSpectateGame(game.id)}>
                    Spectate
                  </button>
                )}
                {(game.gameMaster.id === currentUserId ||
                  game.players.some((p) => p.id === currentUserId)) && (
                  <button className="enter-btn" onClick={() => onJoinGame(game.id)}>
                    Enter Game
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default GameLobby;
