/**
 * Scene Settings Modal - Configure grid, lighting, and fog settings
 */
import React, { useState, useEffect } from "react";
import { logger } from "@vtt/logging";
import {
  Settings,
  X,
  Grid3X3,
  Sun,
  Eye,
  EyeOff,
  Palette,
  Ruler,
  RotateCcw,
  Save,
  Loader2,
} from "lucide-react";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/Card";
import { Switch } from "../ui/Switch";
import { Slider } from "../ui/Slider";
import { cn } from "../../lib/utils";

interface SceneSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  sceneId: string;
  initialSettings?: Partial<SceneSettings>;
  onSettingsUpdate: (settings: SceneSettings) => void;
}

interface GridSettings {
  enabled: boolean;
  size: number;
  color: string;
  opacity: number;
  type: "square" | "hex";
  snapToGrid: boolean;
  showLabels: boolean;
  offsetX: number;
  offsetY: number;
}

interface LightingSettings {
  enabled: boolean;
  ambientLight: number;
  globalIllumination: boolean;
  shadowQuality: "low" | "medium" | "high";
  colorTemperature: number;
  contrast: number;
}

interface FogSettings {
  enabled: boolean;
  type: "static" | "dynamic";
  color: string;
  opacity: number;
  revealOnMove: boolean;
  persistReveal: boolean;
  blurRadius: number;
}

interface SceneSettings {
  grid: GridSettings;
  lighting: LightingSettings;
  fog: FogSettings;
}

const DEFAULT_SETTINGS: SceneSettings = {
  grid: {
    enabled: true,
    size: 70,
    color: "#000000",
    opacity: 0.3,
    type: "square",
    snapToGrid: true,
    showLabels: false,
    offsetX: 0,
    offsetY: 0,
  },
  lighting: {
    enabled: false,
    ambientLight: 0.3,
    globalIllumination: true,
    shadowQuality: "medium",
    colorTemperature: 5500,
    contrast: 1.0,
  },
  fog: {
    enabled: false,
    type: "static",
    color: "#000000",
    opacity: 0.8,
    revealOnMove: true,
    persistReveal: true,
    blurRadius: 3,
  },
};

export const SceneSettingsModal: React.FC<SceneSettingsModalProps> = ({
  isOpen,
  onClose,
  sceneId,
  initialSettings,
  onSettingsUpdate,
}) => {
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  
  const [settings, setSettings] = useState<SceneSettings>(() => ({
    ...DEFAULT_SETTINGS,
    ...initialSettings,
  }));

  const updateGridSettings = (updates: Partial<GridSettings>) => {
    setHasChanges(true);
    setSettings((prev) => ({
      ...prev,
      grid: { ...prev.grid, ...updates },
    }));
  };

  const updateLightingSettings = (updates: Partial<LightingSettings>) => {
    setHasChanges(true);
    setSettings((prev) => ({
      ...prev,
      lighting: { ...prev.lighting, ...updates },
    }));
  };

  const updateFogSettings = (updates: Partial<FogSettings>) => {
    setHasChanges(true);
    setSettings((prev) => ({
      ...prev,
      fog: { ...prev.fog, ...updates },
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      logger.info(`Saving scene settings for scene ${sceneId}`);
      await onSettingsUpdate(settings);
      setHasChanges(false);
      onClose();
    } catch (error) {
      logger.error("Failed to save scene settings:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    onClose();
  };

  const handleReset = () => {
    setHasChanges(false);
    setSettings({
      ...DEFAULT_SETTINGS,
      ...initialSettings,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle className="text-xl font-semibold flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Scene Settings
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>

        <CardContent>
            <div className="w-full">
              <div className="grid w-full grid-cols-3 mb-6">
                <Button variant="ghost" className="flex items-center gap-2">
                  <Grid3X3 className="h-4 w-4" />
                  Grid
                </Button>
                <Button variant="ghost" className="flex items-center gap-2">
                  <Sun className="h-4 w-4" />
                  Lighting
                </Button>
                <Button variant="ghost" className="flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  Fog of War
                </Button>
              </div>

              <div className="mt-6">
                {/* Grid Settings */}
                <div className="space-y-6 mt-0">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium">Grid Configuration</h3>
                    <Switch
                      checked={settings.grid.enabled}
                      onCheckedChange={(enabled) => updateGridSettings({ enabled })}
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-2">
                        Grid Size (pixels)
                      </label>
                      <Input
                        type="number"
                        value={settings.grid.size}
                        onChange={(e) =>
                          updateGridSettings({ size: parseInt(e.target.value) || 70 })
                        }
                        min="20"
                        max="200"
                        disabled={!settings.grid.enabled}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-2">
                        Grid Type
                      </label>
                      <select
                        value={settings.grid.type}
                        onChange={(e) =>
                          updateGridSettings({ type: e.target.value as "square" | "hex" })
                        }
                        className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        disabled={!settings.grid.enabled}
                      >
                        <option value="square">Square</option>
                        <option value="hex">Hexagonal</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-2">
                        Grid Color
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={settings.grid.color}
                          onChange={(e) => updateGridSettings({ color: e.target.value })}
                          className="w-12 h-10 rounded border border-neutral-300"
                          disabled={!settings.grid.enabled}
                        />
                        <Input
                          value={settings.grid.color}
                          onChange={(e) => updateGridSettings({ color: e.target.value })}
                          placeholder="#000000"
                          disabled={!settings.grid.enabled}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-2">
                        Opacity: {Math.round(settings.grid.opacity * 100)}%
                      </label>
                      <Slider
                        value={[settings.grid.opacity]}
                        onValueChange={([opacity]) => opacity !== undefined && updateGridSettings({ opacity })}
                        min={0}
                        max={1}
                        step={0.1}
                        disabled={!settings.grid.enabled}
                      />
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-neutral-700">Snap to Grid</span>
                        <Switch
                          checked={settings.grid.snapToGrid}
                          onCheckedChange={(snapToGrid) => updateGridSettings({ snapToGrid })}
                          disabled={!settings.grid.enabled}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-neutral-700">Show Labels</span>
                        <Switch
                          checked={settings.grid.showLabels}
                          onCheckedChange={(showLabels) => updateGridSettings({ showLabels })}
                          disabled={!settings.grid.enabled}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-1">
                          X Offset
                        </label>
                        <Input
                          type="number"
                          value={settings.grid.offsetX}
                          onChange={(e) =>
                            updateGridSettings({ offsetX: parseInt(e.target.value) || 0 })
                          }
                          disabled={!settings.grid.enabled}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-1">
                          Y Offset
                        </label>
                        <Input
                          type="number"
                          value={settings.grid.offsetY}
                          onChange={(e) =>
                            updateGridSettings({ offsetY: parseInt(e.target.value) || 0 })
                          }
                          disabled={!settings.grid.enabled}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Lighting Settings */}
              <div className="space-y-6 mt-0">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">Lighting System</h3>
                  <Switch
                    checked={settings.lighting.enabled}
                    onCheckedChange={(enabled) => updateLightingSettings({ enabled })}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-2">
                        Ambient Light: {Math.round(settings.lighting.ambientLight * 100)}%
                      </label>
                      <Slider
                        value={[settings.lighting.ambientLight]}
                        onValueChange={([ambientLight]) =>
                          ambientLight !== undefined && updateLightingSettings({ ambientLight })
                        }
                        min={0}
                        max={1}
                        step={0.1}
                        disabled={!settings.lighting.enabled}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-2">
                        Shadow Quality
                      </label>
                      <select
                        value={settings.lighting.shadowQuality}
                        onChange={(e) =>
                          updateLightingSettings({
                            shadowQuality: e.target.value as "low" | "medium" | "high",
                          })
                        }
                        className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        disabled={!settings.lighting.enabled}
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                      </select>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-neutral-700">
                        Global Illumination
                      </span>
                      <Switch
                        checked={settings.lighting.globalIllumination}
                        onCheckedChange={(globalIllumination) =>
                          updateLightingSettings({ globalIllumination })
                        }
                        disabled={!settings.lighting.enabled}
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-2">
                        Color Temperature: {settings.lighting.colorTemperature}K
                      </label>
                      <Slider
                        value={[settings.lighting.colorTemperature]}
                        onValueChange={([colorTemperature]) =>
                          colorTemperature !== undefined && updateLightingSettings({ colorTemperature })
                        }
                        min={2000}
                        max={8000}
                        step={100}
                        disabled={!settings.lighting.enabled}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-2">
                        Contrast: {settings.lighting.contrast.toFixed(1)}
                      </label>
                      <Slider
                        value={[settings.lighting.contrast]}
                        onValueChange={([contrast]) => contrast !== undefined && updateLightingSettings({ contrast })}
                        min={0.5}
                        max={2.0}
                        step={0.1}
                        disabled={!settings.lighting.enabled}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Fog of War Settings */}
              <div className="space-y-6 mt-0">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">Fog of War</h3>
                  <Switch
                    checked={settings.fog.enabled}
                    onCheckedChange={(enabled) => updateFogSettings({ enabled })}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-2">
                        Fog Type
                      </label>
                      <select
                        value={settings.fog.type}
                        onChange={(e) =>
                          updateFogSettings({ type: e.target.value as "static" | "dynamic" })
                        }
                        className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        disabled={!settings.fog.enabled}
                      >
                        <option value="static">Static (Manual)</option>
                        <option value="dynamic">Dynamic (Line of Sight)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-2">
                        Fog Color
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={settings.fog.color}
                          onChange={(e) => updateFogSettings({ color: e.target.value })}
                          className="w-12 h-10 rounded border border-neutral-300"
                          disabled={!settings.fog.enabled}
                        />
                        <Input
                          value={settings.fog.color}
                          onChange={(e) => updateFogSettings({ color: e.target.value })}
                          placeholder="#000000"
                          disabled={!settings.fog.enabled}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-2">
                        Opacity: {Math.round(settings.fog.opacity * 100)}%
                      </label>
                      <Slider
                        value={[settings.fog.opacity]}
                        onValueChange={([opacity]) => opacity !== undefined && updateFogSettings({ opacity })}
                        min={0}
                        max={1}
                        step={0.1}
                        disabled={!settings.fog.enabled}
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-2">
                        Blur Radius: {settings.fog.blurRadius}px
                      </label>
                      <Slider
                        value={[settings.fog.blurRadius]}
                        onValueChange={([blurRadius]) => blurRadius !== undefined && updateFogSettings({ blurRadius })}
                        min={0}
                        max={10}
                        step={1}
                        disabled={!settings.fog.enabled}
                      />
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-neutral-700">Reveal on Move</span>
                        <Switch
                          checked={settings.fog.revealOnMove}
                          onCheckedChange={(revealOnMove) => updateFogSettings({ revealOnMove })}
                          disabled={!settings.fog.enabled}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-neutral-700">Persist Reveal</span>
                        <Switch
                          checked={settings.fog.persistReveal}
                          onCheckedChange={(persistReveal) => updateFogSettings({ persistReveal })}
                          disabled={!settings.fog.enabled}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="border-t px-6 py-4 flex justify-between">
              <Button variant="outline" onClick={handleReset} disabled={!hasChanges || saving}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset
              </Button>

              <div className="flex gap-3">
                <Button variant="outline" onClick={handleClose} disabled={saving}>
                  Cancel
                </Button>
                <Button variant="primary" onClick={handleSave} disabled={!hasChanges || saving}>
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Settings
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
