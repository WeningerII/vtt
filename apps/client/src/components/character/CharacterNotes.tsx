import React from "react";

export interface CharacterNotesProps {
  notes: string;
  onUpdate?: (notes: string) => void;
}

export default function CharacterNotes({ notes, onUpdate }: CharacterNotesProps) {
  return (
    <div className="bg-surface-elevated border border-border-subtle rounded-lg p-4">
      <textarea
        className="w-full min-h-40 bg-surface-subtle border border-border-subtle rounded-lg p-3 text-sm text-text-primary"
        value={notes || ""}
        onChange={(e) => onUpdate?.(e.target.value)}
        placeholder="Write your character notes here..."
      />
    </div>
  );
}
