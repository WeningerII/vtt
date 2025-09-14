/**
 * AssetLibrary Component - Browse and manage game assets
 * Provides access to tokens, maps, music, and other game resources
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Upload, 
  Search, 
  Filter, 
  Grid, 
  List, 
  Download,
  Trash2,
  Eye,
  Music,
  Image,
  FileText,
  Package
} from 'lucide-react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';

export interface Asset {
  id: string;
  name: string;
  type: 'token' | 'map' | 'audio' | 'image' | 'document' | 'misc';
  url: string;
  thumbnail?: string;
  size: number;
  createdAt: Date;
  tags: string[];
  description?: string;
}

interface AssetLibraryProps {
  onAssetSelect?: (asset: Asset) => void;
  onAssetUpload?: (files: FileList) => void;
  onAssetDelete?: (assetId: string) => void;
  allowedTypes?: Asset['type'][];
  isGM?: boolean;
}

export const AssetLibrary: React.FC<AssetLibraryProps> = ({
  onAssetSelect,
  onAssetUpload,
  onAssetDelete,
  allowedTypes = ['token', 'map', 'audio', 'image', 'document', 'misc'],
  isGM = false
}) => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<Set<Asset['type']>>(new Set(allowedTypes));
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedAsset, setSelectedAsset] = useState<string | null>(null);

  // Mock assets data
  useEffect(() => {
    const mockAssets: Asset[] = [
      {
        id: '1',
        name: 'Orc Warrior Token',
        type: 'token',
        url: '/assets/tokens/orc-warrior.png',
        thumbnail: '/assets/tokens/orc-warrior-thumb.png',
        size: 45672,
        createdAt: new Date('2024-01-15'),
        tags: ['orc', 'warrior', 'enemy'],
        description: 'Fierce orc warrior token for combat encounters'
      },
      {
        id: '2',
        name: 'Dungeon Map',
        type: 'map',
        url: '/assets/maps/dungeon-level-1.jpg',
        thumbnail: '/assets/maps/dungeon-level-1-thumb.jpg',
        size: 256780,
        createdAt: new Date('2024-01-10'),
        tags: ['dungeon', 'underground', 'level1'],
        description: 'First level of the ancient dungeon complex'
      },
      {
        id: '3',
        name: 'Battle Music',
        type: 'audio',
        url: '/assets/audio/epic-battle.mp3',
        size: 512340,
        createdAt: new Date('2024-01-08'),
        tags: ['battle', 'epic', 'background'],
        description: 'Epic orchestral battle music'
      },
      {
        id: '4',
        name: 'Castle Artwork',
        type: 'image',
        url: '/assets/images/medieval-castle.jpg',
        thumbnail: '/assets/images/medieval-castle-thumb.jpg',
        size: 189234,
        createdAt: new Date('2024-01-05'),
        tags: ['castle', 'medieval', 'architecture'],
        description: 'Medieval castle reference artwork'
      }
    ];

    // Simulate loading delay
    setTimeout(() => {
      setAssets(mockAssets);
      setIsLoading(false);
    }, 500);
  }, []);

  // Filter assets based on search and type filters
  const filteredAssets = useMemo(() => {
    return assets.filter(asset => {
      const matchesSearch = asset.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           asset.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesType = selectedTypes.has(asset.type);
      return matchesSearch && matchesType;
    });
  }, [assets, searchQuery, selectedTypes]);

  const handleAssetClick = useCallback((asset: Asset) => {
    setSelectedAsset(asset.id);
    onAssetSelect?.(asset);
  }, [onAssetSelect]);

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      onAssetUpload?.(files);
    }
  }, [onAssetUpload]);

  const handleAssetDelete = useCallback((assetId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    onAssetDelete?.(assetId);
    setAssets(prev => prev.filter(asset => asset.id !== assetId));
  }, [onAssetDelete]);

  const toggleTypeFilter = (type: Asset['type']) => {
    const newTypes = new Set(selectedTypes);
    if (newTypes.has(type)) {
      newTypes.delete(type);
    } else {
      newTypes.add(type);
    }
    setSelectedTypes(newTypes);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getAssetIcon = (type: Asset['type']) => {
    switch (type) {
      case 'token': return <Package className="w-4 h-4" />;
      case 'map': return <Image className="w-4 h-4" />;
      case 'audio': return <Music className="w-4 h-4" />;
      case 'image': return <Image className="w-4 h-4" />;
      case 'document': return <FileText className="w-4 h-4" />;
      default: return <Package className="w-4 h-4" />;
    }
  };

  const typeLabels = {
    token: 'Tokens',
    map: 'Maps',
    audio: 'Audio',
    image: 'Images',
    document: 'Documents',
    misc: 'Misc'
  };

  return (
    <div className="flex flex-col h-full bg-surface-elevated" data-testid="asset-library">
      {/* Asset Library Header */}
      <div className="p-4 border-b border-subtle">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-white">Asset Library</h3>
          <div className="flex gap-2">
            {isGM && (
              <Button size="sm">
                <label htmlFor="asset-upload" className="cursor-pointer flex items-center gap-2">
                  <Upload className="w-4 h-4" />
                  Upload
                </label>
                <input
                  id="asset-upload"
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFileUpload}
                  accept="image/*,audio/*,.pdf,.txt"
                />
              </Button>
            )}
            <Button 
              onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
              size="sm"
            >
              {viewMode === 'grid' ? <List className="w-4 h-4" /> : <Grid className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative mb-3">
          <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search assets by name or tags..."
            className="pl-10"
          />
        </div>

        {/* Type Filters */}
        <div className="flex flex-wrap gap-2">
          {allowedTypes.map(type => (
            <Button
              key={type}
              onClick={() => toggleTypeFilter(type)}
              variant={selectedTypes.has(type) ? 'primary' : 'secondary'}
              size="sm"
              leftIcon={getAssetIcon(type)}
            >
              {typeLabels[type]}
            </Button>
          ))}
        </div>

        {/* Results Count */}
        <div className="text-sm text-gray-400 mt-2">
          {filteredAssets.length} assets
        </div>
      </div>

      {/* Asset Grid/List */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <span className="ml-2 text-gray-400">Loading assets...</span>
          </div>
        ) : filteredAssets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <Package className="w-12 h-12 mb-4 opacity-50" />
            <p>No assets found</p>
            <p className="text-sm">Try adjusting your search or filters</p>
          </div>
        ) : (
          <div 
            className={
              viewMode === 'grid' 
                ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4' 
                : 'space-y-2'
            }
            data-testid="asset-grid"
          >
            {filteredAssets.map(asset => (
              <div
                key={asset.id}
                onClick={() => handleAssetClick(asset)}
                className={`
                  cursor-pointer rounded-lg border border-subtle bg-white/5 
                  hover:bg-white/10 transition-colors relative group
                  ${selectedAsset === asset.id ? 'ring-2 ring-blue-500' : ''}
                  ${viewMode === 'grid' ? 'p-3' : 'p-3 flex items-center gap-3'}
                `}
                data-testid="asset-item"
              >
                {/* Asset Thumbnail/Icon */}
                <div className={`
                  ${viewMode === 'grid' ? 'w-full h-32 mb-2' : 'w-12 h-12 flex-shrink-0'}
                  bg-gray-700 border border-gray-600 rounded flex items-center justify-center overflow-hidden
                `}>
                  {asset.thumbnail ? (
                    <img 
                      src={asset.thumbnail} 
                      alt={asset.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-gray-400">
                      {getAssetIcon(asset.type)}
                    </div>
                  )}
                </div>

                {/* Asset Info */}
                <div className={`${viewMode === 'grid' ? '' : 'flex-1 min-w-0'}`}>
                  <div className="font-medium text-white truncate">{asset.name}</div>
                  <div className="text-xs text-gray-400 capitalize">{asset.type}</div>
                  <div className="text-xs text-gray-500">{formatFileSize(asset.size)}</div>
                  {viewMode === 'list' && asset.description && (
                    <div className="text-sm text-gray-400 truncate mt-1">{asset.description}</div>
                  )}
                </div>

                {/* Asset Actions */}
                {isGM && (
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(asset.url, '_blank');
                        }}
                      >
                        <Eye className="w-3 h-3" />
                      </Button>
                      <Button
                        size="sm"
                        onClick={(e) => handleAssetDelete(asset.id, e)}
                        className="text-red-400 hover:text-red-300"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
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

export default AssetLibrary;
