/**
 * Loading Spinner Component - Flexible loading indicator with multiple sizes and variants
 */

import React from "react";
import { cn } from "../../lib/utils";
// Variants implemented without class-variance-authority
const baseSpinner = "rounded-full border-solid";
const variantClassMap = {
  primary: "border-accent-primary border-t-transparent",
  secondary: "border-text-secondary border-t-transparent",
  white: "border-white border-t-transparent",
  success: "border-success border-t-transparent",
  warning: "border-warning border-t-transparent",
  error: "border-error border-t-transparent",
} as const;

const sizeClassMap = {
  xs: "h-3 w-3 border-[1px]",
  sm: "h-4 w-4 border-[1.5px]",
  md: "h-6 w-6 border-2",
  lg: "h-8 w-8 border-2",
  xl: "h-12 w-12 border-[3px]",
  "2xl": "h-16 w-16 border-4",
} as const;

const speedClassMap = {
  slow: "animate-spin-slow",
  normal: "animate-spin",
  fast: "animate-spin-fast",
} as const;

type SpinnerVariant = keyof typeof variantClassMap;
type SpinnerSize = keyof typeof sizeClassMap;
type SpinnerSpeed = keyof typeof speedClassMap;

const containerBase = "flex items-center justify-center";
const fullScreenClass = "fixed inset-0 bg-bg-overlay z-50";

export interface LoadingSpinnerProps {
  className?: string;
  label?: string;
  showLabel?: boolean;
  variant?: SpinnerVariant;
  size?: SpinnerSize;
  speed?: SpinnerSpeed;
  fullScreen?: boolean;
}

export const LoadingSpinner = React.memo(function LoadingSpinner({
  variant = "primary",
  size = "md",
  speed = "normal",
  fullScreen,
  className,
  label = "Loading...",
  showLabel = false,
}: LoadingSpinnerProps): JSX.Element {
  const content = (
    <div className="flex flex-col items-center gap-3">
      <div
        className={cn(
          baseSpinner,
          speedClassMap[speed],
          variantClassMap[variant],
          sizeClassMap[size],
          className,
        )}
        role="status"
        aria-label={label}
      />
      {showLabel && <span className="text-sm text-text-secondary animate-pulse">{label}</span>}
    </div>
  );

  if (fullScreen) {
    return <div className={cn(containerBase, fullScreen && fullScreenClass)}>{content}</div>;
  }

  return content;
});

// Preset spinner configurations for common use cases
export const _SpinnerPresets = {
  Button: (props?: Partial<LoadingSpinnerProps>) => (
    <LoadingSpinner size="sm" variant="white" {...props} />
  ),
  Page: (props?: Partial<LoadingSpinnerProps>) => (
    <LoadingSpinner size="xl" variant="primary" showLabel label="Loading page..." {...props} />
  ),
  Modal: (props?: Partial<LoadingSpinnerProps>) => (
    <LoadingSpinner size="lg" variant="primary" showLabel label="Processing..." {...props} />
  ),
  Inline: (props?: Partial<LoadingSpinnerProps>) => (
    <LoadingSpinner size="sm" variant="secondary" {...props} />
  ),
  FullScreen: (props?: Partial<LoadingSpinnerProps>) => (
    <LoadingSpinner
      size="2xl"
      variant="primary"
      fullScreen
      showLabel
      label="Loading application..."
      {...props}
    />
  ),
};

// Loading overlay component for wrapping content
export interface LoadingOverlayProps {
  isLoading: boolean;
  children: React.ReactNode;
  spinner?: React.ReactNode;
  className?: string;
}

export function LoadingOverlay({ isLoading, children, spinner, className }: LoadingOverlayProps) {
  return (
    <div className={cn("relative", className)}>
      {children}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-bg-overlay rounded-lg">
          {spinner || <LoadingSpinner variant="primary" size="lg" showLabel />}
        </div>
      )}
    </div>
  );
}

// Skeleton loading component for content placeholders
export interface SkeletonProps {
  className?: string;
  variant?: "text" | "circular" | "rectangular" | "rounded";
  animation?: "pulse" | "wave" | "none";
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className,
  variant = "rectangular",
  animation = "pulse",
}: SkeletonProps) => {
  return (
    <div
      className={cn(
        "bg-bg-secondary",
        {
          "animate-pulse": animation === "pulse",
          "animate-wave": animation === "wave",
          "rounded-full": variant === "circular",
          rounded: variant === "rounded",
          "rounded-md": variant === "rectangular",
          "rounded-sm h-4": variant === "text",
        },
        className,
      )}
      role="presentation"
      aria-label="Loading content"
    />
  );
};

// Common skeleton patterns
export const _SkeletonPatterns = {
  Text: ({ lines = 3 }: { lines?: number }) => (
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          variant="text"
          className={cn(
            "h-4",
            i === lines - 1 ? "w-3/4" : "w-full", // Last line shorter
          )}
        />
      ))}
    </div>
  ),

  Card: () => (
    <div className="space-y-4">
      <Skeleton className="h-48 w-full" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    </div>
  ),

  Avatar: ({ size = "md" }: { size?: "sm" | "md" | "lg" }) => (
    <Skeleton
      variant="circular"
      className={cn({
        "h-8 w-8": size === "sm",
        "h-12 w-12": size === "md",
        "h-16 w-16": size === "lg",
      })}
    />
  ),

  Button: () => <Skeleton className="h-10 w-24 rounded-lg" />,

  Table: ({ rows = 5 }: { rows?: number }) => (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex space-x-4">
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-4 w-1/6" />
          <Skeleton className="h-4 w-1/4" />
        </div>
      ))}
    </div>
  ),
};
