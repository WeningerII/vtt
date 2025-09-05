/**
 * Slider Component - Range input with custom styling
 */
import React, { forwardRef, useState, useCallback } from "react";
import { cn } from "../../lib/utils";

interface SliderProps {
  value?: number[];
  onValueChange?: (value: number[]) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  className?: string;
  orientation?: "horizontal" | "vertical";
}

export const Slider = forwardRef<HTMLDivElement, SliderProps>(({
  value = [0],
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  disabled = false,
  className,
  orientation = "horizontal",
}, ref) => {
  const [isDragging, setIsDragging] = useState(false);

  const currentValue = value[0] ?? 0;
  const percentage = ((currentValue - min) / (max - min)) * 100;

  const handleMouseDown = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (disabled) return;
    
    event.preventDefault();
    setIsDragging(true);
    
    const updateValue = (clientX: number, clientY: number) => {
      const rect = event.currentTarget.getBoundingClientRect();
      let newPercentage: number;
      
      if (orientation === "horizontal") {
        newPercentage = ((clientX - rect.left) / rect.width) * 100;
      } else {
        newPercentage = ((rect.bottom - clientY) / rect.height) * 100;
      }
      
      newPercentage = Math.max(0, Math.min(100, newPercentage));
      const newValue = min + (newPercentage / 100) * (max - min);
      const steppedValue = Math.round(newValue / step) * step;
      const clampedValue = Math.max(min, Math.min(max, steppedValue));
      
      if (onValueChange) {
        onValueChange([clampedValue]);
      }
    };

    updateValue(event.clientX, event.clientY);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      updateValue(moveEvent.clientX, moveEvent.clientY);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, [disabled, min, max, step, orientation, onValueChange]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (disabled) return;

    let newValue = currentValue;
    
    switch (event.key) {
      case "ArrowRight":
      case "ArrowUp":
        newValue = Math.min(max, currentValue + step);
        break;
      case "ArrowLeft":
      case "ArrowDown":
        newValue = Math.max(min, currentValue - step);
        break;
      case "Home":
        newValue = min;
        break;
      case "End":
        newValue = max;
        break;
      default:
        return;
    }

    event.preventDefault();
    if (onValueChange) {
      onValueChange([newValue]);
    }
  }, [currentValue, disabled, min, max, step, onValueChange]);

  return (
    <div
      ref={ref}
      className={cn(
        "relative flex items-center select-none touch-none",
        orientation === "horizontal" ? "w-full h-5" : "h-full w-5 flex-col",
        className
      )}
      onMouseDown={handleMouseDown}
      onKeyDown={handleKeyDown}
      tabIndex={disabled ? -1 : 0}
      role="slider"
      aria-valuenow={currentValue}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-orientation={orientation}
      aria-disabled={disabled}
    >
      {/* Track */}
      <div
        className={cn(
          "relative bg-gray-200 rounded-full",
          orientation === "horizontal" ? "w-full h-2" : "w-2 h-full",
          disabled && "opacity-50"
        )}
      >
        {/* Progress */}
        <div
          className={cn(
            "absolute bg-primary-600 rounded-full",
            orientation === "horizontal" 
              ? "h-full left-0 top-0" 
              : "w-full bottom-0 left-0"
          )}
          style={{
            [orientation === "horizontal" ? "width" : "height"]: `${percentage}%`
          }}
        />
      </div>

      {/* Thumb */}
      <div
        className={cn(
          "absolute w-5 h-5 bg-white border-2 border-primary-600 rounded-full shadow-md transition-all duration-150 ease-out",
          "focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2",
          isDragging && "scale-110",
          disabled && "border-gray-300 cursor-not-allowed",
          !disabled && "cursor-pointer hover:scale-105"
        )}
        style={{
          [orientation === "horizontal" ? "left" : "bottom"]: `calc(${percentage}% - 10px)`
        }}
      />
    </div>
  );
});

Slider.displayName = "Slider";
