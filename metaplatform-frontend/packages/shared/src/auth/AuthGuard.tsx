/**
 * 路由守卫组件
 *
 * 未登录时重定向到 /login，已登录时渲染子路由。
 */

import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { isLoggedIn } from './token';

export function AuthGuard({ children }: { children: ReactNode }) {
  const location = useLocation();

  if (!isLoggedIn()) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <>{children}</>;
}
