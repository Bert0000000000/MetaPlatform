// GOVERN-08 DW routing closure — static verification.
//
// Validates that the 9 DW API consumer routes wired into App.tsx in
// GOVERN-08-01 resolve at build time: their lazy imports compile,
// and the route paths declared in App.tsx match the page files on
// disk. The dev server is not started — this is a CI-friendly
// compile-time gate that runs alongside `pnpm typecheck`.

import { test, expect } from '@playwright/test';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const FRONTEND_ROOT = join(__dirname, '..', '..', '..');
const APP_TSX = join(FRONTEND_ROOT, 'apps', 'web', 'src', 'App.tsx');
const PAGES_DIR = join(FRONTEND_ROOT, 'apps', 'web', 'src', 'pages', 'dw');

const ROUTES = [
  { route: '/dw/employees', page: 'EmployeesPage' },
  { route: '/dw/evaluations', page: 'EvaluationsPage' },
  { route: '/dw/collaborations', page: 'CollaborationsPage' },
  { route: '/dw/a2a', page: 'A2APage' },
  { route: '/dw/tasks', page: 'TasksPage' },
  { route: '/dw/learning', page: 'LearningPage' },
  { route: '/dw/documents', page: 'DocumentsPage' },
  { route: '/dw/extraction', page: 'ExtractionPage' },
  { route: '/dw/obs', page: 'ObsPage' },
];

test.describe('GOVERN-08 DW routing closure (static)', () => {
  test('App.tsx declares all 9 /dw/* routes', () => {
    const app = readFileSync(APP_TSX, 'utf8');
    for (const { route } of ROUTES) {
      // React Router v7 child routes are relative to the parent <Route path="/">,
      // so we match `path="dw/..."` (no leading slash) in App.tsx.
      const stripped = route.replace(/^\//, '');
      expect(app, `App.tsx missing route ${route}`).toContain(`path="${stripped}"`);
    }
  });

  test('App.tsx lazy-imports all 9 DW pages', () => {
    const app = readFileSync(APP_TSX, 'utf8');
    for (const { page } of ROUTES) {
      const importPath = `./pages/dw/${page}`;
      expect(app, `App.tsx missing lazy import for ${page}`).toContain(importPath);
    }
  });

  test('All 9 DW page files exist on disk', () => {
    for (const { page } of ROUTES) {
      const path = join(PAGES_DIR, `${page}.tsx`);
      expect(existsSync(path), `DW page missing: ${path}`).toBeTruthy();
    }
  });

  test('orphan pages/admin/__AdminLayout.tsx is deleted', () => {
    const orphan = join(FRONTEND_ROOT, 'apps', 'web', 'src', 'pages', 'admin', '__AdminLayout.tsx');
    expect(existsSync(orphan), 'orphan __AdminLayout.tsx still present').toBeFalsy();
  });

  test('apps/web/package.json declares openapi:gen script', () => {
    const pkg = JSON.parse(
      readFileSync(join(FRONTEND_ROOT, 'apps', 'web', 'package.json'), 'utf8'),
    );
    expect(pkg.scripts?.['openapi:gen']).toBeTruthy();
    expect(pkg.devDependencies?.['openapi-typescript']).toBeTruthy();
  });
});