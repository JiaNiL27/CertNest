import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  adminClient,
  anonClient,
  createTestUser,
  deleteTestUser,
  insertCertificate,
  randomKey,
  type TestUser,
} from "../helpers";

const TABLES = [
  "profiles",
  "certificates",
  "certificate_files",
  "shares",
  "skills",
  "certificate_skills",
  "generated_contents",
] as const;

let a: TestUser;
let b: TestUser;
let certA: string;
const skillName = `rls-${randomKey()}`;

beforeAll(async () => {
  a = await createTestUser("a");
  b = await createTestUser("b");
  certA = await insertCertificate(a);

  // Give A one row in every table so the anon checks are not vacuous.
  const fileRes = await a.client.from("certificate_files").insert({
    certificate_id: certA,
    user_id: a.id,
    kind: "original",
    storage_path: `${a.id}/${certA}/${randomKey()}.pdf`,
    file_name: "a.pdf",
    mime_type: "application/pdf",
    file_size: 10,
    public_key: randomKey(),
  });
  expect(fileRes.error).toBeNull();

  const shareRes = await a.client.from("shares").insert({
    user_id: a.id,
    scope: "certificate",
    certificate_id: certA,
    public_slug: randomKey(),
  });
  expect(shareRes.error).toBeNull();

  const genRes = await a.client.from("generated_contents").insert({
    user_id: a.id,
    certificate_id: certA,
    content_type: "linkedin_post",
    content: "Test post",
  });
  expect(genRes.error).toBeNull();

  const skills = await a.client.rpc("ensure_skills", { names: [skillName] });
  expect(skills.error).toBeNull();
  const linkRes = await a.client
    .from("certificate_skills")
    .insert({ certificate_id: certA, skill_id: skills.data[0].id });
  expect(linkRes.error).toBeNull();
});

afterAll(async () => {
  // Skills are global, so remove the one this file created.
  await adminClient().from("skills").delete().eq("normalized_name", skillName);
  await deleteTestUser(a);
  await deleteTestUser(b);
});

describe("user B cannot touch user A's certificates", () => {
  it("B selects A's certificate and gets 0 rows", async () => {
    const { data, error } = await b.client.from("certificates").select("*").eq("id", certA);
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it("B updates A's certificate and affects 0 rows", async () => {
    const { data, error } = await b.client
      .from("certificates")
      .update({ title: "hacked" })
      .eq("id", certA)
      .select();
    expect(error).toBeNull();
    expect(data).toHaveLength(0);

    const { data: row } = await adminClient()
      .from("certificates")
      .select("title")
      .eq("id", certA)
      .single();
    expect(row?.title).toBe("Test certificate");
  });

  it("B deletes A's certificate and affects 0 rows", async () => {
    const { data, error } = await b.client.from("certificates").delete().eq("id", certA).select();
    expect(error).toBeNull();
    expect(data).toHaveLength(0);

    const { count } = await adminClient()
      .from("certificates")
      .select("id", { count: "exact", head: true })
      .eq("id", certA);
    expect(count).toBe(1);
  });

  it("B cannot insert a certificate with user_id = A", async () => {
    const { error } = await b.client
      .from("certificates")
      .insert({ user_id: a.id, title: "x", issuer_name: "y" });
    expect(error).not.toBeNull();
  });
});

describe("B cannot attach rows to A's certificate", () => {
  for (const owner of ["b", "a"] as const) {
    it(`certificate_files with user_id = ${owner.toUpperCase()} is rejected`, async () => {
      const { error } = await b.client.from("certificate_files").insert({
        certificate_id: certA,
        user_id: owner === "a" ? a.id : b.id,
        kind: "original",
        storage_path: `${b.id}/${certA}/${randomKey()}.pdf`,
        file_name: "b.pdf",
        mime_type: "application/pdf",
        file_size: 10,
        public_key: randomKey(),
      });
      expect(error).not.toBeNull();
    });

    it(`shares with user_id = ${owner.toUpperCase()} is rejected`, async () => {
      const { error } = await b.client.from("shares").insert({
        user_id: owner === "a" ? a.id : b.id,
        scope: "certificate",
        certificate_id: certA,
        public_slug: randomKey(),
      });
      expect(error).not.toBeNull();
    });
  }

  it("generated_contents pointing to A's certificate is rejected", async () => {
    const { error } = await b.client.from("generated_contents").insert({
      user_id: b.id,
      certificate_id: certA,
      content_type: "course_summary",
      content: "x",
    });
    expect(error).not.toBeNull();
  });
});

describe("B cannot read A's private rows", () => {
  it("profiles", async () => {
    const { data } = await b.client.from("profiles").select("*").eq("id", a.id);
    expect(data ?? []).toHaveLength(0);

    const own = await a.client.from("profiles").select("display_name").eq("id", a.id).single();
    expect(own.data?.display_name).toBe("Test a");
  });

  it("generated_contents", async () => {
    const { data } = await b.client
      .from("generated_contents")
      .select("*")
      .eq("certificate_id", certA);
    expect(data ?? []).toHaveLength(0);
  });

  it("certificate_files, shares, certificate_skills", async () => {
    for (const table of ["certificate_files", "shares", "certificate_skills"]) {
      const { data } = await b.client.from(table).select("*").eq("certificate_id", certA);
      expect(data ?? [], table).toHaveLength(0);
    }
  });
});

describe("anon gets nothing from any table", () => {
  for (const table of TABLES) {
    it(table, async () => {
      const { data } = await anonClient().from(table).select("*").limit(1);
      expect(data ?? []).toHaveLength(0);

      // Sanity: rows do exist.
      const { count } = await adminClient()
        .from(table)
        .select("*", { count: "exact", head: true });
      expect(count).toBeGreaterThan(0);
    });
  }
});
