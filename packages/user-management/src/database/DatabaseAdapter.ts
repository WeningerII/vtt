/**
 * Database adapter interface and PostgreSQL implementation
 */
import { Pool, PoolClient, QueryResult } from "pg";
import { User, Session, PasswordResetRequest, EmailVerification } from "../UserManager";
// Stripe types are now used directly from the Stripe SDK
import Stripe from 'stripe';
import {
  EmailNotification,
  PushNotification,
  InAppNotification,
  NotificationTemplate,
  NotificationPreferences,
} from "../NotificationManager";

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean | object;
  maxConnections?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
}

export interface DatabaseAdapter {
  // Connection management
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  getClient(): Promise<PoolClient>;
  releaseClient(client: PoolClient): void;

  // User operations
  createUser(user: Omit<User, "id" | "createdAt" | "updatedAt">): Promise<User>;
  getUserById(id: string): Promise<User | null>;
  getUserByEmail(email: string): Promise<User | null>;
  getUserByUsername(username: string): Promise<User | null>;
  updateUser(id: string, updates: Partial<User>): Promise<User | null>;
  deleteUser(id: string): Promise<boolean>;

  // Session operations
  createSession(session: Omit<Session, "id" | "createdAt">): Promise<Session>;
  getSessionByToken(token: string): Promise<Session | null>;
  updateSession(id: string, updates: Partial<Session>): Promise<Session | null>;
  deleteSession(id: string): Promise<boolean>;
  deleteExpiredSessions(): Promise<number>;

  // Password reset operations
  createPasswordResetRequest(
    request: Omit<PasswordResetRequest, "id" | "createdAt">,
  ): Promise<PasswordResetRequest>;
  getPasswordResetRequest(token: string): Promise<PasswordResetRequest | null>;
  updatePasswordResetRequest(
    id: string,
    updates: Partial<PasswordResetRequest>,
  ): Promise<PasswordResetRequest | null>;

  // Email verification operations
  createEmailVerification(
    verification: Omit<EmailVerification, "id" | "createdAt">,
  ): Promise<EmailVerification>;
  getEmailVerification(token: string): Promise<EmailVerification | null>;
  updateEmailVerification(
    id: string,
    updates: Partial<EmailVerification>,
  ): Promise<EmailVerification | null>;


  // Simplified billing references - Stripe objects are managed via StripeService
  // We only store essential IDs and references in the database
  getStripeCustomerByUserId(userId: string): Promise<string | null>;
  setStripeCustomerForUser(userId: string, stripeCustomerId: string): Promise<void>;
  getUserSubscriptionInfo(userId: string): Promise<{subscriptionId?: string, customerId?: string, status?: string} | null>;
  updateUserSubscriptionInfo(userId: string, info: {subscriptionId?: string, status?: string}): Promise<void>;

  // Notification operations
  createEmailNotification(
    notification: Omit<EmailNotification, "id" | "createdAt">,
  ): Promise<EmailNotification>;
  updateEmailNotification(
    id: string,
    updates: Partial<EmailNotification>,
  ): Promise<EmailNotification | null>;
  createPushNotification(
    notification: Omit<PushNotification, "id" | "createdAt">,
  ): Promise<PushNotification>;
  updatePushNotification(
    id: string,
    updates: Partial<PushNotification>,
  ): Promise<PushNotification | null>;
  createInAppNotification(
    notification: Omit<InAppNotification, "id" | "createdAt">,
  ): Promise<InAppNotification>;
  getInAppNotifications(
    userId: string,
    includeRead?: boolean,
    limit?: number,
  ): Promise<InAppNotification[]>;
  updateInAppNotification(
    id: string,
    updates: Partial<InAppNotification>,
  ): Promise<InAppNotification | null>;
  deleteInAppNotification(id: string): Promise<boolean>;

  // Notification preferences
  getNotificationPreferences(userId: string): Promise<NotificationPreferences | null>;
  updateNotificationPreferences(
    userId: string,
    preferences: Partial<NotificationPreferences>,
  ): Promise<NotificationPreferences>;

  // Utility operations
  executeTransaction<T>(_operation: (client: PoolClient) => Promise<T>): Promise<T>;
}

export class PostgreSQLAdapter implements DatabaseAdapter {
  private pool: Pool | null = null;
  private config: DatabaseConfig;

  constructor(config: DatabaseConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    this.pool = new Pool({
      host: this.config.host,
      port: this.config.port,
      database: this.config.database,
      user: this.config.username,
      password: this.config.password,
      ssl: this.config.ssl,
      max: this.config.maxConnections || 20,
      idleTimeoutMillis: this.config.idleTimeoutMillis || 30000,
      connectionTimeoutMillis: this.config.connectionTimeoutMillis || 2000,
    });

    // Test connection
    const client = await this.pool.connect();
    client.release();
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }

  async getClient(): Promise<PoolClient> {
    if (!this.pool) {
      throw new Error("Database not connected");
    }
    return this.pool.connect();
  }

  releaseClient(client: PoolClient): void {
    client.release();
  }

  async executeTransaction<T>(_operation: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.getClient();
    try {
      await client.query("BEGIN");
      const result = await _operation(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      this.releaseClient(client);
    }
  }

  // User operations
  async createUser(user: Omit<User, "id" | "createdAt" | "updatedAt">): Promise<User> {
    const client = await this.getClient();
    try {
      const result = await client.query(
        `INSERT INTO users (username, email, password_hash, first_name, last_name, email_verified, role, status, timezone, avatar_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [
          user.username,
          user.email,
          user.passwordHash,
          user.firstName,
          user.lastName,
          user.emailVerified,
          (user as any).role,
          (user as any).status,
          user.timezone,
          (user as any).avatarUrl,
        ],
      );
      return this.mapUserRow(result.rows[0]);
    } finally {
      this.releaseClient(client);
    }
  }

  async getUserById(id: string): Promise<User | null> {
    const client = await this.getClient();
    try {
      const result = await client.query("SELECT * FROM users WHERE id = $1", [id]);
      return result.rows[0] ? this.mapUserRow(result.rows[0]) : null;
    } finally {
      this.releaseClient(client);
    }
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const client = await this.getClient();
    try {
      const result = await client.query("SELECT * FROM users WHERE email = $1", [email]);
      return result.rows[0] ? this.mapUserRow(result.rows[0]) : null;
    } finally {
      this.releaseClient(client);
    }
  }

  async getUserByUsername(username: string): Promise<User | null> {
    const client = await this.getClient();
    try {
      const result = await client.query("SELECT * FROM users WHERE username = $1", [username]);
      return result.rows[0] ? this.mapUserRow(result.rows[0]) : null;
    } finally {
      this.releaseClient(client);
    }
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | null> {
    const client = await this.getClient();
    try {
      const setClause = Object.keys(updates)
        .map((key, index) => `${this.camelToSnake(key)} = $${index + 2}`)
        .join(", ");

      const values = Object.values(updates);
      const result = await client.query(
        `UPDATE users SET ${setClause}, updated_at = NOW() WHERE id = $1 RETURNING *`,
        [id, ...values],
      );
      return result.rows[0] ? this.mapUserRow(result.rows[0]) : null;
    } finally {
      this.releaseClient(client);
    }
  }

  async deleteUser(id: string): Promise<boolean> {
    const client = await this.getClient();
    try {
      const result = await client.query("DELETE FROM users WHERE id = $1", [id]);
      return (result.rowCount || 0) > 0;
    } finally {
      this.releaseClient(client);
    }
  }

  // Session operations
  async createSession(session: Omit<Session, "id" | "createdAt">): Promise<Session> {
    const client = await this.getClient();
    try {
      const result = await client.query(
        `INSERT INTO user_sessions (user_id, token, refresh_token, ip_address, user_agent, expires_at, refresh_expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          session.userId,
          session.token,
          (session as any).refreshToken,
          (session as any).ipAddress,
          (session as any).userAgent,
          session.expiresAt,
          (session as any).refreshExpiresAt,
        ],
      );
      return this.mapSessionRow(result.rows[0]);
    } finally {
      this.releaseClient(client);
    }
  }

  async getSessionByToken(token: string): Promise<Session | null> {
    const client = await this.getClient();
    try {
      const result = await client.query("SELECT * FROM user_sessions WHERE token = $1", [token]);
      return result.rows[0] ? this.mapSessionRow(result.rows[0]) : null;
    } finally {
      this.releaseClient(client);
    }
  }

  async updateSession(id: string, updates: Partial<Session>): Promise<Session | null> {
    const client = await this.getClient();
    try {
      const setClause = Object.keys(updates)
        .map((key, index) => `${this.camelToSnake(key)} = $${index + 2}`)
        .join(", ");

      const values = Object.values(updates);
      const result = await client.query(
        `UPDATE user_sessions SET ${setClause} WHERE id = $1 RETURNING *`,
        [id, ...values],
      );
      return result.rows[0] ? this.mapSessionRow(result.rows[0]) : null;
    } finally {
      this.releaseClient(client);
    }
  }

  async deleteSession(id: string): Promise<boolean> {
    const client = await this.getClient();
    try {
      const result = await client.query("DELETE FROM user_sessions WHERE id = $1", [id]);
      return (result.rowCount || 0) > 0;
    } finally {
      this.releaseClient(client);
    }
  }

  async deleteExpiredSessions(): Promise<number> {
    const client = await this.getClient();
    try {
      const result = await client.query("DELETE FROM user_sessions WHERE expires_at < NOW()");
      return result.rowCount || 0;
    } finally {
      this.releaseClient(client);
    }
  }

  // Additional methods would continue here...
  // For brevity, I'm implementing key methods. The rest would follow similar patterns.

  async createInAppNotification(
    notification: Omit<InAppNotification, "id" | "createdAt">,
  ): Promise<InAppNotification> {
    const client = await this.getClient();
    try {
      const result = await client.query(
        `INSERT INTO in_app_notifications (user_id, type, title, message, action_url, action_text, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          notification.userId,
          notification.type,
          notification.title,
          notification.message,
          notification.actionUrl,
          notification.actionText,
          notification.expiresAt,
        ],
      );
      return this.mapInAppNotificationRow(result.rows[0]);
    } finally {
      this.releaseClient(client);
    }
  }

  async getInAppNotifications(
    userId: string,
    includeRead = false,
    limit = 50,
  ): Promise<InAppNotification[]> {
    const client = await this.getClient();
    try {
      const whereClause = includeRead
        ? "WHERE user_id = $1"
        : "WHERE user_id = $1 AND read = FALSE";

      const result = await client.query(
        `SELECT * FROM in_app_notifications ${whereClause} 
         ORDER BY created_at DESC LIMIT $2`,
        [userId, limit],
      );
      return result.rows.map((row) => this.mapInAppNotificationRow(row));
    } finally {
      this.releaseClient(client);
    }
  }

  async updateInAppNotification(
    id: string,
    updates: Partial<InAppNotification>,
  ): Promise<InAppNotification | null> {
    const client = await this.getClient();
    try {
      const setClause = Object.keys(updates)
        .map((key, index) => `${this.camelToSnake(key)} = $${index + 2}`)
        .join(", ");

      const values = Object.values(updates);
      const result = await client.query(
        `UPDATE in_app_notifications SET ${setClause} WHERE id = $1 RETURNING *`,
        [id, ...values],
      );
      return result.rows[0] ? this.mapInAppNotificationRow(result.rows[0]) : null;
    } finally {
      this.releaseClient(client);
    }
  }

  async deleteInAppNotification(id: string): Promise<boolean> {
    const client = await this.getClient();
    try {
      const result = await client.query("DELETE FROM in_app_notifications WHERE id = $1", [id]);
      return (result.rowCount || 0) > 0;
    } finally {
      this.releaseClient(client);
    }
  }

  // Mapping helper methods
  private mapUserRow(row: any): User {
    return {
      id: row.id,
      username: row.username,
      email: row.email,
      passwordHash: row.password_hash,
      firstName: row.first_name,
      lastName: row.last_name,
      avatarUrl: row.avatar_url,
      timezone: row.timezone || "UTC",
      locale: row.locale || "en-US",
      status: row.status || "active",
      emailVerified: row.email_verified || false,
      phoneVerified: row.phone_verified || false,
      twoFactorEnabled: row.two_factor_enabled || false,
      subscriptionId: row.subscription_id,
      subscriptionStatus: row.subscription_status,
      subscriptionTier: row.subscription_tier || "free",
      subscriptionExpiresAt: row.subscription_expires_at,
      preferences: {
        theme: row.theme || "auto",
        notifications: {
          email: row.notifications_email !== false,
          push: row.notifications_push !== false,
          gameInvites: row.notifications_game_invites !== false,
          updates: row.notifications_updates !== false,
        },
        privacy: {
          profileVisible: row.privacy_profile_visible !== false,
          showOnlineStatus: row.privacy_show_online_status !== false,
          allowFriendRequests: row.privacy_allow_friend_requests !== false,
        },
      },
      role: row.role || "user",
      lastLoginAt: row.last_login_at,
      lastActiveAt: row.last_activity_at,
      loginCount: row.login_count || 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      gamesPlayed: row.games_played || 0,
      gamesHosted: row.games_hosted || 0,
      hoursPlayed: row.hours_played || 0,
      achievements: row.achievements ? JSON.parse(row.achievements) : [],
      friends: row.friends ? JSON.parse(row.friends) : [],
      blockedUsers: row.blocked_users ? JSON.parse(row.blocked_users) : [],
      limits: {
        maxCampaigns: row.max_campaigns || 3,
        maxPlayersPerGame: row.max_players_per_game || 6,
        maxStorageGB: row.max_storage_gb || 1,
        maxAssets: row.max_assets || 100,
        canUseCustomAssets: row.can_use_custom_assets || false,
        canUseAdvancedFeatures: row.can_use_advanced_features || false,
      },
    } as User;
  }

  private mapSessionRow(row: any): Session {
    return {
      id: row.id,
      userId: row.user_id,
      token: row.token,
      refreshToken: row.refresh_token,
      // ipAddress: row.ip_address,
      // userAgent: row.user_agent,
      expiresAt: row.expires_at,
      // refreshExpiresAt: row.refresh_expires_at,
      deviceInfo: row.user_agent || "unknown",
      lastUsedAt: row.created_at,
      createdAt: row.created_at,
    };
  }

  private mapInAppNotificationRow(row: any): InAppNotification {
    return {
      id: row.id,
      userId: row.user_id,
      type: row.type,
      title: row.title,
      message: row.message,
      actionUrl: row.action_url,
      actionText: row.action_text,
      read: row.read,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
    };
  }

  // Utility methods
  private camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
  }

  private mapPasswordResetRequest(row: any): PasswordResetRequest {
    return {
      id: row.id,
      userId: row.user_id,
      token: row.token,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      used: row.used_at !== null,
    };
  }

  private mapEmailVerification(row: any): EmailVerification {
    return {
      id: row.id,
      userId: row.user_id,
      token: row.token,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      verified: row.verified_at !== null,
    };
  }

  // Password reset implementations
  async createPasswordResetRequest(
    request: Omit<PasswordResetRequest, "id" | "createdAt">,
  ): Promise<PasswordResetRequest> {
    const client = await this.getClient();
    try {
      const query = `
        INSERT INTO password_reset_requests (user_id, token, expires_at)
        VALUES ($1, $2, $3)
        RETURNING id, user_id, token, expires_at, created_at, used_at
      `;
      const result = await client.query(query, [
        request.userId,
        request.token,
        request.expiresAt,
      ]);
      return this.mapPasswordResetRequest(result.rows[0]);
    } finally {
      this.releaseClient(client);
    }
  }

  async getPasswordResetRequest(token: string): Promise<PasswordResetRequest | null> {
    const client = await this.getClient();
    try {
      const query = `
        SELECT id, user_id, token, expires_at, created_at, used_at
        FROM password_reset_requests
        WHERE token = $1 AND used_at IS NULL AND expires_at > NOW()
      `;
      const result = await client.query(query, [token]);
      return result.rows[0] ? this.mapPasswordResetRequest(result.rows[0]) : null;
    } finally {
      this.releaseClient(client);
    }
  }

  async updatePasswordResetRequest(
    id: string,
    updates: Partial<PasswordResetRequest>,
  ): Promise<PasswordResetRequest | null> {
    const client = await this.getClient();
    try {
      const updateFields: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (updates.used !== undefined) {
        updateFields.push(`used_at = $${paramIndex++}`);
        values.push(updates.used ? new Date() : null);
      }

      if (updateFields.length === 0) {
        return null;
      }

      values.push(id);
      const query = `
        UPDATE password_reset_requests
        SET ${updateFields.join(", ")}
        WHERE id = $${paramIndex}
        RETURNING id, user_id, token, expires_at, created_at, used_at
      `;
      const result = await client.query(query, values);
      return result.rows[0] ? this.mapPasswordResetRequest(result.rows[0]) : null;
    } finally {
      this.releaseClient(client);
    }
  }

  async createEmailVerification(
    verification: Omit<EmailVerification, "id" | "createdAt">,
  ): Promise<EmailVerification> {
    const client = await this.getClient();
    try {
      const query = `
        INSERT INTO email_verifications (user_id, token, expires_at)
        VALUES ($1, $2, $3)
        RETURNING id, user_id, token, expires_at, created_at, verified_at
      `;
      const result = await client.query(query, [
        verification.userId,
        verification.token,
        verification.expiresAt,
      ]);
      return this.mapEmailVerification(result.rows[0]);
    } finally {
      this.releaseClient(client);
    }
  }

  async getEmailVerification(token: string): Promise<EmailVerification | null> {
    const client = await this.getClient();
    try {
      const query = `
        SELECT id, user_id, token, expires_at, created_at, verified_at
        FROM email_verifications
        WHERE token = $1 AND verified_at IS NULL AND expires_at > NOW()
      `;
      const result = await client.query(query, [token]);
      return result.rows[0] ? this.mapEmailVerification(result.rows[0]) : null;
    } finally {
      this.releaseClient(client);
    }
  }

  async updateEmailVerification(
    id: string,
    updates: Partial<EmailVerification>,
  ): Promise<EmailVerification | null> {
    const client = await this.getClient();
    try {
      const updateFields: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (updates.verified !== undefined) {
        updateFields.push(`verified_at = $${paramIndex++}`);
        values.push(updates.verified ? new Date() : null);
      }

      if (updateFields.length === 0) {
        return null;
      }

      values.push(id);
      const query = `
        UPDATE email_verifications
        SET ${updateFields.join(", ")}
        WHERE id = $${paramIndex}
        RETURNING id, user_id, token, expires_at, created_at, verified_at
      `;
      const result = await client.query(query, values);
      return result.rows[0] ? this.mapEmailVerification(result.rows[0]) : null;
    } finally {
      this.releaseClient(client);
    }
  }

  // Simplified billing reference methods
  async getStripeCustomerByUserId(userId: string): Promise<string | null> {
    const client = await this.getClient();
    try {
      const query = `
        SELECT stripe_customer_id 
        FROM users 
        WHERE id = $1
      `;
      const result = await client.query(query, [userId]);
      return result.rows[0]?.stripe_customer_id || null;
    } finally {
      this.releaseClient(client);
    }
  }

  async setStripeCustomerForUser(userId: string, stripeCustomerId: string): Promise<void> {
    const client = await this.getClient();
    try {
      const query = `
        UPDATE users 
        SET stripe_customer_id = $2, updated_at = NOW() 
        WHERE id = $1
      `;
      await client.query(query, [userId, stripeCustomerId]);
    } finally {
      this.releaseClient(client);
    }
  }

  async getUserSubscriptionInfo(userId: string): Promise<{subscriptionId?: string, customerId?: string, status?: string} | null> {
    const client = await this.getClient();
    try {
      const query = `
        SELECT 
          stripe_subscription_id as "subscriptionId",
          stripe_customer_id as "customerId",
          subscription_status as "status"
        FROM users 
        WHERE id = $1
      `;
      const result = await client.query(query, [userId]);
      if (result.rows[0]) {
        return {
          subscriptionId: result.rows[0].subscriptionId,
          customerId: result.rows[0].customerId,
          status: result.rows[0].status
        };
      }
      return null;
    } finally {
      this.releaseClient(client);
    }
  }

  async updateUserSubscriptionInfo(userId: string, info: {subscriptionId?: string, status?: string}): Promise<void> {
    const client = await this.getClient();
    try {
      const updates: string[] = [];
      const values: any[] = [userId];
      let paramCount = 1;

      if (info.subscriptionId !== undefined) {
        paramCount++;
        updates.push(`stripe_subscription_id = $${paramCount}`);
        values.push(info.subscriptionId);
      }

      if (info.status !== undefined) {
        paramCount++;
        updates.push(`subscription_status = $${paramCount}`);
        values.push(info.status);
      }

      if (updates.length > 0) {
        updates.push('updated_at = NOW()');
        const query = `UPDATE users SET ${updates.join(', ')} WHERE id = $1`;
        await client.query(query, values);
      }
    } finally {
      this.releaseClient(client);
    }
  }

  async createEmailNotification(
    notification: Omit<EmailNotification, "id" | "createdAt">,
  ): Promise<EmailNotification> {
    const client = await this.getClient();
    try {
      const query = `
        INSERT INTO email_notifications 
        (user_id, template_id, subject, html_content, text_content, to_email, status, sent_at, opens, clicks)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id, user_id, template_id, subject, html_content, text_content, to_email, status, sent_at, created_at, opens, clicks
      `;
      const values = [
        notification.userId,
        notification.templateId,
        notification.subject,
        notification.htmlContent,
        notification.textContent,
        notification.to,
        notification.status || 'pending',
        notification.sentAt || null,
        notification.opens || 0,
        notification.clicks || 0
      ];
      const result = await client.query(query, values);
      const row = result.rows[0];
      return {
        id: row.id,
        userId: row.user_id,
        templateId: row.template_id,
        to: row.to_email,
        subject: row.subject,
        htmlContent: row.html_content,
        textContent: row.text_content,
        status: row.status,
        sentAt: row.sent_at,
        failureReason: row.failure_reason,
        opens: row.opens,
        clicks: row.clicks,
        createdAt: row.created_at
      };
    } finally {
      this.releaseClient(client);
    }
  }

  async updateEmailNotification(
    id: string,
    updates: Partial<EmailNotification>,
  ): Promise<EmailNotification | null> {
    const client = await this.getClient();
    try {
      const updateFields: string[] = [];
      const values: any[] = [id];
      let paramCount = 1;

      if (updates.status !== undefined) {
        paramCount++;
        updateFields.push(`status = $${paramCount}`);
        values.push(updates.status);
      }
      if (updates.sentAt !== undefined) {
        paramCount++;
        updateFields.push(`sent_at = $${paramCount}`);
        values.push(updates.sentAt);
      }
      if (updates.failureReason !== undefined) {
        paramCount++;
        updateFields.push(`failure_reason = $${paramCount}`);
        values.push(updates.failureReason);
      }
      if (updates.opens !== undefined) {
        paramCount++;
        updateFields.push(`opens = $${paramCount}`);
        values.push(updates.opens);
      }
      if (updates.clicks !== undefined) {
        paramCount++;
        updateFields.push(`clicks = $${paramCount}`);
        values.push(updates.clicks);
      }

      if (updateFields.length === 0) {return null;}

      const query = `
        UPDATE email_notifications 
        SET ${updateFields.join(', ')}, updated_at = NOW()
        WHERE id = $1
        RETURNING id, user_id, template_id, subject, html_content, text_content, to_email, status, sent_at, failure_reason, opens, clicks, created_at
      `;
      const result = await client.query(query, values);
      if (result.rows[0]) {
        const row = result.rows[0];
        return {
          id: row.id,
          userId: row.user_id,
          templateId: row.template_id,
          to: row.to_email,
          subject: row.subject,
          htmlContent: row.html_content,
          textContent: row.text_content,
          status: row.status,
          sentAt: row.sent_at,
          failureReason: row.failure_reason,
          opens: row.opens,
          clicks: row.clicks,
          createdAt: row.created_at
        };
      }
      return null;
    } finally {
      this.releaseClient(client);
    }
  }

  async createPushNotification(
    notification: Omit<PushNotification, "id" | "createdAt">,
  ): Promise<PushNotification> {
    const client = await this.getClient();
    try {
      const query = `
        INSERT INTO push_notifications 
        (user_id, title, body, icon, badge, data, status, sent_at, failure_reason)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id, user_id, title, body, icon, badge, data, status, sent_at, failure_reason, created_at
      `;
      const values = [
        notification.userId,
        notification.title,
        notification.body,
        notification.icon || null,
        notification.badge || null,
        JSON.stringify(notification.data || {}),
        notification.status || 'pending',
        notification.sentAt || null,
        notification.failureReason || null
      ];
      const result = await client.query(query, values);
      const row = result.rows[0];
      return {
        id: row.id,
        userId: row.user_id,
        title: row.title,
        body: row.body,
        icon: row.icon,
        badge: row.badge,
        data: JSON.parse(row.data || '{}'),
        status: row.status,
        sentAt: row.sent_at,
        failureReason: row.failure_reason,
        createdAt: row.created_at
      };
    } finally {
      this.releaseClient(client);
    }
  }

  async updatePushNotification(
    id: string,
    updates: Partial<PushNotification>,
  ): Promise<PushNotification | null> {
    const client = await this.getClient();
    try {
      const updateFields: string[] = [];
      const values: any[] = [id];
      let paramCount = 1;

      if (updates.status !== undefined) {
        paramCount++;
        updateFields.push(`status = $${paramCount}`);
        values.push(updates.status);
      }
      if (updates.sentAt !== undefined) {
        paramCount++;
        updateFields.push(`sent_at = $${paramCount}`);
        values.push(updates.sentAt);
      }
      if (updates.failureReason !== undefined) {
        paramCount++;
        updateFields.push(`failure_reason = $${paramCount}`);
        values.push(updates.failureReason);
      }
      if (updates.data !== undefined) {
        paramCount++;
        updateFields.push(`data = $${paramCount}`);
        values.push(JSON.stringify(updates.data));
      }

      if (updateFields.length === 0) {return null;}

      const query = `
        UPDATE push_notifications 
        SET ${updateFields.join(', ')}, updated_at = NOW()
        WHERE id = $1
        RETURNING id, user_id, title, body, icon, badge, data, status, sent_at, failure_reason, created_at
      `;
      const result = await client.query(query, values);
      if (result.rows[0]) {
        const row = result.rows[0];
        return {
          id: row.id,
          userId: row.user_id,
          title: row.title,
          body: row.body,
          icon: row.icon,
          badge: row.badge,
          data: JSON.parse(row.data || '{}'),
          status: row.status,
          sentAt: row.sent_at,
          failureReason: row.failure_reason,
          createdAt: row.created_at
        };
      }
      return null;
    } finally {
      this.releaseClient(client);
    }
  }

  async getNotificationPreferences(userId: string): Promise<NotificationPreferences | null> {
    const client = await this.getClient();
    try {
      const query = `
        SELECT user_id, email_preferences, push_preferences, in_app_preferences
        FROM notification_preferences
        WHERE user_id = $1
      `;
      const result = await client.query(query, [userId]);
      if (result.rows[0]) {
        const row = result.rows[0];
        return {
          userId: row.user_id,
          email: JSON.parse(row.email_preferences || '{"enabled": true, "gameInvites": true, "gameUpdates": true, "friendRequests": true, "systemUpdates": true, "billing": true, "marketing": false}'),
          push: JSON.parse(row.push_preferences || '{"enabled": true, "gameInvites": true, "gameUpdates": true, "friendRequests": true, "systemUpdates": true}'),
          inApp: JSON.parse(row.in_app_preferences || '{"enabled": true, "gameInvites": true, "gameUpdates": true, "friendRequests": true, "systemUpdates": true}')
        };
      }
      return null;
    } finally {
      this.releaseClient(client);
    }
  }

  async updateNotificationPreferences(
    userId: string,
    preferences: Partial<NotificationPreferences>,
  ): Promise<NotificationPreferences> {
    const client = await this.getClient();
    try {
      // Use UPSERT pattern to create or update
      const query = `
        INSERT INTO notification_preferences 
        (user_id, email_preferences, push_preferences, in_app_preferences)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (user_id) DO UPDATE SET
          email_preferences = COALESCE($2, notification_preferences.email_preferences),
          push_preferences = COALESCE($3, notification_preferences.push_preferences),
          in_app_preferences = COALESCE($4, notification_preferences.in_app_preferences),
          updated_at = NOW()
        RETURNING user_id, email_preferences, push_preferences, in_app_preferences
      `;
      const values = [
        userId,
        preferences.email ? JSON.stringify(preferences.email) : null,
        preferences.push ? JSON.stringify(preferences.push) : null,
        preferences.inApp ? JSON.stringify(preferences.inApp) : null
      ];
      const result = await client.query(query, values);
      const row = result.rows[0];
      return {
        userId: row.user_id,
        email: JSON.parse(row.email_preferences || '{"enabled": true, "gameInvites": true, "gameUpdates": true, "friendRequests": true, "systemUpdates": true, "billing": true, "marketing": false}'),
        push: JSON.parse(row.push_preferences || '{"enabled": true, "gameInvites": true, "gameUpdates": true, "friendRequests": true, "systemUpdates": true}'),
        inApp: JSON.parse(row.in_app_preferences || '{"enabled": true, "gameInvites": true, "gameUpdates": true, "friendRequests": true, "systemUpdates": true}')
      };
    } finally {
      this.releaseClient(client);
    }
  }
}
