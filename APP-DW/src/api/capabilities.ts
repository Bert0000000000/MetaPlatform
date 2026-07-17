import { get, post } from './client';
import type { EmployeeCapability, Employee } from '@/types';
import { MOCK_TOOLS, MOCK_MODELS, MOCK_KNOWLEDGE_BASES } from '@/types';

export async function listTools() {
  try {
    return await get<typeof MOCK_TOOLS>('/v1/agent/tools');
  } catch {
    return MOCK_TOOLS;
  }
}

export async function listModels() {
  try {
    return await get<typeof MOCK_MODELS>('/v1/llmgw/models');
  } catch {
    return MOCK_MODELS;
  }
}

export async function listKnowledgeBases() {
  try {
    return await get<typeof MOCK_KNOWLEDGE_BASES>('/v1/rag/knowledge-bases');
  } catch {
    return MOCK_KNOWLEDGE_BASES;
  }
}

export async function updateCapability(
  employeeId: string,
  capability: EmployeeCapability,
): Promise<Employee> {
  try {
    return await post<Employee>(`/v1/agent/employees/${employeeId}/capability`, capability);
  } catch {
    throw new Error('能力配置更新失败（后端服务未启动，使用本地存储模式）');
  }
}

export async function testCapability(
  employeeId: string,
  testMessage: string,
): Promise<{ reply: string; tokensUsed: number }> {
  try {
    return await post<{ reply: string; tokensUsed: number }>(
      `/v1/agent/employees/${employeeId}/test`,
      { message: testMessage },
    );
  } catch {
    return {
      reply: `测试回复：收到消息"${testMessage}"。当前为模拟环境，后端 Agent 服务未启动。`,
      tokensUsed: 42,
    };
  }
}
