import fs from 'node:fs';
import path from 'node:path';
import type { FullConfig, Reporter, Suite } from '@playwright/test/reporter';

// Built-in JSON serializes webServer.env. The collection artifact needs only
// test identities, never inherited process environment or authentication data.
export default class MigrationListReporter implements Reporter {
  onBegin(_config: FullConfig, suite: Suite): void {
    const specs = suite.allTests().map((test) => ({
      file: path.basename(test.location.file),
      title: test.title,
      line: test.location.line,
      tests: [{ projectName: test.parent.project()?.name }],
    }));
    fs.mkdirSync('test-results', { recursive: true });
    fs.writeFileSync('test-results/migration-list.json', JSON.stringify({ suites: [{ specs }] }, null, 2));
    console.log(`Collected ${specs.length} migration browser cases`);
  }
}
