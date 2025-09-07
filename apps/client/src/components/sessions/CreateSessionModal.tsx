/**
 * CreateSessionModal - Modal for creating new game sessions
 */

import React, { useState, useCallback } from "react";
import { logger } from "@vtt/logging";
import { Button } from "../ui/Button";
import { X, Users, Settings, Eye, EyeOff, Lock, Unlock } from "lucide-react";
import { CreateSessionRequest, sessionsService } from "../../services/sessions";
// import { useTranslation } from "@vtt/i18n";
// TODO: Implement i18n integration - using fallback for now
const useTranslation = () => ({ t: (key: string) => key });

interface CreateSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSessionCreated?: (sessionId: string) => void;
}

const GAME_SYSTEMS = [
  "D&D 5e",
  "Pathfinder 2e",
  "Cyberpunk Red",
  "Call of Cthulhu",
  "Vampire: The Masquerade",
  "World of Darkness",
  "GURPS",
  "Savage Worlds",
  "Fate Core",
  "Custom System"
] as const;

export const CreateSessionModal: React.FC<CreateSessionModalProps> = ({
  isOpen,
  onClose,
  onSessionCreated,
}) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<CreateSessionRequest>({
    name: "",
    description: "",
    system: "D&D 5e",
    maxPlayers: 6,
    isPrivate: false,
    allowSpectators: true,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = useCallback(() => {
    setFormData({
      name: "",
      description: "",
      system: "D&D 5e",
      maxPlayers: 6,
      isPrivate: false,
      allowSpectators: true,
    });
    setError(null);
    setIsSubmitting(false);
  }, []);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [resetForm, onClose]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      setError("Session name is required");
      return;
    }

    if (!formData.description.trim()) {
      setError("Session description is required");
      return;
    }

    if (formData.maxPlayers < 1 || formData.maxPlayers > 12) {
      setError("Maximum players must be between 1 and 12");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const newSession = await sessionsService.createSession(formData);
      logger.info("Session created successfully:", newSession);
      
      onSessionCreated?.(newSession.id);
      handleClose();
    } catch (error) {
      logger.error("Failed to create session:", error);
      setError(error instanceof Error ? error.message : "Failed to create session");
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, onSessionCreated, handleClose]);

  const updateFormData = useCallback(<K extends keyof CreateSessionRequest>(
    field: K,
    value: CreateSessionRequest[K]
  ) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(null);
  }, []);

  if (!isOpen) {return null;}

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-bg-secondary rounded-lg border border-border-primary w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border-secondary">
          <h2 className="text-xl font-semibold text-primary">Create New Session</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClose}
            disabled={isSubmitting}
            className="p-1"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-danger/20 border border-danger/30 rounded-lg">
              <p className="text-danger text-sm">{error}</p>
            </div>
          )}

          {/* Session Name */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-primary mb-2">
              Session Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => updateFormData("name", e.target.value)}
              placeholder="Enter session name..."
              disabled={isSubmitting}
              className="w-full px-3 py-2 bg-bg-tertiary border border-border-secondary rounded-lg text-primary placeholder-text-tertiary focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
              maxLength={100}
            />
          </div>

          {/* Description */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-primary mb-2">
              Description *
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => updateFormData("description", e.target.value)}
              placeholder="Describe your session, what players can expect, experience level, etc..."
              disabled={isSubmitting}
              rows={3}
              className="w-full px-3 py-2 bg-bg-tertiary border border-border-secondary rounded-lg text-primary placeholder-text-tertiary focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary resize-y"
              maxLength={500}
            />
            <div className="text-right text-xs text-text-tertiary mt-1">
              {formData.description.length}/500 characters
            </div>
          </div>

          {/* Game System */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-primary mb-2">
              Game System
            </label>
            <select
              value={formData.system}
              onChange={(e) => updateFormData("system", e.target.value)}
              disabled={isSubmitting}
              className="w-full px-3 py-2 bg-bg-tertiary border border-border-secondary rounded-lg text-primary focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
            >
              {GAME_SYSTEMS.map((system) => (
                <option key={system} value={system}>
                  {system}
                </option>
              ))}
            </select>
          </div>

          {/* Max Players */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-primary mb-2">
              Maximum Players
            </label>
            <div className="flex items-center gap-3">
              <Users className="h-4 w-4 text-text-tertiary" />
              <input
                type="number"
                value={formData.maxPlayers}
                onChange={(e) => updateFormData("maxPlayers", parseInt(e.target.value) || 1)}
                min={1}
                max={12}
                disabled={isSubmitting}
                className="w-20 px-3 py-2 bg-bg-tertiary border border-border-secondary rounded-lg text-primary focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
              />
              <span className="text-sm text-text-secondary">players (1-12)</span>
            </div>
          </div>

          {/* Settings */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-primary mb-3 flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Session Settings
            </h3>
            
            <div className="space-y-3">
              {/* Private Session */}
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isPrivate}
                  onChange={(e) => updateFormData("isPrivate", e.target.checked)}
                  disabled={isSubmitting}
                  className="w-4 h-4 text-primary bg-bg-tertiary border-border-secondary rounded focus:ring-2 focus:ring-primary/50"
                />
                <div className="flex items-center gap-2">
                  {formData.isPrivate ? (
                    <Lock className="h-4 w-4 text-warning" />
                  ) : (
                    <Unlock className="h-4 w-4 text-success" />
                  )}
                  <span className="text-sm text-primary">Private Session</span>
                </div>
                <span className="text-xs text-text-tertiary">
                  {formData.isPrivate ? "Requires invitation to join" : "Publicly visible"}
                </span>
              </label>

              {/* Allow Spectators */}
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.allowSpectators}
                  onChange={(e) => updateFormData("allowSpectators", e.target.checked)}
                  disabled={isSubmitting}
                  className="w-4 h-4 text-primary bg-bg-tertiary border-border-secondary rounded focus:ring-2 focus:ring-primary/50"
                />
                <div className="flex items-center gap-2">
                  {formData.allowSpectators ? (
                    <Eye className="h-4 w-4 text-success" />
                  ) : (
                    <EyeOff className="h-4 w-4 text-text-tertiary" />
                  )}
                  <span className="text-sm text-primary">Allow Spectators</span>
                </div>
                <span className="text-xs text-text-tertiary">
                  Let others watch without participating
                </span>
              </label>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border-secondary">
            <Button
              type="button"
              variant="ghost"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={isSubmitting}
              disabled={!formData.name.trim() || !formData.description.trim()}
            >
              {isSubmitting ? "Creating..." : "Create Session"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
