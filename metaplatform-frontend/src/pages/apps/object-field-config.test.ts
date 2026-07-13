/**
 * v1.0.2 Sprint 2 F1.1: validateFieldForm 单测.
 *
 * <p>覆盖场景:
 * <ul>
 *   <li>必填字段缺失</li>
 *   <li>字段名格式非法</li>
 *   <li>字段名重复</li>
 *   <li>lookup 类型但缺 objectId</li>
 *   <li>lookup 类型但缺 displayField</li>
 *   <li>lookup 完整配置通过</li>
 *   <li>非 lookup 类型不要求 lookup 配置</li>
 * </ul>
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_FIELD_FORM,
  FieldFormData,
  validateFieldForm,
  LOOKUP_EDIT_WARNING,
  FIELD_TYPE_LOCKED_HELPER,
  shouldShowFieldTypeHelper,
  shouldShowLookupWarning,
} from "./object-field-config";

const baseForm: FieldFormData = {
  name: "customer",
  label: "客户",
  type: "lookup",
  required: false,
  unique_field: false,
  default_value: "",
  description: "",
  lookup: { objectId: 5, displayField: "name" },
};

describe("validateFieldForm", () => {
  it("rejects empty name", () => {
    const err = validateFieldForm({ ...baseForm, name: "" }, [], null);
    assert.equal(err, "字段名和显示名均为必填");
  });

  it("rejects empty label", () => {
    const err = validateFieldForm({ ...baseForm, label: "" }, [], null);
    assert.equal(err, "字段名和显示名均为必填");
  });

  it("rejects whitespace-only name", () => {
    const err = validateFieldForm({ ...baseForm, name: "   " }, [], null);
    assert.equal(err, "字段名和显示名均为必填");
  });

  it("rejects uppercase name", () => {
    const err = validateFieldForm({ ...baseForm, name: "Customer" }, [], null);
    assert.match(err || "", /只能包含小写英文/);
  });

  it("rejects name starting with number", () => {
    const err = validateFieldForm({ ...baseForm, name: "1customer" }, [], null);
    assert.match(err || "", /只能包含小写英文/);
  });

  it("rejects name with dash", () => {
    const err = validateFieldForm({ ...baseForm, name: "my-customer" }, [], null);
    assert.match(err || "", /只能包含小写英文/);
  });

  it("rejects name with chinese", () => {
    const err = validateFieldForm({ ...baseForm, name: "客户" }, [], null);
    assert.match(err || "", /只能包含小写英文/);
  });

  it("accepts valid snake_case name", () => {
    const err = validateFieldForm({ ...baseForm, name: "my_customer_2" }, [], null);
    assert.equal(err, null);
  });

  it("rejects duplicate name (new)", () => {
    const err = validateFieldForm(
      { ...baseForm, name: "customer" },
      [{ code: "customer" }],
      null,
    );
    assert.equal(err, "字段名在当前对象下已存在");
  });

  it("allows duplicate name when editing same code", () => {
    const err = validateFieldForm(
      { ...baseForm, name: "customer" },
      [{ code: "customer" }],
      "customer",
    );
    assert.equal(err, null);
  });

  it("rejects duplicate name (different code)", () => {
    const err = validateFieldForm(
      { ...baseForm, name: "customer" },
      [{ code: "customer" }, { code: "product" }],
      "product",
    );
    assert.equal(err, "字段名在当前对象下已存在");
  });

  // ──────────────────────────────────────────────────────────
  // lookup 校验 (F1.1)
  // ──────────────────────────────────────────────────────────

  it("rejects lookup type without objectId", () => {
    const err = validateFieldForm(
      { ...baseForm, lookup: { objectId: null, displayField: "name" } },
      [],
      null,
    );
    assert.equal(err, "关联字段必须选择目标对象");
  });

  it("rejects lookup type without displayField", () => {
    const err = validateFieldForm(
      { ...baseForm, lookup: { objectId: 5, displayField: "" } },
      [],
      null,
    );
    assert.equal(err, "关联字段必须选择显示字段");
  });

  it("rejects lookup type with whitespace displayField", () => {
    const err = validateFieldForm(
      { ...baseForm, lookup: { objectId: 5, displayField: "   " } },
      [],
      null,
    );
    assert.equal(err, "关联字段必须选择显示字段");
  });

  it("accepts lookup with complete config", () => {
    const err = validateFieldForm(baseForm, [], null);
    assert.equal(err, null);
  });

  it("does not require lookup config for non-lookup type", () => {
    const formNoLookup: FieldFormData = {
      ...baseForm,
      type: "text",
      lookup: { objectId: null, displayField: "" },  // 即使没填也不报错
    };
    const err = validateFieldForm(formNoLookup, [], null);
    assert.equal(err, null);
  });

  it("does not require lookup config for number type", () => {
    const formNoLookup: FieldFormData = {
      ...baseForm,
      type: "number",
      lookup: { objectId: null, displayField: "" },
    };
    const err = validateFieldForm(formNoLookup, [], null);
    assert.equal(err, null);
  });

  it("does not require lookup config for select type", () => {
    const formNoLookup: FieldFormData = {
      ...baseForm,
      type: "select",
      lookup: { objectId: null, displayField: "" },
    };
    const err = validateFieldForm(formNoLookup, [], null);
    assert.equal(err, null);
  });
});

describe("DEFAULT_FIELD_FORM", () => {
  it("has lookup sub-config with null objectId", () => {
    assert.equal(DEFAULT_FIELD_FORM.lookup.objectId, null);
  });

  it("has lookup sub-config with empty displayField", () => {
    assert.equal(DEFAULT_FIELD_FORM.lookup.displayField, "");
  });

  it("has type=text as default", () => {
    assert.equal(DEFAULT_FIELD_FORM.type, "text");
  });
});

/**
 * v1.0.2 Sprint 2 F1.2: lookup 编辑警告 UI 助手函数.
 *
 * <p>覆盖: shouldShowFieldTypeHelper / shouldShowLookupWarning / 常量文案.
 */
describe("F1.2 lookup edit warning helpers", () => {
  describe("shouldShowFieldTypeHelper", () => {
    it("returns false when not editing", () => {
      assert.equal(shouldShowFieldTypeHelper(null, "text"), false);
    });

    it("returns true when editing a non-lookup field", () => {
      assert.equal(shouldShowFieldTypeHelper("name", "text"), true);
      assert.equal(shouldShowFieldTypeHelper("age", "number"), true);
      assert.equal(shouldShowFieldTypeHelper("status", "boolean"), true);
    });

    it("returns false when editing a lookup field (use lookup warning instead)", () => {
      assert.equal(shouldShowFieldTypeHelper("customer_id", "lookup"), false);
    });
  });

  describe("shouldShowLookupWarning", () => {
    it("returns false when not editing", () => {
      assert.equal(shouldShowLookupWarning(null, "lookup"), false);
    });

    it("returns true only when editing a lookup field", () => {
      assert.equal(shouldShowLookupWarning("customer_id", "lookup"), true);
    });

    it("returns false when editing non-lookup field", () => {
      assert.equal(shouldShowLookupWarning("name", "text"), false);
      assert.equal(shouldShowLookupWarning("qty", "number"), false);
    });
  });

  describe("LOOKUP_EDIT_WARNING content", () => {
    it("has a non-empty title", () => {
      assert.ok(LOOKUP_EDIT_WARNING.title.length > 0);
    });

    it("mentions schema change risk in body", () => {
      assert.match(LOOKUP_EDIT_WARNING.body, /DDL/);
      assert.match(LOOKUP_EDIT_WARNING.body, /BIGINT/);
      assert.match(LOOKUP_EDIT_WARNING.body, /不可修改/);
    });

    it("guides user to delete-and-recreate in action", () => {
      assert.match(LOOKUP_EDIT_WARNING.action, /删除/);
      assert.match(LOOKUP_EDIT_WARNING.action, /重建/);
    });
  });

  describe("FIELD_TYPE_LOCKED_HELPER content", () => {
    it("references AC-103.5", () => {
      assert.match(FIELD_TYPE_LOCKED_HELPER, /AC-103\.5/);
    });
  });

  describe("F1.2 mutual exclusion", () => {
    it("never shows both helpers at the same time", () => {
      // 编辑模式
      assert.equal(
        shouldShowFieldTypeHelper("f", "lookup") &&
          shouldShowLookupWarning("f", "lookup"),
        false,
        "lookup 编辑不应同时显示 type-helper 和 lookup-warning",
      );
      assert.equal(
        shouldShowFieldTypeHelper("f", "text") &&
          shouldShowLookupWarning("f", "text"),
        false,
        "text 编辑不应同时显示 type-helper 和 lookup-warning",
      );
    });
  });
});