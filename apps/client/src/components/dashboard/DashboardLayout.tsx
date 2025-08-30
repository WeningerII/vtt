/**
 * Dashboard Layout - Main layout wrapper with navigation and user menu
 */
import React, { useState } from 'react';
import { logger } from '@vtt/logging';
import { useRouter } from 'next/router';
import {
  Home,
  Users,
  Gamepad2,
  Settings,
  CreditCard,
  HelpCircle,
  LogOut,
  Menu,
  X,
  Bell,
  Search,
  Plus
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { useAuth } from '../../providers/AuthProvider';
import { cn, getInitials } from '../../lib/utils';

interface DashboardLayoutProps {
  children: React.ReactNode;
  title?: string;
  action?: React.ReactNode;
}

interface NavigationItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  current?: boolean;
}

const navigation: NavigationItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: Home },
  { name: 'Campaigns', href: '/dashboard/campaigns', icon: Gamepad2 },
  { name: 'Players', href: '/dashboard/players', icon: Users },
  { name: 'Settings', href: '/dashboard/settings', icon: Settings },
  { name: 'Billing', href: '/dashboard/billing', icon: CreditCard },
  { name: 'Help', href: '/dashboard/help', icon: HelpCircle },
];

export function DashboardLayout({_ children, _title, _action }: DashboardLayoutProps) {
  const router = useRouter();
  const { user,  logout  } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/');
    } catch (error) {
      logger.error('Logout failed:', error);
    }
  };

  const isCurrentPage = (_href: string) => {
    if (href === '/dashboard') {
      return router.pathname === '/dashboard';
    }
    return router.pathname.startsWith(href);
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div role="button" className="fixed inset-0 bg-black/20" onClick={() => setSidebarOpen(false)} />
          <div className="fixed inset-y-0 left-0 w-64 bg-white shadow-xl">
            <div className="flex h-16 items-center justify-between px-4 border-b">
              <h1 className="text-xl font-bold text-primary-600">VTT Platform</h1>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(false)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            <nav className="mt-8 px-4" aria-label="Navigation">
              <ul className="space-y-1">
                {navigation.map((item) => (
                  <li key={item.name}>
                    <a
                      href={item.href}
                      className={cn(
                        'flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors',
                        isCurrentPage(item.href)
                          ? 'bg-primary-100 text-primary-700'
                          : 'text-neutral-700 hover:bg-neutral-100'
                      )}
                      onClick={() => setSidebarOpen(false)}
                    >
                      <item.icon className="mr-3 h-5 w-5" />
                      {item.name}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-white border-r border-neutral-200 px-6 pb-4">
          <div className="flex h-16 shrink-0 items-center">
            <h1 className="text-xl font-bold text-primary-600">VTT Platform</h1>
          </div>
          <nav className="flex flex-1 flex-col" aria-label="Navigation">
            <ul className="flex flex-1 flex-col gap-y-7">
              <li>
                <ul className="space-y-1">
                  {navigation.map((item) => (
                    <li key={item.name}>
                      <a
                        href={item.href}
                        className={cn(
                          'flex items-center gap-x-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                          isCurrentPage(item.href)
                            ? 'bg-primary-100 text-primary-700'
                            : 'text-neutral-700 hover:bg-neutral-100'
                        )}
                      >
                        <item.icon className="h-5 w-5 shrink-0" />
                        {item.name}
                      </a>
                    </li>
                  ))}
                </ul>
              </li>
            </ul>
          </nav>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top navigation */}
        <div className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-neutral-200 bg-white px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
          <Button
            variant="ghost"
            size="icon"
            className="-m-2.5 lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-6 w-6" />
          </Button>

          <div className="h-6 w-px bg-neutral-200 lg:hidden" />

          <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
            {/* Search */}
            <div className="relative flex flex-1 items-center">
              <Search className="pointer-events-none absolute inset-y-0 left-0 h-full w-5 text-neutral-400 pl-3" />
              <input
                type="text"
                placeholder="Search campaigns, players..."
                className="block h-full w-full border-0 py-0 pl-10 pr-0 text-neutral-900 placeholder:text-neutral-400 focus:ring-0 sm:text-sm bg-transparent"
              / aria-label="search campaigns, players... input">
            </div>

            {/* Right side */}
            <div className="flex items-center gap-x-4 lg:gap-x-6">
              {/* Notifications */}
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="h-5 w-5" />
                <span className="absolute -top-1 -right-1 h-3 w-3 bg-error-500 rounded-full" />
              </Button>

              <div className="hidden lg:block lg:h-6 lg:w-px lg:bg-neutral-200" />

              {/* User menu */}
              <div className="relative">
                <Button
                  variant="ghost"
                  className="flex items-center gap-x-2 p-1.5"
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                >
                  <div className="h-8 w-8 rounded-full bg-primary-600 flex items-center justify-center text-white text-sm font-medium">
                    {user ? getInitials(`${user.firstName} ${user.lastName}`) : 'U'}
                  </div>
                  <span className="hidden lg:flex lg:items-center">
                    <span className="ml-2 text-sm font-medium text-neutral-900">
                      {user?.firstName} {user?.lastName}
                    </span>
                  </span>
                </Button>

                {/* User dropdown */}
                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-48 origin-top-right">
                    <Card className="py-1 shadow-lg ring-1 ring-black ring-opacity-5">
                      <div className="px-4 py-2 border-b">
                        <p className="text-sm font-medium text-neutral-900">{user?.firstName} {user?.lastName}</p>
                        <p className="text-xs text-neutral-500">{user?.email}</p>
                      </div>
                      <a
                        href="/dashboard/settings"
                        className="flex items-center px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-100"
                      >
                        <Settings className="mr-3 h-4 w-4" />
                        Settings
                      </a>
                      <button
                        onClick={handleLogout}
                        className="flex w-full items-center px-4 py-2 text-sm text-error-700 hover:bg-error-50"
                       aria-label="Click button" >
                        <LogOut className="mr-3 h-4 w-4" />
                        Sign out
                      </button>
                    </Card>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Page header */}
        {title && (
          <div className="border-b border-neutral-200 bg-white px-4 py-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold text-neutral-900">{title}</h1>
              {action}
            </div>
          </div>
        )}

        {/* Main content */}
        <main className="py-6 px-4 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
