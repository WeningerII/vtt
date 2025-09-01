/**
 * Modal Component - Standardized modal with consistent variants and accessibility
 */
import React, { useEffect, useRef, memo } from "react";
import { createPortal } from "react-dom";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";
import { X } from "./Icons";
import { Button } from "./Button";

const modalVariants = cva(
  [
    "relative bg-white rounded-xl shadow-xl",
    "transform transition-all duration-200 ease-out",
    "max-h-[90vh] overflow-y-auto"
  ],
  {
    variants: {
      size: {
        sm: "max-w-md w-full mx-4",
        md: "max-w-lg w-full mx-4", 
        lg: "max-w-2xl w-full mx-4",
        xl: "max-w-4xl w-full mx-4",
        full: "max-w-full w-full h-full m-0 rounded-none"
      },
      variant: {
        default: "border border-neutral-200",
        elevated: "shadow-2xl border-0",
        glass: "bg-white/80 backdrop-blur-lg border border-white/20"
      }
    },
    defaultVariants: {
      size: "md",
      variant: "default"
    }
  }
);

const overlayVariants = cva(
  [
    "fixed inset-0 z-50 flex items-center justify-center p-4",
    "backdrop-blur-sm transition-all duration-200"
  ],
  {
    variants: {
      variant: {
        default: "bg-black/50",
        dark: "bg-black/70", 
        light: "bg-white/30"
      }
    },
    defaultVariants: {
      variant: "default"
    }
  }
);

export interface ModalProps extends VariantProps<typeof modalVariants> {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  overlayClassName?: string;
  showCloseButton?: boolean;
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
  overlayVariant?: VariantProps<typeof overlayVariants>['variant'];
}

const Modal = memo<ModalProps>(({
  isOpen,
  onClose,
  title,
  description,
  children,
  size,
  variant,
  className,
  overlayClassName,
  showCloseButton = true,
  closeOnOverlayClick = true,
  closeOnEscape = true,
  overlayVariant = "default"
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const titleId = useRef(`modal-title-${Math.random().toString(36).slice(2, 9)}`).current;
  const descId = useRef(`modal-desc-${Math.random().toString(36).slice(2, 9)}`).current;

  useEffect(() => {
    if (!isOpen) return;

    // Focus management
    const previousActiveElement = document.activeElement as HTMLElement;
    modalRef.current?.focus();

    // Escape key handler
    const handleEscape = (e: KeyboardEvent) => {
      if (closeOnEscape && e.key === "Escape") {
        onClose();
      }
    };

    // Focus trap
    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !modalRef.current) return;

      const focusableElements = modalRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      
      const firstElement = focusableElements[0] as HTMLElement;
      const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

      if (e.shiftKey && document.activeElement === firstElement) {
        lastElement?.focus();
        e.preventDefault();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        firstElement?.focus();
        e.preventDefault();
      }
    };

    document.addEventListener("keydown", handleEscape);
    document.addEventListener("keydown", handleTab);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.removeEventListener("keydown", handleTab);
      document.body.style.overflow = "unset";
      previousActiveElement?.focus();
    };
  }, [isOpen, closeOnEscape, onClose]);

  if (!isOpen) return null;

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (closeOnOverlayClick && e.target === e.currentTarget) {
      onClose();
    }
  };

  const modal = (
    <div
      className={cn(overlayVariants({ variant: overlayVariant }), overlayClassName)}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? titleId : undefined}
      aria-describedby={description ? descId : undefined}
    >
      <div
        ref={modalRef}
        className={cn(modalVariants({ size, variant }), className)}
        tabIndex={-1}
      >
        {/* Header */}
        {(title || showCloseButton) && (
          <div className="flex items-center justify-between p-6 pb-0">
            <div className="flex-1 min-w-0">
              {title && (
                <h2
                  id={titleId}
                  className="text-xl font-semibold text-neutral-900 truncate"
                >
                  {title}
                </h2>
              )}
              {description && (
                <p
                  id={descId}
                  className="mt-1 text-sm text-neutral-600"
                >
                  {description}
                </p>
              )}
            </div>
            
            {showCloseButton && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="ml-4 rounded-full"
                aria-label="Close modal"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}

        {/* Content */}
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
});

Modal.displayName = "Modal";

// Modal sub-components for structured content
const ModalHeader = memo<React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }) => (
    <div 
      className={cn("flex items-center justify-between pb-4 border-b border-neutral-200", className)}
      {...props}
    >
      {children}
    </div>
  )
);
ModalHeader.displayName = "ModalHeader";

const ModalBody = memo<React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }) => (
    <div className={cn("py-4", className)} {...props}>
      {children}
    </div>
  )
);
ModalBody.displayName = "ModalBody";

const ModalFooter = memo<React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }) => (
    <div 
      className={cn("flex items-center justify-end gap-3 pt-4 border-t border-neutral-200", className)}
      {...props}
    >
      {children}
    </div>
  )
);
ModalFooter.displayName = "ModalFooter";

export { Modal, ModalHeader, ModalBody, ModalFooter, modalVariants };
