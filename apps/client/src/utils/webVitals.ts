/**
 * Core Web Vitals Tracking for VTT Application
 * Simple stub implementation for performance monitoring
 */

import { logger } from '../lib/logger';
import { useState, useEffect } from 'react';

// Simple performance metrics tracking
export interface VTTWebVitals {
  lcp: number | null;
  fid: number | null; 
  cls: number | null;
  fcp: number | null;
  ttfb: number | null;
}

export function useWebVitals() {
  const [vitals, setVitals] = useState<VTTWebVitals>({
    lcp: null,
    fid: null,
    cls: null,
    fcp: null,
    ttfb: null
  });

  useEffect(() => {
    logger.debug('WebVitals tracking initialized with stub implementation');
  }, []);

  return vitals;
}

// Stub functions for web-vitals compatibility
export const getCLS = (callback: (metric: any) => void) => {
  logger.debug('getCLS stub called');
};

export const getFID = (callback: (metric: any) => void) => {
  logger.debug('getFID stub called');
};

export const getFCP = (callback: (metric: any) => void) => {
  logger.debug('getFCP stub called');
};

export const getLCP = (callback: (metric: any) => void) => {
  logger.debug('getLCP stub called');
};

export const getTTFB = (callback: (metric: any) => void) => {
  logger.debug('getTTFB stub called');
};
