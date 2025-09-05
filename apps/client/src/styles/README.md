# VTT Design System Style Guide

## Overview

This guide documents the complete migration from mixed styling approaches to a unified design system. All components now use consistent design system variables and utility classes.

## File Structure

```
src/styles/
├── design-system.css    # Core design system variables and tokens
├── components.css       # Component-specific styles using design system
├── utilities.css        # Utility classes replacing Tailwind
├── globals.css          # Global styles and resets
├── accessibility.css    # Accessibility enhancements
└── README.md           # This guide
```

## Design System Usage

### Color System

```css
/* Primary Colors */
--color-primary-50: hsl(271, 91%, 98%);
--color-primary-500: hsl(271, 91%, 65%);
--color-primary-900: hsl(271, 91%, 15%);

/* Semantic Colors */
--color-success-500: hsl(142, 76%, 36%);
--color-warning-500: hsl(38, 92%, 50%);
--color-error-500: hsl(0, 84%, 60%);

/* VTT Gaming Colors */
--health-bar: hsl(0, 100%, 50%);
--mana-bar: hsl(240, 100%, 50%);
--energy-bar: hsl(60, 100%, 50%);
```

### Surface System

```css
/* Surface Hierarchy */
--surface-base: hsl(var(--gray-900));
--surface-elevated: hsl(var(--gray-800));
--surface-overlay: hsl(var(--gray-700));
--surface-subtle: hsl(var(--gray-600));
--surface-hover: hsl(var(--gray-750));
--surface-accent: hsl(var(--primary-900) / 0.1);
```

### Typography Scale

```css
/* Font Sizes */
--font-size-xs: 0.75rem;
--font-size-sm: 0.875rem;
--font-size-base: 1rem;
--font-size-lg: 1.125rem;
--font-size-xl: 1.25rem;
--font-size-2xl: 1.5rem;
--font-size-3xl: 1.875rem;
--font-size-4xl: 2.25rem;

/* Font Weights */
--font-weight-normal: 400;
--font-weight-medium: 500;
--font-weight-semibold: 600;
--font-weight-bold: 700;
```

### Spacing System

```css
/* Spacing Scale */
--space-1: 0.25rem;   /* 4px */
--space-2: 0.5rem;    /* 8px */
--space-3: 0.75rem;   /* 12px */
--space-4: 1rem;      /* 16px */
--space-6: 1.5rem;    /* 24px */
--space-8: 2rem;      /* 32px */
--space-10: 2.5rem;   /* 40px */
--space-12: 3rem;     /* 48px */
```

## Component Patterns

### Character Sheet

```css
.character-sheet {
  background: var(--surface-elevated);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-lg);
  max-width: var(--max-width-4xl);
  margin: 0 auto;
  font-family: var(--font-sans);
}

.character-sheet .tab {
  color: var(--text-secondary);
  transition: all var(--duration-normal) var(--ease-out);
}

.character-sheet .tab.active {
  color: var(--color-accent-primary);
  border-bottom-color: var(--color-accent-primary);
}
```

### Dice Roller

```css
.dice-roller {
  background: var(--gradient-neon);
  border-radius: var(--radius-xl);
  padding: var(--space-6);
  box-shadow: var(--shadow-xl), var(--dice-glow);
  color: white;
}

.dice-button {
  background: rgba(255,255,255,0.2);
  border: 2px solid rgba(255,255,255,0.4);
  transition: all var(--duration-normal) var(--ease-bounce);
}
```

### Combat Tracker

```css
.combat-tracker {
  background: var(--surface-elevated);
  border: 2px solid var(--border-accent);
  border-radius: var(--radius-xl);
}

.initiative-item.active {
  border-color: var(--color-accent-primary);
  background: var(--surface-accent);
  box-shadow: var(--shadow-lg), 0 0 20px rgba(var(--color-accent-primary-rgb), 0.3);
}
```

## Utility Classes

### Layout

```css
.flex { display: flex; }
.flex-col { flex-direction: column; }
.justify-center { justify-content: center; }
.items-center { align-items: center; }
.gap-4 { gap: var(--space-4); }
```

### Spacing

```css
.p-4 { padding: var(--space-4); }
.px-6 { padding-left: var(--space-6); padding-right: var(--space-6); }
.my-4 { margin-top: var(--space-4); margin-bottom: var(--space-4); }
```

### Typography

```css
.text-lg { font-size: var(--font-size-lg); }
.font-bold { font-weight: var(--font-weight-bold); }
.text-primary { color: var(--text-primary); }
.text-accent { color: var(--color-accent-primary); }
```

### Background

```css
.surface-base { background-color: var(--surface-base); }
.surface-elevated { background-color: var(--surface-elevated); }
.bg-accent { background-color: var(--color-accent-primary); }
```

### Borders & Shadows

```css
.rounded-lg { border-radius: var(--radius-lg); }
.border-subtle { border-color: var(--border-subtle); }
.shadow-lg { box-shadow: var(--shadow-lg); }
```

## Migration Examples

### Before (Hardcoded Colors)

```css
/* OLD - CharacterSheet.css */
.tab {
  color: #6c757d;
  border-bottom: 3px solid transparent;
}

.tab.active {
  color: #007bff;
  border-bottom-color: #007bff;
}

.character-sheet {
  background: #f8f9fa;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}
```

### After (Design System)

```css
/* NEW - components.css */
.tab {
  color: var(--text-secondary);
  border-bottom: 3px solid transparent;
  transition: all var(--duration-normal) var(--ease-out);
}

.tab.active {
  color: var(--color-accent-primary);
  border-bottom-color: var(--color-accent-primary);
}

.character-sheet {
  background: var(--surface-elevated);
  box-shadow: var(--shadow-lg);
}
```

### Before (Tailwind Classes)

```tsx
// OLD - VTTApp.tsx
<div className="h-screen bg-gray-900 text-white flex flex-col">
  <div className="w-80 bg-gray-800 border-l border-gray-700 flex flex-col">
```

### After (Design System Utilities)

```tsx
// NEW - VTTApp.tsx
<div className="h-screen surface-base text-white flex flex-col">
  <div className="w-80 surface-elevated border-l border-subtle flex flex-col">
```

## Animation System

### Transitions

```css
/* Standard transitions */
--duration-fast: 150ms;
--duration-normal: 250ms;
--duration-slow: 350ms;

/* Easing functions */
--ease-in: cubic-bezier(0.4, 0, 1, 1);
--ease-out: cubic-bezier(0, 0, 0.2, 1);
--ease-bounce: cubic-bezier(0.34, 1.56, 0.64, 1);
```

### VTT-Specific Animations

```css
/* Dice rolling animation */
@keyframes dice-bounce {
  0% { transform: scale(0.3) rotate(-10deg); opacity: 0; }
  50% { transform: scale(1.1) rotate(5deg); }
  100% { transform: scale(1) rotate(0deg); opacity: 1; }
}

/* Health bar shimmer */
@keyframes hp-shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}
```

## Responsive Design

### Container Queries

```css
.vtt-panel {
  container-type: inline-size;
}

@container (max-width: 320px) {
  .character-sheet {
    --font-scale: 0.85;
    --space-scale: 0.8;
  }
}

@container (min-width: 1200px) {
  .character-sheet {
    --font-scale: 1.1;
    --space-scale: 1.2;
  }
}
```

### Touch-Friendly Design

```css
@media (pointer: coarse) {
  .tab {
    min-height: 44px;
    padding: var(--space-3) var(--space-4);
  }
  
  .dice-button {
    min-height: 44px;
    min-width: 44px;
  }
}
```

## Accessibility Features

### High Contrast Mode

```css
@media (prefers-contrast: high) {
  .character-sheet {
    border: 3px solid var(--text-primary);
  }
  
  .tab.active {
    background: var(--text-primary);
    color: var(--surface-base);
  }
}
```

### Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

## Performance Considerations

### GPU Acceleration

```css
.dice-container {
  will-change: transform;
  transform: translateZ(0);
  backface-visibility: hidden;
}

.token {
  transform: translate3d(var(--x), var(--y), 0);
  will-change: transform;
}
```

### Critical CSS

The design system variables are included in critical CSS for immediate rendering:

```html
<style>
  :root { /* Design system variables */ }
  .vtt-app, .loading-screen, .error-boundary { /* Essential layout */ }
</style>
```

## Development Guidelines

### Adding New Components

1. Use design system variables exclusively
2. Follow the established naming conventions
3. Include hover and focus states
4. Add container query support for responsive behavior
5. Test with high contrast and reduced motion preferences

### Color Usage

- **Never use hardcoded hex colors**
- Use semantic color names when possible
- Prefer surface hierarchy over direct color references
- Include alpha channel support for overlays

### Animation Guidelines

- Use design system timing functions
- Include reduced motion fallbacks
- Prefer transforms over layout-affecting properties
- Add `will-change` for complex animations

## Browser Support

- **Modern browsers**: Full support with all features
- **Safari 14+**: Container queries supported
- **Firefox 110+**: All features supported
- **Chrome 105+**: Full support

## Migration Checklist

- [x] Replace all hardcoded colors with design system variables
- [x] Migrate Tailwind classes to design system utilities
- [x] Update component imports to use new CSS files
- [x] Test responsive behavior with container queries
- [x] Verify accessibility compliance
- [x] Performance test with new CSS bundle

## Future Enhancements

- Dynamic theming based on campaign type
- Advanced animation system with physics
- WebGL integration for 3D dice
- Voice command integration
- Haptic feedback support
