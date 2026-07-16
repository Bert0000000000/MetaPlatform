/**
 * 全局通知工具 — 封装 sonner.
 * 由于整个项目使用了 Radix / Shadcn 风格的简单直接 API, 这里把成功/失败/提示统一封装.
 *
 * App.tsx 顶层需挂 <Toaster /> (来自 sonner), 才能让 toast 实际可见.
 */
import { toast as sonnerToast } from "sonner";

export const toast = {
  success: (msg: string, opts?: Parameters<typeof sonnerToast.success>[1]) =>
    sonnerToast.success(msg, opts),
  error: (msg: string, opts?: Parameters<typeof sonnerToast.error>[1]) =>
    sonnerToast.error(msg, opts),
  info: (msg: string, opts?: Parameters<typeof sonnerToast.info>[1]) =>
    sonnerToast.info(msg, opts),
  warning: (msg: string, opts?: Parameters<typeof sonnerToast.warning>[1]) =>
    sonnerToast.warning(msg, opts),
};

export default toast;
