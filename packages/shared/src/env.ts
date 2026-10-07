import { config } from "dotenv";
import { fileURLToPath } from "node:url";

// Preserve injected variables and package-local overrides before loading the root defaults.
config();
config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });
