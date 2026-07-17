import { get, post, put, del } from './client';
import type { Employee, EmployeeCreateRequest, PageResponse } from '@/types';

const STORAGE_KEY = 'app_dw_employees';

function loadFromStorage(): Employee[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as Employee[];
  } catch {
    return [];
  }
}

function saveToStorage(items: Employee[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function now(): string {
  return new Date().toISOString();
}

function generateId(): string {
  return `emp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function listEmployees(params?: {
  keyword?: string;
  status?: string;
  roleCategory?: string;
}): Promise<PageResponse<Employee>> {
  const items = loadFromStorage();
  const keyword = params?.keyword?.toLowerCase() ?? '';
  const status = params?.status;
  const roleCategory = params?.roleCategory;

  const filtered = items.filter((item) => {
    const matchKeyword =
      !keyword ||
      item.name.toLowerCase().includes(keyword) ||
      item.roleIdentity.toLowerCase().includes(keyword);
    const matchStatus = !status || item.status === status;
    const matchRole = !roleCategory || item.roleCategory === roleCategory;
    return matchKeyword && matchStatus && matchRole;
  });

  return {
    items: filtered,
    total: filtered.length,
    page: 1,
    pageSize: filtered.length,
    totalPages: filtered.length === 0 ? 0 : 1,
  };
}

export async function getEmployee(id: string): Promise<Employee> {
  const item = loadFromStorage().find((e) => e.employeeId === id);
  if (!item) throw new Error('数字员工不存在');
  return item;
}

export async function createEmployee(request: EmployeeCreateRequest): Promise<Employee> {
  const items = loadFromStorage();
  if (items.some((e) => e.code === request.code)) {
    throw new Error('员工编码已存在');
  }
  if (items.some((e) => e.name === request.name)) {
    throw new Error('员工名称已存在');
  }
  const created: Employee = {
    ...request,
    employeeId: generateId(),
    status: 'ACTIVE',
    createdAt: now(),
    updatedAt: now(),
  };
  saveToStorage([...items, created]);
  return created;
}

export async function updateEmployee(id: string, request: EmployeeCreateRequest): Promise<Employee> {
  const items = loadFromStorage();
  const index = items.findIndex((e) => e.employeeId === id);
  if (index === -1) throw new Error('数字员工不存在');
  const updated: Employee = {
    ...items[index],
    ...request,
    employeeId: id,
    updatedAt: now(),
  };
  items[index] = updated;
  saveToStorage(items);
  return updated;
}

export async function deleteEmployee(id: string): Promise<void> {
  const items = loadFromStorage();
  const index = items.findIndex((e) => e.employeeId === id);
  if (index === -1) throw new Error('数字员工不存在');
  if (items[index].status === 'ACTIVE') {
    throw new Error('在线状态的数字员工需先停用才能删除');
  }
  items.splice(index, 1);
  saveToStorage(items);
}

export async function activateEmployee(id: string): Promise<Employee> {
  return updateStatus(id, 'ACTIVE');
}

export async function deactivateEmployee(id: string): Promise<Employee> {
  return updateStatus(id, 'INACTIVE');
}

async function updateStatus(id: string, status: Employee['status']): Promise<Employee> {
  const items = loadFromStorage();
  const index = items.findIndex((e) => e.employeeId === id);
  if (index === -1) throw new Error('数字员工不存在');
  const updated: Employee = { ...items[index], status, updatedAt: now() };
  items[index] = updated;
  saveToStorage(items);
  return updated;
}
