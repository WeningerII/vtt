/**
 * Combat Assistant - AI-powered tactical guidance system
 */

import React, { useState, useEffect } from "react";
import { logger } from "@vtt/logging";
import { useWebSocket } from "../../providers/WebSocketProvider";
import { toErrorObject } from "../../utils/error-utils";
import { 
  Sword, 
  Shield, 
  Target, 
  Brain, 
  Zap, 
  Map, 
  Users, 
  AlertTriangle 
} from "lucide-react";

interface TacticalRecommendation {
  action: string;
  target?: string;
  position?: { x: number; y: number };
  reasoning: string;
  confidence: number;
  tacticalValue: number;
}

interface CombatAssistantProps {
  character: any;
  allies: any[];
  enemies: any[];
  battlefield: any;
  isActive: boolean;
}

export const CombatAssistant: React.FC<CombatAssistantProps> = ({
  character,
  allies,
  enemies,
  battlefield,
  isActive,
}) => {
  const [recommendation, setRecommendation] = useState<TacticalRecommendation | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [positioningMode, setPositioningMode] = useState(false);
  const [positions, setPositions] = useState<any[]>([]);

  const { send: sendWebSocket } = useWebSocket();

  const getTacticalRecommendation = async () => {
    setIsAnalyzing(true);
    try {
      const response = await fetch("/api/v1/combat/tactical-decision", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          character,
          allies,
          enemies,
          battlefield,
          objectives: ["Survive encounter", "Defeat enemies"],
        }),
      });

      const result = await response.json();
      if (result.success) {
        setRecommendation(result.data);
      }
    } catch (error) {
      logger.error("Failed to analyze threats:", toErrorObject(error));
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getPositioning = async () => {
    try {
      const response = await fetch("/api/v1/combat/positioning", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          character,
          battlefield,
          allies,
          enemies,
        }),
      });

      const result = await response.json();
      if (result.success) {
        setPositions(result.data);
      }
    } catch (error) {
      logger.error("Failed to get positioning guidance:", toErrorObject(error));
    }
  };

  const simulateCombat = async () => {
    try {
      const response = await fetch("/api/v1/combat/simulate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getToken("token")}`,
        },
        body: JSON.stringify({
          party: [character, ...allies],
          enemies,
          battlefield,
          maxRounds: 10,
        }),
      });

      const result = await response.json();
      if (result.success) {
        // Show simulation results
        logger.info("Combat simulation:", result.data);
      }
    } catch (error) {
      logger.error("Combat simulation failed:", error);
    }
  };

  if (!isActive) {
    return (
      <div className="bg-gray-800 rounded-lg p-4 opacity-50">
        <div className="flex items-center gap-2 text-gray-400">
          <Brain className="w-5 h-5" />
          <span>Combat Assistant (Inactive)</span>
        </div>
        <p className="text-sm text-gray-500 mt-2">Start combat to enable AI tactical assistance</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-white">
          <Brain className="w-5 h-5 text-purple-400" />
          <span className="font-semibold">Combat Assistant</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={getTacticalRecommendation}
            disabled={isAnalyzing}
            className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded transition-colors"
            aria-label="{isanalyzing ? 'analyzing...' : 'get advice'}"
          >
            {isAnalyzing ? "Analyzing..." : "Get Advice"}
          </button>
          <button
            onClick={() => setPositioningMode(!positioningMode)}
            className={`px-3 py-1 text-sm rounded transition-colors ${
              positioningMode
                ? "bg-blue-600 text-white"
                : "bg-gray-700 hover:bg-gray-600 text-gray-300"
            }`}
          >
            <Map className="w-4 h-4" />
          </button>
        </div>
      </div>

      {recommendation && (
        <div className="bg-gray-700 rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-white font-medium">AI Recommendation</span>
            <div className="flex items-center gap-1 text-sm">
              <div
                className={`w-2 h-2 rounded-full ${
                  recommendation.confidence > 0.8
                    ? "bg-green-400"
                    : recommendation.confidence > 0.6
                      ? "bg-yellow-400"
                      : "bg-red-400"
                }`}
              />
              <span className="text-gray-400">{Math.round(recommendation.confidence * 100)}%</span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-lg font-medium text-white">
            <ActionIcon action={recommendation.action} />
            <span className="capitalize">{recommendation.action}</span>
            {recommendation.target && (
              <span className="text-gray-300">→ {recommendation.target}</span>
            )}
          </div>

          <p className="text-gray-300 text-sm">{recommendation.reasoning}</p>

          <div className="flex items-center gap-4 text-xs text-gray-400">
            <div className="flex items-center gap-1">
              <Target className="w-3 h-3" />
              <span>Value: {recommendation.tacticalValue}/10</span>
            </div>
          </div>
        </div>
      )}

      {positioningMode && (
        <div className="bg-gray-700 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-3">
            <Map className="w-4 h-4 text-blue-400" />
            <span className="text-white font-medium">Positioning Analysis</span>
            <button
              onClick={getPositioning}
              className="ml-auto px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded"
              aria-label="analyze"
            >
              Analyze
            </button>
          </div>

          {positions.length > 0 && (
            <div className="space-y-2">
              {positions.slice(0, 3).map((pos, index) => (
                <div key={index} className="bg-gray-600 rounded p-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-white text-sm font-medium">Position {index + 1}</span>
                    <span className="text-xs text-gray-300">Value: {pos.tacticalValue}/10</span>
                  </div>
                  <p className="text-xs text-gray-300">{pos.reasoning}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={simulateCombat}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded transition-colors"
          aria-label="Click button"
        >
          <Zap className="w-4 h-4" />
          Simulate
        </button>
        <button
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded transition-colors"
          aria-label="Click button"
        >
          <Users className="w-4 h-4" />
          Team Up
        </button>
      </div>
    </div>
  );
};

const ActionIcon: React.FC<{ action: string }> = ({ action }) => {
  switch (action) {
    case "attack":
      return <Sword className="w-5 h-5 text-red-400" />;
    case "spell":
      return <Zap className="w-5 h-5 text-purple-400" />;
    case "dodge":
      return <Shield className="w-5 h-5 text-blue-400" />;
    case "move":
      return <Map className="w-5 h-5 text-green-400" />;
    default:
      return <Target className="w-5 h-5 text-gray-400" />;
  }
};

export default CombatAssistant;
