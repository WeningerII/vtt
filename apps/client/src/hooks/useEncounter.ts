/**
 * Hook for encounter and combat management
 */

import { useState, useCallback } from "react";

export interface CombatActor {
  id: string;
  name: string;
  type: "character" | "monster";

  hitPoints: {
    current: number;
    max: number;
    temporary: number;
  };
  armorClass: number;
  initiative: number;
  speed: number;

  abilities: {
    STR: { value: number; modifier: number };
    DEX: { value: number; modifier: number };
    CON: { value: number; modifier: number };
    INT: { value: number; modifier: number };
    WIS: { value: number; modifier: number };
    CHA: { value: number; modifier: number };
  };

  conditions: Array<{
    type: string;
    duration: number;
    source?: string;
  }>;

  actions: Array<{
    id: string;
    name: string;
    type: "action" | "bonus_action" | "reaction";
    description: string;
    attackBonus?: number;
    damage?: {
      diceExpression: string;
      damageType: string;
    };
    saveDC?: number;
    saveAbility?: string;
  }>;

  sourceId: string;
  isPlayer: boolean;
}

export interface EncounterData {
  id: string;
  name: string;
  campaignId: string;
  actors: CombatActor[];
  currentRound: number;
  currentTurn: number;
  isActive: boolean;
}

interface UseEncounterReturn {
  encounter: EncounterData | null;
  isLoading: boolean;
  error: string | null;
  createEncounter: (_data: CreateEncounterData) => Promise<EncounterData>;
  getEncounter: (_id: string) => Promise<EncounterData | null>;
  startEncounter: (_id: string) => Promise<void>;
  endEncounter: (_id: string) => Promise<void>;
  addCharacterToEncounter: (_encounterId: string, _characterId: string) => Promise<CombatActor>;
  addMonsterToEncounter: (
    _encounterId: string,
    _monsterId: string,
    _instanceName?: string,
  ) => Promise<CombatActor>;
  updateActorHealth: (
    _actorId: string,
    health: { current: number; max: number; temporary?: number },
  ) => Promise<void>;
}

interface CreateEncounterData {
  name: string;
  campaignId: string;
  characterIds?: string[];
  monsters?: Array<{ monsterId: string; instanceName?: string }>;
}

export const useEncounter = (): UseEncounterReturn => {
  const [encounter, setEncounter] = useState<EncounterData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apiCall = useCallback(async (url: string, options?: RequestInit) => {
    const response = await fetch(`/api${url}`, {
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
      ...options,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    return response.json();
  }, []);

  const createEncounter = useCallback(
    async (data: CreateEncounterData): Promise<EncounterData> => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await apiCall("/encounters", {
          method: "POST",
          body: JSON.stringify(data),
        });

        if (result.success) {
          setEncounter(result.encounter);
          return result.encounter;
        } else {
          throw new Error(result.error || "Failed to create encounter");
        }
      } catch (err: any) {
        setError(err.message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [apiCall],
  );

  const getEncounter = useCallback(
    async (id: string): Promise<EncounterData | null> => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await apiCall(`/encounters/${id}`);

        if (result.success) {
          setEncounter(result.encounter);
          return result.encounter;
        } else {
          throw new Error(result.error || "Failed to get encounter");
        }
      } catch (err: any) {
        setError(err.message);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [apiCall],
  );

  const startEncounter = useCallback(
    async (id: string): Promise<void> => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await apiCall(`/encounters/${id}/start`, {
          method: "POST",
        });

        if (result.success) {
          setEncounter(result.encounter);
        } else {
          throw new Error(result.error || "Failed to start encounter");
        }
      } catch (err: any) {
        setError(err.message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [apiCall],
  );

  const endEncounter = useCallback(
    async (id: string): Promise<void> => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await apiCall(`/encounters/${id}/end`, {
          method: "POST",
        });

        if (result.success) {
          setEncounter(result.encounter);
        } else {
          throw new Error(result.error || "Failed to end encounter");
        }
      } catch (err: any) {
        setError(err.message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [apiCall],
  );

  const addCharacterToEncounter = useCallback(
    async (encounterId: string, characterId: string): Promise<CombatActor> => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await apiCall(`/encounters/${encounterId}/actors/character`, {
          method: "POST",
          body: JSON.stringify({ characterId }),
        });

        if (result.success) {
          // Refresh encounter data to get updated actors list
          await getEncounter(encounterId);
          return result.actor;
        } else {
          throw new Error(result.error || "Failed to add character to encounter");
        }
      } catch (err: any) {
        setError(err.message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [apiCall, getEncounter],
  );

  const addMonsterToEncounter = useCallback(
    async (encounterId: string, monsterId: string, instanceName?: string): Promise<CombatActor> => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await apiCall(`/encounters/${encounterId}/actors/monster`, {
          method: "POST",
          body: JSON.stringify({ monsterId, instanceName }),
        });

        if (result.success) {
          // Refresh encounter data to get updated actors list
          await getEncounter(encounterId);
          return result.actor;
        } else {
          throw new Error(result.error || "Failed to add monster to encounter");
        }
      } catch (err: any) {
        setError(err.message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [apiCall, getEncounter],
  );

  const updateActorHealth = useCallback(
    async (
      actorId: string,
      health: { current: number; max: number; temporary?: number },
    ): Promise<void> => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await apiCall(`/encounters/${encounter?.id}/actors/${actorId}/health`, {
          method: "PUT",
          body: JSON.stringify(health),
        });

        if (result.success) {
          // Update local state
          if (encounter) {
            setEncounter((prev) => {
              if (!prev) return prev;

              return {
                ...prev,
                actors: prev.actors.map((actor) =>
                  actor.id === actorId
                    ? {
                        ...actor,
                        hitPoints: {
                          current: health.current,
                          max: health.max,
                          temporary: health.temporary || 0,
                        },
                      }
                    : actor,
                ),
              };
            });
          }
        } else {
          throw new Error(result.error || "Failed to update actor health");
        }
      } catch (err: any) {
        setError(err.message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [apiCall, encounter?.id],
  );

  return {
    encounter,
    isLoading,
    error,
    createEncounter,
    getEncounter,
    startEncounter,
    endEncounter,
    addCharacterToEncounter,
    addMonsterToEncounter,
    updateActorHealth,
  };
};
