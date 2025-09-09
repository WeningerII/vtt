/**
 * Dashboard Home - Main dashboard with stats, recent activity, and quick actions
 */
import React from "react";
import {
  Users,
  Gamepad2,
  Clock,
  Calendar,
  TrendingUp,
  Plus,
  ArrowRight,
  Star,
  MapPin,
  Activity,
} from "lucide-react";
import { Button } from "../ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/Card";
import { useAuth } from "../../providers/AuthProvider";
import { formatDate, formatRelativeTime } from "../../lib/format";
import { useDashboardData } from "../../hooks/useDashboardData";
import { useRouter } from "../Router";

export function DashboardHome() {
  const { user } = useAuth();
  const { navigate } = useRouter();
  const { stats, recentCampaigns, recentActivity, isLoading, error } = useDashboardData();

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-success-100 text-success-800";
      case "paused":
        return "bg-warning-100 text-warning-800";
      case "completed":
        return "bg-neutral-100 text-neutral-800";
      default:
        return "bg-neutral-100 text-neutral-800";
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "session":
        return Gamepad2;
      case "player":
        return Users;
      case "campaign":
        return Plus;
      case "achievement":
        return Star;
      default:
        return Activity;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-neutral-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center max-w-md">
          <div className="text-red-600 mb-4">
            <svg className="h-12 w-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-neutral-900 mb-2">Unable to load dashboard</h2>
          <p className="text-neutral-600 mb-4">{error}</p>
          <Button onClick={() => window.location.reload()} variant="primary">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-700 rounded-xl p-6 text-white">
        <h1 className="text-2xl font-bold mb-2">Welcome back, {user?.displayName || 'Player'}! 🎲</h1>
        <p className="text-primary-100">
          {stats.nextSession ? (
            <>Ready to continue your adventures? Your next session is{" "}
            {formatRelativeTime(stats.nextSession)}.</>
          ) : (
            "No upcoming sessions scheduled. Time to plan your next adventure!"
          )}
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-neutral-600">Campaigns</p>
                <p className="text-2xl font-bold text-neutral-900">{stats.totalCampaigns}</p>
              </div>
              <div className="h-12 w-12 bg-primary-100 rounded-lg flex items-center justify-center">
                <Gamepad2 className="h-6 w-6 text-primary-600" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm text-success-600">
              <TrendingUp className="h-4 w-4 mr-1" />
              <span>+1 this month</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-neutral-600">Active Players</p>
                <p className="text-2xl font-bold text-neutral-900">{stats.activePlayers}</p>
              </div>
              <div className="h-12 w-12 bg-success-100 rounded-lg flex items-center justify-center">
                <Users className="h-6 w-6 text-success-600" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm text-success-600">
              <TrendingUp className="h-4 w-4 mr-1" />
              <span>+3 this week</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-neutral-600">Hours Played</p>
                <p className="text-2xl font-bold text-neutral-900">{stats.hoursPlayed}</p>
              </div>
              <div className="h-12 w-12 bg-warning-100 rounded-lg flex items-center justify-center">
                <Clock className="h-6 w-6 text-warning-600" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm text-success-600">
              <TrendingUp className="h-4 w-4 mr-1" />
              <span>+8h this week</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-neutral-600">Next Session</p>
                <p className="text-lg font-semibold text-neutral-900">
                  {stats.nextSession ? formatDate(stats.nextSession, "MMM d, h:mm a") : "Not scheduled"}
                </p>
              </div>
              <div className="h-12 w-12 bg-info-100 rounded-lg flex items-center justify-center">
                <Calendar className="h-6 w-6 text-info-600" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm text-info-600">
              <MapPin className="h-4 w-4 mr-1" />
              <span>Online</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Campaigns */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Recent Campaigns</CardTitle>
              <Button variant="ghost" size="sm" rightIcon={<ArrowRight className="h-4 w-4" />}>
                View all
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {recentCampaigns.length > 0 ? recentCampaigns.map((campaign) => (
                <div
                  key={campaign.id}
                  className="flex items-center space-x-4 p-4 rounded-lg border border-neutral-200 hover:border-neutral-300 transition-colors cursor-pointer"
                >
                  <div className="h-12 w-12 rounded-lg bg-neutral-200 flex items-center justify-center">
                    <Gamepad2 className="h-6 w-6 text-neutral-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium text-neutral-900 truncate">
                        {campaign.name}
                      </h4>
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(campaign.status)}`}
                      >
                        {campaign.status}
                      </span>
                    </div>
                    <div className="flex items-center space-x-4 mt-1 text-sm text-neutral-600">
                      <span>{campaign.system}</span>
                      <span>•</span>
                      <span>{campaign.players} players</span>
                      <span>•</span>
                      <span>Last played {formatRelativeTime(campaign.lastPlayed)}</span>
                    </div>
                  </div>
                </div>
              )) : (
                <div className="text-center py-8">
                  <Gamepad2 className="h-12 w-12 text-neutral-300 mx-auto mb-3" />
                  <p className="text-neutral-600 mb-4">No campaigns yet</p>
                  <Button 
                    variant="primary" 
                    size="sm"
                    onClick={() => navigate('/campaigns/new')}
                  >
                    Create Your First Campaign
                  </Button>
                </div>
              )}

              {recentCampaigns.length > 0 && (
              <div className="pt-4 border-t">
                <Button 
                  variant="secondary" 
                  fullWidth 
                  leftIcon={<Plus className="h-4 w-4" />}
                  onClick={() => navigate('/campaigns/new')}
                >
                  Create New Campaign
                </Button>
              </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {recentActivity.length > 0 ? recentActivity.map((activity) => {
                const IconComponent = getActivityIcon(activity.type);
                return (
                  <div key={activity.id} className="flex space-x-3">
                    <div className="h-8 w-8 bg-neutral-100 rounded-full flex items-center justify-center">
                      <IconComponent className="h-4 w-4 text-neutral-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-neutral-900">{activity.message}</p>
                      <p className="text-xs text-neutral-500 mt-1">
                        {formatRelativeTime(activity.time)}
                      </p>
                    </div>
                  </div>
                );
              }) : (
                <div className="text-center py-8">
                  <Activity className="h-12 w-12 text-neutral-300 mx-auto mb-3" />
                  <p className="text-neutral-600">No recent activity</p>
                  <p className="text-sm text-neutral-500 mt-1">Start a campaign to see activity here</p>
                </div>
              )}

              {recentActivity.length > 0 && (
              <div className="pt-4 border-t">
                <Button variant="link" size="sm" className="w-full">
                  View all activity
                </Button>
              </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card interactive>
          <CardContent className="p-6 text-center">
            <div className="h-12 w-12 bg-primary-100 rounded-lg flex items-center justify-center mx-auto mb-4">
              <Plus className="h-6 w-6 text-primary-600" />
            </div>
            <h3 className="text-lg font-medium text-neutral-900 mb-2">Start New Campaign</h3>
            <p className="text-sm text-neutral-600 mb-4">Create a new adventure for your players</p>
            <Button 
              variant="primary" 
              fullWidth
              onClick={() => navigate('/campaigns/new')}
            >
              Get Started
            </Button>
          </CardContent>
        </Card>

        <Card interactive>
          <CardContent className="p-6 text-center">
            <div className="h-12 w-12 bg-success-100 rounded-lg flex items-center justify-center mx-auto mb-4">
              <Users className="h-6 w-6 text-success-600" />
            </div>
            <h3 className="text-lg font-medium text-neutral-900 mb-2">Invite Players</h3>
            <p className="text-sm text-neutral-600 mb-4">Grow your gaming community</p>
            <Button 
              variant="secondary" 
              fullWidth
              onClick={() => navigate('/players/invite')}
            >
              Send Invites
            </Button>
          </CardContent>
        </Card>

        <Card interactive>
          <CardContent className="p-6 text-center">
            <div className="h-12 w-12 bg-warning-100 rounded-lg flex items-center justify-center mx-auto mb-4">
              <Calendar className="h-6 w-6 text-warning-600" />
            </div>
            <h3 className="text-lg font-medium text-neutral-900 mb-2">Schedule Session</h3>
            <p className="text-sm text-neutral-600 mb-4">Coordinate your next game night</p>
            <Button 
              variant="secondary" 
              fullWidth
              onClick={() => navigate('/sessions/schedule')}
            >
              Schedule Now
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default DashboardHome;
