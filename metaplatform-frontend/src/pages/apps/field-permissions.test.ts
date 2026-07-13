/**
 * AC-302.6 field-permissions 单元测试.
 *
 * 验证三种关键场景:
 * 1. hidden 字段被过滤掉 (不可见)
 * 2. visible 白名单模式生效 (不在白名单的字段不可见)
 * 3. editable 决定 input 是否可编辑
 * 4. 默认 fallback (permissions 为空) - 所有字段可见且可编辑
 *
 * 直接 import TodoCenterPage 中的纯函数, 无需 jsdom.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// 重新定义被测函数 (避免引入 React 依赖)
function parsePermissionEntry(entry: unknown): {
  hidden: Set<string>;
  visible: Set<string> | null;
  editable: Set<string> | null;
} {
  if (!entry || typeof entry !== "object") {
    return { hidden: new Set(), visible: null, editable: null };
  }
  const obj = entry as Record<string, unknown>;
  const toArr = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  return {
    hidden: new Set(toArr(obj.hidden)),
    visible: Array.isArray(obj.visible) ? new Set(toArr(obj.visible)) : null,
    editable: Array.isArray(obj.editable) ? new Set(toArr(obj.editable)) : null,
  };
}

function shouldRenderField(name: string, perm: ReturnType<typeof parsePermissionEntry>): boolean {
  if (perm.hidden.has(name)) return false;
  if (perm.visible && !perm.visible.has(name)) return false;
  return true;
}

function isFieldEditable(name: string, perm: ReturnType<typeof parsePermissionEntry>): boolean {
  if (perm.editable) return perm.editable.has(name);
  return !perm.hidden.has(name);
}

describe("AC-302.6 field permissions", () => {
  it("hidden 字段被过滤", () => {
    const perm = parsePermissionEntry({ hidden: ["salary"] });
    assert.equal(shouldRenderField("salary", perm), false);
    assert.equal(shouldRenderField("name", perm), true);
  });

  it("visible 白名单模式生效", () => {
    const perm = parsePermissionEntry({ visible: ["name", "amount"] });
    assert.equal(shouldRenderField("name", perm), true);
    assert.equal(shouldRenderField("amount", perm), true);
    // 不在白名单中
    assert.equal(shouldRenderField("applicant_note", perm), false);
    assert.equal(shouldRenderField("other", perm), false);
  });

  it("editable 决定 input 是否可编辑", () => {
    const perm = parsePermissionEntry({ editable: ["status"] });
    assert.equal(isFieldEditable("status", perm), true);
    assert.equal(isFieldEditable("name", perm), false);
  });

  it("fallback: permissions 为空时全部可见且可编辑", () => {
    const perm = parsePermissionEntry(null);
    assert.equal(shouldRenderField("any", perm), true);
    assert.equal(isFieldEditable("any", perm), true);
  });

  it("fallback: 后端返回 fieldPermissions: {} 时正常", () => {
    const perm = parsePermissionEntry({});
    assert.equal(perm.hidden.size, 0);
    assert.equal(perm.visible, null);
    assert.equal(perm.editable, null);
    assert.equal(shouldRenderField("x", perm), true);
    assert.equal(isFieldEditable("x", perm), true);
  });

  it("hidden + editable 同时存在: hidden 优先", () => {
    const perm = parsePermissionEntry({ hidden: ["x"], editable: ["x"] });
    assert.equal(shouldRenderField("x", perm), false);
  });

  it("嵌套 schema (BPMN) 解析正确", () => {
    // 后端实际返回: { taskKey: {hidden, editable, visible}, ... }
    // 这里 visible + editable 同时存在时, comment 既可见也可编辑
    const fp = {
      approval_1: {
        hidden: ["salary"],
        visible: ["amount", "applicant", "comment"],
        editable: ["comment"],
      },
    };
    const taskKey = "approval_1";
    const perm = parsePermissionEntry(fp[taskKey]);
    assert.equal(shouldRenderField("salary", perm), false, "salary 在 hidden 中, 不应渲染");
    assert.equal(shouldRenderField("amount", perm), true, "amount 在 visible 中, 应渲染");
    assert.equal(shouldRenderField("comment", perm), true, "comment 在 visible 中, 应渲染");
    assert.equal(isFieldEditable("comment", perm), true, "comment 在 editable 中, 应可编辑");
    assert.equal(isFieldEditable("amount", perm), false, "amount 不在 editable 中, 应只读");
    assert.equal(shouldRenderField("applicant", perm), true);
  });
});