import { Prisma } from "@prisma/client";
import type { PrismaService } from "../prisma/prisma.service";

const SEARCH_RESULT_LIMIT = 50;

export function buildUserSearchWhere(term: string): Prisma.UserWhereInput {
  const trimmed = term.trim();
  const parts = trimmed.split(/\s+/).filter(Boolean);
  const or: Prisma.UserWhereInput[] = [
    { email: { contains: trimmed, mode: "insensitive" } },
    { phone: { contains: trimmed, mode: "insensitive" } },
    { firstName: { contains: trimmed, mode: "insensitive" } },
    { lastName: { contains: trimmed, mode: "insensitive" } },
    { id: { contains: trimmed, mode: "insensitive" } },
  ];
  if (parts.length >= 2) {
    or.push({
      AND: [
        { firstName: { contains: parts[0], mode: "insensitive" } },
        {
          lastName: {
            contains: parts.slice(1).join(" "),
            mode: "insensitive",
          },
        },
      ],
    });
  }
  return { OR: or };
}

export function buildGroupSearchWhere(term: string): Prisma.GroupWhereInput {
  const trimmed = term.trim();
  return {
    OR: [
      { name: { contains: trimmed, mode: "insensitive" } },
      { inviteCode: { contains: trimmed, mode: "insensitive" } },
      { id: { contains: trimmed, mode: "insensitive" } },
    ],
  };
}

export async function findMatchingUserIds(
  prisma: PrismaService,
  term: string,
): Promise<string[]> {
  const users = await prisma.user.findMany({
    where: buildUserSearchWhere(term),
    select: { id: true },
    take: SEARCH_RESULT_LIMIT,
  });
  return users.map((u) => u.id);
}

export async function findMatchingGroupIds(
  prisma: PrismaService,
  term: string,
): Promise<string[]> {
  const groups = await prisma.group.findMany({
    where: buildGroupSearchWhere(term),
    select: { id: true },
    take: SEARCH_RESULT_LIMIT,
  });
  return groups.map((g) => g.id);
}

export async function findAccountIdsForOwnersAndGroups(
  prisma: PrismaService,
  userIds: string[],
  groupIds: string[],
): Promise<string[]> {
  if (!userIds.length && !groupIds.length) return [];
  const or: Prisma.LedgerAccountWhereInput[] = [];
  if (userIds.length) or.push({ userId: { in: userIds } });
  if (groupIds.length) or.push({ groupId: { in: groupIds } });
  const accounts = await prisma.ledgerAccount.findMany({
    where: { OR: or },
    select: { id: true },
    take: SEARCH_RESULT_LIMIT * 2,
  });
  return accounts.map((a) => a.id);
}

/** Safe metadata text search — results are still sanitized on read. */
export async function findTransactionIdsByMetadataTerm(
  prisma: PrismaService,
  term: string,
): Promise<string[]> {
  const pattern = `%${term.trim()}%`;
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM "LedgerTransaction"
    WHERE metadata IS NOT NULL
      AND metadata::text ILIKE ${pattern}
    LIMIT ${SEARCH_RESULT_LIMIT}
  `;
  return rows.map((r) => r.id);
}
