/**
 * Skills Panel Component - Display and manage character skills and proficiencies
 */

import React, { useState, memo } from "react";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { cn } from "../../lib/utils";
import { Search, Star, Circle } from "lucide-react";
import type { Character } from "./CharacterSheet";

interface SkillsPanelProps {
  character: Character;
  isEditing: boolean;
  onUpdate: (_updates: Partial<Character>) => void;
}

// D&D 5e Skills with their associated ability scores
const SKILLS_DATA = {
  Acrobatics: { ability: "dexterity", description: "Stay on your feet in difficult situations" },
  "Animal Handling": { ability: "wisdom", description: "Calm down a domesticated animal" },
  Arcana: {
    ability: "intelligence",
    description: "Recall lore about spells, magic items, symbols",
  },
  Athletics: {
    ability: "strength",
    description: "Climb, jump, or swim in difficult circumstances",
  },
  Deception: { ability: "charisma", description: "Hide the truth convincingly" },
  History: { ability: "intelligence", description: "Recall lore about historical events" },
  Insight: { ability: "wisdom", description: "Determine true intentions of a creature" },
  Intimidation: { ability: "charisma", description: "Influence someone through threats" },
  Investigation: {
    ability: "intelligence",
    description: "Look around for clues and make deductions",
  },
  Medicine: { ability: "wisdom", description: "Stabilize dying companion or diagnose illness" },
  Nature: { ability: "intelligence", description: "Recall lore about terrain, plants, animals" },
  Perception: { ability: "wisdom", description: "Notice something with one of your senses" },
  Performance: {
    ability: "charisma",
    description: "Delight an audience with music, dance, or acting",
  },
  Persuasion: { ability: "charisma", description: "Influence someone in good faith" },
  Religion: { ability: "intelligence", description: "Recall lore about deities, rites, prayers" },
  "Sleight of Hand": { ability: "dexterity", description: "Pick a pocket or perform a trick" },
  Stealth: { ability: "dexterity", description: "Conceal yourself from enemies" },
  Survival: { ability: "wisdom", description: "Follow tracks, hunt, guide others, avoid hazards" },
} as const;

export const SkillsPanel = memo(({
  character,
  isEditing,
  onUpdate,
}: SkillsPanelProps): JSX.Element => {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterBy, setFilterBy] = useState<"all" | "proficient" | "expertise">("all");

  const getModifier = (score: number): number => {
    return Math.floor((score - 10) / 2);
  };

  const formatModifier = (modifier: number): string => {
    return modifier >= 0 ? `+${modifier}` : `${modifier}`;
  };

  const getSkillModifier = (skillName: string): number => {
    const skillData = SKILLS_DATA[skillName as keyof typeof SKILLS_DATA];
    if (!skillData) {return 0;}

    const abilityScore = character.abilities[skillData.ability as keyof Character["abilities"]];
    const baseModifier = getModifier(abilityScore);
    const skill = character.skills[skillName];

    if (!skill) {return baseModifier;}

    let modifier = baseModifier;
    if (skill.proficient) {
      modifier += character.proficiencyBonus;
    }
    if (skill.expertise) {
      modifier += character.proficiencyBonus; // Expertise doubles proficiency bonus
    }

    return modifier;
  };

  const toggleSkillProficiency = (skillName: string) => {
    const currentSkill = character.skills[skillName] || {
      proficient: false,
      expertise: false,
      value: 0,
    };
    const newSkills = {
      ...character.skills,
      [skillName]: {
        ...currentSkill,
        proficient: !currentSkill.proficient,
        expertise: currentSkill.proficient ? false : currentSkill.expertise, // Remove expertise if removing proficiency
        value: getSkillModifier(skillName),
      },
    };

    onUpdate({ skills: newSkills });
  };

  const toggleSkillExpertise = (skillName: string) => {
    const currentSkill = character.skills[skillName] || {
      proficient: false,
      expertise: false,
      value: 0,
    };
    if (!currentSkill.proficient) {return;} // Can't have expertise without proficiency

    const newSkills = {
      ...character.skills,
      [skillName]: {
        ...currentSkill,
        expertise: !currentSkill.expertise,
        value: getSkillModifier(skillName),
      },
    };

    onUpdate({ skills: newSkills });
  };

  const filteredSkills = Object.entries(SKILLS_DATA).filter(([skillName]) => {
    const skill = character.skills[skillName];

    // Filter by search term
    if (searchTerm && !skillName.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }

    // Filter by proficiency status
    if (filterBy === "proficient" && (!skill || !skill.proficient)) {
      return false;
    }
    if (filterBy === "expertise" && (!skill || !skill.expertise)) {
      return false;
    }

    return true;
  });

  const getAbilityShortName = (ability: string): string => {
    const map: Record<string, string> = {
      strength: "STR",
      dexterity: "DEX",
      constitution: "CON",
      intelligence: "INT",
      wisdom: "WIS",
      charisma: "CHA",
    };
    return map[ability] || ability.toUpperCase();
  };

  return (
    <div className="p-4 space-y-4">
      {/* Search and Filter Controls */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-text-tertiary" />
          <Input
            placeholder="Search skills..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex gap-2">
          {[
            { key: "all", label: "All Skills" },
            { key: "proficient", label: "Proficient" },
            { key: "expertise", label: "Expertise" },
          ].map(({ key, label }) => (
            <Button
              key={key}
              variant={filterBy === key ? "primary" : "ghost"}
              size="sm"
              onClick={() => setFilterBy(key as any)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      {/* Skills Legend */}
      <div className="bg-bg-tertiary rounded-lg p-3 border border-border-primary">
        <div className="flex items-center gap-4 text-sm text-text-secondary">
          <div className="flex items-center gap-2">
            <Circle className="h-4 w-4" />
            <span>Not Proficient</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-accent-primary" />
            <span>Proficient</span>
          </div>
          <div className="flex items-center gap-2">
            <Star className="h-4 w-4 fill-current text-warning" />
            <span>Expertise</span>
          </div>
        </div>
      </div>

      {/* Skills List */}
      <div className="space-y-2">
        {filteredSkills.map(([skillName, skillData]) => {
          const skill = character.skills[skillName] || {
            proficient: false,
            expertise: false,
            value: 0,
          };
          const modifier = getSkillModifier(skillName);
          const abilityName = getAbilityShortName(skillData.ability);

          return (
            <div
              key={skillName}
              className="bg-bg-tertiary rounded-lg border border-border-primary p-3 hover:bg-bg-secondary transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  {/* Proficiency/Expertise Indicators */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => toggleSkillProficiency(skillName)}
                      disabled={!isEditing}
                      className={cn(
                        "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors",
                        skill.proficient
                          ? "bg-accent-primary border-accent-primary"
                          : "border-border-primary hover:border-accent-primary",
                        isEditing && "cursor-pointer",
                        !isEditing && "cursor-default",
                      )}
                    >
                      {skill.proficient && <div className="w-2 h-2 bg-white rounded-full" />}
                    </button>

                    <button
                      onClick={() => toggleSkillExpertise(skillName)}
                      disabled={!isEditing || !skill.proficient}
                      className={cn(
                        "w-5 h-5 transition-colors",
                        skill.expertise ? "text-warning" : "text-text-tertiary hover:text-warning",
                        (!isEditing || !skill.proficient) && "cursor-default opacity-50",
                        isEditing && skill.proficient && "cursor-pointer",
                      )}
                    >
                      <Star className={cn("h-4 w-4", skill.expertise && "fill-current")} />
                    </button>
                  </div>

                  {/* Skill Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-primary">{skillName}</h4>
                      <span className="text-xs text-text-tertiary bg-bg-primary px-2 py-1 rounded">
                        {abilityName}
                      </span>
                    </div>
                    <p className="text-xs text-text-secondary mt-1">{skillData.description}</p>
                  </div>

                  {/* Modifier */}
                  <div className="text-right">
                    <div className="font-mono text-lg font-bold text-primary">
                      {formatModifier(modifier)}
                    </div>
                    {skill.proficient && (
                      <div className="text-xs text-accent-primary">
                        {skill.expertise ? "Expertise" : "Proficient"}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredSkills.length === 0 && (
        <div className="text-center py-8">
          <Circle className="h-12 w-12 text-text-tertiary mx-auto mb-4" />
          <h3 className="text-lg font-medium text-primary mb-2">No Skills Found</h3>
          <p className="text-text-secondary">
            {searchTerm
              ? `No skills match "${searchTerm}"`
              : filterBy === "proficient"
                ? "No proficient skills found"
                : "No skills with expertise found"}
          </p>
        </div>
      )}

      {/* Skills Summary */}
      <div className="bg-bg-tertiary rounded-lg border border-border-primary p-4 mt-6">
        <h4 className="font-medium text-primary mb-3">Skills Summary</h4>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-primary">
              {Object.values(character.skills).filter((skill) => skill.proficient).length}
            </div>
            <div className="text-sm text-text-secondary">Proficient</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-warning">
              {Object.values(character.skills).filter((skill) => skill.expertise).length}
            </div>
            <div className="text-sm text-text-secondary">Expertise</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-primary">
              {Object.keys(SKILLS_DATA).length}
            </div>
            <div className="text-sm text-text-secondary">Total Skills</div>
          </div>
        </div>
      </div>
    </div>
  );
});

export default SkillsPanel;
