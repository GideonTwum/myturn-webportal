"use strict";

require("../load-env.cjs");

const { spawnSync } = require("node:child_process");

const prismaEntry = require.resolve("prisma/build/index.js");

const exitCode =
  spawnSync(process.execPath, [prismaEntry, ...process.argv.slice(2)], {
    stdio: "inherit",
  }).status ?? 1;

process.exit(exitCode);
