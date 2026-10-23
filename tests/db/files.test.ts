import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  BUCKET,
  FileError,
  deleteCertificate,
  getSignedFileUrl,
  uploadCertificateFiles,
} from "@/lib/files/service";
import {
  adminClient,
  createTestUser,
  deleteTestUser,
  insertCertificate,
  type TestUser,
} from "../helpers";

const PDF = new TextEncoder().encode("%PDF-1.4\n% CertNest test\n");

let a: TestUser;
let b: TestUser;

beforeAll(async () => {
  a = await createTestUser("a");
  b = await createTestUser("b");
});

afterAll(async () => {
  await deleteTestUser(a);
  await deleteTestUser(b);
});

async function jpegWithExif() {
  return new Uint8Array(
    await sharp({ create: { width: 24, height: 24, channels: 3, background: "#123456" } })
      .jpeg()
      .withExif({ IFD0: { Artist: "Someone", Copyright: "Home address" } })
      .toBuffer(),
  );
}

async function filesOf(certificateId: string) {
  const { data } = await adminClient()
    .from("certificate_files")
    .select("id, kind, storage_path, mime_type, file_name")
    .eq("certificate_id", certificateId)
    .order("created_at");
  return data ?? [];
}

async function objectExists(path: string) {
  const { data } = await adminClient().storage.from(BUCKET).download(path);
  return data !== null;
}

async function expectFileError(promise: Promise<unknown>, code: FileError["code"]) {
  await expect(promise).rejects.toSatisfy((e) => e instanceof FileError && e.code === code);
}

describe("upload validation", () => {
  it("stores a PDF original under {user}/{certificate}/{uuid}.pdf", async () => {
    const cert = await insertCertificate(a);
    await uploadCertificateFiles(a.client, cert, { original: { bytes: PDF, name: "My Cert.pdf" } });

    const files = await filesOf(cert);
    expect(files).toHaveLength(1);
    expect(files[0].kind).toBe("original");
    expect(files[0].file_name).toBe("My Cert.pdf");
    expect(files[0].storage_path).toMatch(new RegExp(`^${a.id}/${cert}/[0-9a-f-]{36}\\.pdf$`));
    expect(await objectExists(files[0].storage_path)).toBe(true);
  });

  it("rejects uploads to another user's certificate", async () => {
    const certB = await insertCertificate(b);
    await expectFileError(
      uploadCertificateFiles(a.client, certB, { original: { bytes: PDF, name: "x.pdf" } }),
      "not_found",
    );
    expect(await filesOf(certB)).toHaveLength(0);
    const { data } = await adminClient().storage.from(BUCKET).list(`${a.id}/${certB}`);
    expect(data ?? []).toHaveLength(0);
  });

  it("rejects files over 10 MB", async () => {
    const cert = await insertCertificate(a);
    const big = new Uint8Array(10 * 1024 * 1024 + 1);
    big.set(PDF);
    await expectFileError(
      uploadCertificateFiles(a.client, cert, { original: { bytes: big, name: "big.pdf" } }),
      "too_large",
    );
  });

  it("rejects a file named .pdf that isn't a PDF", async () => {
    const cert = await insertCertificate(a);
    const fake = new TextEncoder().encode("<html><script>alert(1)</script></html>");
    await expectFileError(
      uploadCertificateFiles(a.client, cert, { original: { bytes: fake, name: "cert.pdf" } }),
      "unsupported_type",
    );
    expect(await filesOf(cert)).toHaveLength(0);
  });

  it("rejects a PDF as a badge image", async () => {
    const cert = await insertCertificate(a);
    await expectFileError(
      uploadCertificateFiles(a.client, cert, { badge: { bytes: PDF, name: "badge.pdf" } }),
      "unsupported_type",
    );
  });
});

describe("images", () => {
  it("strips EXIF and copies an image original as the badge image", async () => {
    const cert = await insertCertificate(a);
    await uploadCertificateFiles(a.client, cert, {
      original: { bytes: await jpegWithExif(), name: "photo.jpeg" },
    });

    const files = await filesOf(cert);
    expect(files.map((f) => f.kind).sort()).toEqual(["badge_image", "original"]);
    // Separate objects: the original stays private on its own path.
    expect(new Set(files.map((f) => f.storage_path)).size).toBe(2);

    for (const f of files) {
      const { data } = await adminClient().storage.from(BUCKET).download(f.storage_path);
      const meta = await sharp(new Uint8Array(await data!.arrayBuffer())).metadata();
      expect(meta.exif, f.kind).toBeUndefined();
    }
  });

  it("uses the uploaded badge image instead of copying the original", async () => {
    const cert = await insertCertificate(a);
    await uploadCertificateFiles(a.client, cert, {
      original: { bytes: await jpegWithExif(), name: "certificate.jpg" },
      badge: { bytes: await jpegWithExif(), name: "badge.jpg" },
    });
    const files = await filesOf(cert);
    expect(files.filter((f) => f.kind === "badge_image")).toHaveLength(1);
    expect(files.find((f) => f.kind === "badge_image")?.file_name).toBe("badge.jpg");
  });

  it("replacing a file removes the old row and storage object", async () => {
    const cert = await insertCertificate(a);
    await uploadCertificateFiles(a.client, cert, { original: { bytes: PDF, name: "v1.pdf" } });
    const [first] = await filesOf(cert);

    await uploadCertificateFiles(a.client, cert, { original: { bytes: PDF, name: "v2.pdf" } });
    const files = await filesOf(cert);
    expect(files).toHaveLength(1);
    expect(files[0].file_name).toBe("v2.pdf");
    expect(await objectExists(first.storage_path)).toBe(false);
  });
});

describe("download", () => {
  it("gives the owner a signed URL and others nothing", async () => {
    const cert = await insertCertificate(a);
    await uploadCertificateFiles(a.client, cert, { original: { bytes: PDF, name: "a.pdf" } });
    const [file] = await filesOf(cert);

    const url = await getSignedFileUrl(a.client, file.id, "download");
    expect(url).toContain("token=");
    const res = await fetch(url);
    expect(res.status).toBe(200);
    expect(new TextDecoder().decode(await res.arrayBuffer())).toContain("%PDF-");

    await expectFileError(getSignedFileUrl(b.client, file.id, "download"), "not_found");
    await expectFileError(getSignedFileUrl(a.client, randomUUID(), "download"), "not_found");
    await expectFileError(getSignedFileUrl(a.client, "not-a-uuid", "download"), "not_found");
  });

  it("never serves a PDF inline", async () => {
    const cert = await insertCertificate(a);
    await uploadCertificateFiles(a.client, cert, { original: { bytes: PDF, name: "a.pdf" } });
    const [file] = await filesOf(cert);
    await expectFileError(getSignedFileUrl(a.client, file.id, "view"), "not_found");
  });
});

describe("deleteCertificate", () => {
  it("removes storage objects first, then the certificate", async () => {
    const cert = await insertCertificate(a);
    await uploadCertificateFiles(a.client, cert, {
      original: { bytes: await jpegWithExif(), name: "c.jpg" },
    });
    const paths = (await filesOf(cert)).map((f) => f.storage_path);
    expect(paths).toHaveLength(2);

    await deleteCertificate(a.client, cert);

    for (const p of paths) expect(await objectExists(p)).toBe(false);
    const { count } = await adminClient()
      .from("certificates")
      .select("id", { count: "exact", head: true })
      .eq("id", cert);
    expect(count).toBe(0);
  });

  it("cannot delete another user's certificate", async () => {
    const certB = await insertCertificate(b);
    await uploadCertificateFiles(b.client, certB, { original: { bytes: PDF, name: "b.pdf" } });
    const [file] = await filesOf(certB);

    await expectFileError(deleteCertificate(a.client, certB), "not_found");
    expect(await objectExists(file.storage_path)).toBe(true);
  });
});
