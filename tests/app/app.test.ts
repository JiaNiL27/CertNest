// Run via `npm run test:app`, which builds the app first.
import { spawn, execSync, type ChildProcess } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const PORT = 3100;
const BASE = `http://localhost:${PORT}`;
let server: ChildProcess | undefined;

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

describe("client bundle", () => {
  it("does not contain the service role key", () => {
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    expect(key, "SUPABASE_SERVICE_ROLE_KEY must be set").toBeTruthy();
    expect(existsSync(".next/static"), "run `next build` first").toBe(true);

    const leaks = walk(".next/static").filter((f) => readFileSync(f).includes(key!));
    expect(leaks).toEqual([]);
  });
});

describe("proxy", () => {
  beforeAll(async () => {
    server = spawn("npx", ["next", "start", "-p", String(PORT)], {
      shell: true,
      stdio: "ignore",
    });
    for (let i = 0; i < 60; i++) {
      try {
        await fetch(`${BASE}/login`, { redirect: "manual" });
        return;
      } catch {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
    throw new Error("next start did not come up");
  });

  afterAll(() => {
    if (!server?.pid) return;
    if (process.platform === "win32") {
      execSync(`taskkill /pid ${server.pid} /T /F`, { stdio: "ignore" });
    } else {
      server.kill();
    }
  });

  it("redirects anonymous /dashboard to /login", async () => {
    const res = await fetch(`${BASE}/dashboard`, { redirect: "manual" });
    expect([302, 303, 307, 308]).toContain(res.status);
    expect(new URL(res.headers.get("location")!, BASE).pathname).toBe("/login");
  });

  it("redirects anonymous M2 routes and file access to /login", async () => {
    for (const path of [
      "/certificates",
      "/certificates/new",
      "/certificates/00000000-0000-0000-0000-000000000000/edit",
      "/api/files?id=00000000-0000-0000-0000-000000000000",
    ]) {
      const res = await fetch(`${BASE}${path}`, { redirect: "manual" });
      expect([302, 303, 307, 308], path).toContain(res.status);
      expect(new URL(res.headers.get("location")!, BASE).pathname, path).toBe("/login");
    }
    const upload = await fetch(`${BASE}/api/files`, { method: "POST", redirect: "manual" });
    expect([302, 303, 307, 308]).toContain(upload.status);
  });

  it("serves /login without a session", async () => {
    const res = await fetch(`${BASE}/login`, { redirect: "manual" });
    expect(res.status).toBe(200);
  });
});
