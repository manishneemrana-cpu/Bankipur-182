import { expect, test } from "@playwright/test";

import { MIN_MOBILE_WIDTH_PX } from "../../lib/constants";

test("home page renders", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("health endpoint reports status without leaking values", async ({
  request,
}) => {
  const res = await request.get("/api/health");
  expect(res.ok()).toBe(true);
  const body = await res.json();
  expect(body.status).toBe("ok");
  for (const value of Object.values(body.configured))
    expect(typeof value).toBe("boolean");
});

test("no horizontal scroll at the minimum mobile width", async ({ page }) => {
  await page.setViewportSize({ width: MIN_MOBILE_WIDTH_PX, height: 780 });
  await page.goto("/");
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test("responses do not advertise the framework", async ({ request }) => {
  const res = await request.get("/");
  expect(res.headers()["x-powered-by"]).toBeUndefined();
});
