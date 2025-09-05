/**
 * Map Layers Panel - Manage map layers, backgrounds, and visibility
 */

import React, { useState, memo } from "react";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { cn } from "../../lib/utils";
import {
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Trash2,
  Plus,
  ChevronUp,
  ChevronDown,
  Image,
  Grid3X3,
  Move,
  Paintbrush,
  Layers,
} from "lucide-react";
import type { MapLayer } from "./BattleMap";

interface MapLayersPanelProps {
  layers: MapLayer[];
  onLayersUpdate: (layers: MapLayer[]) => void;
  onBackgroundUpload: (file: File) => void;
  isGM?: boolean;
  className?: string;
}

const LAYER_TYPES = [
  {
    type: "background",
    label: "Background",
    icon: Image,
    description: "Base map image or terrain",
  },
  {
    type: "overlay",
    label: "Overlay",
    icon: Grid3X3,
    description: "Grid lines, fog, weather effects",
  },
  { type: "tokens", label: "Tokens", icon: Move, description: "Character and creature tokens" },
  {
    type: "effects",
    label: "Effects",
    icon: Paintbrush,
    description: "Spell effects, lighting, etc.",
  },
] as const;

export const MapLayersPanel = memo(({
  layers,
  onLayersUpdate,
  onBackgroundUpload,
  isGM = false,
  className,
}: MapLayersPanelProps): JSX.Element => {
  const [showAddLayer, setShowAddLayer] = useState(false);
  const [newLayerName, setNewLayerName] = useState("");
  const [newLayerType, setNewLayerType] = useState<MapLayer["type"]>("overlay");

  const updateLayer = (layerId: string, updates: Partial<MapLayer>) => {
    const updatedLayers = layers.map((layer) =>
      layer.id === layerId ? { ...layer, ...updates } : layer,
    );
    onLayersUpdate(updatedLayers);
  };

  const deleteLayer = (layerId: string) => {
    if (layers.length <= 1) {return;} // Keep at least one layer
    const updatedLayers = layers.filter((layer) => layer.id !== layerId);
    onLayersUpdate(updatedLayers);
  };

  const moveLayer = (layerId: string, direction: "up" | "down") => {
    const currentIndex = layers.findIndex((layer) => layer.id === layerId);
    if (currentIndex === -1) {return;}

    let newIndex;
    if (direction === "up" && currentIndex > 0) {
      newIndex = currentIndex - 1;
    } else if (direction === "down" && currentIndex < layers.length - 1) {
      newIndex = currentIndex + 1;
    } else {
      return;
    }

    const updatedLayers = [...layers];
    const currentLayer = updatedLayers[currentIndex];
    const targetLayer = updatedLayers[newIndex];
    
    if (currentLayer && targetLayer) {
      updatedLayers[currentIndex] = targetLayer;
      updatedLayers[newIndex] = currentLayer;
      onLayersUpdate(updatedLayers);
    }
  };

  const addLayer = () => {
    if (!newLayerName.trim()) {return;}

    const newLayer: MapLayer = {
      id: `layer_${Date.now()}`,
      name: newLayerName.trim(),
      type: newLayerType,
      visible: true,
      locked: false,
      opacity: 1,
    };

    onLayersUpdate([...layers, newLayer]);
    setNewLayerName("");
    setShowAddLayer(false);
  };

  const getLayerTypeIcon = (type: MapLayer["type"]) => {
    const typeConfig = LAYER_TYPES.find((t) => t.type === type);
    return typeConfig?.icon || Layers;
  };

  return (
    <div className={cn("p-4 space-y-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-primary flex items-center gap-2">
          <Layers className="h-5 w-5" />
          Map Layers
        </h3>
        {isGM && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAddLayer(!showAddLayer)}
            leftIcon={<Plus className="h-4 w-4" />}
          >
            Add Layer
          </Button>
        )}
      </div>

      {/* Add Layer Form */}
      {showAddLayer && isGM && (
        <div className="p-3 bg-bg-secondary rounded-md border border-border-primary space-y-3">
          <Input
            placeholder="Layer name..."
            value={newLayerName}
            onChange={(e) => setNewLayerName(e.target.value)}
          />

          <select
            value={newLayerType}
            onChange={(e) => setNewLayerType(e.target.value as MapLayer["type"])}
            className="w-full px-3 py-2 bg-bg-secondary border border-border-primary rounded-md text-primary"
          >
            {LAYER_TYPES.map(({ type, label }) => (
              <option key={type} value={type}>
                {label}
              </option>
            ))}
          </select>

          <div className="flex gap-2">
            <Button variant="primary" size="sm" onClick={addLayer}>
              Add Layer
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowAddLayer(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Background Upload */}
      {isGM && (
        <div className="p-3 bg-bg-secondary rounded-md border border-border-primary">
          <label className="block text-sm font-medium text-primary mb-2">
            Upload Background
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {onBackgroundUpload(file);}
            }}
            className="w-full text-sm text-text-secondary file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-medium file:bg-accent-primary file:text-white hover:file:bg-accent-secondary"
          />
        </div>
      )}

      {/* Layers List */}
      <div className="space-y-2">
        {layers.length === 0 ? (
          <p className="text-text-secondary text-center py-4">No layers available</p>
        ) : (
          layers.map((layer, index) => {
            const LayerIcon = getLayerTypeIcon(layer.type);

            return (
              <div
                key={layer.id}
                className="flex items-center gap-2 p-2 bg-bg-secondary rounded border border-border-primary"
              >
                <LayerIcon className="h-4 w-4 text-text-secondary" />

                <span className="flex-1 text-sm text-primary">{layer.name}</span>

                <div className="flex items-center gap-1">
                  {/* Visibility Toggle */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => updateLayer(layer.id, { visible: !layer.visible })}
                    aria-label={layer.visible ? "Hide layer" : "Show layer"}
                  >
                    {layer.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  </Button>

                  {/* Lock Toggle */}
                  {isGM && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => updateLayer(layer.id, { locked: !layer.locked })}
                      aria-label={layer.locked ? "Unlock layer" : "Lock layer"}
                    >
                      {layer.locked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                    </Button>
                  )}

                  {/* Move Up/Down */}
                  {isGM && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => moveLayer(layer.id, "up")}
                        disabled={index === 0}
                        aria-label="Move layer up"
                      >
                        <ChevronUp className="h-4 w-4" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => moveLayer(layer.id, "down")}
                        disabled={index === layers.length - 1}
                        aria-label="Move layer down"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </>
                  )}

                  {/* Delete Layer */}
                  {isGM && layers.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteLayer(layer.id)}
                      aria-label="Delete layer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Layer Info */}
      <div className="p-2 border-t border-border-primary bg-bg-tertiary">
        <div className="text-xs text-text-secondary">
          <div className="flex justify-between">
            <span>Visible Layers:</span>
            <span>
              {layers.filter((l) => l.visible).length}/{layers.length}
            </span>
          </div>
          <div className="mt-1 text-xs text-text-tertiary">
            Layers are rendered from top to bottom. Higher layers appear above lower layers.
          </div>
        </div>
      </div>
    </div>
  );
});

export default MapLayersPanel;
