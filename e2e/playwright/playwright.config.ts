import { defineConfig } from "@playwright/test";

const apiBase = (
  process.env.STAGING_API_URL ??
  process.env.API_URL ??
  "http://localhost:3001/api"
).replace(/\/+$/, "");

export default defineConfig({
  testDir: "./tests",
  timeout: 90_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : [["list"]],
  use: {
    baseURL: process.env.E2E_WEB_URL ?? "http://localhost:3000",
    extraHTTPHeaders: { "Content-Type": "application/json" },
  },
  projects: [
    {
      name: "ecosystem-api",
      testMatch: /ecosystem\.api\.spec\.ts/,
      use: { baseURL: apiBase },
    },
  ],
});
