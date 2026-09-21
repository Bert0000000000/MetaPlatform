/**
 * IA v2 导航模式契约（ADR-0069 / 设计规格 §2.4）—— IA2-0 失败测试，IA2-1 起转绿。
 *
 * <p>本体域已退出全局横向 PageTabs，改为工作区左侧导航（navigationMode: 'workspace'）。
 * 本文件自此是**常驻契约**：防止后续改动悄悄把本体域改回 tabs 模式、
 * 或误清空面包屑兼容索引。
 *
 * <p>「PageTabs 在本体路由下不渲染」的**渲染行为**不在 jsdom 里测——PageTabs 的
 * 传递依赖链会拉起 lottie-web，其在 jsdom 模块加载期取 canvas 2d 上下文即崩
 * （jsdom 无 canvas 实现）。该行为由 E2E 断言：
 * `tests/e2e/ontology-ia-v2-navigation.spec.ts` 对六大功能域逐一断言
 * `.mp-pagetabs` count = 0。
 */
import '@testing-library/jest-dom/vitest';
import { describe, expect, it } from 'vitest';
import { DOMAINS } from './domains';

describe('IA v2 · 本体域导航模式契约', () => {
  it('本体域声明 navigationMode: workspace', () => {
    const ontology = DOMAINS.find((d) => d.key === 'ontology');
    expect(ontology).toBeDefined();
    expect(ontology?.navigationMode).toBe('workspace');
  });

  it('其他域不受影响：缺省仍按 tabs 模式解析', () => {
    const others = DOMAINS.filter((d) => d.key !== 'ontology');
    expect(others.length).toBeGreaterThan(0);
    for (const d of others) {
      expect(d.navigationMode ?? 'tabs').toBe('tabs');
    }
  });

  it('本体域 tabs 数组保留（面包屑兼容索引，不因 workspace 而清空）', () => {
    const ontology = DOMAINS.find((d) => d.key === 'ontology');
    expect(ontology?.tabs.length).toBeGreaterThan(0);
  });
});
