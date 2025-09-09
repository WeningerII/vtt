/**
 * Dashboard data hook - Fetches real dashboard data from API
 */
import { useState, useEffect } from 'react';
import { apiClient } from '../lib/api-client';
import { CampaignsApi } from '../api/campaigns';
import { sessionsService } from '../services/sessions';
import { logger } from '@vtt/logging';

export interface DashboardStats {
  totalCampaigns: number;
  activePlayers: number;
  hoursPlayed: number;
  nextSession: Date | null;
}

export interface RecentCampaign {
  id: string;
  name: string;
  system: string;
  players: number;
  lastPlayed: Date;
  status: 'active' | 'paused' | 'completed';
  image?: string;
}

export interface RecentActivity {
  id: string;
  type: 'session' | 'player' | 'campaign' | 'achievement';
  message: string;
  time: Date;
}

export interface DashboardData {
  stats: DashboardStats;
  recentCampaigns: RecentCampaign[];
  recentActivity: RecentActivity[];
  isLoading: boolean;
  error: string | null;
}

export function useDashboardData(): DashboardData {
  const [data, setData] = useState<DashboardData>({
    stats: {
      totalCampaigns: 0,
      activePlayers: 0,
      hoursPlayed: 0,
      nextSession: null,
    },
    recentCampaigns: [],
    recentActivity: [],
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setData(prev => ({ ...prev, isLoading: true, error: null }));

        // Fetch campaigns
        const campaignsResponse = await CampaignsApi.getCampaigns();
        const campaigns = campaignsResponse.data || [];
        
        // Fetch sessions
        const sessions = await sessionsService.getSessions({ status: 'all' });
        
        // Calculate stats from real data
        const activeCampaigns = campaigns.filter(c => c.isActive);
        const totalPlayers = new Set(
          campaigns.flatMap(c => c.players || [])
        ).size;
        
        // Calculate total hours from campaigns
        const totalHours = campaigns.reduce(
          (sum, c) => sum + (c.totalHours || 0), 
          0
        );
        
        // Find next scheduled session
        const upcomingSessions = sessions
          .filter(s => s.status === 'waiting')
          .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        
        const nextSession = upcomingSessions.length > 0 && upcomingSessions[0]
          ? new Date(upcomingSessions[0].createdAt)
          : null;

        // Format recent campaigns
        const recentCampaigns: RecentCampaign[] = campaigns
          .slice(0, 3)
          .map(campaign => ({
            id: campaign.id,
            name: campaign.name,
            system: campaign.gameSystem || 'D&D 5e',
            players: campaign.players?.length || 0,
            lastPlayed: new Date(campaign.updatedAt),
            status: campaign.isActive ? 'active' : 'paused',
          }));

        // Fetch recent activity from server
        let recentActivity: RecentActivity[] = [];
        try {
          const activityResponse = await apiClient.get('/activity/recent');
          if (activityResponse.data.success && Array.isArray(activityResponse.data.data)) {
            recentActivity = activityResponse.data.data.map((item: any) => ({
              id: item.id,
              type: item.type,
              message: item.message,
              time: new Date(item.timestamp),
            }));
          }
        } catch (err) {
          // Activity endpoint might not exist yet, that's ok
          logger.debug('Activity endpoint not available');
        }

        // If no activity from server, generate from campaigns/sessions
        if (recentActivity.length === 0 && campaigns.length > 0) {
          recentActivity = campaigns.slice(0, 3).map((c, i) => ({
            id: `activity-${i}`,
            type: 'campaign' as const,
            message: `Campaign "${c.name}" was updated`,
            time: new Date(c.updatedAt),
          }));
        }

        setData({
          stats: {
            totalCampaigns: campaigns.length,
            activePlayers: totalPlayers,
            hoursPlayed: Math.round(totalHours),
            nextSession,
          },
          recentCampaigns,
          recentActivity,
          isLoading: false,
          error: null,
        });
      } catch (error) {
        logger.error('Failed to fetch dashboard data:', error);
        setData(prev => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to load dashboard data',
        }));
      }
    };

    fetchDashboardData();
    
    // Refresh data every 30 seconds
    const interval = setInterval(fetchDashboardData, 30000);
    
    return () => clearInterval(interval);
  }, []);

  return data;
}
