import React, { useMemo } from 'react';
import SRDMonsters from "@vtt/content-5e-srd";
import { compileMonsters } from "@vtt/rules-5e";

export function MonsterBrowser() {
  const monsters = React.useMemo(() => compileMonsters(SRDMonsters), []);

  return (
    <div style={{ padding: 16, fontFamily: "system-ui, sans-serif" }}>
      <h2 style={{ margin: "8px 0" }}>SRD Monsters</h2>
      <div style={{ fontSize: 12, color: "#555", marginBottom: 12 }}>{monsters.length} entries</div>
      <div style={{ overflowX: "auto", border: "1px solid #eee", borderRadius: 8 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#fafafa", textAlign: "left" }}>
              <th style={th}>Name</th>
              <th style={th}>CR</th>
              <th style={th}>XP</th>
              <th style={th}>AC</th>
              <th style={th}>HP</th>
              <th style={th}>Speed</th>
              <th style={th}>Type</th>
              <th style={th}>Tags</th>
            </tr>
          </thead>
          <tbody>
            {monsters.map((m) => (
              <tr key={m.id} style={{ borderTop: "1px solid #f0f0f0" }}>
                <td style={td}>{m.name}</td>
                <td style={td}>{m.challengeRating}</td>
                <td style={td}>{m.xp}</td>
                <td style={td}>
                  {m.ac.value}
                  {m.ac.type ? ` (${m.ac.type})` : ""}
                </td>
                <td style={td}>
                  {m.hp.average}
                  {m.hp.formula ? ` (${m.hp.formula})` : ""}
                </td>
                <td style={td}>{formatSpeed(m.speed)}</td>
                <td style={td}>{m.type}</td>
                <td style={td}>{(m.tags ?? []).join(", ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const th: React.CSSProperties = { padding: "8px 10px", borderBottom: "1px solid #eee" };
const td: React.CSSProperties = { padding: "8px 10px", verticalAlign: "top" };

function formatSpeed(_speed: Record<string, unknown> | undefined) {
  const entries = Object.entries(_speed || {}).filter(([, v]) => typeof v === "number") as [
    string,
    number,
  ][];
  if (!entries.length) {return "-";}
  return entries
    .map(([k, v]) => `${k.replace(/^[a-z]/, (c) => c.toUpperCase())} ${v} ft.`)
    .join(", ");
}

export default MonsterBrowser;
