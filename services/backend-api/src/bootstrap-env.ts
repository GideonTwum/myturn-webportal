import { config } from "dotenv";
import { resolve } from "node:path";

// Must run before other app imports (machine-level DATABASE_URL on Windows shadows .env otherwise).
config({ path: resolve(__dirname, "..", ".env"), override: true });
