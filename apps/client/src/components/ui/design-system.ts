
export interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
  onClick?: () => void;
}

export interface InputProps {
  type?: string;
  placeholder?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  className?: string;
  disabled?: boolean;
}

/**
 * VTT Platform Design System
 * A comprehensive design system with typography, colors, spacing, and component foundations
 */

// Color Palette - Carefully crafted for accessibility and visual hierarchy
export const colors = {
  // Primary - Deep purple with excellent contrast
  primary: {
    50: "#f3f1ff",
    100: "#ebe5ff",
    200: "#d9ceff",
    300: "#bea6ff",
    400: "#9f75ff",
    500: "#843dff",
    600: "#7916ff",
    700: "#6b04fd",
    800: "#5a03d4",
    900: "#4c02ad",
    950: "#2e0074",
  },

  // Secondary - Warm orange for accents and CTAs
  secondary: {
    50: "#fff7ed",
    100: "#ffedd5",
    200: "#fed7aa",
    300: "#fdba74",
    400: "#fb923c",
    500: "#f97316",
    600: "#ea580c",
    700: "#c2410c",
    800: "#9a3412",
    900: "#7c2d12",
    950: "#431407",
  },

  // Neutral - Sophisticated grays with subtle warmth
  neutral: {
    50: "#fafafa",
    100: "#f5f5f5",
    200: "#e5e5e5",
    300: "#d4d4d4",
    400: "#a3a3a3",
    500: "#737373",
    600: "#525252",
    700: "#404040",
    800: "#262626",
    900: "#171717",
    950: "#0a0a0a",
  },

  // Semantic colors
  success: {
    50: "#f0fdf4",
    100: "#dcfce7",
    200: "#bbf7d0",
    300: "#86efac",
    400: "#4ade80",
    500: "#22c55e",
    600: "#16a34a",
    700: "#15803d",
    800: "#166534",
    900: "#14532d",
  },

  warning: {
    50: "#fffbeb",
    100: "#fef3c7",
    200: "#fde68a",
    300: "#fcd34d",
    400: "#fbbf24",
    500: "#f59e0b",
    600: "#d97706",
    700: "#b45309",
    800: "#92400e",
    900: "#78350f",
  },

  error: {
    50: "#fef2f2",
    100: "#fee2e2",
    200: "#fecaca",
    300: "#fca5a5",
    400: "#f87171",
    500: "#ef4444",
    600: "#dc2626",
    700: "#b91c1c",
    800: "#991b1b",
    900: "#7f1d1d",
  },

  info: {
    50: "#eff6ff",
    100: "#dbeafe",
    200: "#bfdbfe",
    300: "#93c5fd",
    400: "#60a5fa",
    500: "#3b82f6",
    600: "#2563eb",
    700: "#1d4ed8",
    800: "#1e40af",
    900: "#1e3a8a",
  },
} as const;

// Typography Scale - Harmonious and functional
export const typography = {
  fontFamily: {
    sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
    serif: ["Crimson Pro", "ui-serif", "Georgia", "serif"],
    mono: ["JetBrains Mono", "ui-monospace", "Consolas", "monospace"],
    display: ["Cal Sans", "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
  },

  fontSize: {
    xs: ["0.75rem", { lineHeight: "1rem" }],
    sm: ["0.875rem", { lineHeight: "1.25rem" }],
    base: ["1rem", { lineHeight: "1.5rem" }],
    lg: ["1.125rem", { lineHeight: "1.75rem" }],
    xl: ["1.25rem", { lineHeight: "1.75rem" }],
    "2xl": ["1.5rem", { lineHeight: "2rem" }],
    "3xl": ["1.875rem", { lineHeight: "2.25rem" }],
    "4xl": ["2.25rem", { lineHeight: "2.5rem" }],
    "5xl": ["3rem", { lineHeight: "1" }],
    "6xl": ["3.75rem", { lineHeight: "1" }],
    "7xl": ["4.5rem", { lineHeight: "1" }],
    "8xl": ["6rem", { lineHeight: "1" }],
    "9xl": ["8rem", { lineHeight: "1" }],
  },

  fontWeight: {
    thin: "100",
    extralight: "200",
    light: "300",
    normal: "400",
    medium: "500",
    semibold: "600",
    bold: "700",
    extrabold: "800",
    black: "900",
  },
} as const;

// Spacing Scale - Consistent and mathematical
export const spacing = {
  px: "1px",
  0: "0",
  0.5: "0.125rem",
  1: "0.25rem",
  1.5: "0.375rem",
  2: "0.5rem",
  2.5: "0.625rem",
  3: "0.75rem",
  3.5: "0.875rem",
  4: "1rem",
  5: "1.25rem",
  6: "1.5rem",
  7: "1.75rem",
  8: "2rem",
  9: "2.25rem",
  10: "2.5rem",
  11: "2.75rem",
  12: "3rem",
  14: "3.5rem",
  16: "4rem",
  20: "5rem",
  24: "6rem",
  28: "7rem",
  32: "8rem",
  36: "9rem",
  40: "10rem",
  44: "11rem",
  48: "12rem",
  52: "13rem",
  56: "14rem",
  60: "15rem",
  64: "16rem",
  72: "18rem",
  80: "20rem",
  96: "24rem",
} as const;

// Border Radius - Smooth and modern
export const borderRadius = {
  none: "0",
  sm: "0.125rem",
  base: "0.25rem",
  md: "0.375rem",
  lg: "0.5rem",
  xl: "0.75rem",
  "2xl": "1rem",
  "3xl": "1.5rem",
  full: "9999px",
} as const;

// Shadows - Subtle depth and elevation
export const boxShadow = {
  sm: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
  base: "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
  md: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
  lg: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
  xl: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)",
  "2xl": "0 25px 50px -12px rgb(0 0 0 / 0.25)",
  inner: "inset 0 2px 4px 0 rgb(0 0 0 / 0.05)",
  none: "0 0 #0000",
} as const;

// Animation and Transitions
export const animation = {
  duration: {
    75: "75ms",
    100: "100ms",
    150: "150ms",
    200: "200ms",
    300: "300ms",
    500: "500ms",
    700: "700ms",
    1000: "1000ms",
  },

  timingFunction: {
    linear: "linear",
    in: "cubic-bezier(0.4, 0, 1, 1)",
    out: "cubic-bezier(0, 0, 0.2, 1)",
    inOut: "cubic-bezier(0.4, 0, 0.2, 1)",
  },

  keyframes: {
    fadeIn: {
      "0%": { opacity: "0" },
      "100%": { opacity: "1" },
    },
    fadeOut: {
      "0%": { opacity: "1" },
      "100%": { opacity: "0" },
    },
    slideInUp: {
      "0%": { transform: "translateY(100%)", opacity: "0" },
      "100%": { transform: "translateY(0)", opacity: "1" },
    },
    slideInDown: {
      "0%": { transform: "translateY(-100%)", opacity: "0" },
      "100%": { transform: "translateY(0)", opacity: "1" },
    },
    scaleIn: {
      "0%": { transform: "scale(0.95)", opacity: "0" },
      "100%": { transform: "scale(1)", opacity: "1" },
    },
  },
} as const;

// Breakpoints for responsive design
export const breakpoints = {
  sm: "640px",
  md: "768px",
  lg: "1024px",
  xl: "1280px",
  "2xl": "1536px",
} as const;

// Z-index scale for layering
export const zIndex = {
  hide: -1,
  auto: "auto",
  base: 0,
  docked: 10,
  dropdown: 1000,
  sticky: 1100,
  banner: 1200,
  overlay: 1300,
  modal: 1400,
  popover: 1500,
  skipLink: 1600,
  toast: 1700,
  tooltip: 1800,
} as const;

// Component-specific design tokens
export const components = {
  button: {
    height: {
      sm: "2rem",
      md: "2.5rem",
      lg: "3rem",
      xl: "3.5rem",
    },
    padding: {
      sm: "0.5rem 0.75rem",
      md: "0.625rem 1rem",
      lg: "0.75rem 1.25rem",
      xl: "1rem 1.5rem",
    },
    fontSize: {
      sm: typography.fontSize.sm[0],
      md: typography.fontSize.base[0],
      lg: typography.fontSize.lg[0],
      xl: typography.fontSize.xl[0],
    },
  },

  input: {
    height: {
      sm: "2rem",
      md: "2.5rem",
      lg: "3rem",
    },
    padding: {
      sm: "0.5rem 0.75rem",
      md: "0.625rem 0.875rem",
      lg: "0.75rem 1rem",
    },
  },

  card: {
    padding: {
      sm: "1rem",
      md: "1.5rem",
      lg: "2rem",
      xl: "2.5rem",
    },
    borderRadius: borderRadius.xl,
    shadow: boxShadow.base,
  },
} as const;

// Utility functions for design system
export const utils = {
  // Create consistent focus styles
  focusRing: (color = colors.primary[500]) => ({
    outline: "2px solid transparent",
    outlineOffset: "2px",
    boxShadow: `0 0 0 2px ${color}`,
  }),

  // Create gradient backgrounds
  gradient: (from: string, to: string, direction = "to right") => ({
    background: `linear-gradient(${direction}, ${from}, ${to})`,
  }),

  // Create glass morphism effect
  glassMorphism: (opacity = 0.1) => ({
    background: `rgba(255, 255, 255, ${opacity})`,
    backdropFilter: "blur(10px)",
    border: "1px solid rgba(255, 255, 255, 0.2)",
  }),

  // Create truncated text styles
  truncate: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
  },

  // Create accessible hide styles for screen readers
  srOnly: {
    position: "absolute" as const,
    width: "1px",
    height: "1px",
    padding: "0",
    margin: "-1px",
    overflow: "hidden",
    clip: "rect(0, 0, 0, 0)",
    whiteSpace: "nowrap" as const,
    border: "0",
  },
} as const;

// Theme configuration
export const theme = {
  colors,
  typography,
  spacing,
  borderRadius,
  boxShadow,
  animation,
  breakpoints,
  zIndex,
  components,
  utils,
} as const;

export type Theme = typeof theme;
export type ThemeColor = keyof typeof colors;
export type ThemeSpacing = keyof typeof spacing;
