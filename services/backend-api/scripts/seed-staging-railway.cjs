"use strict";

/**
 * Apply staging demo data to Railway Postgres from your laptop.
 * Requires services/backend-api/.env.railway-public with the PUBLIC DATABASE_URL.
 * Idempotent — safe to run multiple times. Never wipes the database.
 */
require("ts-node/register/transpile-only");
require("../prisma/seed-staging.ts");
