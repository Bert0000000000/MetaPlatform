/** DW 数字员工端对话历史 API。
 *
 * 持久化（FR-DW-CHAT-001..004）：
 *  - tenant + user + employee 三维隔离
 *  - conversation_id 直接作为 Kernel SessionSandbox.session_id 透传
 */
import { createApiClient, apiPath } from '@mate/shared/api';

export interface EmployeeConversation {
  conversationId: string;
  tenantId: string;
  userId: string;
  employeeId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeMessage {
  messageId: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  status: string;
  model: string;
  sequence: number;
  createdAt: string;
}

export interface AppendMessageBody {
  role: 'user' | 'assistant';
  content: string;
  status?: string;
  model?: string;
  createdAt?: string;
}

const client = () => createApiClient({ baseURL: apiPath('dw', '') });

export async function listEmployeeConversations(employeeId: string): Promise<EmployeeConversation[]> {
  const res = await client().get<{ items: EmployeeConversation[]; total: number }>(
    `/employees/${encodeURIComponent(employeeId)}/conversations`,
  );
  return res.data?.items ?? [];
}

export async function createEmployeeConversation(
  employeeId: string,
  title: string = '',
): Promise<EmployeeConversation> {
  const res = await client().post<EmployeeConversation>(
    `/employees/${encodeURIComponent(employeeId)}/conversations`,
    { title },
  );
  return res.data;
}

export async function listEmployeeMessages(
  employeeId: string,
  conversationId: string,
): Promise<EmployeeMessage[]> {
  const res = await client().get<{ items: EmployeeMessage[]; total: number }>(
    `/employees/${encodeURIComponent(employeeId)}/conversations/${encodeURIComponent(conversationId)}/messages`,
  );
  return res.data?.items ?? [];
}

export async function appendEmployeeMessage(
  employeeId: string,
  conversationId: string,
  body: AppendMessageBody,
): Promise<EmployeeMessage> {
  const res = await client().post<EmployeeMessage>(
    `/employees/${encodeURIComponent(employeeId)}/conversations/${encodeURIComponent(conversationId)}/messages`,
    body,
  );
  return res.data;
}
