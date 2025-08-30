/**
 * Session management
 */

import { Session } from "./types";

export interface CreateSessionRequest {
  id?: string;
  userId: string;
  token: string;
  refreshToken: string;
  expiresAt: Date;
  createdAt?: Date;
  ipAddress: string | undefined;
  userAgent: string | undefined;
}

export interface UpdateSessionRequest {
  token?: string;
  refreshToken?: string;
  expiresAt?: Date;
}

export interface SessionRepository {
  create(data: CreateSessionRequest): Promise<Session>;
  findById(id: string): Promise<Session | null>;
  findByToken(token: string): Promise<Session | null>;
  findByRefreshToken(refreshToken: string): Promise<Session | null>;
  findByUserId(userId: string): Promise<Session[]>;
  update(id: string, data: UpdateSessionRequest): Promise<Session>;
  delete(id: string): Promise<void>;
  deleteByUserId(userId: string): Promise<void>;
  deleteExpired(): Promise<void>;
}

export class SessionManager {
  private repository: SessionRepository;

  constructor(repository: SessionRepository) {
    this.repository = repository;
  }

  async createSession(data: CreateSessionRequest): Promise<Session> {
    return this.repository.create({
      ...data,
      id: this.generateSessionId(),
      createdAt: new Date(),
    });
  }

  async getSession(id: string): Promise<Session | null> {
    const session = await this.repository.findById(id);

    if (session && session.expiresAt < new Date()) {
      await this.repository.delete(id);
      return null;
    }

    return session;
  }

  async getSessionByToken(token: string): Promise<Session | null> {
    const session = await this.repository.findByToken(token);

    if (session && session.expiresAt < new Date()) {
      await this.repository.delete(session.id);
      return null;
    }

    return session;
  }

  async getSessionByRefreshToken(refreshToken: string): Promise<Session | null> {
    const session = await this.repository.findByRefreshToken(refreshToken);

    if (session && session.expiresAt < new Date()) {
      await this.repository.delete(session.id);
      return null;
    }

    return session;
  }

  async getUserSessions(userId: string): Promise<Session[]> {
    const sessions = await this.repository.findByUserId(userId);

    // Filter out expired sessions and clean them up
    const validSessions: Session[] = [];
    const expiredSessionIds: string[] = [];

    for (const session of sessions) {
      if (session.expiresAt < new Date()) {
        expiredSessionIds.push(session.id);
      } else {
        validSessions.push(session);
      }
    }

    // Clean up expired sessions
    for (const id of expiredSessionIds) {
      await this.repository.delete(id);
    }

    return validSessions;
  }

  async updateSession(id: string, data: UpdateSessionRequest): Promise<Session> {
    return this.repository.update(id, data);
  }

  async deleteSession(id: string): Promise<void> {
    await this.repository.delete(id);
  }

  async deleteAllUserSessions(userId: string): Promise<void> {
    await this.repository.deleteByUserId(userId);
  }

  async cleanupExpiredSessions(): Promise<void> {
    await this.repository.deleteExpired();
  }

  private generateSessionId(): string {
    return `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
