import { createUser, deleteUser, expect, expectAccessible, signIn, test, type E2EUser } from "./fixtures";

let user: E2EUser;

test.beforeAll(async () => {
  user = await createUser("auth");
});

test.afterAll(async () => {
  await deleteUser(user);
});

test("signed-out visitors are sent to the login page", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Sign in to CertNest" })).toBeVisible();
  await expectAccessible(page, "login");
});

test("wrong password shows one generic error", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill("not-the-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  // (Next.js also renders an empty role="alert" route announcer.)
  await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toHaveText(
    "Invalid email or password.",
  );
});

test("sign in, see the dashboard, sign out", async ({ page }) => {
  await signIn(page, user);
  await expect(page.getByRole("heading", { level: 1, name: user.displayName })).toBeVisible();
  await expect(page.getByText("No certificates yet")).toBeVisible();
  await expectAccessible(page, "empty dashboard");

  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login$/);
});

test("the first Tab stop skips to the main content", async ({ page, isMobile }) => {
  test.skip(isMobile, "keyboard navigation is a desktop concern");
  await signIn(page, user);
  // Fresh page load, as when a keyboard user arrives on the page.
  await page.goto("/dashboard");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to content" });
  await expect(skip).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main")).toBeFocused();
});
