import { get, post, put, del } from './client';
import type { Employee, EmployeeCreateRequest, PageResponse, EmployeeVersion, EmployeeOperationLog } from '@/types';

export async function listEmployees(params?: {
  keyword?: string;
  status?: string;
  roleCategory?: string;
}): Promise<PageResponse<Employee>> {
  return get<PageResponse<Employee>>('/v1/dw/employees', params as Record<string, unknown> | undefined);
}

export async function getEmployee(id: string): Promise<Employee> {
  return get<Employee>(`/v1/dw/employees/${id}`);
}

export async function createEmployee(request: EmployeeCreateRequest): Promise<Employee> {
  return post<Employee>('/v1/dw/employees', request);
}

export async function updateEmployee(id: string, request: EmployeeCreateRequest): Promise<Employee> {
  return put<Employee>(`/v1/dw/employees/${id}`, request);
}

export async function deleteEmployee(id: string): Promise<void> {
  // V12-07: 后端使用 /agents 路径，软删除（deleted_at 字段），并记录审计日志。
  return del<void>(`/v1/dw/employees/${id}`);
}

export async function activateEmployee(id: string): Promise<Employee> {
  return put<Employee>(`/v1/dw/employees/${id}/status`, { status: 'ACTIVE' });
}

export async function deactivateEmployee(id: string): Promise<Employee> {
  return put<Employee>(`/v1/dw/employees/${id}/status`, { status: 'INACTIVE' });
}

/**
 * V12-07: 克隆数字员工。
 *
 * 后端在 APP-DW 的 agents 模块实现了 POST /v1/dw/employees/{id}/clone：
 *   - 复制源 Agent 全部能力配置（model/prompt/tools/rag_scopes 等）
 *   - 在源 Agent 上记录版本快照（version bump）与 clone 操作日志
 *   - 在新 Agent 上记录初始版本（1.0.0）与 create 操作日志
 *
 * 数字员工本质上是 Agent 的业务投影，因此 clone 复用 employees 端点。
 */
export async function cloneEmployee(
  source: Employee,
  newName: string,
  newCode: string,
): Promise<Employee> {
  return post<Employee>(`/v1/dw/employees/${source.employeeId}/clone`, {
    name: newName,
    code: newCode,
  });
}

/**
 * V11-05: 员工版本历史与操作日志后端化。
 *
 * 后端在 APP-DW 的 agents 模块实现了 AgentVersion/AgentOperationLog。
 * 数字员工本质上是 Agent 的业务投影，因此 versions/logs 复用 employees 端点：
 *   - GET /v1/dw/employees/{id}/versions
 *   - GET /v1/dw/employees/{id}/logs
 *
 * 返回字段（camelCase）已与 EmployeeVersion / EmployeeOperationLog 类型对齐。
 */
export async function getEmployeeVersions(employeeId: string): Promise<EmployeeVersion[]> {
  const res = await get<PageResponse<EmployeeVersion>>(
    `/v1/dw/employees/${employeeId}/versions`,
  );
  return res?.items ?? [];
}

export async function getEmployeeOperationLogs(employeeId: string): Promise<EmployeeOperationLog[]> {
  const res = await get<PageResponse<EmployeeOperationLog>>(
    `/v1/dw/employees/${employeeId}/logs`,
  );
  return res?.items ?? [];
}
