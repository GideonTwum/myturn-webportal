import { PrismaClient } from "@prisma/client";
export type StaleWalletRow = {
    userId: string;
    balance: string;
    lockedBalance: string;
};
export type RepairAction = {
    kind: "zero_locked";
    userId: string;
    reason: string;
} | {
    kind: "migrate_locked";
    userId: string;
    amount: string;
    reason: string;
} | {
    kind: "zero_balance";
    userId: string;
    reason: string;
} | {
    kind: "migrate_balance";
    userId: string;
    amount: string;
    reason: string;
} | {
    kind: "skip";
    userId: string;
    reason: string;
};
export declare function planLegacyWalletRepair(row: StaleWalletRow): RepairAction[];
export declare function fetchStaleWallets(prisma: PrismaClient): Promise<StaleWalletRow[]>;
export declare function repairWalletRow(prisma: PrismaClient, row: StaleWalletRow, execute: boolean): Promise<RepairAction[]>;
export declare function runLegacyWalletRepair(prisma: PrismaClient, execute: boolean): Promise<void>;
