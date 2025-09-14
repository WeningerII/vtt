import React from "react";

export default function CharacterStats({
  stats,
  onUpdate,
}: {
  stats: Record<string, number>;
  onUpdate?: (stats: Record<string, number>) => void;
}) {
  const entries = Object.entries(stats || {});
  return (
    <div className="bg-surface-elevated border border-border-subtle rounded-lg p-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {entries.length === 0 && (
          <div className="text-sm text-text-secondary">No stats available</div>
        )}
        {entries.map(([key, value]) => (
          <div key={key} className="flex items-center justify-between bg-surface-subtle rounded px-3 py-2">
            <span className="text-sm text-text-secondary capitalize">{key}</span>
            <span className="text-text-primary font-semibold">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
