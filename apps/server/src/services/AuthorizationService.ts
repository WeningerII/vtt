/**
 * Unified Authorization Service - Consistent permission checking across HTTP and WebSocket
 */
import { PrismaClient } from '@prisma/client';
import { logger } from '@vtt/logging';

export interface AuthorizationContext {
  userId: string;
  sessionId?: string;
  campaignId?: string;
  action: string;
  resource?: string;
  resourceId?: string;
}

export interface CampaignMember {
  id: string;
  role: string;
  status: string;
  userId: string;
  campaignId: string;
}

export interface AuthorizationResult {
  authorized: boolean;
  reason?: string;
  member?: CampaignMember;
}

export class AuthorizationService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Check if user can join a game session
   */
  async canJoinSession(userId: string, sessionId: string): Promise<AuthorizationResult> {
    try {
      // Get session and campaign info
      const session = await this.prisma.gameSession.findUnique({
        where: { id: sessionId },
        select: { id: true, campaignId: true, status: true, metadata: true }
      });

      if (!session) {
        return { authorized: false, reason: 'Session not found' };
      }

      // Check session status
      if (session.status !== 'WAITING' && session.status !== 'ACTIVE') {
        return { authorized: false, reason: 'Session not available for joining' };
      }

      // Check campaign membership
      const member = await this.prisma.campaignMember.findUnique({
        where: {
          userId_campaignId: {
            userId,
            campaignId: session.campaignId
          }
        }
      });

      if (!member) {
        logger.warn(`Authorization denied: User ${userId} is not a member of campaign ${session.campaignId}`);
        return { authorized: false, reason: 'Not a campaign member' };
      }

      if (member.status !== 'active') {
        return { authorized: false, reason: 'Campaign membership not active', member };
      }

      return { authorized: true, member };
    } catch (error) {
      logger.error('Error checking session join authorization:', error);
      return { authorized: false, reason: 'Authorization check failed' };
    }
  }

  /**
   * Check if user can perform actions on a token
   */
  async canManipulateToken(userId: string, tokenId: string, action: 'move' | 'edit' | 'delete'): Promise<AuthorizationResult> {
    try {
      const token = await this.prisma.token.findUnique({
        where: { id: tokenId },
        include: {
          gameSession: {
            select: { campaignId: true }
          }
        }
      });

      if (!token) {
        return { authorized: false, reason: 'Token not found' };
      }

      // Check campaign membership
      const member = await this.prisma.campaignMember.findUnique({
        where: {
          userId_campaignId: {
            userId,
            campaignId: token.gameSession.campaignId
          }
        }
      });

      if (!member || member.status !== 'active') {
        return { authorized: false, reason: 'Not an active campaign member' };
      }

      // GM can do anything
      if (this.isGameMaster(member.role)) {
        return { authorized: true, member };
      }

      // Check token ownership for players
      const tokenMetadata = (token.metadata as any) || {};
      const isOwner = tokenMetadata.ownerUserId === userId;

      if (!isOwner && action !== 'move') {
        return { authorized: false, reason: 'Not token owner', member };
      }

      // Players can move tokens they own, or any PC tokens if no explicit owner
      if (action === 'move') {
        const canMove = isOwner || 
                       (token.type === 'PC' && !tokenMetadata.ownerUserId) ||
                       this.hasPermission(member.role, 'move_tokens');
        
        if (!canMove) {
          return { authorized: false, reason: 'Insufficient permissions to move token', member };
        }
      }

      return { authorized: true, member };
    } catch (error) {
      logger.error('Error checking token authorization:', error);
      return { authorized: false, reason: 'Authorization check failed' };
    }
  }

  /**
   * Check if user can manage a campaign
   */
  async canManageCampaign(userId: string, campaignId: string, action: 'edit' | 'delete' | 'invite' | 'kick'): Promise<AuthorizationResult> {
    try {
      const member = await this.prisma.campaignMember.findUnique({
        where: {
          userId_campaignId: {
            userId,
            campaignId
          }
        }
      });

      if (!member || member.status !== 'active') {
        return { authorized: false, reason: 'Not an active campaign member' };
      }

      // Check role permissions
      const hasPermission = this.isGameMaster(member.role) || 
                           (action === 'invite' && this.isCoGameMaster(member.role));

      if (!hasPermission) {
        return { authorized: false, reason: 'Insufficient role permissions', member };
      }

      return { authorized: true, member };
    } catch (error) {
      logger.error('Error checking campaign authorization:', error);
      return { authorized: false, reason: 'Authorization check failed' };
    }
  }

  /**
   * Check if user can create sessions in a campaign
   */
  async canCreateSession(userId: string, campaignId?: string): Promise<AuthorizationResult> {
    if (!campaignId) {
      // User can always create a new campaign with themselves as GM
      return { authorized: true };
    }

    try {
      const member = await this.prisma.campaignMember.findUnique({
        where: {
          userId_campaignId: {
            userId,
            campaignId
          }
        }
      });

      if (!member || member.status !== 'active') {
        return { authorized: false, reason: 'Not an active campaign member' };
      }

      if (!this.isGameMaster(member.role) && !this.isCoGameMaster(member.role)) {
        return { authorized: false, reason: 'Only GMs can create sessions', member };
      }

      return { authorized: true, member };
    } catch (error) {
      logger.error('Error checking session creation authorization:', error);
      return { authorized: false, reason: 'Authorization check failed' };
    }
  }

  /**
   * Get user's role in a campaign
   */
  async getUserCampaignRole(userId: string, campaignId: string): Promise<string | null> {
    try {
      const member = await this.prisma.campaignMember.findUnique({
        where: {
          userId_campaignId: {
            userId,
            campaignId
          }
        },
        select: { role: true, status: true }
      });

      return (member && member.status === 'active') ? member.role : null;
    } catch (error) {
      logger.error('Error getting user campaign role:', error);
      return null;
    }
  }

  /**
   * Check if role has specific permission
   */
  private hasPermission(role: string, permission: string): boolean {
    const rolePermissions: Record<string, string[]> = {
      'gamemaster': ['*'], // GM has all permissions
      'co-gamemaster': ['manage_sessions', 'move_tokens', 'edit_npcs', 'invite_players'],
      'player': ['move_owned_tokens', 'edit_owned_character'],
      'spectator': ['view_only']
    };

    const permissions = rolePermissions[role?.toLowerCase()] || [];
    return permissions.includes('*') || permissions.includes(permission);
  }

  /**
   * Check if role is game master
   */
  private isGameMaster(role: string): boolean {
    return ['gamemaster', 'admin'].includes(role?.toLowerCase() || '');
  }

  /**
   * Check if role is co-game master
   */
  private isCoGameMaster(role: string): boolean {
    return ['co-gamemaster', 'gamemaster', 'admin'].includes(role?.toLowerCase() || '');
  }

  /**
   * Log authorization events for security monitoring
   */
  logAuthorizationEvent(context: AuthorizationContext, result: AuthorizationResult): void {
    const logLevel = result.authorized ? 'info' : 'warn';
    const message = result.authorized ? 'Authorization granted' : 'Authorization denied';
    
    logger[logLevel](message, {
      userId: context.userId,
      action: context.action,
      resource: context.resource,
      resourceId: context.resourceId,
      sessionId: context.sessionId,
      campaignId: context.campaignId,
      authorized: result.authorized,
      reason: result.reason,
      userRole: result.member?.role,
      timestamp: new Date().toISOString(),
      severity: result.authorized ? 'normal' : 'security'
    });

    // Additional security logging for denied actions
    if (!result.authorized) {
      logger.warn('Security Alert: Unauthorized access attempt', {
        userId: context.userId,
        attemptedAction: context.action,
        targetResource: context.resource,
        targetId: context.resourceId,
        denialReason: result.reason,
        timestamp: new Date().toISOString(),
        alertType: 'UNAUTHORIZED_ACCESS'
      });
    }
  }
}

// Singleton instance
let authorizationServiceInstance: AuthorizationService | null = null;

export function getAuthorizationService(prisma: PrismaClient): AuthorizationService {
  if (!authorizationServiceInstance) {
    authorizationServiceInstance = new AuthorizationService(prisma);
  }
  return authorizationServiceInstance;
}
