/**
 * 全局 toast：Semi Toast 为全局命令式 API，无需 Provider 注入，
 * 任何模块（含非 React 的 client.ts）可直接调用。
 */
import { Toast } from '@douyinfe/semi-ui';

const HANDLERS = {
  success: Toast.success,
  error: Toast.error,
  warning: Toast.warning,
  info: Toast.info,
} as const;

export function toast(content: string, type: keyof typeof HANDLERS = 'info'): void {
  try {
    HANDLERS[type](content);
  } catch {
    // 静默降级：Semi Toast 未就绪时不抛错
  }
}
