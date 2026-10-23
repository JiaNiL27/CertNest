import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  adminClient,
  anonClient,
  createTestUser,
  deleteTestUser,
  insertCertificate,
  type TestUser,
} from "../helpers";

const BUCKET = "certificate-files";
const PDF = new TextEncoder().encode("%PDF-1.4\n% CertNest test file\n");

let a: TestUser;
let b: TestUser;
let folderA: string;
let pathA: string;

beforeAll(async () => {
  a = await createTestUser("a");
  b = await createTestUser("b");
  const certA = await insertCertificate(a);
  folderA = `${a.id}/${certA}`;
  pathA = `${folderA}/${randomUUID()}.pdf`;

  const { error } = await a.client.storage
    .from(BUCKET)
    .upload(pathA, PDF, { contentType: "application/pdf" });
  expect(error).toBeNull();
});

afterAll(async () => {
  await deleteTestUser(a);
  await deleteTestUser(b);
});

async function fileStillExists() {
  const { data } = await adminClient().storage.from(BUCKET).download(pathA);
  return data !== null;
}

it("A can read own file", async () => {
  const { data, error } = await a.client.storage.from(BUCKET).download(pathA);
  expect(error).toBeNull();
  expect(data).not.toBeNull();
});

for (const who of ["B", "anon"] as const) {
  describe(`${who} cannot access A's folder`, () => {
    const client = () => (who === "B" ? b.client : anonClient());

    it("cannot download", async () => {
      const { data } = await client().storage.from(BUCKET).download(pathA);
      expect(data).toBeNull();
    });

    it("cannot create a signed URL", async () => {
      const { data } = await client().storage.from(BUCKET).createSignedUrl(pathA, 60);
      expect(data?.signedUrl ?? null).toBeNull();
    });

    it("cannot list", async () => {
      const { data } = await client().storage.from(BUCKET).list(folderA);
      expect(data ?? []).toHaveLength(0);
    });

    it("cannot upload", async () => {
      const { error } = await client()
        .storage.from(BUCKET)
        .upload(`${folderA}/${randomUUID()}.pdf`, PDF, { contentType: "application/pdf" });
      expect(error).not.toBeNull();
    });

    it("cannot overwrite", async () => {
      const { error } = await client()
        .storage.from(BUCKET)
        .upload(pathA, PDF, { contentType: "application/pdf", upsert: true });
      expect(error).not.toBeNull();
    });

    it("cannot delete", async () => {
      const { data } = await client().storage.from(BUCKET).remove([pathA]);
      expect(data ?? []).toHaveLength(0);
      expect(await fileStillExists()).toBe(true);
    });
  });
}
