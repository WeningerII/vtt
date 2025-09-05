/**
 * Core Web Vitals Tracking for VTT Application
 * Implements comprehensive performance monitoring including LCP, FID, CLS, FCP, and TTFB
 */

import { useState, useEffect } from 'react';

interface WebVitalMetric {
  name: 'CLS' | 'FID' | 'FCP' | 'LCP' | 'TTFB';
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta: number;
  id: string;
  navigationType: string;
}

interface VTTWebVitals {
  lcp: number | null;
  fid: number | null;
  cls: number | null;
  fcp: number | null;
  ttfb: number | null;
}

class WebVitalsTracker {
  private vitals: VTTWebVitals = {
    lcp: null,
    fid: null,
    cls: null,
    fcp: null,
    ttfb: null
  };

  private observers: ((vitals: VTTWebVitals) => void)[] = [];

  constructor() {
    this.initializeTracking();
  }

  private initializeTracking() {
    // Track Largest Contentful Paint (LCP)
    this.trackLCP();
    
    // Track First Input Delay (FID)
    this.trackFID();
    
    // Track Cumulative Layout Shift (CLS)
    this.trackCLS();
    
    // Track First Contentful Paint (FCP)
    this.trackFCP();
    
    // Track Time to First Byte (TTFB)
    this.trackTTFB();
  }

  private trackLCP() {
    if (!('PerformanceObserver' in window)) {return;}

    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1] as PerformanceEntry;
      
      this.vitals.lcp = lastEntry.startTime;
      this.notifyObservers();
      
      // Log performance
      const rating = this.getRating('LCP', lastEntry.startTime);
      console.log(`LCP: ${lastEntry.startTime.toFixed(2)}ms (${rating})`);
      
      if (rating === 'poor') {
        console.warn('Poor LCP detected. Consider optimizing images and critical resources.');
      }
    });

    try {
      observer.observe({ entryTypes: ['largest-contentful-paint'] });
    } catch (e) {
      console.warn('LCP tracking not supported');
    }
  }

  private trackFID() {
    if (!('PerformanceObserver' in window)) {return;}

    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry: any) => {
        this.vitals.fid = entry.processingStart - entry.startTime;
        this.notifyObservers();
        
        const rating = this.getRating('FID', this.vitals.fid);
        console.log(`FID: ${this.vitals.fid.toFixed(2)}ms (${rating})`);
        
        if (rating === 'poor') {
          console.warn('Poor FID detected. Consider reducing JavaScript execution time.');
        }
      });
    });

    try {
      observer.observe({ entryTypes: ['first-input'] });
    } catch (e) {
      console.warn('FID tracking not supported');
    }
  }

  private trackCLS() {
    if (!('PerformanceObserver' in window)) {return;}

    let clsValue = 0;
    let sessionValue = 0;
    let sessionEntries: any[] = [];

    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      
      entries.forEach((entry: any) => {
        if (!entry.hadRecentInput) {
          const firstSessionEntry = sessionEntries[0];
          const lastSessionEntry = sessionEntries[sessionEntries.length - 1];

          if (sessionValue && 
              entry.startTime - lastSessionEntry.startTime < 1000 &&
              entry.startTime - firstSessionEntry.startTime < 5000) {
            sessionValue += entry.value;
            sessionEntries.push(entry);
          } else {
            sessionValue = entry.value;
            sessionEntries = [entry];
          }

          if (sessionValue > clsValue) {
            clsValue = sessionValue;
            this.vitals.cls = clsValue;
            this.notifyObservers();
            
            const rating = this.getRating('CLS', clsValue);
            console.log(`CLS: ${clsValue.toFixed(4)} (${rating})`);
            
            if (rating === 'poor') {
              console.warn('Poor CLS detected. Avoid layout shifts by reserving space for dynamic content.');
            }
          }
        }
      });
    });

    try {
      observer.observe({ entryTypes: ['layout-shift'] });
    } catch (e) {
      console.warn('CLS tracking not supported');
    }
  }

  private trackFCP() {
    if (!('PerformanceObserver' in window)) {return;}

    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry) => {
        if (entry.name === 'first-contentful-paint') {
          this.vitals.fcp = entry.startTime;
          this.notifyObservers();
          
          const rating = this.getRating('FCP', entry.startTime);
          console.log(`FCP: ${entry.startTime.toFixed(2)}ms (${rating})`);
        }
      });
    });

    try {
      observer.observe({ entryTypes: ['paint'] });
    } catch (e) {
      console.warn('FCP tracking not supported');
    }
  }

  private trackTTFB() {
    if (!('performance' in window) || !('getEntriesByType' in performance)) {return;}

    const navigationEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
    if (navigationEntries.length > 0) {
      const entry = navigationEntries[0];
      this.vitals.ttfb = entry!.responseStart - entry!.requestStart;
      this.notifyObservers();
      
      const rating = this.getRating('TTFB', this.vitals.ttfb);
      console.log(`TTFB: ${this.vitals.ttfb.toFixed(2)}ms (${rating})`);
      
      if (rating === 'poor') {
        console.warn('Poor TTFB detected. Consider server optimization or CDN usage.');
      }
    }
  }

  private getRating(metric: string, value: number): 'good' | 'needs-improvement' | 'poor' {
    const thresholds = {
      LCP: { good: 2500, poor: 4000 },
      FID: { good: 100, poor: 300 },
      CLS: { good: 0.1, poor: 0.25 },
      FCP: { good: 1800, poor: 3000 },
      TTFB: { good: 800, poor: 1800 }
    };

    const threshold = thresholds[metric as keyof typeof thresholds];
    if (!threshold) {return 'good';}

    if (value <= threshold.good) {return 'good';}
    if (value <= threshold.poor) {return 'needs-improvement';}
    return 'poor';
  }

  private notifyObservers() {
    this.observers.forEach(observer => observer(this.vitals));
  }

  public subscribe(observer: (vitals: VTTWebVitals) => void) {
    this.observers.push(observer);
    return () => {
      const index = this.observers.indexOf(observer);
      if (index > -1) {
        this.observers.splice(index, 1);
      }
    };
  }

  public getVitals(): VTTWebVitals {
    return { ...this.vitals };
  }

  public getPerformanceScore(): number {
    const vitals = this.vitals;
    let score = 100;
    
    // LCP scoring (25% weight)
    if (vitals.lcp !== null) {
      if (vitals.lcp > 4000) {score -= 25;}
      else if (vitals.lcp > 2500) {score -= 12.5;}
    }
    
    // FID scoring (25% weight)
    if (vitals.fid !== null) {
      if (vitals.fid > 300) {score -= 25;}
      else if (vitals.fid > 100) {score -= 12.5;}
    }
    
    // CLS scoring (25% weight)
    if (vitals.cls !== null) {
      if (vitals.cls > 0.25) {score -= 25;}
      else if (vitals.cls > 0.1) {score -= 12.5;}
    }
    
    // FCP scoring (15% weight)
    if (vitals.fcp !== null) {
      if (vitals.fcp > 3000) {score -= 15;}
      else if (vitals.fcp > 1800) {score -= 7.5;}
    }
    
    // TTFB scoring (10% weight)
    if (vitals.ttfb !== null) {
      if (vitals.ttfb > 1800) {score -= 10;}
      else if (vitals.ttfb > 800) {score -= 5;}
    }
    
    return Math.max(0, score);
  }

  public generateReport(): string {
    const vitals = this.vitals;
    const score = this.getPerformanceScore();
    
    let report = `\n🎯 VTT Performance Report (Score: ${score}/100)\n`;
    report += `${'=' .repeat(50)  }\n`;
    
    if (vitals.lcp !== null) {
      const rating = this.getRating('LCP', vitals.lcp);
      const emoji = rating === 'good' ? '✅' : rating === 'needs-improvement' ? '⚠️' : '❌';
      report += `${emoji} LCP: ${vitals.lcp.toFixed(2)}ms (${rating})\n`;
    }
    
    if (vitals.fid !== null) {
      const rating = this.getRating('FID', vitals.fid);
      const emoji = rating === 'good' ? '✅' : rating === 'needs-improvement' ? '⚠️' : '❌';
      report += `${emoji} FID: ${vitals.fid.toFixed(2)}ms (${rating})\n`;
    }
    
    if (vitals.cls !== null) {
      const rating = this.getRating('CLS', vitals.cls);
      const emoji = rating === 'good' ? '✅' : rating === 'needs-improvement' ? '⚠️' : '❌';
      report += `${emoji} CLS: ${vitals.cls.toFixed(4)} (${rating})\n`;
    }
    
    if (vitals.fcp !== null) {
      const rating = this.getRating('FCP', vitals.fcp);
      const emoji = rating === 'good' ? '✅' : rating === 'needs-improvement' ? '⚠️' : '❌';
      report += `${emoji} FCP: ${vitals.fcp.toFixed(2)}ms (${rating})\n`;
    }
    
    if (vitals.ttfb !== null) {
      const rating = this.getRating('TTFB', vitals.ttfb);
      const emoji = rating === 'good' ? '✅' : rating === 'needs-improvement' ? '⚠️' : '❌';
      report += `${emoji} TTFB: ${vitals.ttfb.toFixed(2)}ms (${rating})\n`;
    }
    
    report += '\n📊 Recommendations:\n';
    
    if (vitals.lcp && vitals.lcp > 2500) {
      report += '• Optimize images and critical resources for faster LCP\n';
    }
    if (vitals.fid && vitals.fid > 100) {
      report += '• Reduce JavaScript execution time for better FID\n';
    }
    if (vitals.cls && vitals.cls > 0.1) {
      report += '• Reserve space for dynamic content to improve CLS\n';
    }
    if (vitals.fcp && vitals.fcp > 1800) {
      report += '• Optimize critical rendering path for faster FCP\n';
    }
    if (vitals.ttfb && vitals.ttfb > 800) {
      report += '• Consider server optimization or CDN for better TTFB\n';
    }
    
    return report;
  }
}

// Global instance
export const webVitalsTracker = new WebVitalsTracker();

// React hook for using Web Vitals
export function useWebVitals() {
  const [vitals, setVitals] = useState<VTTWebVitals>({
    lcp: null,
    fid: null,
    cls: null,
    fcp: null,
    ttfb: null
  });

  useEffect(() => {
    const unsubscribe = webVitalsTracker.subscribe(setVitals);
    return unsubscribe;
  }, []);

  return {
    vitals,
    score: webVitalsTracker.getPerformanceScore(),
    report: webVitalsTracker.generateReport()
  };
}

// Initialize tracking on import
if (typeof window !== 'undefined') {
  // Start tracking after page load
  if (document.readyState === 'complete') {
    webVitalsTracker;
  } else {
    window.addEventListener('load', () => {
      webVitalsTracker;
    });
  }
}
