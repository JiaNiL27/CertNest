import { afterAll, beforeAll, expect, it } from "vitest";
import {
  adminClient,
  anonClient,
  createTestUser,
  deleteTestUser,
  randomKey,
  type TestUser,
} from "../helpers";

let a: TestUser;
const suffix = randomKey().slice(0, 8);

beforeAll(async () => {
  a = await createTestUser("a");
});

afterAll(async () => {
  await adminClient().from("skills").delete().like("normalized_name", `%${suffix}`);
  await deleteTestUser(a);
});

it("signed-in users cannot insert skills directly", async () => {
  const { error } = await a.client
    .from("skills")
    .insert({ name: `Direct ${suffix}`, normalized_name: `direct ${suffix}` });
  expect(error).not.toBeNull();
});

it("ensure_skills trims, lowercases and de-duplicates", async () => {
  const { data, error } = await a.client.rpc("ensure_skills", {
    names: [`  React ${suffix} `, `react ${suffix}`, `REACT ${suffix}`, `Node.js ${suffix}`, "   "],
  });
  expect(error).toBeNull();
  const normalized = (data as { normalized_name: string }[]).map((s) => s.normalized_name).sort();
  expect(normalized).toEqual([`node.js ${suffix}`, `react ${suffix}`]);

  const react = (data as { name: string; normalized_name: string }[]).find(
    (s) => s.normalized_name === `react ${suffix}`,
  );
  expect(react?.name).toBe(`React ${suffix}`);
});

it("ensure_skills returns existing skills without duplicating them", async () => {
  const { data, error } = await a.client.rpc("ensure_skills", { names: [`REACT ${suffix}`] });
  expect(error).toBeNull();
  expect(data).toHaveLength(1);

  const { count } = await adminClient()
    .from("skills")
    .select("id", { count: "exact", head: true })
    .eq("normalized_name", `react ${suffix}`);
  expect(count).toBe(1);
});

it("ensure_skills rejects more than 30 names", async () => {
  const names = Array.from({ length: 31 }, (_, i) => `s${i} ${suffix}`);
  const { error } = await a.client.rpc("ensure_skills", { names });
  expect(error).not.toBeNull();
});

it("anon cannot call ensure_skills", async () => {
  const { error } = await anonClient().rpc("ensure_skills", { names: [`anon ${suffix}`] });
  expect(error).not.toBeNull();
});
