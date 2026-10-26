import { randomBytes, randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Hard-coded on purpose: tests create and delete users, so they must never
// run against any other project, even if .env.local is misconfigured.
const DEV_PROJECT_REF = "wvoffnlgxdrbzoziexvt";

export function assertDevProject() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const ref = process.env.CERTNEST_DEV_PROJECT_REF ?? "";
  let host = "";
  try {
    host = new URL(url).host;
  } catch {
    // fall through to the error below
  }
  if (ref !== DEV_PROJECT_REF || host !== `${DEV_PROJECT_REF}.supabase.co`) {
    throw new Error(
      `Refusing to run tests: NEXT_PUBLIC_SUPABASE_URL and CERTNEST_DEV_PROJECT_REF must point to the dev project (${DEV_PROJECT_REF}).`,
    );
  }
}

function env(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name} in .env.local`);
  return value;
}

const noSession = { auth: { persistSession: false, autoRefreshToken: false } };

export function adminClient() {
  return createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), noSession);
}

export function anonClient() {
  return createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("NEXT_PUBLIC_SUPABASE_ANON_KEY"), noSession);
}

export type TestUser = { id: string; client: SupabaseClient };

// Creates a confirmed user via the admin API (no email is sent) and returns
// a client signed in as that user.
export async function createTestUser(label: string): Promise<TestUser> {
  const admin = adminClient();
  const email = `certnest-test-${label}-${randomUUID()}@example.com`;
  const password = `${randomUUID()}Aa1!`;

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: `Test ${label}` },
  });
  if (error || !data.user) throw error ?? new Error("createUser failed");

  const client = anonClient();
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;

  return { id: data.user.id, client };
}

// Removes the user's storage objects, then the user (rows cascade).
export async function deleteTestUser(user: TestUser | undefined) {
  if (!user) return;
  const admin = adminClient();
  const bucket = admin.storage.from("certificate-files");
  const { data: certFolders } = await bucket.list(user.id);
  for (const folder of certFolders ?? []) {
    const prefix = `${user.id}/${folder.name}`;
    const { data: files } = await bucket.list(prefix);
    const paths = (files ?? []).map((f) => `${prefix}/${f.name}`);
    if (paths.length) await bucket.remove(paths);
  }
  await admin.auth.admin.deleteUser(user.id);
}

export async function insertCertificate(user: TestUser, fields: Record<string, unknown> = {}) {
  const { data, error } = await user.client
    .from("certificates")
    .insert({ user_id: user.id, title: "Test certificate", issuer_name: "Test issuer", ...fields })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export const randomKey = () => randomUUID().replaceAll("-", "");

// Share slugs must be 22 base62 characters.
const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
export const randomSlug = () =>
  Array.from(randomBytes(22), (b) => BASE62[b % 62]).join("");
