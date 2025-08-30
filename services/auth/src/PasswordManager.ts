/**
 * Password hashing and validation
 */

import * as bcrypt from "bcrypt";

export interface PasswordConfig {
  saltRounds: number;
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
}

export class PasswordManager {
  private config: PasswordConfig;

  constructor(config: PasswordConfig) {
    this.config = config;
  }

  async hash(password: string): Promise<string> {
    return bcrypt.hash(password, this.config.saltRounds);
  }

  async verify(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  validatePassword(password: string): void {
    const errors: string[] = [];

    if (password.length < this.config.minLength) {
      errors.push(`Password must be at least ${this.config.minLength} characters long`);
    }

    if (this.config.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push("Password must contain at least one uppercase letter");
    }

    if (this.config.requireLowercase && !/[a-z]/.test(password)) {
      errors.push("Password must contain at least one lowercase letter");
    }

    if (this.config.requireNumbers && !/\d/.test(password)) {
      errors.push("Password must contain at least one number");
    }

    if (this.config.requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push("Password must contain at least one special character");
    }

    if (errors.length > 0) {
      throw new Error(`Password validation failed: ${errors.join(", ")}`);
    }
  }

  generateRandomPassword(length = 16): string {
    const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const lowercase = "abcdefghijklmnopqrstuvwxyz";
    const numbers = "0123456789";
    const specialChars = '!@#$%^&*(),.?":{}|<>';

    let chars = "";
    let password = "";

    // Ensure at least one character from each required category
    if (this.config.requireUppercase) {
      chars += uppercase;
      password += uppercase[Math.floor(Math.random() * uppercase.length)];
    }

    if (this.config.requireLowercase) {
      chars += lowercase;
      password += lowercase[Math.floor(Math.random() * lowercase.length)];
    }

    if (this.config.requireNumbers) {
      chars += numbers;
      password += numbers[Math.floor(Math.random() * numbers.length)];
    }

    if (this.config.requireSpecialChars) {
      chars += specialChars;
      password += specialChars[Math.floor(Math.random() * specialChars.length)];
    }

    // Fill the rest randomly
    for (let i = password.length; i < length; i++) {
      password += chars[Math.floor(Math.random() * chars.length)];
    }

    // Shuffle the password
    return password
      .split("")
      .sort(() => Math.random() - 0.5)
      .join("");
  }
}
