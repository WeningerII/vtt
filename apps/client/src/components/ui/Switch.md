# Switch Component

## Overview

Accessible toggle switch component with smooth animations and gaming-optimized styling. Perfect for settings panels, feature toggles, and binary state controls in RPG interfaces.

## Usage

```tsx
import { Switch } from './Switch';

// Basic usage
<Switch 
  checked={isEnabled}
  onCheckedChange={setIsEnabled}
/>

// With label
<div className="flex items-center gap-3">
  <Switch 
    checked={soundEnabled}
    onCheckedChange={setSoundEnabled}
  />
  <label className="text-sm font-medium">Sound Effects</label>
</div>

// Disabled state
<Switch 
  checked={false}
  disabled
  className="opacity-50"
/>

// Different sizes
<div className="flex items-center gap-4">
  <Switch size="sm" checked onCheckedChange={() => {}} />
  <Switch size="md" checked onCheckedChange={() => {}} />
  <Switch size="lg" checked onCheckedChange={() => {}} />
</div>
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `checked` | `boolean` | `false` | Current checked state |
| `onCheckedChange` | `(checked: boolean) => void` | - | Callback when state changes |
| `disabled` | `boolean` | `false` | Disable the switch |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | Size variant |
| `className` | `string` | - | Additional CSS classes |

## Size Variants

### Small (`sm`)
- **Dimensions:** 36px × 20px
- **Thumb:** 16px × 16px
- **Use case:** Compact settings, table rows, secondary toggles

### Medium (`md`)
- **Dimensions:** 44px × 24px  
- **Thumb:** 20px × 20px
- **Use case:** Standard settings panels, forms

### Large (`lg`)
- **Dimensions:** 52px × 28px
- **Thumb:** 24px × 24px
- **Use case:** Primary toggles, mobile interfaces

## Gaming Interface Examples

### Settings Panel
```tsx
const SettingsPanel = () => {
  const [settings, setSettings] = useState({
    soundEffects: true,
    backgroundMusic: true,
    hapticFeedback: false,
    autoSave: true,
    darkMode: true
  });

  const updateSetting = (key: string) => (value: boolean) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  return (
    <Card className="space-y-6">
      <CardHeader>
        <CardTitle>Game Settings</CardTitle>
        <CardDescription>Configure your gaming experience</CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <label className="text-sm font-medium">Sound Effects</label>
            <p className="text-xs text-gray-400">Combat and UI sounds</p>
          </div>
          <Switch 
            checked={settings.soundEffects}
            onCheckedChange={updateSetting('soundEffects')}
            size="md"
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <label className="text-sm font-medium">Background Music</label>
            <p className="text-xs text-gray-400">Ambient and combat music</p>
          </div>
          <Switch 
            checked={settings.backgroundMusic}
            onCheckedChange={updateSetting('backgroundMusic')}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <label className="text-sm font-medium">Haptic Feedback</label>
            <p className="text-xs text-gray-400">Controller and mobile vibration</p>
          </div>
          <Switch 
            checked={settings.hapticFeedback}
            onCheckedChange={updateSetting('hapticFeedback')}
          />
        </div>
      </CardContent>
    </Card>
  );
};
```

### Character Sheet Toggles
```tsx
const CharacterToggles = ({ character, onUpdate }) => (
  <div className="space-y-4">
    <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
      <div className="flex items-center gap-3">
        <Shield className="h-5 w-5 text-blue-400" />
        <div>
          <div className="text-sm font-medium">Defensive Stance</div>
          <div className="text-xs text-gray-400">+2 AC, -2 Attack</div>
        </div>
      </div>
      <Switch 
        checked={character.defensiveStance}
        onCheckedChange={(checked) => 
          onUpdate({ defensiveStance: checked })
        }
        size="sm"
      />
    </div>

    <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
      <div className="flex items-center gap-3">
        <Sword className="h-5 w-5 text-red-400" />
        <div>
          <div className="text-sm font-medium">Reckless Attack</div>
          <div className="text-xs text-gray-400">Advantage on attacks</div>
        </div>
      </div>
      <Switch 
        checked={character.recklessAttack}
        onCheckedChange={(checked) => 
          onUpdate({ recklessAttack: checked })
        }
        size="sm"
      />
    </div>
  </div>
);
```

### Game Master Controls
```tsx
const GMControls = () => {
  const [gmSettings, setGMSettings] = useState({
    showPlayerHP: false,
    allowPlayerRolls: true,
    visibleToPlayers: false,
    automaticInitiative: true
  });

  return (
    <Card variant="elevated">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Crown className="h-5 w-5 text-yellow-400" />
          Game Master Controls
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">Show Player HP</label>
          <Switch 
            checked={gmSettings.showPlayerHP}
            onCheckedChange={(checked) => 
              setGMSettings(prev => ({ ...prev, showPlayerHP: checked }))
            }
          />
        </div>

        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">Allow Player Rolls</label>
          <Switch 
            checked={gmSettings.allowPlayerRolls}
            onCheckedChange={(checked) => 
              setGMSettings(prev => ({ ...prev, allowPlayerRolls: checked }))
            }
          />
        </div>
      </CardContent>
    </Card>
  );
};
```

### Mobile-Optimized Settings
```tsx
const MobileSettings = () => (
  <div className="space-y-1">
    {settingsOptions.map((option) => (
      <div 
        key={option.id}
        className="flex items-center justify-between p-4 touch-target-large"
      >
        <div className="flex-1">
          <div className="font-medium">{option.title}</div>
          <div className="text-sm text-gray-400">{option.description}</div>
        </div>
        
        <Switch 
          size="lg"
          checked={option.enabled}
          onCheckedChange={option.onChange}
          className="ml-4"
        />
      </div>
    ))}
  </div>
);
```

## Design System Integration

### Color Tokens
The Switch component uses design system color tokens:

```css
/* Unchecked state */
background: var(--color-gray-200);
hover: var(--color-gray-300);

/* Checked state */
background: var(--color-primary-600);
hover: var(--color-primary-700);

/* Focus ring */
ring-color: var(--color-primary-500);

/* Disabled */
opacity: 0.5;
thumb-background: var(--color-gray-100);
```

### Animation Curves
Smooth transitions using CSS easing:

```css
transition: colors 200ms ease-in-out;
transform: translateX() 200ms ease-in-out;
```

## Accessibility

### ARIA Attributes
- `role="switch"` for proper semantic meaning
- `aria-checked` reflects current state
- `tabIndex={0}` for keyboard navigation

### Keyboard Navigation
```tsx
// Switch supports keyboard interaction
<Switch 
  checked={value}
  onCheckedChange={setValue}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setValue(!value);
    }
  }}
/>
```

### Screen Reader Support
```tsx
// Enhanced accessibility with labels
<div className="flex items-center gap-3">
  <Switch 
    id="notifications"
    checked={notificationsEnabled}
    onCheckedChange={setNotificationsEnabled}
    aria-describedby="notifications-desc"
  />
  <div>
    <label htmlFor="notifications" className="font-medium">
      Notifications
    </label>
    <p id="notifications-desc" className="text-sm text-gray-400">
      Receive game updates and alerts
    </p>
  </div>
</div>
```

## Advanced Usage

### Controlled vs Uncontrolled
```tsx
// Controlled (recommended)
const [checked, setChecked] = useState(false);
<Switch checked={checked} onCheckedChange={setChecked} />

// With validation
const handleChange = (newValue: boolean) => {
  if (validateSetting(newValue)) {
    setChecked(newValue);
  }
};
```

### Custom Styling
```tsx
// Custom colors and effects
<Switch 
  checked={magicEnabled}
  onCheckedChange={setMagicEnabled}
  className={cn(
    "transition-all duration-300",
    magicEnabled && "ring-2 ring-purple-400 ring-opacity-75"
  )}
/>

// Gaming-themed switch
<Switch 
  checked={pvpMode}
  onCheckedChange={setPvpMode}
  className={cn(
    "shadow-lg",
    pvpMode 
      ? "bg-gradient-to-r from-red-600 to-red-700" 
      : "bg-gray-600"
  )}
/>
```

### Loading States
```tsx
const [isLoading, setIsLoading] = useState(false);

const handleToggle = async (newValue: boolean) => {
  setIsLoading(true);
  try {
    await updateServerSetting(newValue);
    setLocalValue(newValue);
  } catch (error) {
    // Handle error
  } finally {
    setIsLoading(false);
  }
};

<Switch 
  checked={value}
  onCheckedChange={handleToggle}
  disabled={isLoading}
  className={isLoading ? "animate-pulse" : ""}
/>
```

## Implementation Details

### Size Calculations
Responsive sizing based on design system scale:

```tsx
const sizeClasses = {
  sm: "h-5 w-9",   // 20px × 36px
  md: "h-6 w-11",  // 24px × 44px  
  lg: "h-7 w-13"   // 28px × 52px
};

const thumbSizeClasses = {
  sm: "h-4 w-4",   // 16px × 16px
  md: "h-5 w-5",   // 20px × 20px
  lg: "h-6 w-6"    // 24px × 24px
};
```

### Animation Implementation
```tsx
const thumbTranslateClasses = {
  sm: checked ? "translate-x-4" : "translate-x-0.5",
  md: checked ? "translate-x-5" : "translate-x-0.5", 
  lg: checked ? "translate-x-6" : "translate-x-0.5"
};
```

### Performance Optimizations
- `forwardRef` for proper ref handling
- Minimal re-renders with focused state management
- CSS transforms for smooth animations

## Testing

```tsx
// Switch.test.tsx
test('toggles state on click', () => {
  const handleChange = jest.fn();
  render(
    <Switch checked={false} onCheckedChange={handleChange} />
  );
  
  fireEvent.click(screen.getByRole('switch'));
  expect(handleChange).toHaveBeenCalledWith(true);
});

test('reflects checked state in aria-checked', () => {
  render(<Switch checked={true} onCheckedChange={() => {}} />);
  
  const switchElement = screen.getByRole('switch');
  expect(switchElement).toHaveAttribute('aria-checked', 'true');
});

test('disables interaction when disabled', () => {
  const handleChange = jest.fn();
  render(
    <Switch 
      checked={false} 
      onCheckedChange={handleChange} 
      disabled 
    />
  );
  
  fireEvent.click(screen.getByRole('switch'));
  expect(handleChange).not.toHaveBeenCalled();
});

test('supports keyboard navigation', () => {
  const handleChange = jest.fn();
  render(
    <Switch checked={false} onCheckedChange={handleChange} />
  );
  
  const switchElement = screen.getByRole('switch');
  switchElement.focus();
  
  fireEvent.keyDown(switchElement, { key: 'Enter' });
  expect(handleChange).toHaveBeenCalledWith(true);
  
  fireEvent.keyDown(switchElement, { key: ' ' });
  expect(handleChange).toHaveBeenCalledWith(true);
});
```

## Best Practices

### Label Association
Always provide clear labels for switches:

```tsx
// Good: Clear labeling
<div className="flex items-center gap-3">
  <Switch id="auto-save" checked={autoSave} onCheckedChange={setAutoSave} />
  <label htmlFor="auto-save">Enable Auto-Save</label>
</div>

// Better: With description
<div className="space-y-1">
  <label className="flex items-center gap-3">
    <Switch checked={notifications} onCheckedChange={setNotifications} />
    <span className="font-medium">Push Notifications</span>
  </label>
  <p className="text-sm text-gray-400 ml-8">
    Receive alerts for game events and updates
  </p>
</div>
```

### State Management
```tsx
// Handle async operations properly
const handleSettingChange = async (enabled: boolean) => {
  try {
    setIsUpdating(true);
    await updateUserSetting('notifications', enabled);
    setNotifications(enabled);
  } catch (error) {
    // Revert on error
    console.error('Failed to update setting:', error);
  } finally {
    setIsUpdating(false);
  }
};
```

### Responsive Design
```tsx
// Mobile-first responsive switches
<div className="flex items-center justify-between p-3 md:p-4">
  <span className="text-sm md:text-base">Setting Name</span>
  <Switch 
    size={{ base: 'md', md: 'lg' }}
    checked={value}
    onCheckedChange={onChange}
  />
</div>
```
