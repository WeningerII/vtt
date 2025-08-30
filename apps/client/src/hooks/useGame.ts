import React, { useState, useContext, createContext, ReactNode } from 'react';
import { logger } from '@vtt/logging';

export interface GameState {
  id: string;
  name: string;
  mapId?: string;
  isActive: boolean;
  players: GamePlayer[];
  currentUserId?: string;
  isGM: boolean;
}

export interface GamePlayer {
  id: string;
  userId: string;
  characterId?: string;
  name: string;
  isOnline: boolean;
}

interface GameContextType {
  currentGame: GameState | null;
  isLoading: boolean;
  error: string | null;
  joinGame: (gameId: string) => Promise<void>;
  leaveGame: () => Promise<void>;
  updateGameState: (updates: Partial<GameState>) => void;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export const GameProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentGame, setCurrentGame] = useState<GameState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const joinGame = async (gameId: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/games/${gameId}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error(`Failed to join game: ${response.statusText}`);
      }
      
      const gameData = await response.json();
      setCurrentGame(gameData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      logger.error('Failed to join game:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const leaveGame = async () => {
    if (!currentGame) return;
    
    setIsLoading(true);
    
    try {
      const response = await fetch(`/api/games/${currentGame.id}/leave`, {
        method: 'POST',
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error(`Failed to leave game: ${response.statusText}`);
      }
      
      setCurrentGame(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      logger.error('Failed to leave game:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const updateGameState = (updates: Partial<GameState>) => {
    setCurrentGame(prev => (prev ? { ...prev, ...updates } : null));
  };

  return React.createElement(
    GameContext.Provider,
    {
      value: {
        currentGame,
        isLoading,
        error,
        joinGame,
        leaveGame,
        updateGameState,
      },
    },
    children
  );
};

export const useGame = () => {
  const context = useContext(GameContext);
  if (context === undefined) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
};
