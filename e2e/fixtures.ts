import { randomUUID } from "node:crypto";
import { test as base, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import sharp from "sharp";
import { adminClient, assertDevProject } from "../tests/helpers";

// Shared helpers for end-to-end tests. Accounts are created confirmed through
// the admin API (no email) and deleted after each test file.

assertDevProject();

export type E2EUser = { id: string; email: string; password: string; displayName: string };

export async function createUser(label: string): Promise<E2EUser> {
  const email = `certnest-test-e2e-${label}-${randomUUID().slice(0, 8)}@example.com`;
  const password = `${randomUUID()}Aa1!`;
  const displayName = `E2E ${label}`;
  const { data, error } = await adminClient().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: displayName },
  });
  if (error || !data.user) throw error ?? new Error("createUser failed");
  return { id: data.user.id, email, password, displayName };
}

/** Deletes storage objects, then the user (all rows cascade). */
export async function deleteUser(user: E2EUser | undefined) {
  if (!user) return;
  const admin = adminClient();
  const bucket = admin.storage.from("certificate-files");
  const { data: folders } = await bucket.list(user.id);
  for (const f of folders ?? []) {
    const prefix = `${user.id}/${f.name}`;
    const { data: files } = await bucket.list(prefix);
    const paths = (files ?? []).map((x) => `${prefix}/${x.name}`);
    if (paths.length) await bucket.remove(paths);
  }
  await admin.auth.admin.deleteUser(user.id);
}

export async function signIn(page: Page, user: E2EUser) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

export const pdfFile = (name = "certificate.pdf") => ({
  name,
  mimeType: "application/pdf",
  buffer: Buffer.from("%PDF-1.4\n% CertNest e2e\n"),
});

export async function jpegFile(name = "badge.jpg") {
  const buffer = await sharp({
    create: { width: 64, height: 64, channels: 3, background: "#0f5e57" },
  })
    .jpeg()
    .toBuffer();
  return { name, mimeType: "image/jpeg", buffer };
}

/** Fails on serious or critical accessibility violations. */
export async function expectAccessible(page: Page, context: string) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(
    serious.map((v) => `${v.id}: ${v.help} (${v.nodes.length}) e.g. ${v.nodes[0]?.target.join(" ")}`),
    `accessibility on ${context}`,
  ).toEqual([]);
}

export const test = base;
export { expect };
export type { Page };
