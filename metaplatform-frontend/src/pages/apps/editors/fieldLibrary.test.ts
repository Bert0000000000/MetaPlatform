/**
 * v1.0.2 Sprint 2 F1.3: FIELD_LIBRARY 单测.
 *
 * <p>覆盖:
 * <ul>
 *   <li>lookup 字段类型存在</li>
 *   <li>lookup 字段在 business 类</li>
 *   <li>lookup 字段的 defaultField 完整</li>
 *   <li>createField() 可创建 lookup 字段</li>
 *   <li>lookup 字段必备 props (binding, basic, validation, layout)</li>
 * </ul>
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  FIELD_LIBRARY,
  getFieldDef,
  fieldsByCategory,
  createField,
} from "./fieldLibrary";

describe("FIELD_LIBRARY.lookup", () => {
  it("exists in library", () => {
    const def = getFieldDef("lookup");
    assert.ok(def, "lookup field definition should exist");
  });

  it("is in business category", () => {
    const def = getFieldDef("lookup");
    assert.ok(def);
    assert.equal(def.category, "business");
  });

  it("uses Link2 icon", () => {
    const def = getFieldDef("lookup");
    assert.equal(def!.icon, "Link2");
  });

  it("widget key is lookup", () => {
    const def = getFieldDef("lookup");
    assert.equal(def!.widget, "lookup");
  });

  it("defaultField produces a non-empty field", () => {
    const def = getFieldDef("lookup");
    const field = def!.defaultField();
    assert.equal(field.type, "lookup");
    assert.ok(field.label && field.label.length > 0);
    assert.equal(field.required, false);
  });

  it("includes binding props (required for target+display field)", () => {
    const def = getFieldDef("lookup");
    assert.ok(def!.props.includes("binding"));
  });

  it("includes basic + validation + layout props", () => {
    const def = getFieldDef("lookup");
    assert.ok(def!.props.includes("basic"));
    assert.ok(def!.props.includes("validation"));
    assert.ok(def!.props.includes("layout"));
  });

  it("createField() returns a fully initialized DesignerField", () => {
    const field = createField("lookup");
    assert.ok(field.id, "id should be auto-generated");
    assert.equal(field.type, "lookup");
    assert.equal(typeof field.width, "string");
    assert.equal(typeof field.required, "boolean");
  });
});

describe("FIELD_LIBRARY integrity", () => {
  it("all entries have unique type", () => {
    const types = new Set<string>();
    for (const f of FIELD_LIBRARY) {
      assert.ok(!types.has(f.type), `duplicate type: ${f.type}`);
      types.add(f.type);
    }
  });

  it("all entries have non-empty label", () => {
    for (const f of FIELD_LIBRARY) {
      assert.ok(f.label && f.label.length > 0, `empty label for ${f.type}`);
    }
  });

  it("all defaultField return objects with type", () => {
    for (const f of FIELD_LIBRARY) {
      const df = f.defaultField();
      assert.ok(df, `${f.type} defaultField should return an object`);
      assert.ok(df.type, `${f.type} defaultField.type should be defined`);
    }
  });

  it("fieldsByCategory returns lookup in business", () => {
    const business = fieldsByCategory("business");
    const types = business.map((f) => f.type);
    assert.ok(types.includes("lookup"));
    assert.ok(types.includes("reference"));
    assert.ok(types.includes("currency"));
  });

  it("createField() returns uid-based unique ids", () => {
    const a = createField("input");
    const b = createField("input");
    assert.notEqual(a.id, b.id);
  });
});