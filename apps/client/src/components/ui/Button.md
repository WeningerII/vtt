# Button Component

## Overview

Enhanced button component with gaming-optimized features including sound effects, haptic feedback, visual effects, and mobile touch support.

## Usage

```tsx
import { Button } from './Button';

// Basic usage
<Button variant="primary" size="md">
  Click me
</Button>

// Gaming-optimized with effects
<Button 
  variant="plasma" 
  size="lg"
  soundEnabled={true}
  hapticEnabled={true}
  className="gaming-touch-target"
>
  Roll Dice
</Button>

// With icons
<Button 
  leftIcon={<Dice6 />}
  rightIcon={<ChevronRight />}
>
  Continue
</Button>
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `ButtonVariant` | `'primary'` | Visual style variant |
| `size` | `ButtonSize` | `'md'` | Size preset |
| `soundEnabled` | `boolean` | `false` | Enable click sound effects |
| `hapticEnabled` | `boolean` | `false` | Enable haptic feedback on mobile |
| `leftIcon` | `ReactNode` | - | Icon displayed before text |
| `rightIcon` | `ReactNode` | - | Icon displayed after text |
| `loading` | `boolean` | `false` | Show loading spinner |
| `disabled` | `boolean` | `false` | Disable interactions |
| `fullWidth` | `boolean` | `false` | Take full container width |

## Variants

### Visual Variants
- **`primary`** - Standard primary actions
- **`secondary`** - Secondary actions  
- **`plasma`** - Gaming primary with glow effects
- **`neural`** - Glass morphism style
- **`neon`** - Bright neon borders
- **`ghost`** - Minimal invisible background
- **`danger`** - Destructive actions
- **`success`** - Success/confirmation actions

### Size Variants
- **`xs`** - 28px height, compact spacing
- **`sm`** - 36px height, small spacing
- **`md`** - 40px height, standard spacing
- **`lg`** - 48px height, large spacing (mobile-optimized)
- **`xl`** - 56px height, extra large spacing

## Gaming Features

### Sound Effects
Button clicks can play audio feedback:

```tsx
<Button soundEnabled={true}>
  Roll Dice
</Button>
```

Requires audio context initialization in your app.

### Haptic Feedback  
Mobile devices can provide tactile feedback:

```tsx
<Button hapticEnabled={true}>
  Attack
</Button>
```

Uses navigator.vibrate() API when available.

### Visual Effects
Gaming variants include special effects:

- **Plasma**: Animated gradient background
- **Neural**: Glass morphism with backdrop blur
- **Neon**: Pulsing border animations

## Accessibility

### ARIA Support
- Automatic `role="button"` 
- `aria-disabled` for disabled state
- `aria-busy` during loading
- `aria-label` generation from content

### Keyboard Support  
- `Space` and `Enter` key activation
- Focus management with visible indicators
- Tab navigation support

### Screen Reader
- Loading state announcements
- Icon descriptions via ARIA labels
- State change notifications

## Mobile Optimization

### Touch Targets
All button sizes meet WCAG AA touch target requirements:

```tsx
// Minimum 44x44px touch target
<Button size="lg" className="gaming-touch-target">
  Mobile Action
</Button>
```

### Performance
- Hardware acceleration with `transform3d`
- Optimized animations for 60fps
- `touch-action: manipulation` to prevent zoom delays

## Examples

### Gaming Action Button
```tsx
<Button
  variant="plasma"
  size="lg"
  soundEnabled={true}
  hapticEnabled={true}
  leftIcon={<Sword className="h-5 w-5" />}
  className="w-full gaming-touch-target"
>
  Attack Enemy
</Button>
```

### Loading State
```tsx
<Button
  variant="primary"
  loading={isSubmitting}
  disabled={isSubmitting}
>
  {isSubmitting ? 'Saving...' : 'Save Character'}
</Button>
```

### Icon Only
```tsx
<Button
  variant="ghost"
  size="sm"
  aria-label="Open menu"
>
  <Menu className="h-4 w-4" />
</Button>
```

### Confirmation Dialog
```tsx
<div className="flex gap-3">
  <Button variant="ghost" onClick={onCancel}>
    Cancel
  </Button>
  <Button variant="danger" onClick={onConfirm}>
    Delete Character
  </Button>
</div>
```

## Implementation Details

### CVA Variants
The component uses `class-variance-authority` for type-safe styling:

```tsx
const buttonVariants = cva([
  "inline-flex items-center justify-center",
  "font-medium transition-all duration-200",
  "focus-visible:outline-none focus-visible:ring-2"
], {
  variants: {
    variant: {
      plasma: [
        "bg-gradient-to-r from-accent-primary to-accent-secondary",
        "text-text-primary shadow-lg hover:shadow-xl",
        "hover:from-accent-secondary hover:to-accent-primary"
      ]
    }
  }
});
```

### Performance Optimizations
- `React.memo` for re-render prevention
- `useCallback` for stable event handlers  
- Lazy loading of sound assets
- CSS `will-change` for animations

### Testing
```tsx
// Button.test.tsx
test('renders with sound effects', () => {
  render(<Button soundEnabled>Test</Button>);
  const button = screen.getByRole('button');
  
  fireEvent.click(button);
  expect(mockAudioPlay).toHaveBeenCalled();
});

test('meets accessibility standards', async () => {
  const { container } = render(<Button>Test</Button>);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```
