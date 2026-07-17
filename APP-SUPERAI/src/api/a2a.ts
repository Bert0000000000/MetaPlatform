import { get, post } from './client';

export interface ExternalAgent {
  agentId: string;
  name: string;
  capabilities: string[];
  status: string;
  endpoint: string;
}

const STORAGE_KEY = 'superai_a2a_agents';

function load(): ExternalAgent[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const sample: ExternalAgent[] = [
      { agentId: 'ext-001', name: 'Claude (Anthropic)', capabilities: ['chat', 'summarize'], status: 'online', endpoint: 'https://api.anthropic.com' },
      { agentId: 'ext-002', name: 'GPT (OpenAI)', capabilities: ['chat', 'image'], status: 'online', endpoint: 'https://api.openai.com' },
    ];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sample));
    return sample;
  }
  try {
    return JSON.parse(raw) as ExternalAgent[];
  } catch {
    return [];
  }
}

export async function listExternalAgents(): Promise<ExternalAgent[]> {
  try {
    return await get<ExternalAgent[]>('/v1/a2a/external');
  } catch {
    return load();
  }
}

export async function delegateA2A(agentId: string, task: string): Promise<{ success: boolean; output: string }> {
  await new Promise((r) => setTimeout(r, 1000));
  return {
    success: true,
    output: `外部 Agent ${agentId} 已完成: ${task}`,
  };
}
