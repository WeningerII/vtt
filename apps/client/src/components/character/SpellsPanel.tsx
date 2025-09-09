/**
 * Spells Panel Component - Manage character spells and spell casting
 */

import React, { useState, memo } from "react";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { cn } from "../../lib/utils";
import {
  Plus,
  Trash2,
  Edit3,
  Book,
  Star,
  Search,
  Filter,
  Zap,
  Clock,
  Target,
  Eye,
  EyeOff,
} from "lucide-react";
import type { Character, Spell } from "./CharacterSheet";

interface SpellsPanelProps {
  character: Character;
  isEditing: boolean;
  onUpdate: (_updates: Partial<Character>) => void;
}

interface SpellFormData {
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

const SPELL_SCHOOLS = [
  "Abjuration",
  "Conjuration",
  "Divination",
  "Enchantment",
  "Evocation",
  "Illusion",
  "Necromancy",
  "Transmutation",
];

const SPELL_COMPONENTS = ["V", "S", "M"];

const SPELL_LEVELS = [
  { value: 0, label: "Cantrip" },
  { value: 1, label: "1st Level" },
  { value: 2, label: "2nd Level" },
  { value: 3, label: "3rd Level" },
  { value: 4, label: "4th Level" },
  { value: 5, label: "5th Level" },
  { value: 6, label: "6th Level" },
  { value: 7, label: "7th Level" },
  { value: 8, label: "8th Level" },
  { value: 9, label: "9th Level" },
];

export const SpellsPanel = memo(({
  character,
  isEditing,
  onUpdate,
}: SpellsPanelProps): JSX.Element => {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterLevel, setFilterLevel] = useState<number | "all">("all");
  const [filterSchool, setFilterSchool] = useState<string | "all">("all");
  const [showPreparedOnly, setShowPreparedOnly] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingSpell, setEditingSpell] = useState<Spell | null>(null);
  const [formData, setFormData] = useState<SpellFormData>({
    name: "",
    level: 0,
    school: "Evocation",
    castingTime: "1 action",
    range: "60 feet",
    components: ["V", "S"],
    duration: "Instantaneous",
    description: "",
    prepared: false,
    known: true,
  });

  const resetForm = () => {
    setFormData({
      name: "",
      level: 0,
      school: "Evocation",
      castingTime: "1 action",
      range: "60 feet",
      components: ["V", "S"],
      duration: "Instantaneous",
      description: "",
      prepared: false,
      known: true,
    });
    setEditingSpell(null);
    setShowAddForm(false);
  };

  const addOrUpdateSpell = () => {
    if (!formData.name.trim()) {return;}

    const newSpell: Spell = {
      id: editingSpell?.id || `spell_${Date.now()}`,
      name: formData.name.trim(),
      level: formData.level,
      school: formData.school,
      castingTime: formData.castingTime,
      range: formData.range,
      components: [...formData.components],
      duration: formData.duration,
      description: formData.description.trim(),
      prepared: formData.prepared,
      known: formData.known,
    };

    const currentSpells = character.spellcasting?.spells || [];
    let newSpells;
    if (editingSpell) {
      newSpells = currentSpells.map((spell) =>
        spell.id === editingSpell.id ? newSpell : spell,
      );
    } else {
      newSpells = [...currentSpells, newSpell];
    }

    onUpdate({ 
      spellcasting: {
        ...character.spellcasting,
        spells: newSpells,
        ability: character.spellcasting?.ability || 'INT',
        spellAttackBonus: character.spellcasting?.spellAttackBonus || 0,
        spellSaveDC: character.spellcasting?.spellSaveDC || 8,
        spellSlots: character.spellcasting?.spellSlots || {},
        cantripsKnown: character.spellcasting?.cantripsKnown || 0,
        spellsKnown: character.spellcasting?.spellsKnown || 0
      } 
    });
    resetForm();
  };

  const removeSpell = (id: string) => {
    const spells = character.spellcasting?.spells || [];
    const newSpells = spells.filter((spell) => spell.id !== id);
    onUpdate({ 
      spellcasting: {
        ...character.spellcasting,
        spells: newSpells,
        ability: character.spellcasting?.ability || 'INT',
        spellAttackBonus: character.spellcasting?.spellAttackBonus || 0,
        spellSaveDC: character.spellcasting?.spellSaveDC || 8,
        spellSlots: character.spellcasting?.spellSlots || {},
        cantripsKnown: character.spellcasting?.cantripsKnown || 0,
        spellsKnown: character.spellcasting?.spellsKnown || 0
      } 
    });
  };

  const toggleSpellPrepared = (id: string) => {
    const currentSpells = character.spellcasting?.spells || [];
    const newSpells = currentSpells.map((spell) =>
      spell.id === id ? { ...spell, prepared: !spell.prepared } : spell,
    );
    onUpdate({ 
      spellcasting: {
        ...character.spellcasting,
        spells: newSpells,
        ability: character.spellcasting?.ability || 'INT',
        spellAttackBonus: character.spellcasting?.spellAttackBonus || 0,
        spellSaveDC: character.spellcasting?.spellSaveDC || 8,
        spellSlots: character.spellcasting?.spellSlots || {},
        cantripsKnown: character.spellcasting?.cantripsKnown || 0,
        spellsKnown: character.spellcasting?.spellsKnown || 0
      } 
    });
  };

  const toggleSpellKnown = (id: string) => {
    const currentSpells = character.spellcasting?.spells || [];
    const newSpells = currentSpells.map((spell) =>
      spell.id === id ? { ...spell, known: !spell.known } : spell,
    );

    onUpdate({ 
      spellcasting: {
        ...character.spellcasting,
        spells: newSpells,
        ability: character.spellcasting?.ability || 'INT',
        spellAttackBonus: character.spellcasting?.spellAttackBonus || 0,
        spellSaveDC: character.spellcasting?.spellSaveDC || 8,
        spellSlots: character.spellcasting?.spellSlots || {},
        cantripsKnown: character.spellcasting?.cantripsKnown || 0,
        spellsKnown: character.spellcasting?.spellsKnown || 0
      } 
    });
  };

  const startEdit = (spell: Spell) => {
    setFormData({
      name: spell.name,
      level: spell.level,
      school: spell.school,
      castingTime: spell.castingTime,
      range: spell.range,
      components: [...spell.components],
      duration: spell.duration,
      description: spell.description,
      prepared: spell.prepared,
      known: spell.known,
    });
    setEditingSpell(spell);
    setShowAddForm(true);
  };

  const toggleComponent = (component: string) => {
    setFormData((prev) => ({
      ...prev,
      components: prev.components.includes(component)
        ? prev.components.filter((c) => c !== component)
        : [...prev.components, component],
    }));
  };

  const spells = character.spellcasting?.spells || [];
  const maxSpellLevel = character.level ? Math.ceil(character.level / 2) : 9; // Calculate max spell level based on character level

  const filteredSpells = spells.filter((spell) => {
    if (searchTerm && !spell.name.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    if (filterLevel !== "all" && spell.level !== filterLevel) {
      return false;
    }
    if (filterSchool !== "all" && spell.school !== filterSchool) {
      return false;
    }
    if (showPreparedOnly && !spell.prepared) {
      return false;
    }
    return true;
  });

  const spellsByLevel = spells.reduce(
    (acc, spell) => {
      if (!acc[spell.level]) acc[spell.level] = [];
      acc[spell.level]!.push(spell);
      return acc;
    },
    {} as Record<number, Spell[]>,
  );

  const preparedSpells = spells.filter((spell) => spell.prepared);
  const knownSpells = spells.filter((spell) => spell.known);

  const _getSpellLevelLabel = (level: number): string => {
    return level === 0 ? "Cantrip" : `Level ${level}`;
  };

  return (
    <div className="p-4 space-y-4">
      {/* Spells Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-bg-tertiary rounded-lg border border-border-primary p-3 text-center">
          <Book className="h-6 w-6 text-accent-primary mx-auto mb-1" />
          <div className="text-lg font-bold text-primary">{knownSpells.length}</div>
          <div className="text-xs text-text-secondary">Known Spells</div>
        </div>

        <div className="bg-bg-tertiary rounded-lg border border-border-primary p-3 text-center">
          <Star className="h-6 w-6 text-warning mx-auto mb-1" />
          <div className="text-lg font-bold text-primary">{preparedSpells.length}</div>
          <div className="text-xs text-text-secondary">Prepared</div>
        </div>

        <div className="bg-bg-tertiary rounded-lg border border-border-primary p-3 text-center">
          <Zap className="h-6 w-6 text-text-tertiary mx-auto mb-1" />
          <div className="text-lg font-bold text-primary">
            {preparedSpells.length}
          </div>
          <div className="text-xs text-text-secondary">Cantrips</div>
        </div>

        <div className="bg-bg-tertiary rounded-lg border border-border-primary p-3 text-center">
          <Filter className="h-6 w-6 text-text-tertiary mx-auto mb-1" />
          <div className="text-lg font-bold text-primary">
            {new Set(spells.map((s) => s.school)).size}
          </div>
          <div className="text-xs text-text-secondary">Schools</div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-text-tertiary" />
          <Input
            placeholder="Search spells..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex gap-2">
          <select
            value={filterLevel}
            onChange={(e) =>
              setFilterLevel(e.target.value === "all" ? "all" : parseInt(e.target.value))
            }
            className="px-3 py-2 bg-bg-secondary border border-border-primary rounded-md text-primary text-sm"
          >
            <option value="all">All Levels</option>
            {SPELL_LEVELS.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>

          <select
            value={filterSchool}
            onChange={(e) => setFilterSchool(e.target.value)}
            className="px-3 py-2 bg-bg-secondary border border-border-primary rounded-md text-primary text-sm"
          >
            <option value="all">All Schools</option>
            {SPELL_SCHOOLS.map((school) => (
              <option key={school} value={school}>
                {school}
              </option>
            ))}
          </select>

          <Button
            variant={showPreparedOnly ? "primary" : "ghost"}
            size="sm"
            onClick={() => setShowPreparedOnly(!showPreparedOnly)}
            leftIcon={<Star className="h-4 w-4" />}
          >
            Prepared
          </Button>

          {isEditing && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowAddForm(true)}
              leftIcon={<Plus className="h-4 w-4" />}
            >
              Add Spell
            </Button>
          )}
        </div>
      </div>

      {/* Add/Edit Form */}
      {showAddForm && isEditing && (
        <div className="bg-bg-tertiary rounded-lg border border-border-primary p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-primary">
              {editingSpell ? "Edit Spell" : "Add Spell"}
            </h3>
            <Button variant="ghost" size="sm" onClick={resetForm}>
              Cancel
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-primary mb-1">Name</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Spell name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-primary mb-1">Level</label>
              <select
                value={formData.level}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, level: parseInt(e.target.value) }))
                }
                className="w-full px-3 py-2 bg-bg-secondary border border-border-primary rounded-md text-primary"
              >
                {SPELL_LEVELS.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-primary mb-1">School</label>
              <select
                value={formData.school}
                onChange={(e) => setFormData((prev) => ({ ...prev, school: e.target.value }))}
                className="w-full px-3 py-2 bg-bg-secondary border border-border-primary rounded-md text-primary"
              >
                {SPELL_SCHOOLS.map((school) => (
                  <option key={school} value={school}>
                    {school}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-primary mb-1">
                Casting Time
              </label>
              <Input
                value={formData.castingTime}
                onChange={(e) => setFormData((prev) => ({ ...prev, castingTime: e.target.value }))}
                placeholder="1 action"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-primary mb-1">Range</label>
              <Input
                value={formData.range}
                onChange={(e) => setFormData((prev) => ({ ...prev, range: e.target.value }))}
                placeholder="60 feet"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-primary mb-1">Duration</label>
              <Input
                value={formData.duration}
                onChange={(e) => setFormData((prev) => ({ ...prev, duration: e.target.value }))}
                placeholder="Instantaneous"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-primary mb-2">Components</label>
            <div className="flex gap-2">
              {SPELL_COMPONENTS.map((component) => (
                <button
                  key={component}
                  onClick={() => toggleComponent(component)}
                  className={cn(
                    "px-3 py-2 rounded border text-sm font-medium transition-colors",
                    formData.components.includes(component)
                      ? "bg-accent-primary text-white border-accent-primary"
                      : "bg-bg-secondary text-primary border-border-primary hover:border-accent-primary",
                  )}
                >
                  {component}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-primary mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              className="w-full px-3 py-2 bg-bg-secondary border border-border-primary rounded-md text-primary resize-none"
              rows={4}
              placeholder="Spell description..."
            />
          </div>

          <div className="flex gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.known}
                onChange={(e) => setFormData((prev) => ({ ...prev, known: e.target.checked }))}
                className="rounded border-border-primary"
              />
              <span className="text-sm text-primary">Known</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.prepared}
                onChange={(e) => setFormData((prev) => ({ ...prev, prepared: e.target.checked }))}
                className="rounded border-border-primary"
              />
              <span className="text-sm text-primary">Prepared</span>
            </label>
          </div>

          <div className="flex gap-2">
            <Button variant="primary" onClick={addOrUpdateSpell}>
              {editingSpell ? "Update" : "Add"} Spell
            </Button>
            <Button variant="ghost" onClick={resetForm}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Spells List by Level */}
      <div className="space-y-4">
        {SPELL_LEVELS.map(({ value: level, label }) => {
          const levelSpells = spellsByLevel[level] || [];
          if (level > maxSpellLevel) {
            return null;
          }
          if (levelSpells.length === 0) {return null;}

          return (
            <div key={level} className="space-y-2">
              <h3 className="text-lg font-semibold text-primary border-b border-border-primary pb-2">
                {label} ({levelSpells.length})
              </h3>

              <div className="space-y-2">
                {levelSpells.map((spell) => (
                  <div
                    key={spell.id}
                    className={cn(
                      "bg-bg-tertiary rounded-lg border border-border-primary p-3 transition-colors",
                      spell.prepared && "bg-accent-light border-accent-primary",
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        <div className="flex flex-col items-center gap-1">
                          <Book className="h-5 w-5 text-accent-primary" />
                          {isEditing && (
                            <div className="flex gap-1">
                              <button
                                onClick={() => toggleSpellKnown(spell.id)}
                                className={cn(
                                  "w-4 h-4 transition-colors",
                                  spell.known ? "text-accent-primary" : "text-text-tertiary",
                                )}
                                title={spell.known ? "Known" : "Unknown"}
                              >
                                {spell.known ? (
                                  <Eye className="h-4 w-4" />
                                ) : (
                                  <EyeOff className="h-4 w-4" />
                                )}
                              </button>
                              <button
                                onClick={() => toggleSpellPrepared(spell.id)}
                                className={cn(
                                  "w-4 h-4 transition-colors",
                                  spell.prepared ? "text-warning" : "text-text-tertiary",
                                )}
                                title={spell.prepared ? "Prepared" : "Not Prepared"}
                              >
                                <Star className={cn("h-4 w-4", spell.prepared && "fill-current")} />
                              </button>
                            </div>
                          )}
                        </div>

                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-medium text-primary">{spell.name}</h4>
                            {spell.prepared && (
                              <span className="text-xs bg-accent-primary text-white px-2 py-1 rounded">
                                Prepared
                              </span>
                            )}
                            {!spell.known && (
                              <span className="text-xs bg-text-tertiary text-white px-2 py-1 rounded">
                                Unknown
                              </span>
                            )}
                            <span className="text-xs bg-primary text-text-tertiary px-2 py-1 rounded">
                              {spell.school}
                            </span>
                          </div>

                          <div className="flex items-center gap-4 mt-1 text-sm text-text-secondary">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {spell.castingTime}
                            </span>
                            <span className="flex items-center gap-1">
                              <Target className="h-3 w-3" />
                              {spell.range}
                            </span>
                            <span>{spell.components.join(", ")}</span>
                            <span>{spell.duration}</span>
                          </div>

                          {spell.description && (
                            <p className="text-sm text-text-secondary mt-2">{spell.description}</p>
                          )}
                        </div>
                      </div>

                      {isEditing && (
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => startEdit(spell)}>
                            <Edit3 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeSpell(spell.id)}
                            className="text-danger hover:text-danger"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {spells.length === 0 && (
        <div className="text-center py-8">
          <Book className="h-12 w-12 text-text-tertiary mx-auto mb-4" />
          <h3 className="text-lg font-medium text-primary mb-2">No Spells Found</h3>
          <p className="text-text-secondary">
            {searchTerm
              ? `No spells match "${searchTerm}"`
              : showPreparedOnly
                ? "No prepared spells found"
                : isEditing
                  ? "Add some spells to get started"
                  : "This character has no spells"}
          </p>
          {isEditing && !searchTerm && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowAddForm(true)}
              leftIcon={<Plus className="h-4 w-4" />}
              className="mt-4"
            >
              Add Spell
            </Button>
          )}
        </div>
      )}
    </div>
  );
});

export default SpellsPanel;
