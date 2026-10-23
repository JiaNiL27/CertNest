import { afterAll, beforeAll, expect, it } from "vitest";
import { createTestUser, deleteTestUser, type TestUser } from "../helpers";

let a: TestUser;

beforeAll(async () => {
  a = await createTestUser("a");
});

afterAll(async () => {
  await deleteTestUser(a);
});

async function insert(fields: Record<string, unknown>) {
  return a.client
    .from("certificates")
    .insert({ user_id: a.id, title: "Constraint test", issuer_name: "Issuer", ...fields });
}

it("accepts a valid certificate", async () => {
  const { error } = await insert({
    issued_at: "2025-01-01",
    expiration_status: "has_date",
    expires_at: "2027-01-01",
    credential_url: "https://example.com/badge/1",
  });
  expect(error).toBeNull();
});

it("rejects expires_at earlier than issued_at", async () => {
  const { error } = await insert({
    issued_at: "2025-06-01",
    expiration_status: "has_date",
    expires_at: "2025-01-01",
  });
  expect(error?.code).toBe("23514");
});

it("rejects has_date without expires_at", async () => {
  const { error } = await insert({ expiration_status: "has_date" });
  expect(error?.code).toBe("23514");
});

it("rejects expires_at when status is not has_date", async () => {
  const { error } = await insert({ expiration_status: "never", expires_at: "2030-01-01" });
  expect(error?.code).toBe("23514");
});

it("rejects a javascript: credential_url", async () => {
  const { error } = await insert({ credential_url: "javascript:alert(1)" });
  expect(error?.code).toBe("23514");
});
