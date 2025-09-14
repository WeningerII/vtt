/**
 * Lightweight Accessibility Testing Utilities
 * Automated checks for WCAG compliance without heavy overhead
 */

interface AccessibilityIssue {
  element: Element;
  rule: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  wcagLevel: 'A' | 'AA' | 'AAA';
}

interface AccessibilityReport {
  passed: number;
  failed: number;
  warnings: number;
  issues: AccessibilityIssue[];
  score: number; // 0-100
}

class AccessibilityTester {
  private testQueue: (() => AccessibilityIssue[])[] = [];
  private isRunning: boolean = false;

  /**
   * Core accessibility checks
   */
  
  // Check for missing alt text on images
  private checkImageAltText(): AccessibilityIssue[] {
    const issues: AccessibilityIssue[] = [];
    const images = document.querySelectorAll('img');
    
    images.forEach(img => {
      if (!img.alt && !img.getAttribute('aria-label')) {
        issues.push({
          element: img,
          rule: 'image-alt-text',
          severity: 'error',
          message: 'Image missing alt text or aria-label',
          wcagLevel: 'A'
        });
      }
    });
    
    return issues;
  }

  // Check for proper heading hierarchy
  private checkHeadingHierarchy(): AccessibilityIssue[] {
    const issues: AccessibilityIssue[] = [];
    const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
    let lastLevel = 0;
    
    headings.forEach(heading => {
      const level = parseInt(heading.tagName.charAt(1));
      if (level > lastLevel + 1) {
        issues.push({
          element: heading,
          rule: 'heading-hierarchy',
          severity: 'warning',
          message: `Heading level ${level} skips hierarchy (previous: ${lastLevel})`,
          wcagLevel: 'AA'
        });
      }
      lastLevel = level;
    });
    
    return issues;
  }

  // Check for sufficient color contrast
  private checkColorContrast(): AccessibilityIssue[] {
    const issues: AccessibilityIssue[] = [];
    const textElements = document.querySelectorAll('p, span, div, button, a, label');
    
    textElements.forEach(element => {
      const styles = getComputedStyle(element);
      const backgroundColor = styles.backgroundColor;
      const color = styles.color;
      
      // Only check elements with visible text
      if (element.textContent && element.textContent.trim()) {
        const contrast = this.calculateContrast(color, backgroundColor);
        
        if (contrast < 4.5) { // WCAG AA standard
          issues.push({
            element,
            rule: 'color-contrast',
            severity: 'warning',
            message: `Insufficient color contrast: ${contrast.toFixed(2)} (minimum: 4.5)`,
            wcagLevel: 'AA'
          });
        }
      }
    });
    
    return issues;
  }

  // Check for keyboard accessibility
  private checkKeyboardAccessibility(): AccessibilityIssue[] {
    const issues: AccessibilityIssue[] = [];
    const interactiveElements = document.querySelectorAll(
      'button, a, input, select, textarea, [tabindex]'
    );
    
    interactiveElements.forEach(element => {
      const tabIndex = element.getAttribute('tabindex');
      
      // Check for positive tabindex (anti-pattern)
      if (tabIndex && parseInt(tabIndex) > 0) {
        issues.push({
          element,
          rule: 'tabindex-positive',
          severity: 'warning',
          message: 'Positive tabindex disrupts natural tab order',
          wcagLevel: 'A'
        });
      }
      
      // Check for missing focus indicators
      const styles = getComputedStyle(element, ':focus');
      if (!styles.outline || styles.outline === 'none') {
        issues.push({
          element,
          rule: 'focus-indicator',
          severity: 'warning',
          message: 'Interactive element lacks visible focus indicator',
          wcagLevel: 'AA'
        });
      }
    });
    
    return issues;
  }

  // Check for proper ARIA usage
  private checkAriaUsage(): AccessibilityIssue[] {
    const issues: AccessibilityIssue[] = [];
    const ariaElements = document.querySelectorAll('[aria-labelledby], [aria-describedby]');
    
    ariaElements.forEach(element => {
      const labelledBy = element.getAttribute('aria-labelledby');
      const describedBy = element.getAttribute('aria-describedby');
      
      if (labelledBy && !document.getElementById(labelledBy)) {
        issues.push({
          element,
          rule: 'aria-labelledby-missing',
          severity: 'error',
          message: `aria-labelledby references non-existent element: ${labelledBy}`,
          wcagLevel: 'A'
        });
      }
      
      if (describedBy && !document.getElementById(describedBy)) {
        issues.push({
          element,
          rule: 'aria-describedby-missing',
          severity: 'error',
          message: `aria-describedby references non-existent element: ${describedBy}`,
          wcagLevel: 'A'
        });
      }
    });
    
    return issues;
  }

  // Check for form accessibility
  private checkFormAccessibility(): AccessibilityIssue[] {
    const issues: AccessibilityIssue[] = [];
    const inputs = document.querySelectorAll('input, textarea, select');
    
    inputs.forEach(input => {
      const hasLabel = input.id && document.querySelector(`label[for="${input.id}"]`);
      const hasAriaLabel = input.getAttribute('aria-label');
      const hasAriaLabelledby = input.getAttribute('aria-labelledby');
      
      if (!hasLabel && !hasAriaLabel && !hasAriaLabelledby) {
        issues.push({
          element: input,
          rule: 'form-label-missing',
          severity: 'error',
          message: 'Form input lacks proper labeling',
          wcagLevel: 'A'
        });
      }
    });
    
    return issues;
  }

  /**
   * Utility function to calculate color contrast ratio
   */
  private calculateContrast(color1: string, color2: string): number {
    const rgb1 = this.parseColor(color1);
    const rgb2 = this.parseColor(color2);
    
    if (!rgb1 || !rgb2) {return 21;} // Assume good contrast if we can't parse
    
    const l1 = this.relativeLuminance(rgb1);
    const l2 = this.relativeLuminance(rgb2);
    
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    
    return (lighter + 0.05) / (darker + 0.05);
  }

  private parseColor(color: string): [number, number, number] | null {
    // Simple RGB parsing - for production, use a proper color library
    const rgb = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (rgb && rgb[1] && rgb[2] && rgb[3]) {
      return [parseInt(rgb[1]), parseInt(rgb[2]), parseInt(rgb[3])];
    }
    return null;
  }

  private relativeLuminance([r, g, b]: [number, number, number]): number {
    const [rs, gs, bs] = [r, g, b].map(c => {
      c /= 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * (rs || 0) + 0.7152 * (gs || 0) + 0.0722 * (bs || 0);
  }

  /**
   * Run all accessibility tests
   */
  async runTests(): Promise<AccessibilityReport> {
    if (this.isRunning) {
      throw new Error('Accessibility tests already running');
    }

    this.isRunning = true;
    const allIssues: AccessibilityIssue[] = [];

    try {
      // Run tests with small delays to prevent UI blocking
      const testResults = await Promise.all([
        this.runTestAsync(() => this.checkImageAltText()),
        this.runTestAsync(() => this.checkHeadingHierarchy()),
        this.runTestAsync(() => this.checkKeyboardAccessibility()),
        this.runTestAsync(() => this.checkAriaUsage()),
        this.runTestAsync(() => this.checkFormAccessibility()),
      ]);

      testResults.forEach(issues => allIssues.push(...issues));

      const errors = allIssues.filter(i => i.severity === 'error').length;
      const warnings = allIssues.filter(i => i.severity === 'warning').length;
      const passed = Math.max(0, 20 - errors - warnings); // Assume 20 total checks

      const score = Math.max(0, Math.round(100 - (errors * 10) - (warnings * 5)));

      return {
        passed,
        failed: errors,
        warnings,
        issues: allIssues,
        score
      };
    } finally {
      this.isRunning = false;
    }
  }

  private runTestAsync(testFn: () => AccessibilityIssue[]): Promise<AccessibilityIssue[]> {
    return new Promise(resolve => {
      setTimeout(() => resolve(testFn()), 10);
    });
  }

  /**
   * Quick accessibility health check
   */
  quickCheck(): { score: number; criticalIssues: number } {
    const images = document.querySelectorAll('img:not([alt]):not([aria-label])').length;
    const unlinkedAria = document.querySelectorAll('[aria-labelledby]:not([aria-labelledby=""])').length;
    const unlabeledInputs = document.querySelectorAll('input:not([aria-label]):not([id])').length;

    const criticalIssues = images + unlinkedAria + unlabeledInputs;
    const score = Math.max(0, 100 - (criticalIssues * 15));

    return { score, criticalIssues };
  }
}

// Singleton instance
export const accessibilityTester = new AccessibilityTester();

/**
 * React hook for accessibility testing
 */
export function useAccessibilityTester() {
  return {
    runTests: accessibilityTester.runTests.bind(accessibilityTester),
    quickCheck: accessibilityTester.quickCheck.bind(accessibilityTester)
  };
}

/**
 * Gaming-specific accessibility checks
 */
export class GamingAccessibilityTester extends AccessibilityTester {
  // Check dice roller accessibility
  checkDiceRollerA11y(): AccessibilityIssue[] {
    const issues: AccessibilityIssue[] = [];
    const diceButtons = document.querySelectorAll('[data-testid*="dice"], button[aria-label*="dice"]');
    
    diceButtons.forEach(button => {
      if (!button.getAttribute('aria-label')) {
        issues.push({
          element: button,
          rule: 'gaming-dice-label',
          severity: 'error',
          message: 'Dice button missing descriptive aria-label',
          wcagLevel: 'A'
        });
      }
    });
    
    return issues;
  }

  // Check character sheet accessibility
  checkCharacterSheetA11y(): AccessibilityIssue[] {
    const issues: AccessibilityIssue[] = [];
    const statBlocks = document.querySelectorAll('[data-testid*="stat"], .character-stat');
    
    statBlocks.forEach(stat => {
      if (!stat.getAttribute('aria-label') && !stat.textContent?.includes(':')) {
        issues.push({
          element: stat,
          rule: 'character-stat-label',
          severity: 'warning',
          message: 'Character stat lacks clear labeling for screen readers',
          wcagLevel: 'AA'
        });
      }
    });
    
    return issues;
  }
}

export const gamingAccessibilityTester = new GamingAccessibilityTester();
