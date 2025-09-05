/**
 * Dice Roller Component - Advanced dice rolling mechanics with modifiers and custom rolls
 */

import React, { useState, useRef } from "react";
import { logger } from "@vtt/logging";
import { useWebSocket } from "../../providers/WebSocketProvider";
import { useAuth } from "../../providers/AuthProvider";
import { useGame } from "../../providers/GameProvider";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Dice1, Dice2, Dice3, Dice4, Dice5, Dice6, RotateCcw, History } from "lucide-react";
import { cn } from "../../lib/utils";

interface DiceRoll {
  id: string;
  dice: string;
  total: number;
  individual: number[];
  modifier: number;
  createdAt: string;
  public: boolean;
}

interface DiceRollerProps {
  className?: string;
  onRoll?: (roll: DiceRoll) => void;
}

const COMMON_DICE = [
  { sides: 4, icon: Dice1, color: "text-red-400" },
  { sides: 6, icon: Dice2, color: "text-blue-400" },
  { sides: 8, icon: Dice3, color: "text-green-400" },
  { sides: 10, icon: Dice4, color: "text-yellow-400" },
  { sides: 12, icon: Dice5, color: "text-purple-400" },
  { sides: 20, icon: Dice6, color: "text-accent-primary" },
];

const PRESET_ROLLS = [
  { label: "Attack", dice: "1d20", modifier: 0 },
  { label: "Damage", dice: "1d8", modifier: 0 },
  { label: "Initiative", dice: "1d20", modifier: 0 },
  { label: "Ability Check", dice: "1d20", modifier: 0 },
  { label: "Saving Throw", dice: "1d20", modifier: 0 },
  { label: "Ability Score", dice: "4d6", modifier: 0, dropLowest: true },
];

export function DiceRoller({ className, onRoll }: DiceRollerProps): JSX.Element {
  const { user } = useAuth();
  const { session } = useGame();
  const { send } = useWebSocket();

  const [diceCount, setDiceCount] = useState(1);
  const [diceSides, setDiceSides] = useState(20);
  const [modifier, setModifier] = useState(0);
  const [customDice, setCustomDice] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [rollHistory, setRollHistory] = useState<DiceRoll[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [advantage, setAdvantage] = useState<"none" | "advantage" | "disadvantage">("none");

  const inputRef = useRef<HTMLInputElement>(null);

  const parseDiceNotation = (
    notation: string,
  ): { count: number; sides: number; modifier: number } => {
    const match = notation.match(/^(\d+)?d(\d+)([+-]\d+)?$/i);
    if (!match) {throw new Error("Invalid dice notation");}

    const count = parseInt(match[1] || "1", 10);
    const sides = parseInt(match[2]!, 10);
    const mod = parseInt(match[3] || "0", 10);

    return { count, sides, modifier: mod };
  };

  const rollDice = (sides: number, count: number = 1): number[] => {
    return Array.from({ length: count }, () => Math.floor(Math.random() * sides) + 1);
  };

  const calculateTotal = (rolls: number[], modifier: number): number => {
    return rolls.reduce((sum, roll) => sum + roll, 0) + modifier;
  };

  const executeRoll = (diceNotation?: string, rollModifier?: number, isRollPublic?: boolean) => {
    if (!session || !user) {return;}

    let rollCount: number;
    let rollSides: number;
    let rollMod: number;

    try {
      if (diceNotation) {
        const parsed = parseDiceNotation(diceNotation);
        rollCount = parsed.count;
        rollSides = parsed.sides;
        rollMod = parsed.modifier + (rollModifier || 0);
      } else {
        rollCount = diceCount;
        rollSides = diceSides;
        rollMod = modifier;
      }

      // Handle advantage/disadvantage for d20 rolls
      let finalRolls: number[];
      if (rollSides === 20 && rollCount === 1 && advantage !== "none") {
        const rolls = rollDice(rollSides, 2);
        if (advantage === "advantage") {
          finalRolls = [Math.max(...rolls)];
        } else {
          finalRolls = [Math.min(...rolls)];
        }
      } else {
        finalRolls = rollDice(rollSides, rollCount);
      }

      const total = calculateTotal(finalRolls, rollMod);
      const notation = `${rollCount}d${rollSides}${rollMod > 0 ? "+" : ""}${rollMod !== 0 ? rollMod : ""}`;

      const roll: DiceRoll = {
        id: `roll_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        dice: notation,
        total,
        individual: finalRolls,
        modifier: rollMod,
        createdAt: new Date().toISOString(),
        public: isRollPublic ?? isPublic,
      };

      // Add to history
      setRollHistory((prev) => [roll, ...prev.slice(0, 19)]); // Keep last 20 rolls

      // Send to server
      const rollData = {
        type: "ROLL_DICE",
        sessionId: session.id,
        timestamp: Date.now(),
        ...roll,
      };

      send(rollData);
      onRoll?.(roll);
    } catch (error) {
      logger.error("Failed to execute roll:", error);
    }
  };

  const handlePresetRoll = (preset: (typeof PRESET_ROLLS)[0]) => {
    executeRoll(preset.dice, preset.modifier, isPublic);
  };

  const handleCustomRoll = () => {
    if (!customDice.trim()) {return;}

    try {
      executeRoll(customDice.trim(), 0, isPublic);
      setCustomDice("");
    } catch (error) {
      logger.error("Invalid dice notation:", error);
    }
  };

  const handleQuickRoll = (sides: number) => {
    setDiceSides(sides);
    executeRoll(`1d${sides}`, 0, isPublic);
  };

  const clearHistory = () => {
    setRollHistory([]);
  };

  const getDiceIcon = (sidesParam: number) => {
    const dice = COMMON_DICE.find((d) => d.sides === sidesParam);
    return dice ? dice.icon : Dice6;
  };

  const getDiceColor = (sidesParam: number) => {
    const dice = COMMON_DICE.find((d) => d.sides === sidesParam);
    return dice ? dice.color : "text-primary";
  };

  if (!session) {
    return (
      <div className={cn("bg-bg-secondary rounded-lg border border-border-primary p-4", className)}>
        <p className="text-text-secondary text-center">
          Join a game session to access dice rolling
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "bg-bg-secondary rounded-lg border border-border-primary p-4 space-y-4",
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-primary flex items-center gap-2">
          <Dice6 className="h-5 w-5 text-accent-primary" />
          Dice Roller
        </h3>

        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              className="rounded"
            />
            Public Roll
          </label>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowHistory(!showHistory)}
            leftIcon={<History className="h-4 w-4" />}
          >
            History
          </Button>
        </div>
      </div>

      {/* Quick Dice Buttons */}
      <div className="grid grid-cols-6 gap-2">
        {COMMON_DICE.map(({ sides, icon: Icon, color }) => (
          <Button
            key={sides}
            variant="ghost"
            size="sm"
            onClick={() => handleQuickRoll(sides)}
            className="flex flex-col items-center gap-1 h-auto py-2"
          >
            <Icon className={cn("h-5 w-5", color)} />
            <span className="text-xs">d{sides}</span>
          </Button>
        ))}
      </div>

      {/* Custom Roll Builder */}
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="block text-xs text-text-secondary mb-1">Count</label>
            <Input
              type="number"
              min="1"
              max="100"
              value={diceCount}
              onChange={(e) => setDiceCount(parseInt(e.target.value) || 1)}
              className="text-center"
            />
          </div>

          <div>
            <label className="block text-xs text-text-secondary mb-1">Sides</label>
            <Input
              type="number"
              min="2"
              max="1000"
              value={diceSides}
              onChange={(e) => setDiceSides(parseInt(e.target.value) || 20)}
              className="text-center"
            />
          </div>

          <div>
            <label className="block text-xs text-text-secondary mb-1">Modifier</label>
            <Input
              type="number"
              min="-100"
              max="100"
              value={modifier}
              onChange={(e) => setModifier(parseInt(e.target.value) || 0)}
              className="text-center"
            />
          </div>
        </div>

        {/* Advantage/Disadvantage for d20 */}
        {diceSides === 20 && diceCount === 1 && (
          <div className="flex justify-center gap-1">
            <Button
              variant={advantage === "none" ? "primary" : "ghost"}
              size="sm"
              onClick={() => setAdvantage("none")}
            >
              Normal
            </Button>
            <Button
              variant={advantage === "advantage" ? "success" : "ghost"}
              size="sm"
              onClick={() => setAdvantage("advantage")}
            >
              Advantage
            </Button>
            <Button
              variant={advantage === "disadvantage" ? "destructive" : "ghost"}
              size="sm"
              onClick={() => setAdvantage("disadvantage")}
            >
              Disadvantage
            </Button>
          </div>
        )}

        <Button
          variant="primary"
          fullWidth
          onClick={() => executeRoll()}
          leftIcon={<Dice6 className="h-4 w-4" />}
        >
          Roll {diceCount}d{diceSides}
          {modifier !== 0 && (modifier > 0 ? `+${modifier}` : modifier)}
        </Button>
      </div>

      {/* Custom Dice Notation */}
      <div className="space-y-2">
        <label className="block text-xs text-text-secondary">
          Custom Dice (e.g., 3d6+2, 1d20-1)
        </label>
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            type="text"
            value={customDice}
            onChange={(e) => setCustomDice(e.target.value)}
            placeholder="2d8+3, 1d100, etc."
            onKeyPress={(e) => e.key === "Enter" && handleCustomRoll()}
          />
          <Button variant="secondary" onClick={handleCustomRoll} disabled={!customDice.trim()}>
            Roll
          </Button>
        </div>
      </div>

      {/* Preset Rolls */}
      <div className="space-y-2">
        <label className="block text-xs text-text-secondary">Common Rolls</label>
        <div className="grid grid-cols-2 gap-2">
          {PRESET_ROLLS.map((preset) => (
            <Button
              key={preset.label}
              variant="ghost"
              size="sm"
              onClick={() => handlePresetRoll(preset)}
              className="justify-start"
            >
              <span className="text-xs">{preset.label}</span>
            </Button>
          ))}
        </div>
      </div>

      {/* Roll History */}
      {showHistory && (
        <div className="border-t border-border-primary pt-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-primary">Roll History</h4>
            {rollHistory.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearHistory}
                leftIcon={<RotateCcw className="h-3 w-3" />}
              >
                Clear
              </Button>
            )}
          </div>

          <div className="space-y-2 max-h-32 overflow-y-auto">
            {rollHistory.length === 0 ? (
              <p className="text-text-tertiary text-sm text-center py-4">No rolls yet</p>
            ) : (
              rollHistory.map((roll) => (
                <div
                  key={roll.id}
                  className="flex items-center justify-between text-sm bg-bg-tertiary rounded p-2"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={cn("font-mono", getDiceColor(roll.individual.length > 0 ? 20 : 6))}
                    >
                      {roll.dice}
                    </span>
                    <span className="text-text-tertiary">[{roll.individual.join(", ")}]</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-accent-primary">{roll.total}</span>
                    {!roll.public && <span className="text-xs text-text-tertiary">Private</span>}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
