import { apiClient } from './client';
import type {
  FormGenResult,
  ProcessGenResult,
  CodeGenResult,
  DashboardGenResult,
} from '@/types';

export async function generateForm(prompt: string): Promise<FormGenResult> {
  try {
    const response = await apiClient.post('/v1/superai/generate/form', { prompt });
    return (response.data as { data: FormGenResult }).data;
  } catch {
    return mockForm(prompt);
  }
}

export async function generateProcess(prompt: string): Promise<ProcessGenResult> {
  try {
    const response = await apiClient.post('/v1/superai/generate/process', { prompt });
    return (response.data as { data: ProcessGenResult }).data;
  } catch {
    return mockProcess(prompt);
  }
}

export async function generateCode(
  prompt: string,
  language: string,
): Promise<CodeGenResult> {
  try {
    const response = await apiClient.post('/v1/superai/generate/code', { prompt, language });
    return (response.data as { data: CodeGenResult }).data;
  } catch {
    return {
      language,
      description: prompt,
      code: `// ${language} 生成示例\n// 提示: ${prompt}\n`,
    };
  }
}

export async function generateDashboard(prompt: string): Promise<DashboardGenResult> {
  try {
    const response = await apiClient.post('/v1/superai/generate/dashboard', { prompt });
    return (response.data as { data: DashboardGenResult }).data;
  } catch {
    return mockDashboard(prompt);
  }
}

function mockForm(prompt: string): FormGenResult {
  return {
    name: 'AI 生成表单',
    description: prompt,
    fields: [
      { type: 'text', label: '名称', fieldKey: 'name', required: true },
      { type: 'textarea', label: '描述', fieldKey: 'description', required: false },
      { type: 'number', label: '金额', fieldKey: 'amount', required: false },
      { type: 'date', label: '日期', fieldKey: 'date', required: true },
      {
        type: 'select',
        label: '类型',
        fieldKey: 'type',
        required: true,
        options: [
          { label: '选项 A', value: 'A' },
          { label: '选项 B', value: 'B' },
        ],
      },
    ],
  };
}

function mockProcess(prompt: string): ProcessGenResult {
  return {
    name: 'AI 生成流程',
    description: prompt,
    bpmnXml: '<bpmn:definitions>...</bpmn:definitions>',
    nodes: [
      { id: 'start', name: '开始', type: 'start' },
      { id: 'approval', name: '审批', type: 'approval', assignee: '财务负责人' },
      { id: 'end', name: '结束', type: 'end' },
    ],
  };
}

function mockDashboard(prompt: string): DashboardGenResult {
  return {
    title: 'AI 生成仪表盘',
    description: prompt,
    widgets: [
      {
        id: 'w1',
        title: '总数',
        type: 'stat',
        dataSource: 'GET /api/v1/employees/count',
        apiExample: 'curl /api/v1/employees/count',
      },
      {
        id: 'w2',
        title: '趋势',
        type: 'chart-line',
        dataSource: 'GET /api/v1/metrics/trend',
        apiExample: 'curl /api/v1/metrics/trend?range=7d',
      },
    ],
    apiExamples: [
      {
        method: 'GET',
        url: '/api/v1/employees/count',
        description: '返回员工总数',
        curl: 'curl http://localhost:8000/api/v1/employees/count',
      },
    ],
  };
}
