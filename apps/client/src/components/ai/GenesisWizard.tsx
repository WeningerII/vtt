/**
 * Genesis Character Creation Wizard
 * AI-powered character generation interface
 */

import React, { useState, useEffect } from "react";
import { logger } from "@vtt/logging";
import { toErrorObject } from "../../utils/error-utils";
import { useWebSocket } from "../../providers/WebSocketProvider";
import { useCharacter } from "../../hooks/useCharacter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wand2,
  User,
  Shield,
  Book,
  Dices,
  Sword,
  Sparkles,
  Heart,
  Brain,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Play,
  Download
} from "lucide-react";

interface CharacterConcept {
  prompt: string;
  preferences?: {
    system?: "dnd5e" | "pathfinder" | "generic";
    powerLevel?: "low" | "standard" | "high" | "epic";
    complexity?: "simple" | "moderate" | "complex";
    playstyle?: "combat" | "roleplay" | "exploration" | "balanced";
  };
}

interface GenerationStep {
  step: string;
  status: "pending" | "processing" | "completed" | "error";
  result?: any;
  reasoning?: string;
  alternatives?: any[];
  confidence?: number;
}

interface CharacterGeneration {
  id: string;
  concept: CharacterConcept;
  steps: GenerationStep[];
  currentStep: string;
  character?: any;
  isComplete: boolean;
  error?: string;
  metadata: {
    provider: string;
    totalCostUSD: number;
    totalLatencyMs: number;
    generatedAt: Date;
  };
}

const stepIcons: Record<string, React.ReactNode> = {
  concept: <Brain className="w-5 h-5" />,
  race: <User className="w-5 h-5" />,
  class: <Shield className="w-5 h-5" />,
  background: <Book className="w-5 h-5" />,
  abilities: <Dices className="w-5 h-5" />,
  equipment: <Sword className="w-5 h-5" />,
  spells: <Sparkles className="w-5 h-5" />,
  personality: <Heart className="w-5 h-5" />,
  optimization: <CheckCircle className="w-5 h-5" />,
};

const stepLabels: Record<string, string> = {
  concept: "Concept Analysis",
  race: "Race Selection",
  class: "Class Selection",
  background: "Background",
  abilities: "Ability Scores",
  equipment: "Equipment",
  spells: "Spells",
  personality: "Personality",
  optimization: "Optimization",
};

export const GenesisWizard: React.FC = () => {
  const [currentGeneration, setCurrentGeneration] = useState<CharacterGeneration | null>(null);
  const [conceptForm, setConceptForm] = useState<CharacterConcept>({
    prompt: "",
    preferences: {
      system: "dnd5e",
      powerLevel: "standard",
      complexity: "moderate",
      playstyle: "balanced",
    },
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { send: sendWebSocket } = useWebSocket();
  const { createCharacter } = useCharacter();

  // Example prompts for inspiration
  const examplePrompts = [
    "A wise old wizard who left their tower to help people",
    "A cheerful halfling rogue with a heart of gold",
    "A battle-scarred paladin seeking redemption",
    "A mysterious warlock bound to an ancient entity",
    "A nature-loving druid protecting the forest",
    "A street-smart bard collecting stories",
  ];

  const startGeneration = async () => {
    if (!conceptForm.prompt.trim()) {
      setError("Please enter a character concept");
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch("/api/v1/genesis/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify(conceptForm),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Failed to start generation");
      }

      // Subscribe to WebSocket updates
      const generationId = result.data.generationId;
      sendWebSocket({
        type: "GENESIS_SUBSCRIBE",
        payload: { generationId },
      });

      // Poll for updates
      pollGenerationStatus(generationId);
    } catch (err: any) {
      setError(err.message);
      setIsGenerating(false);
    }
  };

  const pollGenerationStatus = async (generationId: string) => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/genesis/${generationId}`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        });

        const result = await response.json();

        if (result.success) {
          setCurrentGeneration(result.data);

          if (result.data.isComplete || result.data.error) {
            clearInterval(pollInterval);
            setIsGenerating(false);
          }
        }
      } catch (error) {
        logger.error("Genesis creation failed:", toErrorObject(error));
      }
    }, 2000);

    // Clear interval after 5 minutes to prevent infinite polling
    setTimeout(() => clearInterval(pollInterval), 300000);
  };

  const retryStep = async (stepName: string) => {
    if (!currentGeneration) {return;}

    try {
      const response = await fetch(`/api/genesis/${currentGeneration.id}/retry`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ stepName }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Failed to retry step");
      }

      // Continue polling for updates
      pollGenerationStatus(currentGeneration.id);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const acceptCharacter = async () => {
    if (!currentGeneration?.character) {return;}

    try {
      // Character is already created by the backend
      // Just redirect to character sheet
      window.location.href = `/character/${currentGeneration.character.id}`;
    } catch (err: any) {
      setError(err.message);
    }
  };

  const resetWizard = () => {
    setCurrentGeneration(null);
    setIsGenerating(false);
    setError(null);
    setConceptForm({
      prompt: "",
      preferences: {
        system: "dnd5e",
        powerLevel: "standard",
        complexity: "moderate",
        playstyle: "balanced",
      },
    });
  };

  const renderConceptForm = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-2xl mx-auto space-y-6"
    >
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white">
          <Wand2 className="w-8 h-8" />
        </div>
        <h1 className="text-3xl font-bold text-white">Genesis Character Creator</h1>
        <p className="text-gray-400">
          Describe your character concept and let AI forge them into reality
        </p>
      </div>

      <div className="bg-gray-800 rounded-lg p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Character Concept</label>
          <textarea
            value={conceptForm.prompt}
            onChange={(e) => setConceptForm({ ...conceptForm, prompt: e.target.value })}
            placeholder="Describe your character idea... (e.g., 'A brave knight seeking to reclaim their family's honor')"
            className="w-full h-32 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Power Level</label>
            <select
              value={conceptForm.preferences?.powerLevel || "standard"}
              onChange={(e) =>
                setConceptForm({
                  ...conceptForm,
                  preferences: { ...conceptForm.preferences, powerLevel: e.target.value as any },
                })
              }
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="low">Low Power</option>
              <option value="standard">Standard</option>
              <option value="high">High Power</option>
              <option value="epic">Epic Level</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Complexity</label>
            <select
              value={conceptForm.preferences?.complexity || "moderate"}
              onChange={(e) =>
                setConceptForm({
                  ...conceptForm,
                  preferences: { ...conceptForm.preferences, complexity: e.target.value as any },
                })
              }
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="simple">Simple</option>
              <option value="moderate">Moderate</option>
              <option value="complex">Complex</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Playstyle Focus</label>
          <div className="grid grid-cols-2 gap-2">
            {["combat", "roleplay", "exploration", "balanced"].map((style) => (
              <button
                key={style}
                onClick={() =>
                  setConceptForm({
                    ...conceptForm,
                    preferences: { ...conceptForm.preferences, playstyle: style as any },
                  })
                }
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  conceptForm.preferences?.playstyle === style
                    ? "bg-purple-600 text-white"
                    : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                }`}
              >
                {style.charAt(0).toUpperCase() + style.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Need inspiration?</label>
          <div className="flex flex-wrap gap-2">
            {examplePrompts.map((prompt, index) => (
              <button
                key={index}
                onClick={() => setConceptForm({ ...conceptForm, prompt })}
                className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded-full transition-colors"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={startGeneration}
          disabled={isGenerating || !conceptForm.prompt.trim()}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-medium rounded-lg hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          aria-label="Click button"
        >
          <Play className="w-5 h-5" />
          Begin Genesis
        </button>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-500 rounded-lg p-4 text-red-400">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            <span>{error}</span>
          </div>
        </div>
      )}
    </motion.div>
  );

  const renderGenerationProgress = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto space-y-6"
    >
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white mb-2">Forging Your Character</h2>
        <p className="text-gray-400">AI is crafting your character step by step...</p>
      </div>

      {/* Progress Steps */}
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="grid grid-cols-3 md:grid-cols-5 gap-4">
          {currentGeneration?.steps.map((step, _index) => {
            const isActive = step.step === currentGeneration.currentStep;
            const isCompleted = step.status === "completed";
            const isError = step.status === "error";
            const isProcessing = step.status === "processing";

            return (
              <div
                key={step.step}
                className={`relative flex flex-col items-center p-4 rounded-lg transition-all ${
                  isActive
                    ? "bg-purple-900/50 border-2 border-purple-500"
                    : isCompleted
                      ? "bg-green-900/50 border border-green-500"
                      : isError
                        ? "bg-red-900/50 border border-red-500"
                        : "bg-gray-700 border border-gray-600"
                }`}
              >
                <div
                  className={`flex items-center justify-center w-10 h-10 rounded-full mb-2 ${
                    isCompleted
                      ? "bg-green-500 text-white"
                      : isError
                        ? "bg-red-500 text-white"
                        : isProcessing
                          ? "bg-purple-500 text-white animate-pulse"
                          : "bg-gray-600 text-gray-300"
                  }`}
                >
                  {isProcessing ? (
                    <RefreshCw className="w-5 h-5 animate-spin" />
                  ) : (
                    stepIcons[step.step]
                  )}
                </div>

                <span
                  className={`text-sm font-medium text-center ${
                    isCompleted
                      ? "text-green-400"
                      : isError
                        ? "text-red-400"
                        : isActive
                          ? "text-purple-400"
                          : "text-gray-400"
                  }`}
                >
                  {stepLabels[step.step]}
                </span>

                {step.confidence && (
                  <div className="mt-1 text-xs text-gray-500">
                    {Math.round(step.confidence * 100)}%
                  </div>
                )}

                {isError && (
                  <button
                    onClick={() => retryStep(step.step)}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center text-xs transition-colors"
                    title="Retry this step"
                  >
                    <RefreshCw className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Current Step Details */}
        {currentGeneration?.steps.find((s) => s.step === currentGeneration.currentStep) && (
          <div className="mt-6 p-4 bg-gray-700 rounded-lg">
            <h4 className="font-medium text-white mb-2">
              Current: {stepLabels[currentGeneration.currentStep]}
            </h4>
            <p className="text-gray-400 text-sm">
              AI is analyzing and generating this part of your character...
            </p>
          </div>
        )}

        {currentGeneration?.error && (
          <div className="mt-4 p-4 bg-red-900/20 border border-red-500 rounded-lg text-red-400">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="w-5 h-5" />
              <span className="font-medium">Generation Error</span>
            </div>
            <p className="text-sm">{currentGeneration.error}</p>
            <button
              onClick={resetWizard}
              className="mt-2 px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors"
              aria-label="start over"
            >
              Start Over
            </button>
          </div>
        )}
      </div>

      {/* Generation Metadata */}
      {currentGeneration?.metadata && (
        <div className="bg-gray-800 rounded-lg p-4">
          <h4 className="font-medium text-white mb-2">Generation Stats</h4>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-400">Provider:</span>
              <span className="ml-2 text-white">{currentGeneration.metadata.provider}</span>
            </div>
            <div>
              <span className="text-gray-400">Cost:</span>
              <span className="ml-2 text-white">
                ${currentGeneration.metadata.totalCostUSD.toFixed(4)}
              </span>
            </div>
            <div>
              <span className="text-gray-400">Time:</span>
              <span className="ml-2 text-white">
                {Math.round(currentGeneration.metadata.totalLatencyMs / 1000)}s
              </span>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );

  const renderCharacterResult = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto space-y-6"
    >
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-r from-green-500 to-blue-500 text-white mb-4">
          <CheckCircle className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Character Genesis Complete!</h2>
        <p className="text-gray-400">Your AI-forged character is ready for adventure</p>
      </div>

      {/* Character Summary */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-xl font-bold text-white mb-4">Character Summary</h3>

        {currentGeneration?.character && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div>
                <span className="text-gray-400">Name:</span>
                <span className="ml-2 text-white font-medium">
                  {currentGeneration.character.name}
                </span>
              </div>
              <div>
                <span className="text-gray-400">Race:</span>
                <span className="ml-2 text-white">{currentGeneration.character.race}</span>
              </div>
              <div>
                <span className="text-gray-400">Class:</span>
                <span className="ml-2 text-white">{currentGeneration.character.class}</span>
              </div>
              <div>
                <span className="text-gray-400">Background:</span>
                <span className="ml-2 text-white">{currentGeneration.character.background}</span>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <span className="text-gray-400">Level:</span>
                <span className="ml-2 text-white">{currentGeneration.character.level}</span>
              </div>
              <div>
                <span className="text-gray-400">Hit Points:</span>
                <span className="ml-2 text-white">{currentGeneration.character.hitPoints}</span>
              </div>
              <div>
                <span className="text-gray-400">Armor Class:</span>
                <span className="ml-2 text-white">{currentGeneration.character.armorClass}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-center gap-4">
        <button
          onClick={acceptCharacter}
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-600 to-blue-600 text-white font-medium rounded-lg hover:from-green-700 hover:to-blue-700 transition-all"
          aria-label="Click button"
        >
          <Download className="w-5 h-5" />
          Accept Character
        </button>

        <button
          onClick={resetWizard}
          className="flex items-center gap-2 px-6 py-3 bg-gray-700 text-gray-300 font-medium rounded-lg hover:bg-gray-600 transition-colors"
          aria-label="Click button"
        >
          <Wand2 className="w-5 h-5" />
          Create Another
        </button>
      </div>
    </motion.div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-900 to-purple-900 p-6">
      <AnimatePresence mode="wait">
        {!currentGeneration && !isGenerating && renderConceptForm()}
        {(isGenerating || (currentGeneration && !currentGeneration.isComplete)) &&
          renderGenerationProgress()}
        {currentGeneration?.isComplete && renderCharacterResult()}
      </AnimatePresence>
    </div>
  );
};

export default GenesisWizard;
