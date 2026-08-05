/**
 * 全局 message 实例 holder
 *
 * antd v6 的静态 message.error() 无法消费 context（主题、ConfigProvider），
 * 会触发警告 "Static function can not consume context like dynamic theme.
 *  Please use 'App' component instead."
 *
 * 方案：在 <AntApp> 内部用 App.useApp() 拿到 message 实例，
 * 通过 setMessageInstance 注入到这里；非 React 模块（如 client.ts）
 * 调用 toast() 取用。未注入时静默降级，避免 SSR / 测试环境报错。
 */
import type { MessageInstance } from 'antd/es/message/interface';

let _instance: MessageInstance | null = null;

export function setMessageInstance(instance: MessageInstance | null): void {
  _instance = instance;
}

/** 全局 toast：未注入时静默降级（不抛、不警告），保证非 React 上下文可用 */
export function toast(content: string, type: 'success' | 'error' | 'warning' | 'info' = 'info'): void {
  if (!_instance) return;
  try {
    _instance[type](content);
  } catch {
    // 静默降级：避免在 antd 未就绪时二次抛错
  }
}
