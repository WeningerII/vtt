# Slider Component

## Overview

Accessible range input component with smooth interaction, keyboard navigation, and gaming-optimized styling. Perfect for character stats, volume controls, and value adjustments in RPG interfaces.

## Usage

```tsx
import { Slider } from './Slider';

// Basic usage
<Slider 
  value={[volume]}
  onValueChange={(value) => setVolume(value[0])}
  min={0}
  max={100}
/>

// Character stat slider
<Slider
  value={[strength]}
  onValueChange={(value) => setStrength(value[0])}
  min={8}
  max={20}
  step={1}
/>

// Vertical orientation
<Slider
  value={[healthPercentage]}
  onValueChange={(value) => setHealthPercentage(value[0])}
  min={0}
  max={100}
  orientation="vertical"
  className="h-32"
/>

// Disabled state
<Slider
  value={[lockedValue]}
  disabled
  min={0}
  max={100}
/>
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `number[]` | `[0]` | Current slider value(s) |
| `onValueChange` | `(value: number[]) => void` | - | Callback when value changes |
| `min` | `number` | `0` | Minimum value |
| `max` | `number` | `100` | Maximum value |
| `step` | `number` | `1` | Value increment step |
| `disabled` | `boolean` | `false` | Disable slider interaction |
| `orientation` | `'horizontal' \| 'vertical'` | `'horizontal'` | Slider orientation |
| `className` | `string` | - | Additional CSS classes |

## Gaming Interface Examples

### Character Ability Scores
```tsx
const AbilityScoreSlider = ({ ability, value, onChange, pointsRemaining }) => {
  const maxValue = Math.min(20, value + pointsRemaining);
  
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium capitalize">
          {ability}
        </label>
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold w-8 text-center">{value}</span>
          <Badge variant="secondary" className="text-xs">
            {Math.floor((value - 10) / 2) >= 0 ? '+' : ''}{Math.floor((value - 10) / 2)}
          </Badge>
        </div>
      </div>
      
      <Slider
        value={[value]}
        onValueChange={(newValue) => onChange(ability, newValue[0])}
        min={8}
        max={maxValue}
        step={1}
        className="w-full"
      />
      
      <div className="flex justify-between text-xs text-gray-400">
        <span>8</span>
        <span>{maxValue}</span>
      </div>
    </div>
  );
};

// Usage
<div className="space-y-4">
  {['strength', 'dexterity', 'constitution'].map(ability => (
    <AbilityScoreSlider
      key={ability}
      ability={ability}
      value={abilityScores[ability]}
      onChange={handleAbilityChange}
      pointsRemaining={pointsRemaining}
    />
  ))}
</div>
```

### Audio Controls Panel
```tsx
const AudioControlsPanel = () => {
  const [audioSettings, setAudioSettings] = useState({
    masterVolume: 80,
    musicVolume: 60,
    sfxVolume: 75,
    voiceVolume: 90
  });

  const updateVolume = (type) => (value) => {
    setAudioSettings(prev => ({
      ...prev,
      [type]: value[0]
    }));
  };

  return (
    <Card className="p-6 space-y-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Volume2 className="h-5 w-5" />
          Audio Settings
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Master Volume</label>
            <span className="text-sm text-gray-400">
              {audioSettings.masterVolume}%
            </span>
          </div>
          <Slider
            value={[audioSettings.masterVolume]}
            onValueChange={updateVolume('masterVolume')}
            min={0}
            max={100}
            step={5}
            className="w-full"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Background Music</label>
            <span className="text-sm text-gray-400">
              {audioSettings.musicVolume}%
            </span>
          </div>
          <Slider
            value={[audioSettings.musicVolume]}
            onValueChange={updateVolume('musicVolume')}
            min={0}
            max={100}
            step={5}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Sound Effects</label>
            <span className="text-sm text-gray-400">
              {audioSettings.sfxVolume}%
            </span>
          </div>
          <Slider
            value={[audioSettings.sfxVolume]}
            onValueChange={updateVolume('sfxVolume')}
            min={0}
            max={100}
            step={5}
          />
        </div>
      </CardContent>
    </Card>
  );
};
```

### Health and Resources Bars
```tsx
const ResourceBar = ({ 
  label, 
  current, 
  maximum, 
  onChange, 
  color = "red",
  editable = false 
}) => {
  const percentage = (current / maximum) * 100;
  
  const colorClasses = {
    red: "bg-red-600",
    blue: "bg-blue-600", 
    green: "bg-green-600",
    yellow: "bg-yellow-600"
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">{label}</label>
        <span className="text-sm">
          {current} / {maximum}
        </span>
      </div>
      
      {editable ? (
        <Slider
          value={[current]}
          onValueChange={(value) => onChange(value[0])}
          min={0}
          max={maximum}
          step={1}
          className="w-full"
        />
      ) : (
        <div className="relative w-full h-3 bg-gray-200 rounded-full">
          <div
            className={cn("h-full rounded-full transition-all", colorClasses[color])}
            style={{ width: `${percentage}%` }}
          />
        </div>
      )}
    </div>
  );
};

// Usage in character sheet
<div className="space-y-4">
  <ResourceBar
    label="Hit Points"
    current={hitPoints}
    maximum={maxHitPoints}
    onChange={setHitPoints}
    color="red"
    editable={isGM}
  />
  
  <ResourceBar
    label="Spell Slots"
    current={spellSlots}
    maximum={maxSpellSlots}
    onChange={setSpellSlots}
    color="blue"
    editable
  />
</div>
```

### Encounter Difficulty Slider
```tsx
const DifficultySlider = ({ difficulty, onChange }) => {
  const difficultyLabels = {
    1: "Trivial",
    2: "Easy", 
    3: "Medium",
    4: "Hard",
    5: "Deadly"
  };
  
  const difficultyColors = {
    1: "text-green-400",
    2: "text-blue-400",
    3: "text-yellow-400", 
    4: "text-orange-400",
    5: "text-red-400"
  };

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h3 className="text-lg font-semibold">Encounter Difficulty</h3>
        <p className={cn("text-xl font-bold", difficultyColors[difficulty])}>
          {difficultyLabels[difficulty]}
        </p>
      </div>
      
      <Slider
        value={[difficulty]}
        onValueChange={(value) => onChange(value[0])}
        min={1}
        max={5}
        step={1}
        className="w-full"
      />
      
      <div className="flex justify-between text-xs text-gray-400">
        {Object.entries(difficultyLabels).map(([value, label]) => (
          <span key={value}>{label}</span>
        ))}
      </div>
    </div>
  );
};
```

### Vertical Health Tracker
```tsx
const VerticalHealthTracker = ({ creatures }) => (
  <div className="flex gap-4 items-end h-48">
    {creatures.map(creature => {
      const healthPercentage = (creature.hp / creature.maxHp) * 100;
      
      return (
        <div key={creature.id} className="flex flex-col items-center space-y-2">
          <div className="text-xs font-medium">{creature.name}</div>
          
          <Slider
            value={[creature.hp]}
            onValueChange={(value) => 
              updateCreatureHP(creature.id, value[0])
            }
            min={0}
            max={creature.maxHp}
            orientation="vertical"
            className="h-32 flex-col-reverse"
          />
          
          <div className="text-xs text-center">
            <div>{creature.hp}</div>
            <div className="text-gray-400">/{creature.maxHp}</div>
          </div>
        </div>
      );
    })}
  </div>
);
```

### Mobile-Optimized Sliders
```tsx
const MobileSlider = ({ label, value, onChange, ...props }) => (
  <div className="space-y-3 p-4 touch-target-large">
    <div className="flex items-center justify-between">
      <label className="text-base font-medium">{label}</label>
      <span className="text-lg font-bold">{value}</span>
    </div>
    
    <Slider
      value={[value]}
      onValueChange={(newValue) => onChange(newValue[0])}
      className="touch-target-large"
      {...props}
    />
    
    <div className="flex justify-between text-sm text-gray-400">
      <span>{props.min || 0}</span>
      <span>{props.max || 100}</span>
    </div>
  </div>
);
```

## Design System Integration

### Color Tokens
Slider uses design system color tokens:

```css
/* Track */
background: var(--color-gray-200);

/* Progress bar */
background: var(--color-primary-600);

/* Thumb */
background: white;
border: 2px solid var(--color-primary-600);

/* Focus ring */
ring-color: var(--color-primary-500);

/* Disabled state */
border-color: var(--color-gray-300);
opacity: 0.5;
```

### Interactive States
Smooth transitions and hover effects:

```css
/* Thumb hover */
transform: scale(1.05);

/* Thumb active/dragging */
transform: scale(1.1);

/* Transitions */
transition: all 150ms ease-out;
```

## Accessibility

### ARIA Attributes
- `role="slider"` for proper semantic meaning
- `aria-valuenow` reflects current value
- `aria-valuemin` and `aria-valuemax` define range
- `aria-orientation` for screen reader context
- `aria-disabled` for disabled state

### Keyboard Navigation
```tsx
// Full keyboard support
<Slider 
  value={[value]}
  onValueChange={setValue}
  onKeyDown={(e) => {
    // Arrow keys: increment/decrement by step
    // Home: jump to minimum
    // End: jump to maximum
  }}
/>
```

### Screen Reader Support
```tsx
// Enhanced accessibility with labels
<div>
  <label id="volume-label" htmlFor="volume-slider">
    Volume Control
  </label>
  <Slider
    id="volume-slider"
    value={[volume]}
    onValueChange={setVolume}
    aria-labelledby="volume-label"
    aria-describedby="volume-desc"
  />
  <div id="volume-desc" className="sr-only">
    Use arrow keys to adjust volume from 0 to 100 percent
  </div>
</div>
```

## Advanced Usage

### Custom Step Functions
```tsx
const ExperienceSlider = ({ xp, level, onChange }) => {
  const xpThresholds = [0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000];
  const currentLevelXp = xpThresholds[level - 1] || 0;
  const nextLevelXp = xpThresholds[level] || 100000;
  
  return (
    <div className="space-y-2">
      <div className="flex justify-between">
        <span>Level {level}</span>
        <span>Level {level + 1}</span>
      </div>
      
      <Slider
        value={[xp]}
        onValueChange={(value) => onChange(value[0])}
        min={currentLevelXp}
        max={nextLevelXp}
        step={25}
      />
      
      <div className="text-center text-sm text-gray-400">
        {xp - currentLevelXp} / {nextLevelXp - currentLevelXp} XP to next level
      </div>
    </div>
  );
};
```

### Multi-Range Slider (Future Enhancement)
```tsx
// Example pattern for future multi-value slider
const StatRangeSlider = ({ minStat, maxStat, onChange }) => {
  // Implementation would support value={[min, max]} format
  return (
    <div className="space-y-2">
      <label>Stat Range: {minStat} - {maxStat}</label>
      {/* Future: Multi-thumb slider implementation */}
    </div>
  );
};
```

### Performance Optimizations
```tsx
const OptimizedSlider = ({ value, onChange, ...props }) => {
  // Throttle value changes for performance
  const throttledOnChange = useCallback(
    throttle((newValue) => onChange(newValue), 16), // ~60fps
    [onChange]
  );
  
  return (
    <Slider
      value={value}
      onValueChange={throttledOnChange}
      {...props}
    />
  );
};
```

## Implementation Details

### Touch and Mouse Interaction
```tsx
const handleMouseDown = useCallback((event) => {
  if (disabled) return;
  
  event.preventDefault();
  setIsDragging(true);
  
  const updateValue = (clientX, clientY) => {
    const rect = event.currentTarget.getBoundingClientRect();
    let newPercentage;
    
    if (orientation === "horizontal") {
      newPercentage = ((clientX - rect.left) / rect.width) * 100;
    } else {
      newPercentage = ((rect.bottom - clientY) / rect.height) * 100;
    }
    
    // Clamp and step the value
    newPercentage = Math.max(0, Math.min(100, newPercentage));
    const newValue = min + (newPercentage / 100) * (max - min);
    const steppedValue = Math.round(newValue / step) * step;
    
    onValueChange([Math.max(min, Math.min(max, steppedValue))]);
  };
  
  // Handle mouse movement and cleanup
}, [disabled, min, max, step, orientation, onValueChange]);
```

### Keyboard Interaction
```tsx
const handleKeyDown = useCallback((event) => {
  if (disabled) return;
  
  let newValue = currentValue;
  
  switch (event.key) {
    case "ArrowRight":
    case "ArrowUp":
      newValue = Math.min(max, currentValue + step);
      break;
    case "ArrowLeft": 
    case "ArrowDown":
      newValue = Math.max(min, currentValue - step);
      break;
    case "Home":
      newValue = min;
      break;
    case "End":
      newValue = max;
      break;
    default:
      return;
  }
  
  event.preventDefault();
  onValueChange([newValue]);
}, [currentValue, disabled, min, max, step, onValueChange]);
```

## Testing

```tsx
// Slider.test.tsx
test('updates value on mouse interaction', () => {
  const handleChange = jest.fn();
  render(
    <Slider 
      value={[50]} 
      onValueChange={handleChange}
      min={0}
      max={100}
    />
  );
  
  const slider = screen.getByRole('slider');
  fireEvent.mouseDown(slider, { clientX: 75 });
  
  expect(handleChange).toHaveBeenCalled();
});

test('supports keyboard navigation', () => {
  const handleChange = jest.fn();
  render(
    <Slider 
      value={[50]} 
      onValueChange={handleChange}
      min={0}
      max={100}
      step={10}
    />
  );
  
  const slider = screen.getByRole('slider');
  slider.focus();
  
  fireEvent.keyDown(slider, { key: 'ArrowRight' });
  expect(handleChange).toHaveBeenCalledWith([60]);
  
  fireEvent.keyDown(slider, { key: 'Home' });
  expect(handleChange).toHaveBeenCalledWith([0]);
});

test('respects min/max bounds', () => {
  const handleChange = jest.fn();
  render(
    <Slider 
      value={[95]} 
      onValueChange={handleChange}
      min={0}
      max={100}
      step={10}
    />
  );
  
  const slider = screen.getByRole('slider');
  fireEvent.keyDown(slider, { key: 'ArrowRight' });
  
  expect(handleChange).toHaveBeenCalledWith([100]); // Clamped to max
});
```

## Best Practices

### Value Handling
```tsx
// Always use controlled components
const [value, setValue] = useState([initialValue]);

<Slider
  value={value}
  onValueChange={setValue}
  min={0}
  max={100}
/>
```

### Label Association
```tsx
// Proper labeling for accessibility
<div className="space-y-2">
  <label htmlFor="health-slider" className="block text-sm font-medium">
    Character Health
  </label>
  <Slider
    id="health-slider"
    value={[health]}
    onValueChange={(value) => setHealth(value[0])}
    min={0}
    max={maxHealth}
  />
</div>
```

### Responsive Design
```tsx
// Mobile-optimized touch targets
<Slider
  value={[value]}
  onValueChange={onChange}
  className={cn(
    "w-full",
    "touch-target-large", // Larger touch area on mobile
    "md:touch-target-normal" // Normal size on desktop
  )}
/>
```

### Performance Guidelines
- Use `useCallback` for change handlers in parent components
- Consider throttling rapid value changes for expensive operations
- Implement debouncing for server-side value persistence
