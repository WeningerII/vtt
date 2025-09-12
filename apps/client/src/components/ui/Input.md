# Input Component

## Overview

Consistent form input component with validation states, icons, and accessibility features. Fully integrated with the design system for dark theme gaming environments.

## Usage

```tsx
import { Input } from './Input';

// Basic usage
<Input 
  label="Character Name"
  placeholder="Enter character name"
/>

// With validation
<Input
  label="Email"
  type="email"
  value={email}
  onChange={setEmail}
  error={errors.email}
  required
/>

// With icons
<Input
  label="Search"
  leftIcon={<Search />}
  rightIcon={<X />}
  onRightIconClick={clearSearch}
/>
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `label` | `string` | - | Input label text |
| `type` | `InputType` | `'text'` | HTML input type |
| `variant` | `InputVariant` | `'default'` | Visual style variant |
| `size` | `InputSize` | `'md'` | Size preset |
| `error` | `string` | - | Error message to display |
| `leftIcon` | `ReactNode` | - | Icon on the left side |
| `rightIcon` | `ReactNode` | - | Icon on the right side |
| `onRightIconClick` | `() => void` | - | Right icon click handler |
| `showPasswordToggle` | `boolean` | `false` | Show password visibility toggle |
| `required` | `boolean` | `false` | Mark as required field |
| `disabled` | `boolean` | `false` | Disable input |

## Variants

### Visual Variants
- **`default`** - Standard input styling with design system tokens
- **`error`** - Red border and background for validation errors
- **`success`** - Green border for successful validation

### Size Variants
- **`sm`** - 32px height, compact spacing
- **`md`** - 40px height, standard spacing  
- **`lg`** - 48px height, large spacing (mobile-optimized)

## Design System Integration

### Color Tokens
All styling uses design system tokens:

```css
/* Background */
background: var(--bg-secondary);

/* Text */
color: var(--text-primary);

/* Borders */
border-color: var(--border-secondary);
hover:border-color: var(--border-primary);
focus:border-color: var(--accent-primary);

/* Validation */
error:border-color: var(--error);
success:border-color: var(--color-success);
```

### Consistent Styling
- Dark theme optimized backgrounds
- Proper contrast ratios (WCAG AA)
- Smooth transitions for state changes
- Focus ring using accent colors

## Validation States

### Error State
```tsx
<Input
  label="Email"
  value={email}
  error="Please enter a valid email address"
  variant="error"
/>
```

Shows:
- Red border and focus ring
- Error message below input
- Error icon in validation color

### Success State  
```tsx
<Input
  label="Username"
  value={username}
  variant="success"
  // No error message = success state
/>
```

Shows:
- Green border and focus ring
- Success styling without message

## Password Inputs

### Password Toggle
```tsx
<Input
  label="Password"
  type="password"
  showPasswordToggle={true}
  value={password}
  onChange={setPassword}
/>
```

Features:
- Eye/EyeOff icon toggle
- Secure password visibility
- Proper ARIA labeling
- Design system token colors

## Accessibility

### ARIA Implementation
- `aria-describedby` for error messages
- `aria-required` for required fields
- `aria-invalid` for validation state
- Proper label association

### Keyboard Support
- Tab navigation
- Focus management
- Enter key handling
- Password toggle with Space/Enter

### Screen Reader Support
- Error announcements
- State change notifications  
- Icon descriptions
- Label relationships

## Mobile Optimization

### Touch Targets
- Minimum 44px height on mobile
- Adequate spacing between inputs
- Touch-friendly focus states

### Performance
- Debounced validation
- Optimized re-renders
- Hardware-accelerated animations

## Examples

### Search Input
```tsx
<Input
  label="Search Characters"
  placeholder="Type to search..."
  leftIcon={<Search className="h-4 w-4" />}
  rightIcon={query && <X className="h-4 w-4" />}
  onRightIconClick={() => setQuery('')}
  value={query}
  onChange={setQuery}
/>
```

### Form Field with Validation
```tsx
<div className="space-y-4">
  <Input
    label="Character Name"
    placeholder="Enter character name"
    value={name}
    onChange={setName}
    error={errors.name}
    required
  />
  
  <Input
    label="Level"
    type="number"
    min="1"
    max="20"
    value={level}
    onChange={setLevel}
    variant={errors.level ? 'error' : 'default'}
  />
</div>
```

### Password Field
```tsx
<Input
  label="Password"
  type="password"
  showPasswordToggle={true}
  value={password}
  onChange={setPassword}
  error={errors.password}
  required
  size="lg"
/>
```

## Implementation Details

### CVA Variants
Type-safe styling with class-variance-authority:

```tsx
const inputVariants = cva([
  "flex w-full border transition-all duration-200",
  "bg-bg-secondary text-text-primary border-border-secondary",
  "hover:border-border-primary focus-visible:border-accent-primary",
  "disabled:cursor-not-allowed disabled:opacity-50"
], {
  variants: {
    variant: {
      default: "border-border-secondary",
      error: "border-error focus-visible:ring-error/25",
      success: "border-color-success focus-visible:ring-color-success/25"
    }
  }
});
```

### Performance
- `React.memo` for optimization
- `useCallback` for stable handlers
- Controlled vs uncontrolled modes
- Validation debouncing

### Testing
```tsx
// Input.test.tsx
test('displays error message', () => {
  render(
    <Input 
      label="Test" 
      error="Required field" 
      variant="error"
    />
  );
  
  expect(screen.getByText('Required field')).toBeInTheDocument();
  expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
});

test('password toggle works', () => {
  render(<Input type="password" showPasswordToggle />);
  
  const toggle = screen.getByLabelText('Toggle password visibility');
  const input = screen.getByRole('textbox');
  
  expect(input).toHaveAttribute('type', 'password');
  
  fireEvent.click(toggle);
  expect(input).toHaveAttribute('type', 'text');
});
```
