import { afterEach } from "bun:test";
import { existsSync, readdirSync, unlinkSync } from "node:fs";

import path, { join } from "node:path";

afterEach(() => {
  const dbDir = join(process.cwd(), "db");

  if (existsSync(dbDir)) {
    for (const file of readdirSync(dbDir)) {
      if (file.endsWith(".db")) {
        unlinkSync(path.join(dbDir, file));
      }
    }
  }
});
