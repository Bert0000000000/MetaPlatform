import { test, expect } from "@playwright/test";

test.describe("Ontology Data Center operations", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("mate_platform_token", "e2e-token");
      localStorage.setItem("mate_platform_user", JSON.stringify({ id: "e2e-user", username: "e2e", tenantId: "tenant-default", roles: ["admin"] }));
    });
    page.on("dialog", async (dialog) => {
      throw new Error("Unexpected blocking dialog: " + dialog.message());
    });
  });

  test("BigDataSourceView surfaces 500 errors instead of mock data", async ({ page }) => {
    await page.route("**/api/v1/data/sources", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ message: "tech-kb unavailable" }),
      });
    });
    await page.goto("/ontology/datacenter?tab=bigdata");
    await page.waitForTimeout(500);
    await expect(page.locator("table")).toHaveCount(0);
  });

  test("SchedulerView does not expose a placeholder create button", async ({ page }) => {
    await page.route("**/api/v1/scheduler/tasks**", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    });
    await page.goto("/ontology/datacenter?tab=scheduler");
    await expect(page.getByRole("button", { name: /PLACEHOLDER_NEW_SCHEDULER/ })).toHaveCount(0);
    await expect(page.getByText(/placeholder|coming soon/i)).toHaveCount(0);
  });
});
