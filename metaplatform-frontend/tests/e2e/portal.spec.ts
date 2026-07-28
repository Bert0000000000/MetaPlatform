import { test, expect } from "@playwright/test";

test.describe("Portal - auth & home", () => {
  test("home page renders", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Mate|Portal/);
  });

  test("login page accessible", async ({ page }) => {
    await page.goto("/login");
    const heading = page.getByRole("heading");
    await expect(heading).toBeVisible();
  });
});