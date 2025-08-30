/**
 * Rendering Package Entry Point
 * Exports all rendering-related components
 */

export * from "./LightingSystem";
export * from "./EffectsSystem";

// Re-export commonly used types for convenience
export type {
  LightSource,
  AmbientLight,
  LightingSettings,
  VisionSource,
  LightingResult,
  LightingEvent,
} from "./LightingSystem";

export type {
  Effect,
  ParticleEffect,
  AnimationEffect,
  ShaderEffect,
  OverlayEffect,
  EffectAnimation,
  EffectTemplate,
  EffectsEvent,
} from "./EffectsSystem";
