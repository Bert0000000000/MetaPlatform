/**
 * v1.0.2 Sprint 2 F1.7+ filterSerializer 单测.
 *
 * 覆盖:
 *  - serializeFilterExpression 9 种操作符
 *  - filtersToQuery / sortToQuery 转换
 *  - toggleSort 三态 (none/asc/desc)
 *  - sortStateOf 列头箭头
 *  - buildListUrlQuery / parseListUrlQuery 双向序列化
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  serializeFilterExpression,
  filtersToQuery,
  sortToQuery,
  toggleSort,
  sortStateOf,
  buildListUrlQuery,
  parseListUrlQuery,
  parseFilterExpression,
} from "./filterSerializer";

describe("serializeFilterExpression", () => {
  it("eq -> '=value'", () => assert.equal(serializeFilterExpression("eq", "abc"), "=abc"));
  it("neq -> '!=value'", () => assert.equal(serializeFilterExpression("neq", "abc"), "!=abc"));
  it("gt -> '>value'", () => assert.equal(serializeFilterExpression("gt", "100"), ">100"));
  it("gte -> '>=value'", () => assert.equal(serializeFilterExpression("gte", "100"), ">=100"));
  it("lt -> '<value'", () => assert.equal(serializeFilterExpression("lt", "100"), "<100"));
  it("lte -> '<=value'", () => assert.equal(serializeFilterExpression("lte", "100"), "<=100"));
  it("contains -> '~value'", () => assert.equal(serializeFilterExpression("contains", "张"), "~张"));
  it("empty -> ':' regardless of value", () => assert.equal(serializeFilterExpression("empty", ""), ":"));
  it("empty with value still ':'", () => assert.equal(serializeFilterExpression("empty", "ignored"), ":"));
  it("in -> 'in(a,b,c)'", () => assert.equal(serializeFilterExpression("in", "a,b,c"), "in(a,b,c)"));
});

describe("filtersToQuery", () => {
  it("converts filter map to backend filters object", () => {
    const filters = {
      name: { field: "name", op: "contains" as const, value: "张" },
      amount: { field: "amount", op: "gte" as const, value: "100" },
      status: { field: "status", op: "eq" as const, value: "ok" },
      remark: { field: "remark", op: "empty" as const, value: "" },
    };
    const out = filtersToQuery(filters);
    assert.equal(out.name, "~张");
    assert.equal(out.amount, ">=100");
    assert.equal(out.status, "=ok");
    assert.equal(out.remark, ":");
  });

  it("empty map -> empty object", () => {
    assert.deepEqual(filtersToQuery({}), {});
  });
});

describe("sortToQuery", () => {
  it("asc -> 'field', desc -> '-field'", () => {
    assert.deepEqual(sortToQuery([{ field: "name", dir: "asc" }]), ["name"]);
    assert.deepEqual(sortToQuery([{ field: "name", dir: "desc" }]), ["-name"]);
  });
  it("multi-sort preserves order", () => {
    assert.deepEqual(
      sortToQuery([
        { field: "amount", dir: "desc" },
        { field: "name", dir: "asc" },
      ]),
      ["-amount", "name"],
    );
  });
  it("empty sort -> []", () => {
    assert.deepEqual(sortToQuery([]), []);
  });
});

describe("toggleSort", () => {
  it("undefined -> asc", () => {
    assert.deepEqual(toggleSort(undefined, "name"), [{ field: "name", dir: "asc" }]);
  });
  it("empty -> asc", () => {
    assert.deepEqual(toggleSort([], "name"), [{ field: "name", dir: "asc" }]);
  });
  it("asc -> desc", () => {
    assert.deepEqual(toggleSort([{ field: "name", dir: "asc" }], "name"), [{ field: "name", dir: "desc" }]);
  });
  it("desc -> empty (off)", () => {
    assert.deepEqual(toggleSort([{ field: "name", dir: "desc" }], "name"), []);
  });
  it("different field -> asc on new field", () => {
    assert.deepEqual(
      toggleSort([{ field: "amount", dir: "desc" }], "name"),
      [{ field: "name", dir: "asc" }],
    );
  });
});

describe("sortStateOf", () => {
  it("returns null when not in sort", () => {
    assert.equal(sortStateOf(undefined, "name"), null);
    assert.equal(sortStateOf([{ field: "amount", dir: "asc" }], "name"), null);
  });
  it("returns asc/desc for matching field", () => {
    assert.equal(sortStateOf([{ field: "name", dir: "asc" }], "name"), "asc");
    assert.equal(sortStateOf([{ field: "name", dir: "desc" }], "name"), "desc");
  });
});

describe("buildListUrlQuery + parseListUrlQuery", () => {
  it("round-trips sort + filter + page + size", () => {
    const url = buildListUrlQuery(
      [{ field: "amount", dir: "desc" }],
      { name: { field: "name", op: "contains", value: "张" } },
      3,
      50,
    );
    assert.equal(url.sort, "-amount");
    assert.equal(url.filter_name, "~张");
    assert.equal(url.page, "3");
    assert.equal(url.size, "50");

    const qs = new URLSearchParams(url as any);
    const parsed = parseListUrlQuery(qs);
    assert.deepEqual(parsed.sort, [{ field: "amount", dir: "desc" }]);
    assert.equal(parsed.filters.name.op, "contains");
    assert.equal(parsed.filters.name.value, "张");
    assert.equal(parsed.page, 3);
    assert.equal(parsed.size, 50);
  });

  it("empty sort/filter round-trips", () => {
    const url = buildListUrlQuery([], {}, 1, 20);
    assert.equal(url.sort, undefined);
    assert.equal(url.page, "1");
    assert.equal(url.size, "20");
    const qs = new URLSearchParams(url as any);
    const parsed = parseListUrlQuery(qs);
    assert.deepEqual(parsed.sort, []);
    assert.deepEqual(parsed.filters, {});
    assert.equal(parsed.page, 1);
    assert.equal(parsed.size, 20);
  });

  it("parses asc sort correctly", () => {
    const qs = new URLSearchParams("sort=name&page=2");
    const parsed = parseListUrlQuery(qs);
    assert.deepEqual(parsed.sort, [{ field: "name", dir: "asc" }]);
    assert.equal(parsed.page, 2);
  });

  it("parses empty filter syntax", () => {
    const qs = new URLSearchParams("filter_remark=:");
    const parsed = parseListUrlQuery(qs);
    assert.equal(parsed.filters.remark.op, "empty");
  });

  it("parses in(...) filter", () => {
    const qs = new URLSearchParams("filter_status=in(active,pending)");
    const parsed = parseListUrlQuery(qs);
    assert.equal(parsed.filters.status.op, "in");
    assert.equal(parsed.filters.status.value, "active,pending");
  });

  it("clamps page to min 1", () => {
    const qs = new URLSearchParams("page=0");
    const parsed = parseListUrlQuery(qs);
    assert.equal(parsed.page, 1);
  });

  it("clamps size to max 200", () => {
    const qs = new URLSearchParams("size=99999");
    const parsed = parseListUrlQuery(qs);
    assert.equal(parsed.size, 200);
  });
});

describe("parseFilterExpression", () => {
  it("parses =", () => assert.deepEqual(parseFilterExpression("=ok")?.op, "eq"));
  it("parses !=", () => assert.deepEqual(parseFilterExpression("!=x")?.op, "neq"));
  it("parses >", () => assert.deepEqual(parseFilterExpression(">10")?.op, "gt"));
  it("parses <", () => assert.deepEqual(parseFilterExpression("<100")?.op, "lt"));
  it("parses ~", () => assert.deepEqual(parseFilterExpression("~张")?.op, "contains"));
  it("parses :", () => assert.deepEqual(parseFilterExpression(":")?.op, "empty"));
  it("parses in(a,b)", () => assert.deepEqual(parseFilterExpression("in(a,b)")?.op, "in"));
  it("returns null for empty", () => assert.equal(parseFilterExpression(""), null));
});