import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
(async () => {
  const count = await prisma.user.count();
  if (count === 0) {
    const u = await prisma.user.create({ data: { displayName: 'First GM' }});
    console.log('Inserted user:', u.id, u.displayName);
  }
  const users = await prisma.user.findMany({ take: 3, orderBy: { createdAt: 'desc' } });
  console.log('Users:', users.map(u => ({ id: u.id, displayName: u.displayName })));
  await prisma.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
