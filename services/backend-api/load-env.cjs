"use strict";

const { resolve } = require("node:path");
const { config } = require("dotenv");

config({ path: resolve(__dirname, ".env"), override: true });
