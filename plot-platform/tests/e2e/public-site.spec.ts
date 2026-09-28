import { expect, test } from "@playwright/test";

// Same gate as tests/e2e/auth.spec.ts — needs a real Supabase project.
test.skip(
  !process.env.NEXT_PUBLIC_SUPABASE_URL,
  "Supabase not configured for this run",
);

// Test 1 (§21): hero + map render; live counts match DB (120 plots seeded).
test("green-valley-enclave-demo renders hero, stats and the layout map", async ({
  page,
}) => {
  await page.goto("/p/green-valley-enclave-demo");
  await expect(
    page.getByRole("heading", { name: "Green Valley Enclave (DEMO)" }),
  ).toBeVisible();
  await expect(page.getByText("DEMO DATA")).toBeVisible();
  await expect(
    page.getByRole("group", { name: "Plot layout map" }),
  ).toBeVisible();
  // 120 seeded plots -> 120 focusable plot elements in the SVG.
  await expect(
    page.locator('[role="button"][aria-label^="Plot "]'),
  ).toHaveCount(120);
});

// Test 2: tap a plot on a mobile viewport -> highlight + bottom sheet.
test("tapping a plot on mobile opens its detail sheet", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/p/green-valley-enclave-demo");
  await page.locator('[role="button"][aria-label^="Plot P-101"]').click();
  await expect(page.getByRole("heading", { name: "Plot P-101" })).toBeVisible();
});

// Test 19: no platform brand string in public HTML when "Powered by" is off
// (the seeded demo org has powered_by_visible = false).
test("no platform brand string appears in the public HTML", async ({
  request,
}) => {
  const res = await request.get("/p/green-valley-enclave-demo");
  const body = await res.text();
  expect(body).not.toContain("{{PRODUCT_NAME}}");
  expect(body).not.toContain("Powered by");
});

test("a nonexistent project slug 404s, not a crash", async ({ page }) => {
  const res = await page.goto("/p/does-not-exist-xyz");
  expect(res?.status()).toBe(404);
});
