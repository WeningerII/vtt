/**
 * Campaigns List - Grid/list view of user's campaigns with filtering and search
 */
import React, { useState, useEffect } from 'react';
import { logger } from '@vtt/logging';
import { 
  Search, 
  Filter, 
  Grid3X3, 
  List, 
  Plus,
  Users,
  Calendar,
  Clock,
  MoreHorizontal,
  Play,
  Pause,
  Settings,
  Archive,
  Gamepad2,
  Loader2
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { cn } from '../../lib/utils';
import { formatDate, formatRelativeTime } from '../../lib/format';
import { CampaignsApi, Campaign as ApiCampaign } from '../../api/campaigns';

interface Campaign {
  id: string;
  name: string;
  system: string;
  description: string;
  status: 'active' | 'paused' | 'completed' | 'planning';
  players: number;
  maxPlayers: number;
  sessions: number;
  totalHours: number;
  lastSession?: Date;
  nextSession?: Date;
  createdAt: Date;
  coverImage?: string;
  visibility: 'public' | 'private' | 'friends';
}

/**
 * Transform API campaign data to UI campaign format
 */
function transformApiCampaign(apiCampaign: ApiCampaign): Campaign {
  return {
    id: apiCampaign.id,
    name: apiCampaign.name,
    system: apiCampaign.gameSystem,
    description: apiCampaign.description,
    status: apiCampaign.isActive ? 'active' : 'paused',
    players: apiCampaign.players.length,
    maxPlayers: 6, // Default max players
    sessions: apiCampaign.sessions || 0,
    totalHours: apiCampaign.totalHours || 0,
    createdAt: new Date(apiCampaign.createdAt),
    visibility: 'private' // Default visibility
  };
}

type ViewMode = 'grid' | 'list';
type FilterStatus = 'all' | 'active' | 'paused' | 'completed' | 'planning';

export function CampaignsList() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null);

  // Load campaigns from API
  useEffect(() => {
    const loadCampaigns = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await CampaignsApi.getCampaigns();
        
        if (response.success && response.data) {
          const transformedCampaigns = response.data.map(transformApiCampaign);
          setCampaigns(transformedCampaigns);
        } else {
          setError(response.error || 'Failed to load campaigns');
        }
      } catch (err) {
        setError('An unexpected error occurred while loading campaigns');
        logger.error('Failed to load campaigns:', err);
      } finally {
        setLoading(false);
      }
    };

    loadCampaigns();
  }, []);

  // Filter campaigns based on search and status
  const filteredCampaigns = campaigns.filter(campaign => {
    const matchesSearch = campaign.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         campaign.system.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         campaign.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = filterStatus === 'all' || campaign.status === filterStatus;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: Campaign['status']) => {
    switch (status) {
      case 'active': return 'bg-success-100 text-success-800 border-success-200';
      case 'paused': return 'bg-warning-100 text-warning-800 border-warning-200';
      case 'completed': return 'bg-neutral-100 text-neutral-800 border-neutral-200';
      case 'planning': return 'bg-info-100 text-info-800 border-info-200';
      default: return 'bg-neutral-100 text-neutral-800 border-neutral-200';
    }
  };

  const getStatusIcon = (status: Campaign['status']) => {
    switch (status) {
      case 'active': return <Play className="h-3 w-3" />;
      case 'paused': return <Pause className="h-3 w-3" />;
      case 'completed': return <Archive className="h-3 w-3" />;
      case 'planning': return <Settings className="h-3 w-3" />;
      default: return null;
    }
  };

  const CampaignCard: React.FC<{ campaign: Campaign }> = ({ campaign }) => (
    <Card 
      key={campaign.id}
      interactive
      className={cn(
        "group cursor-pointer transition-all duration-200",
        selectedCampaign === campaign.id && "ring-2 ring-primary-500"
      )}
      onClick={() => setSelectedCampaign(campaign.id)}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg truncate">{campaign.name}</CardTitle>
            <p className="text-sm text-neutral-600 mt-1">{campaign.system}</p>
          </div>
          <div className="flex items-center gap-2 ml-4">
            <span className={cn(
              "inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border",
              getStatusColor(campaign.status)
            )}>
              {getStatusIcon(campaign.status)}
              {campaign.status}
            </span>
            <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <p className="text-sm text-neutral-700 line-clamp-2">
          {campaign.description}
        </p>
        
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-neutral-500" />
            <span className="text-neutral-700">
              {campaign.players}/{campaign.maxPlayers} players
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Gamepad2 className="h-4 w-4 text-neutral-500" />
            <span className="text-neutral-700">
              {campaign.sessions} sessions
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-neutral-500" />
            <span className="text-neutral-700">
              {campaign.totalHours}h played
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-neutral-500" />
            <span className="text-neutral-700">
              {campaign.lastSession ? formatRelativeTime(campaign.lastSession) : 'No sessions yet'}
            </span>
          </div>
        </div>

        {campaign.nextSession && (
          <div className="p-3 bg-primary-50 rounded-lg border border-primary-200">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-primary-600" />
              <span className="text-primary-800 font-medium">
                Next: {formatDate(campaign.nextSession, 'eee, MMM d, h:mm a')}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );

  const CampaignRow: React.FC<{ campaign: Campaign }> = ({ campaign }) => (
    <div role="button" 
      key={campaign.id}
      className={cn(
        "group flex items-center gap-4 p-4 rounded-lg border border-neutral-200 hover:border-neutral-300 cursor-pointer transition-all",
        selectedCampaign === campaign.id && "border-primary-500 bg-primary-50"
      )}
      onClick={() => setSelectedCampaign(campaign.id)}
    >
      <div className="h-12 w-12 rounded-lg bg-neutral-200 flex items-center justify-center">
        <Gamepad2 className="h-6 w-6 text-neutral-600" />
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-medium text-neutral-900 truncate">{campaign.name}</h3>
          <span className={cn(
            "inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border",
            getStatusColor(campaign.status)
          )}>
            {getStatusIcon(campaign.status)}
            {campaign.status}
          </span>
        </div>
        <div className="flex items-center gap-4 text-sm text-neutral-600">
          <span>{campaign.system}</span>
          <span>•</span>
          <span>{campaign.players}/{campaign.maxPlayers} players</span>
          <span>•</span>
          <span>{campaign.sessions} sessions</span>
          <span>•</span>
          <span>{campaign.totalHours}h played</span>
          {campaign.lastSession && (
            <>
              <span>•</span>
              <span>Last: {formatRelativeTime(campaign.lastSession)}</span>
            </>
          )}
        </div>
      </div>

      <Button 
        variant="ghost" 
        size="icon" 
        className="opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <MoreHorizontal className="h-4 w-4" />
      </Button>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="flex-1 max-w-md">
          <Input
            placeholder="Search campaigns..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<Search className="h-4 w-4" />}
          />
        </div>
        
        <div className="flex items-center gap-2">
          {/* Status Filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
            className="px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="planning">Planning</option>
            <option value="completed">Completed</option>
          </select>

          {/* View Toggle */}
          <div className="flex border border-neutral-300 rounded-lg p-1">
            <Button
              variant={viewMode === 'grid' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('grid')}
            >
              <Grid3X3 className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>

          <Button variant="primary" leftIcon={<Plus className="h-4 w-4" />}>
            New Campaign
          </Button>
        </div>
      </div>

      {/* Campaigns Display */}
      {loading ? (
        <Card className="text-center py-12">
          <CardContent>
            <Loader2 className="h-12 w-12 text-primary-500 mx-auto mb-4 animate-spin" />
            <h3 className="text-lg font-medium text-neutral-900 mb-2">Loading campaigns...</h3>
            <p className="text-neutral-600">Please wait while we fetch your campaigns</p>
          </CardContent>
        </Card>
      ) : error ? (
        <Card className="text-center py-12 border-error-200 bg-error-50">
          <CardContent>
            <div className="h-12 w-12 rounded-full bg-error-100 flex items-center justify-center mx-auto mb-4">
              <span className="text-error-600 text-xl">⚠</span>
            </div>
            <h3 className="text-lg font-medium text-error-900 mb-2">Failed to load campaigns</h3>
            <p className="text-error-700 mb-6">{error}</p>
            <Button 
              variant="primary" 
              onClick={() => window.location.reload()}
            >
              Try Again
            </Button>
          </CardContent>
        </Card>
      ) : filteredCampaigns.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <Gamepad2 className="h-12 w-12 text-neutral-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-neutral-900 mb-2">
              {searchQuery || filterStatus !== 'all' ? 'No campaigns found' : 'No campaigns yet'}
            </h3>
            <p className="text-neutral-600 mb-6">
              {searchQuery || filterStatus !== 'all' 
                ? 'Try adjusting your search or filters'
                : 'Create your first campaign to get started with your tabletop adventures'
              }
            </p>
            {!searchQuery && filterStatus === 'all' && (
              <Button variant="primary" leftIcon={<Plus className="h-4 w-4" />}>
                Create Your First Campaign
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className={cn(
          viewMode === 'grid' 
            ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
            : 'space-y-2'
        )}>
          {filteredCampaigns.map(campaign => 
            viewMode === 'grid' 
              ? <CampaignCard key={campaign.id} campaign={campaign} />
              : <CampaignRow key={campaign.id} campaign={campaign} />
          )}
        </div>
      )}

      {/* Results Summary */}
      {filteredCampaigns.length > 0 && (
        <div className="text-sm text-neutral-600 text-center">
          Showing {filteredCampaigns.length} of {campaigns.length} campaigns
        </div>
      )}
    </div>
  );
}
