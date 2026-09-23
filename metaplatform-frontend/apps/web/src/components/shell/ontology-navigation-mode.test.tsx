/**
 * 本体域导航模式契约—— 2026-09-24 起为 tab 模式常驻契约。
 *
 * <p>用户决策：本体导航回归与全站一致的横向 PageTabs（主 tab = 六大功能组 +
 * children 胶囊行），IA v2 的正式 URL 与路由即状态成果全部保留。
 * 本文件防止后续改动悄悄把本体域改回 workspace 模式（左侧导航）或
 * 清空 tabs/children 结构（PageTabs 高亮与面包屑依赖它）。
 *
 * <p>渲染行为由 E2E 断言（ontology-ia-v2-navigation.spec）：
 * 本体页面渲染 .mp-pagetabs、无 .mp-onto-sidenav。
 */
import '@testing-library/jest-dom/vitest';
import { describe, expect, it } from 'vitest';
import { DOMAINS } from './domains';

describe('本体域导航模式契约（tab 模式）', () => {
  it('本体域不声明 workspace 模式（横向 PageTabs 渲染）', () => {
    const ontology = DOMAINS.find((d) => d.key === 'ontology');
    expect(ontology).toBeDefined();
    expect(ontology?.navigationMode).toBeUndefined();
  });

  it('其他域也不使用 workspace 模式（该模式已无使用者）', () => {
    const others = DOMAINS.filter((d) => d.key !== 'ontology');
    for (const d of others) {
      expect(d.navigationMode).toBeUndefined();
    }
  });

  it('六大功能组主 tab 齐全，且五组带 children 胶囊行（总览直达除外）', () => {
    const ontology = DOMAINS.find((d) => d.key === 'ontology');
    const keys = ontology?.tabs.map((t) => t.key);
    expect(keys).toEqual(
      expect.arrayContaining(['overview', 'model', 'data', 'explore', 'logic', 'governance']),
    );
    const withChildren = ontology?.tabs.filter((t) => (t.children ?? []).length > 0) ?? [];
    expect(withChildren.length).toBe(5);
    // 子页路径全部落在对应组前缀下（tab 高亮最长前缀匹配的前提）
    for (const t of withChildren) {
      for (const c of t.children ?? []) {
        expect(c.path.startsWith(`${t.path}/`)).toBe(true);
      }
    }
  });
});
