"use strict";

/**
 * Wipe Railway staging Postgres from your laptop (.env.railway-public).
 * Requires MYTURN_CONFIRM_STAGING_WIPE=yes
 */
require("ts-node/register/transpile-only");
require("../prisma/wipe-staging-railway.ts");
