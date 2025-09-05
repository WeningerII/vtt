/**
 * Campaign Browser - Browse and join public game sessions
 */

import React, { useState, useEffect } from "react";
import { useAuth } from "../providers/AuthProvider";
import { useGame } from "../providers/GameProvider";
import { LoadingSpinner } from "../components/ui/LoadingSpinner";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { Play, Users, Clock, Globe, Lock, Eye, X, Calendar, UserCheck, Settings } from "lucide-react";

interface CampaignBrowserProps {
  campaignId?: string;
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
  };
  players: Array<{
    id: string;
    username: string;
    displayName: string;
    isConnected: boolean;
  }>;
  status: "waiting" | "active" | "paused" | "ended";
  settings: {
    maxPlayers: number;
    isPrivate: boolean;
    allowSpectators: boolean;
  };
  createdAt: string;
  lastActivity: string;
}

export function CampaignBrowser({ campaignId, router }: CampaignBrowserProps) {
  const { isAuthenticated } = useAuth();
  const { joinSession } = useGame();
  const [sessions, setSessions] = useState<GameSessionInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "waiting" | "active">("waiting");
  const [selectedSession, setSelectedSession] = useState<GameSessionInfo | null>(null);
  const [showSessionDetails, setShowSessionDetails] = useState(false);

  useEffect(() => {
    const fetchPublicSessions = async () => {
      setIsLoading(true);
      
      try {
        const response = await fetch('/api/sessions');
        
        if (response.ok) {
          const sessionsData = await response.json();
          // Filter to only show public sessions
          const publicSessions = sessionsData.filter((session: GameSessionInfo) => 
            !session.settings.isPrivate
          );
          setSessions(publicSessions);
        } else {
          console.error('Failed to fetch sessions:', response.statusText);
          setSessions([]);
        }
      } catch (error) {
        console.error('Error fetching sessions:', error);
        setSessions([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPublicSessions();
  }, []);

  const filteredSessions = sessions.filter((session) => {
    switch (filter) {
      case "active":
        return session.status === "active";
      case "waiting":
        return session.status === "waiting";
      default:
        return true;
    }
  });

  const handleJoinSession = async (sessionId: string) => {
    if (!isAuthenticated) {
      router.navigate("/login");
      return;
    }

    try {
      await joinSession(sessionId);
      router.navigate(`/session/${sessionId}`);
    } catch (error) {
      console.error("Failed to join session:", error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active":
        return <Play className="h-4 w-4 text-green-500" />;
      case "waiting":
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "active":
        return "In Progress";
      case "waiting":
        return "Waiting for Players";
      case "paused":
        return "Paused";
      default:
        return "Unknown";
    }
  };

  const handleShowSessionDetails = (session: GameSessionInfo) => {
    setSelectedSession(session);
    setShowSessionDetails(true);
  };

  const handleCloseSessionDetails = () => {
    setShowSessionDetails(false);
    setSelectedSession(null);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="xl" />
          <h1 className="text-2xl font-bold text-gray-900 mt-4 mb-2">Loading Sessions...</h1>
          <p className="text-gray-600">Finding available game sessions</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Browse Game Sessions</h1>
          <p className="text-gray-600">Join public game sessions or spectate ongoing adventures</p>
        </div>

        {/* Filter Tabs */}
        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              {[
                { key: "waiting", label: "Looking for Players", count: sessions.filter(s => s.status === "waiting").length },
                { key: "active", label: "In Progress", count: sessions.filter(s => s.status === "active").length },
                { key: "all", label: "All Sessions", count: sessions.length },
              ].map(({ key, label, count }) => (
                <button
                  key={key}
                  onClick={() => setFilter(key as typeof filter)}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    filter === key
                      ? "border-blue-500 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  {label} ({count})
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Sessions Grid */}
        {filteredSessions.length === 0 ? (
          <div className="text-center py-12">
            <Globe className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Sessions Available</h3>
            <p className="text-gray-600 mb-4">
              {filter === "waiting" 
                ? "No sessions are currently looking for players."
                : filter === "active"
                ? "No sessions are currently in progress."
                : "No public sessions are available at the moment."
              }
            </p>
            <Button onClick={() => router.navigate("/dashboard")}>
              Return to Dashboard
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSessions.map((session) => (
              <div key={session.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">{session.name}</h3>
                    <p className="text-sm text-gray-600 mb-2">{session.description}</p>
                    <p className="text-sm text-gray-500">GM: {session.gamemaster.displayName}</p>
                  </div>
                  <div className="flex items-center gap-1 text-sm">
                    {getStatusIcon(session.status)}
                    <span className="text-gray-600">{getStatusText(session.status)}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      <span>{session.players.length}/{session.settings.maxPlayers}</span>
                    </div>
                    {session.settings.allowSpectators && (
                      <div className="flex items-center gap-1">
                        <Eye className="h-4 w-4" />
                        <span>Spectators OK</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {session.settings.isPrivate ? (
                      <Lock className="h-4 w-4" />
                    ) : (
                      <Globe className="h-4 w-4" />
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleJoinSession(session.id)}
                    disabled={session.players.length >= session.settings.maxPlayers && session.status === "waiting"}
                  >
                    {session.status === "waiting" ? "Join Game" : "Spectate"}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleShowSessionDetails(session)}
                  >
                    Details
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Session Details Modal */}
        <Modal
          isOpen={showSessionDetails}
          onClose={handleCloseSessionDetails}
          title="Session Details"
          size="lg"
        >
          {selectedSession && (
            <div className="space-y-6">
              {/* Session Header */}
              <div className="border-b border-gray-200 pb-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 mb-2">{selectedSession.name}</h2>
                    <p className="text-gray-600 mb-3">{selectedSession.description}</p>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(selectedSession.status)}
                      <span className="font-medium text-sm">{getStatusText(selectedSession.status)}</span>
                      <span className="text-gray-400">•</span>
                      <span className="text-sm text-gray-600">GM: {selectedSession.gamemaster.displayName}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Session Info Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Players Section */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-blue-600" />
                    <h3 className="font-semibold text-gray-900">Players ({selectedSession.players.length}/{selectedSession.settings.maxPlayers})</h3>
                  </div>
                  <div className="space-y-2">
                    {selectedSession.players.length > 0 ? (
                      selectedSession.players.map((player) => (
                        <div key={player.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                          <span className="text-sm text-gray-900">{player.displayName}</span>
                          <div className="flex items-center gap-1">
                            <div className={`w-2 h-2 rounded-full ${
                              player.isConnected ? 'bg-green-500' : 'bg-gray-400'
                            }`} />
                            <span className="text-xs text-gray-500">
                              {player.isConnected ? 'Online' : 'Offline'}
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-gray-500 italic">No players have joined yet</p>
                    )}
                  </div>
                </div>

                {/* Session Settings */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Settings className="h-5 w-5 text-purple-600" />
                    <h3 className="font-semibold text-gray-900">Settings</h3>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <span className="text-sm text-gray-700">Visibility</span>
                      <div className="flex items-center gap-1">
                        {selectedSession.settings.isPrivate ? (
                          <><Lock className="h-4 w-4 text-gray-600" /><span className="text-sm">Private</span></>
                        ) : (
                          <><Globe className="h-4 w-4 text-green-600" /><span className="text-sm">Public</span></>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <span className="text-sm text-gray-700">Spectators</span>
                      <div className="flex items-center gap-1">
                        {selectedSession.settings.allowSpectators ? (
                          <><Eye className="h-4 w-4 text-green-600" /><span className="text-sm">Allowed</span></>
                        ) : (
                          <><X className="h-4 w-4 text-red-600" /><span className="text-sm">Not Allowed</span></>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <span className="text-sm text-gray-700">Max Players</span>
                      <span className="text-sm font-medium">{selectedSession.settings.maxPlayers}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Timeline */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-indigo-600" />
                  <h3 className="font-semibold text-gray-900">Timeline</h3>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <span className="text-sm text-gray-700">Created</span>
                    <span className="text-sm text-gray-900">{formatDate(selectedSession.createdAt)}</span>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <span className="text-sm text-gray-700">Last Activity</span>
                    <span className="text-sm text-gray-900">{formatDate(selectedSession.lastActivity)}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <Button
                  variant="primary"
                  className="flex-1"
                  onClick={() => {
                    handleJoinSession(selectedSession.id);
                    handleCloseSessionDetails();
                  }}
                  disabled={selectedSession.players.length >= selectedSession.settings.maxPlayers && selectedSession.status === "waiting"}
                >
                  <UserCheck className="h-4 w-4 mr-2" />
                  {selectedSession.status === "waiting" ? "Join Game" : "Spectate"}
                </Button>
                <Button
                  variant="secondary"
                  onClick={handleCloseSessionDetails}
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </Modal>
      </div>
    </div>
  );
}
