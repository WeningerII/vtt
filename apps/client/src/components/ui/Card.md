# Card Component

## Overview

Flexible container component with glass morphism styling, consistent spacing, and dark theme optimization. Provides a foundation for content organization in gaming interfaces.

## Usage

```tsx
import { 
  Card, 
  CardHeader, 
  CardTitle, 
  CardDescription, 
  CardContent, 
  CardFooter 
} from './Card';

// Basic usage
<Card>
  <CardContent>
    <p>Basic card content</p>
  </CardContent>
</Card>

// Complete card structure
<Card variant="elevated" padding="lg">
  <CardHeader>
    <CardTitle>Character Sheet</CardTitle>
    <CardDescription>Manage your character's stats and abilities</CardDescription>
  </CardHeader>
  
  <CardContent>
    <div className="grid grid-cols-2 gap-4">
      <div>Strength: 16</div>
      <div>Dexterity: 14</div>
    </div>
  </CardContent>
  
  <CardFooter>
    <Button variant="primary">Save Changes</Button>
    <Button variant="ghost">Cancel</Button>
  </CardFooter>
</Card>

// Interactive card
<Card interactive onClick={handleCardClick}>
  <CardContent>
    <p>Clickable card with hover effects</p>
  </CardContent>
</Card>
```

## Props

### Card Props
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `CardVariant` | `'default'` | Visual style variant |
| `padding` | `CardPadding` | `'md'` | Internal spacing preset |
| `interactive` | `boolean` | `false` | Enable hover/click interactions |

## Variants

### Visual Variants
- **`default`** - Standard glass morphism with subtle shadow
- **`elevated`** - Enhanced shadow and prominence  
- **`outline`** - Border-focused minimal style
- **`ghost`** - Transparent background, no borders

### Padding Variants
- **`none`** - No internal padding
- **`sm`** - 16px padding (`p-4`)
- **`md`** - 24px padding (`p-6`) 
- **`lg`** - 32px padding (`p-8`)
- **`xl`** - 40px padding (`p-10`)

## Design System Integration

### Glass Morphism Styling
Cards use backdrop blur and semi-transparent backgrounds:

```css
/* Default card styling */
background: rgba(255, 255, 255, 0.05);
backdrop-filter: blur(12px);
border: 1px solid rgba(255, 255, 255, 0.1);
```

### Dark Theme Optimization
All text colors are optimized for dark backgrounds:

```tsx
// Card title - bright white
<CardTitle className="text-white">Title</CardTitle>

// Card description - muted gray
<CardDescription className="text-gray-300">Description</CardDescription>
```

## Subcomponents

### CardHeader
Container for title and description with consistent spacing:

```tsx
<CardHeader>
  <CardTitle>Main Title</CardTitle>
  <CardDescription>Supporting description text</CardDescription>
</CardHeader>
```

### CardTitle
Semantic heading with proper typography:

```tsx
<CardTitle className="text-2xl font-bold">
  Custom Styled Title
</CardTitle>
```

### CardDescription
Muted text for secondary information:

```tsx
<CardDescription>
  Additional context or instructions for the card content
</CardDescription>
```

### CardContent
Main content area with vertical spacing:

```tsx
<CardContent className="space-y-6">
  <div>First content block</div>
  <div>Second content block</div>
</CardContent>
```

### CardFooter
Actions area with flexbox layout:

```tsx
<CardFooter className="flex-col space-y-2">
  <Button fullWidth>Primary Action</Button>
  <Button variant="ghost" fullWidth>Secondary Action</Button>
</CardFooter>
```

## Gaming Interface Examples

### Character Stats Card
```tsx
<Card variant="elevated" padding="lg">
  <CardHeader>
    <CardTitle className="flex items-center gap-3">
      <Shield className="h-6 w-6" />
      Combat Stats
    </CardTitle>
    <CardDescription>
      Current character combat statistics and modifiers
    </CardDescription>
  </CardHeader>
  
  <CardContent>
    <div className="grid grid-cols-3 gap-6">
      <div className="text-center">
        <div className="text-3xl font-bold text-red-400">18</div>
        <div className="text-sm text-gray-300">Armor Class</div>
      </div>
      <div className="text-center">
        <div className="text-3xl font-bold text-green-400">45</div>
        <div className="text-sm text-gray-300">Hit Points</div>
      </div>
      <div className="text-center">
        <div className="text-3xl font-bold text-blue-400">30</div>
        <div className="text-sm text-gray-300">Speed</div>
      </div>
    </div>
  </CardContent>
</Card>
```

### Interactive Spell Card
```tsx
<Card 
  variant="outline" 
  interactive
  className="hover:border-purple-400 transition-colors"
  onClick={() => castSpell(spell.id)}
>
  <CardHeader className="pb-3">
    <CardTitle className="text-lg flex items-center justify-between">
      {spell.name}
      <Badge variant="magic">{spell.level}</Badge>
    </CardTitle>
    <CardDescription>{spell.school} • {spell.castingTime}</CardDescription>
  </CardHeader>
  
  <CardContent className="space-y-3">
    <p className="text-sm leading-relaxed">{spell.description}</p>
    
    <div className="flex gap-4 text-xs text-gray-400">
      <span>Range: {spell.range}</span>
      <span>Duration: {spell.duration}</span>
    </div>
  </CardContent>
</Card>
```

### Equipment Item Card
```tsx
<Card variant="default" padding="sm" className="relative overflow-hidden">
  {item.rarity && (
    <div className={`absolute top-0 right-0 w-16 h-16 ${rarityColors[item.rarity]}`}>
      <div className="absolute top-1 right-1 w-0 h-0 border-l-8 border-b-8 border-transparent border-r-8 border-current" />
    </div>
  )}
  
  <CardContent className="space-y-3">
    <div className="flex items-start gap-3">
      <img 
        src={item.icon} 
        alt={item.name}
        className="w-12 h-12 rounded-lg bg-gray-800"
      />
      <div className="flex-1">
        <CardTitle className="text-base">{item.name}</CardTitle>
        <CardDescription>{item.type}</CardDescription>
      </div>
    </div>
    
    {item.stats && (
      <div className="grid grid-cols-2 gap-2 text-sm">
        {Object.entries(item.stats).map(([stat, value]) => (
          <div key={stat} className="flex justify-between">
            <span className="text-gray-300">{stat}:</span>
            <span className="text-white">+{value}</span>
          </div>
        ))}
      </div>
    )}
  </CardContent>
</Card>
```

### Mobile-Optimized Card
```tsx
<Card 
  variant="ghost" 
  padding="sm" 
  className="touch-target-large"
  interactive
>
  <CardContent className="flex items-center gap-4">
    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
      <Dice6 className="h-6 w-6 text-white" />
    </div>
    
    <div className="flex-1">
      <CardTitle className="text-base">Quick Roll</CardTitle>
      <CardDescription>Tap to roll d20</CardDescription>
    </div>
    
    <ChevronRight className="h-5 w-5 text-gray-400" />
  </CardContent>
</Card>
```

## Implementation Details

### CVA Variants
Type-safe styling with class-variance-authority:

```tsx
const cardVariants = cva([
  'rounded-xl bg-white/5 backdrop-blur-md transition-all duration-200',
  'border border-white/10'
], {
  variants: {
    variant: {
      default: 'shadow-sm hover:shadow-md hover:bg-white/10',
      elevated: 'shadow-lg hover:shadow-xl hover:bg-white/10',
      outline: 'border-2 shadow-none hover:border-white/20',
      ghost: 'border-none shadow-none bg-transparent'
    },
    interactive: {
      true: 'cursor-pointer hover:-translate-y-0.5 active:translate-y-0',
      false: ''
    }
  }
});
```

### Performance Optimizations
- `forwardRef` for proper ref forwarding
- Semantic HTML structure for accessibility
- CSS transforms for smooth animations
- Backdrop filter with fallbacks

### Responsive Design
Cards automatically adapt to container width:

```tsx
// Grid layout for responsive cards
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  {cards.map(card => (
    <Card key={card.id} variant="elevated">
      <CardContent>{card.content}</CardContent>
    </Card>
  ))}
</div>
```

## Accessibility

### Semantic Structure
- Proper heading hierarchy with `CardTitle` as `<h3>`
- Logical content flow from header to footer
- Screen reader friendly descriptions

### Interactive States
```tsx
// Accessible interactive card
<Card 
  interactive
  role="button"
  tabIndex={0}
  aria-label="View character details"
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      handleClick();
    }
  }}
>
  <CardContent>Interactive content</CardContent>
</Card>
```

### Focus Management
- Proper focus indicators on interactive cards
- Keyboard navigation support
- Screen reader announcements

## Testing

```tsx
// Card.test.tsx
test('renders with correct variant styles', () => {
  render(
    <Card variant="elevated" data-testid="card">
      <CardContent>Test content</CardContent>
    </Card>
  );
  
  const card = screen.getByTestId('card');
  expect(card).toHaveClass('shadow-lg');
});

test('handles interactive clicks', () => {
  const handleClick = jest.fn();
  render(
    <Card interactive onClick={handleClick}>
      <CardContent>Clickable card</CardContent>
    </Card>
  );
  
  fireEvent.click(screen.getByText('Clickable card'));
  expect(handleClick).toHaveBeenCalled();
});

test('supports keyboard navigation', () => {
  const handleClick = jest.fn();
  render(
    <Card interactive onClick={handleClick}>
      <CardContent>Interactive card</CardContent>
    </Card>
  );
  
  const card = screen.getByRole('button');
  card.focus();
  
  fireEvent.keyDown(card, { key: 'Enter' });
  expect(handleClick).toHaveBeenCalled();
});
```
