/**
 * Adaptive Layout Component for VTT
 * Responsive layout system that adapts to different screen sizes and orientations
 * Optimized for mobile portrait, landscape, and tablet modes
 */

import React, { memo, useEffect, useState, useCallback } from 'react';
import { cn } from '../lib/utils';

export type LayoutMode = 'mobile-portrait' | 'mobile-landscape' | 'tablet-portrait' | 'tablet-landscape' | 'desktop';
export type PanelPosition = 'left' | 'right' | 'bottom' | 'floating';

interface AdaptiveLayoutProps {
  children: React.ReactNode;
  className?: string;
  onLayoutChange?: (mode: LayoutMode) => void;
}

interface LayoutConfig {
  mode: LayoutMode;
  breakpoint: { minWidth: number; maxWidth: number; orientation?: string };
  panelConfig: {
    navigation: PanelPosition;
    sidebar: PanelPosition;
    toolbar: PanelPosition;
  };
  gridAreas: string[];
  gridTemplate: string;
}

const layoutConfigs: LayoutConfig[] = [
  // Mobile Portrait (< 768px, portrait)
  {
    mode: 'mobile-portrait',
    breakpoint: { minWidth: 0, maxWidth: 767, orientation: 'portrait' },
    panelConfig: {
      navigation: 'bottom',
      sidebar: 'floating',
      toolbar: 'floating'
    },
    gridAreas: ['"main"', '"nav"'],
    gridTemplate: '1fr auto / 1fr'
  },

  // Mobile Landscape (< 768px, landscape)
  {
    mode: 'mobile-landscape',
    breakpoint: { minWidth: 0, maxWidth: 767, orientation: 'landscape' },
    panelConfig: {
      navigation: 'left',
      sidebar: 'right',
      toolbar: 'bottom'
    },
    gridAreas: ['"nav main sidebar"', '"toolbar toolbar toolbar"'],
    gridTemplate: '1fr auto / 60px 1fr 280px'
  },

  // Tablet Portrait (768px - 1024px, portrait)
  {
    mode: 'tablet-portrait',
    breakpoint: { minWidth: 768, maxWidth: 1024, orientation: 'portrait' },
    panelConfig: {
      navigation: 'left',
      sidebar: 'right',
      toolbar: 'bottom'
    },
    gridAreas: ['"nav main sidebar"', '"toolbar toolbar toolbar"'],
    gridTemplate: '1fr auto / 80px 1fr 320px'
  },

  // Tablet Landscape (768px - 1200px, landscape)
  {
    mode: 'tablet-landscape',
    breakpoint: { minWidth: 768, maxWidth: 1200, orientation: 'landscape' },
    panelConfig: {
      navigation: 'left',
      sidebar: 'right',
      toolbar: 'bottom'
    },
    gridAreas: ['"nav main sidebar"'],
    gridTemplate: '1fr / 70px 1fr 380px'
  },

  // Desktop (> 1200px)
  {
    mode: 'desktop',
    breakpoint: { minWidth: 1201, maxWidth: Infinity },
    panelConfig: {
      navigation: 'left',
      sidebar: 'right',
      toolbar: 'bottom'
    },
    gridAreas: ['"nav main sidebar"'],
    gridTemplate: '1fr / 80px 1fr 400px'
  }
];

export const useAdaptiveLayout = () => {
  const [currentLayout, setCurrentLayout] = useState<LayoutConfig>(() => layoutConfigs[0]!);
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');

  const updateLayout = useCallback(() => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const currentOrientation = width > height ? 'landscape' : 'portrait';
    
    setOrientation(currentOrientation);

    const matchingLayout: LayoutConfig | undefined = layoutConfigs.find(config => {
      const { minWidth, maxWidth, orientation: requiredOrientation } = config.breakpoint;
      const widthMatches = width >= minWidth && width <= maxWidth;
      const orientationMatches = !requiredOrientation || requiredOrientation === currentOrientation;
      return widthMatches && orientationMatches;
    }) ?? layoutConfigs[0]!; // Default fallback

    if (matchingLayout.mode !== currentLayout.mode) {
      setCurrentLayout(matchingLayout);
    }
  }, [currentLayout.mode]);

  useEffect(() => {
    updateLayout();
    
    const handleResize = () => updateLayout();
    const handleOrientationChange = () => {
      // Delay to ensure dimensions are updated after orientation change
      setTimeout(updateLayout, 150);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleOrientationChange);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleOrientationChange);
    };
  }, [updateLayout]);

  return {
    layout: currentLayout,
    orientation,
    isMobile: currentLayout.mode.includes('mobile'),
    isTablet: currentLayout.mode.includes('tablet'),
    isDesktop: currentLayout.mode === 'desktop',
    isLandscape: orientation === 'landscape',
    isPortrait: orientation === 'portrait'
  };
};

export const AdaptiveLayout = memo<AdaptiveLayoutProps>(({
  children,
  className,
  onLayoutChange
}) => {
  const { layout, orientation } = useAdaptiveLayout();

  useEffect(() => {
    onLayoutChange?.(layout.mode);
  }, [layout.mode, onLayoutChange]);

  return (
    <div
      className={cn(
        'adaptive-layout h-screen w-screen overflow-hidden',
        `layout-${layout.mode}`,
        `orientation-${orientation}`,
        className
      )}
      style={{
        display: 'grid',
        gridTemplate: layout.gridTemplate,
        gridTemplateAreas: layout.gridAreas.map(area => `"${area}"`).join(' ')
      }}
      data-layout={layout.mode}
      data-orientation={orientation}
    >
      {children}
    </div>
  );
});

// Layout-aware panel wrapper
interface AdaptivePanelProps {
  children: React.ReactNode;
  panelType: 'navigation' | 'sidebar' | 'toolbar' | 'main';
  className?: string;
}

export const AdaptivePanel = memo<AdaptivePanelProps>(({
  children,
  panelType,
  className
}) => {
  const { layout, isMobile, isTablet } = useAdaptiveLayout();
  const config = layout.panelConfig[panelType as keyof typeof layout.panelConfig];

  return (
    <div
      className={cn(
        `adaptive-panel panel-${panelType}`,
        `panel-position-${config || 'floating'}`,
        {
          // Mobile-specific styles
          'mobile-panel': isMobile,
          'tablet-panel': isTablet,
          
          // Position-specific styles
          'panel-floating': config === 'floating',
          'panel-docked': config !== 'floating',
          
          // Panel type styles
          'navigation-panel': panelType === 'navigation',
          'sidebar-panel': panelType === 'sidebar',
          'toolbar-panel': panelType === 'toolbar',
          'main-panel': panelType === 'main'
        },
        className
      )}
      style={{
        gridArea: panelType === 'main' ? 'main' : 
                 panelType === 'navigation' ? 'nav' : 
                 panelType === 'sidebar' ? 'sidebar' : 
                 panelType === 'toolbar' ? 'toolbar' : 'auto'
      }}
    >
      {children}
    </div>
  );
});

// Enhanced responsive utilities
export const ResponsiveContainer = memo<{
  children: React.ReactNode;
  className?: string;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
}>(({
  children,
  className,
  maxWidth = 'full'
}) => {
  const { isMobile, isTablet } = useAdaptiveLayout();
  
  const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md', 
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    full: 'max-w-full'
  };

  return (
    <div className={cn(
      'responsive-container mx-auto',
      maxWidthClasses[maxWidth],
      {
        'px-4': isMobile,
        'px-6': isTablet,
        'px-8': !isMobile && !isTablet
      },
      className
    )}>
      {children}
    </div>
  );
});

export default AdaptiveLayout;
