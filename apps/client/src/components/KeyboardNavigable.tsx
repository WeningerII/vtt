/**
 * Keyboard Navigation Component for accessible grid/list navigation
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { KeyboardNavigation } from '../utils/accessibility';

interface KeyboardNavigableProps {
  children: React.ReactNode;
  orientation?: 'horizontal' | 'vertical' | 'grid';
  columns?: number;
  wrap?: boolean;
  className?: string;
  onSelectionChange?: (index: number) => void;
  initialFocus?: number;
  role?: 'grid' | 'listbox' | 'menu' | 'tablist';
}

export const KeyboardNavigable: React.FC<KeyboardNavigableProps> = ({
  children,
  orientation = 'vertical',
  columns = 1,
  wrap = true,
  className = '',
  onSelectionChange,
  initialFocus = 0,
  role = 'grid'
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndex] = useState(initialFocus);
  const [items, setItems] = useState<HTMLElement[]>([]);

  // Update items when children change
  useEffect(() => {
    if (containerRef.current) {
      const focusableItems = Array.from(
        containerRef.current.querySelectorAll('[data-keyboard-item]')
      ) as HTMLElement[];
      setItems(focusableItems);
      
      // Set initial tabindex values
      focusableItems.forEach((item, index) => {
        item.setAttribute('tabindex', index === currentIndex ? '0' : '-1');
      });
    }
  }, [children, currentIndex]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (items.length === 0) return;

    const newIndex = KeyboardNavigation.handleArrowKeys(
      event,
      items,
      currentIndex,
      { orientation, columns, wrap }
    );

    if (newIndex !== currentIndex) {
      // Update tabindex values
      items[currentIndex]?.setAttribute('tabindex', '-1');
      items[newIndex]?.setAttribute('tabindex', '0');
      
      setCurrentIndex(newIndex);
      onSelectionChange?.(newIndex);
    }
  }, [items, currentIndex, orientation, columns, wrap, onSelectionChange]);

  // Set up keyboard event listeners
  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.addEventListener('keydown', handleKeyDown);
      return () => container.removeEventListener('keydown', handleKeyDown);
    }
  }, [handleKeyDown]);

  // ARIA attributes based on role
  const getAriaAttributes = () => {
    const baseAttrs = {
      role,
      'aria-activedescendant': items[currentIndex]?.id
    };

    switch (role) {
      case 'grid':
        return {
          ...baseAttrs,
          'aria-rowcount': Math.ceil(items.length / columns),
          'aria-colcount': columns
        };
      case 'listbox':
        return {
          ...baseAttrs,
          'aria-multiselectable': false
        };
      default:
        return baseAttrs;
    }
  };

  return (
    <div
      ref={containerRef}
      className={`keyboard-navigable ${className}`}
      {...getAriaAttributes()}
    >
      {children}
    </div>
  );
};

// Helper component for keyboard navigable items
interface KeyboardNavigableItemProps {
  children: React.ReactNode;
  index: number;
  className?: string;
  onClick?: () => void;
  onEnter?: () => void;
  onSpace?: () => void;
  role?: string;
  id?: string;
}

export const KeyboardNavigableItem: React.FC<KeyboardNavigableItemProps> = ({
  children,
  index,
  className = '',
  onClick,
  onEnter,
  onSpace,
  role = 'gridcell',
  id
}) => {
  const itemRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const item = itemRef.current;
    if (!item) return;

    const keyboardOptions: { onEnter?: () => void; onSpace?: () => void; onEscape?: () => void; onArrowKeys?: (key: string) => void } = {};
    const enterHandler = onEnter || onClick;
    const spaceHandler = onSpace || onClick;
    if (enterHandler) keyboardOptions.onEnter = enterHandler;
    if (spaceHandler) keyboardOptions.onSpace = spaceHandler;
    
    const cleanup = KeyboardNavigation.addKeyboardSupport(item, keyboardOptions);

    return cleanup;
  }, [onClick, onEnter, onSpace]);

  return (
    <div
      ref={itemRef}
      data-keyboard-item
      className={`keyboard-navigable-item ${className}`}
      role={role}
      id={id || `keyboard-item-${index}`}
      tabIndex={-1}
      onClick={onClick}
    >
      {children}
    </div>
  );
};

export default KeyboardNavigable;
