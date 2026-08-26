import { test, expect } from "@playwright/test";

test.describe("Silent operation gaps", () => {
  test.beforeEach(async ({ page }) => {
    page.on("dialog", async (dialog) => {
      throw new Error("Unexpected blocking dialog: " + dialog.message());
    });
  });

  test.use({ storageState: 'tests/e2e/.auth/state.json' });

  test("DataGraphView keeps the page usable on rendering issues", async ({ page }) => {
    await page.goto("/ontology/datacenter?tab=datagraph");
    await expect(page.locator("h1, h2, h3, [class*=Datacenter]").first()).toBeVisible({ timeout: 10_000 });
  });

  test("Dashboard surfaces backend failure via antd message", async ({ page }) => {
    await page.route("**/api/v1/dashboard/**", async (route) => {
      await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ message: "boom" }) });
    });
    await page.goto("/dashboard");
    await expect(page.getByText(/仪表盘加载失败/).first()).toBeVisible({ timeout: 10_000 });
  });
});
