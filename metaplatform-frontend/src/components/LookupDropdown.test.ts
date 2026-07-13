/**
 * v1.0.2 Sprint 2 F1.4: LookupDropdown 单测.
 *
 * <p>覆盖:
 * <ul>
 *   <li>extractLookupFields 抽取嵌套 + 扁平 lookup 配置</li>
 *   <li>indexLookupOptions 转换 API 响应为 Map</li>
 *   <li>边界: null / 空 schema / 非 lookup 字段</li>
 * </ul>
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { extractLookupFields, indexLookupOptions } from "./LookupDropdown";

describe("extractLookupFields", () => {
  it("extracts nested lookup sub-object", () => {
    const schema = {
      sections: [
        {
          fields: [
            {
              field: "customer_id",
              widget: "lookup",
              lookup: { objectId: 5, displayField: "name" },
            },
            { field: "qty", type: "number" },
          ],
        },
      ],
    };
    const result = extractLookupFields(schema);
    assert.equal(result.length, 1);
    assert.equal(result[0].field, "customer_id");
    assert.equal(result[0].objectId, "5");
    assert.equal(result[0].displayField, "name");
  });

  it("extracts flat boundObject/boundProperty (low-code designer output)", () => {
    const schema = {
      sections: [
        {
          fields: [
            { field: "supplier_ref", widget: "lookup", boundObject: "10", boundProperty: "code" },
          ],
        },
      ],
    };
    const result = extractLookupFields(schema);
    assert.equal(result.length, 1);
    assert.equal(result[0].objectId, "10");
    assert.equal(result[0].displayField, "code");
  });

  it("extracts multiple lookups across sections", () => {
    const schema = {
      sections: [
        { fields: [{ field: "a", widget: "lookup", lookup: { objectId: 1, displayField: "name" } }] },
        { fields: [{ field: "b", widget: "lookup", lookup: { objectId: 2, displayField: "code" } }] },
      ],
    };
    const result = extractLookupFields(schema);
    assert.equal(result.length, 2);
    assert.equal(result[0].field, "a");
    assert.equal(result[1].field, "b");
  });

  it("skips non-lookup fields", () => {
    const schema = {
      sections: [
        {
          fields: [
            { field: "qty", type: "number" },
            { field: "name", widget: "input" },
            { field: "ok", widget: "switch" },
          ],
        },
      ],
    };
    assert.equal(extractLookupFields(schema).length, 0);
  });

  it("returns empty for null schema", () => {
    assert.equal(extractLookupFields(null).length, 0);
    assert.equal(extractLookupFields(undefined).length, 0);
  });

  it("returns empty for empty sections", () => {
    assert.equal(extractLookupFields({ sections: [] }).length, 0);
  });

  it("returns empty for missing sections", () => {
    assert.equal(extractLookupFields({}).length, 0);
    assert.equal(extractLookupFields({ name: "Test" }).length, 0);
  });

  it("skips lookup without required sub-config", () => {
    const schema = {
      sections: [
        { fields: [{ field: "bad", widget: "lookup" }] }, // no lookup object, no boundObject
      ],
    };
    assert.equal(extractLookupFields(schema).length, 0);
  });

  it("handles direct array schema", () => {
    const schema = [
      {
        fields: [
          { field: "x", widget: "lookup", lookup: { objectId: 7, displayField: "title" } },
        ],
      },
    ];
    const result = extractLookupFields(schema);
    assert.equal(result.length, 1);
    assert.equal(result[0].objectId, "7");
  });

  it("accepts widget=lookup with mixed case", () => {
    const schema = {
      sections: [
        { fields: [{ field: "x", widget: "LOOKUP", lookup: { objectId: 1, displayField: "n" } }] },
      ],
    };
    assert.equal(extractLookupFields(schema).length, 1);
  });

  it("reads field key from key/name fallback", () => {
    const schema = {
      sections: [
        { fields: [{ key: "my_key", widget: "lookup", lookup: { objectId: 1, displayField: "n" } }] },
      ],
    };
    const result = extractLookupFields(schema);
    assert.equal(result[0].field, "my_key");
  });

  it("skips null field entry safely", () => {
    const schema = {
      sections: [{ fields: [null, { field: "x", widget: "lookup", lookup: { objectId: 1, displayField: "n" } }] }],
    };
    const result = extractLookupFields(schema);
    assert.equal(result.length, 1);
  });
});

describe("indexLookupOptions", () => {
  it("converts API response array to Map", () => {
    const response = [
      { field: "customer_id", options: [{ id: 1, label: "Alice" }, { id: 2, label: "Bob" }] },
      { field: "supplier_id", options: [{ id: 10, label: "CorpX" }] },
    ];
    const map = indexLookupOptions(response);
    assert.equal(map.size, 2);
    assert.equal(map.get("customer_id")?.length, 2);
    assert.equal(map.get("customer_id")?.[0].label, "Alice");
    assert.equal(map.get("supplier_id")?.[0].id, 10);
  });

  it("returns empty Map for empty array", () => {
    const map = indexLookupOptions([]);
    assert.equal(map.size, 0);
  });

  it("preserves empty options array", () => {
    const map = indexLookupOptions([{ field: "x", options: [] }]);
    assert.equal(map.size, 1);
    assert.deepEqual(map.get("x"), []);
  });

  it("overwrites duplicate fields with last occurrence", () => {
    const response = [
      { field: "x", options: [{ id: 1, label: "First" }] },
      { field: "x", options: [{ id: 2, label: "Second" }] },
    ];
    const map = indexLookupOptions(response);
    assert.equal(map.get("x")?.length, 1);
    assert.equal(map.get("x")?.[0].label, "Second");
  });
});