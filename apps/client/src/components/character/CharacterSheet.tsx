/**
 * Character Sheet Component - Main character management interface
 */

import { useState, useEffect, useMemo, useCallback, memo } from "react";
import { logger } from "@vtt/logging";
import { Download, Save, Settings, User } from "lucide-react";

import { useAuth } from "../../providers/AuthProvider";
import { useWebSocket } from "../../providers/WebSocketProvider";
import { AbilityScores } from "./AbilityScores";
import { SkillsPanel } from "./SkillsPanel";
import { EquipmentPanel } from "./EquipmentPanel";
import { SpellsPanel } from "./SpellsPanel";
import { NotesPanel } from "./NotesPanel";
import { Button } from "../ui/Button";
import { LoadingSpinner } from "../ui/LoadingSpinner";
// Additional icons not in lucide-react
const Shield = () => <span>🛡️</span>;
const Sword = () => <span>⚔️</span>;
const Book = () => <span>📚</span>;
const Backpack = () => <span>🎒</span>;
const FileText = () => <span>📄</span>;
import { cn } from "../../lib/utils";

export interface Character {
  id: string;
  userId: string;
  name: string;
  class: string;
  race: string;
  background: string;
  level: number;
  experience: number;
  hitPoints: number;
  maxHitPoints: number;
  tempHitPoints: number;
  armorClass: number;
  speed: number;
  proficiencyBonus: number;
  inspiration: boolean;
  abilities: {
    strength: number;
    dexterity: number;
    constitution: number;
    intelligence: number;
    wisdom: number;
    charisma: number;
  };
  savingThrows: {
    strength: { proficient: boolean; value: number };
    dexterity: { proficient: boolean; value: number };
    constitution: { proficient: boolean; value: number };
    intelligence: { proficient: boolean; value: number };
    wisdom: { proficient: boolean; value: number };
    charisma: { proficient: boolean; value: number };
  };
  skills: Record<string, { proficient: boolean; expertise: boolean; value: number }>;
  equipment: Equipment[];
  spells: Spell[];
  features: Feature[];
  notes: string;
  avatar?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Equipment {
  id: string;
  name: string;
  type: "weapon" | "armor" | "tool" | "consumable" | "treasure" | "other";
  quantity: number;
  weight: number;
  value: number;
  description: string;
  equipped: boolean;
  properties: string[];
}

export interface Spell {
  id: string;
  name: string;
  level: number;
  school: string;
  castingTime: string;
  range: string;
  components: string[];
  duration: string;
  description: string;
  prepared: boolean;
  known: boolean;
}

export interface Feature {
  id: string;
  name: string;
  source: string;
  description: string;
  type: "class" | "race" | "background" | "feat" | "other";
  uses?: {
    current: number;
    max: number;
    resetOn: "short" | "long" | "other";
  };
}

interface CharacterSheetProps {
  characterId?: string | undefined;
  className?: string;
  onCharacterUpdate?: (character: Character) => void;
}

type TabType = "stats" | "skills" | "equipment" | "spells" | "notes";

export const CharacterSheet = memo(({
  characterId,
  className,
  onCharacterUpdate,
}: CharacterSheetProps) => {
  const { user } = useAuth();
  const { send } = useWebSocket();
  const [character, setCharacter] = useState<Character | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("stats");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Load character data
  useEffect(() => {
    const loadCharacter = async () => {
      if (!characterId) {
        // Create new character
        const newCharacter: Character = createDefaultCharacter();
        setCharacter(newCharacter);
        setIsEditing(true);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        // Mock character data for now
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const mockCharacter = _createMockCharacter(characterId);
        setCharacter(mockCharacter);
      } catch (error) {
        logger.error("Failed to load character:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadCharacter();
  }, [characterId]);

  const createDefaultCharacter = (): Character => {
    return {
      id: `char_${Date.now()}`,
      userId: user?.id || "",
      name: "New Character",
      class: "Fighter",
      race: "Human",
      background: "Folk Hero",
      level: 1,
      experience: 0,
      hitPoints: 10,
      maxHitPoints: 10,
      tempHitPoints: 0,
      armorClass: 10,
      speed: 30,
      proficiencyBonus: 2,
      inspiration: false,
      abilities: {
        strength: 15,
        dexterity: 14,
        constitution: 13,
        intelligence: 12,
        wisdom: 10,
        charisma: 8,
      },
      savingThrows: {
        strength: { proficient: true, value: 4 },
        dexterity: { proficient: false, value: 2 },
        constitution: { proficient: true, value: 3 },
        intelligence: { proficient: false, value: 1 },
        wisdom: { proficient: false, value: 0 },
        charisma: { proficient: false, value: -1 },
      },
      skills: {
        "Animal Handling": { proficient: true, expertise: false, value: 2 },
        Athletics: { proficient: true, expertise: false, value: 4 },
        Intimidation: { proficient: false, expertise: false, value: -1 },
        Perception: { proficient: false, expertise: false, value: 0 },
      },
      equipment: [],
      spells: [],
      features: [],
      notes: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  };

  const _createMockCharacter = (id: string): Character => {
    const base = createDefaultCharacter();
    return {
      ...base,
      id,
      name: "Thorin Ironbeard",
      class: "Fighter",
      race: "Dwarf",
      background: "Soldier",
      level: 3,
      experience: 900,
      hitPoints: 28,
      maxHitPoints: 28,
      armorClass: 16,
      equipment: [
        {
          id: "eq1",
          name: "Longsword",
          type: "weapon",
          quantity: 1,
          weight: 3,
          value: 15,
          description: "A versatile martial weapon",
          equipped: true,
          properties: ["Versatile (1d10)"],
        },
        {
          id: "eq2",
          name: "Chain Mail",
          type: "armor",
          quantity: 1,
          weight: 55,
          value: 75,
          description: "Heavy armor made of interlocking metal rings",
          equipped: true,
          properties: ["AC 16", "Disadvantage on Stealth"],
        },
      ],
      features: [
        {
          id: "f1",
          name: "Second Wind",
          source: "Fighter Class",
          description: "Regain hit points equal to 1d10 + fighter level",
          type: "class",
          uses: { current: 1, max: 1, resetOn: "short" },
        },
        {
          id: "f2",
          name: "Action Surge",
          source: "Fighter Class",
          description: "Take an additional action on your turn",
          type: "class",
          uses: { current: 1, max: 1, resetOn: "short" },
        },
      ],
    };
  };

  const updateCharacter = useCallback(
    (updates: Partial<Character>) => {
      if (!character) {return;}

      const updatedCharacter = {
        ...character,
        ...updates,
        updatedAt: new Date().toISOString(),
      };

      setCharacter(updatedCharacter);
      setHasUnsavedChanges(true);
      onCharacterUpdate?.(updatedCharacter);
    },
    [character, onCharacterUpdate],
  );

  const saveCharacter = useCallback(async () => {
    if (!character) {return;}

    try {
      // Send character data to server
      send({
        type: "CHARACTER_UPDATE" as const,
        message: `Character ${character.name} updated`,
        channel: "system",
      });

      setHasUnsavedChanges(false);
      setIsEditing(false);
    } catch (error) {
      logger.error("Failed to save character:", error);
    }
  }, [character, send]);

  const exportCharacter = useCallback(() => {
    if (!character) {return;}

    const dataStr = JSON.stringify(character, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `${character.name.replace(/\s+/g, "")}_character.json`;
    link.click();

    URL.revokeObjectURL(url);
  }, [character]);

  const renderTabContent = () => {
    if (!character) {return null;}

    switch (activeTab) {
      case "stats":
        return (
          <AbilityScores character={character} isEditing={isEditing} onUpdate={updateCharacter} />
        );
      case "skills":
        return (
          <SkillsPanel character={character} isEditing={isEditing} onUpdate={updateCharacter} />
        );
      case "equipment":
        return (
          <EquipmentPanel character={character} isEditing={isEditing} onUpdate={updateCharacter} />
        );
      case "spells":
        return (
          <SpellsPanel character={character} isEditing={isEditing} onUpdate={updateCharacter} />
        );
      case "notes":
        return (
          <NotesPanel character={character} isEditing={isEditing} onUpdate={updateCharacter} />
        );
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className={cn("flex items-center justify-center p-8", className)}>
        <LoadingSpinner showLabel label="Loading character..." />
      </div>
    );
  }

  if (!character) {
    return (
      <div className={cn("flex items-center justify-center p-8", className)}>
        <div className="text-center">
          <span className="h-12 w-12 text-text-tertiary mx-auto mb-4 block">
            <User />
          </span>
          <h3 className="text-lg font-medium text-primary mb-2">Character Not Found</h3>
          <p className="text-text-secondary">The requested character could not be loaded.</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "bg-bg-secondary rounded-lg border border-border-primary flex flex-col",
        className,
      )}
    >
      {/* Character Header */}
      <div className="p-4 border-b border-border-primary">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-accent-primary flex items-center justify-center text-white font-bold text-lg">
              {character.avatar ? (
                <img
                  src={character.avatar}
                  alt={character.name}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                character.name.charAt(0).toUpperCase()
              )}
            </div>

            <div>
              <h2 className="text-xl font-bold text-primary">{character.name}</h2>
              <p className="text-text-secondary">
                Level {character.level} {character.race} {character.class}
              </p>
              <p className="text-xs text-text-tertiary">
                {character.background} • {character.experience} XP
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {hasUnsavedChanges && <span className="text-warning text-sm">Unsaved changes</span>}

            <Button className="px-2 py-1 hover:bg-neutral-100 rounded" onClick={exportCharacter}>
              <span className="h-4 w-4 mr-1 inline-block">
                <Download />
              </span>
              Export
            </Button>

            {isEditing ? (
              <Button
                className="px-2 py-1 bg-primary-500 text-white hover:bg-primary-600 rounded"
                onClick={saveCharacter}
              >
                <span className="h-4 w-4 mr-1 inline-block">
                  <Save />
                </span>
                Save
              </Button>
            ) : (
              <Button
                className="px-2 py-1 border border-neutral-300 hover:bg-neutral-50 rounded"
                onClick={() => setIsEditing(true)}
              >
                <span className="h-4 w-4 mr-1 inline-block">
                  <Settings />
                </span>
                Edit
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-border-primary">
        <div className="flex">
          {[
            { key: "stats", label: "Stats", icon: Shield },
            { key: "skills", label: "Skills", icon: Sword },
            { key: "equipment", label: "Equipment", icon: Backpack },
            { key: "spells", label: "Spells", icon: Book },
            { key: "notes", label: "Notes", icon: FileText },
          ].map(({ key, label: _label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key as TabType)}
              className={cn(
                "flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2",
                activeTab === key
                  ? "text-accent-primary border-accent-primary bg-accent-light"
                  : "text-text-secondary border-transparent hover:text-primary hover:bg-bg-tertiary",
              )}
            >
              <span className="h-4 w-4">
                <Icon />
              </span>
              {_label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">{renderTabContent()}</div>
    </div>
  );
});
