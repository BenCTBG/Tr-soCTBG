import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client';
import { Role } from '../src/generated/prisma/enums';
import { PrismaPg } from '@prisma/adapter-pg';
import bcryptjs from 'bcryptjs';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const entities = [
    { name: 'CTBG PREMIUM', code: 'CTBG_PREMIUM' },
    { name: 'CTBG GROUPE', code: 'CTBG_GROUPE' },
    { name: 'CTBG EP', code: 'CTBG_EP' },
    { name: "CTBG HOME RENOV'", code: 'CTBG_HOME_RENOV' },
    { name: 'CVH', code: 'CVH' },
    { name: 'DOMOS ENERGIE', code: 'DOMOS_ENERGIE' },
  ];

  for (const entity of entities) {
    await prisma.entity.upsert({
      where: { code: entity.code },
      update: {},
      create: entity,
    });
  }
  console.log('6 entités créées');

  const defaultPassword = await bcryptjs.hash('Ctbg2026!', 12);

  const users = [
    { email: 'mehdi@ctbg.fr', name: 'Mehdi BOUZOU', role: Role.ADMIN },
    { email: 'hocine@ctbg.fr', name: 'Hocine', role: Role.ADMIN },
    { email: 'sophie@ctbg.fr', name: 'Sophie', role: Role.COMPTABLE },
    { email: 'elsa@ctbg.fr', name: 'Elsa', role: Role.COMPTABLE },
    { email: 'olivier@ctbg.fr', name: 'Olivier', role: Role.ADV },
    { email: 'melisa@ctbg.fr', name: 'Melisa', role: Role.ADV_RESTREINT },
    { email: 'anissa@ctbg.fr', name: 'Anissa', role: Role.OPERATEUR },
    { email: 'laetitia@ctbg.fr', name: 'Laetitia', role: Role.OPERATEUR },
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {},
      create: { ...user, password: defaultPassword },
    });
  }
  console.log('8 utilisateurs créés (mot de passe: Ctbg2026!)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
