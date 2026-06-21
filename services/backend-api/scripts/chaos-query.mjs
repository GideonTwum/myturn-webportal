import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const m1 = await p.user.findFirst({ where: { email: "chaos.m1@myturn.local" } });
const groupD = await p.group.findFirst({ where: { name: "Chaos GroupComplete" }, orderBy: { createdAt: "desc" } });
const reservesD = groupD ? await p.contributionGuaranteeReserve.findMany({ where: { groupId: groupD.id } }) : [];
const cov = await p.defaultCoverage.findMany({ orderBy: { createdAt: "desc" }, take: 5 });
const txns = await p.ledgerTransaction.findMany({
  where: { idempotencyKey: { contains: "default-cover" } },
  orderBy: { createdAt: "desc" },
  take: 3,
  include: { lines: { include: { account: true } } },
});
const restrictions = await p.groupMember.findMany({
  where: { userId: m1.id, cycleStanding: "DEFAULTED", status: "ACTIVE", group: { status: "ACTIVE" } },
  include: { group: { select: { name: true, currentCycle: true } } },
});
const hq = await fetch("http://localhost:3001/api/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: "hq@myturn.local", password: "ChangeMe123!" }),
}).then((r) => r.json());
const token = hq.access_token;
const recon = await fetch("http://localhost:3001/api/hq/reconciliation/summary", {
  headers: { Authorization: `Bearer ${token}` },
}).then((r) => r.json());

console.log(
  JSON.stringify(
    {
      groupD: groupD ? { id: groupD.id, status: groupD.status } : null,
      reservesD: reservesD.map((r) => ({
        userId: r.userId.slice(-4),
        status: r.status,
        remaining: r.remainingReserveAmount.toString(),
        released: r.releasedAmount.toString(),
        usedForDefault: r.usedForDefaultAmount.toString(),
      })),
      defaultCoverTxns: txns.map((t) => ({
        key: t.idempotencyKey,
        lines: t.lines.map((l) => ({
          acct: l.account?.accountKey,
          delta: l.delta?.toString?.() ?? String(l.delta),
        })),
      })),
      defaultCoverages: cov.map((c) => ({
        covered: c.coveredAmount.toString(),
        missed: c.missedAmount.toString(),
        groupId: c.groupId.slice(-6),
      })),
      m1ActiveDefaults: restrictions.map((r) => r.group.name),
      reconciliation: recon,
    },
    null,
    2,
  ),
);
await p.$disconnect();
