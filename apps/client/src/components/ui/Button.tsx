/**
 * Enhanced Button Component with Sound Effects and Haptic Feedback
 * VTT Design System - Component Excellence Phase
 */
import React, { forwardRef, useState, useCallback, useRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";
import { Loader2 } from "lucide-react";

// Audio context for sound effects
let audioContext: AudioContext | null = null;

const initAudioContext = () => {
  if (!audioContext && typeof window !== 'undefined') {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioContext;
};

// Sound effect generators
const playClickSound = (variant: string = 'plasma') => {
  const ctx = initAudioContext();
  if (!ctx) {return;}

  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();
  
  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);
  
  // Different sounds for different variants
  const soundProfiles = {
    plasma: { freq: 800, decay: 0.1, volume: 0.1 },
    neural: { freq: 600, decay: 0.15, volume: 0.08 },
    neon: { freq: 1200, decay: 0.08, volume: 0.12 },
    ghost: { freq: 400, decay: 0.2, volume: 0.05 },
    danger: { freq: 300, decay: 0.12, volume: 0.1 },
    success: { freq: 1000, decay: 0.1, volume: 0.1 },
    link: { freq: 500, decay: 0.15, volume: 0.06 },
    primary: { freq: 800, decay: 0.1, volume: 0.1 },
    secondary: { freq: 600, decay: 0.15, volume: 0.08 },
    destructive: { freq: 300, decay: 0.12, volume: 0.1 }
  };
  
  const profile = soundProfiles[variant as keyof typeof soundProfiles] || soundProfiles.plasma;
  
  oscillator.frequency.setValueAtTime(profile.freq, ctx.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(profile.freq * 0.5, ctx.currentTime + profile.decay);
  
  gainNode.gain.setValueAtTime(profile.volume, ctx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + profile.decay);
  
  oscillator.start(ctx.currentTime);
  oscillator.stop(ctx.currentTime + profile.decay);
};

// Haptic feedback
const triggerHapticFeedback = (intensity: 'light' | 'medium' | 'heavy' = 'medium') => {
  if ('vibrate' in navigator) {
    const patterns = {
      light: [10],
      medium: [20],
      heavy: [30]
    };
    navigator.vibrate(patterns[intensity]);
  }
};

const buttonVariants = cva(
  // Base styles
  [
    "relative inline-flex items-center justify-center gap-2",
    "font-medium whitespace-nowrap select-none",
    "transition-all duration-[250ms] ease-[cubic-bezier(0.34,1.56,0.64,1)]",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-black",
    "disabled:pointer-events-none disabled:opacity-40",
    "overflow-hidden isolate",
  ],
  {
    variants: {
      variant: {
        // Plasma - Primary CTA with glow effect
        plasma: [
          "bg-gradient-to-br from-purple-600 via-violet-600 to-indigo-600",
          "text-white shadow-lg shadow-purple-500/25",
          "hover:shadow-xl hover:shadow-purple-500/40 hover:-translate-y-0.5 hover:scale-[1.02]",
          "active:translate-y-0 active:scale-[0.98]",
          "focus-visible:ring-purple-500",
          "before:absolute before:inset-0 before:bg-gradient-to-t before:from-white/0 before:to-white/20",
          "before:opacity-0 hover:before:opacity-100 before:transition-opacity before:duration-300",
        ],

        // Neural - Secondary with glass effect
        neural: [
          "bg-white/5 backdrop-blur-md border border-white/10",
          "text-white/90 shadow-sm",
          "hover:bg-white/10 hover:border-white/20 hover:shadow-md hover:text-white",
          "active:bg-white/15",
          "focus-visible:ring-white/50",
        ],

        // Neon - Accent with bright glow
        neon: [
          "bg-transparent border-2 border-cyan-400",
          "text-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.5)]",
          "hover:bg-cyan-400/10 hover:text-cyan-300 hover:shadow-[0_0_30px_rgba(6,182,212,0.7)]",
          "active:bg-cyan-400/20",
          "focus-visible:ring-cyan-400",
        ],
        
        // Ghost - Subtle interaction
        ghost: [
          "bg-transparent text-gray-300",
          "hover:bg-white/5 hover:text-white",
          "active:bg-white/10",
          "focus-visible:ring-gray-400",
        ],
        
        // Danger - Destructive actions
        danger: [
          "bg-gradient-to-br from-red-600 to-rose-600",
          "text-white shadow-lg shadow-red-500/25",
          "hover:shadow-xl hover:shadow-red-500/40 hover:from-red-700 hover:to-rose-700",
          "active:scale-[0.98]",
          "focus-visible:ring-red-500",
        ],
        
        // Success - Positive actions
        success: [
          "bg-gradient-to-br from-green-600 to-emerald-600",
          "text-white shadow-lg shadow-green-500/25",
          "hover:shadow-xl hover:shadow-green-500/40 hover:from-green-700 hover:to-emerald-700",
          "active:scale-[0.98]",
          "focus-visible:ring-green-500",
        ],
        
        // Link - Text-only button
        link: [
          "bg-transparent text-violet-400 p-0",
          "hover:text-violet-300 underline-offset-4 hover:underline",
          "focus-visible:ring-violet-400",
        ],
        
        // Primary - Main action button (alias for plasma)
        primary: [
          "bg-gradient-to-br from-purple-600 via-violet-600 to-indigo-600",
          "text-white shadow-lg shadow-purple-500/25",
          "hover:shadow-xl hover:shadow-purple-500/40 hover:-translate-y-0.5 hover:scale-[1.02]",
          "active:translate-y-0 active:scale-[0.98]",
          "focus-visible:ring-purple-500",
          "before:absolute before:inset-0 before:bg-gradient-to-t before:from-white/0 before:to-white/20",
          "before:opacity-0 hover:before:opacity-100 before:transition-opacity before:duration-300",
        ],
        
        // Secondary - Secondary action button (alias for neural)
        secondary: [
          "bg-white/5 backdrop-blur-md border border-white/10",
          "text-white/90 shadow-sm",
          "hover:bg-white/10 hover:border-white/20 hover:shadow-md hover:text-white",
          "active:bg-white/15",
          "focus-visible:ring-white/50",
        ],
        
        // Destructive - Destructive action button (alias for danger)
        destructive: [
          "bg-gradient-to-br from-red-600 to-rose-600",
          "text-white shadow-lg shadow-red-500/25",
          "hover:shadow-xl hover:shadow-red-500/40 hover:from-red-700 hover:to-rose-700",
          "active:scale-[0.98]",
          "focus-visible:ring-red-500",
        ],

        // Outline - Border-only variant
        outline: [
          "bg-transparent border-2 border-white/20",
          "text-white/90 shadow-sm",
          "hover:bg-white/5 hover:border-white/30 hover:text-white",
          "active:bg-white/10",
          "focus-visible:ring-white/50",
        ],
      },
      size: {
        xs: 'text-xs px-2.5 py-1 rounded-md',
        sm: 'text-sm px-3 py-1.5 rounded-md', 
        md: 'text-base px-4 py-2 rounded-lg',
        lg: 'text-lg px-6 py-3 rounded-xl',
        xl: 'text-xl px-8 py-4 rounded-2xl',
        icon: 'p-2 rounded-lg',
      },
      fullWidth: {
        true: 'w-full',
        false: '',
      },
    },
    defaultVariants: {
      variant: 'plasma',
      size: 'md',
      fullWidth: false,
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  asChild?: boolean;
  ripple?: boolean;
  soundEnabled?: boolean;
  hapticEnabled?: boolean;
  hapticIntensity?: 'light' | 'medium' | 'heavy';
}

const Button = React.memo(forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      fullWidth,
      loading = false,
      leftIcon,
      rightIcon,
      disabled,
      children,
      ripple = true,
      soundEnabled = true,
      hapticEnabled = true,
      hapticIntensity = 'medium',
      onClick,
      ...props
    },
    ref,
  ) => {
    const [ripples, setRipples] = useState<Array<{ x: number; y: number; id: number }>>([]);
    const rippleIdRef = useRef(0);
    const isDisabled = disabled || loading;

    const handleClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      if (disabled || loading) {return;}

      // Sound effects
      if (soundEnabled && variant) {
        playClickSound(variant);
      }

      // Haptic feedback
      if (hapticEnabled) {
        triggerHapticFeedback(hapticIntensity);
      }

      // React state-based ripple effect
      if (ripple) {
        const button = e.currentTarget;
        const rect = button.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const rippleId = rippleIdRef.current++;

        // Add new ripple to state
        setRipples(prev => [...prev, { x, y, id: rippleId }]);

        // Remove ripple after animation completes
        setTimeout(() => {
          setRipples(prev => prev.filter(ripple => ripple.id !== rippleId));
        }, 600);
      }

      onClick?.(e);
    },
    [disabled, loading, onClick, variant, soundEnabled, hapticEnabled, hapticIntensity, ripple]
  );

    return (
      <button
        className={cn(buttonVariants({ variant, size, fullWidth, className }))}
        ref={ref}
        disabled={isDisabled}
        onClick={handleClick}
        {...props}
      >
        {/* Loading state */}
        {loading && (
          <Loader2 className="h-4 w-4 animate-spin" />
        )}

        {/* Left icon */}
        {!loading && leftIcon && (
          <span className="inline-flex shrink-0 transition-transform duration-200 group-hover:scale-110">
            {leftIcon}
          </span>
        )}

        {/* Content */}
        <span className={cn(
          "inline-flex items-center transition-all duration-200",
          loading && "opacity-0"
        )}>
          {children}
        </span>

        {/* Right icon */}
        {!loading && rightIcon && (
          <span className="inline-flex shrink-0 transition-transform duration-200 group-hover:scale-110">
            {rightIcon}
          </span>
        )}

        {/* Ripple effects */}
        {ripple && ripples.map(({ x, y, id }) => {
          // Dynamic ripple color based on variant
          const rippleColors = {
            plasma: 'bg-white/25',
            neural: 'bg-gray-400/30',
            neon: 'bg-cyan-300/40',
            ghost: 'bg-gray-400/20',
            danger: 'bg-white/25',
            success: 'bg-white/25',
            link: 'bg-violet-400/20',
            primary: 'bg-white/25',
            secondary: 'bg-gray-400/30',
            destructive: 'bg-white/25',
          };
          
          const variantKey = variant || 'plasma';
          const rippleColor = rippleColors[variantKey as keyof typeof rippleColors] || 'bg-white/20';
          
          return (
            <span
              key={id}
              className={`absolute pointer-events-none rounded-full animate-ripple ${rippleColor}`}
              style={{
                left: x - 10,
                top: y - 10,
                width: 20,
                height: 20,
                transform: 'translate(-50%, -50%)',
              }}
            />
          );
        })}

          {/* Enhanced shimmer effect for premium variants */}
        {(variant === 'plasma' || variant === 'primary' || variant === 'success') && !disabled && (
          <span className="absolute inset-0 -top-1/2 h-[200%] w-[200%] animate-shimmer bg-gradient-to-r from-transparent via-white/10 to-transparent -skew-x-12 pointer-events-none" />
        )}
        
        {/* Neon glow pulse effect */}
        {variant === 'neon' && !disabled && (
          <span className="absolute inset-0 rounded-lg animate-pulse bg-cyan-400/20 blur-md pointer-events-none" />
        )}
      </button>
    );
  },
));

Button.displayName = "Button";

export { Button, buttonVariants };
