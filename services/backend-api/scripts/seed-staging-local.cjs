"use strict";

/** Seeds staging demo data into local DATABASE_URL from .env (ignores .env.railway-public). */
process.env.MYTURN_LOCAL_DB = "1";
require("ts-node/register/transpile-only");
require("../prisma/seed-staging.ts");
