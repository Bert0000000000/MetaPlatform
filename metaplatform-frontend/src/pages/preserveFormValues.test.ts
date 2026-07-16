/**
 * AC-202.4 提交后保留已填值 — 单元测试.
 *
 * 覆盖:
 *  - computeResubmitValues 保留业务字段, 清空黑名单字段
 *  - computeResetValues 全清空
 *  - localStorage 序列化 + 过期 + 隔离
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";

/** Node 测试环境没有 window. 先 mock, 再动态导入被测代码. */
const memStore = new Map<string, string>();
const localStorageMock: Storage = {
  get length() { return memStore.size; },
  clear: () => memStore.clear(),
  getItem: (key: string) => memStore.get(key) ?? null,
  key: (i: number) => Array.from(memStore.keys())[i] ?? null,
  removeItem: (key: string) => { memStore.delete(key); },
  setItem: (key: string, value: string) => { memStore.set(key, String(value)); },
};
// @ts-expect-error mock window
globalThis.window = { localStorage: localStorageMock };
// @ts-expect-error mock global localStorage
globalThis.localStorage = localStorageMock;

// 动态 import 确保 mock 生效
const { computeResubmitValues, computeResetValues, loadDraft, saveDraft, clearDraft, PRESERVE_BLACKLIST_FIELDS } =
  await import("./preserveFormValues");

describe("AC-202.4 computeResubmitValues", () => {
  it("保留业务字段", () => {
    const last = { name: "Alice", email: "alice@x.com", _name: "Alice", _email: "a@x.com" };
    const active = ["name", "email", "_name", "_email"];
    const next = computeResubmitValues(last, active);
    assert.equal(next.name, "Alice");
    assert.equal(next.email, "alice@x.com");
  });

  it("清空 _name", () => {
    const last = { name: "Alice", _name: "Alice" };
    const active = ["name", "_name"];
    const next = computeResubmitValues(last, active);
    assert.equal(next._name, "");
    assert.equal(next.name, "Alice");
  });

  it("清空 _email", () => {
    const last = { email: "a@x.com", _email: "a@x.com" };
    const active = ["email", "_email"];
    const next = computeResubmitValues(last, active);
    assert.equal(next._email, "");
  });

  it("清空所有黑名单字段", () => {
    for (const k of PRESERVE_BLACKLIST_FIELDS) {
      assert.equal(k.startsWith("_"), true, `黑名单字段应以 _ 开头: ${k}`);
    }
    const last: Record<string, string> = {};
    const active: string[] = [];
    for (const k of PRESERVE_BLACKLIST_FIELDS) {
      last[k] = "previous value";
      active.push(k);
    }
    const next = computeResubmitValues(last, active);
    for (const k of PRESERVE_BLACKLIST_FIELDS) {
      assert.equal(next[k], "", `${k} 应被清空`);
    }
  });

  it("schema 中已删除的字段被剔除", () => {
    const last = { name: "A", oldField: "stale" };
    const active = ["name"];  // oldField 已删除
    const next = computeResubmitValues(last, active);
    assert.equal(next.name, "A");
    assert.equal("oldField" in next, false);
  });

  it("schema 中新增的字段在结果中以空字符串出现", () => {
    const last = { name: "A" };
    const active = ["name", "newField"];
    const next = computeResubmitValues(last, active);
    assert.equal(next.name, "A");
    assert.equal(next.newField, "");
  });

  it("不修改原对象 (immutability)", () => {
    const last = { name: "A", _name: "X" };
    const active = ["name", "_name"];
    const next = computeResubmitValues(last, active);
    assert.equal(last._name, "X", "原 _name 不应被修改");
    assert.equal(next._name, "");
  });

  it("支持中文字段名", () => {
    const last = { 姓名: "张三", _name: "张三" };
    const active = ["姓名", "_name"];
    const next = computeResubmitValues(last, active);
    assert.equal(next.姓名, "张三");
    assert.equal(next._name, "");
  });

  it("支持包含特殊字符的字段", () => {
    const last = { "field-1": "A", "field_2": "B" };
    const active = ["field-1", "field_2"];
    const next = computeResubmitValues(last, active);
    assert.equal(next["field-1"], "A");
    assert.equal(next["field_2"], "B");
  });

  it("空 last 时返回 schema 全空对象", () => {
    const active = ["a", "b", "c"];
    const next = computeResubmitValues({}, active);
    assert.deepEqual(next, { a: "", b: "", c: "" });
  });

  it("checkbox 字段 (布尔值转字符串) 不被特殊处理", () => {
    const last = { opt_in: "true", opt_out: "false" };
    const active = ["opt_in", "opt_out"];
    const next = computeResubmitValues(last, active);
    assert.equal(next.opt_in, "true");
    assert.equal(next.opt_out, "false");
  });
});

describe("AC-202.4 computeResetValues", () => {
  it("全清空所有字段", () => {
    const active = ["a", "b", "c"];
    const next = computeResetValues(active);
    assert.deepEqual(next, { a: "", b: "", c: "" });
  });

  it("空 active 列表返回空对象", () => {
    const next = computeResetValues([]);
    assert.deepEqual(next, {});
  });
});

describe("AC-202.4 localStorage draft", () => {
  before(() => {
    // 清理环境
    clearDraft("test-form-1");
    clearDraft("test-form-2");
  });

  after(() => {
    clearDraft("test-form-1");
    clearDraft("test-form-2");
  });

  it("保存与读取 round-trip", () => {
    const values = { name: "Alice", email: "a@x.com", note: "重要" };
    saveDraft("test-form-1", values);
    const loaded = loadDraft("test-form-1");
    assert.deepEqual(loaded, values);
  });

  it("不同 formId 的草稿相互隔离", () => {
    saveDraft("test-form-1", { a: "1" });
    saveDraft("test-form-2", { b: "2" });
    assert.deepEqual(loadDraft("test-form-1"), { a: "1" });
    assert.deepEqual(loadDraft("test-form-2"), { b: "2" });
  });

  it("清空草稿后读取为 null", () => {
    saveDraft("test-form-1", { a: "1" });
    clearDraft("test-form-1");
    assert.equal(loadDraft("test-form-1"), null);
  });

  it("不存在的 formId 返回 null", () => {
    assert.equal(loadDraft("nonexistent-form"), null);
  });

  it("损坏的 JSON 不抛错, 返回 null", () => {
    // 模拟损坏的 draft
    window.localStorage.setItem("form-draft:corrupt-form", "{not json");
    assert.equal(loadDraft("corrupt-form"), null);
    window.localStorage.removeItem("form-draft:corrupt-form");
  });

  it("过期草稿自动清理", () => {
    // 模拟 25 小时前的草稿
    const stale = {
      version: 1,
      formId: "stale-form",
      values: { a: "1" },
      savedAt: Date.now() - 25 * 60 * 60 * 1000,
    };
    window.localStorage.setItem("form-draft:stale-form", JSON.stringify(stale));
    const loaded = loadDraft("stale-form");
    assert.equal(loaded, null);
    assert.equal(window.localStorage.getItem("form-draft:stale-form"), null,
      "过期草稿应被自动清理");
  });

  it("版本不匹配的草稿返回 null", () => {
    const wrong = {
      version: 999,
      formId: "v-test",
      values: { a: "1" },
      savedAt: Date.now(),
    };
    window.localStorage.setItem("form-draft:v-test", JSON.stringify(wrong));
    assert.equal(loadDraft("v-test"), null);
    window.localStorage.removeItem("form-draft:v-test");
  });
});

describe("AC-202.4 集成场景", () => {
  it("场景: 用户提交→ 再提交一份 → 字段值保留", () => {
    // step 1: 模拟第一次填写并提交
    const firstInput = { 姓名: "张三", 部门: "技术部", 申请事由: "年假", _name: "张三", _email: "z@x.com" };
    const submitted = { ...firstInput };  // 后端成功

    // step 2: 用户点击"再提交一份（保留已填值）"
    const activeFields = ["姓名", "部门", "申请事由", "_name", "_email"];
    const secondInput = computeResubmitValues(submitted, activeFields);

    // 业务字段保留
    assert.equal(secondInput.姓名, "张三");
    assert.equal(secondInput.部门, "技术部");
    assert.equal(secondInput.申请事由, "年假");

    // 黑名单字段清空 (新提交人)
    assert.equal(secondInput._name, "");
    assert.equal(secondInput._email, "");
  });

  it("场景: 用户编辑过程刷新页面 → localStorage 恢复", () => {
    const values = { name: "Alice", email: "a@x.com" };
    saveDraft("draft-form", values);

    // 模拟页面刷新, 重新加载
    const recovered = loadDraft("draft-form");
    assert.deepEqual(recovered, values);

    // schema 验证: 剔除已删除字段
    const activeKeys = ["name"];  // email 已删除
    const safe = recovered ? computeResubmitValues(recovered, activeKeys) : {};
    assert.equal(safe.name, "Alice");
    assert.equal("email" in safe, false);

    clearDraft("draft-form");
  });

  it("场景: 用户点击重新填写 → 全部清空", () => {
    const activeFields = ["a", "b", "c"];
    const result = computeResetValues(activeFields);
    assert.deepEqual(result, { a: "", b: "", c: "" });
  });
});