/**
 * Router Component - Handles application routing and navigation
 */

import React, { useState, useEffect, lazy, Suspense } from "react";

import { useAuth } from "../providers/AuthProvider";
import { useGame } from "../providers/GameProvider";
import { LoadingSpinner } from "./ui/LoadingSpinner";

// Lazy load route components for code splitting
const LoginPage = lazy(() => import("../pages/LoginPage").then((m) => ({ default: m.LoginPage })));
const RegisterPage = lazy(() =>
  import("../pages/RegisterPage").then((m) => ({ default: m.RegisterPage })),
);
const Dashboard = lazy(() => import("../pages/Dashboard").then((m) => ({ default: m.Dashboard })));
const LandingPage = lazy(() => import("../pages/LandingPage").then((m) => ({ default: m.LandingPage })));
const GameSession = lazy(() =>
  import("../pages/GameSession").then((m) => ({ default: m.GameSession })),
);
const CharacterEditor = lazy(() =>
  import("../pages/CharacterEditor").then((m) => ({ default: m.CharacterEditor })),
);
const CampaignBrowser = lazy(() =>
  import("../pages/CampaignBrowser").then((m) => ({ default: m.CampaignBrowser })),
);
const Settings = lazy(() => import("../pages/Settings").then((m) => ({ default: m.Settings })));

export type Route =
  | "/"
  | "/login"
  | "/register"
  | "/dashboard"
  | "/session/:id"
  | "/characters"
  | "/characters/:id"
  | "/campaigns"
  | "/campaigns/:id"
  | "/settings"
  | "/404";

interface RouteParams {
  [key: string]: string;
}

function parseRoute(path: string): { route: Route; params: RouteParams } {
  const parts = path.split("?");
  const cleanPath = (parts.length > 0 ? parts[0] : "") as string; // Remove query params, ensure string

  // Simple route matching
  if (cleanPath === "/" || cleanPath === "") {return { route: "/", params: {} };}
  if (cleanPath === "/login") {return { route: "/login", params: {} };}
  if (cleanPath === "/register") {return { route: "/register", params: {} };}
  if (cleanPath === "/dashboard") {return { route: "/dashboard", params: {} };}
  if (cleanPath === "/characters") {return { route: "/characters", params: {} };}
  if (cleanPath === "/campaigns") {return { route: "/campaigns", params: {} };}
  if (cleanPath === "/settings") {return { route: "/settings", params: {} };}

  // Dynamic routes
  const sessionMatch = cleanPath.match(/^\/session\/([^/]+)$/);
  if (sessionMatch) {
    return { route: "/session/:id", params: { id: sessionMatch[1]! } };
  }

  const characterMatch = cleanPath.match(/^\/characters\/([^/]+)$/);
  if (characterMatch) {
    return { route: "/characters/:id", params: { id: characterMatch[1]! } };
  }

  const campaignMatch = cleanPath.match(/^\/campaigns\/([^/]+)$/);
  if (campaignMatch) {
    return { route: "/campaigns/:id", params: { id: campaignMatch[1]! } };
  }

  return { route: "/404", params: {} };
}

export function Router() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { session } = useGame();
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const [isLoading, setIsLoading] = useState(true);

  // Listen for navigation changes
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Initial loading state
  useEffect(() => {
    if (!authLoading) {
      setIsLoading(false);
    }
  }, [authLoading]);

  // Navigate programmatically
  const navigate = (path: string, _replace = false) => {
    if (_replace) {
      window.history.replaceState(null, "", path);
    } else {
      window.history.pushState(null, "", path);
    }
    setCurrentPath(path);
  };

  // Optional redirect logic for authenticated users on auth pages only
  useEffect(() => {
    const { route } = parseRoute(currentPath);

    // Redirect authenticated users away from login/register pages
    if (isAuthenticated && (route === "/login" || route === "/register")) {
      navigate("/dashboard", true);
    }
  }, [isAuthenticated, currentPath]); // Removed navigate and authLoading to prevent infinite loops

  if (isLoading || authLoading) {
    return (
      <div className="router-loading">
        <LoadingSpinner size="lg" />
        <p>Loading application...</p>
      </div>
    );
  }

  const { route, params } = parseRoute(currentPath);

  // Navigation helper for child components
  const routerContext = { navigate, currentPath, params };

  // Render appropriate component based on route with lazy loading
  const renderRoute = () => {
    switch (route) {
      case "/":
        // Root route: show Landing for guests, Dashboard for authenticated users
        return isAuthenticated ? (
          <Dashboard router={routerContext} />
        ) : (
          <LandingPage router={routerContext} />
        );

      case "/login":
        return <LoginPage router={routerContext} />;

      case "/register":
        return <RegisterPage router={routerContext} />;

      case "/dashboard":
        return <Dashboard router={routerContext} />;

      case "/session/:id":
        return <GameSession sessionId={params.id!} router={routerContext} />;

      case "/characters":
        return <CharacterEditor />;

      case "/characters/:id":
        return <CharacterEditor />;

      case "/campaigns":
        return <CampaignBrowser router={routerContext} />;

      case "/campaigns/:id":
        return <CampaignBrowser campaignId={params.id!} router={routerContext} />;

      case "/settings":
        return <Settings router={routerContext} />;

      case "/404":
      default:
        return (
          <div className="error-page">
            <h1>404 - Page Not Found</h1>
            <p>The page you're looking for doesn't exist.</p>
            <button
              onClick={() => navigate("/dashboard")}
              className="btn btn-primary"
              aria-label="Go to Dashboard"
            >
              Go to Dashboard
            </button>
          </div>
        );
    }
  };

  return (
    <Suspense
      fallback={
        <div className="router-loading">
          <LoadingSpinner size="lg" showLabel label="Loading page..." />
        </div>
      }
    >
      {renderRoute()}
    </Suspense>
  );
}

// Navigation hook for components
export function useRouter() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const navigate = (path: string, _replace = false) => {
    if (_replace) {
      window.history.replaceState(null, "", path);
    } else {
      window.history.pushState(null, "", path);
    }
    setCurrentPath(path);
  };

  const { route, params } = parseRoute(currentPath);

  return {
    currentPath,
    route,
    params,
    navigate,
  };
}
