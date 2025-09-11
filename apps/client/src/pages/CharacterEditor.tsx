/**
 * Character Editor Page - Character creation and management interface
 */

import React, { useState } from "react";
import { useRouter } from "../components/Router";
import { CharacterSheet, type Character } from "../components/character/CharacterSheet";
import { Button } from "../components/ui/Button";
import { ArrowLeft, Users, Plus } from "lucide-react";

export function CharacterEditor() {
  const { navigate, params } = useRouter();
  const characterId = params?.characterId;
  const [character, setCharacter] = useState<Character | null>(null);

  const handleCharacterUpdate = (_updatedCharacter: Character) => {
    setCharacter(character);
  };

  const handleBackToDashboard = () => {
    navigate("/dashboard");
  };

  const handleViewInSession = () => {
    // Navigate to a game session where this character can be used
    navigate("/session/demo");
  };

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Header */}
      <div className="bg-bg-secondary border-b border-border-primary">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBackToDashboard}
                leftIcon={<ArrowLeft className="h-4 w-4" />}
              >
                Back to Dashboard
              </Button>
              <div className="h-6 w-px bg-border-primary" />
              <h1 className="text-xl font-semibold text-text-primary">
                {characterId ? "Edit Character" : "Create Character"}
              </h1>
            </div>

            <div className="flex items-center gap-2">
              {character && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate("/characters")}
                    leftIcon={<Users className="h-4 w-4" />}
                  >
                    My Characters
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleViewInSession}
                    leftIcon={<Plus className="h-4 w-4" />}
                  >
                    Use in Session
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Character Sheet */}
      <div className="max-w-7xl mx-auto p-4">
        {characterId ? (
          <CharacterSheet
            characterId={characterId}
            onCharacterUpdate={handleCharacterUpdate}
            className="min-h-[calc(100vh-8rem)]"
          />
        ) : (
          <div className="text-center py-8">
            <div className="text-text-secondary text-lg mb-2">No Character Selected</div>
            <p className="text-text-tertiary text-sm mb-4">
              Please select a character to edit or create a new character.
            </p>
            <Button variant="primary" onClick={() => navigate("/characters")}>
              Browse Characters
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
