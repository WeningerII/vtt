/**
 * Enhanced Gaming Modal Component - Gaming-optimized modal with VTT-specific features
 */
import React, { useEffect, useRef, memo, useCallback, useState } from "react";
import { createPortal } from "react-dom";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";
import { X } from "./Icons";
import { Button } from "./Button";

const modalVariants = cva(
  [
    "relative bg-bg-secondary rounded-xl shadow-xl",
    "transform transition-all duration-300 ease-out",
    "max-h-[90vh] overflow-y-auto border border-border-primary",
  ],
  {
    variants: {
      size: {
        sm: "max-w-md w-full mx-4",
        md: "max-w-lg w-full mx-4",
        lg: "max-w-2xl w-full mx-4",
        xl: "max-w-4xl w-full mx-4",
        full: "max-w-full w-full h-full m-0 rounded-none",
        "character-sheet": "max-w-3xl w-full mx-4 min-h-[600px]",
        "dice-roller": "max-w-sm w-full mx-4 aspect-square",
      },
      variant: {
        default: "bg-bg-secondary border-border-primary",
        elevated: "bg-bg-secondary shadow-2xl border-border-primary",
        glass: "bg-bg-secondary/80 backdrop-blur-lg border-border-secondary",
        gaming:
          "bg-gradient-to-br from-surface-elevated to-surface-secondary border-primary-500/30 shadow-[0_0_30px_rgba(var(--primary-500),0.3)]",
        "dice-result":
          "bg-gradient-to-br from-emerald-900/20 to-emerald-800/40 border-emerald-500/50 shadow-[0_0_25px_rgba(16,185,129,0.4)]",
        "character-modal":
          "bg-gradient-to-br from-purple-900/20 to-indigo-900/40 border-indigo-500/50 shadow-[0_0_25px_rgba(99,102,241,0.3)]",
        "combat-modal":
          "bg-gradient-to-br from-red-900/20 to-orange-900/40 border-red-500/50 shadow-[0_0_25px_rgba(239,68,68,0.4)]",
      },
    },
    defaultVariants: {
      size: "md",
      variant: "default",
    },
  },
);

const overlayVariants = cva(
  [
    "fixed inset-0 z-50 flex items-center justify-center p-4",
    "backdrop-blur-sm transition-all duration-200",
  ],
  {
    variants: {
      variant: {
        default: "bg-bg-overlay",
        dark: "bg-black/80",
        light: "bg-bg-overlay/60",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

// Gaming-specific modal types
export type GamingModalType =
  | "dice-roll"
  | "character-sheet"
  | "combat"
  | "inventory"
  | "spell-cast"
  | "level-up";

export interface GamingFeatures {
  type?: GamingModalType;
  playSound?: boolean;
  hapticFeedback?: boolean;
  showAnimation?: boolean;
  keyboardShortcuts?: Record<string, () => void>;
  autoFocus?: string;
  persistPosition?: boolean;
  gameContext?: Record<string, unknown>;
}

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
  overlayVariant?: VariantProps<typeof overlayVariants>["variant"];
  gaming?: GamingFeatures;
  onOpen?: () => void;
  zIndex?: number;
}

const Modal = memo<ModalProps>((props) => {
  const {
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
    overlayVariant = "default",
    gaming,
    onOpen: _onOpen,
    zIndex: _zIndex = 50,
  } = props;
  const modalRef = useRef<HTMLDivElement>(null);
  const titleId = useRef(`modal-title-${Math.random().toString(36).slice(2, 9)}`).current;
  const descId = useRef(`modal-desc-${Math.random().toString(36).slice(2, 9)}`).current;
  const [_isAnimating, _setIsAnimating] = useState(false);

  // Gaming feedback system
  const triggerGamingFeedback = useCallback(
    async (action: "open" | "close" | "action") => {
      if (!gaming) {
        return;
      }

      if (gaming.hapticFeedback && "vibrate" in navigator) {
        const patterns = { open: [100, 50, 100], close: [50], action: [25, 25, 25] };
        navigator.vibrate(patterns[action]);
      }

      if (gaming.playSound && gaming.type) {
        const soundMap = {
          "dice-roll": "/assets/audio/dice-roll.mp3",
          "character-sheet": "/assets/audio/parchment.mp3",
          combat: "/assets/audio/sword-clash.mp3",
          inventory: "/assets/audio/bag-rustle.mp3",
          "spell-cast": "/assets/audio/magic-cast.mp3",
          "level-up": "/assets/audio/level-up.mp3",
        };
        const soundFile = soundMap[gaming.type];
        if (soundFile) {
          try {
            const audio = new Audio(soundFile);
            audio.volume = 0.3;
            await audio.play();
          } catch (_error) {
            // Silent fail
          }
        }
      }
    },
    [gaming],
  );

  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (closeOnEscape && e.key === "Escape") {
        triggerGamingFeedback("close");
        onClose();
      }
    },
    [closeOnEscape, onClose, triggerGamingFeedback],
  );

  const _handleGamingKeyboard = useCallback(
    (e: KeyboardEvent) => {
      if (!gaming?.keyboardShortcuts) {
        return;
      }
      const key = e.key.toLowerCase();
      const shortcut = gaming.keyboardShortcuts[key];
      if (shortcut) {
        e.preventDefault();
        shortcut();
        triggerGamingFeedback("action");
      }
    },
    [gaming, triggerGamingFeedback],
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    // Focus management
    const previousActiveElement = document.activeElement as HTMLElement;
    modalRef.current?.focus();

    // Focus trap
    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !modalRef.current) {
        return;
      }

      const focusableElements = modalRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
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
  }, [isOpen, handleEscape]);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (closeOnOverlayClick && e.target === e.currentTarget) {
        onClose();
      }
    },
    [closeOnOverlayClick, onClose],
  );

  if (!isOpen) {
    return null;
  }

  const modal = (
    <div
      className={cn(overlayVariants({ variant: overlayVariant }), overlayClassName)}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? titleId : undefined}
      aria-describedby={description ? descId : undefined}
    >
      <div ref={modalRef} className={cn(modalVariants({ size, variant }), className)} tabIndex={-1}>
        {/* Header */}
        {(title || showCloseButton) && (
          <div className="flex items-center justify-between p-6 pb-0">
            <div className="flex-1 min-w-0">
              {title && (
                <h2 id={titleId} className="text-xl font-semibold text-text-primary truncate">
                  {title}
                </h2>
              )}
              {description && (
                <p id={descId} className="mt-1 text-sm text-text-secondary">
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
        <div className="p-6">{children}</div>
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
      className={cn(
        "flex items-center justify-between pb-4 border-b border-border-secondary",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  ),
);
ModalHeader.displayName = "ModalHeader";

const ModalBody = memo<React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }) => (
    <div className={cn("py-4", className)} {...props}>
      {children}
    </div>
  ),
);
ModalBody.displayName = "ModalBody";

const ModalFooter = memo<React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }) => (
    <div
      className={cn(
        "flex items-center justify-end gap-3 pt-4 border-t border-border-secondary",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  ),
);
ModalFooter.displayName = "ModalFooter";

export { Modal, ModalHeader, ModalBody, ModalFooter, modalVariants };
