# VTT Style Migration Plan

Generated: 2025-09-03T21:14:47.328Z

## Summary

- **Total Components:** 85
- **Components Using Design System:** 0 (0.0%)
- **Components Needing Migration:** 85

## Migration Phases

### Phase 1: High Priority Components (Week 1)

These components have the most technical debt and should be migrated first:

- [ ] **RegisterPage.tsx** (366 lines)
  - Found 31 Tailwind classes
  - Complete refactor recommended
  - Migrate Tailwind classes to design system utilities
  - Start using design system variables

- [ ] **LoginPage.tsx** (252 lines)
  - Found 29 Tailwind classes
  - Complete refactor recommended
  - Migrate Tailwind classes to design system utilities
  - Start using design system variables

- [ ] **LandingPage.tsx** (343 lines)
  - Found 74 Tailwind classes
  - Complete refactor recommended
  - Migrate Tailwind classes to design system utilities
  - Start using design system variables

- [ ] **GameSession.tsx** (311 lines)
  - Found 36 Tailwind classes
  - Complete refactor recommended
  - Migrate Tailwind classes to design system utilities
  - Start using design system variables

- [ ] **Dashboard.tsx** (344 lines)
  - Found 35 Tailwind classes
  - Complete refactor recommended
  - Migrate Tailwind classes to design system utilities
  - Start using design system variables

- [ ] **CampaignBrowser.tsx** (411 lines)
  - Found 49 Tailwind classes
  - Complete refactor recommended
  - Migrate Tailwind classes to design system utilities
  - Start using design system variables

- [ ] **TokensPanel.tsx** (193 lines)
  - Found 31 Tailwind classes
  - Complete refactor recommended
  - Migrate Tailwind classes to design system utilities
  - Extract inline styles to CSS classes
  - Start using design system variables

- [ ] **PerformanceMonitor.tsx** (216 lines)
  - Found 32 Tailwind classes
  - Complete refactor recommended
  - Migrate Tailwind classes to design system utilities
  - Start using design system variables

- [ ] **ChatPanel.tsx** (279 lines)
  - Found 36 Tailwind classes
  - Complete refactor recommended
  - Migrate Tailwind classes to design system utilities
  - Start using design system variables

- [ ] **Tooltip.tsx** (238 lines)
  - Found 40 Tailwind classes
  - Complete refactor recommended
  - Migrate Tailwind classes to design system utilities
  - Extract inline styles to CSS classes
  - Start using design system variables

### Phase 2: Medium Priority Components (Week 2)

- [ ] **VTTDemo.tsx**
- [ ] **SpecificErrorBoundaries.tsx**
- [ ] **GameCanvas.tsx**
- [ ] **ErrorBoundary.tsx**
- [ ] **CreateSessionModal.tsx**
- [ ] **ChatPanel.tsx**
- [ ] **Modal.tsx**
- [ ] **Card.tsx**
- [ ] **LoginForm.tsx**

### Phase 3: Low Priority Components (Week 3)

36 components with minor adjustments needed.

## Migration Guidelines

### Color Migration

```css
/* Before */
color: #007bff;
background: #6f42c1;

/* After */
color: var(--color-accent-primary);
background: var(--gradient-plasma);
```

### Utility Class Migration

```tsx
// Before
className="bg-gray-900 text-white p-4 rounded-lg"

// After
className="surface-primary text-primary spacing-4 radius-lg"
```

