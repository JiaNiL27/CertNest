// Run via `npm run test:app`, which builds the app first.
import { spawn, execSync, type ChildProcess } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { uploadCertificateFiles } from "@/lib/files/service";
import {
  disableShare,
  enableCertificateShare,
  enablePortfolio,
  type Share,
} from "@/lib/sharing/service";
import {
  adminClient,
  createTestUser,
  deleteTestUser,
  insertCertificate,
  randomSlug,
  type TestUser,
} from "../helpers";

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
      "/certificates/00000000-0000-0000-0000-000000000000",
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

  describe("public pages", () => {
    let owner: TestUser;
    let certificateId: string;
    let portfolio: Share;
    let badge: Share;
    let email: string;
    let publicId: string;

    beforeAll(async () => {
      owner = await createTestUser("pub");
      certificateId = await insertCertificate(owner, { title: "Public page badge" });
      await uploadCertificateFiles(owner.client, certificateId, {
        original: { bytes: new TextEncoder().encode("%PDF-1.4\n"), name: "secret.pdf" },
      });
      portfolio = await enablePortfolio(owner.client);
      badge = await enableCertificateShare(owner.client, certificateId);
      const admin = adminClient();
      email = (await admin.auth.admin.getUserById(owner.id)).data.user!.email!;
      publicId = (await admin.from("certificates").select("public_id").eq("id", certificateId).single())
        .data!.public_id;
    });

    afterAll(async () => {
      await deleteTestUser(owner);
    });

    const get = (path: string) => fetch(`${BASE}${path}`, { redirect: "manual" });

    it("serves portfolio and badge pages without a session, without private data", async () => {
      for (const path of [`/p/${portfolio.public_slug}`, `/p/${portfolio.public_slug}/${publicId}`, `/b/${badge.public_slug}`]) {
        const res = await get(path);
        expect(res.status, path).toBe(200);
        expect(res.headers.get("x-robots-tag"), path).toContain("noindex");
        const html = await res.text();
        expect(html, path).toContain("Public page badge");
        expect(html, path).toMatch(/<meta name="robots" content="noindex/);
        for (const secret of [owner.id, certificateId, email, "secret.pdf", "/api/files"]) {
          expect(html, `${path} leaks ${secret}`).not.toContain(secret);
        }
      }
    });

    it("returns 404 with one message for invalid links", async () => {
      for (const path of [
        `/p/${randomSlug()}`,
        `/b/${randomSlug()}`,
        `/p/${portfolio.public_slug}/${"0".repeat(32)}`,
        `/p/not-a-slug`,
      ]) {
        const res = await get(path);
        expect(res.status, path).toBe(404);
        expect(await res.text(), path).toContain("This link is invalid or no longer active");
      }
    });

    it("serves a generated preview image only for active portfolios", async () => {
      const ok = await get(`/p/${portfolio.public_slug}/og`);
      expect(ok.status).toBe(200);
      expect(ok.headers.get("content-type")).toContain("image/png");
      expect((await get(`/p/${randomSlug()}/og`)).status).toBe(404);
    });

    it("image routes never serve unknown keys or files", async () => {
      for (const path of [
        `/p/${portfolio.public_slug}/img/${randomSlug()}`,
        `/b/${badge.public_slug}/img/${randomSlug()}`,
        `/p/${randomSlug()}/img/${randomSlug()}`,
      ]) {
        expect((await get(path)).status, path).toBe(404);
      }
    });

    it("stops serving a link as soon as it is turned off", async () => {
      await disableShare(owner.client, badge.id);
      expect((await get(`/b/${badge.public_slug}`)).status).toBe(404);
      await disableShare(owner.client, portfolio.id);
      expect((await get(`/p/${portfolio.public_slug}`)).status).toBe(404);
      expect((await get(`/p/${portfolio.public_slug}/${publicId}`)).status).toBe(404);
      expect((await get(`/p/${portfolio.public_slug}/og`)).status).toBe(404);
    });
  });
});
