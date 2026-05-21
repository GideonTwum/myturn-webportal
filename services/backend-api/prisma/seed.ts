import { PrismaClient, UserRole } from "@prisma/client";
import * as bcrypt from "bcrypt";
import { resolve } from "node:path";

const {
  loadPrismaEnv,
  logDatabaseUrlHost,
}: {
  loadPrismaEnv: (packageRoot?: string) => { railwayPublicLoaded: boolean };
  logDatabaseUrlHost: (prefix?: string) => void;
} = require("../load-env.cjs");

const packageRoot = resolve(__dirname, "..");
const { railwayPublicLoaded } = loadPrismaEnv(packageRoot);

const prisma = new PrismaClient();

const DEFAULT_PASSWORD = "ChangeMe123!";

type SeedUser = {
  email: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  phone?: string;
};

const SEED_USERS: SeedUser[] = [
  {
    email: "hq@myturn.local",
    role: UserRole.SUPER_ADMIN,
    firstName: "MyTurn",
    lastName: "HQ",
  },
  {
    email: "admin@myturn.local",
    role: UserRole.ADMIN,
    firstName: "Group",
    lastName: "Admin",
  },
  {
    email: "member@myturn.local",
    role: UserRole.USER,
    firstName: "Member",
    lastName: "One",
    phone: "0240000001",
  },
  {
    email: "member2@myturn.local",
    role: UserRole.USER,
    firstName: "Member",
    lastName: "Two",
    phone: "0240000002",
  },
  {
    email: "member3@myturn.local",
    role: UserRole.USER,
    firstName: "Member",
    lastName: "Three",
    phone: "0240000003",
  },
  {
    email: "member4@myturn.local",
    role: UserRole.USER,
    firstName: "Member",
    lastName: "Four",
    phone: "0240000004",
  },
  {
    email: "member5@myturn.local",
    role: UserRole.USER,
    firstName: "Member",
    lastName: "Five",
    phone: "0240000005",
  },
];

async function ensureSeedUser(
  passwordHash: string,
  spec: SeedUser,
): Promise<"created" | "skipped" | "reactivated"> {
  const existing = await prisma.user.findUnique({
    where: { email: spec.email },
    select: { id: true, email: true, role: true, isActive: true },
  });

  if (existing) {
    if (!existing.isActive) {
      await prisma.user.update({
        where: { id: existing.id },
        data: { isActive: true },
      });
      console.log(
        `[seed] reactivated ${spec.email} (${existing.role}) — was inactive`,
      );
      return "reactivated";
    }
    console.log(
      `[seed] skipped ${spec.email} (${existing.role}) — already exists`,
    );
    return "skipped";
  }

  await prisma.user.create({
    data: {
      email: spec.email,
      passwordHash,
      role: spec.role,
      firstName: spec.firstName,
      lastName: spec.lastName,
      phone: spec.phone,
      isActive: true,
    },
  });
  console.log(`[seed] created ${spec.email} (${spec.role})`);
  return "created";
}

async function main() {
  console.log("[seed] MyTurn initial users");
  console.log(
    railwayPublicLoaded
      ? "[seed] Env: .env + .env.railway-public (Railway public URL overrides DATABASE_URL)"
      : "[seed] Env: .env only (local DATABASE_URL)",
  );
  logDatabaseUrlHost("[seed]");

  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  const counts = { created: 0, skipped: 0, reactivated: 0 };

  for (const spec of SEED_USERS) {
    const result = await ensureSeedUser(passwordHash, spec);
    counts[result] += 1;
  }

  const byRole = {
    SUPER_ADMIN: SEED_USERS.filter((u) => u.role === UserRole.SUPER_ADMIN).length,
    ADMIN: SEED_USERS.filter((u) => u.role === UserRole.ADMIN).length,
    USER: SEED_USERS.filter((u) => u.role === UserRole.USER).length,
  };

  console.log("[seed] --- summary ---");
  console.log(
    `[seed] defined: ${SEED_USERS.length} users (${byRole.SUPER_ADMIN} HQ, ${byRole.ADMIN} admin, ${byRole.USER} members)`,
  );
  console.log(
    `[seed] result: ${counts.created} created, ${counts.skipped} skipped, ${counts.reactivated} reactivated`,
  );
  console.log(`[seed] default password (new users only): ${DEFAULT_PASSWORD}`);
  console.log("[seed] done");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error("[seed] failed:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
