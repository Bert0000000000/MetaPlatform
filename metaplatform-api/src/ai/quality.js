/**
 * Data Quality Engine (Phase 4 — Data Stack)
 *
 * Rule-based quality scoring for tabular datasets.
 *
 * Built-in rule types:
 *   - not_null       column must not be null
 *   - unique         column values must be unique within sample
 *   - regex          column values must match a regex pattern
 *   - range          numeric column must fall within [min, max]
 *   - enum           column value must be in a whitelist
 *   - min_length     string column must have at least N characters
 *   - max_length     string column must have at most N characters
 *
 * Each rule contributes a partial score (0..1) and a list of failed row ids.
 * Aggregate quality score = weighted average of rule pass rates.
 */

const RULE_TYPES = ["not_null", "unique", "regex", "range", "enum", "min_length", "max_length"];

function checkRule(rule, rows) {
  const fails = [];
  const seen = new Map();

  for (const row of rows) {
    const v = row[rule.column];
    const id = row.id || JSON.stringify(row).slice(0, 40);

    let pass = true;
    switch (rule.type) {
      case "not_null":
        pass = v !== null && v !== undefined && v !== "";
        break;
      case "unique":
        if (v !== null && v !== undefined) {
          if (seen.has(v)) pass = false;
          else seen.set(v, id);
        }
        break;
      case "regex":
        if (v === null || v === undefined) pass = rule.allowNull || false;
        else pass = new RegExp(rule.pattern).test(String(v));
        break;
      case "range":
        if (v === null || v === undefined) pass = rule.allowNull || false;
        else {
          const num = Number(v);
          if (Number.isNaN(num)) pass = false;
          else pass = num >= rule.min && num <= rule.max;
        }
        break;
      case "enum":
        if (v === null || v === undefined) pass = rule.allowNull || false;
        else pass = rule.values.includes(v);
        break;
      case "min_length":
        pass = (v == null ? 0 : String(v).length) >= rule.min;
        break;
      case "max_length":
        pass = (v == null ? 0 : String(v).length) <= rule.max;
        break;
      default:
        pass = true;
    }

    if (!pass) fails.push({ id, value: v });
  }

  const total = rows.length;
  const passRate = total === 0 ? 1 : (total - fails.length) / total;
  return {
    rule,
    passRate,
    passCount: total - fails.length,
    failCount: fails.length,
    total,
    sampleFails: fails.slice(0, 5),
  };
}

/**
 * Score a sample against a list of rules.
 *
 * @param {object[]} sample - Rows of data
 * @param {object[]} rules  - Rule definitions
 * @returns {object} - { score, grade, results, issues }
 */
export function scoreQuality(sample, rules) {
  if (!Array.isArray(sample)) sample = [];
  if (!Array.isArray(rules)) rules = [];

  const results = rules.map((r) => checkRule(r, sample));

  // Weighted aggregate (each rule has weight 1 unless specified)
  let weightedSum = 0;
  let weightTotal = 0;
  for (const r of results) {
    const w = r.rule.weight || 1;
    weightedSum += r.passRate * w;
    weightTotal += w;
  }
  const score = weightTotal === 0 ? 1 : weightedSum / weightTotal;

  let grade = "F";
  if (score >= 0.95) grade = "A";
  else if (score >= 0.85) grade = "B";
  else if (score >= 0.7) grade = "C";
  else if (score >= 0.5) grade = "D";

  const issues = results
    .filter((r) => r.failCount > 0)
    .map((r) => ({
      column: r.rule.column,
      rule: r.rule.type,
      severity: r.failCount / Math.max(r.total, 1) > 0.1 ? "high" : "medium",
      failCount: r.failCount,
      message: `${r.rule.type} rule failed for ${r.failCount}/${r.total} rows on column '${r.rule.column}'`,
    }));

  return {
    score: Number(score.toFixed(4)),
    grade,
    passRate: Number(score.toFixed(4)),
    sampleSize: sample.length,
    rulesEvaluated: rules.length,
    issues,
    results,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Convenience: infer basic rules from a sample (not_null for required cols,
 * regex for emails, range for numbers).
 */
export function inferRules(sample, options = {}) {
  if (!Array.isArray(sample) || sample.length === 0) return [];
  const cols = Object.keys(sample[0]);
  const rules = [];

  for (const c of cols) {
    const nonNull = sample.filter((r) => r[c] !== null && r[c] !== undefined && r[c] !== "").length;
    if (nonNull === sample.length) {
      rules.push({ column: c, type: "not_null", weight: 1 });
    }

    // Email-like column
    if (/email/i.test(c)) {
      rules.push({
        column: c,
        type: "regex",
        pattern: "^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$",
        weight: 2,
      });
    }

    // Numeric column: range from observed min/max
    const nums = sample.map((r) => Number(r[c])).filter((n) => !Number.isNaN(n));
    if (nums.length > sample.length / 2 && nums.length > 0) {
      rules.push({
        column: c,
        type: "range",
        min: Math.min(...nums),
        max: Math.max(...nums),
        allowNull: true,
        weight: 0.5,
      });
    }
  }

  return rules;
}

export function listRuleTypes() {
  return [...RULE_TYPES];
}

export default { scoreQuality, inferRules, listRuleTypes };