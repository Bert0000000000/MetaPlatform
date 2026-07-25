/**
 * API 客户端统一入口
 *
 * 使用方式：
 *   import { apiClient, listUsers, login, apiPath, SERVICES } from '@mate/shared/api';
 *
 *   const users = await listUsers({ page: 1, size: 20 });
 *   const path = apiPath('iam', '/auth/login');
 */

export * from './types';
export * from './client';
export * from './auth';
export * from './users';

export { SERVICES, API_BASE, apiPath, type ServiceRoute } from '../config/apiConfig';
