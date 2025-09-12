# Badge Component

## Overview

Compact label component for displaying status, categories, counts, and metadata. Designed with gaming-specific variants and optimized for dark theme interfaces.

## Usage

```tsx
import { Badge } from './Badge';

// Basic usage
<Badge>New</Badge>

// With variants
<Badge variant="secondary">Level 5</Badge>
<Badge variant="destructive">Critical</Badge>
<Badge variant="outline">Optional</Badge>

// Gaming contexts
<Badge variant="default" className="bg-purple-600">
  Magic Item
</Badge>

// With icons
<Badge className="flex items-center gap-1">
  <Star className="h-3 w-3" />
  Legendary
</Badge>
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `BadgeVariant` | `'default'` | Visual style variant |
| `className` | `string` | - | Additional CSS classes |
| `children` | `ReactNode` | - | Badge content |

## Variants

### Visual Variants
- **`default`** - Primary brand colors with solid background
- **`secondary`** - Muted colors for secondary information
- **`destructive`** - Red theme for warnings and critical states
- **`outline`** - Transparent background with border

## Gaming Interface Examples

### Character Level Badge
```tsx
<div className="flex items-center gap-2">
  <Avatar src={character.portrait} size="sm" />
  <span className="font-medium">{character.name}</span>
  <Badge variant="default" className="bg-blue-600">
    Level {character.level}
  </Badge>
</div>
```

### Item Rarity Badges
```tsx
const RarityBadge = ({ rarity }) => {
  const rarityStyles = {
    common: "bg-gray-600 text-white",
    uncommon: "bg-green-600 text-white", 
    rare: "bg-blue-600 text-white",
    epic: "bg-purple-600 text-white",
    legendary: "bg-orange-600 text-white"
  };

  return (
    <Badge className={rarityStyles[rarity]}>
      {rarity.charAt(0).toUpperCase() + rarity.slice(1)}
    </Badge>
  );
};

// Usage
<div className="space-y-2">
  <RarityBadge rarity="common" />
  <RarityBadge rarity="legendary" />
</div>
```

### Status Effect Badges
```tsx
const StatusBadges = ({ effects }) => (
  <div className="flex flex-wrap gap-2">
    {effects.map(effect => {
      const statusColors = {
        poisoned: "bg-green-700 text-green-100",
        blessed: "bg-yellow-600 text-yellow-100",
        cursed: "bg-red-700 text-red-100",
        invisible: "bg-gray-600 text-gray-100",
        hasted: "bg-blue-600 text-blue-100"
      };
      
      return (
        <Badge 
          key={effect.id}
          className={cn(
            "text-xs",
            statusColors[effect.type] || "bg-gray-600"
          )}
        >
          <StatusIcon type={effect.type} className="h-3 w-3 mr-1" />
          {effect.name}
        </Badge>
      );
    })}
  </div>
);
```

### Spell School Badges
```tsx
const SpellSchoolBadge = ({ school }) => {
  const schoolStyles = {
    abjuration: "bg-blue-700 text-blue-100",
    conjuration: "bg-purple-700 text-purple-100", 
    divination: "bg-yellow-700 text-yellow-100",
    enchantment: "bg-pink-700 text-pink-100",
    evocation: "bg-red-700 text-red-100",
    illusion: "bg-indigo-700 text-indigo-100",
    necromancy: "bg-gray-800 text-gray-100",
    transmutation: "bg-green-700 text-green-100"
  };

  return (
    <Badge className={cn("text-xs", schoolStyles[school])}>
      {school}
    </Badge>
  );
};
```

### Combat Tracker Badges
```tsx
const CombatantBadge = ({ combatant }) => {
  const getHealthBadge = (hp, maxHp) => {
    const percentage = (hp / maxHp) * 100;
    
    if (percentage > 75) {
      return <Badge className="bg-green-600 text-xs">Healthy</Badge>;
    } else if (percentage > 50) {
      return <Badge className="bg-yellow-600 text-xs">Wounded</Badge>;
    } else if (percentage > 25) {
      return <Badge className="bg-orange-600 text-xs">Bloodied</Badge>;
    } else if (percentage > 0) {
      return <Badge variant="destructive" className="text-xs">Critical</Badge>;
    } else {
      return <Badge className="bg-gray-800 text-xs">Down</Badge>;
    }
  };

  return (
    <div className="flex items-center gap-2">
      <span>{combatant.name}</span>
      {getHealthBadge(combatant.hp, combatant.maxHp)}
      {combatant.isPlayer && (
        <Badge variant="outline" className="text-xs">
          Player
        </Badge>
      )}
    </div>
  );
};
```

### Notification Count Badge
```tsx
const NotificationBadge = ({ count, max = 99 }) => {
  if (count === 0) return null;
  
  const displayCount = count > max ? `${max}+` : count.toString();
  
  return (
    <Badge 
      variant="destructive"
      className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 text-xs flex items-center justify-center"
    >
      {displayCount}
    </Badge>
  );
};

// Usage with icon button
<div className="relative">
  <Button variant="ghost" size="sm">
    <Bell className="h-5 w-5" />
  </Button>
  <NotificationBadge count={12} />
</div>
```

### Inventory Tags
```tsx
const InventoryItem = ({ item }) => (
  <Card className="p-3">
    <div className="flex items-start justify-between">
      <div className="space-y-1">
        <h4 className="font-medium">{item.name}</h4>
        <p className="text-sm text-gray-400">{item.description}</p>
      </div>
      
      <div className="flex flex-col gap-1">
        <RarityBadge rarity={item.rarity} />
        
        {item.isEquipped && (
          <Badge variant="secondary" className="text-xs">
            Equipped
          </Badge>
        )}
        
        {item.isAttuned && (
          <Badge className="bg-purple-600 text-xs">
            Attuned
          </Badge>
        )}
        
        {item.quantity > 1 && (
          <Badge variant="outline" className="text-xs">
            ×{item.quantity}
          </Badge>
        )}
      </div>
    </div>
  </Card>
);
```

### Campaign Tags
```tsx
const CampaignCard = ({ campaign }) => (
  <Card>
    <CardHeader>
      <div className="flex items-start justify-between">
        <div>
          <CardTitle>{campaign.name}</CardTitle>
          <CardDescription>{campaign.system}</CardDescription>
        </div>
        
        <div className="flex flex-wrap gap-1">
          <Badge 
            variant={campaign.isActive ? "default" : "secondary"}
            className="text-xs"
          >
            {campaign.isActive ? "Active" : "Inactive"}
          </Badge>
          
          <Badge variant="outline" className="text-xs">
            {campaign.playerCount} Players
          </Badge>
          
          {campaign.isRecruiting && (
            <Badge className="bg-green-600 text-xs">
              Recruiting
            </Badge>
          )}
        </div>
      </div>
    </CardHeader>
  </Card>
);
```

## Design System Integration

### Color System
Badges use semantic color tokens from the design system:

```css
/* Default variant */
background: var(--color-primary);
color: var(--color-primary-foreground);

/* Secondary variant */  
background: var(--color-secondary);
color: var(--color-secondary-foreground);

/* Destructive variant */
background: var(--color-destructive);
color: var(--color-destructive-foreground);

/* Outline variant */
border: 1px solid var(--color-border);
color: var(--color-foreground);
```

### Typography Scale
Consistent text sizing with design tokens:

```css
font-size: 0.75rem; /* text-xs */
font-weight: 600;   /* font-semibold */
line-height: 1;
```

## Accessibility

### Semantic Markup
```tsx
// Badge with semantic meaning
<Badge role="status" aria-label="User is online">
  Online
</Badge>

// Informational badge
<Badge role="img" aria-label="Level 15 character">
  Lv. 15
</Badge>
```

### Screen Reader Support
```tsx
// Descriptive badges for screen readers
<Badge className="sr-only">
  Character has 3 active spell effects
</Badge>

// Visual badge with hidden context
<div>
  <Badge>3</Badge>
  <span className="sr-only">active effects</span>
</div>
```

### Color Accessibility
Badges maintain proper contrast ratios:

```tsx
// High contrast for important information
<Badge 
  className="bg-red-600 text-white"
  aria-label="Critical health warning"
>
  Critical
</Badge>
```

## Advanced Usage

### Interactive Badges
```tsx
const InteractiveBadge = ({ tag, onRemove, readonly = false }) => (
  <Badge 
    className={cn(
      "transition-all duration-200",
      !readonly && "hover:bg-opacity-80 cursor-pointer pr-1"
    )}
    onClick={readonly ? undefined : onRemove}
  >
    {tag.name}
    {!readonly && (
      <button 
        className="ml-1 rounded-full hover:bg-black/20 p-0.5"
        onClick={(e) => {
          e.stopPropagation();
          onRemove(tag.id);
        }}
        aria-label={`Remove ${tag.name} tag`}
      >
        <X className="h-3 w-3" />
      </button>
    )}
  </Badge>
);
```

### Animated Badges
```tsx
const AnimatedBadge = ({ children, pulse = false }) => (
  <Badge 
    className={cn(
      "transition-all duration-300",
      pulse && "animate-pulse bg-red-600"
    )}
  >
    {children}
  </Badge>
);

// Usage for notifications
<AnimatedBadge pulse={hasNewMessages}>
  {messageCount}
</AnimatedBadge>
```

### Custom Themed Badges
```tsx
const ThemedBadges = {
  magic: "bg-gradient-to-r from-purple-600 to-blue-600 text-white",
  divine: "bg-gradient-to-r from-yellow-500 to-orange-500 text-white",
  nature: "bg-gradient-to-r from-green-600 to-teal-600 text-white",
  fire: "bg-gradient-to-r from-red-600 to-orange-600 text-white",
  ice: "bg-gradient-to-r from-blue-600 to-cyan-600 text-white"
};

const ElementalBadge = ({ element, children }) => (
  <Badge className={ThemedBadges[element]}>
    {children}
  </Badge>
);
```

## Performance Considerations

### Badge Lists
```tsx
// Efficient rendering for many badges
const BadgeList = ({ items, maxVisible = 5 }) => {
  const visibleItems = items.slice(0, maxVisible);
  const hiddenCount = items.length - maxVisible;
  
  return (
    <div className="flex flex-wrap gap-1">
      {visibleItems.map(item => (
        <Badge key={item.id} variant={item.variant}>
          {item.label}
        </Badge>
      ))}
      
      {hiddenCount > 0 && (
        <Badge variant="outline" className="text-xs">
          +{hiddenCount} more
        </Badge>
      )}
    </div>
  );
};
```

### Memoization
```tsx
const MemoizedBadge = React.memo(Badge);

const BadgeContainer = ({ badges }) => (
  <div className="flex gap-1">
    {badges.map(badge => (
      <MemoizedBadge key={badge.id} variant={badge.variant}>
        {badge.text}
      </MemoizedBadge>
    ))}
  </div>
);
```

## Testing

```tsx
// Badge.test.tsx
test('renders badge with correct variant', () => {
  render(<Badge variant="destructive">Error</Badge>);
  
  const badge = screen.getByText('Error');
  expect(badge).toHaveClass('bg-destructive');
});

test('supports custom className', () => {
  render(
    <Badge className="custom-class" data-testid="badge">
      Test
    </Badge>
  );
  
  expect(screen.getByTestId('badge')).toHaveClass('custom-class');
});

test('renders children correctly', () => {
  render(
    <Badge>
      <span>Complex</span> Content
    </Badge>
  );
  
  expect(screen.getByText('Complex')).toBeInTheDocument();
  expect(screen.getByText('Content')).toBeInTheDocument();
});
```

## Best Practices

### Content Guidelines
- Keep badge text short and meaningful
- Use consistent terminology across the application
- Prefer icons + text for complex concepts

### Visual Hierarchy
```tsx
// Primary information
<Badge variant="default">Important</Badge>

// Secondary information  
<Badge variant="secondary">Additional</Badge>

// Warnings and errors
<Badge variant="destructive">Critical</Badge>

// Subtle information
<Badge variant="outline">Optional</Badge>
```

### Responsive Design
```tsx
// Hide less important badges on mobile
<div className="flex flex-wrap gap-1">
  <Badge>Always visible</Badge>
  <Badge className="hidden sm:inline-flex">Desktop only</Badge>
</div>
```

### Accessibility Guidelines
- Ensure sufficient color contrast
- Provide alternative text for icon-only badges
- Use appropriate ARIA roles and labels
- Consider screen reader experience for decorative badges
