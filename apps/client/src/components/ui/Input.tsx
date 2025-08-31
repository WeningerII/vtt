/**
 * Input Component - Flexible input field with validation states and icons
 */
import React, { forwardRef, useId, useState, useCallback } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";
import { Eye, EyeOff, AlertCircle, CheckCircle } from "lucide-react";

const inputVariants = cva(
  [
    "flex w-full rounded-lg border bg-white px-3 py-2 text-sm transition-all duration-200",
    "placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
    "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-neutral-50",
  ],
  {
    variants: {
      variant: {
        default: [
          "border-neutral-300 text-neutral-900",
          "hover:border-neutral-400",
          "focus-visible:border-primary-500 focus-visible:ring-primary-500",
        ],
        error: [
          "border-error-300 text-error-900 bg-error-50",
          "focus-visible:border-error-500 focus-visible:ring-error-500",
        ],
        success: [
          "border-success-300 text-success-900 bg-success-50",
          "focus-visible:border-success-500 focus-visible:ring-success-500",
        ],
      },
      size: {
        sm: "h-8 px-2.5 py-1.5 text-xs",
        md: "h-10 px-3 py-2 text-sm",
        lg: "h-12 px-4 py-3 text-base",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  },
);

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size">,
    VariantProps<typeof inputVariants> {
  label?: string;
  description?: string;
  error?: string | undefined;
  success?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  showPasswordToggle?: boolean;
}

const Input = React.memo(forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      variant,
      size,
      type = "text",
      label,
      description,
      error,
      success,
      leftIcon,
      rightIcon,
      showPasswordToggle,
      disabled,
      id,
      ...props
    },
    ref,
  ) => {
    const [showPassword, setShowPassword] = useState(false);
    const generatedId = useId();
    const inputId = id || generatedId;

    // Determine variant based on validation state
    const resolvedVariant = error ? "error" : success ? "success" : variant;

    // Determine input type (handle password toggle)
    const inputType = showPasswordToggle && type === "password" && showPassword ? "text" : type;

    // Show password toggle icon with useCallback for performance
    const togglePassword = useCallback(() => setShowPassword(!showPassword), [showPassword]);
    
    const passwordToggleIcon = showPasswordToggle && type === "password" && (
      <button
        type="button"
        className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 focus:outline-none"
        onClick={togglePassword}
        tabIndex={-1}
        aria-label={showPassword ? "Hide password" : "Show password"}
      >
        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    );

    // Validation state icon
    const validationIcon = error ? (
      <AlertCircle className="h-4 w-4 text-error-500" />
    ) : success ? (
      <CheckCircle className="h-4 w-4 text-success-500" />
    ) : null;

    return (
      <div className="space-y-1.5">
        {/* Label */}
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-neutral-700">
            {label}
          </label>
        )}

        {/* Input container */}
        <div className="relative">
          {/* Left icon */}
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
              {leftIcon}
            </div>
          )}

          {/* Input field */}
          <input
            type={inputType}
            className={cn(
              inputVariants({ variant: resolvedVariant, size }),
              leftIcon && "pl-10",
              (rightIcon || validationIcon || passwordToggleIcon) && "pr-10",
              className,
            )}
            ref={ref}
            id={inputId}
            disabled={disabled}
            {...props}
          />

          {/* Right icons container */}
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {validationIcon}
            {!validationIcon && rightIcon && <span className="text-neutral-400">{rightIcon}</span>}
            {passwordToggleIcon}
          </div>
        </div>

        {/* Description */}
        {description && !error && !success && (
          <p className="text-xs text-neutral-500">{description}</p>
        )}

        {/* Error message */}
        {error && (
          <p className="text-xs text-error-600 flex items-center gap-1">
            <AlertCircle className="h-3 w-3 shrink-0" />
            {error}
          </p>
        )}

        {/* Success message */}
        {success && (
          <p className="text-xs text-success-600 flex items-center gap-1">
            <CheckCircle className="h-3 w-3 shrink-0" />
            {success}
          </p>
        )}
      </div>
    );
  },
));

Input.displayName = "Input";

export { Input, inputVariants };
