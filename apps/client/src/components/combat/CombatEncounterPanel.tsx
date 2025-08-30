/**
 * Combat Encounter Panel - Manage combat encounters with initiative, HP tracking, and conditions
 */
import React, { useState, useEffect } from 'react';
import { logger } from '@vtt/logging';
import { 
  Sword, 
  Shield, 
  Heart, 
  Plus, 
  Minus,
  SkipForward,
  RotateCcw,
  Settings,
  Users,
  Timer,
  Zap,
  AlertTriangle,
  Eye,
  EyeOff,
  Trash2,
  Edit,
  Save,
  X
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { cn } from '../../lib/utils';

interface CombatEncounterPanelProps {
  campaignId: string;
  sceneId: string;
  isVisible: boolean;
  onToggleVisibility: () => void;
}

interface Combatant {
  id: string;
  name: string;
  initiative: number;
  maxHp: number;
  currentHp: number;
  armorClass: number;
  isPlayer: boolean;
  isVisible: boolean;
  conditions: Condition[];
  tokenId?: string;
  notes: string;
}

interface Condition {
  id: string;
  name: string;
  description: string;
  duration: number; // -1 for indefinite
  color: string;
}

interface CombatEncounter {
  id: string;
  name: string;
  isActive: boolean;
  currentRound: number;
  currentTurn: number;
  combatants: Combatant[];
  startTime?: Date;
}

const COMMON_CONDITIONS = [
  { name: 'Blinded', color: '#6B7280', description: 'Cannot see, attacks have disadvantage' },
  { name: 'Charmed', color: '#EC4899', description: 'Cannot attack charmer, charmer has advantage on social interactions' },
  { name: 'Deafened', color: '#9CA3AF', description: 'Cannot hear, automatically fails hearing-based checks' },
  { name: 'Frightened', color: '#7C2D12', description: 'Disadvantage on ability checks and attacks while source is in sight' },
  { name: 'Grappled', color: '#92400E', description: 'Speed becomes 0, cannot benefit from bonuses to speed' },
  { name: 'Incapacitated', color: '#991B1B', description: 'Cannot take actions or reactions' },
  { name: 'Paralyzed', color: '#450A0A', description: 'Incapacitated, cannot move or speak, fails Strength and Dexterity saves' },
  { name: 'Poisoned', color: '#166534', description: 'Disadvantage on attack rolls and ability checks' },
  { name: 'Prone', color: '#A16207', description: 'Disadvantage on attack rolls, attacks within 5 feet have advantage' },
  { name: 'Restrained', color: '#7C2D12', description: 'Speed becomes 0, disadvantage on attacks and Dexterity saves' },
  { name: 'Stunned', color: '#7E22CE', description: 'Incapacitated, cannot move, fails Strength and Dexterity saves' },
  { name: 'Unconscious', color: '#000000', description: 'Incapacitated, cannot move or speak, drops items, falls prone' },
];

export function CombatEncounterPanel({_ 
  campaignId, _sceneId, 
  _isVisible, _onToggleVisibility}: CombatEncounterPanelProps) {
  const [encounter, setEncounter] = useState<CombatEncounter | null>(null);
  const [loading, setLoading] = useState(false);
  const [_editingCombatant, _setEditingCombatant] = useState<string | null>(null);
  const [showAddCombatant, setShowAddCombatant] = useState(false);
  const [newCombatant, setNewCombatant] = useState({
    name: '',
    initiative: 10,
    maxHp: 10,
    currentHp: 10,
    armorClass: 10,
    isPlayer: false,
  });

  useEffect(() => {
    if (isVisible && sceneId) {
      loadEncounter();
    }
  }, [isVisible, sceneId]);

  const loadEncounter = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/scenes/${sceneId}/encounter`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setEncounter(data.encounter);
      } else if (response.status === 404) {
        // No encounter exists yet
        setEncounter(null);
      }
    } catch (error) {
      logger.error('Error loading encounter:', error);
    } finally {
      setLoading(false);
    }
  };

  const startNewEncounter = async () => {
    try {
      const response = await fetch(`/api/scenes/${sceneId}/encounter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: `Combat - ${new Date().toLocaleDateString()}`,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setEncounter(data.encounter);
      }
    } catch (error) {
      logger.error('Error starting encounter:', error);
    }
  };

  const endEncounter = async () => {
    if (!encounter) return;
    
    const confirm = window.confirm('Are you sure you want to end this encounter?');
    if (!confirm) return;

    try {
      await fetch(`/api/encounters/${encounter.id}/end`, {
        method: 'POST',
        credentials: 'include'
      });
      
      setEncounter(null);
    } catch (error) {
      logger.error('Error ending encounter:', error);
    }
  };

  const addCombatant = async () => {
    if (!encounter || !newCombatant.name.trim()) return;

    try {
      const response = await fetch(`/api/encounters/${encounter.id}/combatants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...newCombatant,
          currentHp: newCombatant.maxHp,
        }),
      });

      if (response.ok) {
        await loadEncounter();
        setNewCombatant({
          name: '',
          initiative: 10,
          maxHp: 10,
          currentHp: 10,
          armorClass: 10,
          isPlayer: false,
        });
        setShowAddCombatant(false);
      }
    } catch (error) {
      logger.error('Error adding combatant:', error);
    }
  };

  const updateCombatant = async (_combatantId: string, _updates: Partial<Combatant>) => {
    if (!encounter) return;

    try {
      await fetch(`/api/combatants/${combatantId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(updates),
      });

      // Update local state
      setEncounter(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          combatants: prev.combatants.map(c => 
            c.id === combatantId ? { ...c, ...updates } : c
          )
        };
      });
    } catch (error) {
      logger.error('Error updating combatant:', error);
    }
  };

  const removeCombatant = async (_combatantId: string) => {
    if (!encounter) return;

    try {
      await fetch(`/api/combatants/${combatantId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      setEncounter(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          combatants: prev.combatants.filter(c => c.id !== combatantId)
        };
      });
    } catch (error) {
      logger.error('Error removing combatant:', error);
    }
  };

  const nextTurn = async () => {
    if (!encounter || encounter.combatants.length === 0) return;

    const nextTurnIndex = (encounter.currentTurn + 1) % encounter.combatants.length;
    const nextRound = nextTurnIndex === 0 ? encounter.currentRound + 1 : encounter.currentRound;

    try {
      await fetch(`/api/encounters/${encounter.id}/next-turn`, {
        method: 'POST',
        credentials: 'include'
      });

      setEncounter(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          currentTurn: nextTurnIndex,
          currentRound: nextRound
        };
      });
    } catch (error) {
      logger.error('Error advancing turn:', error);
    }
  };

  const addCondition = async (_combatantId: string, _conditionName: string) => {
    const condition = COMMON_CONDITIONS.find(c => c.name === conditionName);
    if (!condition) return;

    const newCondition = {
      id: Date.now().toString(),
      name: condition.name,
      description: condition.description,
      duration: -1,
      color: condition.color,
    };

    await updateCombatant(combatantId, {
      conditions: [
        ...(encounter?.combatants.find(c => c.id === combatantId)?.conditions || []),
        newCondition
      ]
    });
  };

  const removeCondition = async (_combatantId: string, _conditionId: string) => {
    const combatant = encounter?.combatants.find(c => c.id === combatantId);
    if (!combatant) return;

    await updateCombatant(combatantId, {
      conditions: combatant.conditions.filter(c => c.id !== conditionId)
    });
  };

  if (!isVisible) {
    return (
      <Button
        variant="primary"
        size="sm"
        onClick={onToggleVisibility}
        className="fixed bottom-4 right-4 z-40"
      >
        <Sword className="h-4 w-4 mr-2" />
        Combat
      </Button>
    );
  }

  return (
    <Card className="fixed bottom-4 right-4 w-96 max-h-[80vh] z-40 shadow-xl">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sword className="h-5 w-5" />
          Combat Tracker
        </CardTitle>
        <div className="flex items-center gap-2">
          {encounter && (
            <Badge variant="secondary" className="text-xs">
              Round {encounter.currentRound}
            </Badge>
          )}
          <Button variant="ghost" size="icon" onClick={onToggleVisibility}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 max-h-[60vh] overflow-y-auto">
        {loading ? (
          <div className="text-center py-8 text-neutral-500">
            Loading encounter...
          </div>
        ) : !encounter ? (
          <div className="text-center py-8">
            <Sword className="h-12 w-12 mx-auto text-neutral-400 mb-4" />
            <p className="text-neutral-600 mb-4">No active encounter</p>
            <Button onClick={startNewEncounter} variant="primary">
              <Plus className="h-4 w-4 mr-2" />
              Start Encounter
            </Button>
          </div>
        ) : (
          <>
            {/* Current Turn Display */}
            {encounter.combatants.length > 0 && (
              <div className="bg-primary-50 border border-primary-200 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-primary-800">
                      Current Turn
                    </p>
                    <p className="text-lg font-bold text-primary-900">
                      {encounter.combatants[encounter.currentTurn]?.name || 'Unknown'}
                    </p>
                  </div>
                  <Button onClick={nextTurn} variant="primary" size="sm">
                    <SkipForward className="h-4 w-4 mr-1" />
                    Next
                  </Button>
                </div>
              </div>
            )}

            {/* Combatants List */}
            <div className="space-y-2">
              {encounter.combatants
                .sort((_a, _b) => b.initiative - a.initiative)
                .map((combatant, _index) => (
                <div
                  key={combatant.id}
                  className={cn(
                    "border rounded-lg p-3 transition-colors",
                    index === encounter.currentTurn ? "border-primary-300 bg-primary-50" : "border-neutral-200"
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant={combatant.isPlayer ? "success" : "secondary"} className="text-xs">
                        {combatant.initiative}
                      </Badge>
                      <span className="font-medium">{combatant.name}</span>
                      {!combatant.isVisible && (
                        <EyeOff className="h-3 w-3 text-neutral-400" />
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => updateCombatant(combatant.id, { isVisible: !combatant.isVisible })}
                        className="h-6 w-6"
                      >
                        {combatant.isVisible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeCombatant(combatant.id)}
                        className="h-6 w-6 text-error-600 hover:text-error-700"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  {/* HP and AC */}
                  <div className="flex items-center gap-4 mb-2">
                    <div className="flex items-center gap-1">
                      <Heart className="h-4 w-4 text-error-500" />
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => updateCombatant(combatant.id, { 
                            currentHp: Math.max(0, combatant.currentHp - 1) 
                          })}
                          className="h-6 w-6"
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className={cn(
                          "text-sm font-mono min-w-[3rem] text-center",
                          combatant.currentHp <= 0 ? "text-error-600 font-bold" : ""
                        )}>
                          {combatant.currentHp}/{combatant.maxHp}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => updateCombatant(combatant.id, { 
                            currentHp: Math.min(combatant.maxHp, combatant.currentHp + 1) 
                          })}
                          className="h-6 w-6"
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Shield className="h-4 w-4 text-neutral-500" />
                      <span className="text-sm font-mono">AC {combatant.armorClass}</span>
                    </div>
                  </div>

                  {/* Conditions */}
                  {combatant.conditions.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {combatant.conditions.map((condition) => (
                        <Badge
                          key={condition.id}
                          variant="outline"
                          className="text-xs cursor-pointer"
                          style={{ borderColor: condition.color, _color: condition.color }}
                          onClick={() => removeCondition(combatant.id, condition.id)}
                        >
                          {condition.name}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* Add Condition */}
                  <div className="flex gap-1">
                    <select
                      onChange={(e) => {
                        if (e.target.value) {
                          addCondition(combatant.id, e.target.value);
                          e.target.value = '';
                        }
                      }}
                      className="text-xs px-2 py-1 border border-neutral-300 rounded flex-1"
                    >
                      <option value="">Add condition...</option>
                      {COMMON_CONDITIONS.map((_condition) => (
                        <option key={condition.name} value={condition.name}>
                          {condition.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>

            {/* Add Combatant */}
            {showAddCombatant ? (
              <div className="border border-neutral-300 rounded-lg p-3 space-y-3">
                <Input
                  placeholder="Combatant name"
                  value={newCombatant.name}
                  onChange={(e) => setNewCombatant(prev => ({ ...prev, name: e.target.value }))}
                />
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="number"
                    placeholder="Initiative"
                    value={newCombatant.initiative}
                    onChange={(e) => setNewCombatant(prev => ({ ...prev, initiative: parseInt(e.target.value) || 0 }))}
                  />
                  <Input
                    type="number"
                    placeholder="Max HP"
                    value={newCombatant.maxHp}
                    onChange={(e) => setNewCombatant(prev => ({ 
                      ...prev, 
                      maxHp: parseInt(e.target.value) || 0,
                      currentHp: parseInt(e.target.value) || 0
                    }))}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    placeholder="AC"
                    value={newCombatant.armorClass}
                    onChange={(e) => setNewCombatant(prev => ({ ...prev, armorClass: parseInt(e.target.value) || 0 }))}
                    className="flex-1"
                  />
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={newCombatant.isPlayer}
                      onChange={(e) => setNewCombatant(prev => ({ ...prev, isPlayer: e.target.checked }))}
                    />
                    Player
                  </label>
                </div>
                <div className="flex gap-2">
                  <Button onClick={addCombatant} variant="primary" size="sm" className="flex-1">
                    <Save className="h-4 w-4 mr-1" />
                    Add
                  </Button>
                  <Button 
                    onClick={() => setShowAddCombatant(false)} 
                    variant="outline" 
                    size="sm"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Button 
                onClick={() => setShowAddCombatant(true)} 
                variant="outline" 
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Combatant
              </Button>
            )}

            {/* Encounter Actions */}
            <div className="flex gap-2 pt-2 border-t">
              <Button onClick={endEncounter} variant="outline" size="sm" className="flex-1">
                <RotateCcw className="h-4 w-4 mr-1" />
                End Encounter
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
