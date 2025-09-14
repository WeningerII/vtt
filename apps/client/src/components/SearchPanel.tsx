/**
 * SearchPanel Component - Global search functionality for VTT content
 * Provides search across tokens, maps, assets, and other game content
 */
import React, { useState, useMemo, useCallback } from 'react';
import { Search, X, Filter, Grid, List } from 'lucide-react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';

export interface SearchResult {
  id: string;
  type: 'token' | 'map' | 'asset' | 'scene' | 'character';
  title: string;
  description?: string;
  thumbnail?: string;
  metadata?: Record<string, any>;
}

interface SearchPanelProps {
  onResultSelect?: (result: SearchResult) => void;
  searchScope?: ('token' | 'map' | 'asset' | 'scene' | 'character')[];
  placeholder?: string;
  maxResults?: number;
}

export const SearchPanel: React.FC<SearchPanelProps> = ({
  onResultSelect,
  searchScope = ['token', 'map', 'asset', 'scene', 'character'],
  placeholder = "Search tokens, maps, assets...",
  maxResults = 20
}) => {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedFilters, setSelectedFilters] = useState<Set<string>>(new Set(searchScope));
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');

  // Mock search function - in real app this would call an API
  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Mock results based on query
    const mockResults: SearchResult[] = [
      {
        id: '1',
        type: 'token' as const,
        title: `Token: ${searchQuery}`,
        description: 'A game token matching your search',
        thumbnail: '/assets/tokens/placeholder.png'
      },
      {
        id: '2',
        type: 'map' as const,
        title: `Map: ${searchQuery} Dungeon`,
        description: 'A dungeon map for your campaign',
        thumbnail: '/assets/maps/placeholder.png'
      },
      {
        id: '3',
        type: 'asset' as const,
        title: `Asset: ${searchQuery} Resource`,
        description: 'Game asset resource',
        thumbnail: '/assets/misc/placeholder.png'
      }
    ].filter(result => selectedFilters.has(result.type))
     .slice(0, maxResults);

    setResults(mockResults);
    setIsSearching(false);
  }, [selectedFilters, maxResults]);

  // Debounced search
  const debouncedSearch = useMemo(() => {
    let timeoutId: NodeJS.Timeout;
    return (query: string) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => performSearch(query), 300);
    };
  }, [performSearch]);

  const handleQueryChange = (newQuery: string) => {
    setQuery(newQuery);
    debouncedSearch(newQuery);
  };

  const handleClearSearch = () => {
    setQuery('');
    setResults([]);
  };

  const handleResultClick = (result: SearchResult) => {
    onResultSelect?.(result);
  };

  const toggleFilter = (filter: string) => {
    const newFilters = new Set(selectedFilters);
    if (newFilters.has(filter)) {
      newFilters.delete(filter);
    } else {
      newFilters.add(filter);
    }
    setSelectedFilters(newFilters);
    
    // Re-run search with new filters
    if (query.trim()) {
      performSearch(query);
    }
  };

  const filterLabels = {
    token: 'Tokens',
    map: 'Maps',
    asset: 'Assets',
    scene: 'Scenes',
    character: 'Characters'
  };

  return (
    <div className="flex flex-col h-full bg-surface-elevated">
      {/* Search Header */}
      <div className="p-4 border-b border-subtle">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <Input
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder={placeholder}
            className="pl-10 pr-10"
            data-testid="search-input"
          />
          {query && (
            <button
              onClick={handleClearSearch}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Search Filters */}
        <div className="flex flex-wrap gap-2 mt-3">
          {searchScope.map(filter => (
            <Button
              key={filter}
              onClick={() => toggleFilter(filter)}
              variant={selectedFilters.has(filter) ? 'primary' : 'secondary'}
              size="sm"
            >
              {filterLabels[filter]}
            </Button>
          ))}
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center justify-between mt-3">
          <span className="text-sm text-gray-400">
            {results.length} results
          </span>
          <div className="flex gap-1">
            <Button
              onClick={() => setViewMode('list')}
              variant={viewMode === 'list' ? 'primary' : 'secondary'}
              size="sm"
            >
              <List className="w-4 h-4" />
            </Button>
            <Button
              onClick={() => setViewMode('grid')}
              variant={viewMode === 'grid' ? 'primary' : 'secondary'}
              size="sm"
            >
              <Grid className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Search Results */}
      <div className="flex-1 overflow-y-auto" data-testid="search-results">
        {isSearching ? (
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
            <span className="ml-2 text-gray-400">Searching...</span>
          </div>
        ) : query && results.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-gray-400">
            <Search className="w-8 h-8 mb-2 opacity-50" />
            <p>No results found</p>
            <p className="text-sm">Try adjusting your search terms or filters</p>
          </div>
        ) : results.length > 0 ? (
          <div className={`p-4 ${viewMode === 'grid' ? 'grid grid-cols-2 gap-4' : 'space-y-2'}`}>
            {results.map(result => (
              <div
                key={result.id}
                onClick={() => handleResultClick(result)}
                className={`
                  cursor-pointer rounded-lg border border-subtle bg-white/5 
                  hover:bg-white/10 transition-colors p-3
                  ${viewMode === 'grid' ? 'text-center' : 'flex items-center gap-3'}
                `}
              >
                {result.thumbnail && (
                  <img
                    src={result.thumbnail}
                    alt={result.title}
                    className={`
                      bg-gray-700 border border-gray-600 rounded
                      ${viewMode === 'grid' ? 'w-full h-24 object-cover mb-2' : 'w-12 h-12 object-cover flex-shrink-0'}
                    `}
                  />
                )}
                <div className={`${viewMode === 'grid' ? '' : 'flex-1 min-w-0'}`}>
                  <div className="font-medium text-white truncate">{result.title}</div>
                  {result.description && (
                    <div className="text-sm text-gray-400 truncate">{result.description}</div>
                  )}
                  <div className="text-xs text-gray-500 capitalize mt-1">
                    {result.type}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-8 text-gray-400">
            <Search className="w-8 h-8 mb-2 opacity-50" />
            <p>Start typing to search</p>
            <p className="text-sm">Search across tokens, maps, assets, and more</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchPanel;
