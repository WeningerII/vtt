import React from "react";

export interface CharacterInfoData {
  name: string;
  level: number;
  class: string;
  race: string;
  portrait?: string;
}

export default function CharacterInfo({
  character,
  onUpdate,
}: {
  character: CharacterInfoData;
  onUpdate?: (data: Partial<CharacterInfoData>) => void;
}) {
  return (
    <div className="bg-surface-elevated border border-border-subtle rounded-lg p-4">
      <div className="flex items-center gap-3">
        {character.portrait && (
          <img
            src={character.portrait}
            alt={`${character.name} portrait`}
            className="w-12 h-12 rounded-full object-cover"
          />
        )}
        <div>
          <div className="text-lg font-semibold text-text-primary">{character.name}</div>
          <div className="text-sm text-text-secondary">
            Level {character.level} {character.race} {character.class}
          </div>
        </div>
      </div>
    </div>
  );
}
