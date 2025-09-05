/**
 * Token Properties Panel - Manage token details, conditions, and stats
 */

import React, { useState, memo } from "react";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { cn } from "../../lib/utils";
import {
  X,
  Save,
  Trash2,
  Plus,
  Eye,
  EyeOff,
  RotateCw,
  Palette,
  Heart,
  Shield,
  Zap,
  Clock,
  Skull,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";
import type { Token } from "./BattleMap";

interface TokenPropertiesPanelProps {
  token: Token | null;
  onClose: () => void;
  onUpdate: (_tokenId: string, _updates: Partial<Token>) => void;
  onDelete: (_tokenId: string) => void;
  isGM?: boolean;
}

const CONDITION_TYPES = [
  {
    id: "blinded",
    name: "Blinded",
    icon: Eye,
    color: "#6b7280",
    description: "Cannot see and automatically fails sight-based checks",
  },
  {
    id: "charmed",
    name: "Charmed",
    icon: Heart,
    color: "#ec4899",
    description: "Cannot attack the charmer or target them with harmful abilities",
  },
  {
    id: "deafened",
    name: "Deafened",
    icon: AlertTriangle,
    color: "#f59e0b",
    description: "Cannot hear and automatically fails hearing-based checks",
  },
  {
    id: "frightened",
    name: "Frightened",
    icon: Skull,
    color: "#7c3aed",
    description: "Disadvantage on ability checks and attack rolls while source of fear is in sight",
  },
  {
    id: "grappled",
    name: "Grappled",
    icon: Zap,
    color: "#059669",
    description: "Speed becomes 0 and cannot benefit from bonuses to speed",
  },
  {
    id: "incapacitated",
    name: "Incapacitated",
    icon: Clock,
    color: "#dc2626",
    description: "Cannot take actions or reactions",
  },
  {
    id: "invisible",
    name: "Invisible",
    icon: EyeOff,
    color: "#6366f1",
    description: "Cannot be seen without magical means, heavily obscured for hiding",
  },
  {
    id: "paralyzed",
    name: "Paralyzed",
    icon: X,
    color: "#991b1b",
    description: "Incapacitated and cannot move or speak, fails Strength and Dexterity saves",
  },
  {
    id: "petrified",
    name: "Petrified",
    icon: Shield,
    color: "#78716c",
    description: "Transformed into solid inanimate substance, incapacitated",
  },
  {
    id: "poisoned",
    name: "Poisoned",
    icon: Skull,
    color: "#16a34a",
    description: "Disadvantage on attack rolls and ability checks",
  },
  {
    id: "prone",
    name: "Prone",
    icon: RotateCw,
    color: "#ea580c",
    description: "Disadvantage on attack rolls, attacks against have advantage if within 5 feet",
  },
  {
    id: "restrained",
    name: "Restrained",
    icon: Zap,
    color: "#b91c1c",
    description: "Speed becomes 0, disadvantage on Dexterity saves, attacks against have advantage",
  },
  {
    id: "stunned",
    name: "Stunned",
    icon: AlertTriangle,
    color: "#fbbf24",
    description: "Incapacitated, cannot move, and can speak only falteringly",
  },
  {
    id: "unconscious",
    name: "Unconscious",
    icon: Clock,
    color: "#374151",
    description: "Incapacitated, cannot move or speak, and is unaware of surroundings",
  },
];

const TOKEN_SIZES = [
  { value: 0.5, label: "Tiny" },
  { value: 1, label: "Small/Medium" },
  { value: 2, label: "Large" },
  { value: 3, label: "Huge" },
  { value: 4, label: "Gargantuan" },
];

const PRESET_COLORS = [
  "#3b82f6",
  "#ef4444",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#84cc16",
  "#f97316",
  "#6366f1",
];

export const TokenPropertiesPanel = memo(({
  token,
  onClose,
  onUpdate,
  onDelete,
  isGM = false,
}: TokenPropertiesPanelProps) => {
  const [editedToken, setEditedToken] = useState<Token | null>(token);
  const [showConditions, setShowConditions] = useState(false);

  if (!token || !editedToken) {return null;}

  const handleSave = () => {
    onUpdate(token.id, editedToken);
    onClose();
  };

  const handleDelete = () => {
    if (window.confirm(`Are you sure you want to delete "${token.name}"?`)) {
      onDelete(token.id);
      onClose();
    }
  };

  const updateField = (field: keyof Token, value: any) => {
    setEditedToken((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const addCondition = (conditionId: string) => {
    if (!editedToken.conditions.includes(conditionId)) {
      updateField("conditions", [...editedToken.conditions, conditionId]);
    }
  };

  const removeCondition = (conditionId: string) => {
    updateField(
      "conditions",
      editedToken.conditions.filter((id) => id !== conditionId),
    );
  };

  const updateHitPoints = (field: "current" | "max", value: number) => {
    const hp = editedToken.hitPoints || { current: 1, max: 1 };
    updateField("hitPoints", { ...hp, [field]: Math.max(0, value) });
  };

  const getConditionInfo = (conditionId: string) => {
    return CONDITION_TYPES.find((c) => c.id === conditionId);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-bg-secondary rounded-lg border border-border-primary w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border-primary">
          <h2 className="text-lg font-semibold text-primary">Token Properties</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Basic Info */}
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-primary mb-1">Name</label>
              <Input
                value={editedToken.name}
                onChange={(e) => updateField("name", e.target.value)}
                placeholder="Token name"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-primary mb-1">Size</label>
                <select
                  value={editedToken.size}
                  onChange={(e) => updateField("size", parseFloat(e.target.value))}
                  className="w-full px-3 py-2 bg-primary border border-border-primary rounded-md text-primary text-sm"
                >
                  {TOKEN_SIZES.map((size) => (
                    <option key={size.value} value={size.value}>
                      {size.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-primary mb-1">Rotation</label>
                <Input
                  type="number"
                  min="0"
                  max="360"
                  step="15"
                  value={editedToken.rotation}
                  onChange={(e) => updateField("rotation", parseInt(e.target.value) || 0)}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-primary mb-1">Color</label>
              <div className="flex gap-2 mb-2">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => updateField("color", color)}
                    className={cn(
                      "w-8 h-8 rounded border-2 transition-all",
                      editedToken.color === color
                        ? "border-accent-primary scale-110"
                        : "border-border-primary hover:scale-105",
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              <Input
                type="color"
                value={editedToken.color}
                onChange={(e) => updateField("color", e.target.value)}
                className="w-full h-10"
              />
            </div>

            {isGM && (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="visible"
                  checked={editedToken.isVisible}
                  onChange={(e) => updateField("isVisible", e.target.checked)}
                  className="rounded border-border-primary"
                />
                <label
                  htmlFor="visible"
                  className="text-sm text-primary flex items-center gap-1"
                >
                  {editedToken.isVisible ? (
                    <Eye className="h-4 w-4" />
                  ) : (
                    <EyeOff className="h-4 w-4" />
                  )}
                  Visible to Players
                </label>
              </div>
            )}
          </div>

          {/* Health */}
          <div className="space-y-3">
            <h3 className="text-md font-semibold text-primary">Health</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-primary mb-1">
                  Current HP
                </label>
                <Input
                  type="number"
                  min="0"
                  value={editedToken.hitPoints?.current || 0}
                  onChange={(e) => updateHitPoints("current", parseInt(e.target.value) || 0)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-primary mb-1">Max HP</label>
                <Input
                  type="number"
                  min="1"
                  value={editedToken.hitPoints?.max || 1}
                  onChange={(e) => updateHitPoints("max", parseInt(e.target.value) || 1)}
                />
              </div>
            </div>

            {editedToken.hitPoints && (
              <div className="bg-bg-tertiary rounded p-2">
                <div className="flex justify-between text-sm text-text-secondary mb-1">
                  <span>Health</span>
                  <span>
                    {editedToken.hitPoints.current}/{editedToken.hitPoints.max}
                  </span>
                </div>
                <div className="w-full bg-primary rounded-full h-2">
                  <div
                    className={cn(
                      "h-2 rounded-full transition-all",
                      editedToken.hitPoints.current <= editedToken.hitPoints.max * 0.25
                        ? "bg-red-500"
                        : editedToken.hitPoints.current <= editedToken.hitPoints.max * 0.5
                          ? "bg-yellow-500"
                          : "bg-green-500",
                    )}
                    style={{
                      width: `${Math.max(0, (editedToken.hitPoints.current / editedToken.hitPoints.max) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Conditions */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-md font-semibold text-primary">Conditions</h3>
              <Button variant="ghost" size="sm" onClick={() => setShowConditions(!showConditions)}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {/* Applied Conditions */}
            <div className="space-y-2">
              {editedToken.conditions.map((conditionId) => {
                const condition = getConditionInfo(conditionId);
                if (!condition) {return null;}

                return (
                  <div
                    key={conditionId}
                    className="flex items-center justify-between p-2 bg-bg-tertiary rounded border"
                  >
                    <div className="flex items-center gap-2">
                      <condition.icon className="h-4 w-4" style={{ color: condition.color }} />
                      <span className="text-sm font-medium text-primary">
                        {condition.name}
                      </span>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => removeCondition(conditionId)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                );
              })}

              {editedToken.conditions.length === 0 && (
                <div className="text-center py-4 text-text-secondary text-sm">
                  No conditions applied
                </div>
              )}
            </div>

            {/* Available Conditions */}
            {showConditions && (
              <div className="border border-border-primary rounded p-2 space-y-1 max-h-40 overflow-y-auto">
                {CONDITION_TYPES.filter(
                  (condition) => !editedToken.conditions.includes(condition.id),
                ).map((condition) => (
                  <button
                    key={condition.id}
                    onClick={() => {
                      addCondition(condition.id);
                      setShowConditions(false);
                    }}
                    className="w-full flex items-center gap-2 p-2 text-left hover:bg-bg-secondary rounded transition-colors"
                  >
                    <condition.icon className="h-4 w-4" style={{ color: condition.color }} />
                    <div>
                      <div className="text-sm font-medium text-primary">{condition.name}</div>
                      <div className="text-xs text-text-secondary">{condition.description}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Character Info */}
          <div className="space-y-3">
            <h3 className="text-md font-semibold text-primary">Character Info</h3>
            <div>
              <label className="block text-sm font-medium text-primary mb-1">
                Character ID
              </label>
              <Input
                value={editedToken.characterId || ""}
                onChange={(e) => updateField("characterId", e.target.value)}
                placeholder="Link to character sheet"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-primary mb-1">Player ID</label>
              <Input
                value={editedToken.playerId || ""}
                onChange={(e) => updateField("playerId", e.target.value)}
                placeholder="Player owner"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-border-primary">
          <div>
            {isGM && (
              <Button
                variant="ghost"
                onClick={handleDelete}
                className="text-danger hover:text-danger"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSave}>
              <Save className="h-4 w-4 mr-2" />
              Save
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
});

export default TokenPropertiesPanel;
