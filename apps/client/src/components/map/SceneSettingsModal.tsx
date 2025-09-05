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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/Tabs";
import { Switch } from "../ui/Switch";
import { Slider } from "../ui/Slider";
import { _cn } from "../../lib/utils";

interface SceneSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  sceneId: string;
  initialSettings?: SceneSettings;
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

export function SceneSettingsModal({
  isOpen,
  _onClose,
  _sceneId,
  _initialSettings,
  _onSettingsUpdate,
}: SceneSettingsModalProps) {
  const [settings, setSettings] = useState<SceneSettings>(initialSettings || DEFAULT_SETTINGS);
  const [activeTab, setActiveTab] = useState("grid");
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (initialSettings) {
      setSettings(initialSettings);
      setHasChanges(false);
    }
  }, [initialSettings]);

  if (!isOpen) {return null;}

  const updateGridSettings = (_updates: Partial<GridSettings>) => {
    setSettings((prev) => ({
      ...prev,
      grid: { ...prev.grid, ...updates },
    }));
    setHasChanges(true);
  };

  const updateLightingSettings = (_updates: Partial<LightingSettings>) => {
    setSettings((prev) => ({
      ...prev,
      lighting: { ...prev.lighting, ...updates },
    }));
    setHasChanges(true);
  };

  const updateFogSettings = (_updates: Partial<FogSettings>) => {
    setSettings((prev) => ({
      ...prev,
      fog: { ...prev.fog, ...updates },
    }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Call API to update scene settings
      const response = await fetch(`/api/scenes/${sceneId}/settings`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(settings),
      });

      if (!response.ok) {
        throw new Error("Failed to save settings");
      }

      onSettingsUpdate(settings);
      setHasChanges(false);
    } catch (error) {
      logger.error("Error saving settings:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setSettings(initialSettings || DEFAULT_SETTINGS);
    setHasChanges(false);
  };

  const handleClose = () => {
    if (hasChanges) {
      const confirm = window.confirm("You have unsaved changes. Are you sure you want to close?");
      if (!confirm) {return;}
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Scene Settings
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={handleClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>

        <CardContent className="p-0">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
            <TabsList className="grid w-full grid-cols-3 mx-6 mb-4">
              <TabsTrigger value="grid" className="flex items-center gap-2">
                <Grid3X3 className="h-4 w-4" />
                Grid
              </TabsTrigger>
              <TabsTrigger value="lighting" className="flex items-center gap-2">
                <Sun className="h-4 w-4" />
                Lighting
              </TabsTrigger>
              <TabsTrigger value="fog" className="flex items-center gap-2">
                <Eye className="h-4 w-4" />
                Fog of War
              </TabsTrigger>
            </TabsList>

            <div className="px-6 pb-6 max-h-[60vh] overflow-y-auto">
              {/* Grid Settings */}
              <TabsContent value="grid" className="space-y-6 mt-0">
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
                        onValueChange={([_opacity]) => updateGridSettings({ opacity })}
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
                          onCheckedChange={(_snapToGrid) => updateGridSettings({ snapToGrid })}
                          disabled={!settings.grid.enabled}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-neutral-700">Show Labels</span>
                        <Switch
                          checked={settings.grid.showLabels}
                          onCheckedChange={(_showLabels) => updateGridSettings({ showLabels })}
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
              </TabsContent>

              {/* Lighting Settings */}
              <TabsContent value="lighting" className="space-y-6 mt-0">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">Lighting System</h3>
                  <Switch
                    checked={settings.lighting.enabled}
                    onCheckedChange={(_enabled) => updateLightingSettings({ enabled })}
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
                        onValueChange={([_ambientLight]) =>
                          updateLightingSettings({ ambientLight })
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
                        onCheckedChange={(_globalIllumination) =>
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
                        onValueChange={([_colorTemperature]) =>
                          updateLightingSettings({ colorTemperature })
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
                        onValueChange={([_contrast]) => updateLightingSettings({ contrast })}
                        min={0.5}
                        max={2.0}
                        step={0.1}
                        disabled={!settings.lighting.enabled}
                      />
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Fog of War Settings */}
              <TabsContent value="fog" className="space-y-6 mt-0">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">Fog of War</h3>
                  <Switch
                    checked={settings.fog.enabled}
                    onCheckedChange={(_enabled) => updateFogSettings({ enabled })}
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
                        onValueChange={([_opacity]) => updateFogSettings({ opacity })}
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
                        onValueChange={([_blurRadius]) => updateFogSettings({ blurRadius })}
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
                          onCheckedChange={(_revealOnMove) => updateFogSettings({ revealOnMove })}
                          disabled={!settings.fog.enabled}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-neutral-700">Persist Reveal</span>
                        <Switch
                          checked={settings.fog.persistReveal}
                          onCheckedChange={(_persistReveal) => updateFogSettings({ persistReveal })}
                          disabled={!settings.fog.enabled}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>
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
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
