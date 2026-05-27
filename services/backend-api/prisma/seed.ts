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

/** HQ + admin only — members and groups are created via the app, not seed. */
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

  console.log("[seed] --- summary ---");
  console.log(
    `[seed] defined: ${SEED_USERS.length} users (1 HQ, 1 admin) — no members or groups`,
  );
  console.log("[seed] HQ:    hq@myturn.local");
  console.log("[seed] Admin: admin@myturn.local");
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
