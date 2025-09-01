/**
 * Tooltip Component - Accessible tooltip with consistent positioning and styling
 */
import React, { useState, useRef, useCallback, memo } from "react";
import { createPortal } from "react-dom";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const tooltipVariants = cva(
  [
    "absolute z-50 px-3 py-2 text-sm font-medium text-white",
    "bg-neutral-900 rounded-lg shadow-lg",
    "transition-opacity duration-200 ease-out",
    "pointer-events-none select-none",
    "max-w-xs break-words"
  ],
  {
    variants: {
      variant: {
        default: "bg-neutral-900 text-white",
        light: "bg-white text-neutral-900 border border-neutral-200 shadow-md",
        success: "bg-success-600 text-white",
        warning: "bg-warning-500 text-white", 
        error: "bg-error-600 text-white",
        info: "bg-info-600 text-white"
      },
      size: {
        sm: "px-2 py-1 text-xs",
        md: "px-3 py-2 text-sm",
        lg: "px-4 py-3 text-base max-w-sm"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "md"
    }
  }
);

const arrowVariants = cva(
  [
    "absolute w-0 h-0 border-solid pointer-events-none"
  ],
  {
    variants: {
      placement: {
        top: "top-full left-1/2 -translate-x-1/2 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent",
        bottom: "bottom-full left-1/2 -translate-x-1/2 border-l-4 border-r-4 border-b-4 border-l-transparent border-r-transparent",
        left: "left-full top-1/2 -translate-y-1/2 border-t-4 border-b-4 border-l-4 border-t-transparent border-b-transparent",
        right: "right-full top-1/2 -translate-y-1/2 border-t-4 border-b-4 border-r-4 border-t-transparent border-b-transparent"
      },
      variant: {
        default: "border-t-neutral-900",
        light: "border-t-white",
        success: "border-t-success-600",
        warning: "border-t-warning-500",
        error: "border-t-error-600",
        info: "border-t-info-600"
      }
    },
    defaultVariants: {
      placement: "top",
      variant: "default"
    }
  }
);

type Placement = "top" | "bottom" | "left" | "right";

export interface TooltipProps extends VariantProps<typeof tooltipVariants> {
  content: React.ReactNode;
  children: React.ReactElement;
  placement?: Placement;
  showArrow?: boolean;
  delay?: number;
  className?: string;
  disabled?: boolean;
}

const Tooltip = memo<TooltipProps>(({
  content,
  children,
  placement = "top",
  showArrow = true,
  delay = 200,
  variant = "default",
  size = "md",
  className,
  disabled = false
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const triggerRef = useRef<HTMLElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<number | undefined>();

  const calculatePosition = useCallback((triggerElement: HTMLElement, tooltipElement: HTMLElement) => {
    const triggerRect = triggerElement.getBoundingClientRect();
    const tooltipRect = tooltipElement.getBoundingClientRect();
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    const offset = 8; // Distance from trigger element

    let x: number, y: number;

    switch (placement) {
      case "top":
        x = triggerRect.left + scrollX + (triggerRect.width / 2) - (tooltipRect.width / 2);
        y = triggerRect.top + scrollY - tooltipRect.height - offset;
        break;
      case "bottom":
        x = triggerRect.left + scrollX + (triggerRect.width / 2) - (tooltipRect.width / 2);
        y = triggerRect.bottom + scrollY + offset;
        break;
      case "left":
        x = triggerRect.left + scrollX - tooltipRect.width - offset;
        y = triggerRect.top + scrollY + (triggerRect.height / 2) - (tooltipRect.height / 2);
        break;
      case "right":
        x = triggerRect.right + scrollX + offset;
        y = triggerRect.top + scrollY + (triggerRect.height / 2) - (tooltipRect.height / 2);
        break;
      default:
        x = 0;
        y = 0;
    }

    // Keep tooltip within viewport bounds
    const padding = 8;
    x = Math.max(padding, Math.min(x, window.innerWidth - tooltipRect.width - padding));
    y = Math.max(padding, Math.min(y, window.innerHeight - tooltipRect.height - padding));

    return { x, y };
  }, [placement]);

  const showTooltip = useCallback(() => {
    if (disabled || !content) return;

    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
      
      // Calculate position after tooltip is rendered
      requestAnimationFrame(() => {
        if (triggerRef.current && tooltipRef.current) {
          const pos = calculatePosition(triggerRef.current, tooltipRef.current);
          setPosition(pos);
        }
      });
    }, delay);
  }, [disabled, content, delay, calculatePosition]);

  const hideTooltip = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  }, []);

  // Clone children to add event handlers
  const trigger = React.cloneElement(children, {
    ref: triggerRef,
    onMouseEnter: (e: React.MouseEvent) => {
      showTooltip();
      children.props.onMouseEnter?.(e);
    },
    onMouseLeave: (e: React.MouseEvent) => {
      hideTooltip();
      children.props.onMouseLeave?.(e);
    },
    onFocus: (e: React.FocusEvent) => {
      showTooltip();
      children.props.onFocus?.(e);
    },
    onBlur: (e: React.FocusEvent) => {
      hideTooltip();
      children.props.onBlur?.(e);
    },
    "aria-describedby": isVisible ? `tooltip-${Math.random().toString(36).slice(2, 9)}` : undefined
  });

  const tooltip = isVisible && content ? (
    <div
      ref={tooltipRef}
      className={cn(tooltipVariants({ variant, size }), className)}
      style={{
        left: position.x,
        top: position.y,
        opacity: position.x && position.y ? 1 : 0
      }}
      role="tooltip"
    >
      {content}
      {showArrow && (
        <div
          className={cn(
            arrowVariants({ placement, variant }),
            // Dynamic border color classes based on variant and placement
            {
              "border-t-neutral-900": variant === "default" && placement === "top",
              "border-b-neutral-900": variant === "default" && placement === "bottom", 
              "border-l-neutral-900": variant === "default" && placement === "left",
              "border-r-neutral-900": variant === "default" && placement === "right",
              "border-t-white": variant === "light" && placement === "top",
              "border-b-white": variant === "light" && placement === "bottom",
              "border-l-white": variant === "light" && placement === "left", 
              "border-r-white": variant === "light" && placement === "right"
            }
          )}
        />
      )}
    </div>
  ) : null;

  return (
    <>
      {trigger}
      {tooltip && createPortal(tooltip, document.body)}
    </>
  );
});

Tooltip.displayName = "Tooltip";

// Utility component for simple text tooltips
const SimpleTooltip = memo<{
  text: string;
  children: React.ReactElement;
  placement?: Placement;
}>(({ text, children, placement = "top" }) => (
  <Tooltip content={text} placement={placement}>
    {children}
  </Tooltip>
));

SimpleTooltip.displayName = "SimpleTooltip";

export { Tooltip, SimpleTooltip, tooltipVariants };
