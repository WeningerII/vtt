/**
 * JWT token management
 */

import * as jwt from "jsonwebtoken";
import { JWTPayload } from "./types";

export interface JWTConfig {
  accessTokenSecret: string;
  refreshTokenSecret: string;
  emailVerificationSecret: string;
  passwordResetSecret: string;
  issuer: string;
  accessTokenExpiry: string;
  refreshTokenExpiry: string;
  emailVerificationExpiry: string;
  passwordResetExpiry: string;
}

export class JWTManager {
  private config: JWTConfig;

  constructor(config: JWTConfig) {
    this.config = config;
  }

  async generateAccessToken(
    payload: Omit<JWTPayload, "iat" | "exp" | "iss">,
    expiresIn?: number,
  ): Promise<string> {
    const tokenPayload: JWTPayload = {
      ...payload,
      iat: Math.floor(Date.now() / 1000),
      exp:
        Math.floor(Date.now() / 1000) +
        (expiresIn || this.parseExpiry(this.config.accessTokenExpiry)),
      iss: this.config.issuer,
    };

    return jwt.sign(tokenPayload, this.config.accessTokenSecret, {
      algorithm: "HS256",
    });
  }

  async generateRefreshToken(payload: Omit<JWTPayload, "iat" | "exp" | "iss">): Promise<string> {
    const tokenPayload = {
      sub: payload.sub,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + this.parseExpiry(this.config.refreshTokenExpiry),
      iss: this.config.issuer,
      type: "refresh",
    };

    return jwt.sign(tokenPayload, this.config.refreshTokenSecret, {
      algorithm: "HS256",
    });
  }

  async generateEmailVerificationToken(userId: string): Promise<string> {
    const payload = {
      sub: userId,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + this.parseExpiry(this.config.emailVerificationExpiry),
      iss: this.config.issuer,
      type: "email_verification",
    };

    return jwt.sign(payload, this.config.emailVerificationSecret, {
      algorithm: "HS256",
    });
  }

  async generatePasswordResetToken(userId: string): Promise<string> {
    const payload = {
      sub: userId,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + this.parseExpiry(this.config.passwordResetExpiry),
      iss: this.config.issuer,
      type: "password_reset",
    };

    return jwt.sign(payload, this.config.passwordResetSecret, {
      algorithm: "HS256",
    });
  }

  async verifyAccessToken(token: string): Promise<JWTPayload> {
    try {
      const decoded = jwt.verify(token, this.config.accessTokenSecret, {
        issuer: this.config.issuer,
        algorithms: ["HS256"],
      }) as JWTPayload;

      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error("Access token expired");
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw new Error("Invalid access token");
      }
      throw error;
    }
  }

  async verifyRefreshToken(token: string): Promise<{ sub: string; type: string }> {
    try {
      const decoded = jwt.verify(token, this.config.refreshTokenSecret, {
        issuer: this.config.issuer,
        algorithms: ["HS256"],
      }) as { sub: string; type: string };

      if (decoded.type !== "refresh") {
        throw new Error("Invalid token type");
      }

      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error("Refresh token expired");
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw new Error("Invalid refresh token");
      }
      throw error;
    }
  }

  async verifyEmailVerificationToken(token: string): Promise<{ sub: string; type: string }> {
    try {
      const decoded = jwt.verify(token, this.config.emailVerificationSecret, {
        issuer: this.config.issuer,
        algorithms: ["HS256"],
      }) as { sub: string; type: string };

      if (decoded.type !== "email_verification") {
        throw new Error("Invalid token type");
      }

      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error("Email verification token expired");
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw new Error("Invalid email verification token");
      }
      throw error;
    }
  }

  async verifyPasswordResetToken(token: string): Promise<{ sub: string; type: string }> {
    try {
      const decoded = jwt.verify(token, this.config.passwordResetSecret, {
        issuer: this.config.issuer,
        algorithms: ["HS256"],
      }) as { sub: string; type: string };

      if (decoded.type !== "password_reset") {
        throw new Error("Invalid token type");
      }

      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error("Password reset token expired");
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw new Error("Invalid password reset token");
      }
      throw error;
    }
  }

  private parseExpiry(expiry: string): number {
    // Parse expiry strings like "1h", "30m", "7d"
    const match = expiry.match(/^(\d+)([smhd])$/);
    if (!match) {
      throw new Error(`Invalid expiry format: ${expiry}`);
    }

    const [, value, unit] = match;
    if (!value || !unit) {
      throw new Error(`Invalid expiry format: ${expiry}`);
    }
    const num = parseInt(value, 10);

    switch (unit) {
      case "s":
        return num;
      case "m":
        return num * 60;
      case "h":
        return num * 60 * 60;
      case "d":
        return num * 24 * 60 * 60;
      default:
        throw new Error(`Invalid expiry unit: ${unit}`);
    }
  }
}
