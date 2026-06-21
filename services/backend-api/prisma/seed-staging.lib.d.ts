import { PrismaClient, UserRole } from "@prisma/client";
export declare const STAGING_INVITE_DEMO = "STAGING-DEMO";
export declare const STAGING_INVITE_PAY = "STAGING-PAY";
export declare const DEFAULT_STAGING_PASSWORD = "ChangeMe123!";
type SeedUser = {
    email: string;
    role: UserRole;
    firstName: string;
    lastName: string;
};
export type StagingGroupSpec = {
    inviteCode: string;
    name: string;
    description: string;
    contributionAmount: number;
    groupSize: number;
    daysPerCycle: number;
    startDate: string;
    serviceMarginBps?: number;
};
export declare const STAGING_GROUP_SPECS: StagingGroupSpec[];
export declare function ensureSeedUser(prisma: PrismaClient, passwordHash: string, spec: SeedUser): Promise<"created" | "skipped" | "reactivated">;
export declare function ensureStagingGroup(prisma: PrismaClient, adminId: string, spec: StagingGroupSpec): Promise<"created" | "skipped">;
export declare function runStagingSeed(prisma: PrismaClient): Promise<void>;
export {};
