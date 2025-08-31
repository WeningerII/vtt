/**
 * VTT Tokens Panel Component
 * Displays tokens in the current scene
 */

import React from 'react';
import { Scene } from '../SceneCanvas';

interface TokensPanelProps {
  tokens: Scene['tokens'];
}

interface TokenItemProps {
  token: Scene['tokens'][0];
}

const TokenItem: React.FC<TokenItemProps> = ({ token }) => (
  <div
    key={token.id}
    className="flex items-center justify-between p-2 bg-gray-700 rounded hover:bg-gray-600 transition-colors"
  >
    <span className="text-sm font-medium">{token.name}</span>
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-400">
        ({token.x}, {token.y})
      </span>
      <div
        className="w-4 h-4 rounded-full border border-gray-500"
        style={{
          backgroundColor: `#${token.color?.toString(16).padStart(6, "0") || "666666"}`,
        }}
        aria-label={`${token.name} token color`}
      />
    </div>
  </div>
);

export const TokensPanel: React.FC<TokensPanelProps> = ({ tokens }) => {
  return (
    <div className="p-4 border-b border-gray-700">
      <h3 className="font-semibold mb-3 text-lg">Tokens ({tokens.length})</h3>
      {tokens.length === 0 ? (
        <p className="text-sm text-gray-400 italic">No tokens in scene</p>
      ) : (
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {tokens.map((token) => (
            <TokenItem key={token.id} token={token} />
          ))}
        </div>
      )}
    </div>
  );
};
