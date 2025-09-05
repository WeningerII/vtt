/**
 * Notes Panel Component - Manage character notes and features
 */

import React, { useState, memo } from "react";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { cn } from "../../lib/utils";
import {
  Plus,
  Trash2,
  Edit3,
  FileText,
  Bookmark,
  User,
  Shield,
  Zap,
  Star,
  Search,
  Save,
  X,
} from "lucide-react";
import type { Character, Feature } from "./CharacterSheet";

interface NotesPanelProps {
  character: Character;
  isEditing: boolean;
  onUpdate: (_updates: Partial<Character>) => void;
}

interface FeatureFormData {
  name: string;
  source: string;
  description: string;
  type: Feature["type"];
  uses?:
    | {
        current: number;
        max: number;
        resetOn: "short" | "long" | "other";
      }
    | undefined;
}

const FEATURE_TYPES = [
  { key: "class", label: "Class Feature", icon: Shield },
  { key: "race", label: "Racial Trait", icon: User },
  { key: "background", label: "Background Feature", icon: Bookmark },
  { key: "feat", label: "Feat", icon: Star },
  { key: "other", label: "Other", icon: Zap },
] as const;

export const NotesPanel = memo(({
  character,
  isEditing,
  onUpdate,
}: NotesPanelProps): JSX.Element => {
  const [activeTab, setActiveTab] = useState<"notes" | "features">("notes");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<Feature["type"] | "all">("all");
  const [showAddFeature, setShowAddFeature] = useState(false);
  const [editingFeature, setEditingFeature] = useState<Feature | null>(null);
  const [featureForm, setFeatureForm] = useState<FeatureFormData>({
    name: "",
    source: "",
    description: "",
    type: "other",
  });

  const updateNotes = (notes: string) => {
    onUpdate({ notes });
  };

  const resetFeatureForm = () => {
    setFeatureForm({
      name: "",
      source: "",
      description: "",
      type: "other",
    });
    setEditingFeature(null);
    setShowAddFeature(false);
  };

  const addOrUpdateFeature = () => {
    if (!featureForm.name.trim()) {return;}

    const newFeature: Feature = {
      id: editingFeature?.id || `feature_${Date.now()}`,
      name: featureForm.name.trim(),
      source: featureForm.source.trim(),
      description: featureForm.description.trim(),
      type: featureForm.type,
      ...(featureForm.uses && { uses: featureForm.uses }),
    };

    let newFeatures;
    if (editingFeature) {
      newFeatures = character.features.map((feature) =>
        feature.id === editingFeature.id ? newFeature : feature,
      );
    } else {
      newFeatures = [...character.features, newFeature];
    }

    onUpdate({ features: newFeatures });
    resetFeatureForm();
  };

  const removeFeature = (id: string) => {
    const newFeatures = character.features.filter((feature) => feature.id !== id);
    onUpdate({ features: newFeatures });
  };

  const startEditFeature = (feature: Feature) => {
    setFeatureForm({
      name: feature.name,
      source: feature.source,
      description: feature.description,
      type: feature.type,
      uses: feature.uses ? { ...feature.uses } : undefined,
    } as FeatureFormData);
    setEditingFeature(feature);
    setShowAddFeature(true);
  };

  const updateFeatureUses = (featureId: string, current: number) => {
    const newFeatures = character.features.map((feature) => {
      if (feature.id === featureId && feature.uses) {
        return {
          ...feature,
          uses: {
            ...feature.uses,
            current: Math.max(0, Math.min(feature.uses.max, current)),
          },
        };
      }
      return feature;
    });
    onUpdate({ features: newFeatures });
  };

  const toggleUsesTracking = () => {
    if (featureForm.uses) {
      setFeatureForm((prev) => ({ ...prev, uses: undefined }));
    } else {
      setFeatureForm((prev) => ({
        ...prev,
        uses: { current: 1, max: 1, resetOn: "short" },
      }));
    }
  };

  const filteredFeatures = character.features.filter((feature) => {
    if (searchTerm && !feature.name.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    if (filterType !== "all" && feature.type !== filterType) {
      return false;
    }
    return true;
  });

  const featuresByType = filteredFeatures.reduce(
    (acc, feature) => {
      if (!acc[feature.type]) {acc[feature.type] = [];}
      acc[feature.type].push(feature);
      return acc;
    },
    {} as Record<Feature["type"], Feature[]>,
  );

  const getFeatureTypeConfig = (type: Feature["type"]) => {
    return FEATURE_TYPES.find((t) => t.key === type) || FEATURE_TYPES[4];
  };

  const getFilteredFeatureTypes = () => {
    const usedTypes = new Set(character.features.map((f) => f.type));
    return FEATURE_TYPES.filter(
      ({ key }) => filterType === "all" || filterType === key || usedTypes.has(key),
    );
  };

  const getTypeIcon = (type: Feature["type"]) => {
    const typeData = FEATURE_TYPES.find((t) => t.key === type);
    return typeData?.icon || Zap;
  };

  const getTypeLabel = (type: Feature["type"]) => {
    const typeData = FEATURE_TYPES.find((t) => t.key === type);
    return typeData?.label || "Other";
  };

  return (
    <div className="p-4 space-y-4">
      {/* Tab Navigation */}
      <div className="flex border-b border-border-primary">
        <button
          onClick={() => setActiveTab("notes")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors border-b-2",
            activeTab === "notes"
              ? "text-accent-primary border-accent-primary"
              : "text-secondary border-transparent hover:text-primary",
          )}
        >
          <FileText className="h-4 w-4" />
          Notes
        </button>
        <button
          onClick={() => setActiveTab("features")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors border-b-2",
            activeTab === "features"
              ? "text-accent-primary border-accent-primary"
              : "text-secondary border-transparent hover:text-primary",
          )}
        >
          <Star className="h-4 w-4" />
          Features ({character.features.length})
        </button>
      </div>

      {/* Notes Tab */}
      {activeTab === "notes" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-primary">Character Notes</h3>
            {!isEditing && character.notes && (
              <span className="text-sm text-secondary">
                {character.notes.length} characters
              </span>
            )}
          </div>

          {isEditing ? (
            <div className="space-y-3">
              <textarea
                value={character.notes}
                onChange={(e) => updateNotes(e.target.value)}
                className="w-full h-96 px-3 py-2 bg-bg-secondary border border-border-primary rounded-md text-primary resize-none focus:ring-2 focus:ring-accent-primary focus:border-transparent"
                placeholder="Write your character notes here... Include backstory, personality traits, goals, secrets, or anything else important about your character."
              />
              <div className="text-xs text-text-tertiary">
                Use this space for character backstory, personality traits, goals, relationships,
                and any other notes.
              </div>
            </div>
          ) : (
            <div className="bg-bg-tertiary rounded-lg border border-border-primary p-4">
              {character.notes ? (
                <div className="whitespace-pre-wrap text-primary leading-relaxed">
                  {character.notes}
                </div>
              ) : (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 text-text-tertiary mx-auto mb-4" />
                  <h4 className="text-lg font-medium text-primary mb-2">No Notes Yet</h4>
                  <p className="text-secondary">
                    Character notes will appear here when added.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Features Tab */}
      {activeTab === "features" && (
        <div className="space-y-4">
          {/* Features Controls */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-text-tertiary" />
              <Input
                placeholder="Search features..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="flex gap-2">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as Feature["type"] | "all")}
                className="px-3 py-2 bg-bg-secondary border border-border-primary rounded-md text-primary text-sm"
              >
                <option value="all">All Types</option>
                {FEATURE_TYPES.map(({ key, label }) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>

              {isEditing && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setShowAddFeature(true)}
                  leftIcon={<Plus className="h-4 w-4" />}
                >
                  Add Feature
                </Button>
              )}
            </div>
          </div>

          {/* Add/Edit Feature Form */}
          {showAddFeature && isEditing && (
            <div className="bg-bg-tertiary rounded-lg border border-border-primary p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-primary">
                  {editingFeature ? "Edit Feature" : "Add Feature"}
                </h3>
                <Button variant="ghost" size="sm" onClick={resetFeatureForm}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-primary mb-1">Name</label>
                  <Input
                    value={featureForm.name}
                    onChange={(e) => setFeatureForm((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="Feature name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-primary mb-1">Source</label>
                  <Input
                    value={featureForm.source}
                    onChange={(e) =>
                      setFeatureForm((prev) => ({ ...prev, source: e.target.value }))
                    }
                    placeholder="e.g., Fighter Class, Human Race"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-primary mb-1">Type</label>
                  <select
                    value={featureForm.type}
                    onChange={(e) =>
                      setFeatureForm((prev) => ({
                        ...prev,
                        type: e.target.value as Feature["type"],
                      }))
                    }
                    className="w-full px-3 py-2 bg-bg-secondary border border-border-primary rounded-md text-primary"
                  >
                    {FEATURE_TYPES.map(({ key, label }) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-primary mb-1">
                  Description
                </label>
                <textarea
                  value={featureForm.description}
                  onChange={(e) =>
                    setFeatureForm((prev) => ({ ...prev, description: e.target.value }))
                  }
                  className="w-full px-3 py-2 bg-bg-secondary border border-border-primary rounded-md text-primary resize-none"
                  rows={4}
                  placeholder="Feature description..."
                />
              </div>

              {/* Uses Tracking */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="checkbox"
                    id="hasUses"
                    checked={!!featureForm.uses}
                    onChange={toggleUsesTracking}
                    className="rounded border-border-primary"
                  />
                  <label htmlFor="hasUses" className="text-sm font-medium text-primary">
                    Track uses per rest
                  </label>
                </div>

                {featureForm.uses && (
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-xs text-secondary mb-1">Current</label>
                      <Input
                        type="number"
                        min="0"
                        value={featureForm.uses.current}
                        onChange={(e) =>
                          setFeatureForm((prev) => ({
                            ...prev,
                            uses: prev.uses
                              ? {
                                  ...prev.uses,
                                  current: parseInt(e.target.value) || 0,
                                }
                              : undefined,
                          }))
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-secondary mb-1">Max</label>
                      <Input
                        type="number"
                        min="1"
                        value={featureForm.uses.max}
                        onChange={(e) =>
                          setFeatureForm((prev) => ({
                            ...prev,
                            uses: prev.uses
                              ? {
                                  ...prev.uses,
                                  max: parseInt(e.target.value) || 1,
                                }
                              : undefined,
                          }))
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-secondary mb-1">Reset On</label>
                      <select
                        value={featureForm.uses.resetOn}
                        onChange={(e) =>
                          setFeatureForm((prev) => ({
                            ...prev,
                            uses: prev.uses
                              ? {
                                  ...prev.uses,
                                  resetOn: e.target.value as "short" | "long" | "other",
                                }
                              : undefined,
                          }))
                        }
                        className="w-full px-2 py-1 bg-bg-secondary border border-border-primary rounded text-sm"
                      >
                        <option value="short">Short Rest</option>
                        <option value="long">Long Rest</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Button variant="primary" onClick={addOrUpdateFeature}>
                  {editingFeature ? "Update" : "Add"} Feature
                </Button>
                <Button variant="ghost" onClick={resetFeatureForm}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Features List */}
          <div className="space-y-2">
            {filteredFeatures.map((feature) => {
              const TypeIcon = getTypeIcon(feature.type);

              return (
                <div
                  key={feature.id}
                  className="bg-bg-tertiary rounded-lg border border-border-primary p-3"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <TypeIcon className="h-5 w-5 text-accent-primary mt-1" />

                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-medium text-primary">{feature.name}</h4>
                          <span className="text-xs bg-primary text-text-tertiary px-2 py-1 rounded">
                            {getTypeLabel(feature.type)}
                          </span>
                          {feature.source && (
                            <span className="text-xs text-secondary">• {feature.source}</span>
                          )}
                        </div>

                        {feature.description && (
                          <p className="text-sm text-secondary mt-1 whitespace-pre-wrap">
                            {feature.description}
                          </p>
                        )}

                        {feature.uses && (
                          <div className="flex items-center gap-2 mt-2">
                            <div className="flex items-center gap-1">
                              {isEditing ? (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      updateFeatureUses(feature.id, feature.uses!.current - 1)
                                    }
                                    disabled={feature.uses.current <= 0}
                                  >
                                    -
                                  </Button>
                                  <span className="mx-2 font-mono">
                                    {feature.uses.current}/{feature.uses.max}
                                  </span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      updateFeatureUses(feature.id, feature.uses!.current + 1)
                                    }
                                    disabled={feature.uses.current >= feature.uses.max}
                                  >
                                    +
                                  </Button>
                                </>
                              ) : (
                                <span className="font-mono text-sm">
                                  {feature.uses.current}/{feature.uses.max} uses
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-text-tertiary">
                              • Resets on {feature.uses.resetOn} rest
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {isEditing && (
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => startEditFeature(feature)}>
                          <Edit3 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFeature(feature.id)}
                          className="text-danger hover:text-danger"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {filteredFeatures.length === 0 && (
            <div className="text-center py-8">
              <Star className="h-12 w-12 text-text-tertiary mx-auto mb-4" />
              <h3 className="text-lg font-medium text-primary mb-2">No Features Found</h3>
              <p className="text-secondary">
                {searchTerm
                  ? `No features match "${searchTerm}"`
                  : isEditing
                    ? "Add character features and abilities"
                    : "This character has no features"}
              </p>
              {isEditing && !searchTerm && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setShowAddFeature(true)}
                  leftIcon={<Plus className="h-4 w-4" />}
                  className="mt-4"
                >
                  Add Feature
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export default NotesPanel;
