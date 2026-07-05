/**
 * Quality Automation Module
 *
 * Provides automated testing framework integration with test suite execution,
 * report generation, and scheduled test runs.
 *
 * @module integrations/quality
 */

const QUALITY_API_URL = process.env.QUALITY_API_URL || '';
const QUALITY_API_KEY = process.env.QUALITY_API_KEY || '';

/** In-memory test results store */
const testResults = new Map();

/** Scheduled test jobs */
const scheduledJobs = new Map();

/**
 * Check if quality automation service is configured
 * @returns {boolean}
 */
function isConfigured() {
  return Boolean(QUALITY_API_URL);
}

/**
 * Create a stub method that logs a message and returns null
 * @param {string} methodName
 * @returns {Function}
 */
function stub(methodName) {
  return (...args) => {
    console.warn(`[Quality] ${methodName}: Service not configured (QUALITY_API_URL is not set). Args:`, JSON.stringify(args.slice(0, 2)));
    return null;
  };
}

/**
 * Generate a mock test result for a single test case
 * @param {string} testCaseId
 * @returns {object}
 */
function generateMockResult(testCaseId) {
  const pass = Math.random() > 0.15; // 85% pass rate
  return {
    testCaseId,
    status: pass ? 'passed' : 'failed',
    duration: Math.round(Math.random() * 5000 + 100),
    assertions: Math.floor(Math.random() * 20) + 1,
    passedAssertions: pass ? Math.floor(Math.random() * 20) + 1 : Math.floor(Math.random() * 15),
    error: pass ? null : `AssertionError: Expected value to match at line ${Math.floor(Math.random() * 100)}`,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Run a test suite by test case IDs
 *
 * @param {string[]} testCaseIds - Array of test case IDs to run
 * @returns {Promise<object|null>} Test suite results or null
 */
async function runTestSuite(testCaseIds) {
  if (!isConfigured()) {
    // Provide stub/mock execution
    console.warn('[Quality] runTestSuite: Service not configured, returning mock results');

    const runId = `run-${Date.now()}`;
    const results = testCaseIds.map((id) => generateMockResult(id));
    const passed = results.filter((r) => r.status === 'passed').length;
    const failed = results.filter((r) => r.status === 'failed').length;
    const totalDuration = results.reduce((s, r) => s + r.duration, 0);

    const suiteResult = {
      runId,
      status: failed > 0 ? 'failed' : 'passed',
      total: results.length,
      passed,
      failed,
      skipped: 0,
      passRate: Math.round((passed / results.length) * 100 * 10) / 10,
      totalDuration,
      averageDuration: Math.round(totalDuration / results.length),
      results,
      environment: 'mock',
      createdAt: new Date().toISOString(),
    };

    testResults.set(runId, suiteResult);
    return suiteResult;
  }

  try {
    const response = await fetch(`${QUALITY_API_URL}/test-suites/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(QUALITY_API_KEY ? { Authorization: `Bearer ${QUALITY_API_KEY}` } : {}),
      },
      body: JSON.stringify({ testCaseIds }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`Quality API error: HTTP ${response.status} - ${text}`);
    }

    const result = await response.json();
    testResults.set(result.runId, result);
    return result;
  } catch (err) {
    console.error('[Quality] runTestSuite error:', err.message);
    throw err;
  }
}

/**
 * Generate a test report from results
 *
 * @param {object} results - Test suite results (from runTestSuite)
 * @returns {Promise<object|null>} Formatted test report or null
 */
async function generateReport(results) {
  if (!results) {
    console.warn('[Quality] generateReport: No results provided');
    return null;
  }

  const report = {
    title: `Test Execution Report - ${results.runId || 'Unknown'}`,
    summary: {
      status: results.status || 'unknown',
      total: results.total || 0,
      passed: results.passed || 0,
      failed: results.failed || 0,
      skipped: results.skipped || 0,
      passRate: results.passRate || 0,
      totalDuration: results.totalDuration || 0,
      averageDuration: results.averageDuration || 0,
    },
    environment: results.environment || 'unknown',
    generatedAt: new Date().toISOString(),

    sections: [],

    markdown: '', // Will be populated below
  };

  // Build failure details section
  const failures = (results.results || []).filter((r) => r.status === 'failed');
  if (failures.length > 0) {
    report.sections.push({
      title: 'Failure Details',
      type: 'failures',
      items: failures.map((f) => ({
        testCase: f.testCaseId,
        error: f.error,
        duration: f.duration,
      })),
    });
  }

  // Build performance section
  const durations = (results.results || []).map((r) => r.duration).sort((a, b) => a - b);
  if (durations.length > 0) {
    report.sections.push({
      title: 'Performance Analysis',
      type: 'performance',
      items: [
        { metric: 'Min Duration', value: `${durations[0]}ms` },
        { metric: 'Max Duration', value: `${durations[durations.length - 1]}ms` },
        { metric: 'Median Duration', value: `${durations[Math.floor(durations.length / 2)]}ms` },
        { metric: 'P95 Duration', value: `${durations[Math.floor(durations.length * 0.95)]}ms` },
      ],
    });
  }

  // Generate Markdown report
  const lines = [];
  lines.push(`# ${report.title}`);
  lines.push('');
  lines.push(`**Status:** ${report.summary.status.toUpperCase()}`);
  lines.push(`**Generated:** ${report.generatedAt}`);
  lines.push(`**Environment:** ${report.environment}`);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Total Tests | ${report.summary.total} |`);
  lines.push(`| Passed | ${report.summary.passed} |`);
  lines.push(`| Failed | ${report.summary.failed} |`);
  lines.push(`| Pass Rate | ${report.summary.passRate}% |`);
  lines.push(`| Total Duration | ${report.summary.totalDuration}ms |`);
  lines.push('');

  if (failures.length > 0) {
    lines.push('## Failures');
    lines.push('');
    for (const f of failures) {
      lines.push(`- **${f.testCaseId}** (${f.duration}ms): ${f.error}`);
    }
    lines.push('');
  }

  report.markdown = lines.join('\n');

  return report;
}

/**
 * Schedule test runs using cron expression
 *
 * Note: This creates an in-memory schedule. In production, use a proper
 * job scheduler like node-cron or Bull queue.
 *
 * @param {string} cronExpression - Cron expression (e.g., "0 2 * * *" for daily at 2am)
 * @param {object} [options] - Schedule options
 * @param {string[]} [options.testCaseIds] - Test case IDs to run
 * @param {string} [options.name] - Schedule name
 * @returns {Promise<object|null>} Schedule confirmation or null
 */
async function scheduleTests(cronExpression, options = {}) {
  if (!isConfigured()) {
    // Provide stub scheduling
    const scheduleId = `sched-${Date.now()}`;
    console.warn(`[Quality] scheduleTests: Service not configured, creating mock schedule '${scheduleId}'`);

    const schedule = {
      scheduleId,
      name: options.name || `Scheduled Test Run`,
      cron: cronExpression,
      testCaseIds: options.testCaseIds || [],
      status: 'active',
      createdAt: new Date().toISOString(),
      nextRun: 'Not scheduled (service not configured)',
    };

    scheduledJobs.set(scheduleId, schedule);
    return schedule;
  }

  try {
    const response = await fetch(`${QUALITY_API_URL}/schedules`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(QUALITY_API_KEY ? { Authorization: `Bearer ${QUALITY_API_KEY}` } : {}),
      },
      body: JSON.stringify({
        cron: cronExpression,
        name: options.name || 'Scheduled Test Run',
        testCaseIds: options.testCaseIds || [],
      }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`Quality API error: HTTP ${response.status} - ${text}`);
    }

    const result = await response.json();
    scheduledJobs.set(result.scheduleId, result);
    return result;
  } catch (err) {
    console.error('[Quality] scheduleTests error:', err.message);
    throw err;
  }
}

module.exports = { runTestSuite, generateReport, scheduleTests };
