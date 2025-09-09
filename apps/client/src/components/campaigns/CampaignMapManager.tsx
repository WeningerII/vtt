/**
 * Campaign Map Manager - Interface for managing scenes and maps within a campaign
 */
import React, { useState, useEffect, useRef } from "react";
import { logger } from "@vtt/logging";
import { toErrorObject } from "../../utils/error-utils";

import {
  Map,
  Plus,
  Upload,
  Grid,
  Settings,
  Eye,
  Trash2,
  Play,
  Pause,
  Users
} from "lucide-react";
const Grid3X3 = () => <span>⋮⋮⋮</span>;
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { cn } from '../../lib/utils';

interface Scene {
  id: string;
  name: string;
  mapId: string | null;
  isActive: boolean;
  createdAt: Date;
}

interface CampaignMapManagerProps {
  campaignId: string;
  isGM: boolean;
  onSceneSelect: (_sceneId: string) => void;
  onLaunchSession: (_sceneId: string) => void;
}

interface CreateSceneModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string, _mapId?: string) => void;
  availableMaps: Array<{ id: string; name: string; }>;
}

interface SceneSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (sceneId: string, updates: { name?: string; mapId?: string | null; }) => void;
  scene: Scene | null;
  availableMaps: Array<{ id: string; name: string; }>;
}

function CreateSceneModal({ isOpen: _isOpen, onClose: _onClose, onSubmit, availableMaps }: CreateSceneModalProps) {
  const [sceneName, setSceneName] = useState('');
  const [selectedMapId, setSelectedMapId] = useState<string>('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sceneName.trim()) {return;}
    
    onSubmit(sceneName.trim(), selectedMapId || undefined);
    setSceneName('');
    setSelectedMapId('');
    _onClose();
  };

  if (!_isOpen) {return null;}

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Create New Scene</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4" role="form">
            <div>
              <label className="block text-sm font-medium mb-2">Scene Name</label>
              <Input
                value={sceneName}
                onChange={(e) => setSceneName(e.target.value)}
                placeholder="Enter scene name..."
                autoFocus
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">Map (Optional)</label>
              <select
                value={selectedMapId}
                onChange={(e) => setSelectedMapId(e.target.value)}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">No map - Empty scene</option>
                {availableMaps.map(map => (
                  <option key={map.id} value={map.id}>{map.name}</option>
                ))}
              </select>
            </div>
            
            <div className="flex gap-2 justify-end">
              <Button onClick={_onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={!sceneName.trim()}>
                Create Scene
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function SceneSettingsModal({ isOpen, onClose, onSubmit, scene, availableMaps }: SceneSettingsModalProps) {
  const [sceneName, setSceneName] = useState('');
  const [selectedMapId, setSelectedMapId] = useState<string>('');

  // Initialize form values when scene changes
  React.useEffect(() => {
    if (scene) {
      setSceneName(scene.name);
      setSelectedMapId(scene.mapId || '');
    }
  }, [scene]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scene || !sceneName.trim()) {return;}
    
    const updates: { name?: string; mapId?: string | null; } = {};
    
    // Only include changed values
    if (sceneName.trim() !== scene.name) {
      updates.name = sceneName.trim();
    }
    
    const newMapId = selectedMapId || null;
    if (newMapId !== scene.mapId) {
      updates.mapId = newMapId;
    }
    
    // Only submit if there are actual changes
    if (Object.keys(updates).length > 0) {
      onSubmit(scene.id, updates);
    }
    
    onClose();
  };

  if (!isOpen || !scene) {return null;}

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Scene Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4" role="form">
            <div>
              <label className="block text-sm font-medium mb-2">Scene Name</label>
              <Input
                value={sceneName}
                onChange={(e) => setSceneName(e.target.value)}
                placeholder="Enter scene name..."
                autoFocus
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">Map</label>
              <select
                value={selectedMapId}
                onChange={(e) => setSelectedMapId(e.target.value)}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">No map - Empty scene</option>
                {availableMaps.map(map => (
                  <option key={map.id} value={map.id}>{map.name}</option>
                ))}
              </select>
            </div>
            
            <div className="bg-neutral-50 p-3 rounded-lg">
              <h4 className="text-sm font-medium text-neutral-700 mb-2">Scene Info</h4>
              <div className="text-sm text-neutral-600 space-y-1">
                <p><strong>Created:</strong> {new Date(scene.createdAt).toLocaleDateString()}</p>
                <p><strong>Status:</strong> {scene.isActive ? 'Active' : 'Inactive'}</p>
                <p><strong>Current Map:</strong> {scene.mapId ? 'Has map' : 'Empty scene'}</p>
              </div>
            </div>
            
            <div className="flex gap-2 justify-end">
              <Button onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={!sceneName.trim()}>
                Save Changes
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export function CampaignMapManager({ campaignId: _campaignId, isGM, onSceneSelect, onLaunchSession }: CampaignMapManagerProps) {
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [selectedScene, setSelectedScene] = useState<Scene | null>(null);
  const [availableMaps, setAvailableMaps] = useState<Array<{ id: string; name: string; }>>([]);
  const [activeSceneId, setActiveSceneId] = useState<string | null>(null);

  // Load scenes for campaign
  useEffect(() => {
    const loadScenes = async () => {
      try {
        const response = await fetch(`/api/campaigns/${_campaignId}/scenes`);
        if (response.ok) {
          const data = await response.json();
          setScenes(data.scenes || []);
          setActiveSceneId(data.activeSceneId || null);
        }
      } catch (error) {
        logger.error('Failed to load scenes:', error);
      } finally {
        setLoading(false);
      }
    };

    loadScenes();
  }, [_campaignId]);

  // Load available maps
  useEffect(() => {
    const loadMaps = async () => {
      try {
        const response = await fetch('/api/maps');
        if (response.ok) {
          const data = await response.json();
          setAvailableMaps(data.maps || []);
        }
      } catch (error) {
        logger.error("Failed to load map assets:", toErrorObject(error));
      }
    };

    loadMaps();
  }, []);

  const handleDuplicateScene = async (sceneId: string) => {
    const scene = scenes.find(s => s.id === sceneId);
    if (!scene) {return;}
    
    try {
      const response = await fetch(`/api/campaigns/${_campaignId}/scenes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: `${scene.name} (Copy)`,
          mapId: scene.mapId,
          userId: localStorage.getItem('userId') || 'default-user'
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setScenes(prev => [...prev, data.scene]);
      }
    } catch (error) {
      logger.error('Failed to duplicate scene:', error);
    }
  };

  const handleSceneSettings = (sceneId: string) => {
    const scene = scenes.find(s => s.id === sceneId);
    if (scene) {
      setSelectedScene(scene);
      setShowSettingsModal(true);
    }
  };

  const handleCreateScene = async (name: string, mapId?: string) => {
    try {
      const response = await fetch(`/api/campaigns/${_campaignId}/scenes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          mapId,
          userId: localStorage.getItem('userId') || 'default-user'
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setScenes(prev => [...prev, data.scene]);
      }
    } catch (error) {
      logger.error('Failed to create scene:', error);
    }
  };

  const handleUpdateScene = async (sceneId: string, updates: { name?: string; mapId?: string | null; }) => {
    try {
      const response = await fetch(`/api/maps/scenes/${sceneId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        const data = await response.json();
        // Update the scene in our local state
        setScenes(prev => prev.map(scene => 
          scene.id === sceneId ? { ...scene, ...updates } : scene
        ));
        
        // If this was the selected scene, update it too
        if (selectedScene && selectedScene.id === sceneId) {
          setSelectedScene({ ...selectedScene, ...updates });
        }
      }
    } catch (error) {
      logger.error('Failed to update scene:', error);
    }
  };

  // Unused function - commented out
  /*
  const handleSetActiveScene = async (_sceneId: string) => {
    if (!_campaignId) return;

    try {
      const response = await fetch(`/api/campaigns/${_campaignId}/scenes/${_sceneId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sceneId: _sceneId,
          userId: 'temp-user-id'
        }),
      });

      if (response.ok) {
        setActiveSceneId(_sceneId);
      }
    } catch (error) {
      logger.error("Failed to set background:", toErrorObject(error));
    }
  };
  */

  const handleDeleteScene = async (sceneId: string) => {
    if (!isGM || !confirm('Are you sure you want to delete this scene?')) {return;}

    try {
      const response = await fetch(`/api/maps/scenes/${sceneId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setScenes(prev => prev.filter(s => s.id !== sceneId));
        if (activeSceneId === sceneId) {
          setActiveSceneId(null);
        }
      }
    } catch (error) {
      logger.error("Failed to delete asset:", toErrorObject(error));
    }
  };

  if (loading) {
    return (
      <Card className="h-full">
        <CardContent className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <Card className="flex-1">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <span className="h-5 w-5"><Map /></span>
              Scenes & Maps
            </CardTitle>
            {isGM && (
              <div className="flex gap-2">
                <Button className="border border-neutral-300 px-3 py-1 rounded hover:bg-neutral-50" onClick={() => {}}>
                  <span className="h-4 w-4 mr-2 inline-block"><Users /></span>
                  Manage Players
                </Button>
                <Button className="border border-neutral-300 px-3 py-1 rounded hover:bg-neutral-50" onClick={() => {}}>
                  <span className="h-4 w-4 mr-2 inline-block"><Settings /></span>
                  Session Settings
                </Button>
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {scenes.length === 0 ? (
            <div className="text-center py-8">
              <span className="h-12 w-12 text-neutral-400 mx-auto mb-4 flex items-center justify-center"><Map /></span>
              <h3 className="text-lg font-medium text-neutral-900 mb-2">No scenes yet</h3>
              <p className="text-neutral-600 mb-4">
                Create your first scene to start building your campaign world
              </p>
              {isGM && (
                <Button onClick={() => setShowCreateModal(true)}>
                  <span className="h-4 w-4 mr-2"><Plus /></span>
                  Create First Scene
                </Button>
              )}
            </div>
          ) : (
            scenes.map(scene => (
              <div role="button"
                key={scene.id}
                className={cn(
                  "group flex items-center gap-3 p-3 border rounded-lg transition-all cursor-pointer hover:border-neutral-300",
                  activeSceneId === scene.id 
                    ? "border-primary-500 bg-primary-50" 
                    : "border-neutral-200"
                )}
                onClick={() => onSceneSelect(scene.id)}
              >
                <div className={cn(
                  "flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center",
                  scene.mapId 
                    ? "bg-primary-100 text-primary-600" 
                    : "bg-neutral-100 text-neutral-600"
                )}>
                  {scene.mapId ? <span className="h-5 w-5"><Map /></span> : <span className="h-5 w-5"><Grid3X3 /></span>}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium text-neutral-900 truncate">{scene.name}</h4>
                    {activeSceneId === scene.id && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-success-100 text-success-800 text-xs font-medium rounded-full">
                        <span className="h-3 w-3 mr-1"><Play /></span>
                        <span className="h-3 w-3"><Play /></span>
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-neutral-600">
                    <span>{scene.mapId ? 'Has map' : 'Empty scene'}</span>
                    <span>•</span>
                    <span>Created {new Date(scene.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {isGM && (
                    <>
                      {activeSceneId !== scene.id ? (
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDuplicateScene(scene.id);
                          }}
                          title="Duplicate scene"
                          className="p-1 hover:bg-neutral-100 rounded"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            onLaunchSession(scene.id);
                          }}
                          title="Launch session"
                          className="p-1 hover:bg-neutral-100 rounded"
                        >
                          <Users className="h-4 w-4" />
                        </Button>
                      )}
                      
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSceneSettings(scene.id);
                        }}
                        title="Scene settings"
                        className="p-1 hover:bg-neutral-100 rounded"
                      >
                        <Settings className="h-4 w-4" />
                      </Button>
                      
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteScene(scene.id);
                        }}
                        title="Delete scene"
                        className="text-red-600 hover:text-red-700 p-1 hover:bg-red-50 rounded"
                      >
                        <span className="h-4 w-4"><Trash2 /></span>
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Active Session Status */}
      {activeSceneId && (
        <Card className="mt-4">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-success-500 rounded-full animate-pulse"></div>
                  <span className="text-sm font-medium">Session Active</span>
                </div>
                <span className="text-sm text-neutral-600">
                  {scenes.find(s => s.id === activeSceneId)?.name}
                </span>
              </div>
              
              {isGM && (
                <div className="flex gap-2">
                  <Button 
                    className="px-2 py-1 hover:bg-neutral-100 rounded"
                    onClick={() => onLaunchSession(activeSceneId)}
                  >
                    <span className="h-4 w-4 mr-1 inline-block"><Users /></span>
                    Manage Session
                  </Button>
                  <Button 
                    className="px-2 py-1 hover:bg-neutral-100 rounded"
                    onClick={() => setActiveSceneId(null)}
                  >
                    <span className="h-4 w-4 mr-1 inline-block"><Pause /></span>
                    End Session
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <CreateSceneModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreateScene}
        availableMaps={availableMaps}
      />

      <SceneSettingsModal
        isOpen={showSettingsModal}
        onClose={() => {
          setShowSettingsModal(false);
          setSelectedScene(null);
        }}
        onSubmit={handleUpdateScene}
        scene={selectedScene}
        availableMaps={availableMaps}
      />
    </div>
  );
}

export default CampaignMapManager;
