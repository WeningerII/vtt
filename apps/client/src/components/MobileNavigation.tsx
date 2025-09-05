/**
 * Mobile Navigation Component for VTT
 * Provides touch-friendly panel navigation for mobile devices
 */

import React from 'react';
import { useVTTLayout } from '../hooks/useVTTLayout';

interface MobileNavigationProps {
  className?: string;
}

export function MobileNavigation({ className = '' }: MobileNavigationProps) {
  const { 
    layoutState, 
    togglePanel, 
    getPanelProps,
    isMobile 
  } = useVTTLayout();

  if (!isMobile) {return null;}

  const navItems = [
    {
      id: 'map' as const,
      label: 'Map',
      icon: (
        <svg viewBox="0 0 24 24" fill="currentColor" className="panel-nav-icon">
          <path d="M20.5 3l-.16.03L15 5.1 9 3 3.36 4.9c-.21.07-.36.25-.36.48V20.5c0 .28.22.5.5.5l.16-.03L9 18.9l6 2.1 5.64-1.9c.21-.07.36-.25.36-.48V3.5c0-.28-.22-.5-.5-.5zM10 5.47l4 1.4v11.66l-4-1.4V5.47zm-5 .99l3-1.01v11.7l-3 1.16V6.46zm14 11.08l-3 1.01V6.86l3-1.16v11.84z"/>
        </svg>
      )
    },
    {
      id: 'chat' as const,
      label: 'Chat',
      icon: (
        <svg viewBox="0 0 24 24" fill="currentColor" className="panel-nav-icon">
          <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/>
        </svg>
      )
    },
    {
      id: 'tokens' as const,
      label: 'Tokens',
      icon: (
        <svg viewBox="0 0 24 24" fill="currentColor" className="panel-nav-icon">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
        </svg>
      )
    },
    {
      id: 'character' as const,
      label: 'Character',
      icon: (
        <svg viewBox="0 0 24 24" fill="currentColor" className="panel-nav-icon">
          <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
        </svg>
      )
    },
    {
      id: 'dice' as const,
      label: 'Dice',
      icon: (
        <svg viewBox="0 0 24 24" fill="currentColor" className="panel-nav-icon">
          <path d="M5 3H4a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h1v2a2 2 0 0 0 2 2h3a2 2 0 0 0 2-2v-1h2a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-3a2 2 0 0 0-2 2v1H5V3z"/>
        </svg>
      )
    }
  ];

  return (
    <nav className={`panel-nav ${className}`}>
      {navItems.map((item) => {
        const panelProps = getPanelProps(item.id);
        const isActive = panelProps.isActive;
        
        return (
          <button
            key={item.id}
            className={`panel-nav-item touch-feedback ${isActive ? 'active' : ''}`}
            onClick={() => togglePanel(item.id)}
            aria-label={`Toggle ${item.label} panel`}
            data-gesture-target={item.id}
          >
            {item.icon}
            <span className="panel-nav-label">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

export default MobileNavigation;
