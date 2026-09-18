import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';

// NavigateCard 只从 `@/api/superai/chat` 取白名单校验函数，而该模块顺带 import 了
// `@mate/shared`（其传递依赖 lottie-web 需要 canvas，jsdom 下会炸）。这里把这两条
// 无关依赖挡掉，好让**真实的** `isAllowedNavigatePath` 被跑起来——若改成 mock
// chat 模块本身，negative 用例就变成在测 mock 了，等于没测。
vi.mock('@mate/shared/api', () => ({
  apiPath: () => '',
  createApiClient: () => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }),
}));
vi.mock('@mate/shared', () => ({
  getToken: () => null,
  getUser: () => null,
}));

import NavigateCard from './NavigateCard';

afterEach(cleanup);

// R4（ADR 评审硬条件）：`navigate.target.path` 是模型产出的字符串，渲染成**可点击之前**
// 必须过白名单；不合规的降级为**纯文本**。这组用例就是那条条件的 negative 判据——
// 它们在**渲染层**断言"没有被渲染成可点击元素"，而不是只断言校验函数返回 false。
describe('NavigateCard（R4 白名单）', () => {
  it('合规路径渲染成可点击按钮，点击回调带原路径', () => {
    const onNavigate = vi.fn();
    render(<NavigateCard target={{ path: '/ontology/objects', label: '看客户详情' }} onNavigate={onNavigate} />);

    expect(screen.getByTestId('navigate-card')).toBeInTheDocument();
    expect(screen.queryByTestId('navigate-card-blocked')).toBeNull();

    const button = screen.getByTestId('navigate-card-go');
    expect(button).toHaveAttribute('data-navigate-path', '/ontology/objects');
    fireEvent.click(button);
    expect(onNavigate).toHaveBeenCalledWith('/ontology/objects');
  });

  it.each([
    ['外部 http', 'https://evil.example.com/x'],
    ['外部 http（本机）', 'http://127.0.0.1:9250/ontology'],
    ['脚本注入', 'javascript:alert(1)'],
    ['data URL', 'data:text/html,<script>alert(1)</script>'],
    ['协议相对', '//evil.example.com/ontology'],
    ['反斜杠变体', '/\\evil.example.com'],
    ['未知前缀', '/unknown/thing'],
    ['路径穿越', '/ontology/../../etc/passwd'],
  ])('不合规路径（%s）降级为纯文本、不渲染任何可点击元素', (_label, path) => {
    const onNavigate = vi.fn();
    render(<NavigateCard target={{ path, label: '危险链接' }} onNavigate={onNavigate} />);

    expect(screen.getByTestId('navigate-card-blocked')).toBeInTheDocument();
    expect(screen.queryByTestId('navigate-card')).toBeNull();
    // 连一个 <button> 都不该有——"看起来能点"本身就是误导
    expect(screen.queryByRole('button')).toBeNull();
    expect(onNavigate).not.toHaveBeenCalled();
  });
});
