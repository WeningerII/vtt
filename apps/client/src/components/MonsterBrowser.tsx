/**
 * Enhanced Monster Browser - Integrated with real monster data and combat system
 */

import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { logger } from '@vtt/logging';
import { CombatActor } from '../hooks/useEncounter';

interface Monster {
  id: string;
  name: string;
  source: string;
  statblock: {
    size: string;
    type: string;
    armorClass: number;
    hitPoints: number;
    speed: Record<string, number>;
    abilities: {
      STR: number;
      DEX: number;
      CON: number;
      INT: number;
      WIS: number;
      CHA: number;
    };
    challengeRating: string;
    actions: Array<{
      name: string;
      description: string;
      attackBonus?: number;
      damage?: any;
    }>;
    skills?: Record<string, number>;
    senses?: Record<string, number>;
    languages?: string[];
    conditionImmunities?: string[];
    damageResistances?: string[];
    damageImmunities?: string[];
  };
  tags: string[];
}

interface MonsterBrowserProps {
  onSelectMonster?: (monster: Monster) => void;
  onAddToEncounter?: (_monsterId: string, _instanceName?: string) => void;
  encounterId?: string;
  multiSelect?: boolean;
  showActions?: boolean;
}

export const MonsterBrowser: React.FC<MonsterBrowserProps> = memo(({onSelectMonster, onAddToEncounter, encounterId, multiSelect = false, showActions = true}) => {
  const [monsters, setMonsters] = useState<Monster[]>([]);

  // Selection handling
  const handleToggleSelect = useCallback((monsterId: string) => {
    if (multiSelect) {
      setSelectedMonsters(prev => {
        const newSet = new Set(prev);
        if (newSet.has(monsterId)) {
          newSet.delete(monsterId);
        } else {
          newSet.add(monsterId);
        }
        return newSet;
      });
    }
  }, [multiSelect]);
  const [filteredMonsters, setFilteredMonsters] = useState<Monster[]>([]);
  const [selectedMonsters, setSelectedMonsters] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [crFilter, setCrFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [sizeFilter, setSizeFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);

  // Load monsters
  useEffect(() => {
    loadMonsters();
  }, []);

  // Apply filters
  useEffect(() => {
    let filtered = monsters;

    if (searchTerm) {
      filtered = filtered.filter(monster =>
        monster.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        monster.statblock.type.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (crFilter) {
      filtered = filtered.filter(monster => monster.statblock.challengeRating === crFilter);
    }

    if (typeFilter) {
      filtered = filtered.filter(monster => monster.statblock.type === typeFilter);
    }

    if (sizeFilter) {
      filtered = filtered.filter(monster => monster.statblock.size === sizeFilter);
    }

    if (sourceFilter) {
      filtered = filtered.filter(monster => monster.source === sourceFilter);
    }

    setFilteredMonsters(filtered);
    setCurrentPage(1);
  }, [monsters, searchTerm, crFilter, typeFilter, sizeFilter, sourceFilter]);

  const loadMonsters = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/monsters');
      if (!response.ok) {
        throw new Error('Failed to load monsters');
      }

      const data = await response.json();
      setMonsters(data.monsters || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSelectMonster = useCallback((monster: Monster) => {
    if (multiSelect) {
      setSelectedMonsters(prev => {
        const newSet = new Set(prev);
        if (newSet.has(monster.id)) {
          newSet.delete(monster.id);
        } else {
          newSet.add(monster.id);
        }
        return newSet;
      });
    } else {
      setSelectedMonsters(new Set([monster.id]));
    }

    if (onSelectMonster) {
      onSelectMonster(monster);
    }
  }, [multiSelect, onSelectMonster]);

  const handleAddToEncounter = useCallback(async (monster: Monster) => {
    if (!onAddToEncounter) {return;}

    const instanceName = prompt(`Instance name for ${monster.name}:`, monster.name);
    if (instanceName !== null) {
      try {
        await onAddToEncounter(monster.id, instanceName);
      } catch (error) {
        logger.error('Failed to add monster to encounter:', error as any);
        alert('Failed to add monster to encounter');
      }
    }
  }, [onAddToEncounter]);

  const getCRColor = (cr: string): string => {
    const parts = cr.split('/');
    const numericCR = parts.length === 2 ? parseFloat(parts[0]!) / parseFloat(parts[1]!) : parseFloat(cr);
    
    if (numericCR < 1) {return '#28a745';} // Green for easy
    if (numericCR < 5) {return '#ffc107';} // Yellow for moderate  
    if (numericCR < 10) {return '#fd7e14';} // Orange for hard
    return '#dc3545'; // Red for deadly
  };

  const getAbilityModifier = (score: number): number => {
    return Math.floor((score - 10) / 2);
  };

  // Get unique values for filters (memoized for performance)
  const uniqueCRs = useMemo(() => [...new Set(monsters.map(m => m.statblock.challengeRating))].sort(), [monsters]);
  const uniqueTypes = useMemo(() => [...new Set(monsters.map(m => m.statblock.type))].sort(), [monsters]);
  const uniqueSizes = useMemo(() => [...new Set(monsters.map(m => m.statblock.size))].sort(), [monsters]);
  const uniqueSources = useMemo(() => [...new Set(monsters.map(m => m.source))].sort(), [monsters]);

  // Pagination (memoized for performance)
  const paginationData = useMemo(() => {
    const totalPages = Math.ceil(filteredMonsters.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedMonsters = filteredMonsters.slice(startIndex, startIndex + itemsPerPage);
    return { totalPages, paginatedMonsters };
  }, [filteredMonsters, currentPage, itemsPerPage]);

  const { totalPages, paginatedMonsters } = paginationData;

  if (loading) {
    return <div className="monster-browser loading">Loading monsters...</div>;
  }

  if (error) {
    return (
      <div className="monster-browser error">
        <p>Error: {error}</p>
        <button onClick={loadMonsters} >Retry</button>
      </div>
    );
  }

  return (
    <div className="monster-browser">
      <div className="monster-browser-header">
        <h3>Monster Library</h3>
        <div className="monster-stats">
          <span>{filteredMonsters.length} of {monsters.length} monsters</span>
          {selectedMonsters.size > 0 && (
            <span className="selected-count">({selectedMonsters.size} selected)</span>
          )}
        </div>
      </div>

      <div className="monster-filters">
        <div className="filter-row">
          <input
            type="text"
            placeholder="Search monsters..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          <button 
            onClick={() => {
              setSearchTerm('');
              setCrFilter('');
              setTypeFilter('');
              setSizeFilter('');
              setSourceFilter('');
            }}
          >
            Clear Filters
          </button>
        </div>

        <div className="filter-row">
          <select value={crFilter} onChange={(e) => setCrFilter(e.target.value)}>
            <option value="">All CR</option>
            {uniqueCRs.map(cr => (
              <option key={cr} value={cr}>CR {cr}</option>
            ))}
          </select>

          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="">All Types</option>
            {uniqueTypes.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>

          <select value={sizeFilter} onChange={(e) => setSizeFilter(e.target.value)}>
            <option value="">All Sizes</option>
            {uniqueSizes.map(size => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>

          <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
            <option value="">All Sources</option>
            {uniqueSources.map(source => (
              <option key={source} value={source}>{source}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="monster-grid">
        {paginatedMonsters.map(monster => (
          <div 
            key={monster.id}
            className={`monster-card ${selectedMonsters.has(monster.id) ? 'selected' : ''}`}  role="button" onClick={() => handleSelectMonster(monster)}
          >
            <div className="monster-card-header">
              <h4 className="monster-name">{monster.name}</h4>
              <div className="monster-badges">
                <span 
                  className="cr-badge"
                  style={{ backgroundColor: getCRColor(monster.statblock.challengeRating) }}
                >
                  CR {monster.statblock.challengeRating}
                </span>
                <span className="size-type-badge">
                  {monster.statblock.size} {monster.statblock.type}
                </span>
              </div>
            </div>

            <div className="monster-stats-grid">
              <div className="stat-block">
                <span className="stat-label">AC</span>
                <span className="stat-value">{monster.statblock.armorClass}</span>
              </div>
              <div className="stat-block">
                <span className="stat-label">HP</span>
                <span className="stat-value">{monster.statblock.hitPoints}</span>
              </div>
              <div className="stat-block">
                <span className="stat-label">Speed</span>
                <span className="stat-value">
                  {Object.entries(monster.statblock.speed)
                    .map(([type, value]) => `${type} ${value}ft`)
                    .join(', ')}
                </span>
              </div>
            </div>

            <div className="ability-scores">
              <div className="ability">
                <span className="ability-label">STR</span>
                <span className="ability-score">
                  {monster.statblock.abilities.STR} ({getAbilityModifier(monster.statblock.abilities.STR) >= 0 ? '+' : ''}{getAbilityModifier(monster.statblock.abilities.STR)})
                </span>
              </div>
              <div className="ability">
                <span className="ability-label">DEX</span>
                <span className="ability-score">
                  {monster.statblock.abilities.DEX} ({getAbilityModifier(monster.statblock.abilities.DEX) >= 0 ? '+' : ''}{getAbilityModifier(monster.statblock.abilities.DEX)})
                </span>
              </div>
              <div className="ability">
                <span className="ability-label">CON</span>
                <span className="ability-score">
                  {monster.statblock.abilities.CON} ({getAbilityModifier(monster.statblock.abilities.CON) >= 0 ? '+' : ''}{getAbilityModifier(monster.statblock.abilities.CON)})
                </span>
              </div>
            </div>

            {showActions && monster.statblock.actions.length > 0 && (
              <div className="monster-actions">
                <h5>Actions</h5>
                <div className="action-list">
                  {monster.statblock.actions.slice(0, 2).map((action, idx) => (
                    <div key={idx} className="action-item">
                      <span className="action-name">{action.name}</span>
                      {action.attackBonus && (
                        <span className="attack-bonus">+{action.attackBonus}</span>
                      )}
                    </div>
                  ))}
                  {monster.statblock.actions.length > 2 && (
                    <div className="action-item more-actions">
                      +{monster.statblock.actions.length - 2} more
                    </div>
                  )}
                </div>
              </div>
            )}

            {monster.statblock.conditionImmunities && monster.statblock.conditionImmunities.length > 0 && (
              <div className="immunities">
                <span className="immunity-label">Immunities:</span>
                <span className="immunity-list">
                  {monster.statblock.conditionImmunities.join(', ')}
                </span>
              </div>
            )}

            {showActions && onAddToEncounter && encounterId && (
              <div className="monster-actions-row">
                <button 
                  className="add-to-encounter-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAddToEncounter(monster);
                  }}
                >
                  Add to Encounter
                </button>
              </div>
            )}

            <div className="monster-source">
              <small>Source: {monster.source}</small>
            </div>
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="pagination">
          <button 
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(prev => prev - 1)}
            >
            Previous
          </button>
          
          <span className="page-info">
            Page {currentPage} of {totalPages} ({filteredMonsters.length} monsters)
          </span>
          
          <button 
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(prev => prev + 1)}
            >
            Next
          </button>
        </div>
      )}

      {multiSelect && selectedMonsters.size > 0 && onAddToEncounter && encounterId && (
        <div className="bulk-actions">
          <button 
            className="bulk-add-btn"
            aria-label="Add selected monsters to encounter"
            tabIndex={0}
            onClick={async () => {
              for (const monsterId of selectedMonsters) {
                const monster = monsters.find(m => m.id === monsterId);
                if (monster && onAddToEncounter) {
                  await onAddToEncounter(monsterId, monster.name);
                }
              }
              setSelectedMonsters(new Set());
            }}
          >
            Add Selected to Encounter ({selectedMonsters.size})
          </button>
        </div>
      )}
    </div>
  );
});

export default MonsterBrowser;
