/**
 * Core Web Vitals Tracking for VTT Application
 * Simple stub implementation for performance monitoring
 */

import { logger } from "../lib/logger";
import { useEffect, useState } from "react";

// Simple performance metrics tracking
export interface VTTWebVitals {
  lcp: number | null;
  fid: number | null;
  cls: number | null;
  fcp: number | null;
  ttfb: number | null;
}

export function useWebVitals() {
  const [vitals] = useState<VTTWebVitals>({
    lcp: null,
    fid: null,
    cls: null,
    fcp: null,
    ttfb: null,
  });

  useEffect(() => {
    logger.debug("WebVitals tracking initialized with stub implementation");
  }, []);

  return vitals;
}

interface WebVitalMetric {
  name: string;
  value: number;
  delta?: number;
  id?: string;
}

type WebVitalCallback = (metric: WebVitalMetric) => void;

const reportStub = (name: string, callback: WebVitalCallback) => {
  logger.debug(`${name} stub called`);
  callback({ name, value: 0 });
};

// Stub functions for web-vitals compatibility
export const getCLS = (callback: WebVitalCallback) => {
  reportStub("CLS", callback);
};

export const getFID = (callback: WebVitalCallback) => {
  reportStub("FID", callback);
};

export const getFCP = (callback: WebVitalCallback) => {
  reportStub("FCP", callback);
};

export const getLCP = (callback: WebVitalCallback) => {
  reportStub("LCP", callback);
};

export const getTTFB = (callback: WebVitalCallback) => {
  reportStub("TTFB", callback);
};
