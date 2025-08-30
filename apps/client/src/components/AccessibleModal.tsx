/**
 * Accessible Modal Component with focus management and ARIA support
 */

import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FocusManager } from '../utils/accessibility';
import AccessibleButton from './AccessibleButton';

interface AccessibleModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
}

export const AccessibleModal: React.FC<AccessibleModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  className = '',
  size = 'md',
  closeOnOverlayClick = true,
  closeOnEscape = true
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const titleId = `modal-title-${Math.random().toString(36).substr(2, 9)}`;
  const descriptionId = `modal-description-${Math.random().toString(36).substr(2, 9)}`;

  useEffect(() => {
    if (!isOpen) return;

    // Save current focus and set up focus trap
    const restoreFocus = FocusManager.saveFocus();
    let releaseFocusTrap: (() => void) | undefined;

    if (modalRef.current) {
      releaseFocusTrap = FocusManager.trapFocus(modalRef.current);
    }

    // Handle escape key
    const handleEscape = (event: KeyboardEvent) => {
      if (closeOnEscape && event.key === 'Escape') {
        onClose();
      }
    };

    // Prevent body scroll
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleEscape);

    // Announce modal opening to screen readers
    FocusManager.announce(`${title} dialog opened`, 'assertive');

    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleEscape);
      releaseFocusTrap?.();
      restoreFocus();
      
      // Announce modal closing
      FocusManager.announce(`${title} dialog closed`, 'polite');
    };
  }, [isOpen, onClose, title, closeOnEscape]);

  if (!isOpen) return null;

  const handleOverlayClick = (event: React.MouseEvent) => {
    if (closeOnOverlayClick && event.target === event.currentTarget) {
      onClose();
    }
  };

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl'
  };

  return createPortal(
    <div
      className="modal-overlay"
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
     >
      <div
        ref={modalRef}
        className={`modal-content ${sizeClasses[size]} ${className}`}
      >
        <div className="modal-header">
          <h2 id={titleId} className="modal-title">
            {title}
          </h2>
          <AccessibleButton
            variant="ghost"
            size="sm"
            action="Close"
            target="modal"
            onClick={onClose}
            className="modal-close"
            aria-label={`Close ${title} dialog`}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </AccessibleButton>
        </div>
        
        <div id={descriptionId} className="modal-body">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default AccessibleModal;
