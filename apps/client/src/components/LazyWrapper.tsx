/**
 * Lazy Wrapper Component - Provides consistent loading states for lazy-loaded components
 */

import React, { Suspense, ComponentType } from "react";
import { LoadingSpinner } from "./ui/LoadingSpinner";

interface LazyWrapperProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  minHeight?: string;
  className?: string;
}

export const LazyWrapper: React.FC<LazyWrapperProps> = ({
  children,
  fallback,
  minHeight = "200px",
  className = "",
}) => {
  const defaultFallback = (
    <div
      className={`lazy-loading-container ${className}`}
      style={{ minHeight, display: "flex", alignItems: "center", justifyContent: "center" }}
    >
      <LoadingSpinner size="md" showLabel label="Loading component..." />
    </div>
  );

  return <Suspense fallback={fallback || defaultFallback}>{children}</Suspense>;
};

// Higher-order component for wrapping lazy components
export function withLazyWrapper<P extends object>(
  Component: ComponentType<P>,
  options?: {
    fallback?: React.ReactNode;
    minHeight?: string;
    className?: string;
  },
) {
  return React.forwardRef<any, P>((props, ref) => (
    <LazyWrapper {...options}>
      <Component {...props} ref={ref} />
    </LazyWrapper>
  ));
}

// Preload function for critical components
export function preloadComponent(importFn: () => Promise<any>) {
  // Preload on user interaction or idle time
  if ("requestIdleCallback" in window) {
    requestIdleCallback(() => {
      importFn();
    });
  } else {
    // Fallback for browsers without requestIdleCallback
    setTimeout(() => {
      importFn();
    }, 100);
  }
}

// Intersection observer based lazy loading for components
export function useLazyLoad(threshold = 0.1) {
  const [isVisible, setIsVisible] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold },
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, [threshold]);

  return { ref, isVisible };
}
