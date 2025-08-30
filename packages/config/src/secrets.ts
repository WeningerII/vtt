/**
 * Secret Management Module
 * Provides secure handling of environment variables and secrets
 */

import * as dotenv from "dotenv";
import { logger } from "@vtt/logging";
import * as path from "path";
import * as fs from "fs";
import * as crypto from "crypto";

export interface SecretConfig {
  envFile?: string;
  required?: string[];
  encrypted?: boolean;
  vaultUrl?: string;
}

export class SecretManager {
  private secrets: Map<string, string> = new Map();
  private config: SecretConfig;

  constructor(config: SecretConfig = {}) {
    this.config = config;
    this.loadSecrets();
  }

  private loadSecrets(): void {
    // Load from environment file if specified
    if (this.config.envFile) {
      const envPath = path.resolve(process.cwd(), this.config.envFile);
      if (fs.existsSync(envPath)) {
        dotenv.config({ path: envPath });
      }
    }

    // Load from process.env
    Object.entries(process.env).forEach(([key, value]) => {
      if (value) {
        this.secrets.set(key, value);
      }
    });

    // Validate required secrets
    if (this.config.required) {
      this.validateRequired();
    }
  }

  private validateRequired(): void {
    const missing: string[] = [];
    for (const key of this.config.required || []) {
      if (!this.secrets.has(key)) {
        missing.push(key);
      }
    }
    if (missing.length > 0) {
      throw new Error(`Missing required secrets: ${missing.join(", ")}`);
    }
  }

  public get(key: string, defaultValue?: string): string | undefined {
    return this.secrets.get(key) || defaultValue;
  }

  public getRequired(key: string): string {
    const value = this.secrets.get(key);
    if (!value) {
      throw new Error(`Required secret not found: ${key}`);
    }
    return value;
  }

  public set(key: string, value: string): void {
    this.secrets.set(key, value);
    process.env[key] = value;
  }

  public has(key: string): boolean {
    return this.secrets.has(key);
  }

  public list(): string[] {
    return Array.from(this.secrets.keys());
  }

  /**
   * Encrypt a value for storage
   */
  public encrypt(value: string, key?: string): string {
    const encryptionKey = key || this.getRequired("ENCRYPTION_KEY");
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv("aes-256-cbc", Buffer.from(encryptionKey, "hex"), iv);
    let encrypted = cipher.update(value, "utf8", "hex");
    encrypted += cipher.final("hex");
    return iv.toString("hex") + ":" + encrypted;
  }

  /**
   * Decrypt a value from storage
   */
  public decrypt(encryptedValue: string, key?: string): string {
    const encryptionKey = key || this.getRequired("ENCRYPTION_KEY");
    const parts = encryptedValue.split(":");
    const iv = Buffer.from(parts[0], "hex");
    const encrypted = parts[1];
    const decipher = crypto.createDecipheriv("aes-256-cbc", Buffer.from(encryptionKey, "hex"), iv);
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  }

  /**
   * Load secrets from external vault (placeholder for integration)
   */
  public async loadFromVault(vaultUrl?: string): Promise<void> {
    const url = vaultUrl || this.config.vaultUrl;
    if (!url) {
      throw new Error("Vault URL not configured");
    }
    // Vault integration implementation
    try {
      const vaultToken = process.env.VAULT_TOKEN;
      const vaultNamespace = process.env.VAULT_NAMESPACE || "secret";

      if (!vaultToken) {
        throw new Error("VAULT_TOKEN environment variable not set");
      }

      // Basic vault integration structure (would use actual vault client in production)
      const vaultClient = {
        read: async (path: string) => {
          logger.info(`[VAULT] Reading from ${vaultUrl}/${vaultNamespace}/${path}`);
          try {
            const response = await fetch(`${vaultUrl}/v1/${vaultNamespace}/${path}`, {
              headers: { "X-Vault-Token": vaultToken },
            });
            if (!response.ok) {
              throw new Error(`Vault read failed: ${response.statusText}`);
            }
            const data = await response.json();
            return data.data;
          } catch (error) {
            logger.error(`Failed to read from vault: ${error}`);
            return null;
          }
        },
        write: async (path: string, data: any) => {
          logger.info(`[VAULT] Writing to ${vaultUrl}/${vaultNamespace}/${path}`);
          try {
            const response = await fetch(`${vaultUrl}/v1/${vaultNamespace}/${path}`, {
              method: "POST",
              headers: { "X-Vault-Token": vaultToken, "Content-Type": "application/json" },
              body: JSON.stringify({ data }),
            });
            if (!response.ok) {
              throw new Error(`Vault write failed: ${response.statusText}`);
            }
            return await response.json();
          } catch (error) {
            logger.error(`Failed to write to vault: ${error}`);
            return null;
          }
        },
      };

      logger.info("[VAULT] Vault client initialized (stub implementation)");
      return vaultClient;
    } catch (error) {
      logger.error("[VAULT] Failed to initialize vault integration:", error);
      throw error;
    }
  }

  /**
   * Rotate a secret
   */
  public async rotateSecret(key: string, newValue: string): Promise<void> {
    const oldValue = this.get(key);
    this.set(key, newValue);

    // Audit logging for secret rotation
    const auditEvent = {
      timestamp: new Date().toISOString(),
      action: "secret_rotation",
      key: key,
      oldValueHash: oldValue ? this.hashValue(oldValue) : null,
      newValueHash: this.hashValue(newValue),
      source: "SecretManager",
      metadata: {
        rotatedBy: process.env.USER || "system",
        environment: process.env.NODE_ENV || "unknown",
      },
    };

    logger.info("[AUDIT]", JSON.stringify(auditEvent));

    // Notification/webhook for secret rotation
    await this.sendRotationNotification(key, auditEvent);
    return Promise.resolve();
  }

  /**
   * Hash a value for audit logging (one-way hash for security)
   */
  private hashValue(value: string): string {
    const crypto = require("crypto");
    return crypto.createHash("sha256").update(value).digest("hex").substring(0, 16);
  }

  /**
   * Send notification/webhook for secret rotation
   */
  private async sendRotationNotification(key: string, auditEvent: any): Promise<void> {
    const webhookUrl = process.env.SECRET_ROTATION_WEBHOOK_URL;

    if (!webhookUrl) {
      logger.warn("No webhook URL configured for secret rotation notifications");
      return;
    }

    try {
      const payload = {
        event: "secret_rotation",
        key: key,
        timestamp: auditEvent.timestamp,
        environment: auditEvent.metadata.environment,
        rotatedBy: auditEvent.metadata.rotatedBy,
      };

      // Send webhook notification
      logger.info(`[WEBHOOK] Sending to ${webhookUrl}:`, JSON.stringify(payload));

      try {
        const response = await fetch(webhookUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-VTT-Event": event,
            "X-VTT-Timestamp": new Date().toISOString(),
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          logger.error(`Webhook failed with status ${response.status}: ${response.statusText}`);
        } else {
          logger.info(`Webhook sent successfully for event: ${event}`);
        }
      } catch (error) {
        logger.error(`Failed to send webhook: ${error}`);
      }
    } catch (error) {
      logger.error("Failed to send secret rotation notification:", error);
    }
  }
}

// Singleton instance
let instance: SecretManager | null = null;

export function getSecretManager(_config?: SecretConfig): SecretManager {
  if (!instance) {
    instance = new SecretManager(config);
  }
  return instance;
}

// Helper functions
export function getSecret(_key: string, _defaultValue?: string): string | undefined {
  return getSecretManager().get(key, defaultValue);
}

export function getRequiredSecret(_key: string): string {
  return getSecretManager().getRequired(key);
}

export function hasSecret(_key: string): boolean {
  return getSecretManager().has(key);
}

// SecretManager is already exported as a class above
