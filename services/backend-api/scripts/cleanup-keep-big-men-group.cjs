"use strict";

/** Local Postgres only — ignores .env.railway-public. */
process.env.MYTURN_LOCAL_DB = "1";
require("ts-node/register/transpile-only");
require("./cleanup-keep-big-men-group.ts");
