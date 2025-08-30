/**
 * Character management hook
 */

import { useState, useCallback } from 'react';

interface Character {
  id: string;
  name: string;
  race: string;
  class: string;
  background: string;
  level: number;
  hitPoints: number;
  armorClass: number;
  abilities: {
    strength: number;
    dexterity: number;
    constitution: number;
    intelligence: number;
    wisdom: number;
    charisma: number;
  };
  [key: string]: any;
}

interface UseCharacterReturn {
  characters: Character[];
  loading: boolean;
  error: string | null;
  createCharacter: (_characterData: Partial<Character>) => Promise<Character>;
  getCharacter: (_id: string) => Promise<Character>;
  updateCharacter: (_id: string, _updates: Partial<Character>) => Promise<Character>;
  deleteCharacter: (_id: string) => Promise<void>;
  getUserCharacters: () => Promise<Character[]>;
}

export const useCharacter = (characterId?: string): UseCharacterReturn => {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apiCall = async (endpoint: string, options: RequestInit = {}) => {
    const token = localStorage.getItem('token');
    const response = await fetch(`/api${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Network error' }));
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    return response.json();
  };

  const createCharacter = useCallback(async (characterData: Partial<Character>): Promise<Character> => {
    setLoading(true);
    setError(null);

    try {
      const result = await apiCall('/characters', {
        method: 'POST',
        body: JSON.stringify(characterData),
      });

      const newCharacter = result.data || result;
      setCharacters(prev => [...prev, newCharacter]);
      return newCharacter;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getCharacter = useCallback(async (id: string): Promise<Character> => {
    setLoading(true);
    setError(null);

    try {
      const result = await apiCall(`/characters/${id}`);
      return result.data || result;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateCharacter = useCallback(async (id: string, updates: Partial<Character>): Promise<Character> => {
    setLoading(true);
    setError(null);

    try {
      const result = await apiCall(`/characters/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      });

      const updatedCharacter = result.data || result;
      setCharacters(prev => 
        prev.map(char => char.id === id ? updatedCharacter : char)
      );
      return updatedCharacter;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteCharacter = useCallback(async (id: string): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      await apiCall(`/characters/${id}`, {
        method: 'DELETE',
      });

      setCharacters(prev => prev.filter(char => char.id !== id));
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getUserCharacters = useCallback(async (): Promise<Character[]> => {
    setLoading(true);
    setError(null);

    try {
      const result = await apiCall('/characters');
      const userCharacters = result.data || result;
      setCharacters(userCharacters);
      return userCharacters;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    characters,
    loading,
    error,
    createCharacter,
    getCharacter,
    updateCharacter,
    deleteCharacter,
    getUserCharacters,
  };
};
