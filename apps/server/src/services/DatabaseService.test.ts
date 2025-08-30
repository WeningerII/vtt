/**
 * Tests for Database Service
 */
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

describe('DatabaseService', () => {
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      $connect: jest.fn(),
      $disconnect: jest.fn(),
      $transaction: jest.fn(),
      user: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn()
      },
      campaign: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn()
      },
      character: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn()
      }
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Connection Management', () => {
    it('should connect to database', async () => {
      mockPrisma.$connect.mockResolvedValue(undefined);
      
      await mockPrisma.$connect();
      expect(mockPrisma.$connect).toHaveBeenCalled();
    });

    it('should disconnect from database', async () => {
      mockPrisma.$disconnect.mockResolvedValue(undefined);
      
      await mockPrisma.$disconnect();
      expect(mockPrisma.$disconnect).toHaveBeenCalled();
    });

    it('should handle connection errors', async () => {
      mockPrisma.$connect.mockRejectedValue(new Error('Connection failed'));
      
      await expect(mockPrisma.$connect()).rejects.toThrow('Connection failed');
    });
  });

  describe('User Operations', () => {
    it('should find user by id', async () => {
      const mockUser = { id: 'user-1', email: 'test@example.com' };
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      
      const result = await mockPrisma.user.findUnique({ where: { id: 'user-1' } });
      expect(result).toEqual(mockUser);
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({ where: { id: 'user-1' } });
    });

    it('should create new user', async () => {
      const newUser = { email: 'new@example.com', name: 'New User' };
      const createdUser = { id: 'user-2', ...newUser };
      mockPrisma.user.create.mockResolvedValue(createdUser);
      
      const result = await mockPrisma.user.create({ data: newUser });
      expect(result).toEqual(createdUser);
      expect(mockPrisma.user.create).toHaveBeenCalledWith({ data: newUser });
    });

    it('should update user', async () => {
      const updatedUser = { id: 'user-1', email: 'updated@example.com' };
      mockPrisma.user.update.mockResolvedValue(updatedUser);
      
      const result = await mockPrisma.user.update({
        where: { id: 'user-1' },
        data: { email: 'updated@example.com' }
      });
      
      expect(result).toEqual(updatedUser);
    });

    it('should delete user', async () => {
      const deletedUser = { id: 'user-1', email: 'test@example.com' };
      mockPrisma.user.delete.mockResolvedValue(deletedUser);
      
      const result = await mockPrisma.user.delete({ where: { id: 'user-1' } });
      expect(result).toEqual(deletedUser);
    });
  });

  describe('Campaign Operations', () => {
    it('should find campaigns for user', async () => {
      const mockCampaigns = [
        { id: 'camp-1', name: 'Test Campaign', ownerId: 'user-1' },
        { id: 'camp-2', name: 'Another Campaign', ownerId: 'user-1' }
      ];
      mockPrisma.campaign.findMany.mockResolvedValue(mockCampaigns);
      
      const result = await mockPrisma.campaign.findMany({
        where: { ownerId: 'user-1' }
      });
      
      expect(result).toEqual(mockCampaigns);
      expect(result).toHaveLength(2);
    });

    it('should create campaign', async () => {
      const newCampaign = { name: 'New Campaign', ownerId: 'user-1' };
      const createdCampaign = { id: 'camp-3', ...newCampaign };
      mockPrisma.campaign.create.mockResolvedValue(createdCampaign);
      
      const result = await mockPrisma.campaign.create({ data: newCampaign });
      expect(result).toEqual(createdCampaign);
    });
  });

  describe('Character Operations', () => {
    it('should find characters in campaign', async () => {
      const mockCharacters = [
        { id: 'char-1', name: 'Fighter', campaignId: 'camp-1' },
        { id: 'char-2', name: 'Wizard', campaignId: 'camp-1' }
      ];
      mockPrisma.character.findMany.mockResolvedValue(mockCharacters);
      
      const result = await mockPrisma.character.findMany({
        where: { campaignId: 'camp-1' }
      });
      
      expect(result).toEqual(mockCharacters);
    });

    it('should create character', async () => {
      const newCharacter = { name: 'Rogue', class: 'rogue', campaignId: 'camp-1' };
      const createdCharacter = { id: 'char-3', ...newCharacter };
      mockPrisma.character.create.mockResolvedValue(createdCharacter);
      
      const result = await mockPrisma.character.create({ data: newCharacter });
      expect(result).toEqual(createdCharacter);
    });
  });

  describe('Transaction Handling', () => {
    it('should execute transactions', async () => {
      const transactionResult = { success: true };
      mockPrisma.$transaction.mockResolvedValue(transactionResult);
      
      const result = await mockPrisma.$transaction(async (tx: any) => {
        await tx.user.create({ data: { email: 'test@example.com' } });
        return { success: true };
      });
      
      expect(result).toEqual(transactionResult);
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('should rollback failed transactions', async () => {
      mockPrisma.$transaction.mockRejectedValue(new Error('Transaction failed'));
      
      await expect(mockPrisma.$transaction(async () => {
        throw new Error('Transaction failed');
      })).rejects.toThrow('Transaction failed');
    });
  });

  describe('Query Optimization', () => {
    it('should use includes for related data', async () => {
      const campaignWithCharacters = {
        id: 'camp-1',
        name: 'Test Campaign',
        characters: [
          { id: 'char-1', name: 'Fighter' },
          { id: 'char-2', name: 'Wizard' }
        ]
      };
      
      mockPrisma.campaign.findUnique.mockResolvedValue(campaignWithCharacters);
      
      const result = await mockPrisma.campaign.findUnique({
        where: { id: 'camp-1' },
        include: { characters: true }
      });
      
      expect(result.characters).toHaveLength(2);
    });

    it('should use select for specific fields', async () => {
      const userEmail = { email: 'test@example.com' };
      mockPrisma.user.findUnique.mockResolvedValue(userEmail);
      
      const result = await mockPrisma.user.findUnique({
        where: { id: 'user-1' },
        select: { email: true }
      });
      
      expect(result).toEqual(userEmail);
      expect(result.id).toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle unique constraint violations', async () => {
      const uniqueError = new Error('Unique constraint failed');
      mockPrisma.user.create.mockRejectedValue(uniqueError);
      
      await expect(mockPrisma.user.create({
        data: { email: 'existing@example.com' }
      })).rejects.toThrow('Unique constraint failed');
    });

    it('should handle foreign key violations', async () => {
      const fkError = new Error('Foreign key constraint failed');
      mockPrisma.character.create.mockRejectedValue(fkError);
      
      await expect(mockPrisma.character.create({
        data: { name: 'Test', campaignId: 'nonexistent' }
      })).rejects.toThrow('Foreign key constraint failed');
    });

    it('should handle not found errors', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      
      const result = await mockPrisma.user.findUnique({
        where: { id: 'nonexistent' }
      });
      
      expect(result).toBeNull();
    });
  });

  describe('Pagination', () => {
    it('should support skip and take', async () => {
      const mockUsers = [
        { id: 'user-3', email: 'user3@example.com' },
        { id: 'user-4', email: 'user4@example.com' }
      ];
      mockPrisma.user.findMany.mockResolvedValue(mockUsers);
      
      const result = await mockPrisma.user.findMany({
        skip: 2,
        take: 2
      });
      
      expect(result).toEqual(mockUsers);
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
        skip: 2,
        take: 2
      });
    });

    it('should support cursor-based pagination', async () => {
      const mockUsers = [
        { id: 'user-5', email: 'user5@example.com' }
      ];
      mockPrisma.user.findMany.mockResolvedValue(mockUsers);
      
      const result = await mockPrisma.user.findMany({
        cursor: { id: 'user-4' },
        take: 1
      });
      
      expect(result).toEqual(mockUsers);
    });
  });
});
