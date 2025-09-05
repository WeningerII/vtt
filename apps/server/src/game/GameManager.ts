import { GameSession, GameConfig } from "./GameSession";
import { logger } from "@vtt/logging";

/**
 * Manages multiple game sessions and handles game lifecycle
 */
export class GameManager {
  private games = new Map<string, GameSession>();
  private cleanupInterval: ReturnType<typeof setInterval> | undefined;

  constructor() {
    // Cleanup empty games every 5 minutes
    this.cleanupInterval = setInterval(
      () => {
        this.cleanupEmptyGames();
      },
      5 * 60 * 1000,
    );
  }

  /**
   * Create a new game session
   */
  createGame(config: GameConfig): GameSession {
    if (this.games.has(config.gameId)) {
      throw new Error(`Game ${config.gameId} already exists`);
    }

    const game = new GameSession(config);
    this.games.set(config.gameId, game);

    logger.info(`[GameManager] Created game ${config.gameId}`);
    return game;
  }

  /**
   * Get an existing game session
   */
  getGame(gameId: string): GameSession | undefined {
    return this.games.get(gameId);
  }

  /**
   * Remove a game session
   */
  removeGame(gameId: string): boolean {
    const game = this.games.get(gameId);
    if (!game) {return false;}

    game.destroy();
    const removed = this.games.delete(gameId);

    if (removed) {
      logger.info(`[GameManager] Removed game ${gameId}`);
    }

    return removed;
  }

  /**
   * Get all active games
   */
  getGames(): GameSession[] {
    return Array.from(this.games.values());
  }

  /**
   * Get games with connected players
   */
  getActiveGames(): GameSession[] {
    return this.getGames().filter((game) => !game.isEmpty());
  }

  /**
   * Find or create a game for a player
   */
  findOrCreateGame(gameId: string, config?: Partial<GameConfig>): GameSession {
    let game = this.getGame(gameId);

    if (!game) {
      const fullConfig: GameConfig = {
        gameId,
        maxPlayers: 8,
        tickRate: 15,
        ...config,
      };
      game = this.createGame(fullConfig);
    }

    return game;
  }

  /**
   * Clean up empty games
   */
  private cleanupEmptyGames(): void {
    const emptyGames = this.getGames().filter((game) => game.isEmpty());

    for (const game of emptyGames) {
      this.removeGame(game.gameId);
    }

    if (emptyGames.length > 0) {
      logger.info(`[GameManager] Cleaned up ${emptyGames.length} empty games`);
    }
  }

  /**
   * Get statistics
   */
  getStats() {
    const games = this.getGames();
    const activeGames = this.getActiveGames();

    return {
      totalGames: games.length,
      activeGames: activeGames.length,
      totalPlayers: games.reduce((_sum, _game) => sum + game.getPlayerCount(), 0),
      connectedPlayers: games.reduce((_sum, _game) => sum + game.getConnectedPlayerCount(), 0),
    };
  }

  /**
   * Shutdown the game manager and cleanup all resources
   */
  async shutdown(): Promise<void> {
    // Stop cleanup interval
    if (this.cleanupInterval !== undefined) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }

    // Shutdown all games
    const shutdownPromises = Array.from(this.games.values()).map((game) =>
      Promise.resolve(game.destroy()),
    );

    await Promise.all(shutdownPromises);
    this.games.clear();

    logger.info("[GameManager] Shutdown complete");
  }
}
