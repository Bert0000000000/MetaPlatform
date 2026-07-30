import { test, expect } from "@playwright/test";

test.describe("Portal - auth & home", () => {
  test("home page renders", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Mate|Portal/);
  });

  test("login page accessible", async ({ page }) => {
    await page.goto("/login");
    const heading = page.getByText("欢迎回来", { exact: true });
    await expect(heading).toBeVisible();
  });
});