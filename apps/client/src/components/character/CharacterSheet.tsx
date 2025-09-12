/**
 * Character Sheet Component - Main character management interface
 */

import React, { useState, useEffect, useMemo, useCallback, memo, lazy, Suspense } from "react";
import { logger } from "@vtt/logging";
import { Download, Save, Settings, User, Heart, Shield, Zap, Edit3, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/Card";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Input } from "../ui/Input";
import { Textarea } from "../ui/textarea";
import { Label } from "../ui/label";
import { Separator } from "../ui/separator";
import { LoadingSpinner } from "../ui/LoadingSpinner";
import { cn } from "../../lib/utils";
import { useAuth } from "../../providers/AuthProvider";
import { Character, Ability, Skill, Equipment, Spell, Feature } from "@vtt/core-schemas";
import { useWebSocket } from "../../providers/WebSocketProvider";
// Lazy-load heavy panels to reduce initial work and heat on laptops
const AbilityScores = lazy(() =>
  import("./AbilityScores").then((m) => ({ default: m.AbilityScores })),
);
const SkillsPanel = lazy(() => import("./SkillsPanel").then((m) => ({ default: m.SkillsPanel })));
const EquipmentPanel = lazy(() =>
  import("./EquipmentPanel").then((m) => ({ default: m.EquipmentPanel })),
);
const SpellsPanel = lazy(() => import("./SpellsPanel").then((m) => ({ default: m.SpellsPanel })));
const FeaturesPanel = lazy(() =>
  import("./FeaturesPanel").then((m) => ({ default: m.FeaturesPanel })),
);
const NotesPanel = lazy(() => import("./NotesPanel").then((m) => ({ default: m.NotesPanel })));

// Additional icons not in lucide-react
const Sword = () => <span>⚔️</span>;
const Book = () => <span>📚</span>;
const Backpack = () => <span>🎒</span>;
const FileText = () => <span>📄</span>;

// Additional types already imported above with Character from @vtt/core-schemas

// Use unified Character type from core-schemas with date string conversion
interface LocalCharacter extends Omit<Character, "createdAt" | "updatedAt"> {
  createdAt: string;
  updatedAt: string;
}

// Re-export types for other components to use
export type { Character, Equipment, Spell, Feature } from "@vtt/core-schemas";

export interface CharacterSheetProps {
  characterId: string;
  onUpdate?: (character: Character) => void;
  className?: string;
  onCharacterUpdate?: (character: Character) => void;
}

type TabType = "stats" | "skills" | "equipment" | "spells" | "notes";

export const CharacterSheet = memo(
  ({ characterId, className, onCharacterUpdate }: CharacterSheetProps) => {
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
        alignment: "Lawful Good",
        level: 1,
        experience: 0,
        hitPoints: { current: 10, max: 10, temporary: 0 },
        armorClass: 10,
        speed: 30,
        proficiencyBonus: 2,
        initiative: 0,
        hitDice: { total: 1, current: 1, type: "d10" },
        currency: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
        traits: [],
        personality: {
          traits: [],
          ideals: [],
          bonds: [],
          flaws: [],
        },
        abilities: {
          strength: { name: "Strength", value: 15, modifier: 2 },
          dexterity: { name: "Dexterity", value: 14, modifier: 2 },
          constitution: { name: "Constitution", value: 13, modifier: 1 },
          intelligence: { name: "Intelligence", value: 12, modifier: 1 },
          wisdom: { name: "Wisdom", value: 10, modifier: 0 },
          charisma: { name: "Charisma", value: 8, modifier: -1 },
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
          animalHandling: {
            name: "Animal Handling",
            ability: "wisdom",
            proficient: true,
            value: 2,
            modifier: 0,
          },
          athletics: {
            name: "Athletics",
            ability: "strength",
            proficient: true,
            value: 4,
            modifier: 2,
          },
          intimidation: {
            name: "Intimidation",
            ability: "charisma",
            proficient: false,
            value: -1,
            modifier: -1,
          },
          perception: {
            name: "Perception",
            ability: "wisdom",
            proficient: false,
            value: 0,
            modifier: 0,
          },
        },
        equipment: [],
        features: [],
        notes: "",
        createdAt: new Date(),
        updatedAt: new Date(),
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
        alignment: "Lawful Good",
        level: 3,
        experience: 900,
        hitPoints: { current: 28, max: 28, temporary: 0 },
        armorClass: 16,
        initiative: 2,
        hitDice: { total: 3, current: 2, type: "d10" },
        currency: { cp: 50, sp: 100, ep: 0, gp: 75, pp: 0 },
        traits: ["Darkvision", "Dwarven Resilience"],
        personality: {
          traits: ["Gruff but loyal"],
          ideals: ["Honor above all"],
          bonds: ["My clan and my comrades"],
          flaws: ["Slow to trust outsiders"],
        },
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
          {
            id: "eq3",
            name: "Shield",
            type: "shield",
            quantity: 1,
            weight: 6,
            value: 10,
            description: "A sturdy wooden shield",
            equipped: true,
            properties: ["AC +2", "Disadvantage on Attack Rolls"],
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
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    };

    const updateCharacter = useCallback(
      (updates: Partial<Character>) => {
        if (!character) {
          return;
        }

        const updatedCharacter = {
          ...character,
          ...updates,
          updatedAt: new Date(),
        };

        setCharacter(updatedCharacter);
        setHasUnsavedChanges(true);
        onCharacterUpdate?.(updatedCharacter);
      },
      [character, onCharacterUpdate],
    );

    const saveCharacter = useCallback(async () => {
      if (!character) {
        return;
      }

      try {
        // Send character data to server
        send({
          type: "scene_update" as const,
          payload: { characterUpdate: character },
          sessionId: characterId,
          userId: character.userId,
          timestamp: Date.now(),
        });

        setHasUnsavedChanges(false);
        setIsEditing(false);
      } catch (error) {
        logger.error("Failed to save character:", error);
      }
    }, [character, send]);

    const exportCharacter = useCallback(() => {
      if (!character) {
        return;
      }

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
      if (!character) {
        return null;
      }

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
            <EquipmentPanel
              character={character}
              isEditing={isEditing}
              onUpdate={updateCharacter}
            />
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
        <div className="p-4 border-b border-border-primary sticky top-0 z-20 bg-bg-secondary/80 backdrop-blur supports-[backdrop-filter]:bg-bg-secondary/60">
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

              <Button
                variant="ghost"
                size="sm"
                onClick={exportCharacter}
                leftIcon={<Download className="h-4 w-4" />}
              >
                Export
              </Button>

              {isEditing ? (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={saveCharacter}
                  leftIcon={<Save className="h-4 w-4" />}
                >
                  Save
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsEditing(true)}
                  leftIcon={<Settings className="h-4 w-4" />}
                >
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

        {/* Tab Content - lazy load each panel for lower CPU/GPU usage */}
        <div className="flex-1 overflow-hidden">
          <Suspense
            fallback={
              <div className="p-6">
                <LoadingSpinner size="sm" showLabel label="Loading section..." />
              </div>
            }
          >
            {renderTabContent()}
          </Suspense>
        </div>
      </div>
    );
  },
);

export default CharacterSheet;
