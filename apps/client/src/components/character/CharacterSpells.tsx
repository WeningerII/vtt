import React from "react";

export interface CharacterSpellsProps {
  spells: any[];
  onUpdate?: (spells: any[]) => void;
}

export default function CharacterSpells({ spells, onUpdate }: CharacterSpellsProps) {
  const list = Array.isArray(spells) ? spells : [];
  return (
    <div className="bg-surface-elevated border border-border-subtle rounded-lg p-4">
      <div className="space-y-2">
        {list.length === 0 ? (
          <div className="text-sm text-text-secondary">No spells known</div>
        ) : (
          <ul className="list-disc pl-5 space-y-1 text-text-primary text-sm">
            {list.map((s, i) => (
              <li key={i}>{typeof s === 'string' ? s : JSON.stringify(s)}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
