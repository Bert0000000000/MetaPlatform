import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SplitPane from './SplitPane';

// jsdom cannot measure layout. Only the browser's resize boundary is simulated;
// pane controls, input state, focus, collapse and keyboard events remain real.
const observers = new Set<ObservedResize>();
class ObservedResize implements ResizeObserver {
  readonly elements = new Set<Element>();
  constructor(readonly callback: ResizeObserverCallback) { observers.add(this); }
  observe(element: Element) { this.elements.add(element); }
  unobserve(element: Element) { this.elements.delete(element); }
  disconnect() { this.elements.clear(); observers.delete(this); }
}

function resizeContainer(width: number) {
  act(() => {
    for (const observer of observers) {
      const entries = Array.from(observer.elements, target => ({
        target,
        contentRect: new DOMRect(0, 0, width, 600),
        borderBoxSize: [], contentBoxSize: [], devicePixelContentBoxSize: [],
      }));
      observer.callback(entries, observer);
    }
  });
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', ObservedResize);
});
afterEach(() => {
  cleanup();
  observers.clear();
  vi.unstubAllGlobals();
});

function renderPane() {
  return render(<SplitPane ariaLabel="对象浏览器" defaultWidth={300} pane={<>
    <input aria-label="筛选类型" defaultValue="" />
    <button type="button">选择客户类型</button>
  </>}>
    <input aria-label="筛选对象" defaultValue="" />
    <button type="button">导出对象</button>
  </SplitPane>);
}

describe('SplitPane container adaptation', () => {
  it('starts folded in a narrow container even when the browser viewport is wide', () => {
    renderPane();
    resizeContainer(312);

    expect(screen.queryByRole('button', { name: '展开面板' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: '选择客户类型' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '导出对象' })).toBeVisible();
    expect(screen.queryByRole('separator')).not.toBeInTheDocument();
  });

  it('lets the user open a compact pane and Escape restores focus without losing pane input', () => {
    renderPane();
    resizeContainer(312);
    const toggle = screen.getByRole('button', { name: '展开面板' });
    toggle.focus();
    fireEvent.click(toggle);

    const input = screen.getByRole('textbox', { name: '筛选类型' });
    expect(input).toHaveFocus();
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: '选择客户类型' })).toBeVisible();
    fireEvent.change(input, { target: { value: '客户' } });
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveFocus();
    expect(screen.queryByRole('textbox', { name: '筛选类型' })).not.toBeInTheDocument();
    fireEvent.click(toggle);
    expect(screen.getByRole('textbox', { name: '筛选类型' })).toHaveValue('客户');
  });

  it('moves focus out of the pane when its container becomes narrow and preserves main input', () => {
    renderPane();
    resizeContainer(900);
    const mainInput = screen.getByRole('textbox', { name: '筛选对象' });
    fireEvent.change(mainInput, { target: { value: '订单' } });
    screen.getByRole('textbox', { name: '筛选类型' }).focus();

    resizeContainer(312);

    expect(screen.queryByRole('button', { name: '展开面板' })).toHaveFocus();
    expect(screen.getByRole('textbox', { name: '筛选对象' })).toHaveValue('订单');
    resizeContainer(900);
    expect(screen.getByRole('button', { name: '折叠面板' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('textbox', { name: '筛选对象' })).toHaveValue('订单');
  });

  it('keeps a user-folded desktop pane folded after compact expansion and a return to desktop', () => {
    renderPane();
    resizeContainer(900);
    fireEvent.click(screen.getByRole('button', { name: '折叠面板' }));
    resizeContainer(312);
    fireEvent.click(screen.getByRole('button', { name: '展开面板' }));
    expect(screen.getByRole('button', { name: '选择客户类型' })).toBeVisible();

    resizeContainer(900);

    expect(screen.queryByRole('button', { name: '展开面板' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: '选择客户类型' })).not.toBeInTheDocument();
  });

  it('bounds the desktop pane by its container and restores its requested width when space returns', () => {
    const { container } = renderPane();
    resizeContainer(900);
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.getPropertyValue('--mp-split-w')).toBe('300px');

    resizeContainer(500);
    // 500px leaves a 240px usable main plus the 1px divider.
    expect(root.style.getPropertyValue('--mp-split-w')).toBe('259px');
    resizeContainer(900);
    expect(root.style.getPropertyValue('--mp-split-w')).toBe('300px');
  });
});
