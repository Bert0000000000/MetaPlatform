import { describe, it, expect } from "vitest";
import { scoreQuality, inferRules, listRuleTypes } from "../src/ai/quality.js";

describe("quality.scoreQuality", () => {
  it("returns score=1 for empty sample + no rules", () => {
    const r = scoreQuality([], []);
    expect(r.score).toBe(1);
    expect(r.grade).toBe("A");
    expect(r.issues).toEqual([]);
  });

  it("flags missing required fields (not_null)", () => {
    const r = scoreQuality(
      [
        { id: 1, email: "a@b.com" },
        { id: 2, email: null },
        { id: 3, email: "" },
      ],
      [{ column: "email", type: "not_null", weight: 1 }]
    );
    expect(r.score).toBeLessThan(1);
    expect(r.grade).not.toBe("A");
    expect(r.issues.length).toBeGreaterThan(0);
    expect(r.issues[0].column).toBe("email");
  });

  it("regex rule detects invalid emails", () => {
    const sample = [
      { id: 1, email: "ok@example.com" },
      { id: 2, email: "bad-no-at" },
      { id: 3, email: "ok2@example.com" },
    ];
    const r = scoreQuality(sample, [
      { column: "email", type: "regex", pattern: "^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$" },
    ]);
    expect(r.score).toBeCloseTo(2 / 3, 2);
  });

  it("range rule enforces numeric bounds", () => {
    const r = scoreQuality(
      [
        { id: 1, age: 25 },
        { id: 2, age: 17 },
        { id: 3, age: 200 },
        { id: 4, age: 40 },
      ],
      [{ column: "age", type: "range", min: 18, max: 150 }]
    );
    expect(r.results[0].failCount).toBe(2);
    expect(r.score).toBeCloseTo(0.5, 2);
  });

  it("enum rule rejects unknown values", () => {
    const r = scoreQuality(
      [{ id: 1, status: "active" }, { id: 2, status: "weird" }],
      [{ column: "status", type: "enum", values: ["active", "inactive"] }]
    );
    expect(r.results[0].failCount).toBe(1);
  });

  it("unique rule detects duplicates", () => {
    const r = scoreQuality(
      [{ id: 1, k: "a" }, { id: 2, k: "a" }, { id: 3, k: "b" }],
      [{ column: "k", type: "unique" }]
    );
    expect(r.results[0].failCount).toBe(1);
  });

  it("assigns grade A for >=0.95 score", () => {
    const r = scoreQuality(
      [
        { id: 1, e: "a@b.com" },
        { id: 2, e: "a@b.com" },
        { id: 3, e: "a@b.com" },
        { id: 4, e: "a@b.com" },
        { id: 5, e: "a@b.com" },
        { id: 6, e: "a@b.com" },
        { id: 7, e: "a@b.com" },
        { id: 8, e: "a@b.com" },
        { id: 9, e: "a@b.com" },
        { id: 10, e: "a@b.com" },
      ],
      [{ column: "e", type: "regex", pattern: "^[^@]+@[^@]+$" }]
    );
    expect(r.grade).toBe("A");
    expect(r.score).toBeGreaterThanOrEqual(0.95);
  });
});

describe("quality.inferRules", () => {
  it("infers not_null for columns with no missing values", () => {
    const sample = [
      { id: 1, email: "a@b.com", age: 25 },
      { id: 2, email: "c@d.com", age: 30 },
    ];
    const rules = inferRules(sample);
    expect(rules.find((r) => r.column === "id")).toBeDefined();
    expect(rules.find((r) => r.column === "email")).toBeDefined();
  });

  it("infers email regex for columns named *email*", () => {
    const sample = [
      { email: "a@b.com" },
      { email: "c@d.com" },
    ];
    const rules = inferRules(sample);
    const emailRule = rules.find((r) => r.column === "email" && r.type === "regex");
    expect(emailRule).toBeDefined();
  });

  it("infers range for numeric columns", () => {
    const sample = [
      { age: 20 },
      { age: 30 },
      { age: 40 },
    ];
    const rules = inferRules(sample);
    const ageRule = rules.find((r) => r.column === "age" && r.type === "range");
    expect(ageRule).toBeDefined();
    expect(ageRule.min).toBe(20);
    expect(ageRule.max).toBe(40);
  });
});

describe("quality.listRuleTypes", () => {
  it("returns all 7 rule types", () => {
    const types = listRuleTypes();
    expect(types).toContain("not_null");
    expect(types).toContain("unique");
    expect(types).toContain("regex");
    expect(types).toContain("range");
    expect(types).toContain("enum");
    expect(types).toContain("min_length");
    expect(types).toContain("max_length");
  });
});