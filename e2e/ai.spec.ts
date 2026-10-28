import { adminClient } from "../tests/helpers";
import { createUser, deleteUser, expect, expectAccessible, signIn, test, type E2EUser } from "./fixtures";

// Uses the test-only mock provider (AI_PROVIDER=mock, CERTNEST_E2E=true).

let user: E2EUser;
let certificateId: string;

test.beforeEach(async () => {
  user = await createUser("ai");
  const { data, error } = await adminClient()
    .from("certificates")
    .insert({
      user_id: user.id,
      title: "E2E AI Badge",
      issuer_name: "E2E Org",
      description: "A course used by the AI test.",
      expiration_status: "unknown",
    })
    .select("id")
    .single();
  if (error) throw error;
  certificateId = data.id;
});

test.afterEach(async () => {
  await deleteUser(user);
});

test("fill a new certificate from its file, check and save", async ({ page }) => {
  await signIn(page, user);
  await page.goto("/certificates/new");
  await expect(page.getByRole("button", { name: "Fill from file" })).toHaveCount(0);
  await page.getByLabel("Badge title").fill("Typed title");

  await page.getByLabel("Certificate file (optional)").setInputFiles({
    name: "certificate.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\n%test\n"),
  });
  await expect(page.getByText("10 of 10 AI requests left this hour").first()).toBeVisible();
  await page.getByRole("button", { name: "Fill from file" }).click();
  await expect(page.getByText("Filled 6 fields. Please check them before saving.")).toBeVisible();
  await expect(page.getByText("9 of 10 AI requests left this hour").first()).toBeVisible();

  // AI values replace what was typed; each one is marked.
  await expect(page.getByLabel("Badge title")).toHaveValue("Mock Extracted Certificate");
  await expect(page.getByLabel("Issuing organization")).toHaveValue("Mock Issuer");
  await expect(page.getByLabel("Issue date (optional)")).toHaveValue("2025-01-15");
  await expect(page.getByLabel("Skills (optional)")).toHaveValue("Testing, Automation");
  await expect(page.getByText("Suggested by AI, please check")).toHaveCount(6);
  await expectAccessible(page, "form after Fill from file");

  // Editing a field makes it the user's own.
  await page.getByLabel("Credential ID (optional)").fill("MY-OWN-ID");
  await expect(page.getByText("Suggested by AI, please check")).toHaveCount(5);

  await page.getByRole("button", { name: "Add certificate" }).click();
  await expect(page).toHaveURL(/\/certificates$/);
  const { data } = await adminClient()
    .from("certificates")
    .select("title, credential_id, field_sources")
    .eq("user_id", user.id)
    .eq("title", "Mock Extracted Certificate")
    .single();
  expect(data?.credential_id).toBe("MY-OWN-ID");
  expect(data?.field_sources).toMatchObject({
    title: "ai_suggested",
    issuer_name: "ai_suggested",
    credential_id: "user",
    skills: "ai_suggested",
  });

  // It shares the hourly limit with post drafts.
  await page.goto(`/certificates/${certificateId}`);
  await expect(page.getByText("9 of 10 AI requests left this hour")).toBeVisible();
});

test("Suggest with AI only fills empty description and skills", async ({ page }) => {
  await signIn(page, user);
  await page.goto("/certificates/new");
  const suggest = page.getByRole("button", { name: "Suggest with AI" });
  await expect(suggest).toBeDisabled();

  await page.getByLabel("Badge title").fill("Intro to Testing");
  await page.getByLabel("Issuing organization").fill("Test Org");
  await page.getByLabel("Skills (optional)").fill("My Own Skill");
  await suggest.click();
  await expect(page.getByText("Drafted by AI from the title and organization.")).toBeVisible();
  await expect(page.getByText("9 of 10 AI requests left this hour")).toBeVisible();

  await expect(page.getByLabel("Description (optional)")).toHaveValue(
    "[Test draft] A course about Intro to Testing.",
  );
  await expect(page.getByLabel("Skills (optional)")).toHaveValue("My Own Skill");
  await expect(page.getByText("Written by AI, not from your certificate")).toHaveCount(1);
  await expect(suggest).toBeDisabled();
  await expectAccessible(page, "form after Suggest with AI");

  await page.getByRole("button", { name: "Add certificate" }).click();
  await expect(page).toHaveURL(/\/certificates$/);
  const { data } = await adminClient()
    .from("certificates")
    .select("field_sources")
    .eq("user_id", user.id)
    .eq("title", "Intro to Testing")
    .single();
  expect(data?.field_sources).toEqual({
    title: "user",
    issuer_name: "user",
    description: "ai_generated",
    skills: "user",
  });
});

test("draft, edit, save and reload a LinkedIn post", async ({ page }) => {
  await signIn(page, user);
  await page.goto(`/certificates/${certificateId}`);
  await expect(page.getByText("10 of 10 AI requests left this hour")).toBeVisible();
  await expectAccessible(page, "badge page with AI panel");

  await page.getByRole("button", { name: "Write with AI" }).click();
  const post = page.getByRole("textbox", { name: "LinkedIn post" });
  await expect(post).toHaveValue(/\[Test draft\] I completed E2E AI Badge\./);
  await expect(page.getByText("9 of 10 AI requests left this hour")).toBeVisible();

  await post.fill("My edited post about E2E AI Badge.");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("button", { name: "Saved" })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("textbox", { name: "LinkedIn post" })).toHaveValue(
    "My edited post about E2E AI Badge.",
  );
});
