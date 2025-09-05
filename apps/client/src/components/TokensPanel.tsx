/**
 * TokensPanel Component - Displays and manages tokens in the current scene
 * Essential UI for tabletop gameplay - allows users to view and interact with game pieces
 */
import React, { useState, useMemo } from 'react';
import { Token } from '../types/vtt';
import { Button } from './ui/Button';
import { Input } from './ui/Input';

// Mock lucide-react icons since module is not available
// import { Plus, Search, Settings, Trash2, Upload, Users, X } from "lucide-react";

const MockIcon = ({ className }: { className?: string }) => (
  <span className={className} style={{ display: 'inline-block', width: '1em', height: '1em' }}>🔷</span>
);

const Plus = MockIcon;
const Search = MockIcon;
const Settings = MockIcon;
const Trash2 = MockIcon;
const Upload = MockIcon;
const Users = MockIcon;
const X = MockIcon;
const Eye = MockIcon;
const EyeOff = MockIcon;
const Lock = MockIcon;
const Unlock = MockIcon;

interface TokensPanelProps {
  tokens: Token[];
  onTokenSelect?: (token: Token) => void;
  onTokenUpdate?: (token: Token) => void;
  onTokenDelete?: (tokenId: string) => void;
  onTokenAdd?: () => void;
  selectedTokenId?: string;
  isGM?: boolean;
}

export const TokensPanel: React.FC<TokensPanelProps> = ({
  tokens,
  onTokenSelect,
  onTokenUpdate,
  onTokenDelete,
  onTokenAdd,
  selectedTokenId,
  isGM = false
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showHidden, setShowHidden] = useState(false);

  // Filter tokens based on search and visibility
  const filteredTokens = useMemo(() => {
    return tokens.filter(token => {
      const matchesSearch = token.name.toLowerCase().includes(searchQuery.toLowerCase());
      const isVisible = showHidden || token.visible !== false;
      return matchesSearch && isVisible;
    });
  }, [tokens, searchQuery, showHidden]);

  const handleTokenVisibilityToggle = (token: Token) => {
    if (!isGM) {return;}
    const updatedToken = { ...token, visible: !token.visible };
    onTokenUpdate?.(updatedToken);
  };

  const handleTokenLockToggle = (token: Token) => {
    if (!isGM) {return;}
    const updatedToken = { ...token, locked: !token.locked };
    onTokenUpdate?.(updatedToken);
  };

  return (
    <div className="h-64 flex flex-col bg-surface-elevated border-b border-subtle">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-subtle">
        <h3 className="font-semibold text-white">Tokens ({filteredTokens.length})</h3>
        <div className="flex gap-2">
          {isGM && (
            <Button
              onClick={onTokenAdd}
            >
              <Plus className="w-4 h-4" />
              Add Token
            </Button>
          )}
        </div>
      </div>

      {/* Search and Filters */}
      <div className="p-3 space-y-2">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search tokens..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        {isGM && (
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setShowHidden(!showHidden)}
            >
              {showHidden ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
              {showHidden ? 'Hide Hidden' : 'Show Hidden'}
            </Button>
          </div>
        )}
      </div>

      {/* Token List */}
      <div className="flex-1 overflow-y-auto">
        {filteredTokens.length === 0 ? (
          <div className="p-4 text-center text-gray-400">
            {searchQuery ? 'No tokens match your search' : 'No tokens in scene'}
          </div>
        ) : (
          <div className="space-y-1 p-2">
            {filteredTokens.map(token => (
              <div
                key={token.id}
                className={`
                  flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors
                  ${selectedTokenId === token.id 
                    ? 'bg-primary-500/20 border border-primary-500/30' 
                    : 'hover:bg-white/5'
                  }
                  ${token.visible === false ? 'opacity-60' : ''}
                `}
                onClick={() => onTokenSelect?.(token)}
              >
                {/* Token Color/Avatar */}
                <div
                  className="w-8 h-8 rounded-full border-2 border-gray-600 flex-shrink-0"
                  style={{ backgroundColor: `#${token.color.toString(16).padStart(6, '0')}` }}
                />

                {/* Token Info */}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-white truncate">{token.name}</div>
                  <div className="text-xs text-gray-400">
                    ({Math.round(token.x)}, {Math.round(token.y)})
                    {token.stats?.hp !== undefined && (
                      <span className="ml-2">
                        HP: {token.stats.hp}/{token.stats.maxHp || '?'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Token Actions (GM Only) */}
                {isGM && (
                  <div className="flex gap-1">
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTokenVisibilityToggle(token);
                      }}
                      className="p-1"
                    >
                      {token.visible === false ? (
                        <EyeOff className="w-3 h-3" />
                      ) : (
                        <Eye className="w-3 h-3" />
                      )}
                    </Button>
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTokenLockToggle(token);
                      }}
                      className="p-1"
                    >
                      {token.locked ? (
                        <Lock className="w-3 h-3" />
                      ) : (
                        <Unlock className="w-3 h-3" />
                      )}
                    </Button>
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        onTokenDelete?.(token.id);
                      }}
                      className="p-1 text-red-400 hover:text-red-300"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TokensPanel;
