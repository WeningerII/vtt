/**
 * Validation utilities for VTT
 */

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface ValidationRule<T> {
  name: string;
  validate: (value: T) => ValidationResult;
}

/**
 * Basic string validation utilities
 */
export const stringValidators = {
  required: (value: string): ValidationResult => ({
    isValid: value !== null && value !== undefined && value.trim().length > 0,
    errors: value?.trim().length > 0 ? [] : ["Field is required"],
  }),

  minLength:
    (min: number) =>
    (value: string): ValidationResult => ({
      isValid: Boolean(value && value.length >= min),
      errors: value?.length >= min ? [] : [`Must be at least ${min} characters`],
    }),

  maxLength:
    (max: number) =>
    (value: string): ValidationResult => ({
      isValid: Boolean(value && value.length <= max),
      errors: value?.length <= max ? [] : [`Must be no more than ${max} characters`],
    }),

  email: (value: string): ValidationResult => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return {
      isValid: emailRegex.test(value),
      errors: emailRegex.test(value) ? [] : ["Must be a valid email address"],
    };
  },
};

/**
 * Basic number validation utilities
 */
export const numberValidators = {
  required: (value: number): ValidationResult => ({
    isValid: value !== null && value !== undefined && !isNaN(value),
    errors: value !== null && value !== undefined && !isNaN(value) ? [] : ["Field is required"],
  }),

  min:
    (min: number) =>
    (value: number): ValidationResult => ({
      isValid: value >= min,
      errors: value >= min ? [] : [`Must be at least ${min}`],
    }),

  max:
    (max: number) =>
    (value: number): ValidationResult => ({
      isValid: value <= max,
      errors: value <= max ? [] : [`Must be no more than ${max}`],
    }),

  integer: (value: number): ValidationResult => ({
    isValid: Number.isInteger(value),
    errors: Number.isInteger(value) ? [] : ["Must be an integer"],
  }),
};

/**
 * Compose multiple validation rules
 */
export function composeValidators<T>(
  ...validators: ((value: T) => ValidationResult)[]
): (value: T) => ValidationResult {
  return (value: T): ValidationResult => {
    const allErrors: string[] = [];
    let isValid = true;

    for (const validator of validators) {
      const result = validator(value);
      if (!result.isValid) {
        isValid = false;
        allErrors.push(...result.errors);
      }
    }

    return {
      isValid,
      errors: allErrors,
    };
  };
}

/**
 * Validate an object against a schema
 */
export function validateObject<T extends Record<string, any>>(
  obj: T,
  schema: { [K in keyof T]?: (value: T[K]) => ValidationResult },
): ValidationResult {
  const allErrors: string[] = [];
  let isValid = true;

  for (const [key, validator] of Object.entries(schema)) {
    if (validator && key in obj) {
      const result = validator(obj[key]);
      if (!result.isValid) {
        isValid = false;
        const prefixedErrors = result.errors.map((error: string) => `${key}: ${error}`);
        allErrors.push(...prefixedErrors);
      }
    }
  }

  return {
    isValid,
    errors: allErrors,
  };
}
