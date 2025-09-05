/**
 * Combat tracker component for managing initiative and combat flow
 */

import React, { useState, useEffect, memo, useCallback, useMemo } from "react";
import "./CombatTracker.css";

export interface Combatant {
  id: string;
  name: string;
  type: "player" | "npc" | "monster";
  initiative: number;
  hitPoints: {
    current: number;
    max: number;
    temporary: number;
  };
  armorClass: number;
  abilities?: {
    strength: number;
    dexterity: number;
    constitution: number;
    intelligence: number;
    wisdom: number;
    charisma: number;
  };
  conditions: Array<{
    name: string;
    duration: number;
    description: string;
  }>;
  isActive: boolean;
  isVisible: boolean;
}

export interface CombatTrackerProps {
  combatants: Combatant[];
  currentTurn: number;
  round: number;
  isActive: boolean;
  onInitiativeChange: (_combatantId: string, _initiative: number) => void;
  onHealthChange: (_combatantId: string, _current: number, _temporary?: number) => void;
  onConditionAdd: (
    _combatantId: string,
    condition: { name: string; duration: number; description: string },
  ) => void;
  onConditionRemove: (_combatantId: string, _conditionName: string) => void;
  onNextTurn: () => void;
  onPreviousTurn: () => void;
  onStartCombat: () => void;
  onEndCombat: () => void;
  onAddCombatant: (combatant: Omit<Combatant, "id">) => void;
  onRemoveCombatant: (_combatantId: string) => void;
  readOnly?: boolean;
}

export const CombatTracker: React.FC<CombatTrackerProps> = memo(({
  combatants,
  currentTurn,
  round,
  isActive,
  onInitiativeChange,
  onHealthChange,
  onConditionAdd,
  onConditionRemove,
  onNextTurn,
  onPreviousTurn,
  onStartCombat,
  onEndCombat,
  onAddCombatant,
  onRemoveCombatant,
  readOnly = false,
}) => {
  const [showAddForm, setShowAddForm] = useState(false);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (readOnly) {return;}

      // Keyboard shortcuts
      switch (e.key) {
        case "n":
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            onNextTurn();
          }
          break;
        case "p":
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            onPreviousTurn();
          }
          break;
        case "s":
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            if (isActive) {
              onEndCombat();
            } else {
              onStartCombat();
            }
          }
          break;
        case "Escape":
          setShowAddForm(false);
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isActive, readOnly, onNextTurn, onPreviousTurn, onStartCombat, onEndCombat]);
  const [newCombatant, setNewCombatant] = useState({
    name: "",
    type: "monster" as const,
    initiative: 10,
    hitPoints: { current: 10, max: 10, temporary: 0 },
    armorClass: 10,
    abilities: {
      strength: 10,
      dexterity: 10,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 10,
    },
    conditions: [],
    isActive: true,
    isVisible: true,
  });

  // Memoize expensive sorting operation
  const sortedCombatants = useMemo(() => 
    [...combatants].sort((a, b) => b.initiative - a.initiative),
    [combatants]
  );
  const currentCombatant = sortedCombatants[currentTurn];

  const handleAddCombatant = useCallback(() => {
    if (newCombatant.name.trim()) {
      onAddCombatant(newCombatant);
      setNewCombatant({
        name: "",
        type: "monster",
        initiative: 10,
        hitPoints: { current: 10, max: 10, temporary: 0 },
        armorClass: 10,
        abilities: {
          strength: 10,
          dexterity: 10,
          constitution: 10,
          intelligence: 10,
          wisdom: 10,
          charisma: 10,
        },
        conditions: [],
        isActive: true,
        isVisible: true,
      });
      setShowAddForm(false);
    }
  }, [newCombatant.name, newCombatant.type, newCombatant.initiative, newCombatant.hitPoints, newCombatant.armorClass, onAddCombatant]);

  const rollInitiative = useCallback((combatant: Combatant) => {
    const roll = Math.floor(Math.random() * 20) + 1;
    // Calculate D&D 5e ability modifier: (ability - 10) / 2, rounded down
    const dexterity = combatant.abilities?.dexterity || 10;
    const dexMod = Math.floor((dexterity - 10) / 2);
    onInitiativeChange(combatant.id, roll + dexMod);
  }, [onInitiativeChange]);

  const getHealthPercentage = useCallback((combatant: Combatant) => {
    return (combatant.hitPoints.current / combatant.hitPoints.max) * 100;
  }, []);

  const getHealthBarColor = useCallback((percentage: number) => {
    if (percentage <= 0) {return "dead";}
    if (percentage <= 25) {return "critical";}
    if (percentage <= 50) {return "bloodied";}
    if (percentage <= 75) {return "injured";}
    return "healthy";
  }, []);

  return (
    <div className="combat-tracker">
      <div className="combat-header">
        <div className="combat-status">
          {isActive ? (
            <>
              <h3>Combat Active</h3>
              <div className="round-info">
                <span>Round {round}</span>
                {currentCombatant && (
                  <span className="current-turn">Current: {currentCombatant.name}</span>
                )}
              </div>
            </>
          ) : (
            <h3>Combat Inactive</h3>
          )}
        </div>

        {!readOnly && (
          <div className="combat-controls">
            {!isActive ? (
              <button className="start-combat-btn" onClick={onStartCombat}>
                Start Combat
              </button>
            ) : (
              <>
                <button className="prev-turn-btn" onClick={onPreviousTurn}>
                  Previous
                </button>
                <button className="next-turn-btn" onClick={onNextTurn}>
                  Next Turn
                </button>
                <button className="end-combat-btn" onClick={onEndCombat}>
                  End Combat
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <div className="combatants-list">
        {sortedCombatants.map((combatant, index) => (
          <div
            key={combatant.id}
            className={`combatant ${index === currentTurn ? "current-turn" : ""} ${
              combatant.hitPoints.current <= 0 ? "unconscious" : ""
            }`}
          >
            <div className="combatant-header">
              <div className="combatant-name">
                <span className="name">{combatant.name}</span>
                <span className={`type-badge ${combatant.type}`}>{combatant.type}</span>
              </div>

              <div className="initiative-section">
                <label>Initiative:</label>
                {!readOnly ? (
                  <div className="initiative-controls">
                    <input
                      type="number"
                      value={combatant.initiative}
                      onChange={(e) =>
                        onInitiativeChange(combatant.id, parseInt(e.target.value) || 0)
                      }
                      className="initiative-input"
                    />
                    <button
                      className="roll-initiative-btn"
                      onClick={() => rollInitiative(combatant)}
                      title="Roll Initiative"
                    >
                      🎲
                    </button>
                  </div>
                ) : (
                  <span className="initiative-display">{combatant.initiative}</span>
                )}
              </div>

              {!readOnly && (
                <button
                  className="remove-combatant-btn"
                  onClick={() => onRemoveCombatant(combatant.id)}
                  title="Remove Combatant"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="combatant-stats">
              <div className="health-section">
                <label>HP:</label>
                <div className="health-controls">
                  {!readOnly ? (
                    <>
                      <input
                        type="number"
                        value={combatant.hitPoints.current}
                        onChange={(e) =>
                          onHealthChange(combatant.id, parseInt(e.target.value) || 0)
                        }
                        className="health-input"
                        min="0"
                        max={combatant.hitPoints.max}
                      />
                      <span>/</span>
                      <span className="max-hp">{combatant.hitPoints.max}</span>
                      {combatant.hitPoints.temporary > 0 && (
                        <span className="temp-hp">+{combatant.hitPoints.temporary}</span>
                      )}
                    </>
                  ) : (
                    <span>
                      {combatant.hitPoints.current}/{combatant.hitPoints.max}
                      {combatant.hitPoints.temporary > 0 && (
                        <span className="temp-hp">+{combatant.hitPoints.temporary}</span>
                      )}
                    </span>
                  )}
                </div>
                <div className={`health-bar ${getHealthBarColor(getHealthPercentage(combatant))}`}>
                  <div
                    className="health-fill"
                    style={{ width: `${Math.max(0, getHealthPercentage(combatant))}%` }}
                  />
                </div>
              </div>

              <div className="ac-section">
                <label>AC:</label>
                <span className="ac-value">{combatant.armorClass}</span>
              </div>
            </div>

            {combatant.conditions.length > 0 && (
              <div className="conditions-section">
                <label>Conditions:</label>
                <div className="conditions-list">
                  {combatant.conditions.map((condition, idx) => (
                    <div key={idx} className="condition-badge">
                      <span className="condition-name">{condition.name}</span>
                      {condition.duration > 0 && (
                        <span className="condition-duration">({condition.duration})</span>
                      )}
                      {!readOnly && (
                        <button
                          className="remove-condition-btn"
                          onClick={() => onConditionRemove(combatant.id, condition.name)}
                          title="Remove Condition"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {!readOnly && (
        <div className="add-combatant-section">
          {!showAddForm ? (
            <button className="add-combatant-btn" onClick={() => setShowAddForm(true)}>
              Add Combatant
            </button>
          ) : (
            <div className="add-combatant-form">
              <div className="form-row">
                <input
                  type="text"
                  placeholder="Name"
                  value={newCombatant.name}
                  onChange={(e) => setNewCombatant({ ...newCombatant, name: e.target.value })}
                  className="name-input"
                />
                <select
                  value={newCombatant.type}
                  onChange={(e) =>
                    setNewCombatant({ ...newCombatant, type: e.target.value as any })
                  }
                  className="type-select"
                >
                  <option value="player">Player</option>
                  <option value="npc">NPC</option>
                  <option value="monster">Monster</option>
                </select>
              </div>

              <div className="form-row">
                <label>Initiative:</label>
                <input
                  type="number"
                  value={newCombatant.initiative}
                  onChange={(e) =>
                    setNewCombatant({ ...newCombatant, initiative: parseInt(e.target.value) || 0 })
                  }
                  className="stat-input"
                />

                <label>HP:</label>
                <input
                  type="number"
                  value={newCombatant.hitPoints.max}
                  onChange={(e) => {
                    const hp = parseInt(e.target.value) || 0;
                    setNewCombatant({
                      ...newCombatant,
                      hitPoints: { current: hp, max: hp, temporary: 0 },
                    });
                  }}
                  className="stat-input"
                />

                <label>AC:</label>
                <input
                  type="number"
                  value={newCombatant.armorClass}
                  onChange={(e) =>
                    setNewCombatant({ ...newCombatant, armorClass: parseInt(e.target.value) || 0 })
                  }
                  className="stat-input"
                />
              </div>

              <div className="form-actions">
                <button
                  onClick={handleAddCombatant}
                  className="confirm-btn"
                  aria-label="Add new item"
                >
                  Add
                </button>
                <button onClick={() => setShowAddForm(false)} className="cancel-btn">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export default CombatTracker;
