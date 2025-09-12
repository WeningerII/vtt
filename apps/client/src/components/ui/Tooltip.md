# Tooltip Component

## Overview

Accessible tooltip component with smart positioning, multiple variants, and gaming-optimized styling. Provides contextual information with keyboard and screen reader support.

## Usage

```tsx
import { Tooltip, SimpleTooltip } from './Tooltip';

// Basic usage
<Tooltip content="This is a helpful tooltip">
  <Button>Hover me</Button>
</Tooltip>

// Simple text tooltip utility
<SimpleTooltip text="Quick help text" placement="bottom">
  <IconButton>
    <HelpIcon />
  </IconButton>
</SimpleTooltip>

// Rich content tooltip
<Tooltip 
  content={
    <div className="space-y-2">
      <div className="font-semibold">Fireball</div>
      <div className="text-xs">3rd level evocation</div>
      <div className="text-sm">A bright streak flashes from your pointing finger...</div>
    </div>
  }
  variant="info"
  size="lg"
  placement="right"
>
  <SpellIcon spell="fireball" />
</Tooltip>

// Gaming status tooltip
<Tooltip 
  content="Health: 45/60 HP"
  variant="success"
  showArrow={true}
  delay={100}
>
  <HealthBar current={45} max={60} />
</Tooltip>
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `content` | `ReactNode` | - | Tooltip content (text or JSX) |
| `children` | `ReactElement` | - | Single child element to trigger tooltip |
| `placement` | `Placement` | `'top'` | Tooltip position relative to trigger |
| `variant` | `TooltipVariant` | `'default'` | Visual style variant |
| `size` | `TooltipSize` | `'md'` | Size preset |
| `showArrow` | `boolean` | `true` | Display arrow pointing to trigger |
| `delay` | `number` | `200` | Show delay in milliseconds |
| `hideDelay` | `number` | `100` | Hide delay in milliseconds |
| `disabled` | `boolean` | `false` | Disable tooltip display |
| `className` | `string` | - | Additional CSS classes |

## Variants

### Visual Variants
- **`default`** - Dark theme with neutral colors
- **`light`** - Light background for contrast
- **`success`** - Green theme for positive states
- **`warning`** - Yellow/orange for cautions
- **`error`** - Red theme for errors/dangers
- **`info`** - Blue theme for informational content

### Size Variants
- **`sm`** - Compact: 8px padding, 12px text
- **`md`** - Standard: 12px padding, 14px text
- **`lg`** - Large: 16px padding, 16px text, wider max-width

### Placement Options
- **`top`** - Above the trigger element
- **`bottom`** - Below the trigger element
- **`left`** - To the left of trigger element
- **`right`** - To the right of trigger element

## Gaming Interface Examples

### Spell Tooltip
```tsx
<Tooltip
  content={
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="font-bold text-purple-300">Magic Missile</span>
        <Badge variant="magic">1st Level</Badge>
      </div>
      
      <div className="text-xs text-gray-300 space-y-1">
        <div><strong>School:</strong> Evocation</div>
        <div><strong>Casting Time:</strong> 1 action</div>
        <div><strong>Range:</strong> 120 feet</div>
        <div><strong>Duration:</strong> Instantaneous</div>
      </div>
      
      <p className="text-sm leading-relaxed">
        You create three glowing darts of magical force. Each dart hits a creature 
        of your choice that you can see within range.
      </p>
      
      <div className="text-xs text-yellow-300">
        <strong>Damage:</strong> 1d4 + 1 force damage per dart
      </div>
    </div>
  }
  variant="info"
  size="lg"
  placement="right"
  className="max-w-sm"
>
  <SpellButton spell={magicMissile} />
</Tooltip>
```

### Equipment Stat Tooltip
```tsx
<Tooltip
  content={
    <div className="space-y-2">
      <div className="font-semibold text-orange-300">Flaming Longsword +1</div>
      
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>Damage: 1d8+1</div>
        <div>Fire: +1d6</div>
        <div>AC Bonus: +1</div>
        <div>Weight: 3 lbs</div>
      </div>
      
      <div className="text-xs text-gray-300 italic">
        "The blade glows with inner fire, casting dancing shadows."
      </div>
    </div>
  }
  variant="warning"
  placement="bottom"
>
  <EquipmentSlot item={flamingSword} />
</Tooltip>
```

### Character Status Tooltip
```tsx
<Tooltip
  content={
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <StatusIcon status="poisoned" className="h-4 w-4" />
        <span className="font-medium text-green-400">Poisoned</span>
      </div>
      
      <div className="text-sm space-y-1">
        <div>Duration: 3 rounds remaining</div>
        <div>Effect: Disadvantage on attack rolls</div>
        <div>Damage: 1d4 poison per turn</div>
      </div>
      
      <div className="text-xs text-gray-400">
        Save DC 15 Constitution to end early
      </div>
    </div>
  }
  variant="error"
  placement="top"
>
  <StatusEffect effect="poisoned" />
</Tooltip>
```

### Mobile-Optimized Help Tooltip
```tsx
<Tooltip
  content="Tap and hold to view detailed character stats"
  variant="default"
  size="sm"
  placement="bottom"
  delay={300} // Longer delay for touch interfaces
  className="gaming-touch-target"
>
  <Button 
    variant="ghost" 
    size="lg"
    className="h-12 w-12 rounded-full"
  >
    <HelpCircle className="h-6 w-6" />
  </Button>
</Tooltip>
```

## Smart Positioning

The tooltip automatically adjusts its position to stay within the viewport:

```tsx
// Tooltip will flip to opposite side if it would overflow
<Tooltip 
  content="This tooltip adjusts its position automatically"
  placement="top" // May show as "bottom" if near top of screen
>
  <Button>Smart positioning</Button>
</Tooltip>
```

### Collision Detection
- Automatically keeps tooltips within viewport bounds
- Maintains 8px padding from screen edges
- Preserves arrow alignment when possible

## Accessibility

### Screen Reader Support
- `role="tooltip"` for proper semantic meaning
- `aria-describedby` links tooltip to trigger element
- Content is announced when tooltip becomes visible

### Keyboard Navigation
```tsx
// Tooltip shows on focus, hides on blur
<Tooltip content="Accessible tooltip">
  <Button tabIndex={0}>Keyboard accessible</Button>
</Tooltip>
```

### Touch Device Support
```tsx
// Longer delays for touch interfaces
<Tooltip 
  content="Touch-friendly tooltip"
  delay={300}
  hideDelay={200}
>
  <TouchableElement />
</Tooltip>
```

## Performance Optimizations

### Portal Rendering
- Tooltips render in document.body to avoid z-index issues
- Prevents clipping by parent containers
- Smooth positioning calculations

### Memory Management
```tsx
// Component automatically cleans up timers
useEffect(() => {
  return () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  };
}, []);
```

### Lazy Calculation
- Position calculated only when needed
- Uses `requestAnimationFrame` for smooth updates
- Avoids unnecessary re-renders with React.memo

## Advanced Usage

### Conditional Tooltips
```tsx
const ConditionalTooltip = ({ showHelp, children }) => (
  <Tooltip 
    content="Helpful information"
    disabled={!showHelp}
  >
    {children}
  </Tooltip>
);
```

### Tooltip with Custom Delays
```tsx
<Tooltip
  content="Quick preview"
  delay={50}      // Show quickly
  hideDelay={500} // Hide slowly for easier reading
>
  <PreviewTrigger />
</Tooltip>
```

### Rich Interactive Content
```tsx
<Tooltip
  content={
    <div className="space-y-3 p-2">
      <h4 className="font-semibold">Character Actions</h4>
      <div className="space-y-1">
        <Button size="sm" variant="ghost" fullWidth>Attack</Button>
        <Button size="sm" variant="ghost" fullWidth>Cast Spell</Button>
        <Button size="sm" variant="ghost" fullWidth>Use Item</Button>
      </div>
    </div>
  }
  size="lg"
  className="interactive-tooltip"
>
  <ActionButton />
</Tooltip>
```

## Implementation Details

### CVA Variants
Type-safe styling with class-variance-authority:

```tsx
const tooltipVariants = cva([
  "absolute z-50 px-3 py-2 text-sm font-medium text-white",
  "bg-neutral-900 rounded-lg shadow-lg",
  "transition-opacity duration-200 ease-out",
  "pointer-events-none select-none max-w-xs break-words"
], {
  variants: {
    variant: {
      default: "bg-neutral-900 text-white",
      light: "bg-white text-neutral-900 border border-neutral-200",
      success: "bg-success-600 text-white",
      error: "bg-error-600 text-white"
    }
  }
});
```

### Position Calculation
```tsx
const calculatePosition = useCallback((trigger, tooltip) => {
  const triggerRect = trigger.getBoundingClientRect();
  const tooltipRect = tooltip.getBoundingClientRect();
  
  // Smart positioning logic with viewport bounds checking
  let { x, y } = getBasePosition(triggerRect, tooltipRect, placement);
  
  // Keep within viewport
  x = Math.max(padding, Math.min(x, window.innerWidth - tooltipRect.width - padding));
  y = Math.max(padding, Math.min(y, window.innerHeight - tooltipRect.height - padding));
  
  return { x, y };
}, [placement]);
```

## Testing

```tsx
// Tooltip.test.tsx
test('shows tooltip on hover with delay', async () => {
  render(
    <Tooltip content="Test tooltip" delay={100}>
      <button>Trigger</button>
    </Tooltip>
  );
  
  const trigger = screen.getByRole('button');
  fireEvent.mouseEnter(trigger);
  
  await waitFor(() => {
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
  }, { timeout: 150 });
});

test('positions tooltip correctly', () => {
  render(
    <Tooltip content="Test" placement="bottom">
      <button>Trigger</button>
    </Tooltip>
  );
  
  const trigger = screen.getByRole('button');
  fireEvent.mouseEnter(trigger);
  
  const tooltip = screen.getByRole('tooltip');
  const triggerRect = trigger.getBoundingClientRect();
  const tooltipRect = tooltip.getBoundingClientRect();
  
  expect(tooltipRect.top).toBeGreaterThan(triggerRect.bottom);
});

test('supports keyboard navigation', () => {
  render(
    <Tooltip content="Accessible tooltip">
      <button>Focusable</button>
    </Tooltip>
  );
  
  const trigger = screen.getByRole('button');
  fireEvent.focus(trigger);
  
  expect(screen.getByRole('tooltip')).toBeInTheDocument();
  
  fireEvent.blur(trigger);
  
  waitFor(() => {
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
});
```

## Best Practices

### Content Guidelines
- Keep tooltip text concise and helpful
- Use rich content sparingly to avoid overwhelming users
- Ensure tooltip content is accessible to screen readers

### Performance Tips
- Use `disabled` prop to conditionally disable tooltips
- Prefer SimpleTooltip for basic text-only tooltips
- Avoid complex interactive content in tooltips

### UX Considerations
- Use appropriate delays for the interaction context
- Choose placement that doesn't obstruct important content
- Ensure tooltips work well on both desktop and mobile devices
