/**
 * Accessible Button Component with proper ARIA attributes and keyboard support
 * Now unified with the main Button component for consistent styling
 */

import React, { forwardRef } from "react";
import { Button, ButtonProps } from "./ui/Button";
import { generateAriaLabel } from "../utils/accessibility";

interface AccessibleButtonProps extends Omit<ButtonProps, 'children'> {
  action: string; // Required for accessibility
  target?: string; // Context for aria-label
  state?: string; // Current state for aria-label
  children?: React.ReactNode;
}

export const AccessibleButton = forwardRef<HTMLButtonElement, AccessibleButtonProps>(
  (
    {
      action,
      target,
      state,
      loading = false,
      children,
      "aria-label": ariaLabel,
      leftIcon,
      rightIcon,
      ...props
    },
    ref,
  ) => {
    // Generate contextual aria-label
    const contextObj: { target?: string; state?: string; value?: string } = {};
    if (target) {contextObj.target = target;}
    if (loading) {contextObj.state = "loading";}
    else if (state) {contextObj.state = state;}

    const generatedAriaLabel = ariaLabel || generateAriaLabel("button", action, contextObj);

    return (
      <Button
        ref={ref}
        loading={loading}
        leftIcon={leftIcon}
        rightIcon={rightIcon}
        aria-label={generatedAriaLabel}
        aria-busy={loading}
        {...props}
      >
        {children}
        {loading && <span className="sr-only">{`${action} in progress`}</span>}
      </Button>
    );
  },
);

AccessibleButton.displayName = "AccessibleButton";

export default AccessibleButton;
