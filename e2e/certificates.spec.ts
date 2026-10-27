import {
  createUser,
  deleteUser,
  expect,
  expectAccessible,
  jpegFile,
  pdfFile,
  signIn,
  test,
  type E2EUser,
} from "./fixtures";

let user: E2EUser;

test.beforeEach(async () => {
  user = await createUser("certs");
});

test.afterEach(async () => {
  await deleteUser(user);
});

test("add, find, view, edit and delete a certificate", async ({ page, isMobile }) => {
  await signIn(page, user);

  // Add with an original PDF and a badge image.
  await page.goto("/certificates/new");
  await page.getByLabel("Badge title").fill("E2E Cloud Fundamentals");
  await page.getByLabel("Issuing organization").fill("E2E Academy");
  await page.getByLabel("Description (optional)").fill("Covers cloud basics.");
  await page.getByLabel("Skills (optional)").fill("Cloud, Networking");
  await page.getByLabel("Credential ID (optional)").fill("E2E-ID-42");
  await page.getByLabel("Does not expire").check();
  await page.locator("#original").setInputFiles(pdfFile());
  await expect(page.getByText("certificate.pdf")).toBeVisible();
  await page.locator("#badge").setInputFiles(await jpegFile());
  await expectAccessible(page, "add certificate form");
  await page.getByRole("button", { name: "Add certificate" }).click();
  await expect(page).toHaveURL(/\/certificates$/);

  // Library: card with status, and search.
  const title = page.getByRole("button", { name: "E2E Cloud Fundamentals", exact: true });
  await expect(title).toBeVisible();
  await expect(page.getByText("Does not expire").first()).toBeVisible();
  await expectAccessible(page, "certificate library");
  await page.getByLabel("Search by title").fill("nothing like this");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page.getByText("No certificates match")).toBeVisible();
  await page.getByRole("link", { name: "Clear search" }).click();

  // Badge Details dialog; Escape closes it and returns focus.
  await title.click();
  const dialog = page.getByRole("dialog", { name: "Badge Details" });
  await expect(dialog.getByRole("heading", { name: "E2E Cloud Fundamentals" })).toBeVisible();
  await expect(dialog.getByText("E2E-ID-42")).toBeVisible();
  await expect(dialog.getByText("certificate.pdf")).toBeVisible();
  await expect(dialog.getByText(/verified/i)).toHaveCount(0);
  await expectAccessible(page, "badge details dialog");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  if (!isMobile) await expect(title).toBeFocused();

  // Edit via the card menu, and remove the uploaded file.
  await page.getByRole("button", { name: "Actions for E2E Cloud Fundamentals" }).click();
  await page.getByRole("menuitem", { name: "Edit" }).click();
  await expect(page).toHaveURL(/\/edit$/);
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Remove certificate.pdf" }).click();
  await expect(page.getByRole("button", { name: "Remove certificate.pdf" })).toHaveCount(0);
  await page.getByLabel("Badge title").fill("E2E Cloud Fundamentals II");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page).toHaveURL(/\/certificates$/);
  await expect(
    page.getByRole("button", { name: "E2E Cloud Fundamentals II", exact: true }),
  ).toBeVisible();

  // Delete via the card menu.
  await page.getByRole("button", { name: "Actions for E2E Cloud Fundamentals II" }).click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText("No certificates yet")).toBeVisible();
});

test("form validation explains what to fix", async ({ page }) => {
  await signIn(page, user);
  await page.goto("/certificates/new");
  await page.getByLabel("Badge title").fill("Validation test");
  await page.getByLabel("Issuing organization").fill("Org");
  await page.getByLabel("Credential URL (optional)").fill("javascript:alert(1)");
  await page.getByLabel("Expires on a date").check();
  await page.getByRole("button", { name: "Add certificate" }).click();
  await expect(page.getByText("Credential URL must start with http:// or https://.")).toBeVisible();
  await expect(page.getByLabel("Credential URL (optional)")).toHaveAttribute("aria-invalid", "true");

  // Cross-field checks (expiration) run once single fields are valid.
  await page.getByLabel("Credential URL (optional)").fill("https://example.com/badge");
  await page.getByRole("button", { name: "Add certificate" }).click();
  await expect(page.getByText(/Add an expiration date/)).toBeVisible();
  await expect(page).toHaveURL(/\/certificates\/new$/);
});

test("other people's certificates and unknown pages show Page not found", async ({ page }) => {
  await signIn(page, user);
  const res = await page.goto("/certificates/00000000-0000-0000-0000-000000000000");
  await expect(page.getByText("Page not found")).toBeVisible();
  expect(res?.status()).toBe(200); // streamed page; content is the not-found UI
  await page.goto("/this-page-does-not-exist");
  await expect(page.getByText("Page not found")).toBeVisible();
  await expectAccessible(page, "not found");
});
