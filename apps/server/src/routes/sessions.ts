/**
 * Game Session API Routes
 */
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authManager } from './auth';

const prisma = new PrismaClient();
export const sessionsRouter = Router();

// Middleware to verify authentication
const requireAuth = async (req: any, res: any, next: any) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const user = await authManager.verifyAccessToken(token);
    if (!user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Authentication failed' });
  }
};

// Get all sessions
sessionsRouter.get('/', async (req, res) => {
  try {
    const sessions = await prisma.gameSession.findMany({
      include: {
        tokens: {
          select: {
            id: true,
            name: true,
            type: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    const formattedSessions = sessions.map(session => ({
      id: session.id,
      name: session.name,
      description: `Campaign session - ${session.status}`,
      gamemaster: {
        id: session.metadata?.gamemasterId || 'unknown',
        username: 'gamemaster',
        displayName: 'Game Master'
      },
      players: [], // Will be populated from WebSocket connections
      status: session.status.toLowerCase(),
      settings: {
        maxPlayers: session.metadata?.maxPlayers || 4,
        isPrivate: session.metadata?.isPrivate || false,
        allowSpectators: session.metadata?.allowSpectators || true
      },
      createdAt: session.createdAt.toISOString(),
      lastActivity: session.updatedAt.toISOString()
    }));

    res.json(formattedSessions);
  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

// Get specific session
sessionsRouter.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const session = await prisma.gameSession.findUnique({
      where: { id },
      include: {
        tokens: true
      }
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const formattedSession = {
      id: session.id,
      name: session.name,
      description: `Campaign session - ${session.status}`,
      gamemaster: {
        id: session.metadata?.gamemasterId || 'unknown',
        username: 'gamemaster',
        displayName: 'Game Master'
      },
      players: [],
      status: session.status.toLowerCase(),
      settings: {
        maxPlayers: session.metadata?.maxPlayers || 4,
        isPrivate: session.metadata?.isPrivate || false,
        allowSpectators: session.metadata?.allowSpectators || true
      },
      createdAt: session.createdAt.toISOString(),
      lastActivity: session.updatedAt.toISOString(),
      tokens: session.tokens
    };

    res.json(formattedSession);
  } catch (error) {
    console.error('Get session error:', error);
    res.status(500).json({ error: 'Failed to fetch session' });
  }
});

// Create new session
sessionsRouter.post('/', requireAuth, async (req: any, res) => {
  try {
    const { name, description, maxPlayers, isPrivate, allowSpectators } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Session name is required' });
    }

    const session = await prisma.gameSession.create({
      data: {
        name,
        campaignId: 'default-campaign', // TODO: Link to actual campaigns
        status: 'WAITING',
        metadata: {
          description: description || '',
          maxPlayers: maxPlayers || 4,
          isPrivate: isPrivate || false,
          allowSpectators: allowSpectators !== false,
          gamemasterId: req.user.id
        }
      }
    });

    const formattedSession = {
      id: session.id,
      name: session.name,
      description: description || `Campaign session - ${session.status}`,
      gamemaster: {
        id: req.user.id,
        username: req.user.username,
        displayName: req.user.displayName
      },
      players: [],
      status: session.status.toLowerCase(),
      settings: {
        maxPlayers: maxPlayers || 4,
        isPrivate: isPrivate || false,
        allowSpectators: allowSpectators !== false
      },
      createdAt: session.createdAt.toISOString(),
      lastActivity: session.updatedAt.toISOString()
    };

    res.status(201).json(formattedSession);
  } catch (error) {
    console.error('Create session error:', error);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

// Join session
sessionsRouter.post('/:id/join', requireAuth, async (req: any, res) => {
  try {
    const { id } = req.params;
    
    const session = await prisma.gameSession.findUnique({
      where: { id }
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.status !== 'WAITING' && session.status !== 'ACTIVE') {
      return res.status(400).json({ error: 'Cannot join this session' });
    }

    // In a real implementation, you'd track players in the database
    // For now, we'll rely on WebSocket connections for player tracking
    
    res.json({ 
      message: 'Ready to join session',
      sessionId: id,
      websocketUrl: '/ws'
    });
  } catch (error) {
    console.error('Join session error:', error);
    res.status(500).json({ error: 'Failed to join session' });
  }
});

// Delete session (GM only)
sessionsRouter.delete('/:id', requireAuth, async (req: any, res) => {
  try {
    const { id } = req.params;
    
    const session = await prisma.gameSession.findUnique({
      where: { id }
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Check if user is the GM
    if (session.metadata?.gamemasterId !== req.user.id) {
      return res.status(403).json({ error: 'Only the game master can delete this session' });
    }

    await prisma.gameSession.delete({
      where: { id }
    });

    res.json({ message: 'Session deleted successfully' });
  } catch (error) {
    console.error('Delete session error:', error);
    res.status(500).json({ error: 'Failed to delete session' });
  }
});
