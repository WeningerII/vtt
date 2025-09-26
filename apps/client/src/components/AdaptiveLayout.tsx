/**
 * Adaptive Layout Component for VTT
 * Responsive layout system that adapts to different screen sizes and orientations
 * Optimized for mobile portrait, landscape, and tablet modes
 */

import React, { memo, useEffect, useState, useCallback } from "react";
import { cn } from "../lib/utils";
import "./AdaptiveLayout.css";

export type LayoutMode =
  | "mobile-portrait"
  | "mobile-landscape"
  | "tablet-portrait"
  | "tablet-landscape"
  | "desktop";
export type PanelPosition = "left" | "right" | "bottom" | "floating";

export interface AdaptiveLayoutProps {
  children: React.ReactNode;
  className?: string;
  onLayoutChange?: (mode: LayoutMode) => void;
}

interface LayoutConfig {
  mode: LayoutMode;
  breakpoint: { minWidth: number; maxWidth: number; orientation?: string };
  panelConfig: Record<"navigation" | "sidebar" | "toolbar", PanelPosition>;
  gridAreas: string[];
  gridTemplate: string;
}

const layoutConfigs: LayoutConfig[] = [
  {
    mode: "mobile-portrait",
    breakpoint: { minWidth: 0, maxWidth: 767, orientation: "portrait" },
    panelConfig: {
      navigation: "bottom",
      sidebar: "floating",
      toolbar: "floating",
    },
    gridAreas: ['"main"', '"nav"'],
    gridTemplate: "1fr auto / 1fr",
  },
  {
    mode: "mobile-landscape",
    breakpoint: { minWidth: 0, maxWidth: 767, orientation: "landscape" },
    panelConfig: {
      navigation: "left",
      sidebar: "right",
      toolbar: "bottom",
    },
    gridAreas: ['"nav main sidebar"', '"toolbar toolbar toolbar"'],
    gridTemplate: "1fr auto / 60px 1fr 280px",
  },
  {
    mode: "tablet-portrait",
    breakpoint: { minWidth: 768, maxWidth: 1024, orientation: "portrait" },
    panelConfig: {
      navigation: "left",
      sidebar: "right",
      toolbar: "bottom",
    },
    gridAreas: ['"nav main sidebar"', '"toolbar toolbar toolbar"'],
    gridTemplate: "1fr auto / 80px 1fr 320px",
  },
  {
    mode: "tablet-landscape",
    breakpoint: { minWidth: 768, maxWidth: 1200, orientation: "landscape" },
    panelConfig: {
      navigation: "left",
      sidebar: "right",
      toolbar: "bottom",
    },
    gridAreas: ['"nav main sidebar"'],
    gridTemplate: "1fr / 70px 1fr 380px",
  },
  {
    mode: "desktop",
    breakpoint: { minWidth: 1201, maxWidth: Infinity },
    panelConfig: {
      navigation: "left",
      sidebar: "right",
      toolbar: "bottom",
    },
    gridAreas: ['"nav main sidebar"'],
    gridTemplate: "1fr / 80px 1fr 400px",
  },
];

export const useAdaptiveLayout = () => {
  const [currentLayout, setCurrentLayout] = useState<LayoutConfig>(() => layoutConfigs[0]!);
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("portrait");

  const updateLayout = useCallback(() => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const currentOrientation = width > height ? "landscape" : "portrait";

    setOrientation(currentOrientation);

    const matchingLayout =
      layoutConfigs.find((config) => {
        const { minWidth, maxWidth, orientation: requiredOrientation } = config.breakpoint;
        const widthMatches = width >= minWidth && width <= maxWidth;
        const orientationMatches =
          !requiredOrientation || requiredOrientation === currentOrientation;
        return widthMatches && orientationMatches;
      }) ?? layoutConfigs[0]!;

    if (matchingLayout.mode !== currentLayout.mode) {
      setCurrentLayout(matchingLayout);
    }
  }, [currentLayout.mode]);

  useEffect(() => {
    updateLayout();

    const handleResize = () => updateLayout();
    const handleOrientationChange = () => {
      setTimeout(updateLayout, 150);
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleOrientationChange);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleOrientationChange);
    };
  }, [updateLayout]);

  return {
    layout: currentLayout,
    orientation,
    isMobile: currentLayout.mode.includes("mobile"),
    isTablet: currentLayout.mode.includes("tablet"),
    isDesktop: currentLayout.mode === "desktop",
    isLandscape: orientation === "landscape",
    isPortrait: orientation === "portrait",
  };
};

const AdaptiveLayoutBase: React.FC<AdaptiveLayoutProps> = ({
  children,
  className,
  onLayoutChange,
}) => {
  const { layout, orientation } = useAdaptiveLayout();

  useEffect(() => {
    onLayoutChange?.(layout.mode);
  }, [layout.mode, onLayoutChange]);

  return (
    <div
      className={cn(
        "adaptive-layout h-screen w-screen overflow-hidden adaptive-layout-grid",
        `layout-${layout.mode}`,
        `orientation-${orientation}`,
        className,
      )}
      data-layout={layout.mode}
      data-orientation={orientation}
    >
      {children}
    </div>
  );
};

export interface AdaptivePanelProps {
  children: React.ReactNode;
  panelType: "navigation" | "sidebar" | "toolbar" | "main";
  className?: string;
}

const resolveGridArea = (panelType: AdaptivePanelProps["panelType"]) => {
  switch (panelType) {
    case "navigation":
      return "nav";
    case "sidebar":
      return "sidebar";
    case "toolbar":
      return "toolbar";
    case "main":
    default:
      return "main";
  }
};

const AdaptivePanelBase: React.FC<AdaptivePanelProps> = ({ children, panelType, className }) => {
  const { layout, isMobile, isTablet } = useAdaptiveLayout();
  const config = layout.panelConfig[panelType];
  const gridAreaClass = `grid-area-${resolveGridArea(panelType)}`;

  return (
    <div
      className={cn(
        `adaptive-panel panel-${panelType}`,
        `panel-position-${config || "floating"}`,
        gridAreaClass,
        {
          "mobile-panel": isMobile,
          "tablet-panel": isTablet,
          "panel-floating": config === "floating",
          "panel-docked": config !== "floating",
          "navigation-panel": panelType === "navigation",
          "sidebar-panel": panelType === "sidebar",
          "toolbar-panel": panelType === "toolbar",
          "main-panel": panelType === "main",
        },
        className,
      )}
    >
      {children}
    </div>
  );
};

type ResponsiveContainerProps = {
  children: React.ReactNode;
  className?: string;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "full";
};

const ResponsiveContainerBase: React.FC<ResponsiveContainerProps> = ({
  children,
  className,
  maxWidth = "full",
}) => {
  const { isMobile, isTablet } = useAdaptiveLayout();

  const maxWidthClasses: Record<NonNullable<ResponsiveContainerProps["maxWidth"]>, string> = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
    "2xl": "max-w-2xl",
    full: "max-w-full",
  };

  return (
    <div
      className={cn(
        "responsive-container mx-auto",
        maxWidthClasses[maxWidth],
        {
          "px-4": isMobile,
          "px-6": isTablet,
          "px-8": !isMobile && !isTablet,
        },
        className,
      )}
    >
      {children}
    </div>
  );
};

export const AdaptiveLayout = memo(AdaptiveLayoutBase);
AdaptiveLayout.displayName = "AdaptiveLayout";

export const AdaptivePanel = memo(AdaptivePanelBase);
AdaptivePanel.displayName = "AdaptivePanel";

export const ResponsiveContainer = memo(ResponsiveContainerBase);
ResponsiveContainer.displayName = "ResponsiveContainer";

export default AdaptiveLayout;
