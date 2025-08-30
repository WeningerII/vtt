/**
 * Dice roller component for making rolls and displaying results
 */

import React, { useState, useCallback, useMemo, memo, useEffect } from 'react';
import './DiceRoller.css';

export interface DiceRoll {
  id: string;
  expression: string;
  result: number;
  breakdown: string;
  timestamp: Date;
  roller: string;
  type: 'attack' | 'damage' | 'save' | 'skill' | 'ability' | 'custom';
  advantage?: boolean | undefined;
  disadvantage?: boolean | undefined;
}

export interface DiceRollerProps {
  onRoll: (roll: DiceRoll) => void;
  recentRolls: DiceRoll[];
  playerName: string;
  readOnly?: boolean;
}

export const DiceRoller = memo<DiceRollerProps>(({ onRoll, recentRolls, playerName, readOnly = false }) => {
  const [expression, setExpression] = useState('1d20');

  // Keyboard shortcut for rolling dice
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'r' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleRoll();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
  const [rollType, setRollType] = useState<DiceRoll['type']>('custom');
  const [advantage, setAdvantage] = useState(false);
  const [disadvantage, setDisadvantage] = useState(false);
  const [modifier, setModifier] = useState(0);

  const commonRolls = useMemo(() => [
    { label: 'd4', expression: '1d4' },
    { label: 'd6', expression: '1d6' },
    { label: 'd8', expression: '1d8' },
    { label: 'd10', expression: '1d10' },
    { label: 'd12', expression: '1d12' },
    { label: 'd20', expression: '1d20' },
    { label: 'd100', expression: '1d100' },
  ], []);

  const rollDice = useCallback((diceExpression: string): { result: number; breakdown: string } => {
    // Parse dice expression (e.g., "2d6+3", "1d20", "3d8-2")
    const match = diceExpression.match(/(\d+)?d(\d+)([+-]\d+)?/i);
    if (!match) {
      return { result: 0, breakdown: 'Invalid expression' };
    }

    const numDice = parseInt(match[1] || '1');
    const dieSize = parseInt(match[2]!);
    const modifierMatch = match[3];
    const mod = modifierMatch ? parseInt(modifierMatch) : 0;

    const rolls: number[] = [];
    for (let i = 0; i < numDice; i++) {
      rolls.push(Math.floor(Math.random() * dieSize) + 1);
    }

    const sum = rolls.reduce((acc, roll) => acc + roll, 0);
    const total = sum + mod;

    let breakdown = `${numDice}d${dieSize}`;
    if (rolls.length <= 10) {
      breakdown += ` (${rolls.join(', ')})`;
    }
    if (mod !== 0) {
      breakdown += ` ${mod >= 0 ? '+' : ''}${mod}`;
    }
    breakdown += ` = ${total}`;

    return { result: total, breakdown };
  }, []);

  const rollWithAdvantage = useCallback((baseExpression: string): { result: number; breakdown: string } => {
    if (!advantage && !disadvantage) {
      return rollDice(baseExpression);
    }

    // For advantage/disadvantage, we assume d20 rolls
    if (!baseExpression.includes('d20')) {
      return rollDice(baseExpression);
    }

    const roll1 = Math.floor(Math.random() * 20) + 1;
    const roll2 = Math.floor(Math.random() * 20) + 1;

    const chosenRoll = advantage ? Math.max(roll1, roll2) : Math.min(roll1, roll2);
    const total = chosenRoll + modifier;

    const advantageType = advantage ? 'advantage' : 'disadvantage';
    const breakdown = `1d20 with ${advantageType} (${roll1}, ${roll2}) + ${modifier} = ${total}`;

    return { result: total, breakdown };
  }, [advantage, disadvantage, modifier, rollDice]);

  const handleRoll = useCallback(() => {
    if (readOnly) return;

    let finalExpression = expression;
    let rollResult: { result: number; breakdown: string };

    if ((advantage || disadvantage) && expression.includes('d20')) {
      rollResult = rollWithAdvantage(expression);
    } else {
      // Add modifier to expression if it doesn't already have one
      if (modifier !== 0 && !expression.includes('+') && !expression.includes('-')) {
        finalExpression = `${expression}${modifier >= 0 ? '+' : ''}${modifier}`;
      }
      rollResult = rollDice(finalExpression);
    }

    const roll: DiceRoll = {
      id: `roll_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      expression: finalExpression,
      result: rollResult.result,
      breakdown: rollResult.breakdown,
      timestamp: new Date(),
      roller: playerName,
      type: rollType,
      advantage: advantage ? true : undefined,
      disadvantage: disadvantage ? true : undefined,
    };

    onRoll(roll);
  }, [readOnly, expression, advantage, disadvantage, modifier, playerName, rollType, onRoll, rollWithAdvantage, rollDice]);

  const handleQuickRoll = useCallback((quickExpression: string) => {
    if (readOnly) return;

    const rollResult = rollDice(quickExpression);
    const roll: DiceRoll = {
      id: `roll_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      expression: quickExpression,
      result: rollResult.result,
      breakdown: rollResult.breakdown,
      timestamp: new Date(),
      roller: playerName,
      type: 'custom',
    };

    onRoll(roll);
  }, [readOnly, playerName, onRoll, rollDice]);

  const formatTime = useCallback((date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }, []);

  const getRollTypeColor = useCallback((type: DiceRoll['type']) => {
    const colors = {
      attack: '#dc3545',
      damage: '#fd7e14',
      save: '#28a745',
      skill: '#007bff',
      ability: '#6f42c1',
      custom: '#6c757d',
    };
    return colors[type];
  }, []);

  return (
    <div className="dice-roller">
      <div className="roller-header">
        <h3>Dice Roller</h3>
      </div>

      {!readOnly && (
        <div className="roll-controls">
          <div className="expression-input">
            <label>Dice Expression:</label>
            <input
              type="text"
              value={expression}
              onChange={(e) => setExpression(e.target.value)}
              placeholder="e.g., 1d20+5, 2d6, 3d8-1"
              className="dice-input"
            />
          </div>

          <div className="roll-modifiers">
            <div className="modifier-input">
              <label>Modifier:</label>
              <input
                type="number"
                value={modifier}
                onChange={(e) => setModifier(parseInt(e.target.value) || 0)}
                className="modifier-field"
              />
            </div>

            <div className="advantage-controls">
              <label className={`advantage-btn ${advantage ? 'active' : ''}`}>
                <input
                  type="checkbox"
                  checked={advantage}
                  onChange={(e) => {
                    setAdvantage(e.target.checked);
                    if (e.target.checked) setDisadvantage(false);
                  }}
                />
                Advantage
              </label>
              <label className={`disadvantage-btn ${disadvantage ? 'active' : ''}`}>
                <input
                  type="checkbox"
                  checked={disadvantage}
                  onChange={(e) => {
                    setDisadvantage(e.target.checked);
                    if (e.target.checked) setAdvantage(false);
                  }}
                />
                Disadvantage
              </label>
            </div>
          </div>

          <div className="roll-type">
            <label>Roll Type:</label>
            <select
              value={rollType}
              onChange={(e) => setRollType(e.target.value as DiceRoll['type'])}
              className="type-select"
            >
              <option value="custom">Custom</option>
              <option value="attack">Attack</option>
              <option value="damage">Damage</option>
              <option value="save">Saving Throw</option>
              <option value="skill">Skill Check</option>
              <option value="ability">Ability Check</option>
            </select>
          </div>

          <button className="roll-btn" onClick={handleRoll} >
            Roll Dice
          </button>

          <div className="quick-rolls">
            <label>Quick Rolls:</label>
            <div className="quick-roll-buttons">
              {commonRolls.map((roll) => (
                <button
                  key={roll.expression}
                  className="quick-roll-btn"
                  onClick={() => handleQuickRoll(roll.expression)}
                >
                  {roll.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="recent-rolls">
        <h4>Recent Rolls</h4>
        <div className="rolls-list">
          {recentRolls.length === 0 ? (
            <div className="no-rolls">No rolls yet</div>
          ) : (
            recentRolls.slice(0, 10).map((roll) => (
              <div key={roll.id} className="roll-result">
                <div className="roll-header">
                  <span className="roller-name">{roll.roller}</span>
                  <span className="roll-time">{formatTime(roll.timestamp)}</span>
                  <span
                    className="roll-type-badge"
                    style={{ backgroundColor: getRollTypeColor(roll.type) }}
                  >
                    {roll.type}
                  </span>
                </div>
                
                <div className="roll-details">
                  <div className="roll-expression">{roll.expression}</div>
                  <div className="roll-breakdown">{roll.breakdown}</div>
                  {(roll.advantage || roll.disadvantage) && (
                    <div className="roll-advantage">
                      {roll.advantage ? 'With Advantage' : 'With Disadvantage'}
                    </div>
                  )}
                </div>
                
                <div className="roll-total">{roll.result}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
});
