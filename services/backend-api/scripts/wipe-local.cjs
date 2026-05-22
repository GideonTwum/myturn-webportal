"use strict";

/** Wipe local Postgres only (ignores .env.railway-public). */
process.env.MYTURN_LOCAL_DB = "1";
require("ts-node/register/transpile-only");
require("../prisma/wipe-local.ts");
