import { describe, it, expect } from "vitest";
import { validateSqlSafety } from "../src/ai/nl2sql.js";

describe("nl2sql.validateSqlSafety", () => {
  it("accepts a simple SELECT", () => {
    const r = validateSqlSafety("SELECT * FROM users LIMIT 10");
    expect(r.safe).toBe(true);
  });

  it("accepts a WITH (CTE) query", () => {
    const r = validateSqlSafety("WITH t AS (SELECT 1) SELECT * FROM t LIMIT 1");
    expect(r.safe).toBe(true);
  });

  it("rejects INSERT", () => {
    // INSERT is rejected — either at start_with check or forbidden_keyword check,
    // both are valid rejection paths. We just need safe=false.
    const r = validateSqlSafety("INSERT INTO users VALUES (1) LIMIT 1");
    expect(r.safe).toBe(false);
    expect(r.reason).toBeTruthy();
  });

  it("rejects DELETE", () => {
    const r = validateSqlSafety("DELETE FROM users LIMIT 1");
    expect(r.safe).toBe(false);
  });

  it("rejects UPDATE", () => {
    const r = validateSqlSafety("UPDATE users SET name='x' LIMIT 1");
    expect(r.safe).toBe(false);
  });

  it("rejects DROP", () => {
    const r = validateSqlSafety("DROP TABLE users LIMIT 1");
    expect(r.safe).toBe(false);
  });

  it("rejects ALTER (forbidden keyword in valid SQL)", () => {
    // ALTER starts with A, not SELECT — must fail at start_with check
    const r = validateSqlSafety("ALTER TABLE users ADD COLUMN x INT");
    expect(r.safe).toBe(false);
  });

  it("rejects inline forbidden keyword (DROP inside SELECT)", () => {
    // The keyword check looks at whole words; DROP not preceded by SELECT prefix
    // so this becomes "must_start_with_select_or_with" — still rejected.
    const r = validateSqlSafety("SELECT 1 FROM users WHERE DROP = 1 LIMIT 1");
    expect(r.safe).toBe(false);
  });

  it("rejects multi-statement queries", () => {
    const r = validateSqlSafety("SELECT 1 LIMIT 1; SELECT 2 LIMIT 1");
    expect(r.safe).toBe(false);
    expect(r.reason).toBe("multi_statement_not_allowed");
  });

  it("rejects queries without LIMIT", () => {
    const r = validateSqlSafety("SELECT * FROM users");
    expect(r.safe).toBe(false);
    expect(r.reason).toBe("limit_required");
    expect(r.suggestion).toContain("LIMIT");
  });

  it("rejects queries that don't start with SELECT or WITH", () => {
    const r = validateSqlSafety("EXPLAIN SELECT 1 LIMIT 1");
    expect(r.safe).toBe(false);
    expect(r.reason).toBe("must_start_with_select_or_with");
  });

  it("rejects empty SQL", () => {
    const r = validateSqlSafety("");
    expect(r.safe).toBe(false);
    expect(r.reason).toBe("empty_sql");
  });
});