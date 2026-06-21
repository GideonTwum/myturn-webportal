import { describe, expect, it } from "vitest";
import {
  buildGroupSearchWhere,
  buildUserSearchWhere,
} from "./hq-ledger-explorer-search.util";

describe("hq-ledger-explorer-search.util", () => {
  it("builds user search across name, email, phone, and id", () => {
    const where = buildUserSearchWhere("0244123456");
    expect(where.OR).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          phone: { contains: "0244123456", mode: "insensitive" },
        }),
      ]),
    );
  });

  it("builds user search for full name", () => {
    const where = buildUserSearchWhere("Ama Mensah");
    expect(where.OR).toEqual(
      expect.arrayContaining([
        {
          AND: [
            { firstName: { contains: "Ama", mode: "insensitive" } },
            { lastName: { contains: "Mensah", mode: "insensitive" } },
          ],
        },
      ]),
    );
  });

  it("builds group search across name, invite code, and id", () => {
    const where = buildGroupSearchWhere("MT-SAVE");
    expect(where.OR).toEqual([
      { name: { contains: "MT-SAVE", mode: "insensitive" } },
      { inviteCode: { contains: "MT-SAVE", mode: "insensitive" } },
      { id: { contains: "MT-SAVE", mode: "insensitive" } },
    ]);
  });
});
