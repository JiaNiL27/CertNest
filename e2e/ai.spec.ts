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

test("draft, edit, save and reload a LinkedIn post", async ({ page }) => {
  await signIn(page, user);
  await page.goto(`/certificates/${certificateId}`);
  await expect(page.getByText("10 of 10 AI drafts left this hour")).toBeVisible();
  await expectAccessible(page, "badge page with AI panel");

  await page.getByRole("button", { name: "Write with AI" }).click();
  const post = page.getByRole("textbox", { name: "LinkedIn post" });
  await expect(post).toHaveValue(/\[Test draft\] I completed E2E AI Badge\./);
  await expect(page.getByText("9 of 10 AI drafts left this hour")).toBeVisible();

  await post.fill("My edited post about E2E AI Badge.");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("button", { name: "Saved" })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("textbox", { name: "LinkedIn post" })).toHaveValue(
    "My edited post about E2E AI Badge.",
  );
});
