import { adminClient } from "../tests/helpers";
import { createUser, deleteUser, expect, expectAccessible, signIn, test, type E2EUser } from "./fixtures";

let user: E2EUser;

test.beforeEach(async () => {
  user = await createUser("share");
  // Two certificates straight in the database: one visible, one hidden.
  const admin = adminClient();
  const { error } = await admin.from("certificates").insert([
    {
      user_id: user.id,
      title: "E2E Public Badge",
      issuer_name: "E2E Org",
      credential_id: "SECRET-E2E-ID",
      credential_url: "https://example.com/verify",
      expiration_status: "never",
      hidden_from_portfolio: false,
    },
    {
      user_id: user.id,
      title: "E2E Hidden Badge",
      issuer_name: "E2E Org",
      credential_id: null,
      credential_url: null,
      expiration_status: "unknown",
      hidden_from_portfolio: true,
    },
  ]);
  if (error) throw error;
});

test.afterEach(async () => {
  await deleteUser(user);
});

test("portfolio: turn on, view as a visitor, turn off", async ({ page, browser }) => {
  await signIn(page, user);
  await page.goto("/settings/sharing");
  await expectAccessible(page, "sharing settings");
  await page.getByRole("button", { name: "Turn on public portfolio" }).click();
  const link = await page.getByLabel("Public link").inputValue();
  expect(link).toMatch(/\/p\/[0-9A-Za-z]{22}$/);

  // A separate context has no cookies: a real visitor.
  const visitor = await browser.newContext();
  const pub = await visitor.newPage();
  await pub.goto(link);
  await expect(pub.getByRole("heading", { level: 1, name: user.displayName })).toBeVisible();
  await expect(pub.getByText("E2E Public Badge")).toBeVisible();
  await expect(pub.getByText("E2E Hidden Badge")).toHaveCount(0);
  const html = await pub.content();
  for (const secret of [user.email, user.id, "SECRET-E2E-ID", "/api/files"]) {
    expect(html, `public page leaks ${secret}`).not.toContain(secret);
  }
  await expectAccessible(pub, "public portfolio");

  await pub.getByRole("link", { name: "View credential" }).click();
  await expect(pub).toHaveURL(/\/p\/[0-9A-Za-z]{22}\/[0-9a-f]{32}$/);
  await expect(pub.getByRole("heading", { name: "E2E Public Badge" })).toBeVisible();
  // The title updates after client-side navigation; wait for it.
  await expect(pub).toHaveTitle("E2E Public Badge · CertNest");
  // Any link out to the issuer opens safely.
  for (const link of await pub.locator('a[href^="https://example.com"]').all()) {
    await expect(link).toHaveAttribute("rel", "noopener noreferrer");
  }
  await expectAccessible(pub, "public badge page");

  // Turning the link off makes it invalid immediately.
  await page.getByRole("button", { name: "Turn off link" }).click();
  await expect(page.getByRole("button", { name: "Turn on public portfolio" })).toBeVisible();
  const gone = await pub.goto(link);
  expect(gone?.status()).toBe(404);
  await expect(pub.getByText("This link is invalid or no longer active")).toBeVisible();
  await visitor.close();
});

test("custom address: set it, visit as a visitor, wallets have their own URLs", async ({
  page,
  browser,
}) => {
  const handle = `e2e-${user.id.slice(0, 8)}`;
  await signIn(page, user);
  await page.goto("/settings/sharing");
  await page.getByRole("button", { name: "Turn on public portfolio" }).click();
  const randomLink = await page.getByLabel("Public link").inputValue();

  await page.getByLabel("Address").fill("Bad_Name");
  await page.getByRole("button", { name: "Save", exact: true }).last().click();
  await expect(page.getByText("Use only lowercase letters, numbers and hyphens.")).toBeVisible();
  await page.getByLabel("Address").fill(handle);
  await page.getByRole("button", { name: "Save", exact: true }).last().click();
  await expect(page.getByText("Address saved.")).toBeVisible();
  // One link: the custom address replaces the random one.
  await expect(page.getByLabel("Public link")).toHaveValue(new RegExp(`/u/${handle}$`));
  await expect(page.getByRole("button", { name: "New link" })).toHaveCount(0);

  const visitor = await browser.newContext();
  const pub = await visitor.newPage();
  expect((await pub.goto(randomLink))?.status()).toBe(404);
  await pub.goto(`/u/${handle}`);
  await expect(pub.getByRole("heading", { level: 1, name: user.displayName })).toBeVisible();
  await expect(pub.getByText("E2E Public Badge")).toBeVisible();
  await expect(pub.getByText("E2E Hidden Badge")).toHaveCount(0);
  const html = await pub.content();
  expect(html).not.toMatch(/\/p\/[0-9A-Za-z]{22}/); // the random link isn't revealed
  await expectAccessible(pub, "custom address portfolio");

  // Wallet tabs change the URL, and Back switches tabs.
  await pub.getByRole("tab", { name: /Skills Wallet/ }).click();
  await expect(pub).toHaveURL(new RegExp(`/u/${handle}/skills$`));
  await pub.goBack();
  await expect(pub).toHaveURL(new RegExp(`/u/${handle}$`));
  await expect(pub.getByRole("tab", { name: /Badge Wallet/ })).toHaveAttribute("aria-selected", "true");
  await pub.goto(`/u/${handle}/skills`);
  await expect(pub.getByRole("tab", { name: /Skills Wallet/ })).toHaveAttribute("aria-selected", "true");

  await pub.goto(`/u/${handle}`);
  await pub.getByRole("link", { name: "View credential" }).click();
  await expect(pub).toHaveURL(new RegExp(`/u/${handle}/badges/[0-9a-f]{32}$`));
  await expect(pub.getByRole("heading", { name: "E2E Public Badge" })).toBeVisible();

  // Removing the address gives a new random link; the old one stays dead.
  await page.getByRole("button", { name: "Remove" }).click();
  await expect(page.getByText("Custom address removed. You have a new random link.")).toBeVisible();
  const newLink = await page.getByLabel("Public link").inputValue();
  expect(newLink).toMatch(/\/p\/[0-9A-Za-z]{22}$/);
  expect(newLink).not.toBe(randomLink);
  await expect(page.getByRole("button", { name: "New link" })).toBeVisible();
  expect((await pub.goto(`/u/${handle}`))?.status()).toBe(404);
  expect((await pub.goto(randomLink))?.status()).toBe(404);
  expect((await pub.goto(newLink))?.status()).toBe(200);

  // Back on the custom address, turning the portfolio off disables it.
  await page.getByLabel("Address").fill(handle);
  await page.getByRole("button", { name: "Save", exact: true }).last().click();
  await expect(page.getByText("Address saved.")).toBeVisible();
  expect((await pub.goto(`/u/${handle}`))?.status()).toBe(200);
  await page.getByRole("button", { name: "Turn off link" }).click();
  await expect(page.getByRole("button", { name: "Turn on public portfolio" })).toBeVisible();
  expect((await pub.goto(`/u/${handle}`))?.status()).toBe(404);
  expect((await pub.goto(`/u/${handle}/skills`))?.status()).toBe(404);
  await visitor.close();
});

test("single badge link for a hidden badge, then turn it off", async ({ page, browser }) => {
  await signIn(page, user);
  await page.goto("/certificates");
  await page.getByRole("button", { name: "E2E Hidden Badge", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Badge Details" });
  await dialog.getByRole("button", { name: "Share Badge" }).click();
  await expect(dialog.getByText(/hidden from your portfolio/)).toBeVisible();
  await dialog.getByRole("button", { name: "Create public link" }).click();
  const link = await dialog.getByLabel("Public link").inputValue();
  expect(link).toMatch(/\/b\/[0-9A-Za-z]{22}$/);
  await expect(dialog.getByRole("link", { name: "Add to LinkedIn profile" })).toHaveAttribute(
    "href",
    /linkedin\.com\/profile\/add\?startTask=CERTIFICATION_NAME/,
  );
  await expectAccessible(page, "share panel");

  const visitor = await browser.newContext();
  const pub = await visitor.newPage();
  await pub.goto(link);
  await expect(pub.getByRole("heading", { name: "E2E Hidden Badge" })).toBeVisible();

  await dialog.getByText("Link settings").click();
  await dialog.getByRole("button", { name: "Turn off link" }).click();
  await expect(dialog.getByRole("button", { name: "Create public link" })).toBeVisible();
  expect((await pub.goto(link))?.status()).toBe(404);
  await visitor.close();
});
