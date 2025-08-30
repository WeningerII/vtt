/**
 * Accessibility utilities and helpers for WCAG 2.1 AA compliance
 */

/**
 * Generate descriptive alt text for images based on context
 */
export function generateAltText(
  type: 'map' | 'token' | 'avatar' | 'icon' | 'generated',
  context?: {
    name?: string;
    description?: string;
    index?: number;
    total?: number;
  }
): string {
  switch (type) {
    case 'map':
      return context?.name 
        ? `Map: ${context.name}` 
        : 'Battle map for tabletop gaming';
    
    case 'token':
      return context?.name 
        ? `Game token: ${context.name}` 
        : 'Character or creature token';
    
    case 'avatar':
      return context?.name 
        ? `Avatar for ${context.name}` 
        : 'User avatar image';
    
    case 'icon':
      return context?.description || 'Interface icon';
    
    case 'generated':
      const indexText = context?.index && context?.total 
        ? ` ${context.index} of ${context.total}` 
        : context?.index 
        ? ` ${context.index}` 
        : '';
      const nameText = context?.name ? ` for ${context.name}` : '';
      return `AI generated image${indexText}${nameText}`;
    
    default:
      return 'Image';
  }
}

/**
 * Generate aria-label for interactive elements
 */
export function generateAriaLabel(
  element: 'button' | 'input' | 'select' | 'link',
  action: string,
  context?: {
    target?: string;
    state?: string;
    value?: string;
  }
): string {
  const targetText = context?.target ? ` ${context.target}` : '';
  const stateText = context?.state ? ` (${context.state})` : '';
  const valueText = context?.value ? `: ${context.value}` : '';
  
  switch (element) {
    case 'button':
      return `${action}${targetText}${stateText}`;
    
    case 'input':
      return `${action}${targetText}${valueText}`;
    
    case 'select':
      return `${action}${targetText}${stateText}`;
    
    case 'link':
      return `${action}${targetText}`;
    
    default:
      return action;
  }
}

/**
 * Check if element has sufficient color contrast
 */
export function checkColorContrast(
  foreground: string,
  background: string,
  level: 'AA' | 'AAA' = 'AA'
): boolean {
  // This is a simplified implementation
  // In a real app, you'd use a proper color contrast calculation library
  const minRatio = level === 'AAA' ? 7 : 4.5;
  
  // Convert hex to RGB and calculate luminance
  const getLuminance = (color: string): number => {
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16) / 255;
    const g = parseInt(hex.substr(2, 2), 16) / 255;
    const b = parseInt(hex.substr(4, 2), 16) / 255;
    
    const [rs, gs, bs] = [r, g, b].map(c => 
      c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
    );
    
    return 0.2126 * (rs || 0) + 0.7152 * (gs || 0) + 0.0722 * (bs || 0);
  };
  
  const l1 = getLuminance(foreground);
  const l2 = getLuminance(background);
  const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  
  return ratio >= minRatio;
}

/**
 * Focus management utilities
 */
export class FocusManager {
  private static focusStack: HTMLElement[] = [];
  
  /**
   * Trap focus within a container (for modals)
   */
  static trapFocus(container: HTMLElement): () => void {
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    ) as NodeListOf<HTMLElement>;
    
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    
    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      
      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          lastElement?.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === lastElement) {
          firstElement?.focus();
          e.preventDefault();
        }
      }
    };
    
    container.addEventListener('keydown', handleTabKey);
    firstElement?.focus();
    
    return () => {
      container.removeEventListener('keydown', handleTabKey);
    };
  }
  
  /**
   * Save current focus and restore later
   */
  static saveFocus(): () => void {
    const activeElement = document.activeElement as HTMLElement;
    this.focusStack.push(activeElement);
    
    return () => {
      const elementToFocus = this.focusStack.pop();
      elementToFocus?.focus();
    };
  }
  
  /**
   * Move focus to element and announce to screen readers
   */
  static moveFocusTo(element: HTMLElement, announce?: string): void {
    element.focus();
    
    if (announce) {
      this.announce(announce);
    }
  }
  
  /**
   * Announce message to screen readers
   */
  static announce(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
    const announcer = document.createElement('div');
    announcer.setAttribute('aria-live', priority);
    announcer.setAttribute('aria-atomic', 'true');
    announcer.className = 'sr-only';
    announcer.textContent = message;
    
    document.body.appendChild(announcer);
    
    setTimeout(() => {
      document.body.removeChild(announcer);
    }, 1000);
  }
}

/**
 * Keyboard navigation helpers
 */
export class KeyboardNavigation {
  /**
   * Handle arrow key navigation for grid/list items
   */
  static handleArrowKeys(
    event: KeyboardEvent,
    items: HTMLElement[],
    currentIndex: number,
    options: {
      orientation?: 'horizontal' | 'vertical' | 'grid';
      columns?: number;
      wrap?: boolean;
    } = {}
  ): number {
    const { orientation = 'vertical', columns = 1, wrap = true } = options;
    let newIndex = currentIndex;
    
    switch (event.key) {
      case 'ArrowUp':
        if (orientation === 'grid' && columns > 1) {
          newIndex = currentIndex - columns;
        } else if (orientation === 'vertical') {
          newIndex = currentIndex - 1;
        }
        break;
        
      case 'ArrowDown':
        if (orientation === 'grid' && columns > 1) {
          newIndex = currentIndex + columns;
        } else if (orientation === 'vertical') {
          newIndex = currentIndex + 1;
        }
        break;
        
      case 'ArrowLeft':
        if (orientation === 'horizontal' || orientation === 'grid') {
          newIndex = currentIndex - 1;
        }
        break;
        
      case 'ArrowRight':
        if (orientation === 'horizontal' || orientation === 'grid') {
          newIndex = currentIndex + 1;
        }
        break;
        
      case 'Home':
        newIndex = 0;
        break;
        
      case 'End':
        newIndex = items.length - 1;
        break;
        
      default:
        return currentIndex;
    }
    
    // Handle wrapping and bounds
    if (wrap) {
      if (newIndex < 0) newIndex = items.length - 1;
      if (newIndex >= items.length) newIndex = 0;
    } else {
      newIndex = Math.max(0, Math.min(items.length - 1, newIndex));
    }
    
    if (newIndex !== currentIndex) {
      event.preventDefault();
      items[newIndex]?.focus();
    }
    
    return newIndex;
  }
  
  /**
   * Add keyboard support to custom components
   */
  static addKeyboardSupport(
    element: HTMLElement,
    handlers: {
      onEnter?: () => void;
      onSpace?: () => void;
      onEscape?: () => void;
      onArrowKeys?: (key: string) => void;
    }
  ): () => void {
    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.key) {
        case 'Enter':
          handlers.onEnter?.();
          break;
        case ' ':
          event.preventDefault();
          handlers.onSpace?.();
          break;
        case 'Escape':
          handlers.onEscape?.();
          break;
        case 'ArrowUp':
        case 'ArrowDown':
        case 'ArrowLeft':
        case 'ArrowRight':
          handlers.onArrowKeys?.(event.key);
          break;
      }
    };
    
    element.addEventListener('keydown', handleKeyDown);
    
    return () => {
      element.removeEventListener('keydown', handleKeyDown);
    };
  }
}

/**
 * Screen reader utilities
 */
export class ScreenReader {
  /**
   * Create visually hidden text for screen readers
   */
  static createSROnlyText(text: string): HTMLSpanElement {
    const span = document.createElement('span');
    span.className = 'sr-only';
    span.textContent = text;
    return span;
  }
  
  /**
   * Update aria-describedby relationships
   */
  static updateDescription(
    element: HTMLElement,
    descriptionId: string,
    description: string
  ): void {
    let descElement = document.getElementById(descriptionId);
    
    if (!descElement) {
      descElement = document.createElement('div');
      descElement.id = descriptionId;
      descElement.className = 'sr-only';
      document.body.appendChild(descElement);
    }
    
    descElement.textContent = description;
    element.setAttribute('aria-describedby', descriptionId);
  }
  
  /**
   * Create accessible loading state
   */
  static createLoadingState(message: string = 'Loading'): HTMLDivElement {
    const loadingDiv = document.createElement('div');
    loadingDiv.setAttribute('aria-live', 'polite');
    loadingDiv.setAttribute('aria-busy', 'true');
    loadingDiv.textContent = message;
    return loadingDiv;
  }
}
