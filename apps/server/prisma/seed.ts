/**
 * Database seed script - Creates initial test data
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { logger } from '@vtt/logging';

const prisma = new PrismaClient();

async function main() {
  logger.info('Starting database seed...');

  // Clean existing data (be careful in production!)
  await prisma.appliedCondition.deleteMany();
  await prisma.condition.deleteMany();
  await prisma.encounterToken.deleteMany();
  await prisma.encounter.deleteMany();
  await prisma.token.deleteMany();
  await prisma.gameSession.deleteMany();
  await prisma.campaignSettings.deleteMany();
  await prisma.chatMessage.deleteMany();
  await prisma.scene.deleteMany();
  await prisma.campaignMember.deleteMany();
  await prisma.campaign.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();
  
  logger.info('Cleaned existing data');

  // Create test users
  const passwordHash = await bcrypt.hash('password123', 10);
  
  const gameMaster = await prisma.user.create({
    data: {
      email: 'gm@example.com',
      username: 'gamemaster',
      displayName: 'The Game Master',
      passwordHash,
      role: 'gamemaster',
      permissions: ['manage_campaigns', 'manage_users', 'manage_content'],
      subscription: 'premium',
      isEmailVerified: true,
      lastLogin: new Date(),
    },
  });

  const player1 = await prisma.user.create({
    data: {
      email: 'player1@example.com',
      username: 'aragorn',
      displayName: 'Aragorn',
      passwordHash,
      role: 'player',
      permissions: [],
      subscription: 'free',
      isEmailVerified: true,
      lastLogin: new Date(Date.now() - 24 * 60 * 60 * 1000),
    },
  });

  const player2 = await prisma.user.create({
    data: {
      email: 'player2@example.com',
      username: 'legolas',
      displayName: 'Legolas',
      passwordHash,
      role: 'player',
      permissions: [],
      subscription: 'free',
      isEmailVerified: true,
      lastLogin: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    },
  });

  const player3 = await prisma.user.create({
    data: {
      email: 'player3@example.com',
      username: 'gimli',
      displayName: 'Gimli',
      passwordHash,
      role: 'player',
      permissions: [],
      subscription: 'basic',
      isEmailVerified: true,
      lastLogin: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    },
  });

  logger.info('Created test users');

  // Create campaigns
  const campaign1 = await prisma.campaign.create({
    data: {
      name: 'Lost Mine of Phandelver',
      scenes: {
        create: [
          {
            name: 'Goblin Ambush',
          },
          {
            name: 'Cragmaw Hideout',
          },
        ],
      },
      members: {
        create: [
          {
            userId: gameMaster.id,
            role: 'gamemaster',
            status: 'active',
          },
          {
            userId: player1.id,
            role: 'player',
            status: 'active',
          },
          {
            userId: player2.id,
            role: 'player',
            status: 'active',
          },
        ],
      },
      settings: {
        create: {
          isPublic: false,
          allowSpectators: true,
          maxPlayers: 6,
          autoAcceptInvites: false,
          requireApproval: true,
          sessionTimeout: 240,
        },
      },
    },
    include: {
      scenes: true,
      members: true,
      settings: true,
    },
  });

  const campaign2 = await prisma.campaign.create({
    data: {
      name: 'Curse of Strahd',
      activeSceneId: undefined,
      scenes: {
        create: [
          {
            name: 'Death House',
          },
          {
            name: 'Village of Barovia',
          },
        ],
      },
      members: {
        create: [
          {
            userId: gameMaster.id,
            role: 'gamemaster',
            status: 'active',
          },
          {
            userId: player1.id,
            role: 'player',
            status: 'active',
          },
          {
            userId: player2.id,
            role: 'player',
            status: 'active',
          },
          {
            userId: player3.id,
            role: 'player',
            status: 'active',
          },
        ],
      },
      settings: {
        create: {
          isPublic: false,
          allowSpectators: false,
          maxPlayers: 5,
          autoAcceptInvites: false,
          requireApproval: true,
          sessionTimeout: 180,
        },
      },
    },
    include: {
      scenes: true,
      members: true,
      settings: true,
    },
  });

  // Set active scenes
  await prisma.campaign.update({
    where: { id: campaign1.id },
    data: { activeSceneId: campaign1.scenes[0].id },
  });

  await prisma.campaign.update({
    where: { id: campaign2.id },
    data: { activeSceneId: campaign2.scenes[0].id },
  });

  logger.info('Created campaigns with scenes');

  // Create game sessions
  const session1 = await prisma.gameSession.create({
    data: {
      name: 'Session 1: The Adventure Begins',
      campaignId: campaign1.id,
      status: 'COMPLETED',
      currentSceneId: campaign1.scenes[0].id,
      startedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      endedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000),
      roundNumber: 15,
      metadata: {
        totalDamageDealt: 156,
        monstersDefeated: 8,
      },
    },
  });

  const session2 = await prisma.gameSession.create({
    data: {
      name: 'Session 2: Into the Hideout',
      campaignId: campaign1.id,
      status: 'ACTIVE',
      currentSceneId: campaign1.scenes[1].id,
      startedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      roundNumber: 3,
    },
  });

  const session3 = await prisma.gameSession.create({
    data: {
      name: 'Session 1: Death House',
      campaignId: campaign2.id,
      status: 'WAITING',
      currentSceneId: campaign2.scenes[0].id,
    },
  });

  logger.info('Created game sessions');

  // Create some chat messages
  await prisma.chatMessage.create({
    data: {
      campaignId: campaign1.id,
      authorId: player1.id,
      channel: 'general',
      text: 'Ready to continue our adventure!',
    },
  });

  await prisma.chatMessage.create({
    data: {
      campaignId: campaign1.id,
      authorId: gameMaster.id,
      channel: 'general',
      text: 'Great! Let me set up the scene...',
    },
  });

  await prisma.chatMessage.create({
    data: {
      campaignId: campaign1.id,
      authorId: player2.id,
      channel: 'general',
      text: 'I cast detect magic on the entrance',
    },
  });

  logger.info('Created chat messages');

  // Create some tokens for active session
  const token1 = await prisma.token.create({
    data: {
      name: 'Aragorn',
      type: 'PC',
      visibility: 'VISIBLE',
      gameSessionId: session2.id,
      sceneId: campaign1.scenes[1].id,
      characterId: player1.id,
      x: 100,
      y: 100,
      z: 0,
      health: 45,
      maxHealth: 52,
      speed: 30,
      imageUrl: '/assets/tokens/fighter.png',
    },
  });

  const token2 = await prisma.token.create({
    data: {
      name: 'Legolas',
      type: 'PC',
      visibility: 'VISIBLE',
      gameSessionId: session2.id,
      sceneId: campaign1.scenes[1].id,
      characterId: player2.id,
      x: 150,
      y: 100,
      z: 0,
      health: 38,
      maxHealth: 42,
      speed: 35,
      imageUrl: '/assets/tokens/ranger.png',
    },
  });

  const goblin1 = await prisma.token.create({
    data: {
      name: 'Goblin Warrior',
      type: 'MONSTER',
      visibility: 'VISIBLE',
      gameSessionId: session2.id,
      sceneId: campaign1.scenes[1].id,
      x: 300,
      y: 200,
      z: 0,
      health: 7,
      maxHealth: 7,
      speed: 30,
      imageUrl: '/assets/tokens/goblin.png',
    },
  });

  logger.info('Created tokens');

  // Create an encounter
  const encounter = await prisma.encounter.create({
    data: {
      name: 'Goblin Ambush',
      gameSessionId: session2.id,
      sceneId: campaign1.scenes[1].id,
      status: 'ACTIVE',
      currentTurn: 0,
      roundNumber: 1,
      startedAt: new Date(),
      initiativeOrder: [token1.id, goblin1.id, token2.id],
      encounterTokens: {
        create: [
          {
            tokenId: token1.id,
            initiative: 18,
            turnOrder: 0,
          },
          {
            tokenId: goblin1.id,
            initiative: 15,
            turnOrder: 1,
          },
          {
            tokenId: token2.id,
            initiative: 12,
            turnOrder: 2,
          },
        ],
      },
    },
  });

  logger.info('Created encounter');

  // Create some conditions
  const poisonedCondition = await prisma.condition.create({
    data: {
      name: 'Poisoned',
      type: 'DEBUFF',
      description: 'Disadvantage on attack rolls and ability checks',
      duration: 10,
      metadata: {
        disadvantageOnAttacks: true,
        disadvantageOnAbilityChecks: true,
      },
    },
  });

  const blessedCondition = await prisma.condition.create({
    data: {
      name: 'Blessed',
      type: 'BUFF',
      description: 'Add 1d4 to attack rolls and saving throws',
      duration: 10,
      metadata: {
        bonusToAttacks: '1d4',
        bonusToSaves: '1d4',
      },
    },
  });

  // Apply a condition
  await prisma.appliedCondition.create({
    data: {
      conditionId: poisonedCondition.id,
      targetId: goblin1.id,
      targetType: 'token',
      duration: 3,
      appliedBy: player1.id,
    },
  });

  logger.info('Created conditions');

  logger.info('Database seed completed successfully!');
  logger.info(`Created ${await prisma.user.count()} users`);
  logger.info(`Created ${await prisma.campaign.count()} campaigns`);
  logger.info(`Created ${await prisma.scene.count()} scenes`);
  logger.info(`Created ${await prisma.gameSession.count()} game sessions`);
  logger.info(`Created ${await prisma.token.count()} tokens`);
  logger.info(`Created ${await prisma.chatMessage.count()} chat messages`);
}

main()
  .catch((e) => {
    logger.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
