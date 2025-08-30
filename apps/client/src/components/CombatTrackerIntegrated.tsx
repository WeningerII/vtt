/**
 * Integrated Combat Tracker - Uses real encounter data and API integration
 */

import React, { useState, useEffect, useCallback } from 'react';
import { logger } from '@vtt/logging';
import { useEncounter, CombatActor, EncounterData } from '../hooks/useEncounter';
import { useCharacter } from '../hooks/useCharacter';
import './CombatTracker.css';

interface CombatTrackerIntegratedProps {
  encounterId?: string;
  campaignId: string;
  onEncounterChange?: (encounter: EncounterData | null) => void;
  readOnly?: boolean;
}

interface AddCombatantData {
  type: 'character' | 'monster';
  id: string;
  name?: string; // For monster instances
}

export const CombatTrackerIntegrated: React.FC<CombatTrackerIntegratedProps> = ({encounterId, campaignId, onEncounterChange, readOnly = false}) => {
  const { encounter, 
    isLoading, 
    error, 
    createEncounter, 
    getEncounter, 
    startEncounter, 
    endEncounter, 
    addCharacterToEncounter, 
    addMonsterToEncounter, 
    updateActorHealth
   } = useEncounter();

  const { characters } = useCharacter();
  
  const [showAddDialog, setShowAddDialog] = useState(false);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (readOnly) return;
      
      // Keyboard shortcuts
      switch(e.key) {
        case 'n':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            onNextTurn();
          }
          break;
        case 'p':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            onPreviousTurn();
          }
          break;
        case 's':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            if (isActive) {
              onEndCombat();
            } else {
              onStartCombat();
            }
          }
          break;
        case 'Escape':
          setShowAddForm(false);
          break;
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActive, readOnly, onNextTurn, onPreviousTurn, onStartCombat, onEndCombat]);
  const [addCombatantData, setAddCombatantData] = useState<AddCombatantData>({
    type: 'character',
    id: ''
  });

  // Load encounter data
  useEffect(() => {
    if (encounterId) {
      getEncounter(encounterId);
    }
  }, [encounterId, getEncounter]);

  // Notify parent of encounter changes
  useEffect(() => {
    if (onEncounterChange) {
      onEncounterChange(encounter);
    }
  }, [encounter, onEncounterChange]);

  const handleCreateEncounter = useCallback(async (name: string) => {
    try {
      await createEncounter({
        name,
        campaignId,
        characterIds: [],
        monsters: []
      });
    } catch (error) {
      logger.error('Failed to create encounter:', error);
    }
  }, [createEncounter, campaignId]);

  const handleStartCombat = useCallback(async () => {
    if (!encounter?.id) return;
    
    try {
      await startEncounter(encounter.id);
    } catch (error) {
      logger.error('Failed to start encounter:', error);
    }
  }, [encounter?.id, startEncounter]);

  const handleEndCombat = useCallback(async () => {
    if (!encounter?.id) return;
    
    try {
      await endEncounter(encounter.id);
    } catch (error) {
      logger.error('Failed to end encounter:', error);
    }
  }, [encounter?.id, endEncounter]);

  const handleHealthChange = useCallback(async (
    actorId: string, 
    current: number, 
    temporary: number = 0
  ) => {
    const actor = encounter?.actors.find(a => a.id === actorId);
    if (!actor) return;

    try {
      await updateActorHealth(actorId, {
        current,
        max: actor.hitPoints.max,
        temporary
      });
    } catch (error) {
      logger.error('Failed to update actor health:', error);
    }
  }, [encounter?.actors, updateActorHealth]);

  const handleAddCombatant = useCallback(async () => {
    if (!encounter?.id || !addCombatantData.id) return;

    try {
      if (addCombatantData.type === 'character') {
        await addCharacterToEncounter(encounter.id, addCombatantData.id);
      } else {
        await addMonsterToEncounter(encounter.id, addCombatantData.id, addCombatantData.name);
      }
      
      setShowAddDialog(false);
      setAddCombatantData({ type: 'character', id: '' });
    } catch (error) {
      logger.error('Failed to add combatant:', error);
    }
  }, [encounter?.id, addCombatantData, addCharacterToEncounter, addMonsterToEncounter]);

  const getHealthBarColor = (actor: CombatActor): string => {
    const percentage = (actor.hitPoints.current / actor.hitPoints.max) * 100;
    if (percentage <= 25) return '#dc3545'; // Red
    if (percentage <= 50) return '#fd7e14'; // Orange
    if (percentage <= 75) return '#ffc107'; // Yellow
    return '#28a745'; // Green
  };

  const getHealthStatus = (actor: CombatActor): string => {
    const percentage = (actor.hitPoints.current / actor.hitPoints.max) * 100;
    if (actor.hitPoints.current <= 0) return 'Unconscious';
    if (percentage <= 25) return 'Critical';
    if (percentage <= 50) return 'Bloodied';
    if (percentage <= 75) return 'Injured';
    return 'Healthy';
  };

  if (isLoading) {
    return <div className="combat-tracker loading">Loading encounter...</div>;
  }

  if (error) {
    return <div className="combat-tracker error">Error: {error}</div>;
  }

  if (!encounter) {
    return (
      <div className="combat-tracker no-encounter">
        <h3>No Encounter Active</h3>
        <button 
          onClick={() => handleCreateEncounter('New Encounter')}
          disabled={readOnly}
        >
          Create Encounter
        </button>
      </div>
    );
  }

  const sortedActors = [...encounter.actors].sort((a, b) => b.initiative - a.initiative);
  const _currentActor = sortedActors[encounter.currentTurn] || null;

  return (
    <div className="combat-tracker">
      <div className="combat-header">
        <h3>{encounter.name}</h3>
        <div className="combat-controls">
          {encounter.isActive ? (
            <>
              <span className="round-counter">Round {encounter.currentRound}</span>
              <button onClick={handleEndCombat} disabled={readOnly} >End Combat</button>
            </>
          ) : (
            <button 
              onClick={handleStartCombat} 
              disabled={readOnly || encounter.actors.length === 0} >
              Start Combat
            </button>
          )}
        </div>
      </div>

      <div className="combatants-list">
        {sortedActors.map((actor, index) => (
          <div 
            key={actor.id} 
            className={`combatant ${index === encounter.currentTurn ? 'active-turn' : ''} ${actor.type}`}
          >
            <div className="combatant-header">
              <div className="combatant-name">
                <span className="name">{actor.name}</span>
                <span className="type-badge">{actor.type === 'character' ? 'PC' : 'NPC'}</span>
              </div>
              <div className="initiative">
                <label>Init:</label>
                <input 
                  type="number" 
                  value={actor.initiative} 
                  onChange={(e) => {
                    const newInitiative = parseInt(e.target.value) || 0;
                    // Initiative change would be handled here
                    logger.info('Initiative change:', { actorId: actor.id, newInitiative });
                  }}
                  disabled={readOnly}
                  className="initiative-input"
                />
              </div>
            </div>

            <div className="combatant-stats">
              <div className="health-section">
                <div className="health-bar-container">
                  <div 
                    className="health-bar" 
                    style={{ 
                      width: `${(actor.hitPoints.current / actor.hitPoints.max) * 100}%`,
                      backgroundColor: getHealthBarColor(actor)
                    }}
                  />
                </div>
                <div className="health-numbers">
                  <input 
                    type="number" 
                    value={actor.hitPoints.current}
                    onChange={(e) => handleHealthChange(actor.id, parseInt(e.target.value) || 0, actor.hitPoints.temporary)}
                    disabled={readOnly}
                    className="health-input current"
                    min="0"
                    max={actor.hitPoints.max + actor.hitPoints.temporary}
                  />
                  <span>/</span>
                  <span className="max-hp">{actor.hitPoints.max}</span>
                  {actor.hitPoints.temporary > 0 && (
                    <>
                      <span>+</span>
                      <input 
                        type="number" 
                        value={actor.hitPoints.temporary}
                        onChange={(e) => handleHealthChange(actor.id, actor.hitPoints.current, parseInt(e.target.value) || 0)}
                        disabled={readOnly}
                        className="health-input temp"
                        min="0"
                      />
                      <span className="temp-label">temp</span>
                    </>
                  )}
                </div>
                <div className="health-status">{getHealthStatus(actor)}</div>
              </div>

              <div className="combat-stats">
                <span className="ac">AC: {actor.armorClass}</span>
                <span className="speed">Speed: {actor.speed}ft</span>
              </div>

              {actor.conditions.length > 0 && (
                <div className="conditions">
                  {actor.conditions.map((condition, idx) => (
                    <span key={idx} className="condition-badge">
                      {condition.type}
                      {condition.duration > 0 && ` (${condition.duration})`}
                    </span>
                  ))}
                </div>
              )}

              {actor.actions.length > 0 && (
                <div className="actions">
                  <details>
                    <summary>Actions ({actor.actions.length})</summary>
                    <div className="actions-list">
                      {actor.actions.slice(0, 3).map(action => (
                        <div key={action.id} className="action-item">
                          <span className="action-name">{action.name}</span>
                          <span className="action-type">({action.type.replace('', ' ')})</span>
                        </div>
                      ))}
                      {actor.actions.length > 3 && (
                        <div className="action-item">+ {actor.actions.length - 3} more</div>
                      )}
                    </div>
                  </details>
                </div>
              )}
            </div>
          </div>
        ))}

        {encounter.actors.length === 0 && (
          <div className="no-combatants">
            <p>No combatants added to this encounter.</p>
            <p>Click "Add Combatant" to get started.</p>
          </div>
        )}
      </div>

      {!readOnly && (
        <div className="combat-actions">
          <button 
            onClick={() => setShowAddDialog(true)}
            className="add-combatant-btn"
          >
            Add Combatant
          </button>
        </div>
      )}

      {showAddDialog && (
        <div className="modal-overlay">
          <div className="modal">
            <h4>Add Combatant</h4>
            
            <div className="form-group">
              <label>Type:</label>
              <select 
                value={addCombatantData.type} 
                onChange={(e) => setAddCombatantData(prev => ({ 
                  ...prev, 
                  type: e.target.value as 'character' | 'monster',
                  id: '' 
                }))}
              >
                <option value="character">Character</option>
                <option value="monster">Monster</option>
              </select>
            </div>

            {addCombatantData.type === 'character' ? (
              <div className="form-group">
                <label>Character:</label>
                <select 
                  value={addCombatantData.id} 
                  onChange={(e) => setAddCombatantData(prev => ({ 
                    ...prev, 
                    id: e.target.value 
                  }))}
                >
                  <option value="">Select a character...</option>
                  {characters.map(char => (
                    <option key={char.id} value={char.id}>
                      {char.name} (Level {char.level} {char.class})
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <>
                <div className="form-group">
                  <label>Monster ID:</label>
                  <input 
                    type="text" 
                    value={addCombatantData.id}
                    onChange={(e) => setAddCombatantData(prev => ({ 
                      ...prev, 
                      id: e.target.value 
                    }))}
                    placeholder="Enter monster ID..."
                  />
                </div>
                <div className="form-group">
                  <label>Instance Name (optional):</label>
                  <input 
                    type="text" 
                    value={addCombatantData.name || ''}
                    onChange={(e) => setAddCombatantData(prev => ({ 
                      ...prev, 
                      name: e.target.value 
                    }))}
                    placeholder="e.g., Goblin 1, Boss Orc..."
                  />
                </div>
              </>
            )}

            <div className="modal-actions">
              <button onClick={handleAddCombatant} disabled={!addCombatantData.id} >
                Add
              </button>
              <button onClick={() => setShowAddDialog(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CombatTrackerIntegrated;
