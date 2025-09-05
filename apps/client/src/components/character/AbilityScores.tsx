/**
 * Ability Scores Component - Display and edit character ability scores and modifiers
 */

import React, { memo } from "react";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { cn } from "../../lib/utils";
// Define Character interface locally until core-schemas export is fixed
interface Ability {
  name: string;
  value: number;
  modifier: number;
}

interface Skill {
  name: string;
  ability: string;
  proficient: boolean;
  expertise?: boolean;
  value: number;
  modifier: number;
}

interface SavingThrow {
  proficient: boolean;
  value: number;
}

interface HitPoints {
  current: number;
  max: number;
  temporary: number;
}

interface Character {
  id: string;
  name: string;
  race: string;
  class: string;
  level: number;
  background: string;
  experience: number;
  hitPoints: HitPoints;
  maxHitPoints: number; // Legacy property for backward compatibility
  tempHitPoints: number; // Legacy property for backward compatibility
  armorClass: number;
  proficiencyBonus: number;
  speed: number;
  inspiration: boolean;
  abilities: Record<string, Ability>;
  skills: Record<string, Skill>;
  savingThrows: Record<string, SavingThrow>;
}

interface AbilityScoresProps {
  character: Character;
  isEditing: boolean;
  onUpdate: (_updates: Partial<Character>) => void;
}

const ABILITIES = [
  { key: "strength", label: "Strength", shortLabel: "STR" },
  { key: "dexterity", label: "Dexterity", shortLabel: "DEX" },
  { key: "constitution", label: "Constitution", shortLabel: "CON" },
  { key: "intelligence", label: "Intelligence", shortLabel: "INT" },
  { key: "wisdom", label: "Wisdom", shortLabel: "WIS" },
  { key: "charisma", label: "Charisma", shortLabel: "CHA" },
] as const;

export const AbilityScores: React.FC<AbilityScoresProps> = ({ character, isEditing, onUpdate }) => {
  const getModifier = (score: number): number => {
    return Math.floor((score - 10) / 2);
  };

  const formatModifier = (modifier: number): string => {
    return modifier >= 0 ? `+${modifier}` : `${modifier}`;
  };

  const updateAbilityScore = (ability: keyof Character["abilities"], value: number) => {
    const clampedValue = Math.max(1, Math.min(30, value));
    const modifier = getModifier(clampedValue);
    
    const newAbilities = {
      ...character.abilities,
      [ability]: {
        name: character.abilities[ability]?.name || ability,
        value: clampedValue,
        modifier,
      },
    };

    // Recalculate saving throws
    const newSavingThrows = { ...character.savingThrows };
    const profBonus = character.proficiencyBonus;
    const currentSavingThrow = newSavingThrows[ability];

    if (currentSavingThrow) {
      newSavingThrows[ability] = {
        ...currentSavingThrow,
        value: modifier + (currentSavingThrow.proficient ? profBonus : 0),
      };
    }

    onUpdate({
      abilities: newAbilities,
      savingThrows: newSavingThrows,
    });
  };

  const toggleSavingThrowProficiency = (ability: keyof Character["savingThrows"]) => {
    const currentSavingThrow = character.savingThrows[ability];
    const abilityScore = character.abilities[ability];
    
    if (!currentSavingThrow || !abilityScore) {return;}
    
    const currentProf = currentSavingThrow.proficient;
    const modifier = getModifier(abilityScore.value);
    const profBonus = character.proficiencyBonus;

    const newSavingThrows = {
      ...character.savingThrows,
      [ability]: {
        ...currentSavingThrow,
        proficient: !currentProf,
        value: modifier + (!currentProf ? profBonus : 0),
      },
    };

    onUpdate({ savingThrows: newSavingThrows });
  };

  const toggleSkillProficiency = (skill: keyof Character["skills"]) => {
    const currentSkill = character.skills[skill];
    if (!currentSkill) {return;}
    
    const newSkills = { 
      ...character.skills,
      [skill]: { 
        ...currentSkill, 
        proficient: !currentSkill.proficient 
      }
    };
    onUpdate({ skills: newSkills });
  };

  const updateCharacterField = (_field: keyof Character, _value: any) => {
    onUpdate({ [_field]: _value });
  };

  return (
    <div className="p-4 space-y-6">
      {/* Basic Character Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium text-primary mb-1">Name</label>
          {isEditing ? (
            <Input
              value={character.name}
              onChange={(e) => updateCharacterField("name", e.target.value)}
              placeholder="Character name"
            />
          ) : (
            <div className="p-2 bg-bg-tertiary rounded border text-primary">
              {character.name}
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-primary mb-1">Class</label>
          {isEditing ? (
            <Input
              value={character.class}
              onChange={(e) => updateCharacterField("class", e.target.value)}
              placeholder="Character class"
            />
          ) : (
            <div className="p-2 bg-bg-tertiary rounded border text-primary">
              {character.class}
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-primary mb-1">Race</label>
          {isEditing ? (
            <Input
              value={character.race}
              onChange={(e) => updateCharacterField("race", e.target.value)}
              placeholder="Character race"
            />
          ) : (
            <div className="p-2 bg-bg-tertiary rounded border text-primary">
              {character.race}
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-primary mb-1">Background</label>
          {isEditing ? (
            <Input
              value={character.background}
              onChange={(e) => updateCharacterField("background", e.target.value)}
              placeholder="Character background"
            />
          ) : (
            <div className="p-2 bg-bg-tertiary rounded border text-primary">
              {character.background}
            </div>
          )}
        </div>
      </div>

      {/* Level and Experience */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium text-primary mb-1">Level</label>
          {isEditing ? (
            <Input
              type="number"
              min="1"
              max="20"
              value={character.level}
              onChange={(e) => updateCharacterField("level", parseInt(e.target.value) || 1)}
            />
          ) : (
            <div className="p-2 bg-bg-tertiary rounded border text-primary text-center text-lg font-bold">
              {character.level}
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-primary mb-1">Experience</label>
          {isEditing ? (
            <Input
              type="number"
              min="0"
              value={character.experience}
              onChange={(e) => updateCharacterField("experience", parseInt(e.target.value) || 0)}
            />
          ) : (
            <div className="p-2 bg-bg-tertiary rounded border text-primary">
              {character.experience.toLocaleString()}
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-primary mb-1">
            Proficiency Bonus
          </label>
          <div className="p-2 bg-bg-tertiary rounded border text-primary text-center font-mono">
            {formatModifier(character.proficiencyBonus)}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-primary mb-1">Inspiration</label>
          <button
            onClick={() => updateCharacterField("inspiration", !character.inspiration)}
            disabled={!isEditing}
            className={cn(
              "w-full p-2 rounded border text-center font-medium transition-colors",
              character.inspiration
                ? "bg-accent-primary text-white border-accent-primary"
                : "bg-bg-tertiary text-text-secondary border-border-primary",
              isEditing && "hover:opacity-80 cursor-pointer",
              !isEditing && "cursor-default",
            )}
          >
            {character.inspiration ? "Inspired" : "No Inspiration"}
          </button>
        </div>
      </div>

      {/* Health and Defense */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium text-primary mb-1">Armor Class</label>
          {isEditing ? (
            <Input
              type="number"
              min="1"
              value={character.armorClass}
              onChange={(e) => updateCharacterField("armorClass", parseInt(e.target.value) || 10)}
            />
          ) : (
            <div className="p-2 bg-bg-tertiary rounded border text-primary text-center text-lg font-bold">
              {character.armorClass}
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-primary mb-1">Hit Points</label>
          {isEditing ? (
            <div className="flex gap-1">
              <Input
                type="number"
                min="0"
                value={character.hitPoints.current}
                onChange={(e) => updateCharacterField("hitPoints", { ...character.hitPoints, current: parseInt(e.target.value) || 0 })}
                placeholder="Current"
              />
              <Input
                type="number"
                min="1"
                value={character.hitPoints.max}
                onChange={(e) =>
                  updateCharacterField("hitPoints", { ...character.hitPoints, max: parseInt(e.target.value) || 1 })
                }
                placeholder="Max"
              />
            </div>
          ) : (
            <div className="p-2 bg-bg-tertiary rounded border text-primary text-center">
              <span className="text-lg font-bold">{character.hitPoints.current}</span>
              <span className="text-text-secondary">/{character.hitPoints.max}</span>
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-primary mb-1">Temp HP</label>
          {isEditing ? (
            <Input
              type="number"
              min="0"
              value={character.hitPoints.temporary}
              onChange={(e) => updateCharacterField("hitPoints", { ...character.hitPoints, temporary: parseInt(e.target.value) || 0 })}
            />
          ) : (
            <div className="p-2 bg-bg-tertiary rounded border text-primary text-center">
              {character.hitPoints.temporary}
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-primary mb-1">Speed</label>
          {isEditing ? (
            <Input
              type="number"
              min="0"
              value={character.speed}
              onChange={(e) => updateCharacterField("speed", parseInt(e.target.value) || 30)}
            />
          ) : (
            <div className="p-2 bg-bg-tertiary rounded border text-primary text-center">
              {character.speed} ft
            </div>
          )}
        </div>
      </div>

      {/* Ability Scores */}
      <div>
        <h3 className="text-lg font-semibold text-primary mb-4">Ability Scores</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {ABILITIES.map(({ key, label, shortLabel }) => {
            const ability = character.abilities[key as keyof Character["abilities"]];
            if (!ability) {return null;}
            const score = ability.value;
            const modifier = getModifier(score);

            return (
              <div key={key} className="bg-bg-tertiary rounded-lg border border-border-primary p-3">
                <div className="text-center">
                  <div className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-1">
                    {shortLabel}
                  </div>

                  {isEditing ? (
                    <Input
                      type="number"
                      min="1"
                      max="30"
                      value={score}
                      onChange={(e) =>
                        updateAbilityScore(
                          key as keyof Character["abilities"],
                          parseInt(e.target.value) || 1,
                        )
                      }
                      className="text-center font-bold text-lg mb-2"
                    />
                  ) : (
                    <div className="text-lg font-bold text-primary mb-2">{score}</div>
                  )}

                  <div className="text-sm font-mono text-text-secondary">
                    {formatModifier(modifier)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Saving Throws */}
      <div>
        <h3 className="text-lg font-semibold text-primary mb-4">Saving Throws</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {ABILITIES.map(({ key, shortLabel }) => {
            const savingThrow = character.savingThrows[key as keyof Character["savingThrows"]];
            if (!savingThrow) {return null;}

            return (
              <div key={key} className="flex items-center gap-3 p-2 bg-bg-tertiary rounded border">
                <button
                  onClick={() =>
                    toggleSavingThrowProficiency(key as keyof Character["savingThrows"])
                  }
                  disabled={!isEditing}
                  className={cn(
                    "w-4 h-4 rounded border-2 flex items-center justify-center",
                    savingThrow.proficient
                      ? "bg-accent-primary border-accent-primary"
                      : "border-border-primary",
                    isEditing && "hover:opacity-80 cursor-pointer",
                    !isEditing && "cursor-default",
                  )}
                >
                  {savingThrow.proficient && <div className="w-2 h-2 bg-white rounded-full" />}
                </button>

                <div className="flex-1 flex justify-between items-center">
                  <span className="text-sm text-primary">{shortLabel}</span>
                  <span className="font-mono text-sm text-text-secondary">
                    {formatModifier(savingThrow.value)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default memo(AbilityScores);
