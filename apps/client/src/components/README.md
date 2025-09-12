# VTT Component Library

## Overview

This directory contains the comprehensive UI component library for the VTT (Virtual Tabletop) application. All components follow our design system principles and accessibility standards.

## Architecture

```
components/
├── ui/                 # Core UI primitives
├── game/              # Gaming-specific components
├── character/         # D&D character management
├── map/               # Battle map and visualization
├── chat/              # Real-time communication
├── auth/              # Authentication flows
├── dashboard/         # Main application hub
└── accessibility/     # WCAG compliance utilities
```

## Design System Integration

### Core Principles
- **Dark Theme First**: All components designed for gaming environments
- **Accessibility**: WCAG 2.1 AA compliance with screen reader support
- **Performance**: Lazy loading and memoization throughout
- **Mobile Gaming**: Touch-optimized for tablet gaming

### Token Usage
All components use design system tokens from `styles/design-system.css`:

```css
/* Preferred */
color: var(--text-primary);
background: var(--bg-secondary);
border: 1px solid var(--border-primary);

/* Avoid legacy Tailwind */
color: text-gray-300; /* ❌ Don't use */
```

## Component Guidelines

### Button Component
Advanced button with sound effects, haptic feedback, and multiple variants:

```tsx
import { Button } from './ui/Button';

// Gaming-optimized button
<Button 
  variant="plasma" 
  size="lg"
  soundEnabled={true}
  hapticEnabled={true}
  className="gaming-touch-target"
>
  Roll Dice
</Button>
```

**Variants:**
- `plasma` - Primary actions with glow effects
- `neural` - Secondary with glass morphism
- `neon` - Accent with bright borders
- `ghost` - Subtle interactions
- `danger` - Destructive actions

### Input Component
Consistent form inputs with validation states:

```tsx
import { Input } from './ui/Input';

<Input
  label="Character Name"
  variant="default"
  size="md"
  error={errors.name}
  leftIcon={<User />}
/>
```

### Modal Component
Accessible modals with dark theme:

```tsx
import { Modal } from './ui/Modal';

<Modal
  isOpen={true}
  onClose={handleClose}
  variant="elevated"
  size="lg"
  title="Character Sheet"
>
  <ModalBody>Content here</ModalBody>
</Modal>
```

## Gaming Components

### DiceRoller
Enhanced dice rolling with mobile touch targets:

```tsx
import { DiceRoller } from './game/DiceRoller';

<DiceRoller 
  onRoll={handleRoll}
  className="mobile-touch-optimized"
/>
```

Features:
- Quick dice buttons (d4, d6, d8, d10, d12, d20)
- Advantage/disadvantage for D&D
- Custom dice notation support
- Roll history tracking

### CharacterSheet
Comprehensive D&D character management:

```tsx
import { CharacterSheet } from './character/CharacterSheet';

<CharacterSheet
  characterId="char_123"
  onCharacterUpdate={handleUpdate}
/>
```

Features:
- Lazy-loaded panels for performance
- Real-time WebSocket sync
- Export functionality
- Mobile-responsive tabs

## Accessibility Standards

### Focus Management
All interactive components implement proper focus handling:

```tsx
// Focus trapping in modals
const restoreFocus = FocusManager.saveFocus();
// ... modal interaction
restoreFocus();

// Screen reader announcements
FocusManager.announce("Character updated", "polite");
```

### ARIA Implementation
Components use semantic ARIA attributes:

```tsx
<button 
  aria-label="Roll twenty-sided die"
  aria-describedby="dice-help"
  role="button"
/>
```

### Reduced Motion Support
All animations respect user preferences:

```css
@media (prefers-reduced-motion: reduce) {
  .dice-animation {
    animation: none;
  }
}
```

## Performance Optimization

### Lazy Loading
Heavy components are code-split:

```tsx
const CharacterSheet = lazy(() => 
  import('./CharacterSheet').then(m => ({ default: m.CharacterSheet }))
);
```

### Memoization
Components use React optimization patterns:

```tsx
export const Button = React.memo(forwardRef<HTMLButtonElement, ButtonProps>(
  ({ onClick, ...props }, ref) => {
    const handleClick = useCallback((e) => {
      // Optimized event handling
    }, [dependencies]);
    
    return <button ref={ref} onClick={handleClick} {...props} />;
  }
));
```

### Mobile Performance
Gaming-specific optimizations:

```css
.gaming-component {
  transform: translateZ(0); /* GPU acceleration */
  will-change: transform;   /* Optimize animations */
  touch-action: manipulation; /* Prevent zoom lag */
}
```

## Testing Guidelines

### Component Testing
Each component should have corresponding tests:

```tsx
// Button.test.tsx
import { render, fireEvent, screen } from '@testing-library/react';
import { Button } from './Button';

test('renders with sound effects', () => {
  const handleClick = jest.fn();
  render(<Button onClick={handleClick} soundEnabled />);
  
  fireEvent.click(screen.getByRole('button'));
  expect(handleClick).toHaveBeenCalled();
});
```

### Accessibility Testing
Automated accessibility checks:

```bash
npm run test:a11y  # Run axe-core tests
npm run test:sr    # Screen reader compatibility
```

## Migration Guide

### From Legacy Tailwind to Design System

1. **Identify legacy classes:**
```bash
# Find components using old classes
grep -r "bg-gray-800\|text-neutral-400" src/components/
```

2. **Replace with tokens:**
```tsx
// Before
className="bg-gray-800 text-neutral-400"

// After  
className="bg-bg-secondary text-text-tertiary"
```

3. **Update variant definitions:**
```tsx
// CVA variant updates
const variants = cva([
  "bg-bg-secondary",      // ✅ Design system
  "text-text-primary",    // ✅ Design system
  "border-border-primary" // ✅ Design system
]);
```

## Contributing

### Component Checklist
- [ ] Uses design system tokens exclusively
- [ ] Implements proper ARIA attributes  
- [ ] Supports reduced motion preferences
- [ ] Includes TypeScript definitions
- [ ] Has corresponding test file
- [ ] Optimized for mobile gaming
- [ ] Follows naming conventions

### Naming Conventions
- **Components**: PascalCase (`CharacterSheet`)
- **Props**: camelCase (`onCharacterUpdate`)
- **CSS Classes**: kebab-case (`dice-roller`)
- **Test Files**: `ComponentName.test.tsx`

## Resources

- [Design System Tokens](../styles/design-system.css)
- [Accessibility Utilities](../utils/accessibility.ts)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [React Performance Patterns](https://react.dev/reference/react/memo)
