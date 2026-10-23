import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  getCertificate,
  getDashboardData,
  listCertificates,
  listIssuers,
} from "@/lib/certificates/queries";
import { setCertificateSkills } from "@/lib/certificates/skills";
import {
  adminClient,
  createTestUser,
  deleteTestUser,
  insertCertificate,
  randomKey,
  type TestUser,
} from "../helpers";

let a: TestUser;
let b: TestUser;
const tag = randomKey().slice(0, 8);
const skill = (name: string) => `${name} ${tag}`;

beforeAll(async () => {
  a = await createTestUser("a");
  b = await createTestUser("b");
});

afterAll(async () => {
  await adminClient().from("skills").delete().like("normalized_name", `% ${tag}`);
  await deleteTestUser(a);
  await deleteTestUser(b);
});

describe("setCertificateSkills", () => {
  it("adds, keeps and removes skills", async () => {
    const cert = await insertCertificate(a);

    await setCertificateSkills(a.client, cert, [skill("Networking"), skill("security"), skill("SECURITY")]);
    expect((await getCertificate(a.client, cert))?.skills.sort()).toEqual(
      [skill("Networking"), skill("security")].sort(),
    );

    await setCertificateSkills(a.client, cert, [skill("Security"), skill("Linux")]);
    expect((await getCertificate(a.client, cert))?.skills.sort()).toEqual(
      [skill("Linux"), skill("security")].sort(),
    );

    await setCertificateSkills(a.client, cert, []);
    expect((await getCertificate(a.client, cert))?.skills).toEqual([]);
  });

  it("cannot attach skills to another user's certificate", async () => {
    const certB = await insertCertificate(b);
    await expect(setCertificateSkills(a.client, certB, [skill("Hijack")])).rejects.toBeTruthy();
    expect((await getCertificate(b.client, certB))?.skills).toEqual([]);
  });
});

describe("library queries", () => {
  let user: TestUser;

  beforeAll(async () => {
    user = await createTestUser("lib");
    // Inserted in order, so created_at increases.
    await insertCertificate(user, { title: "Beta networking", issuer_name: "Cisco" });
    await insertCertificate(user, { title: "Alpha cloud", issuer_name: "Amazon" });
    await insertCertificate(user, { title: "100% Python_basics", issuer_name: "Cisco" });
  });

  afterAll(async () => {
    await deleteTestUser(user);
  });

  const titles = (list: { title: string }[]) => list.map((c) => c.title);

  it("sorts newest, oldest and by title", async () => {
    expect(titles(await listCertificates(user.client, { sort: "newest" }))).toEqual([
      "100% Python_basics",
      "Alpha cloud",
      "Beta networking",
    ]);
    expect(titles(await listCertificates(user.client, { sort: "oldest" }))).toEqual([
      "Beta networking",
      "Alpha cloud",
      "100% Python_basics",
    ]);
    expect(titles(await listCertificates(user.client, { sort: "title" }))).toEqual([
      "100% Python_basics",
      "Alpha cloud",
      "Beta networking",
    ]);
  });

  it("searches titles case-insensitively, treating % and _ literally", async () => {
    expect(titles(await listCertificates(user.client, { q: "NETWORK" }))).toEqual(["Beta networking"]);
    expect(titles(await listCertificates(user.client, { q: "100%" }))).toEqual(["100% Python_basics"]);
    expect(await listCertificates(user.client, { q: "%" })).toHaveLength(1);
    expect(await listCertificates(user.client, { q: "_" })).toHaveLength(1);
  });

  it("filters by issuer and lists only own issuers", async () => {
    expect(titles(await listCertificates(user.client, { issuer: "Cisco", sort: "title" }))).toEqual([
      "100% Python_basics",
      "Beta networking",
    ]);
    expect(await listIssuers(user.client)).toEqual(["Amazon", "Cisco"]);
  });

  it("never returns another user's certificates", async () => {
    expect(await listCertificates(b.client, { q: "networking" })).toEqual([]);
    const own = await listCertificates(user.client);
    expect(await getCertificate(b.client, own[0].id)).toBeNull();
    expect(await getCertificate(b.client, randomUUID())).toBeNull();
    expect(await getCertificate(b.client, "not-a-uuid")).toBeNull();
  });

  it("builds dashboard counts", async () => {
    const [first] = await listCertificates(user.client);
    await setCertificateSkills(user.client, first.id, [skill("Python"), skill("Testing")]);
    const data = await getDashboardData(user.client, user.id);
    expect(data.displayName).toBe("Test lib");
    expect(data.certificateCount).toBe(3);
    expect(data.recent).toHaveLength(3);
    expect(data.skills.map((s) => s.name).sort()).toEqual([skill("Python"), skill("Testing")].sort());
  });
});
