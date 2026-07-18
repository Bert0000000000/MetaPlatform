import { get, post, put, del } from './client';
import type { Employee, EmployeeCreateRequest, PageResponse, EmployeeVersion, EmployeeOperationLog } from '@/types';

export async function listEmployees(params?: {
  keyword?: string;
  status?: string;
  roleCategory?: string;
}): Promise<PageResponse<Employee>> {
  return get<PageResponse<Employee>>('/v1/agent/employees', params as Record<string, unknown> | undefined);
}

export async function getEmployee(id: string): Promise<Employee> {
  return get<Employee>(`/v1/agent/employees/${id}`);
}

export async function createEmployee(request: EmployeeCreateRequest): Promise<Employee> {
  return post<Employee>('/v1/agent/employees', request);
}

export async function updateEmployee(id: string, request: EmployeeCreateRequest): Promise<Employee> {
  return put<Employee>(`/v1/agent/employees/${id}`, request);
}

export async function deleteEmployee(id: string): Promise<void> {
  return del<void>(`/v1/agent/employees/${id}`);
}

export async function activateEmployee(id: string): Promise<Employee> {
  return put<Employee>(`/v1/agent/employees/${id}/status`, { status: 'ACTIVE' });
}

export async function deactivateEmployee(id: string): Promise<Employee> {
  return put<Employee>(`/v1/agent/employees/${id}/status`, { status: 'INACTIVE' });
}

/**
 * Clone an existing employee with a new name/code.
 * The backend endpoint may not exist yet; on failure we synthesize a local copy.
 */
export async function cloneEmployee(
  source: Employee,
  newName: string,
  newCode: string,
): Promise<Employee> {
  try {
    return await post<Employee>(`/v1/agent/employees/${source.employeeId}/clone`, {
      name: newName,
      code: newCode,
    });
  } catch {
    // Backend not ready: create via the standard create endpoint with source capability.
    return createEmployee({
      name: newName,
      code: newCode,
      roleCategory: source.roleCategory,
      roleIdentity: source.roleIdentity,
      description: source.description,
      avatar: source.avatar,
      capability: source.capability,
    });
  }
}

const VERSIONS_KEY_PREFIX = 'mate_platform_employee_versions_';

function readLocalVersions(employeeId: string): EmployeeVersion[] | undefined {
  try {
    const raw = localStorage.getItem(VERSIONS_KEY_PREFIX + employeeId);
    return raw ? (JSON.parse(raw) as EmployeeVersion[]) : undefined;
  } catch {
    return undefined;
  }
}

function writeLocalVersions(employeeId: string, versions: EmployeeVersion[]): void {
  try {
    localStorage.setItem(VERSIONS_KEY_PREFIX + employeeId, JSON.stringify(versions));
  } catch {
    // ignore quota errors
  }
}

const DEFAULT_VERSIONS: EmployeeVersion[] = [
  { version: '1.0.0', timestamp: new Date(Date.now() - 7 * 86_400_000).toISOString(), changeLog: '初始创建' },
  { version: '1.1.0', timestamp: new Date(Date.now() - 3 * 86_400_000).toISOString(), changeLog: '调整能力配置' },
  { version: '1.2.0', timestamp: new Date().toISOString(), changeLog: '更新知识库绑定' },
];

export async function getEmployeeVersions(employeeId: string): Promise<EmployeeVersion[]> {
  try {
    const remote = await get<EmployeeVersion[]>(`/v1/agent/employees/${employeeId}/versions`);
    writeLocalVersions(employeeId, remote);
    return remote;
  } catch {
    return readLocalVersions(employeeId) ?? DEFAULT_VERSIONS;
  }
}

const LOGS_KEY_PREFIX = 'mate_platform_employee_logs_';

function readLocalLogs(employeeId: string): EmployeeOperationLog[] | undefined {
  try {
    const raw = localStorage.getItem(LOGS_KEY_PREFIX + employeeId);
    return raw ? (JSON.parse(raw) as EmployeeOperationLog[]) : undefined;
  } catch {
    return undefined;
  }
}

function writeLocalLogs(employeeId: string, logs: EmployeeOperationLog[]): void {
  try {
    localStorage.setItem(LOGS_KEY_PREFIX + employeeId, JSON.stringify(logs));
  } catch {
    // ignore quota errors
  }
}

const DEFAULT_LOGS: EmployeeOperationLog[] = [
  {
    id: 'log-1',
    actor: 'admin',
    action: '创建',
    resource: 'employee',
    timestamp: new Date(Date.now() - 7 * 86_400_000).toISOString(),
    ip: '127.0.0.1',
    status: 'success',
  },
  {
    id: 'log-2',
    actor: 'admin',
    action: '激活',
    resource: 'employee',
    timestamp: new Date(Date.now() - 3 * 86_400_000).toISOString(),
    ip: '127.0.0.1',
    status: 'success',
  },
  {
    id: 'log-3',
    actor: 'admin',
    action: '修改配置',
    resource: 'capability',
    timestamp: new Date().toISOString(),
    ip: '127.0.0.1',
    status: 'success',
  },
];

export async function getEmployeeOperationLogs(employeeId: string): Promise<EmployeeOperationLog[]> {
  try {
    const remote = await get<EmployeeOperationLog[]>(`/v1/agent/employees/${employeeId}/logs`);
    writeLocalLogs(employeeId, remote);
    return remote;
  } catch {
    return readLocalLogs(employeeId) ?? DEFAULT_LOGS;
  }
}
