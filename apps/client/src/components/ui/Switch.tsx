/**
 * Switch Component - Toggle switch with smooth animation
 */
import React, { forwardRef } from "react";
import { cn } from "../../lib/utils";

interface SwitchProps {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(({
  checked = false,
  onCheckedChange,
  disabled = false,
  className,
  size = "md",
}, ref) => {
  const handleClick = () => {
    if (!disabled && onCheckedChange) {
      onCheckedChange(!checked);
    }
  };

  const sizeClasses = {
    sm: "h-5 w-9",
    md: "h-6 w-11", 
    lg: "h-7 w-13"
  };

  const thumbSizeClasses = {
    sm: "h-4 w-4",
    md: "h-5 w-5",
    lg: "h-6 w-6"
  };

  const thumbTranslateClasses = {
    sm: checked ? "translate-x-4" : "translate-x-0.5",
    md: checked ? "translate-x-5" : "translate-x-0.5", 
    lg: checked ? "translate-x-6" : "translate-x-0.5"
  };

  return (
    <button
      ref={ref}
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={handleClick}
      disabled={disabled}
      className={cn(
        "relative inline-flex shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2",
        sizeClasses[size],
        checked
          ? "bg-primary-600 hover:bg-primary-700"
          : "bg-gray-200 hover:bg-gray-300",
        disabled && "cursor-not-allowed opacity-50",
        className
      )}
    >
      <span
        className={cn(
          "pointer-events-none inline-block rounded-full bg-white shadow transform ring-0 transition duration-200 ease-in-out",
          thumbSizeClasses[size],
          thumbTranslateClasses[size],
          disabled && "bg-gray-100"
        )}
      />
    </button>
  );
});

Switch.displayName = "Switch";
