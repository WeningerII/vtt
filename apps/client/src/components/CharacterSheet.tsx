/**
 * Interactive D&D 5e Character Sheet with real-time updates
 */

import React, { useState, useCallback, useMemo, memo } from "react";
import "./CharacterSheet.css";

export interface CharacterData {
  id: string;
  name: string;
  class: string;
  level: number;
  race: string;
  background: string;
  alignment: string;
  experiencePoints: number;

  abilities: {
    strength: number;
    dexterity: number;
    constitution: number;
    intelligence: number;
    wisdom: number;
    charisma: number;
  };

  hitPoints: {
    current: number;
    max: number;
    temporary: number;
  };

  armorClass: number;
  initiative: number;
  speed: number;
  proficiencyBonus: number;

  savingThrows: {
    strength: { proficient: boolean; value: number };
    dexterity: { proficient: boolean; value: number };
    constitution: { proficient: boolean; value: number };
    intelligence: { proficient: boolean; value: number };
    wisdom: { proficient: boolean; value: number };
    charisma: { proficient: boolean; value: number };
  };

  skills: {
    [skillName: string]: { proficient: boolean; expertise: boolean; value: number };
  };

  attacks: Array<{
    id: string;
    name: string;
    attackBonus: number;
    damage: string;
    damageType: string;
  }>;

  spells: {
    spellcastingAbility: "intelligence" | "wisdom" | "charisma";
    spellSaveDC: number;
    spellAttackBonus: number;
    spellSlots: { [level: number]: { max: number; current: number } };
    knownSpells: Array<{
      id: string;
      name: string;
      level: number;
      school: string;
      castingTime: string;
      range: string;
      components: string;
      duration: string;
      description: string;
      prepared: boolean;
    }>;
  };

  equipment: Array<{
    id: string;
    name: string;
    quantity: number;
    weight: number;
    description: string;
  }>;

  features: Array<{
    id: string;
    name: string;
    description: string;
    source: string;
  }>;

  conditions: string[];
}

interface CharacterSheetProps {
  character: CharacterData;
  onUpdate: (_updates: Partial<CharacterData>) => void;
  readOnly?: boolean;
}

export const CharacterSheet: React.FC<CharacterSheetProps> = memo((props) => {
  const { character, onUpdate, readOnly = false } = props;
  const [activeTab, setActiveTab] = useState<"main" | "spells" | "equipment" | "features">("main");
  const [editingField, setEditingField] = useState<string | null>(null);

  const getAbilityModifier = useCallback((score: number): number => {
    return Math.floor((score - 10) / 2);
  }, []);

  const formatModifier = useCallback((modifier: number): string => {
    return modifier >= 0 ? `+${modifier}` : `${modifier}`;
  }, []);

  const updateField = useCallback(
    (field: string, value: any) => {
      if (readOnly) return;

      const updates = { ...character };
      const fieldParts = field.split(".");
      let current: any = updates;

      for (let i = 0; i < fieldParts.length - 1; i++) {
        current = current[fieldParts[i]!];
      }

      current[fieldParts[fieldParts.length - 1]!] = value;
      onUpdate(updates);
    },
    [character, onUpdate, readOnly],
  );

  const InputField = memo(
    ({
      field,
      value,
      type = "text",
      className = "",
    }: {
      field: string;
      value: string | number;
      type?: "text" | "number";
      className?: string;
    }) => {
      const isEditing = editingField === field;

      if (readOnly || !isEditing) {
        return (
          <span
            className={`editable-field ${className}`}
            onClick={() => !readOnly && setEditingField(field)}
          >
            {value}
          </span>
        );
      }

      return (
        <input
          type={type}
          value={value}
          onChange={(e) => {
            const newValue = type === "number" ? parseInt(e.target.value) || 0 : e.target.value;
            updateField(field, newValue);
          }}
          onBlur={() => setEditingField(null)}
          onKeyDown={(e) => {
            if (e.key === "Enter") setEditingField(null);
          }}
          autoFocus
          className={className}
        />
      );
    },
  );

  const AbilityScore = memo(
    ({ ability, label }: { ability: keyof CharacterData["abilities"]; label: string }) => {
      const score = character.abilities[ability];
      const modifier = getAbilityModifier(score);

      return (
        <div className="ability-score">
          <div className="ability-label">{label}</div>
          <div className="ability-value">
            <InputField
              field={`abilities.${ability}`}
              value={score}
              type="number"
              className="ability-score-input"
            />
          </div>
          <div className="ability-modifier">{formatModifier(modifier)}</div>
        </div>
      );
    },
  );

  const SavingThrow = memo(
    ({ ability, label }: { ability: keyof CharacterData["savingThrows"]; label: string }) => {
      const save = character.savingThrows[ability];
      const abilityMod = getAbilityModifier(character.abilities[ability]);
      const profBonus = save.proficient ? character.proficiencyBonus : 0;
      const total = abilityMod + profBonus;

      return (
        <div className="saving-throw">
          <input
            type="checkbox"
            checked={save.proficient}
            onChange={(e) => updateField(`savingThrows.${ability}.proficient`, e.target.checked)}
            disabled={readOnly}
          />
          <span className="save-modifier">{formatModifier(total)}</span>
          <span className="save-label">{label}</span>
        </div>
      );
    },
  );

  const SkillRow = memo(
    ({
      skillName,
      ability,
      label,
    }: {
      skillName: string;
      ability: keyof CharacterData["abilities"];
      label: string;
    }) => {
      const skill = character.skills[skillName] || {
        proficient: false,
        expertise: false,
        value: 0,
      };
      const abilityMod = getAbilityModifier(character.abilities[ability]);
      const profBonus = skill.proficient ? character.proficiencyBonus : 0;
      const expertiseBonus = skill.expertise ? character.proficiencyBonus : 0;
      const total = abilityMod + profBonus + expertiseBonus;

      return (
        <div className="skill">
          <input
            type="checkbox"
            checked={skill.proficient}
            onChange={(e) => updateField(`skills.${skillName}.proficient`, e.target.checked)}
            disabled={readOnly}
          />
          <input
            type="checkbox"
            checked={skill.expertise}
            onChange={(e) => updateField(`skills.${skillName}.expertise`, e.target.checked)}
            disabled={readOnly || !skill.proficient}
            className="expertise-checkbox"
          />
          <span className="skill-modifier">{formatModifier(total)}</span>
          <span className="skill-label">{label}</span>
          <span className="skill-ability">({ability.slice(0, 3)})</span>
        </div>
      );
    },
  );

  const renderMainTab = () => (
    <div className="main-tab">
      <div className="character-header">
        <div className="character-basics">
          <div className="character-name">
            <InputField field="name" value={character.name} className="name-input" />
          </div>
          <div className="character-details">
            <div className="detail-row">
              <span>Class & Level:</span>
              <InputField field="class" value={character.class} />
              <InputField field="level" value={character.level} type="number" />
            </div>
            <div className="detail-row">
              <span>Race:</span>
              <InputField field="race" value={character.race} />
            </div>
            <div className="detail-row">
              <span>Background:</span>
              <InputField field="background" value={character.background} />
            </div>
            <div className="detail-row">
              <span>Alignment:</span>
              <InputField field="alignment" value={character.alignment} />
            </div>
          </div>
        </div>

        <div className="character-stats">
          <div className="stat-block">
            <div className="stat-label">Armor Class</div>
            <div className="stat-value">
              <InputField field="armorClass" value={character.armorClass} type="number" />
            </div>
          </div>
          <div className="stat-block">
            <div className="stat-label">Initiative</div>
            <div className="stat-value">
              {formatModifier(getAbilityModifier(character.abilities.dexterity))}
            </div>
          </div>
          <div className="stat-block">
            <div className="stat-label">Speed</div>
            <div className="stat-value">
              <InputField field="speed" value={character.speed} type="number" />
            </div>
          </div>
          <div className="stat-block">
            <div className="stat-label">Prof. Bonus</div>
            <div className="stat-value">{formatModifier(character.proficiencyBonus)}</div>
          </div>
        </div>
      </div>

      <div className="hit-points">
        <div className="hp-section">
          <div className="hp-label">Hit Point Maximum</div>
          <div className="hp-value">
            <InputField field="hitPoints.max" value={character.hitPoints.max} type="number" />
          </div>
        </div>
        <div className="hp-section">
          <div className="hp-label">Current Hit Points</div>
          <div className="hp-value">
            <InputField
              field="hitPoints.current"
              value={character.hitPoints.current}
              type="number"
            />
          </div>
        </div>
        <div className="hp-section">
          <div className="hp-label">Temporary Hit Points</div>
          <div className="hp-value">
            <InputField
              field="hitPoints.temporary"
              value={character.hitPoints.temporary}
              type="number"
            />
          </div>
        </div>
      </div>

      <div className="abilities-section">
        <h3>Ability Scores</h3>
        <div className="abilities-grid">
          <AbilityScore ability="strength" label="STR" />
          <AbilityScore ability="dexterity" label="DEX" />
          <AbilityScore ability="constitution" label="CON" />
          <AbilityScore ability="intelligence" label="INT" />
          <AbilityScore ability="wisdom" label="WIS" />
          <AbilityScore ability="charisma" label="CHA" />
        </div>
      </div>

      <div className="saves-skills-section">
        <div className="saving-throws">
          <h3>Saving Throws</h3>
          <SavingThrow ability="strength" label="Strength" />
          <SavingThrow ability="dexterity" label="Dexterity" />
          <SavingThrow ability="constitution" label="Constitution" />
          <SavingThrow ability="intelligence" label="Intelligence" />
          <SavingThrow ability="wisdom" label="Wisdom" />
          <SavingThrow ability="charisma" label="Charisma" />
        </div>

        <div className="skills">
          <h3>Skills</h3>
          <SkillRow skillName="acrobatics" ability="dexterity" label="Acrobatics" />
          <SkillRow skillName="animalHandling" ability="wisdom" label="Animal Handling" />
          <SkillRow skillName="arcana" ability="intelligence" label="Arcana" />
          <SkillRow skillName="athletics" ability="strength" label="Athletics" />
          <SkillRow skillName="deception" ability="charisma" label="Deception" />
          <SkillRow skillName="history" ability="intelligence" label="History" />
          <SkillRow skillName="insight" ability="wisdom" label="Insight" />
          <SkillRow skillName="intimidation" ability="charisma" label="Intimidation" />
          <SkillRow skillName="investigation" ability="intelligence" label="Investigation" />
          <SkillRow skillName="medicine" ability="wisdom" label="Medicine" />
          <SkillRow skillName="nature" ability="intelligence" label="Nature" />
          <SkillRow skillName="perception" ability="wisdom" label="Perception" />
          <SkillRow skillName="performance" ability="charisma" label="Performance" />
          <SkillRow skillName="persuasion" ability="charisma" label="Persuasion" />
          <SkillRow skillName="religion" ability="intelligence" label="Religion" />
          <SkillRow skillName="sleightOfHand" ability="dexterity" label="Sleight of Hand" />
          <SkillRow skillName="stealth" ability="dexterity" label="Stealth" />
          <SkillRow skillName="survival" ability="wisdom" label="Survival" />
        </div>
      </div>

      <div className="attacks-section">
        <h3>Attacks & Spellcasting</h3>
        <div className="attacks-list">
          {character.attacks.map((attack, index) => (
            <div key={attack.id} className="attack-row">
              <InputField
                field={`attacks.${index}.name`}
                value={attack.name}
                className="attack-name"
              />
              <span className="attack-bonus">{formatModifier(attack.attackBonus)}</span>
              <InputField
                field={`attacks.${index}.damage`}
                value={attack.damage}
                className="attack-damage"
              />
              <InputField
                field={`attacks.${index}.damageType`}
                value={attack.damageType}
                className="damage-type"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderSpellsTab = () => (
    <div className="spells-tab">
      <div className="spellcasting-info">
        <div className="spell-stats">
          <div className="spell-stat">
            <span>Spellcasting Ability:</span>
            <select
              value={character.spells.spellcastingAbility}
              onChange={(e) => updateField("spells.spellcastingAbility", e.target.value)}
              disabled={readOnly}
            >
              <option value="intelligence">Intelligence</option>
              <option value="wisdom">Wisdom</option>
              <option value="charisma">Charisma</option>
            </select>
          </div>
          <div className="spell-stat">
            <span>Spell Save DC:</span>
            <span>{character.spells.spellSaveDC}</span>
          </div>
          <div className="spell-stat">
            <span>Spell Attack Bonus:</span>
            <span>{formatModifier(character.spells.spellAttackBonus)}</span>
          </div>
        </div>

        <div className="spell-slots">
          <h4>Spell Slots</h4>
          {Object.entries(character.spells.spellSlots).map(([level, slots]) => (
            <div key={level} className="spell-slot-level">
              <span>Level {level}:</span>
              <InputField
                field={`spells.spellSlots.${level}.current`}
                value={slots.current}
                type="number"
                className="slot-current"
              />
              <span>/</span>
              <InputField
                field={`spells.spellSlots.${level}.max`}
                value={slots.max}
                type="number"
                className="slot-max"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="spells-list">
        <h4>Known Spells</h4>
        {character.spells.knownSpells.map((spell, index) => (
          <div key={spell.id} className="spell-item">
            <div className="spell-header">
              <input
                type="checkbox"
                checked={spell.prepared}
                onChange={(e) =>
                  updateField(`spells.knownSpells.${index}.prepared`, e.target.checked)
                }
                disabled={readOnly}
              />
              <span className="spell-name">{spell.name}</span>
              <span className="spell-level">Level {spell.level}</span>
              <span className="spell-school">{spell.school}</span>
            </div>
            <div className="spell-details">
              <div>
                <strong>Casting Time:</strong> {spell.castingTime}
              </div>
              <div>
                <strong>Range:</strong> {spell.range}
              </div>
              <div>
                <strong>Components:</strong> {spell.components}
              </div>
              <div>
                <strong>Duration:</strong> {spell.duration}
              </div>
              <div className="spell-description">{spell.description}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderEquipmentTab = () => (
    <div className="equipment-tab">
      <h3>Equipment</h3>
      <div className="equipment-list">
        {character.equipment.map((item, index) => (
          <div key={item.id} className="equipment-item">
            <InputField field={`equipment.${index}.name`} value={item.name} className="item-name" />
            <InputField
              field={`equipment.${index}.quantity`}
              value={item.quantity}
              type="number"
              className="item-quantity"
            />
            <span className="item-weight">{item.weight} lbs</span>
            <div className="item-description">{item.description}</div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderFeaturesTab = () => (
    <div className="features-tab">
      <h3>Features & Traits</h3>
      <div className="features-list">
        {character.features.map((feature) => (
          <div key={feature.id} className="feature-item">
            <div className="feature-header">
              <span className="feature-name">{feature.name}</span>
              <span className="feature-source">{feature.source}</span>
            </div>
            <div className="feature-description">{feature.description}</div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="character-sheet">
      <div className="sheet-tabs">
        <button
          className={`tab ${activeTab === "main" ? "active" : ""}`}
          onClick={() => setActiveTab("main")}
        >
          Main
        </button>
        <button
          className={`tab ${activeTab === "spells" ? "active" : ""}`}
          onClick={() => setActiveTab("spells")}
        >
          Spells
        </button>
        <button
          className={`tab ${activeTab === "equipment" ? "active" : ""}`}
          onClick={() => setActiveTab("equipment")}
        >
          Equipment
        </button>
        <button
          className={`tab ${activeTab === "features" ? "active" : ""}`}
          onClick={() => setActiveTab("features")}
        >
          Features
        </button>
      </div>

      <div className="sheet-content">
        {activeTab === "main" && renderMainTab()}
        {activeTab === "spells" && renderSpellsTab()}
        {activeTab === "equipment" && renderEquipmentTab()}
        {activeTab === "features" && renderFeaturesTab()}
      </div>

      {character.conditions.length > 0 && (
        <div className="conditions-bar">
          <h4>Conditions:</h4>
          <div className="conditions-list">
            {character.conditions.map((condition, index) => (
              <span key={index} className={`condition condition-${condition}`}>
                {condition}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

export default CharacterSheet;
