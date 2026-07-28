import { describe, it, expect } from "vitest";
import { should_mock } from "../src/modes.js";

describe("API_MODE router", () => {
  it("mock mode returns true for all paths", () => {
    expect(should_mock("/api/v1/foo", "mock")).toBe(true);
    expect(should_mock("/api/v1/bar/baz", "mock")).toBe(true);
  });
  it("live mode returns false for all paths", () => {
    expect(should_mock("/api/v1/foo", "live")).toBe(false);
    expect(should_mock("/api/v1/bar/baz", "live")).toBe(false);
  });
  it("hybrid mode: GET uses mock, mutations use live", () => {
    expect(should_mock("/api/v1/kb/knowledge-bases", "hybrid")).toBe(true);
    expect(should_mock("/api/v1/iam/api/users", "hybrid")).toBe(false);
  });
});