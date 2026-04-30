import { PrismaClient, UserRole } from "@prisma/client";
import * as bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("ChangeMe123!", 10);

  await prisma.user.upsert({
    where: { email: "hq@myturn.local" },
    update: {},
    create: {
      email: "hq@myturn.local",
      passwordHash,
      role: UserRole.SUPER_ADMIN,
      firstName: "MyTurn",
      lastName: "HQ",
    },
  });

  await prisma.user.upsert({
    where: { email: "admin@myturn.local" },
    update: {},
    create: {
      email: "admin@myturn.local",
      passwordHash,
      role: UserRole.ADMIN,
      firstName: "Group",
      lastName: "Admin",
    },
  });

  await prisma.user.upsert({
    where: { email: "member@myturn.local" },
    update: {},
    create: {
      email: "member@myturn.local",
      passwordHash,
      role: UserRole.USER,
      firstName: "Member",
      lastName: "One",
    },
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
