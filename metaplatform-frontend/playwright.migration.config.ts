import { defineConfig, devices } from '@playwright/test';
import core from './playwright.config';

// The app's migration spec is outside the root core testDir. Keep this explicit
// and independent of auth-setup; the spec logs in through the real IAM helper.
export default defineConfig({
  ...core,
  testDir: './apps/web/tests/e2e',
  testMatch: 'ontology-migration-plan.spec.ts',
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report/migration' }],
    ['junit', { outputFile: 'test-results/migration.xml' }],
  ],
  outputDir: 'test-results/migration-artifacts',
  use: {
    ...core.use,
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [{ name: 'ontology-migration', use: { ...devices['Desktop Chrome'] } }],
});
