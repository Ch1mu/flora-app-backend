import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  await Promise.all([
    prisma.branch.upsert({
      where: { name: 'Centro' },
      update: {},
      create: { name: 'Centro' },
    }),
    prisma.branch.upsert({
      where: { name: 'Norte' },
      update: {},
      create: { name: 'Norte' },
    }),
  ]);

  await prisma.user.upsert({
    where: { email: 'admin@flora.local' },
    update: {},
    create: {
      name: 'Admin',
      email: 'admin@flora.local',
      passwordHash: await bcrypt.hash('cambiar123', 10),
      isActive: true,
    },
  });

  await Promise.all([
    prisma.stockItem.upsert({
      where: { id: 1 },
      update: {},
      create: { name: 'Rosas rojas', category: 'Flores', units: 24, price: 1500 },
    }),
    prisma.stockItem.upsert({
      where: { id: 2 },
      update: {},
      create: { name: 'Ramo mixto', category: 'Ramos', units: 12, price: 8500 },
    }),
  ]);
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
