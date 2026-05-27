import { describe, expect, it, vi } from "vitest";
import { NotificationsService } from "./notifications.service";

describe("NotificationsService", () => {
  const prisma = {
    notification: {
      create: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
  };

  const service = new NotificationsService(prisma as never);

  it("deleteForUser returns true when a row was removed", async () => {
    prisma.notification.deleteMany.mockResolvedValue({ count: 1 });
    await expect(service.deleteForUser("u1", "n1")).resolves.toBe(true);
    expect(prisma.notification.deleteMany).toHaveBeenCalledWith({
      where: { id: "n1", userId: "u1" },
    });
  });

  it("clearAllForUser deletes only that user's notifications", async () => {
    prisma.notification.deleteMany.mockResolvedValue({ count: 3 });
    const result = await service.clearAllForUser("u1");
    expect(result.count).toBe(3);
    expect(prisma.notification.deleteMany).toHaveBeenCalledWith({
      where: { userId: "u1" },
    });
  });
});
