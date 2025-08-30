/**
 * Dashboard Page - Main application hub with session browser and quick actions
 */

import React, { useState, useEffect } from 'react';
import { logger } from '@vtt/logging';
import { useAuth } from '../providers/AuthProvider';
import { useGame } from '../providers/GameProvider';
import { useWebSocket } from '../providers/WebSocketProvider';
import { Button } from '../components/ui/Button';
import { Skeleton } from '../components/ui/LoadingSpinner';
import { useTranslation } from '@vtt/i18n';
import {
  Plus,
  Users,
  Play,
  Settings,
  Crown,
  Clock,
  Globe,
  Lock,
  Eye,
  Zap,
} from 'lucide-react';

interface DashboardProps {
  router: {
    navigate: (_path: string) => void;
    currentPath: string;
  };
}

interface GameSessionInfo {
  id: string;
  name: string;
  description: string;
  gamemaster: {
    id: string;
    username: string;
    displayName: string;
    avatar?: string;
  };
  players: Array<{
    id: string;
    username: string;
    displayName: string;
    avatar?: string;
    isConnected: boolean;
  }>;
  status: 'waiting' | 'active' | 'paused' | 'ended';
  settings: {
    maxPlayers: number;
    isPrivate: boolean;
    allowSpectators: boolean;
  };
  createdAt: string;
  lastActivity: string;
}

export function Dashboard({ router }: DashboardProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { session, joinSession, isLoading: gameLoading } = useGame();
  const { isConnected,  latency  } = useWebSocket();
  const [sessions, setSessions] = useState<GameSessionInfo[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [filter, setFilter] = useState<'all' | 'active' | 'waiting' | 'joinable'>('all');

  // Simulate fetching sessions (replace with actual API call)
  useEffect(() => {
    const fetchSessions = async () => {
      setIsLoadingSessions(true);
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mock session data
      const mockSessions: GameSessionInfo[] = [
        {
          id: '1',
          name: 'Lost Mines of Phandelver',
          description: 'A classic D&D 5e adventure for new players',
          gamemaster: {
            id: 'gm1',
            username: 'dmmaster',
            displayName: 'Dungeon Master Dave',
            avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=dmmaster'
          },
          players: [
            {
              id: 'p1',
              username: 'ranger_rick',
              displayName: 'Rick the Ranger',
              avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=ranger_rick',
              isConnected: true
            },
            {
              id: 'p2',
              username: 'wizard_wanda',
              displayName: 'Wanda the Wise',
              avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=wizard_wanda',
              isConnected: false
            }
          ],
          status: 'active',
          settings: {
            maxPlayers: 4,
            isPrivate: false,
            allowSpectators: true
          },
          createdAt: '2024-01-15T10:00:00Z',
          lastActivity: '2024-01-15T14:30:00Z'
        },
        {
          id: '2',
          name: 'Cyberpunk Red Campaign',
          description: 'Night City awaits in this ongoing cyberpunk adventure',
          gamemaster: {
            id: 'gm2',
            username: 'neon_gm',
            displayName: 'Neon NetRunner',
            avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=neon_gm'
          },
          players: [],
          status: 'waiting',
          settings: {
            maxPlayers: 5,
            isPrivate: true,
            allowSpectators: false
          },
          createdAt: '2024-01-15T09:00:00Z',
          lastActivity: '2024-01-15T09:00:00Z'
        }
      ];
      
      setSessions(mockSessions);
      setIsLoadingSessions(false);
    };

    fetchSessions();
  }, []);

  const filteredSessions = sessions.filter(session => {
    switch (filter) {
      case 'active':
        return session.status === 'active';
      case 'waiting':
        return session.status === 'waiting';
      case 'joinable':
        return session.status === 'waiting' && !session.settings.isPrivate;
      default:
        return true;
    }
  });

  const handleJoinSession = async (_sessionId: string) => {
    try {
      await joinSession(_sessionId);
      router.navigate(`/session/${_sessionId}`);
    } catch (error) {
      logger.error('Failed to join session:', error);
    }
  };

  const handleCreateSession = () => {
    setShowCreateModal(true);
  };

  const getStatusIcon = (_status: string) => {
    switch (_status) {
      case 'active':
        return <Play className="h-4 w-4 text-success" />;
      case 'waiting':
        return <Clock className="h-4 w-4 text-warning" />;
      case 'paused':
        return <Clock className="h-4 w-4 text-text-secondary" />;
      default:
        return <Clock className="h-4 w-4 text-text-tertiary" />;
    }
  };

  const getStatusColor = (_status: string) => {
    switch (_status) {
      case 'active':
        return 'text-success';
      case 'waiting':
        return 'text-warning';
      case 'paused':
        return 'text-text-secondary';
      default:
        return 'text-text-tertiary';
    }
  };

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Header */}
      <header className="bg-bg-secondary border-b border-border-primary">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">
              Welcome back, {user?.displayName}!
            </h1>
            <p className="text-text-secondary">
              Ready for your next adventure?
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Connection Status */}
            <div className="flex items-center gap-2 text-sm">
              <div className={`h-2 w-2 rounded-full ${isConnected ? 'bg-success' : 'bg-error'}`} />
              <span className="text-text-secondary">
                {isConnected ? `Connected (${latency}ms)` : 'Disconnected'}
              </span>
            </div>
            
            {/* Quick Actions */}
            <Button
              variant="primary"
              leftIcon={<Plus className="h-4 w-4" />}
              onClick={handleCreateSession}
            >
              Create Session
            </Button>
            
            <Button
              variant="ghost"
              leftIcon={<Settings className="h-4 w-4" />}
              onClick={() => router.navigate('/settings')}
            >
              Settings
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Current Session Banner */}
        {session && (
          <div className="mb-8 p-6 bg-gradient-to-r from-accent-primary/10 to-accent-hover/10 border border-accent-primary/20 rounded-xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-text-primary mb-1">
                  Currently Playing: {session.name}
                </h2>
                <p className="text-text-secondary">
                  GM: {session.gamemaster.displayName} • {session.players.length} players
                </p>
              </div>
              <Button
                variant="primary"
                leftIcon={<Play className="h-4 w-4" />}
                onClick={() => router.navigate(`/session/${session.id}`)}
              >
                Resume Game
              </Button>
            </div>
          </div>
        )}

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-bg-secondary border border-border-primary rounded-lg p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-accent-light rounded-lg">
                <Users className="h-6 w-6 text-accent-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-text-primary">
                  {sessions.filter(s => s.status === 'active').length}
                </p>
                <p className="text-text-secondary">Active Sessions</p>
              </div>
            </div>
          </div>
          
          <div className="bg-bg-secondary border border-border-primary rounded-lg p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-warning-light rounded-lg">
                <Clock className="h-6 w-6 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold text-text-primary">
                  {sessions.filter(s => s.status === 'waiting').length}
                </p>
                <p className="text-text-secondary">Waiting for Players</p>
              </div>
            </div>
          </div>
          
          <div className="bg-bg-secondary border border-border-primary rounded-lg p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-success-light rounded-lg">
                <Zap className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold text-text-primary">
                  {isConnected ? latency : '—'}
                  <span className="text-sm font-normal">ms</span>
                </p>
                <p className="text-text-secondary">Server Latency</p>
              </div>
            </div>
          </div>
        </div>

        {/* Session Browser */}
        <div className="bg-bg-secondary border border-border-primary rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-text-primary">Game Sessions</h2>
            
            {/* Filter Tabs */}
            <div className="flex bg-bg-tertiary rounded-lg p-1">
              {([
                { key: 'all', label: 'All' },
                { key: 'active', label: 'Active' },
                { key: 'waiting', label: 'Waiting' },
                { key: 'joinable', label: 'Joinable' },
              ] as const).map(({ key, label }) => (
                <button
                  key={key}
                  aria-label={`Filter ${label}`}
                  onClick={() => setFilter(key as any)}
                  className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                    filter === key
                      ? 'bg-accent-primary text-white'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Session List */}
          {isLoadingSessions ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="p-4 border border-border-primary rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <Skeleton className="h-5 w-48 mb-2" />
                      <Skeleton className="h-4 w-64 mb-2" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                    <Skeleton className="h-10 w-24" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-text-tertiary mx-auto mb-4" />
              <h3 className="text-lg font-medium text-text-primary mb-2">
                No sessions found
              </h3>
              <p className="text-text-secondary mb-4">
                {filter === 'all' 
                  ? "There are no active sessions right now."
                  : `No sessions match the "${filter}" filter.`
                }
              </p>
              <Button variant="primary" onClick={handleCreateSession}>
                Create Your First Session
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredSessions.map((sessionInfo) => (
                <div key={sessionInfo.id} className="p-4 border border-border-primary rounded-lg hover:border-border-hover transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-medium text-text-primary">
                          {sessionInfo.name}
                        </h3>
                        <div className="flex items-center gap-1">
                          {getStatusIcon(sessionInfo.status)}
                          <span className={`text-sm capitalize ${getStatusColor(sessionInfo.status)}`}>
                            {sessionInfo.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          {sessionInfo.settings.isPrivate ? (
                            <Lock className="h-4 w-4 text-text-tertiary" />
                          ) : (
                            <Globe className="h-4 w-4 text-text-tertiary" />
                          )}
                          {sessionInfo.settings.allowSpectators && (
                            <Eye className="h-4 w-4 text-text-tertiary" />
                          )}
                        </div>
                      </div>
                      
                      <p className="text-text-secondary mb-3">
                        {sessionInfo.description}
                      </p>
                      
                      <div className="flex items-center gap-6 text-sm text-text-tertiary">
                        <div className="flex items-center gap-1">
                          <Crown className="h-4 w-4" />
                          <span>GM: {sessionInfo.gamemaster.displayName}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Users className="h-4 w-4" />
                          <span>
                            {sessionInfo.players.length}/{sessionInfo.settings.maxPlayers} players
                          </span>
                        </div>
                        <div>
                          Last active: {new Date(sessionInfo.lastActivity).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {sessionInfo.status === 'waiting' && !sessionInfo.settings.isPrivate && (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleJoinSession(sessionInfo.id)}
                          disabled={gameLoading}
                        >
                          Join Game
                        </Button>
                      )}
                      
                      {sessionInfo.status === 'active' && sessionInfo.settings.allowSpectators && (
                        <Button
                          variant="secondary"
                          size="sm"
                          leftIcon={<Eye className="h-4 w-4" />}
                          onClick={() => handleJoinSession(sessionInfo.id)}
                        >
                          Spectate
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create Session Modal (placeholder) */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-bg-overlay flex items-center justify-center z-50 p-4">
          <div className="bg-bg-secondary border border-border-primary rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-text-primary mb-4">
              Create New Session
            </h3>
            <p className="text-text-secondary mb-4">
              Session creation will be implemented in the next phase.
            </p>
            <div className="flex justify-end gap-3">
              <Button
                variant="secondary"
                onClick={() => setShowCreateModal(false)}
              >
                Cancel
              </Button>
              <Button variant="primary" disabled>
                Coming Soon
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
