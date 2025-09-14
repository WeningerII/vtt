import React from "react";

export interface CharacterInventoryProps {
  inventory: any[];
  onUpdate?: (inventory: any[]) => void;
}

export default function CharacterInventory({ inventory, onUpdate }: CharacterInventoryProps) {
  const items = Array.isArray(inventory) ? inventory : [];
  return (
    <div className="bg-surface-elevated border border-border-subtle rounded-lg p-4">
      {items.length === 0 ? (
        <div className="text-sm text-text-secondary">No items in inventory</div>
      ) : (
        <ul className="list-disc pl-5 space-y-1 text-text-primary text-sm">
          {items.map((item, i) => (
            <li key={i}>{typeof item === 'string' ? item : JSON.stringify(item)}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
