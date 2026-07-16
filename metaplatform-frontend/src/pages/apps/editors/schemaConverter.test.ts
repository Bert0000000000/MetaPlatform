/**
 * v1.0.2 Sprint 2 F1.3: schemaConverter.lookup 单测.
 *
 * <p>验证 lookup DesignerField 能正确转为 FieldSchema,
 *   widget 保留 + boundObject/boundProperty 透传.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { designerToPageRender } from "./schemaConverter";
import type { DesignerState } from "./DesignerTypes";
import { createField } from "./fieldLibrary";

describe("designerToPageRender - lookup", () => {
  it("preserves lookup widget key", () => {
    const lookupField = createField("lookup");
    lookupField.fieldKey = "customer_id";
    lookupField.boundObject = "5";
    lookupField.boundProperty = "name";
    lookupField.label = "Customer";

    const state: DesignerState = {
      pageName: "Test",
      pageType: "form",
      boundObjectId: null,
      sections: [
        {
          id: "s1",
          title: "Section",
          columns: 2,
          fields: [lookupField],
        },
      ],
    };

    const render = designerToPageRender(state);
    const schemaField = render.sections[0].fields[0];
    assert.equal(schemaField.widget, "lookup");
    assert.equal(schemaField.field, "customer_id");
    assert.equal(schemaField.label, "Customer");
    assert.equal(schemaField.boundObject, "5");
    assert.equal(schemaField.boundProperty, "name");
  });

  it("omits boundObject/boundProperty when not set", () => {
    const lookupField = createField("lookup");
    // intentionally no boundObject
    const state: DesignerState = {
      pageName: "Test",
      pageType: "form",
      boundObjectId: null,
      sections: [
        { id: "s1", title: "S", columns: 1, fields: [lookupField] },
      ],
    };
    const render = designerToPageRender(state);
    const schemaField = render.sections[0].fields[0];
    assert.equal(schemaField.widget, "lookup");
    assert.equal(schemaField.boundObject, undefined);
    assert.equal(schemaField.boundProperty, undefined);
  });

  it("lookup field with all common props", () => {
    const lookupField = createField("lookup");
    lookupField.fieldKey = "customer_ref";
    lookupField.label = "Customer Ref";
    lookupField.required = true;
    lookupField.boundObject = "10";
    lookupField.boundProperty = "name";
    lookupField.width = "full";

    const state: DesignerState = {
      pageName: "Form",
      pageType: "form",
      boundObjectId: "10",
      sections: [
        { id: "s1", title: "Main", columns: 2, fields: [lookupField] },
      ],
    };

    const render = designerToPageRender(state);
    const f = render.sections[0].fields[0];
    assert.equal(f.key, "customer_ref");
    assert.equal(f.widget, "lookup");
    assert.equal(f.required, true);
    assert.equal(f.boundObject, "10");
    assert.equal(f.boundProperty, "name");
    assert.equal(f.width, "full");
  });
});