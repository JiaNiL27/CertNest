import { existsSync } from "node:fs";
import { assertDevProject } from "./helpers";

if (existsSync(".env.local")) {
  process.loadEnvFile(".env.local");
}

// Refuse to run against anything but the dev project.
assertDevProject();
