import { PrismaClient } from '@prisma/client';
import { logger } from '@vtt/logging';
const prisma = new PrismaClient();
(async () => {
    const count = await prisma.user.count();
    if (count === 0) {
        const u = await prisma.user.create({ data: { displayName: 'First GM' } });
        logger.info('Inserted user:', u.id, u.displayName);
    }
    const users = await prisma.user.findMany({ take: 3, orderBy: { createdAt: 'desc' } });
    logger.info('Users:', users.map(u => ({ id: u.id, displayName: u.displayName })));
    await prisma.$disconnect();
})().catch(e => { logger.error(e); process.exit(1); });
//# sourceMappingURL=dbPing.js.map