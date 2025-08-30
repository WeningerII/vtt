/**
 * AI-driven encounter generator component
 */

import React, { useState } from "react";
import "./EncounterGenerator.css";

export interface EncounterRequest {
  playerLevel: number;
  partySize: number;
  setting: string;
  difficulty: "easy" | "medium" | "hard" | "deadly";
  theme?: string;
  environment?: string;
}

export interface GeneratedEncounter {
  id: string;
  title: string;
  description: string;
  enemies: Array<{
    name: string;
    count: number;
    cr: string;
    tactics: string;
  }>;
  environment: {
    description: string;
    features: string[];
    hazards?: string[];
  };
  rewards: {
    xp: number;
    treasure?: string;
    items?: string[];
  };
  scalingNotes: string;
  metadata: {
    provider: string;
    model: string;
    costUSD: number;
    latencyMs: number;
  };
}

export interface EncounterGeneratorProps {
  campaignId?: string;
  onEncounterGenerated?: (_encounter: GeneratedEncounter) => void;
  onClose?: () => void;
}

export const EncounterGenerator: React.FC<EncounterGeneratorProps> = ({
  campaignId,
  onEncounterGenerated,
  onClose,
}) => {
  const [request, setRequest] = useState<EncounterRequest>({
    playerLevel: 5,
    partySize: 4,
    setting: "fantasy",
    difficulty: "medium",
    theme: "",
    environment: "",
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedEncounter, setGeneratedEncounter] = useState<GeneratedEncounter | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch("/api/content/encounter", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...request,
          campaignId,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate encounter");
      }

      const result = await response.json();

      // Parse the AI-generated content
      const encounter: GeneratedEncounter = {
        id: result.id,
        title: result.content.title || "Generated Encounter",
        description: result.content.description || "",
        enemies: result.content.enemies || [],
        environment: result.content.environment || { description: "", features: [] },
        rewards: result.content.rewards || { xp: 0 },
        scalingNotes: result.content.scalingNotes || "",
        metadata: result.metadata,
      };

      setGeneratedEncounter(encounter);
      onEncounterGenerated?.(encounter);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleUseEncounter = () => {
    if (generatedEncounter) {
      onEncounterGenerated?.(generatedEncounter);
      onClose?.();
    }
  };

  const difficultyDescriptions = {
    easy: "Easy encounter - should not be deadly",
    medium: "Medium encounter - may be challenging",
    hard: "Hard encounter - likely to be challenging",
    deadly: "Deadly encounter - could be lethal",
  };

  return (
    <div className="encounter-generator">
      <div className="generator-header">
        <h3>AI Encounter Generator</h3>
        {onClose && (
          <button className="close-btn" onClick={onClose}>
            ×
          </button>
        )}
      </div>

      <div className="generator-form">
        <div className="form-group">
          <label>Party Level:</label>
          <input
            type="number"
            min="1"
            max="20"
            value={request.playerLevel}
            onChange={(e) =>
              setRequest((prev) => ({ ...prev, playerLevel: parseInt(e.target.value) }))
            }
          />
        </div>

        <div className="form-group">
          <label>Party Size:</label>
          <input
            type="number"
            min="1"
            max="8"
            value={request.partySize}
            onChange={(e) =>
              setRequest((prev) => ({ ...prev, partySize: parseInt(e.target.value) }))
            }
          />
        </div>

        <div className="form-group">
          <label>Setting:</label>
          <select
            value={request.setting}
            onChange={(e) => setRequest((prev) => ({ ...prev, setting: e.target.value }))}
          >
            <option value="fantasy">Fantasy</option>
            <option value="urban">Urban</option>
            <option value="wilderness">Wilderness</option>
            <option value="dungeon">Dungeon</option>
            <option value="planar">Planar</option>
            <option value="underdark">Underdark</option>
          </select>
        </div>

        <div className="form-group">
          <label>Difficulty:</label>
          <select
            value={request.difficulty}
            onChange={(e) => setRequest((prev) => ({ ...prev, difficulty: e.target.value as any }))}
          >
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
            <option value="deadly">Deadly</option>
          </select>
          <small>{difficultyDescriptions[request.difficulty]}</small>
        </div>

        <div className="form-group">
          <label>Theme (optional):</label>
          <input
            type="text"
            placeholder="e.g., undead, bandits, elemental..."
            value={request.theme}
            onChange={(e) => setRequest((prev) => ({ ...prev, theme: e.target.value }))}
          />
        </div>

        <div className="form-group">
          <label>Environment (optional):</label>
          <input
            type="text"
            placeholder="e.g., ancient ruins, dense forest, tavern..."
            value={request.environment}
            onChange={(e) => setRequest((prev) => ({ ...prev, environment: e.target.value }))}
          />
        </div>

        <button className="generate-btn" onClick={handleGenerate} disabled={isGenerating}>
          {isGenerating ? "Generating Encounter..." : "Generate Encounter"}
        </button>
      </div>

      {error && (
        <div className="error-message">
          <strong>Error:</strong> {error}
        </div>
      )}

      {generatedEncounter && (
        <div className="generated-encounter">
          <div className="encounter-header">
            <h4>{generatedEncounter.title}</h4>
            <div className="encounter-meta">
              Level {request.playerLevel} • {request.partySize} players • {request.difficulty}
            </div>
          </div>

          <div className="encounter-description">
            <h5>Description</h5>
            <p>{generatedEncounter.description}</p>
          </div>

          {generatedEncounter.enemies.length > 0 && (
            <div className="encounter-enemies">
              <h5>Enemies</h5>
              <ul>
                {generatedEncounter.enemies.map((enemy, index) => (
                  <li key={index}>
                    <strong>
                      {enemy.count}x {enemy.name}
                    </strong>{" "}
                    (CR {enemy.cr})
                    {enemy.tactics && <div className="tactics">Tactics: {enemy.tactics}</div>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="encounter-environment">
            <h5>Environment</h5>
            <p>{generatedEncounter.environment.description}</p>
            {generatedEncounter.environment.features.length > 0 && (
              <div>
                <strong>Features:</strong>
                <ul>
                  {generatedEncounter.environment.features.map((feature, index) => (
                    <li key={index}>{feature}</li>
                  ))}
                </ul>
              </div>
            )}
            {generatedEncounter.environment.hazards &&
              generatedEncounter.environment.hazards.length > 0 && (
                <div>
                  <strong>Hazards:</strong>
                  <ul>
                    {generatedEncounter.environment.hazards.map((hazard, index) => (
                      <li key={index}>{hazard}</li>
                    ))}
                  </ul>
                </div>
              )}
          </div>

          <div className="encounter-rewards">
            <h5>Rewards</h5>
            <p>
              <strong>XP:</strong> {generatedEncounter.rewards.xp}
            </p>
            {generatedEncounter.rewards.treasure && (
              <p>
                <strong>Treasure:</strong> {generatedEncounter.rewards.treasure}
              </p>
            )}
            {generatedEncounter.rewards.items && generatedEncounter.rewards.items.length > 0 && (
              <div>
                <strong>Items:</strong>
                <ul>
                  {generatedEncounter.rewards.items.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {generatedEncounter.scalingNotes && (
            <div className="scaling-notes">
              <h5>Scaling Notes</h5>
              <p>{generatedEncounter.scalingNotes}</p>
            </div>
          )}

          <div className="encounter-actions">
            <button className="use-encounter-btn" onClick={handleUseEncounter}>
              Use This Encounter
            </button>
            <button className="regenerate-btn" onClick={handleGenerate} disabled={isGenerating}>
              Generate Another
            </button>
          </div>

          <div className="generation-meta">
            <small>
              Generated by {generatedEncounter.metadata.provider} •
              {generatedEncounter.metadata.latencyMs}ms • $
              {generatedEncounter.metadata.costUSD.toFixed(4)}
            </small>
          </div>
        </div>
      )}
    </div>
  );
};
