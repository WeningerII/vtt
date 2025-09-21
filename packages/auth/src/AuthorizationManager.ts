/**
 * Authorization Manager - Role-based access control and permissions
 */

import { EventEmitter } from "events";
import type { Request, Response, NextFunction } from "express";
import { logger } from "@vtt/logging";
import { Permission, SecurityContext, SessionPermissions, AuditLogEntry } from "./types";

type AuthorizationRequest = Request & {
  securityContext?: SecurityContext;
  params: Request["params"] & {
    id?: string;
    resourceId?: string;
  };
};

export class AuthorizationManager extends EventEmitter {
  private rolePermissions: Map<string, Set<Permission>> = new Map();
  private resourcePolicies: Map<string, ResourcePolicy> = new Map();
  private auditLog: AuditLogEntry[] = [];

  constructor() {
    super();
    this.initializeRolePermissions();
    this.initializeResourcePolicies();
  }

  /**
   * Check if user has specific permission
   */
  checkPermission(
    context: SecurityContext,
    permission: Permission,
    resource?: string,
    resourceId?: string,
  ): boolean {
    const hasPermission = this.hasDirectPermission(context, permission);

    if (!hasPermission) {
      this.logPermissionDenied(context, permission, resource, resourceId);
      return false;
    }

    // Check resource-specific policies
    if (resource) {
      const policy = this.resourcePolicies.get(resource);
      if (policy && !policy.evaluate(context, permission, resourceId)) {
        this.logPermissionDenied(context, permission, resource, resourceId);
        return false;
      }
    }

    this.logPermissionGranted(context, permission, resource, resourceId);
    return true;
  }

  /**
   * Check multiple permissions (all must pass)
   */
  checkPermissions(
    context: SecurityContext,
    permissions: Permission[],
    resource?: string,
    resourceId?: string,
  ): boolean {
    return permissions.every((permission) =>
      this.checkPermission(context, permission, resource, resourceId),
    );
  }

  /**
   * Check if user has any of the specified permissions
   */
  checkAnyPermission(
    context: SecurityContext,
    permissions: Permission[],
    resource?: string,
    resourceId?: string,
  ): boolean {
    return permissions.some((permission) =>
      this.checkPermission(context, permission, resource, resourceId),
    );
  }

  /**
   * Get session-specific permissions for VTT gameplay
   */
  getSessionPermissions(
    context: SecurityContext,
    sessionId: string,
    isGameMaster: boolean = false,
  ): SessionPermissions {
    const basePermissions = {
      canCreateTokens: false,
      canMoveTokens: false,
      canEditMap: false,
      canManagePlayers: false,
      canControlCombat: false,
      canUseFogOfWar: false,
      canPlayAudio: false,
      canManageAssets: false,
      canViewGMNotes: false,
      canRollDice: true,
      canUseChat: true,
    };

    // Game Master gets all permissions
    if (isGameMaster || context.user.role === "gamemaster" || context.user.role === "admin") {
      return {
        canCreateTokens: true,
        canMoveTokens: true,
        canEditMap: true,
        canManagePlayers: true,
        canControlCombat: true,
        canUseFogOfWar: true,
        canPlayAudio: true,
        canManageAssets: true,
        canViewGMNotes: true,
        canRollDice: true,
        canUseChat: true,
      };
    }

    // Players get limited permissions
    if (context.user.role === "player") {
      basePermissions.canMoveTokens = this.checkPermission(
        context,
        "session.manage",
        "session",
        sessionId,
      );
      basePermissions.canCreateTokens = false; // Usually GM only
      basePermissions.canRollDice = true;
      basePermissions.canUseChat = true;
    }

    return basePermissions;
  }

  /**
   * Grant temporary permission for specific action
   */
  grantTemporaryPermission(
    userId: string,
    permission: Permission,
    resource: string,
    resourceId: string,
    durationMs: number,
  ): void {
    const tempPermissionKey = `${userId}:${permission}:${resource}:${resourceId}`;

    setTimeout(() => {
      this.revokeTemporaryPermission(tempPermissionKey);
    }, durationMs);

    this.emit("temporaryPermissionGranted", {
      userId,
      permission,
      resource,
      resourceId,
      duration: durationMs,
    });
  }

  /**
   * Check resource ownership
   */
  checkOwnership(context: SecurityContext, resourceType: string, resourceId: string): boolean {
    // Check if user owns the resource
    switch (resourceType) {
      case "session":
        return this.isSessionOwner(context.user.id, resourceId);
      case "character":
        return this.isCharacterOwner(context.user.id, resourceId);
      case "campaign":
        return this.isCampaignOwner(context.user.id, resourceId);
      default:
        return false;
    }
  }

  /**
   * Elevate user permissions (admin action)
   */
  elevatePermissions(
    adminContext: SecurityContext,
    targetUserId: string,
    permissions: Permission[],
  ): boolean {
    if (!this.checkPermission(adminContext, "user.manage")) {
      throw new Error("Insufficient permissions to elevate user permissions");
    }

    // Implementation would update user permissions in database
    this.logAuditEvent({
      id: this.generateId(),
      userId: adminContext.user.id,
      action: "elevate_permissions",
      resource: "user",
      resourceId: targetUserId,
      details: { permissions },
      ipAddress: adminContext.ipAddress,
      userAgent: adminContext.userAgent,
      timestamp: new Date(),
      sessionId: adminContext.session.id,
    });

    return true;
  }

  /**
   * Audit log management
   */
  getAuditLog(context: SecurityContext, filters?: AuditFilters): AuditLogEntry[] {
    if (!this.checkPermission(context, "system.admin")) {
      throw new Error("Insufficient permissions to view audit log");
    }

    let log = [...this.auditLog];

    if (filters) {
      if (filters.userId) {
        log = log.filter((entry) => entry.userId === filters.userId);
      }
      if (filters.action) {
        log = log.filter((entry) => entry.action === filters.action);
      }
      if (filters.resource) {
        log = log.filter((entry) => entry.resource === filters.resource);
      }
      if (filters.startDate) {
        log = log.filter((entry) => entry.timestamp >= filters.startDate!);
      }
      if (filters.endDate) {
        log = log.filter((entry) => entry.timestamp <= filters.endDate!);
      }
    }

    return log.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Create authorization middleware for Express
   */
  createMiddleware(requiredPermission: Permission, resource?: string) {
    return async (req: AuthorizationRequest, res: Response, next: NextFunction) => {
      try {
        const context = req.securityContext;
        if (!context) {
          return res.status(401).json({ error: "Authentication required" });
        }

        const resourceId = req.params.id || req.params.resourceId;

        if (!this.checkPermission(context, requiredPermission, resource, resourceId)) {
          return res.status(403).json({
            error: "Insufficient permissions",
            required: requiredPermission,
            resource,
            resourceId,
          });
        }

        next();
      } catch (error) {
        logger.error("Authorization middleware error", {
          error:
            error instanceof Error
              ? { message: error.message, stack: error.stack, name: error.name }
              : error,
        });
        res.status(500).json({ error: "Authorization check failed" });
      }
    };
  }

  /**
   * Bulk permission check for UI state
   */
  getUserPermissionSet(
    context: SecurityContext,
    resources: string[] = [],
  ): Record<string, boolean> {
    const permissions: Record<string, boolean> = {};

    // Check all standard permissions
    const allPermissions: Permission[] = [
      "session.create",
      "session.join",
      "session.manage",
      "session.delete",
      "content.create",
      "content.edit",
      "content.delete",
      "content.publish",
      "user.manage",
      "user.moderate",
      "system.admin",
      "billing.manage",
    ];

    allPermissions.forEach((permission) => {
      permissions[permission] = this.hasDirectPermission(context, permission);
    });

    // Check resource-specific permissions
    resources.forEach((resource) => {
      allPermissions.forEach((permission) => {
        const key = `${resource}.${permission}`;
        permissions[key] = this.checkPermission(context, permission, resource);
      });
    });

    return permissions;
  }

  // Private helper methods

  private initializeRolePermissions(): void {
    // Guest permissions
    this.rolePermissions.set("guest", new Set(["session.join"]));

    // Player permissions
    this.rolePermissions.set("player", new Set(["session.join", "session.create"]));

    // GameMaster permissions
    this.rolePermissions.set(
      "gamemaster",
      new Set([
        "session.join",
        "session.create",
        "session.manage",
        "content.create",
        "content.edit",
      ]),
    );

    // Moderator permissions
    this.rolePermissions.set(
      "moderator",
      new Set([
        "session.join",
        "session.create",
        "session.manage",
        "content.create",
        "content.edit",
        "content.delete",
        "user.moderate",
      ]),
    );

    // Admin permissions (all)
    this.rolePermissions.set(
      "admin",
      new Set([
        "session.create",
        "session.join",
        "session.manage",
        "session.delete",
        "content.create",
        "content.edit",
        "content.delete",
        "content.publish",
        "user.manage",
        "user.moderate",
        "system.admin",
        "billing.manage",
      ]),
    );
  }

  private initializeResourcePolicies(): void {
    // Session access policy
    this.resourcePolicies.set("session", {
      evaluate: (context: SecurityContext, permission: Permission, resourceId?: string) => {
        if (permission === "session.manage" || permission === "session.delete") {
          return resourceId ? this.isSessionOwner(context.user.id, resourceId) : false;
        }
        return true;
      },
    });

    // Content access policy
    this.resourcePolicies.set("content", {
      evaluate: (context: SecurityContext, permission: Permission, resourceId?: string) => {
        if (permission === "content.edit" || permission === "content.delete") {
          return resourceId ? this.isContentOwner(context.user.id, resourceId) : false;
        }
        return true;
      },
    });

    // User management policy
    this.resourcePolicies.set("user", {
      evaluate: (context: SecurityContext, permission: Permission, resourceId?: string) => {
        if (permission === "user.manage") {
          // Users can manage their own profile, admins can manage anyone
          return resourceId === context.user.id || context.user.role === "admin";
        }
        return true;
      },
    });
  }

  private hasDirectPermission(context: SecurityContext, permission: Permission): boolean {
    // Check explicit permissions
    if (context.permissions.includes(permission)) {
      return true;
    }

    // Check role-based permissions
    const rolePermissions = this.rolePermissions.get(context.user.role);
    return rolePermissions ? rolePermissions.has(permission) : false;
  }

  private logPermissionGranted(
    context: SecurityContext,
    permission: Permission,
    resource?: string,
    resourceId?: string,
  ): void {
    this.logAuditEvent({
      id: this.generateId(),
      userId: context.user.id,
      action: "permission_granted",
      resource: resource || "system",
      resourceId: resourceId || undefined,
      details: { permission },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      timestamp: new Date(),
      sessionId: context.session.id,
    });
  }

  private logPermissionDenied(
    context: SecurityContext,
    permission: Permission,
    resource?: string,
    resourceId?: string,
  ): void {
    this.logAuditEvent({
      id: this.generateId(),
      userId: context.user.id,
      action: "permission_denied",
      resource: resource || "system",
      resourceId: resourceId || undefined,
      details: { permission, reason: "insufficient_permissions" },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      timestamp: new Date(),
      sessionId: context.session.id,
    });
  }

  private logAuditEvent(entry: AuditLogEntry): void {
    this.auditLog.push(entry);

    // Keep only last 10000 entries in memory
    if (this.auditLog.length > 10000) {
      this.auditLog = this.auditLog.slice(-10000);
    }

    this.emit("auditLog", entry);
  }

  private revokeTemporaryPermission(key: string): void {
    // Implementation would remove temporary permission
    this.emit("temporaryPermissionRevoked", { key });
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  // Resource ownership checks (would query database in real implementation)
  private isSessionOwner(_userId: string, _sessionId: string): boolean {
    // Placeholder - would check database
    return true;
  }

  private isCharacterOwner(_userId: string, _characterId: string): boolean {
    // Placeholder - would check database
    return true;
  }

  private isCampaignOwner(_userId: string, _campaignId: string): boolean {
    // Placeholder - would check database
    return true;
  }

  private isContentOwner(_userId: string, _contentId: string): boolean {
    // Placeholder - would check database
    return true;
  }
}

interface ResourcePolicy {
  evaluate(context: SecurityContext, permission: Permission, resourceId?: string): boolean;
}

interface AuditFilters {
  userId?: string;
  action?: string;
  resource?: string;
  startDate?: Date;
  endDate?: Date;
}
