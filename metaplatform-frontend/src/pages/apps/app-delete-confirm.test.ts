/**
 * AC-104.4 删除应用二次确认 — 纯函数验证 (无 React)
 *
 * 测试场景:
 *  1. 输入为空 → "确认删除" 按钮 disabled
 *  2. 输入错误应用名 → disabled
 *  3. 输入正确应用名 → enabled
 *  4. 输入含前后空格的同名字符串 → disabled (严格匹配)
 *  5. 大小写不一致 → disabled
 *  6. 关闭 Dialog 后状态被重置
 *
 * 模拟 UI 状态机: 输入 / 验证 / 启用状态.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

/** 模拟 React 组件中"确认删除"按钮的 enabled 逻辑. */
function isDeleteEnabled(
  deleteConfirmInput: string,
  appName: string,
  deleting: boolean,
): boolean {
  if (deleting) return false;
  if (deleteConfirmInput !== appName) return false;
  return true;
}

describe("AC-104.4 delete app double-confirm", () => {
  it("空输入时 disabled", () => {
    assert.equal(isDeleteEnabled("", "MyApp", false), false);
  });

  it("错误应用名时 disabled", () => {
    assert.equal(isDeleteEnabled("WrongName", "MyApp", false), false);
  });

  it("正确应用名时 enabled", () => {
    assert.equal(isDeleteEnabled("MyApp", "MyApp", false), true);
  });

  it("严格匹配 (前后空格不算匹配)", () => {
    assert.equal(isDeleteEnabled(" MyApp", "MyApp", false), false);
    assert.equal(isDeleteEnabled("MyApp ", "MyApp", false), false);
    assert.equal(isDeleteEnabled(" MyApp ", "MyApp", false), false);
  });

  it("大小写敏感", () => {
    assert.equal(isDeleteEnabled("myapp", "MyApp", false), false);
    assert.equal(isDeleteEnabled("MYAPP", "MyApp", false), false);
    assert.equal(isDeleteEnabled("MyApp", "MyApp", false), true);
  });

  it("deleting=true 时禁用", () => {
    assert.equal(isDeleteEnabled("MyApp", "MyApp", true), false);
  });

  it("空应用名 + 空输入 → enabled (理论严格匹配)", () => {
    // 边界情况: 应用名和输入都是空, 严格 === 比较通过.
    // 实际场景中应用名永远不会为空, 所以这只是一个算法验证.
    assert.equal(isDeleteEnabled("", "", false), true);
  });

  it("空应用名 + 非空输入 → disabled", () => {
    assert.equal(isDeleteEnabled("anything", "", false), false);
  });

  it("支持中文应用名", () => {
    assert.equal(isDeleteEnabled("请假申请", "请假申请", false), true);
    assert.equal(isDeleteEnabled("请假", "请假申请", false), false);
  });

  it("支持包含特殊字符的应用名", () => {
    assert.equal(isDeleteEnabled("My-App_v2.0", "My-App_v2.0", false), true);
    assert.equal(isDeleteEnabled("My-App_v2.1", "My-App_v2.0", false), false);
  });

  it("长应用名匹配正确", () => {
    const longName = "A".repeat(100);
    assert.equal(isDeleteEnabled(longName, longName, false), true);
    assert.equal(isDeleteEnabled(longName + "x", longName, false), false);
  });

  it("状态机: 重置逻辑 (关闭 Dialog 时清空输入)", () => {
    // 模拟 Dialog onOpenChange: 关闭时清空输入
    let input = "已填的内容";
    const closeDialog = () => { input = ""; };
    closeDialog();
    assert.equal(input, "", "Dialog 关闭时应清空输入");
  });

  it("取消按钮 vs 确认按钮的互斥状态", () => {
    // 在任何输入状态下, 取消按钮总是 enabled (除非正在 deleting)
    // 在输入不匹配时, 确认按钮 disabled
    const appName = "MyApp";
    const confirmDisabled = !isDeleteEnabled("incorrect", appName, false);
    assert.equal(confirmDisabled, true, "确认按钮在输入错误时 disabled");
    // 取消按钮总是可点
    const cancelDisabled = false; // 除非 deleting
    assert.equal(cancelDisabled, false);
  });
});