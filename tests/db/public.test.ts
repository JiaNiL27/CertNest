import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { uploadCertificateFiles } from "@/lib/files/service";
import { setCertificateSkills } from "@/lib/certificates/skills";
import {
  SharingError,
  disableShare,
  enableCertificateShare,
  enablePortfolio,
  regenerateShare,
  updateShareOptions,
  type Share,
} from "@/lib/sharing/service";
import {
  adminClient,
  anonClient,
  createTestUser,
  deleteTestUser,
  insertCertificate,
  randomKey,
  randomSlug,
  type TestUser,
} from "../helpers";

// Exactly the fields the public pages may show (PLAN: "公开页可以显示什么").
const PUBLIC_KEYS = [
  "credential_id",
  "credential_url",
  "description",
  "expiration_status",
  "expires_at",
  "image_key",
  "issued_at",
  "issuer_name",
  "public_id",
  "skills",
  "source_platform",
  "title",
].sort();

const tag = randomKey().slice(0, 8);
let a: TestUser;
let b: TestUser;
let visible: string;
let hidden: string;
let portfolio: Share;
let badgeShare: Share;
const files = { badgeKey: "", originalKey: "", hiddenBadgeKey: "", paths: [] as string[] };

async function jpeg() {
  return new Uint8Array(
    await sharp({ create: { width: 16, height: 16, channels: 3, background: "#336699" } }).jpeg().toBuffer(),
  );
}
const PDF = new TextEncoder().encode("%PDF-1.4\n% public test\n");

const portfolioOf = async (slug: string, client = anonClient()) =>
  (await client.rpc("get_public_portfolio", { p_slug: slug })).data;
const badgeOf = async (slug: string, client = anonClient()) =>
  (await client.rpc("get_public_certificate", { p_slug: slug })).data;

beforeAll(async () => {
  a = await createTestUser("a");
  b = await createTestUser("b");

  visible = await insertCertificate(a, {
    title: "Visible badge",
    description: "Public description",
    credential_id: "SECRET-CRED-ID",
    credential_url: "https://example.com/verify",
    expiration_status: "never",
  });
  hidden = await insertCertificate(a, { title: "Hidden badge", hidden_from_portfolio: true });
  await setCertificateSkills(a.client, visible, [`Zeta ${tag}`, `Alpha ${tag}`]);

  await uploadCertificateFiles(a.client, visible, {
    original: { bytes: PDF, name: "private.pdf" },
    badge: { bytes: await jpeg(), name: "badge.jpg" },
  });
  await uploadCertificateFiles(a.client, hidden, { badge: { bytes: await jpeg(), name: "h.jpg" } });

  const { data } = await adminClient()
    .from("certificate_files")
    .select("certificate_id, kind, public_key, storage_path")
    .in("certificate_id", [visible, hidden]);
  for (const f of data ?? []) {
    files.paths.push(f.storage_path);
    if (f.certificate_id === hidden) files.hiddenBadgeKey = f.public_key;
    else if (f.kind === "badge_image") files.badgeKey = f.public_key;
    else files.originalKey = f.public_key;
  }

  portfolio = await enablePortfolio(a.client);
  badgeShare = await enableCertificateShare(a.client, hidden);
});

afterAll(async () => {
  await adminClient().from("skills").delete().like("normalized_name", `% ${tag}`);
  await deleteTestUser(a);
  await deleteTestUser(b);
});

describe("get_public_portfolio", () => {
  it("returns only whitelisted fields and skips hidden certificates", async () => {
    const data = await portfolioOf(portfolio.public_slug);
    expect(data.display_name).toBe("Test a");
    expect(Object.keys(data).sort()).toEqual(["certificates", "display_name"]);
    expect(data.certificates).toHaveLength(1);

    const [c] = data.certificates;
    expect(Object.keys(c).sort()).toEqual(PUBLIC_KEYS);
    expect(c.title).toBe("Visible badge");
    expect(c.skills).toEqual([`Alpha ${tag}`, `Zeta ${tag}`]);
    expect(c.credential_id).toBeNull(); // off by default
    expect(c.image_key).toBe(files.badgeKey); // on by default
    expect(c.public_id).toMatch(/^[0-9a-f]{32}$/);
  });

  it("never leaks ids, owner, email, storage paths or the original file", async () => {
    const json = JSON.stringify(await portfolioOf(portfolio.public_slug));
    const { data: user } = await adminClient().auth.admin.getUserById(a.id);
    for (const secret of [a.id, visible, hidden, user.user!.email!, files.originalKey, ...files.paths]) {
      expect(json).not.toContain(secret);
    }
    expect(json).not.toContain("Hidden badge");
  });

  it("honors show_credential_id and show_images", async () => {
    await updateShareOptions(a.client, portfolio.id, { show_credential_id: true, show_images: false });
    let [c] = (await portfolioOf(portfolio.public_slug)).certificates;
    expect(c.credential_id).toBe("SECRET-CRED-ID");
    expect(c.image_key).toBeNull();

    await updateShareOptions(a.client, portfolio.id, { show_credential_id: false, show_images: true });
    [c] = (await portfolioOf(portfolio.public_slug)).certificates;
    expect(c.credential_id).toBeNull();
    expect(c.image_key).toBe(files.badgeKey);
  });

  it("returns null for unknown, malformed or wrong-scope slugs", async () => {
    expect(await portfolioOf(randomSlug())).toBeNull();
    expect(await portfolioOf("short")).toBeNull();
    expect(await portfolioOf("'; drop table shares; --")).toBeNull();
    expect(await portfolioOf(badgeShare.public_slug)).toBeNull();
  });
});

describe("get_public_certificate", () => {
  it("shares a certificate hidden from the portfolio through its own link", async () => {
    const data = await badgeOf(badgeShare.public_slug);
    expect(Object.keys(data).sort()).toEqual(["certificate", "display_name"]);
    expect(data.certificate.title).toBe("Hidden badge");
    expect(Object.keys(data.certificate).sort()).toEqual(PUBLIC_KEYS);
    expect(JSON.stringify(data)).not.toContain(hidden);
  });

  it("returns null for the wrong scope", async () => {
    expect(await badgeOf(portfolio.public_slug)).toBeNull();
  });
});

describe("resolve_public_image", () => {
  const resolve = (client: ReturnType<typeof anonClient>, slug: string, key: string) =>
    client.rpc("resolve_public_image", { p_slug: slug, p_key: key });

  it("cannot be called by anon or signed-in users", async () => {
    expect((await resolve(anonClient(), portfolio.public_slug, files.badgeKey)).error).not.toBeNull();
    expect((await resolve(a.client, portfolio.public_slug, files.badgeKey)).error).not.toBeNull();
  });

  it("resolves only badge images reachable through an active share", async () => {
    const admin = adminClient();
    expect((await resolve(admin, portfolio.public_slug, files.badgeKey)).data).toMatch(
      new RegExp(`^${a.id}/${visible}/`),
    );
    // Never the original file.
    expect((await resolve(admin, portfolio.public_slug, files.originalKey)).data).toBeNull();
    // Hidden certificate: not through the portfolio, but yes through its own link.
    expect((await resolve(admin, portfolio.public_slug, files.hiddenBadgeKey)).data).toBeNull();
    expect((await resolve(admin, badgeShare.public_slug, files.hiddenBadgeKey)).data).toBeTruthy();
    // A badge share can't reach other certificates' images.
    expect((await resolve(admin, badgeShare.public_slug, files.badgeKey)).data).toBeNull();
  });

  it("respects show_images", async () => {
    const admin = adminClient();
    await updateShareOptions(a.client, portfolio.id, { show_credential_id: false, show_images: false });
    expect((await resolve(admin, portfolio.public_slug, files.badgeKey)).data).toBeNull();
    await updateShareOptions(a.client, portfolio.id, { show_credential_id: false, show_images: true });
  });
});

describe("share management", () => {
  it("other users can't change or turn off someone else's share", async () => {
    await expect(disableShare(b.client, portfolio.id)).rejects.toBeInstanceOf(SharingError);
    const { data } = await b.client.from("shares").update({ show_images: false }).eq("id", portfolio.id).select();
    expect(data ?? []).toHaveLength(0);
    expect(await portfolioOf(portfolio.public_slug)).not.toBeNull();
  });

  it("share identity is immutable", async () => {
    const { error } = await a.client
      .from("shares")
      .update({ public_slug: randomSlug() })
      .eq("id", portfolio.id);
    expect(error).not.toBeNull();
  });

  it("regenerating kills the old link immediately", async () => {
    const fresh = await regenerateShare(a.client, portfolio.id);
    expect(fresh.public_slug).not.toBe(portfolio.public_slug);
    expect(await portfolioOf(portfolio.public_slug)).toBeNull();
    expect(await portfolioOf(fresh.public_slug)).not.toBeNull();
    portfolio = fresh;
  });

  it("turned-off links stay off and cannot be reactivated", async () => {
    await disableShare(a.client, portfolio.id);
    expect(await portfolioOf(portfolio.public_slug)).toBeNull();

    const { data: row } = await adminClient().from("shares").select("revoked_at").eq("id", portfolio.id).single();
    expect(row?.revoked_at).not.toBeNull();

    const { error } = await a.client.from("shares").update({ is_active: true }).eq("id", portfolio.id);
    expect(error).not.toBeNull();
    expect(await portfolioOf(portfolio.public_slug)).toBeNull();
  });

  it("requires a display name before turning on a portfolio", async () => {
    await a.client.from("profiles").update({ display_name: "" }).eq("id", a.id);
    await expect(enablePortfolio(a.client)).rejects.toMatchObject({ code: "display_name_required" });
    await a.client.from("profiles").update({ display_name: "Test a" }).eq("id", a.id);
  });
});
