/** @type {import('tailwindcss').Config} */
const { theme } = require('./src/components/ui/design-system');

module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // Colors from design system
      colors: {
        // Primary palette
        primary: theme.colors.primary,
        secondary: theme.colors.secondary,
        
        // Semantic colors
        success: theme.colors.success,
        warning: theme.colors.warning,
        error: theme.colors.error,
        info: theme.colors.info,
        
        // Neutral grays
        neutral: theme.colors.neutral,
        
        // VTT-specific semantic aliases
        'bg-primary': 'var(--color-bg-primary, #ffffff)',
        'bg-secondary': 'var(--color-bg-secondary, #f8fafc)',
        'bg-overlay': 'var(--color-bg-overlay, rgba(0, 0, 0, 0.5))',
        'text-primary': 'var(--color-text-primary, #1e293b)',
        'text-secondary': 'var(--color-text-secondary, #64748b)',
        'text-tertiary': 'var(--color-text-tertiary, #94a3b8)',
        'border-primary': 'var(--color-border-primary, #e2e8f0)',
        'accent-primary': 'var(--color-accent-primary, #7916ff)',
      },

      // Typography from design system
      fontFamily: theme.typography.fontFamily,
      fontSize: theme.typography.fontSize,
      fontWeight: theme.typography.fontWeight,

      // Spacing from design system
      spacing: theme.spacing,

      // Border radius from design system
      borderRadius: theme.borderRadius,

      // Box shadows from design system
      boxShadow: theme.boxShadow,

      // Z-index from design system
      zIndex: theme.zIndex,

      // Animations and transitions
      transitionDuration: theme.animation.duration,
      transitionTimingFunction: theme.animation.timingFunction,
      keyframes: {
        ...theme.animation.keyframes,
        // Critical missing keyframes for Button component
        'shimmer': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' }
        },
        'ripple': {
          '0%': { transform: 'scale(0)', opacity: '1' },
          '100%': { transform: 'scale(4)', opacity: '0' }
        },
        'fadeIn': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        },
        'fadeOut': {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' }
        },
        'slideInUp': {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' }
        },
        'slideInDown': {
          '0%': { transform: 'translateY(-20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' }
        },
        'scaleIn': {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' }
        },
        'fadeInUp': {
          '0%': { transform: 'translateY(30px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' }
        }
      },

      // Breakpoints from design system
      screens: theme.breakpoints,

      // Component-specific utilities
      height: {
        'button-sm': theme.components.button.height.sm,
        'button-md': theme.components.button.height.md, 
        'button-lg': theme.components.button.height.lg,
        'button-xl': theme.components.button.height.xl,
        'input-sm': theme.components.input.height.sm,
        'input-md': theme.components.input.height.md,
        'input-lg': theme.components.input.height.lg,
      },

      // Custom animations for VTT
      animation: {
        'fadeIn': 'fadeIn 200ms ease-out',
        'fadeOut': 'fadeOut 200ms ease-out', 
        'slideInUp': 'slideInUp 300ms ease-out',
        'slideInDown': 'slideInDown 300ms ease-out',
        'scaleIn': 'scaleIn 200ms ease-out',
        'spin-slow': 'spin 2s linear infinite',
        'spin-fast': 'spin 0.5s linear infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-subtle': 'bounce 1s ease-in-out 2',
        'fadeInUp': 'fadeInUp 0.6s ease-out',
        'fadeInUp-delayed': 'fadeInUp 0.8s ease-out 0.2s both',
        'fadeInUp-more-delayed': 'fadeInUp 1s ease-out 0.4s both',
        'fadeInUp-most-delayed': 'fadeInUp 1.2s ease-out 0.6s both',
        'shimmer': 'shimmer 3s ease-in-out infinite',
        'ripple': 'ripple 0.6s ease-out',
        'animate-ripple': 'ripple 0.6s ease-out',
        'ripple-expand': 'ripple-expand 0.6s ease-out',
      },

      // VTT-specific utilities
      backdropBlur: {
        xs: '2px',
      },

      // Grid system for battle maps
      gridTemplateColumns: {
        'battle-map': 'repeat(auto-fit, minmax(40px, 1fr))',
      },
      
      gridTemplateRows: {
        'battle-map': 'repeat(auto-fit, minmax(40px, 1fr))',
      },
    },
  },
  plugins: [
    // Custom plugin for design system utilities
    function({ addUtilities, theme }) {
      const newUtilities = {
        // Focus ring utility
        '.focus-ring': {
          '&:focus': {
            outline: '2px solid transparent',
            outlineOffset: '2px',
            boxShadow: `0 0 0 2px ${theme('colors.primary.500')}`,
          },
        },
        
        // Glass morphism utility
        '.glass': {
          background: 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
        },
        
        // Text truncation utilities
        '.truncate-2': {
          overflow: 'hidden',
          display: '-webkit-box',
          '-webkit-box-orient': 'vertical',
          '-webkit-line-clamp': '2',
        },
        
        '.truncate-3': {
          overflow: 'hidden',
          display: '-webkit-box', 
          '-webkit-box-orient': 'vertical',
          '-webkit-line-clamp': '3',
        },

        // Screen reader only utility
        '.sr-only': {
          position: 'absolute',
          width: '1px',
          height: '1px',
          padding: '0',
          margin: '-1px',
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          whiteSpace: 'nowrap',
          border: '0',
        },

        // VTT game grid utilities
        '.grid-square': {
          width: '40px',
          height: '40px',
          border: '1px solid rgba(0, 0, 0, 0.1)',
        },

        // Token positioning
        '.token-base': {
          position: 'absolute',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '12px',
          fontWeight: '600',
          color: 'white',
          textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
          transition: 'all 0.1s ease',
          cursor: 'move',
        },
      }
      
      addUtilities(newUtilities);
    },

    // Typography plugin for consistent text styles
    function({ addComponents, theme }) {
      const components = {
        '.text-display-large': {
          fontSize: theme('fontSize.5xl'),
          fontWeight: theme('fontWeight.bold'),
          lineHeight: '1.1',
          letterSpacing: '-0.02em',
        },
        
        '.text-display': {
          fontSize: theme('fontSize.4xl'),
          fontWeight: theme('fontWeight.bold'),
          lineHeight: '1.2',
          letterSpacing: '-0.01em',
        },
        
        '.text-heading-large': {
          fontSize: theme('fontSize.3xl'),
          fontWeight: theme('fontWeight.semibold'),
          lineHeight: '1.3',
        },
        
        '.text-heading': {
          fontSize: theme('fontSize.2xl'),
          fontWeight: theme('fontWeight.semibold'),
          lineHeight: '1.4',
        },
        
        '.text-subheading': {
          fontSize: theme('fontSize.lg'),
          fontWeight: theme('fontWeight.medium'),
          lineHeight: '1.5',
        },
        
        '.text-body-large': {
          fontSize: theme('fontSize.lg'),
          lineHeight: '1.6',
        },
        
        '.text-body': {
          fontSize: theme('fontSize.base'),
          lineHeight: '1.6',
        },
        
        '.text-body-small': {
          fontSize: theme('fontSize.sm'),
          lineHeight: '1.5',
        },
        
        '.text-caption': {
          fontSize: theme('fontSize.xs'),
          lineHeight: '1.4',
        },
      }
      
      addComponents(components);
    }
  ],
}
