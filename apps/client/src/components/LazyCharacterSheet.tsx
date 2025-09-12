/**
 * Lazy Loading Character Sheet Component
 * Implements progressive loading and virtualization for heavy character data
 */

import React, { 
  memo, 
  lazy, 
  Suspense, 
  useState, 
  useEffect, 
  useCallback,
  useMemo 
} from 'react';
import { cn } from '../lib/utils';

// Lazy load character sheet sections
const CharacterInfo = lazy(() => import('./character/CharacterInfo'));
const CharacterStats = lazy(() => import('./character/CharacterStats'));
const CharacterSpells = lazy(() => import('./character/CharacterSpells'));
const CharacterInventory = lazy(() => import('./character/CharacterInventory'));
const CharacterNotes = lazy(() => import('./character/CharacterNotes'));

interface CharacterData {
  id: string;
  name: string;
  level: number;
  class: string;
  race: string;
  stats: Record<string, number>;
  spells: any[];
  inventory: any[];
  notes: string;
  portrait?: string;
}

interface LazyCharacterSheetProps {
  character: CharacterData;
  isActive: boolean;
  onUpdate?: (data: Partial<CharacterData>) => void;
  className?: string;
}

// Loading skeleton component
const CharacterSectionSkeleton = memo<{ height?: string }>(function CharacterSectionSkeleton({ 
  height = "h-32" 
}) {
  return (
    <div className={cn("animate-pulse bg-surface-elevated rounded-lg p-4", height)}>
      <div className="space-y-3">
        <div className="h-4 bg-surface-subtle rounded w-3/4"></div>
        <div className="h-3 bg-surface-subtle rounded w-1/2"></div>
        <div className="h-3 bg-surface-subtle rounded w-2/3"></div>
      </div>
    </div>
  );
});

// Section visibility hook for intersection observer
const useIntersectionObserver = (options: IntersectionObserverInit = {}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [element, setElement] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
      },
      {
        threshold: 0.1,
        rootMargin: '50px',
        ...options
      }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [element, options]);

  return { isVisible, setElement };
};

// Lazy section wrapper with intersection observer
const LazySection = memo<{
  children: React.ReactNode;
  fallback?: React.ReactNode;
  className?: string;
  minHeight?: string;
}>(function LazySection({ 
  children, 
  fallback = <CharacterSectionSkeleton />, 
  className,
  minHeight = "min-h-32"
}) {
  const { isVisible, setElement } = useIntersectionObserver({
    threshold: 0.1,
    rootMargin: '100px'
  });

  return (
    <div 
      ref={setElement} 
      className={cn("lazy-section", minHeight, className)}
    >
      {isVisible ? (
        <Suspense fallback={fallback}>
          {children}
        </Suspense>
      ) : (
        fallback
      )}
    </div>
  );
});

// Performance optimized character sheet with lazy loading
export const LazyCharacterSheet = memo<LazyCharacterSheetProps>(function LazyCharacterSheet({
  character,
  isActive,
  onUpdate,
  className
}) {
  const [activeTab, setActiveTab] = useState<string>('info');
  const [loadedSections, setLoadedSections] = useState<Set<string>>(new Set(['info']));

  // Preload critical sections when component becomes active
  useEffect(() => {
    if (isActive && !loadedSections.has('stats')) {
      setLoadedSections(prev => new Set([...prev, 'stats']));
    }
  }, [isActive, loadedSections]);

  // Progressive loading based on tab selection
  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab);
    setLoadedSections(prev => new Set([...prev, tab]));
  }, []);

  // Memoized character sections data
  const characterSections = useMemo(() => ({
    info: {
      id: 'info',
      label: 'Character',
      icon: '👤',
      data: {
        name: character.name,
        level: character.level,
        class: character.class,
        race: character.race,
        portrait: character.portrait
      }
    },
    stats: {
      id: 'stats',
      label: 'Stats',
      icon: '📊',
      data: character.stats
    },
    spells: {
      id: 'spells',
      label: 'Spells',
      icon: '✨',
      data: character.spells,
      count: character.spells?.length || 0
    },
    inventory: {
      id: 'inventory',
      label: 'Inventory',
      icon: '🎒',
      data: character.inventory,
      count: character.inventory?.length || 0
    },
    notes: {
      id: 'notes',
      label: 'Notes',
      icon: '📝',
      data: character.notes
    }
  }), [character]);

  const tabs = Object.values(characterSections);

  return (
    <div className={cn(
      "lazy-character-sheet flex flex-col h-full",
      "bg-surface-primary border border-border-subtle rounded-lg overflow-hidden",
      className
    )}>
      {/* Character Header */}
      <div className="character-header p-4 border-b border-border-subtle bg-surface-elevated">
        <div className="flex items-center gap-3">
          {character.portrait && (
            <img 
              src={character.portrait} 
              alt={`${character.name} portrait`}
              className="w-12 h-12 rounded-full object-cover"
              loading="lazy"
            />
          )}
          <div>
            <h2 className="text-lg font-semibold text-text-primary">{character.name}</h2>
            <p className="text-sm text-text-secondary">
              Level {character.level} {character.race} {character.class}
            </p>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="tab-navigation flex overflow-x-auto border-b border-border-subtle">
        {tabs.map((section) => (
          <button
            key={section.id}
            onClick={() => handleTabChange(section.id)}
            className={cn(
              "tab-button flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all",
              "border-b-2 border-transparent hover:bg-surface-hover",
              "whitespace-nowrap min-w-0 flex-shrink-0",
              activeTab === section.id && [
                "border-primary-500 text-primary-600 bg-surface-accent",
                "dark:text-primary-400"
              ]
            )}
            aria-selected={activeTab === section.id}
            role="tab"
          >
            <span className="text-base" role="img" aria-hidden="true">
              {section.icon}
            </span>
            <span>{section.label}</span>
            {'count' in section && section.count > 0 && (
              <span className={cn(
                "ml-1 px-2 py-0.5 text-xs rounded-full",
                "bg-surface-subtle text-text-secondary"
              )}>
                {section.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content Area with Lazy Loading */}
      <div className="character-content flex-1 overflow-hidden">
        <div className="h-full overflow-y-auto">
          {/* Character Info Section */}
          {activeTab === 'info' && (
            <LazySection className="p-4">
              <CharacterInfo 
                character={characterSections.info.data}
                onUpdate={(data) => onUpdate?.({ ...data })}
              />
            </LazySection>
          )}

          {/* Stats Section */}
          {activeTab === 'stats' && (
            <LazySection className="p-4" minHeight="min-h-48">
              <CharacterStats 
                stats={characterSections.stats.data}
                onUpdate={(stats) => onUpdate?.({ stats })}
              />
            </LazySection>
          )}

          {/* Spells Section */}
          {activeTab === 'spells' && (
            <LazySection className="p-4" minHeight="min-h-64">
              <CharacterSpells 
                spells={characterSections.spells.data}
                onUpdate={(spells) => onUpdate?.({ spells })}
              />
            </LazySection>  
          )}

          {/* Inventory Section */}
          {activeTab === 'inventory' && (
            <LazySection className="p-4" minHeight="min-h-64">
              <CharacterInventory 
                inventory={characterSections.inventory.data}
                onUpdate={(inventory) => onUpdate?.({ inventory })}
              />
            </LazySection>
          )}

          {/* Notes Section */}
          {activeTab === 'notes' && (
            <LazySection className="p-4" minHeight="min-h-40">
              <CharacterNotes 
                notes={characterSections.notes.data}
                onUpdate={(notes) => onUpdate?.({ notes })}
              />
            </LazySection>
          )}
        </div>
      </div>

      {/* Loading indicator for background operations */}
      {!isActive && (
        <div className="absolute inset-0 bg-surface-overlay/50 backdrop-blur-sm flex items-center justify-center pointer-events-none">
          <div className="text-sm text-text-secondary">Character sheet inactive</div>
        </div>
      )}
    </div>
  );
});

export default LazyCharacterSheet;
