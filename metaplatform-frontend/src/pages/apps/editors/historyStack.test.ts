/**
 * AC-201.6 HistoryStack 单元测试 (无 React 依赖).
 *
 * 覆盖算法核心:
 *  - 基本 push / undo / redo
 *  - commit 时值未变不入栈
 *  - coalesceKey 相同 + 在 mergeWindow 内 → 合并 (只占一格)
 *  - coalesceKey 不同 → 各占一格
 *  - 超过 mergeWindowMs 即使 key 相同也不合并
 *  - 栈容量上限 (capacity=5, push 7 个, 只剩 5)
 *  - undo 后 commit 清空 redo 栈
 *  - reset 清空历史
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { HistoryStack } from "./historyStack";

describe("AC-201.6 HistoryStack", () => {
  it("基本 push / undo / redo", () => {
    const stack = new HistoryStack<number>(0);
    assert.equal(stack.canUndo(), false);
    assert.equal(stack.canRedo(), false);

    stack.commit(1);
    stack.commit(2);
    stack.commit(3);
    assert.equal(stack.getState(), 3);
    assert.equal(stack.canUndo(), true);
    assert.equal(stack.pastDepth(), 3);

    stack.undo();
    assert.equal(stack.getState(), 2);
    assert.equal(stack.canRedo(), true);

    stack.undo();
    assert.equal(stack.getState(), 1);
    stack.undo();
    assert.equal(stack.getState(), 0);
    assert.equal(stack.canUndo(), false);

    stack.redo();
    assert.equal(stack.getState(), 1);
    stack.redo();
    assert.equal(stack.getState(), 2);
  });

  it("commit 值未变不入栈", () => {
    const stack = new HistoryStack<number>(5);
    stack.commit(5); // 值没变 (Object.is)
    assert.equal(stack.canUndo(), false);
    assert.equal(stack.pastDepth(), 0);

    stack.commit(7);
    stack.commit(7);
    assert.equal(stack.pastDepth(), 1, "连续提交相同值应合并/不入栈");
  });

  it("coalesceKey 相同 + mergeWindow 内 → 合并", () => {
    const stack = new HistoryStack<string>("init", { mergeWindowMs: 1000 });
    const now = 1000;

    stack.commit("a", "field:label", now);
    stack.commit("ab", "field:label", now + 100);
    stack.commit("abc", "field:label", now + 200);

    assert.equal(stack.pastDepth(), 1, "同一 coalesceKey 连续提交应合并成一格");
    assert.equal(stack.getState(), "abc");
  });

  it("coalesceKey 不同 → 各占一格", () => {
    const stack = new HistoryStack<string>("init", { mergeWindowMs: 1000 });
    const now = 1000;

    stack.commit("a", "field:label", now);
    stack.commit("b", "field:options", now + 100);
    stack.commit("c", "field:required", now + 200);

    assert.equal(stack.pastDepth(), 3, "不同 key 应各占一格");
  });

  it("超过 mergeWindowMs 即使 key 相同也不合并", () => {
    const stack = new HistoryStack<string>("init", { mergeWindowMs: 100 });
    const now = 1000;

    stack.commit("a", "field:label", now);
    stack.commit("b", "field:label", now + 500); // 间隔 500ms > 100ms

    assert.equal(stack.pastDepth(), 2);
  });

  it("栈容量上限", () => {
    const stack = new HistoryStack<number>(0, { capacity: 5, mergeWindowMs: 0 });
    for (let i = 1; i <= 7; i++) {
      stack.commit(i, undefined, i * 1000);
    }
    assert.equal(stack.pastDepth(), 5, "capacity=5 时只保留最近 5 次");
    assert.equal(stack.getState(), 7);

    // past 应为 [2, 3, 4, 5, 6] (最早 0, 1 被 shift 掉)
    // undo 5 次: 7 → 6 → 5 → 4 → 3 → 2
    for (let i = 0; i < 5; i++) stack.undo();
    assert.equal(stack.getState(), 2);
    assert.equal(stack.canUndo(), false, "undo 5 次后栈空, 不能再 undo");
  });

  it("AC-201.6 验收: 至少支持 5 步撤销", () => {
    const stack = new HistoryStack<number>(0, { capacity: 20 });
    for (let i = 1; i <= 10; i++) stack.commit(i, undefined, i * 10);

    assert.equal(stack.pastDepth(), 10);
    for (let i = 0; i < 7; i++) stack.undo();
    assert.equal(stack.getState(), 3);
    assert.equal(stack.canUndo(), true, "撤销 7 次后仍可继续撤销 (≥5)");
  });

  it("undo 后 commit 清空 redo 栈", () => {
    const stack = new HistoryStack<number>(0);
    stack.commit(1);
    stack.commit(2);
    stack.undo();
    assert.equal(stack.canRedo(), true);

    stack.commit(99); // 重新 commit
    assert.equal(stack.canRedo(), false, "新提交应清空 redo 栈");
    assert.equal(stack.getState(), 99);
  });

  it("reset 清空历史", () => {
    const stack = new HistoryStack<number>(0);
    stack.commit(1);
    stack.commit(2);
    stack.commit(3);
    stack.reset(99);
    assert.equal(stack.pastDepth(), 0);
    assert.equal(stack.futureDepth(), 0);
    assert.equal(stack.canUndo(), false);
    assert.equal(stack.canRedo(), false);
    assert.equal(stack.getState(), 99);
  });

  it("自定义 equals (深度比较) 让引用不同但内容相同的对象不入栈", () => {
    const equals = (a: unknown, b: unknown) =>
      JSON.stringify(a) === JSON.stringify(b);
    const stack = new HistoryStack<{ x: number }>({ x: 0 }, { equals });
    stack.commit({ x: 1 });
    stack.commit({ x: 1 }); // 内容相同
    assert.equal(stack.pastDepth(), 1);
  });

  it("AC-201.6 字段属性面板: 连续修改 label 只占 1 步", () => {
    // 模拟用户输入框连续输入: a → ab → abc → abcd → abcde
    const stack = new HistoryStack<string>("init", { mergeWindowMs: 1000 });
    const now = 1000;
    stack.commit("a", "field:myField:label", now);
    stack.commit("ab", "field:myField:label", now + 50);
    stack.commit("abc", "field:myField:label", now + 100);
    stack.commit("abcd", "field:myField:label", now + 150);
    stack.commit("abcde", "field:myField:label", now + 200);

    assert.equal(stack.pastDepth(), 1, "连续输入应合并为 1 步撤销");

    // 然后切换到另一个字段 (不同 coalesceKey), 应各占一格
    stack.commit("on", "field:otherField:required", now + 300);
    stack.commit("off", "field:otherField:required", now + 350);
    assert.equal(stack.pastDepth(), 2, "第二个字段连续修改再加 1 格");

    // undo 一次回到 myField:label 合并组开始前的值 (因第二个组合并, undo 回到 "abcde")
    stack.undo();
    assert.equal(stack.getState(), "abcde", "undo 一次: 取消 otherField 修改, 回到 abcde");

    // undo 第二次回到 init
    stack.undo();
    assert.equal(stack.getState(), "init", "undo 两次: 取消 myField 修改, 回到 init");

    // redo 回到 abcde
    stack.redo();
    assert.equal(stack.getState(), "abcde");
    // redo 第二次回到 off
    stack.redo();
    assert.equal(stack.getState(), "off");
  });
});