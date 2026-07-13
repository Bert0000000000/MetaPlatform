/**
 * v1.0.2 Sprint 2 F1.5+: Formily schema adapter 单测.
 *
 * <p>覆盖 widgetToComponent / widgetToSchemaType / fieldToSchema /
 * sectionsToFormilySchema / extractInitialValues / extractLookupConfigs.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  widgetToComponent,
  widgetToSchemaType,
  fieldToSchema,
  sectionsToFormilySchema,
  extractInitialValues,
  extractLookupConfigs,
  visibleWhenToExpression,
  visibleWhenToReactions,
  type VisibleWhenRule,
} from "./schemaAdapter";

describe("widgetToComponent", () => {
  it("maps text/input/string -> TextField", () => {
    assert.equal(widgetToComponent("text"), "TextField");
    assert.equal(widgetToComponent("input"), "TextField");
    assert.equal(widgetToComponent("string"), "TextField");
    assert.equal(widgetToComponent("email"), "TextField");
    assert.equal(widgetToComponent("phone"), "TextField");
    assert.equal(widgetToComponent("tel"), "TextField");
  });
  it("maps longtext/textarea -> TextareaField", () => {
    assert.equal(widgetToComponent("longtext"), "TextareaField");
    assert.equal(widgetToComponent("textarea"), "TextareaField");
    assert.equal(widgetToComponent("richtext"), "TextareaField");
  });
  it("maps number/currency/percent -> NumberField", () => {
    assert.equal(widgetToComponent("number"), "NumberField");
    assert.equal(widgetToComponent("currency"), "NumberField");
    assert.equal(widgetToComponent("percent"), "NumberField");
    assert.equal(widgetToComponent("slider"), "NumberField");
  });
  it("maps date/datetime -> DateField", () => {
    assert.equal(widgetToComponent("date"), "DateField");
    assert.equal(widgetToComponent("datetime"), "DateField");
  });
  it("maps boolean/switch -> CheckboxField", () => {
    assert.equal(widgetToComponent("boolean"), "CheckboxField");
    assert.equal(widgetToComponent("switch"), "CheckboxField");
    assert.equal(widgetToComponent("checkbox"), "CheckboxField");
  });
  it("maps select/radio -> SelectField", () => {
    assert.equal(widgetToComponent("select"), "SelectField");
    assert.equal(widgetToComponent("radio"), "SelectField");
  });
  it("maps lookup -> LookupField", () => {
    assert.equal(widgetToComponent("lookup"), "LookupField");
  });
  it("falls back to TextField for unknown types", () => {
    assert.equal(widgetToComponent(undefined), "TextField");
    assert.equal(widgetToComponent("xyz_unknown"), "TextField");
  });
  it("is case-insensitive", () => {
    assert.equal(widgetToComponent("LOOKUP"), "LookupField");
    assert.equal(widgetToComponent("NUMBER"), "NumberField");
  });
});

describe("widgetToSchemaType", () => {
  it("number-like -> number", () => {
    assert.equal(widgetToSchemaType("number"), "number");
    assert.equal(widgetToSchemaType("currency"), "number");
  });
  it("boolean-like -> boolean", () => {
    assert.equal(widgetToSchemaType("boolean"), "boolean");
    assert.equal(widgetToSchemaType("switch"), "boolean");
  });
  it("others -> string", () => {
    assert.equal(widgetToSchemaType("text"), "string");
    assert.equal(widgetToSchemaType("date"), "string");
    assert.equal(widgetToSchemaType("lookup"), "string");
  });
});

describe("fieldToSchema", () => {
  it("basic text field", () => {
    const s = fieldToSchema({ field: "name", label: "Name", widget: "text" });
    assert.equal(s.type, "string");
    assert.equal(s.title, "Name");
    assert.equal(s["x-component"], "TextField");
    assert.equal(s["x-decorator"], "FormItem");
    assert.equal(s.required, false);
  });

  it("required text field has validator", () => {
    const s = fieldToSchema({ field: "name", widget: "text", required: true });
    assert.equal(s.required, true);
    assert.ok(s["x-validator"]);
    assert.equal((s["x-validator"] as any).required, true);
  });

  it("number field maps to number type + NumberField", () => {
    const s = fieldToSchema({ field: "qty", widget: "number" });
    assert.equal(s.type, "number");
    assert.equal(s["x-component"], "NumberField");
  });

  it("select field injects options", () => {
    const s = fieldToSchema({
      field: "color", widget: "select",
      options: [{ label: "Red", value: "r" }, { label: "Blue", value: "b" }],
    });
    const props = s["x-component-props"] as any;
    assert.equal(props.options.length, 2);
    assert.equal(props.options[0].label, "Red");
  });

  it("lookup field injects objectId + displayField (nested form)", () => {
    const s = fieldToSchema({
      field: "customer_ref", widget: "lookup",
      lookup: { objectId: 5, displayField: "name" },
    });
    const props = s["x-component-props"] as any;
    assert.equal(props.objectId, 5);
    assert.equal(props.displayField, "name");
  });

  it("lookup field accepts flat boundObject/boundProperty", () => {
    const s = fieldToSchema({
      field: "supplier_ref", widget: "lookup",
      boundObject: "10", boundProperty: "code",
    });
    const props = s["x-component-props"] as any;
    assert.equal(props.objectId, "10");
    assert.equal(props.displayField, "code");
  });

  it("datetime widget sets type=datetime-local", () => {
    const s = fieldToSchema({ field: "when", widget: "datetime" });
    assert.equal((s["x-component-props"] as any).type, "datetime-local");
  });

  it("default value is preserved", () => {
    const s = fieldToSchema({ field: "x", widget: "number", default: 42 });
    assert.equal(s.default, 42);
  });

  it("description becomes decorator-props.description", () => {
    const s = fieldToSchema({ field: "x", widget: "text", description: "Help" });
    assert.equal((s["x-decorator-props"] as any).description, "Help");
  });
});

describe("sectionsToFormilySchema", () => {
  it("builds object schema with properties", () => {
    const sections = [
      { fields: [
        { field: "name", widget: "text" },
        { field: "qty", widget: "number" },
      ]},
    ];
    const s = sectionsToFormilySchema(sections);
    assert.equal(s.type, "object");
    assert.ok(s.properties);
    assert.ok(s.properties!.name);
    assert.ok(s.properties!.qty);
  });

  it("skips fields without field key", () => {
    const sections = [{ fields: [
      { field: "ok", widget: "text" },
      { widget: "text" },  // no field
    ]}];
    const s = sectionsToFormilySchema(sections);
    assert.ok(s.properties!.ok);
    assert.equal(Object.keys(s.properties!).length, 1);
  });

  it("handles empty sections", () => {
    const s = sectionsToFormilySchema([]);
    assert.equal(s.type, "object");
    assert.deepEqual(Object.keys(s.properties ?? {}), []);
  });

  it("flat handles multiple sections", () => {
    const sections = [
      { fields: [{ field: "a", widget: "text" }] },
      { fields: [{ field: "b", widget: "text" }] },
    ];
    const s = sectionsToFormilySchema(sections);
    assert.equal(Object.keys(s.properties!).length, 2);
  });
});

describe("extractInitialValues", () => {
  it("extracts defaults", () => {
    const sections = [{ fields: [
      { field: "x", widget: "text", default: "abc" },
      { field: "y", widget: "number", default: 42 },
    ]}];
    const init = extractInitialValues(sections);
    assert.equal(init.x, "abc");
    assert.equal(init.y, 42);
  });

  it("ignores fields without default", () => {
    const sections = [{ fields: [
      { field: "x", widget: "text" },
    ]}];
    const init = extractInitialValues(sections);
    assert.equal(init.x, undefined);
  });

  it("returns empty for empty sections", () => {
    assert.deepEqual(extractInitialValues([]), {});
  });
});

describe("extractLookupConfigs", () => {
  it("extracts only lookup fields", () => {
    const sections = [{ fields: [
      { field: "a", widget: "lookup", lookup: { objectId: 1, displayField: "n" } },
      { field: "b", widget: "text" },
      { field: "c", widget: "lookup", boundObject: "2", boundProperty: "code" },
    ]}];
    const result = extractLookupConfigs(sections);
    assert.equal(result.length, 2);
    assert.equal(result[0].field, "a");
    assert.equal(result[1].field, "c");
  });

  it("returns empty when no lookups", () => {
    const sections = [{ fields: [{ field: "a", widget: "text" }] }];
    assert.equal(extractLookupConfigs(sections).length, 0);
  });
});

/* ──────────────────────────────────────────────────────────────────
 * v1.0.2 Sprint 2 F1.6: visibleWhen / x-reactions 转换测试
 * ────────────────────────────────────────────────────────────────── */

describe("visibleWhenToExpression", () => {
  it("eq op generates strict equality", () => {
    const r: VisibleWhenRule = { field: "country", op: "eq", value: "CN" };
    assert.equal(visibleWhenToExpression(r), `$values.country === "CN"`);
  });

  it("neq op generates strict inequality", () => {
    const r: VisibleWhenRule = { field: "status", op: "neq", value: 1 };
    assert.equal(visibleWhenToExpression(r), `$values.status !== 1`);
  });

  it("notEmpty op checks for non-empty value", () => {
    const r: VisibleWhenRule = { field: "customer", op: "notEmpty" };
    const expr = visibleWhenToExpression(r);
    assert.ok(expr.includes("!== undefined"));
    assert.ok(expr.includes("!== null"));
    assert.ok(expr.includes("!== ''"));
    assert.ok(expr.startsWith("("));
  });

  it("empty op checks for empty value", () => {
    const r: VisibleWhenRule = { field: "customer", op: "empty" };
    const expr = visibleWhenToExpression(r);
    assert.ok(expr.includes("=== undefined"));
    assert.ok(expr.includes("=== null"));
    assert.ok(expr.includes("=== ''"));
  });

  it("unknown op falls back to true", () => {
    const r = { field: "x", op: "unknown" as any };
    assert.equal(visibleWhenToExpression(r), "true");
  });

  it("JSON.stringify escapes special chars in string value", () => {
    const r: VisibleWhenRule = { field: "name", op: "eq", value: 'a"b' };
    const expr = visibleWhenToExpression(r);
    assert.ok(expr.includes('a\\"b'));
  });

  it("number value is not quoted as string", () => {
    const r: VisibleWhenRule = { field: "id", op: "eq", value: 42 };
    assert.equal(visibleWhenToExpression(r), `$values.id === 42`);
  });
});

describe("visibleWhenToReactions", () => {
  it("returns null when no rules", () => {
    assert.equal(visibleWhenToReactions(undefined), null);
    assert.equal(visibleWhenToReactions([]), null);
  });

  it("single rule generates x-reactions with 1 dependency", () => {
    const r: VisibleWhenRule = { field: "country", op: "eq", value: "CN" };
    const reactions = visibleWhenToReactions(r);
    assert.ok(reactions);
    assert.deepEqual(reactions.dependencies, ["country"]);
    assert.equal(reactions.when, "{{$values.country === \"CN\"}}");
    assert.deepEqual(reactions.fulfill, { state: { visible: true } });
    assert.deepEqual(reactions.otherwise, { state: { visible: false } });
  });

  it("array of rules generates AND-joined expression", () => {
    const rules: VisibleWhenRule[] = [
      { field: "country", op: "eq", value: "CN" },
      { field: "tier", op: "eq", value: "gold" },
    ];
    const reactions = visibleWhenToReactions(rules);
    assert.ok(reactions);
    assert.deepEqual(reactions.dependencies, ["country", "tier"]);
    assert.equal(reactions.when, '{{$values.country === "CN" && $values.tier === "gold"}}');
  });

  it("deduplicates dependencies", () => {
    const rules: VisibleWhenRule[] = [
      { field: "country", op: "eq", value: "CN" },
      { field: "country", op: "neq", value: "" },
    ];
    const reactions = visibleWhenToReactions(rules);
    assert.deepEqual(reactions.dependencies, ["country"]);
  });

  it("notEmpty + notEmpty is a single dep AND", () => {
    const rules: VisibleWhenRule[] = [
      { field: "a", op: "notEmpty" },
      { field: "b", op: "notEmpty" },
    ];
    const reactions = visibleWhenToReactions(rules);
    assert.deepEqual(reactions.dependencies, ["a", "b"]);
    assert.ok(reactions.when.includes("$values.a !== undefined"));
    assert.ok(reactions.when.includes("$values.b !== undefined"));
    assert.ok(reactions.when.includes(" && "));
  });
});

describe("fieldToSchema with visibleWhen", () => {
  it("injects x-reactions when visibleWhen is set", () => {
    const s = fieldToSchema({
      field: "province", widget: "text",
      visibleWhen: { field: "country", op: "eq", value: "CN" },
    });
    assert.ok(s["x-reactions"]);
    assert.deepEqual((s["x-reactions"] as any).dependencies, ["country"]);
  });

  it("no x-reactions when visibleWhen is absent", () => {
    const s = fieldToSchema({ field: "x", widget: "text" });
    assert.equal(s["x-reactions"], undefined);
  });

  it("multiple rules produce AND-joined x-reactions", () => {
    const s = fieldToSchema({
      field: "detail", widget: "text",
      visibleWhen: [
        { field: "type", op: "eq", value: "vip" },
        { field: "city", op: "notEmpty" },
      ],
    });
    const r = s["x-reactions"] as any;
    assert.deepEqual(r.dependencies, ["type", "city"]);
    assert.ok(r.when.includes("vip"));
    assert.ok(r.when.includes("!== undefined"));
  });

  it("lookup field with visibleWhen uses FK ID in expression", () => {
    // 经典场景: lookup 字段被选中 (FK ID) -> 显示备注
    const s = fieldToSchema({
      field: "remark", widget: "longtext",
      visibleWhen: { field: "customer_ref", op: "notEmpty" },
    });
    const r = s["x-reactions"] as any;
    assert.deepEqual(r.dependencies, ["customer_ref"]);
    assert.ok(r.when.includes("$values.customer_ref !== undefined"));
  });
});