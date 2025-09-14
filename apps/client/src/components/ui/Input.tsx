/**
 * Enhanced Gaming Input Component - Gaming-optimized input with VTT-specific features
 */
import React, { forwardRef, useId, useState, useCallback, useEffect, useRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";
import { Eye, EyeOff, AlertCircle, CheckCircle, Dices, Sword, Shield, Star } from "lucide-react";

const inputVariants = cva(
  [
    "flex w-full border transition-all duration-300",
    "placeholder:text-text-tertiary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary",
    "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-bg-tertiary",
    "bg-bg-secondary text-text-primary border-border-secondary",
    "hover:border-border-primary focus-visible:border-accent-primary focus-visible:ring-accent-primary/25",
  ],
  {
    variants: {
      variant: {
        default: [
          "border-border-secondary",
          "hover:border-border-primary",
          "focus-visible:border-accent-primary",
        ],
        error: [
          "border-error bg-bg-secondary text-text-primary",
          "focus-visible:border-error focus-visible:ring-error/25",
        ],
        success: [
          "border-color-success bg-bg-secondary text-text-primary", 
          "focus-visible:border-color-success focus-visible:ring-color-success/25",
        ],
        // Gaming-specific variants
        dice: [
          "border-emerald-500/50 bg-gradient-to-r from-emerald-900/20 to-green-800/20",
          "focus-visible:border-emerald-400 focus-visible:ring-emerald-400/25",
          "hover:shadow-[0_0_20px_rgba(16,185,129,0.3)]"
        ],
        damage: [
          "border-red-500/50 bg-gradient-to-r from-red-900/20 to-orange-800/20",
          "focus-visible:border-red-400 focus-visible:ring-red-400/25",
          "hover:shadow-[0_0_20px_rgba(239,68,68,0.3)]"
        ],
        healing: [
          "border-blue-500/50 bg-gradient-to-r from-blue-900/20 to-cyan-800/20",
          "focus-visible:border-blue-400 focus-visible:ring-blue-400/25",
          "hover:shadow-[0_0_20px_rgba(59,130,246,0.3)]"
        ],
        magic: [
          "border-purple-500/50 bg-gradient-to-r from-purple-900/20 to-indigo-800/20",
          "focus-visible:border-purple-400 focus-visible:ring-purple-400/25",
          "hover:shadow-[0_0_20px_rgba(147,51,234,0.3)]"
        ],
        stat: [
          "border-amber-500/50 bg-gradient-to-r from-amber-900/20 to-yellow-800/20",
          "focus-visible:border-amber-400 focus-visible:ring-amber-400/25",
          "hover:shadow-[0_0_20px_rgba(245,158,11,0.3)]"
        ],
        modifier: [
          "border-slate-500/50 bg-gradient-to-r from-slate-900/20 to-gray-800/20",
          "focus-visible:border-slate-400 focus-visible:ring-slate-400/25",
          "hover:shadow-[0_0_20px_rgba(100,116,139,0.3)]"
        ]
      },
      size: {
        sm: "h-8 px-3 py-1.5 text-xs rounded-md",
        md: "h-10 px-4 py-2 text-sm rounded-lg", 
        lg: "h-12 px-4 py-3 text-base rounded-lg",
        xl: "h-14 px-6 py-4 text-lg rounded-xl", // Gaming-friendly large size
      },
      gaming: {
        true: "touch-manipulation select-all font-mono tracking-wider",
        false: ""
      }
    },
    defaultVariants: {
      variant: "default",
      size: "md",
      gaming: false
    },
  },
);

// Gaming-specific input types
export type GamingInputType = 'dice' | 'damage' | 'healing' | 'magic' | 'stat' | 'modifier';

export interface GamingFeatures {
  type?: GamingInputType;
  hapticFeedback?: boolean;
  audioFeedback?: boolean;
  quickActions?: Array<{
    label: string;
    value: string | number;
    icon?: React.ReactNode;
    shortcut?: string;
  }>;
  autoCalculate?: boolean;
  diceNotation?: boolean;
  minMaxValues?: { min: number; max: number };
  stepButtons?: boolean;
  longPressActions?: boolean;
}

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size">,
    Omit<VariantProps<typeof inputVariants>, "gaming"> {
  label?: string;
  description?: string;
  error?: string | undefined;
  success?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  showPasswordToggle?: boolean;
  // Gaming enhancements
  gaming?: GamingFeatures;
  onGameAction?: (action: string, value?: any) => void;
}

const Input = React.memo(forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      variant,
      size,
      type = "text",
      label,
      description,
      error,
      success,
      leftIcon,
      rightIcon,
      showPasswordToggle,
      disabled,
      id,
      gaming,
      onGameAction,
      ...props
    },
    ref,
  ) => {
    const [showPassword, setShowPassword] = useState(false);
    const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);
    const [stepValue, setStepValue] = useState<number>(0);
    const generatedId = useId();
    const inputId = id || generatedId;
    const inputRef = useRef<HTMLInputElement>(null);

    // Gaming feedback system
    const triggerGamingFeedback = useCallback(async (action: 'focus' | 'change' | 'action' | 'step') => {
      if (!gaming) {return;}

      // Haptic feedback
      if (gaming.hapticFeedback && 'vibrate' in navigator) {
        const patterns = {
          focus: [30],
          change: [20],
          action: [50, 25, 50],
          step: [25]
        };
        navigator.vibrate(patterns[action]);
      }

      // Audio feedback
      if (gaming.audioFeedback) {
        const soundMap = {
          dice: '/assets/audio/dice-tap.mp3',
          damage: '/assets/audio/hit-sound.mp3', 
          healing: '/assets/audio/heal-sound.mp3',
          magic: '/assets/audio/magic-sound.mp3',
          stat: '/assets/audio/level-up.mp3'
        };
        
        const soundFile = gaming.type && soundMap[gaming.type];
        if (soundFile) {
          try {
            const audio = new Audio(soundFile);
            audio.volume = 0.2;
            await audio.play();
          } catch (error) {
            // Silent fail
          }
        }
      }
    }, [gaming]);

    // Determine variant based on validation state and gaming type
    const resolvedVariant = error ? "error" : success ? "success" : gaming?.type || variant;
    const isGaming = Boolean(gaming);

    // Determine input type (handle password toggle)
    const inputType = showPasswordToggle && type === "password" && showPassword ? "text" : type;

    // Gaming-specific icon mapping
    const getGamingIcon = () => {
      if (!gaming?.type) {return null;}
      const iconMap = {
        dice: <Dices className="h-4 w-4" />,
        damage: <Sword className="h-4 w-4" />,
        healing: <Shield className="h-4 w-4" />,
        magic: <Star className="h-4 w-4" />,
        stat: <Star className="h-4 w-4" />,
        modifier: <Star className="h-4 w-4" />
      };
      return iconMap[gaming.type];
    };

    // Step value handlers for gaming inputs
    const handleStepUp = useCallback(() => {
      const input = inputRef.current;
      if (!input) {return;}
      
      const currentValue = parseFloat(input.value) || 0;
      const step = parseFloat(input.step) || 1;
      const newValue = currentValue + step;
      
      input.value = newValue.toString();
      input.dispatchEvent(new Event('input', { bubbles: true }));
      triggerGamingFeedback('step');
      onGameAction?.('step-up', newValue);
    }, [triggerGamingFeedback, onGameAction]);

    const handleStepDown = useCallback(() => {
      const input = inputRef.current;
      if (!input) {return;}
      
      const currentValue = parseFloat(input.value) || 0;
      const step = parseFloat(input.step) || 1;
      const newValue = Math.max(gaming?.minMaxValues?.min || -Infinity, currentValue - step);
      
      input.value = newValue.toString();
      input.dispatchEvent(new Event('input', { bubbles: true }));
      triggerGamingFeedback('step');
      onGameAction?.('step-down', newValue);
    }, [gaming, triggerGamingFeedback, onGameAction]);

    // Long press handlers for gaming actions
    const handleLongPressStart = useCallback((action: string, value: any) => {
      if (!gaming?.longPressActions) {return;}
      
      const timer = setTimeout(() => {
        triggerGamingFeedback('action');
        onGameAction?.(action, value);
      }, 500);
      
      setLongPressTimer(timer);
    }, [gaming, triggerGamingFeedback, onGameAction]);

    const handleLongPressEnd = useCallback(() => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        setLongPressTimer(null);
      }
    }, [longPressTimer]);

    // Enhanced focus handler with gaming feedback
    const handleFocus = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
      triggerGamingFeedback('focus');
      props.onFocus?.(e);
    }, [triggerGamingFeedback, props]);

    // Enhanced change handler with gaming feedback
    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
      triggerGamingFeedback('change');
      props.onChange?.(e);
    }, [triggerGamingFeedback, props]);

    // Show password toggle icon with useCallback for performance
    const togglePassword = useCallback(() => setShowPassword(!showPassword), [showPassword]);
    
    const passwordToggleIcon = showPasswordToggle && type === "password" && (
      <button
        type="button"
        className="text-text-tertiary hover:text-text-secondary focus:outline-none pointer-events-auto transition-colors"
        onClick={togglePassword}
        tabIndex={-1}
        aria-label={showPassword ? "Hide password" : "Show password"}
      >
        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    );

    // Validation state icon
    const validationIcon = error ? (
      <AlertCircle className="h-4 w-4 text-error" />
    ) : success ? (
      <CheckCircle className="h-4 w-4 text-color-success" />
    ) : null;

    return (
      <div className="space-y-1.5">
        {/* Label */}
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-text-secondary">
            {label}
          </label>
        )}

        {/* Input container */}
        <div className="relative overflow-hidden">
          {/* Left icon */}
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary">
              {leftIcon}
            </div>
          )}

          {/* Input field */}
          <input
            type={inputType}
            className={cn(
              inputVariants({ variant: resolvedVariant, size, gaming: isGaming }),
              leftIcon && "pl-10",
              (rightIcon || validationIcon || passwordToggleIcon || gaming?.stepButtons) && "pr-16",
              isGaming && "gaming-input",
              gaming?.type && `gaming-input--${gaming.type}`,
              className,
            )}
            ref={inputRef}
            id={inputId}
            disabled={disabled}
            onFocus={handleFocus}
            onChange={handleChange}
            min={gaming?.minMaxValues?.min}
            max={gaming?.minMaxValues?.max}
            {...props}
          />

          {/* Right icons container */}
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 pointer-events-none">
            {validationIcon}
            {!validationIcon && rightIcon && (
              <span className="text-text-tertiary pointer-events-auto">{rightIcon}</span>
            )}
            
            {/* Gaming step buttons */}
            {gaming?.stepButtons && (
              <div className="flex flex-col pointer-events-auto">
                <button
                  type="button"
                  className="text-text-tertiary hover:text-text-primary text-xs leading-none p-1 hover:bg-surface-hover rounded transition-colors"
                  onClick={handleStepUp}
                  onMouseDown={() => handleLongPressStart('step-up-continuous', 1)}
                  onMouseUp={handleLongPressEnd}
                  onMouseLeave={handleLongPressEnd}
                  disabled={disabled}
                  aria-label="Increase value"
                >
                  ▲
                </button>
                <button
                  type="button"
                  className="text-text-tertiary hover:text-text-primary text-xs leading-none p-1 hover:bg-surface-hover rounded transition-colors"
                  onClick={handleStepDown}
                  onMouseDown={() => handleLongPressStart('step-down-continuous', -1)}
                  onMouseUp={handleLongPressEnd}
                  onMouseLeave={handleLongPressEnd}
                  disabled={disabled}
                  aria-label="Decrease value"
                >
                  ▼
                </button>
              </div>
            )}
            
            {passwordToggleIcon && <span className="pointer-events-auto">{passwordToggleIcon}</span>}
          </div>
        </div>

        {/* Description */}
        {description && !error && !success && (
          <p className="text-xs text-text-tertiary">{description}</p>
        )}

        {/* Error message */}
        {error && (
          <p className="text-xs text-error flex items-center gap-1">
            <AlertCircle className="h-3 w-3 shrink-0" />
            {error}
          </p>
        )}

        {/* Success message */}
        {success && (
          <p className="text-xs text-color-success flex items-center gap-1">
            <CheckCircle className="h-3 w-3 shrink-0" />
            {success}
          </p>
        )}
        
        {/* Gaming quick actions */}
        {gaming?.quickActions && gaming.quickActions.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {gaming.quickActions.map((action, index) => (
              <button
                key={index}
                type="button"
                className={cn(
                  "inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md transition-all",
                  "bg-surface-elevated hover:bg-surface-hover text-text-secondary hover:text-text-primary",
                  "border border-border-subtle hover:border-border-primary",
                  "gaming-quick-action touch-manipulation"
                )}
                onClick={() => {
                  const input = inputRef.current;
                  if (input) {
                    input.value = action.value.toString();
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                    triggerGamingFeedback('action');
                    onGameAction?.(action.label.toLowerCase(), action.value);
                  }
                }}
                disabled={disabled}
                title={action.shortcut ? `Shortcut: ${action.shortcut}` : undefined}
              >
                {action.icon}
                <span>{action.label}</span>
              </button>
            ))}
          </div>
        )}
        
        {/* Gaming context info */}
        {gaming?.diceNotation && (
          <p className="text-xs text-text-tertiary mt-1">
            💡 Tip: Use dice notation (e.g., 1d20, 2d6+3, 4d8-1)
          </p>
        )}
      </div>
    );
  },
));

Input.displayName = "Input";

// Gaming-specific input variants for common VTT use cases
const DiceInput = React.memo(forwardRef<HTMLInputElement, Omit<InputProps, 'gaming'>>(
  (props, ref) => (
    <Input
      {...props}
      ref={ref}
      gaming={{
        type: 'dice',
        hapticFeedback: true,
        audioFeedback: true,
        diceNotation: true,
        quickActions: [
          { label: '1d20', value: '1d20', icon: <Dices className="h-3 w-3" /> },
          { label: '1d12', value: '1d12', icon: <Dices className="h-3 w-3" /> },
          { label: '1d10', value: '1d10', icon: <Dices className="h-3 w-3" /> },
          { label: '1d8', value: '1d8', icon: <Dices className="h-3 w-3" /> },
          { label: '1d6', value: '1d6', icon: <Dices className="h-3 w-3" /> },
          { label: '1d4', value: '1d4', icon: <Dices className="h-3 w-3" /> }
        ]
      }}
    />
  )
));
DiceInput.displayName = "DiceInput";

const StatInput = React.memo(forwardRef<HTMLInputElement, Omit<InputProps, 'gaming'> & { statName?: string }>(
  ({ statName, ...props }, ref) => (
    <Input
      {...props}
      ref={ref}
      type="number"
      gaming={{
        type: 'stat',
        hapticFeedback: true,
        stepButtons: true,
        minMaxValues: { min: 1, max: 30 },
        quickActions: [
          { label: '8', value: 8 },
          { label: '10', value: 10 },
          { label: '12', value: 12 },
          { label: '14', value: 14 },
          { label: '16', value: 16 },
          { label: '18', value: 18 }
        ]
      }}
    />
  )
));
StatInput.displayName = "StatInput";

const DamageInput = React.memo(forwardRef<HTMLInputElement, Omit<InputProps, 'gaming'>>(
  (props, ref) => (
    <Input
      {...props}
      ref={ref}
      type="number"
      gaming={{
        type: 'damage',
        hapticFeedback: true,
        audioFeedback: true,
        stepButtons: true,
        minMaxValues: { min: 0, max: 999 }
      }}
    />
  )
));
DamageInput.displayName = "DamageInput";

export { Input, inputVariants, DiceInput, StatInput, DamageInput };
