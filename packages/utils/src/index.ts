/**
 * @vtt/utils - Utility functions for VTT
 */

export * as dateUtils from "./date";
export * as mathUtils from "./math";
export * as stringUtils from "./string";

// Re-export commonly used functions at the top level
export { formatDate, timeDifference, isToday, addDays } from "./date";

export { clamp, lerp, distance, randomBetween, average } from "./math";

export { capitalize, toTitleCase, truncate, isEmpty, escapeHtml } from "./string";
