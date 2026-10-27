import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { uploadCertificateFiles } from "@/lib/files/service";
import { handleProblem } from "@/lib/sharing/handle";
import {
  SharingError,
  disableShare,
  enableCertificateShare,
  enablePortfolio,
  getPortfolioShare,
  setHandle,
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
  type TestUser,
} from "../helpers";

const tag = randomKey().slice(0, 6);
const h = (name: string) => `${name}-${tag}`;

let a: TestUser;
let b: TestUser;
let portfolio: Share;
let badgeKey = "";
let originalKey = "";

const byHandle = (handle: string) =>
  anonClient().rpc("get_public_portfolio_by_handle", { p_handle: handle }).then((r) => r.data);

beforeAll(async () => {
  a = await createTestUser("a");
  b = await createTestUser("b");
  const visible = await insertCertificate(a, { title: "Handle visible" });
  await insertCertificate(a, { title: "Handle hidden", hidden_from_portfolio: true });
  const jpeg = new Uint8Array(
    await sharp({ create: { width: 8, height: 8, channels: 3, background: "#000" } }).jpeg().toBuffer(),
  );
  await uploadCertificateFiles(a.client, visible, {
    original: { bytes: new TextEncoder().encode("%PDF-1.4\n"), name: "o.pdf" },
    badge: { bytes: jpeg, name: "b.jpg" },
  });
  const { data } = await adminClient()
    .from("certificate_files")
    .select("kind, public_key")
    .eq("certificate_id", visible);
  for (const f of data ?? []) {
    if (f.kind === "badge_image") badgeKey = f.public_key;
    else originalKey = f.public_key;
  }
});

afterAll(async () => {
  await adminClient().from("handle_reservations").delete().like("handle", `%-${tag}`);
  await deleteTestUser(a);
  await deleteTestUser(b);
});

describe("handle rules", () => {
  it("client-side messages match the database rules", () => {
    expect(handleProblem("ling-jia-ni")).toBeNull();
    expect(handleProblem("ab")).toMatch(/3–30/);
    expect(handleProblem("Ling")).toMatch(/lowercase/);
    expect(handleProblem("-ling")).toMatch(/Start and end/);
    expect(handleProblem("ling--ni")).toMatch(/two hyphens/);
    expect(handleProblem("admin")).toMatch(/reserved/);
  });

  it("the database rejects invalid and reserved handles", async () => {
    for (const bad of ["ab", "has_underscore", "-dash-start", "dash-end-", "two--dashes", "admin", "skills", "a".repeat(31)]) {
      await expect(setHandle(a.client, bad), bad).rejects.toBeInstanceOf(SharingError);
    }
  });

  it("stores handles lowercase and keeps them unique", async () => {
    await setHandle(a.client, h("Ling-Jia").toUpperCase());
    const { data } = await adminClient().from("profiles").select("handle").eq("id", a.id).single();
    expect(data?.handle).toBe(h("ling-jia"));
    await expect(setHandle(b.client, h("ling-jia"))).rejects.toThrow(/already taken/);
  });

  it("nobody can change someone else's handle", async () => {
    const { data } = await b.client.from("profiles").update({ handle: h("stolen") }).eq("id", a.id).select();
    expect(data ?? []).toHaveLength(0);
  });

  it("a released handle stays reserved for its previous owner", async () => {
    await setHandle(a.client, h("ling-two"));
    // A's old handle is reserved: B can't take it...
    await expect(setHandle(b.client, h("ling-jia"))).rejects.toThrow(/already taken/);
    // ...but A can take it back.
    await setHandle(a.client, h("ling-jia"));
    // Clearing keeps it reserved too.
    await setHandle(a.client, null);
    await expect(setHandle(b.client, h("ling-jia"))).rejects.toThrow(/already taken/);
    await setHandle(a.client, h("ling-jia"));
  });

  it("users can't read or edit reservations", async () => {
    expect((await a.client.from("handle_reservations").select("*")).data ?? []).toHaveLength(0);
    const { error } = await b.client.from("handle_reservations").delete().like("handle", `%-${tag}`);
    expect(error).not.toBeNull();
  });
});

describe("public portfolio by handle", () => {
  it("is null while the portfolio is off", async () => {
    expect(await byHandle(h("ling-jia"))).toBeNull();
  });

  it("returns the portfolio's public data, without revealing the slug", async () => {
    portfolio = await enablePortfolio(a.client);
    const viaHandle = await byHandle(h("ling-jia"));
    expect(Object.keys(viaHandle).sort()).toEqual(["certificates", "display_name"]);
    expect(viaHandle.certificates.map((c: { title: string }) => c.title)).toEqual(["Handle visible"]);
    const json = JSON.stringify(viaHandle);
    for (const secret of [portfolio.public_slug, a.id, originalKey]) expect(json).not.toContain(secret);
    // Lookup is case-insensitive; unknown handles return null.
    expect(await byHandle(h("LING-JIA"))).toEqual(viaHandle);
    expect(await byHandle(h("nobody-here"))).toBeNull();
  });

  it("resolves badge images for the service role only, never originals", async () => {
    const args = { p_handle: h("ling-jia"), p_key: badgeKey };
    expect((await anonClient().rpc("resolve_public_image_by_handle", args)).error).not.toBeNull();
    expect((await a.client.rpc("resolve_public_image_by_handle", args)).error).not.toBeNull();
    expect((await adminClient().rpc("resolve_public_image_by_handle", args)).data).toMatch(
      new RegExp(`^${a.id}/`),
    );
    expect(
      (await adminClient().rpc("resolve_public_image_by_handle", { ...args, p_key: originalKey })).data,
    ).toBeNull();
  });

  it("replaces the random link while set", async () => {
    const bySlug = (slug: string) =>
      anonClient().rpc("get_public_portfolio", { p_slug: slug }).then((r) => r.data);
    const imageBySlug = (slug: string) =>
      adminClient().rpc("resolve_public_image", { p_slug: slug, p_key: badgeKey }).then((r) => r.data);
    expect(await bySlug(portfolio.public_slug)).toBeNull();
    expect(await imageBySlug(portfolio.public_slug)).toBeNull();

    // Single-badge links are unaffected.
    const [visibleId] = ((await a.client.from("certificates").select("id").eq("title", "Handle visible")).data ?? []).map(
      (c) => c.id,
    );
    const badge = await enableCertificateShare(a.client, visibleId);
    expect(
      (await anonClient().rpc("get_public_certificate", { p_slug: badge.public_slug })).data,
    ).not.toBeNull();
    expect(await imageBySlug(badge.public_slug)).toMatch(new RegExp(`^${a.id}/`));

    // Removing the handle issues a new random link with the same options;
    // the old one never comes back.
    await updateShareOptions(a.client, portfolio.id, { show_credential_id: true, show_images: true });
    await setHandle(a.client, null);
    const fresh = await getPortfolioShare(a.client);
    expect(fresh?.public_slug).not.toBe(portfolio.public_slug);
    expect(fresh?.public_slug).toMatch(/^[0-9A-Za-z]{22}$/);
    expect(fresh?.show_credential_id).toBe(true);
    expect(await bySlug(portfolio.public_slug)).toBeNull();
    expect((await bySlug(fresh!.public_slug)).certificates).toHaveLength(1);
    expect(await imageBySlug(fresh!.public_slug)).toMatch(new RegExp(`^${a.id}/`));
    expect(await byHandle(h("ling-jia"))).toBeNull();

    // Setting it again replaces the new link too.
    await setHandle(a.client, h("ling-jia"));
    expect(await bySlug(fresh!.public_slug)).toBeNull();
    portfolio = fresh!;
  });

  it("removing the handle while the portfolio is off issues no link", async () => {
    await disableShare(a.client, portfolio.id);
    await setHandle(a.client, null);
    expect(await getPortfolioShare(a.client)).toBeNull();
    await setHandle(a.client, h("ling-jia"));
    portfolio = await enablePortfolio(a.client);
  });

  it("stops working as soon as the portfolio is turned off", async () => {
    await disableShare(a.client, portfolio.id);
    expect(await byHandle(h("ling-jia"))).toBeNull();
    const { data } = await adminClient().rpc("resolve_public_image_by_handle", {
      p_handle: h("ling-jia"),
      p_key: badgeKey,
    });
    expect(data).toBeNull();
  });
});
