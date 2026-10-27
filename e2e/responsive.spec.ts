import { adminClient, randomSlug } from "../tests/helpers";
import { createUser, deleteUser, expect, signIn, test, type E2EUser, type Page } from "./fixtures";

// Phones: no page may be wider than the screen (no sideways scrolling), even
// with long names. Screenshots go to test-results/ for review.

const LONG_TITLE = "Introduction to Cybersecurity Essentials and Network Defense Fundamentals";

let user: E2EUser;
let certificateId: string;
let publicId: string;
let slug: string;

test.beforeAll(async () => {
  user = await createUser("resp");
  const admin = adminClient();
  const { data, error } = await admin
    .from("certificates")
    .insert({
      user_id: user.id,
      title: LONG_TITLE,
      issuer_name: "Cisco Networking Academy",
      description: "A long description. ".repeat(20),
      credential_url: "https://example.com/a/very/long/credential/url/that/should/wrap/nicely",
      expiration_status: "never",
    })
    .select("id, public_id")
    .single();
  if (error) throw error;
  certificateId = data.id;
  publicId = data.public_id;

  slug = randomSlug();
  const share = await admin
    .from("shares")
    .insert({ user_id: user.id, scope: "portfolio", public_slug: slug });
  if (share.error) throw share.error;
});

test.afterAll(async () => {
  await deleteUser(user);
});

async function expectNoSideScroll(page: Page, name: string) {
  await page.waitForLoadState("networkidle");
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  await page.screenshot({ path: `test-results/responsive/${name}.png`, fullPage: true });
  expect(scrollWidth, `${name} is wider than the screen`).toBeLessThanOrEqual(innerWidth);
}

test("no sideways scrolling on phones", async ({ page, isMobile }) => {
  test.skip(!isMobile, "phone layout only");

  await page.goto("/login");
  await expectNoSideScroll(page, "login");

  await signIn(page, user);
  await expectNoSideScroll(page, "dashboard");

  await page.goto("/certificates");
  await expectNoSideScroll(page, "library");

  await page.goto(`/certificates/${certificateId}`);
  await expect(page.getByRole("heading", { level: 1, name: LONG_TITLE })).toBeVisible();
  await expectNoSideScroll(page, "badge-page");

  await page.goto("/certificates");
  await page.getByRole("button", { name: LONG_TITLE, exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Badge Details" });
  await dialog.getByRole("button", { name: "Share Badge" }).click();
  await expect(dialog.getByRole("heading", { name: LONG_TITLE })).toBeVisible();
  await expectNoSideScroll(page, "share-panel");
  await page.keyboard.press("Escape");

  await page.goto(`/certificates/${certificateId}/edit`);
  await expectNoSideScroll(page, "edit-form");

  await page.goto("/settings/sharing");
  await expectNoSideScroll(page, "settings");

  await page.goto(`/p/${slug}`);
  await expect(page.getByRole("tab", { name: /Badge Wallet/ })).toBeVisible();
  await expectNoSideScroll(page, "public-portfolio");

  await page.getByRole("tab", { name: /Skills Wallet/ }).click();
  await expectNoSideScroll(page, "public-skills");

  await page.goto(`/p/${slug}/${publicId}`);
  await expect(page.getByRole("heading", { name: LONG_TITLE })).toBeVisible();
  await expectNoSideScroll(page, "public-badge");
});
