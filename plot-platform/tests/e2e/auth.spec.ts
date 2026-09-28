import { expect, test } from "@playwright/test";

// Requires NEXT_PUBLIC_SUPABASE_URL/ANON_KEY to be set (CI provides the demo
// project's public values); skipped otherwise since the proxy fails open
// without them (see lib/db/supabase/middleware.ts) and there is nothing to
// gate locally.
test.skip(
  !process.env.NEXT_PUBLIC_SUPABASE_URL,
  "Supabase not configured for this run",
);

test("an anonymous visitor is redirected from /dashboard to /login", async ({
  page,
}) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard/);
});

test("login page renders the sign-in form", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
});

test("signup page renders the create-account form", async ({ page }) => {
  await page.goto("/signup");
  await expect(
    page.getByRole("heading", { name: "Create your account" }),
  ).toBeVisible();
  await expect(page.getByLabel("Company name")).toBeVisible();
});
