import fs from 'node:fs';
import path from 'node:path';
import type { FullConfig, Reporter, Suite, TestCase, TestResult } from '@playwright/test/reporter';
const escape = (text: string) => text.replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]!));
export default class BuilderSafeReporter implements Reporter {
  private cases: Array<{ file: string; title: string; status: string; duration: number; loginStatuses: string[] }> = [];
  onBegin(_config: FullConfig, suite: Suite) {
    fs.mkdirSync('test-results', { recursive: true });
    fs.writeFileSync('test-results/builder-list.json', JSON.stringify({ cases: suite.allTests().map(t => ({ file: path.basename(t.location.file), title: t.title, project: t.parent.project()?.name })) }, null, 2));
  }
  onTestEnd(test: TestCase, result: TestResult) { this.cases.push({ file: path.basename(test.location.file), title: test.title, status: result.status, duration: result.duration, loginStatuses: test.annotations.filter(a => a.type === 'provider-login-http').map(a => a.description ?? '') }); }
  onEnd() {
    if (!this.cases.length) return;
    const failed = this.cases.filter(c => c.status !== 'passed' && c.status !== 'skipped').length;
    const skipped = this.cases.filter(c => c.status === 'skipped').length;
    fs.writeFileSync('test-results/builder-results.json', JSON.stringify({ cases: this.cases }, null, 2));
    fs.writeFileSync('test-results/builder.xml', `<testsuites><testsuite name="builder-v2" tests="${this.cases.length}" failures="${failed}" skipped="${skipped}">${this.cases.map(c => `<testcase classname="${escape(c.file)}" name="${escape(c.title)}" time="${c.duration / 1000}">${c.status === 'passed' ? '' : c.status === 'skipped' ? '<skipped/>' : '<failure message="Case failed; inspect private local output"/>'}</testcase>`).join('')}</testsuite></testsuites>`);
  }
}
