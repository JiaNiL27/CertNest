import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  adminClient,
  anonClient,
  createTestUser,
  deleteTestUser,
  insertCertificate,
  type TestUser,
} from "../helpers";

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

const consume = (u: TestUser) => u.client.rpc("consume_ai_quota", { p_feature: "linkedin_post" });
const remaining = async (u: TestUser) => (await u.client.rpc("ai_quota_remaining")).data as number;

describe("AI hourly quota", () => {
  it("allows 10 requests per hour, then refuses", async () => {
    expect(await remaining(a)).toBe(10);
    for (let i = 0; i < 10; i++) {
      const { data, error } = await consume(a);
      expect(error).toBeNull();
      expect(data).toMatch(/^[0-9a-f-]{36}$/);
    }
    expect(await remaining(a)).toBe(0);
    expect((await consume(a)).data).toBeNull();
    // Another user's quota is independent.
    expect(await remaining(b)).toBe(10);
  });

  it("can't be bypassed by concurrent requests", async () => {
    const results = await Promise.all(Array.from({ length: 15 }, () => consume(b)));
    expect(results.filter((r) => r.data).length).toBe(10);
  });

  it("users can't write, reset or refund their own history", async () => {
    const { error: insertError } = await a.client
      .from("ai_requests")
      .insert({ user_id: a.id, feature: "linkedin_post" });
    expect(insertError).not.toBeNull();

    const { data: deleted } = await a.client.from("ai_requests").delete().eq("user_id", a.id).select();
    expect(deleted ?? []).toHaveLength(0);

    const { data: rows } = await a.client.from("ai_requests").select("id").limit(1);
    const { error: refundError } = await a.client.rpc("refund_ai_request", {
      p_id: rows![0].id,
      p_user_id: a.id,
    });
    expect(refundError).not.toBeNull();
    expect(await remaining(a)).toBe(0);
  });

  it("the server (service role) can refund a recent request", async () => {
    const { data: rows } = await a.client.from("ai_requests").select("id").limit(1);
    await adminClient().rpc("refund_ai_request", { p_id: rows![0].id, p_user_id: a.id });
    expect(await remaining(a)).toBe(1);
    // Refund is tied to the owner.
    const { data: bRows } = await b.client.from("ai_requests").select("id").limit(1);
    await adminClient().rpc("refund_ai_request", { p_id: bRows![0].id, p_user_id: a.id });
    expect(await remaining(b)).toBe(0);
  });

  it("Fill from file, Suggest with AI and post drafts share one limit; unknown features are refused", async () => {
    const c = await createTestUser("c");
    try {
      for (let i = 0; i < 4; i++) {
        expect((await c.client.rpc("consume_ai_quota", { p_feature: "file_extract" })).data).toBeTruthy();
        expect((await consume(c)).data).toBeTruthy();
      }
      for (let i = 0; i < 2; i++) {
        expect((await c.client.rpc("consume_ai_quota", { p_feature: "draft_fields" })).data).toBeTruthy();
      }
      expect(await remaining(c)).toBe(0);
      expect((await c.client.rpc("consume_ai_quota", { p_feature: "file_extract" })).data).toBeNull();
      const other = await createTestUser("d");
      try {
        expect((await other.client.rpc("consume_ai_quota", { p_feature: "anything" })).error).not.toBeNull();
        expect(await remaining(other)).toBe(10);
      } finally {
        await deleteTestUser(other);
      }
    } finally {
      await deleteTestUser(c);
    }
  });

  it("other users and anon can't see AI history or use the quota", async () => {
    const { data } = await b.client.from("ai_requests").select("id").eq("user_id", a.id);
    expect(data ?? []).toHaveLength(0);
    expect((await anonClient().rpc("consume_ai_quota", { p_feature: "linkedin_post" })).error).not.toBeNull();
    expect((await anonClient().from("ai_requests").select("id")).data ?? []).toHaveLength(0);
  });
});

describe("saved LinkedIn posts", () => {
  it("one draft per certificate and language, owner only", async () => {
    const cert = await insertCertificate(a);
    const upsert = (u: TestUser, content: string, language = "en") =>
      u.client
        .from("generated_contents")
        .upsert(
          { user_id: u.id, certificate_id: cert, content_type: "linkedin_post", language, content },
          { onConflict: "certificate_id,content_type,language" },
        );

    expect((await upsert(a, "First draft")).error).toBeNull();
    expect((await upsert(a, "Second draft")).error).toBeNull();
    expect((await upsert(a, "Versión", "ms")).error).toBeNull();

    const { data } = await a.client
      .from("generated_contents")
      .select("language, content")
      .eq("certificate_id", cert)
      .order("language");
    expect(data).toEqual([
      { language: "en", content: "Second draft" },
      { language: "ms", content: "Versión" },
    ]);

    // B can neither read nor write A's drafts.
    expect((await upsert(b, "Hijack")).error).not.toBeNull();
    const { data: seen } = await b.client.from("generated_contents").select("id").eq("certificate_id", cert);
    expect(seen ?? []).toHaveLength(0);
  });
});
