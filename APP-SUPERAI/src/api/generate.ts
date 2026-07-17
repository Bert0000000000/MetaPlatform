import { post } from './client';
import type {
  FormGenResult,
  ProcessGenResult,
  CodeGenResult,
  CodeReviewResult,
  DashboardGenResult,
  GeneratedConfig,
} from '@/types';

export async function generateForm(description: string): Promise<FormGenResult> {
  try {
    return await post<FormGenResult>('/v1/generate/form', { description });
  } catch {
    return mockGenerateForm(description);
  }
}

export async function generateProcess(description: string): Promise<ProcessGenResult> {
  try {
    return await post<ProcessGenResult>('/v1/generate/process', { description });
  } catch {
    return mockGenerateProcess(description);
  }
}

export async function generateCode(description: string, language: string): Promise<CodeGenResult> {
  try {
    return await post<CodeGenResult>('/v1/generate/code', { description, language });
  } catch {
    return mockGenerateCode(description, language);
  }
}

export async function explainCode(code: string): Promise<GeneratedConfig> {
  try {
    return await post<GeneratedConfig>('/v1/generate/explain-code', { code });
  } catch {
    return mockExplainCode(code);
  }
}

export async function reviewCode(code: string): Promise<CodeReviewResult> {
  try {
    return await post<CodeReviewResult>('/v1/generate/review-code', { code });
  } catch {
    return mockReviewCode(code);
  }
}

export async function generateDashboard(description: string): Promise<DashboardGenResult> {
  try {
    return await post<DashboardGenResult>('/v1/generate/dashboard', { description });
  } catch {
    return mockGenerateDashboard(description);
  }
}

function mockGenerateForm(description: string): FormGenResult {
  const lower = description.toLowerCase();

  if (lower.includes('客户') || lower.includes('customer')) {
    return {
      name: '客户信息登记表',
      description: '用于录入和编辑客户基本信息',
      fields: [
        { type: 'text', label: '客户名称', fieldKey: 'customerName', required: true },
        { type: 'text', label: '联系电话', fieldKey: 'phone', required: true },
        { type: 'text', label: '邮箱', fieldKey: 'email', required: false },
        { type: 'select', label: '客户等级', fieldKey: 'level', required: true, options: [
          { label: 'A级', value: 'A' }, { label: 'B级', value: 'B' }, { label: 'C级', value: 'C' },
        ] },
        { type: 'text', label: '所属行业', fieldKey: 'industry', required: false },
        { type: 'textarea', label: '备注', fieldKey: 'remark', required: false },
      ],
    };
  }

  if (lower.includes('报销') || lower.includes('expense')) {
    return {
      name: '费用报销单',
      description: '员工费用报销申请表',
      fields: [
        { type: 'text', label: '报销人', fieldKey: 'applicant', required: true },
        { type: 'date', label: '报销日期', fieldKey: 'expenseDate', required: true },
        { type: 'number', label: '报销金额', fieldKey: 'amount', required: true },
        { type: 'select', label: '费用类型', fieldKey: 'type', required: true, options: [
          { label: '差旅费', value: 'travel' }, { label: '餐饮费', value: 'meal' },
          { label: '办公用品', value: 'office' }, { label: '其他', value: 'other' },
        ] },
        { type: 'textarea', label: '费用说明', fieldKey: 'description', required: true },
        { type: 'upload', label: '发票附件', fieldKey: 'invoice', required: true },
      ],
    };
  }

  return {
    name: '通用信息表单',
    description: `基于描述"${description}"生成的表单`,
    fields: [
      { type: 'text', label: '名称', fieldKey: 'name', required: true },
      { type: 'textarea', label: '描述', fieldKey: 'description', required: false },
    ],
  };
}

function mockGenerateProcess(description: string): ProcessGenResult {
  const lower = description.toLowerCase();

  if (lower.includes('报销') || lower.includes('审批')) {
    return {
      name: '费用报销审批流程',
      description: '员工提交报销申请，经主管和财务审批后完成',
      bpmnXml: `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions>
  <bpmn:process id="expense-approval" name="费用报销审批">
    <bpmn:startEvent id="start" name="提交报销"/>
    <bpmn:userTask id="manager-review" name="主管审批" assignee="manager"/>
    <bpmn:userTask id="finance-review" name="财务审批" assignee="finance"/>
    <bpmn:exclusiveGateway id="gateway" name="金额判断"/>
    <bpmn:userTask id="vp-review" name="副总审批" assignee="vp"/>
    <bpmn:endEvent id="end" name="流程结束"/>
  </bpmn:process>
</bpmn:definitions>`,
      nodes: [
        { id: 'start', name: '提交报销', type: 'startEvent' },
        { id: 'manager-review', name: '主管审批', type: 'userTask', assignee: 'manager' },
        { id: 'gateway', name: '金额判断', type: 'exclusiveGateway' },
        { id: 'finance-review', name: '财务审批', type: 'userTask', assignee: 'finance' },
        { id: 'vp-review', name: '副总审批', type: 'userTask', assignee: 'vp' },
        { id: 'end', name: '流程结束', type: 'endEvent' },
      ],
    };
  }

  return {
    name: '通用审批流程',
    description: `基于描述"${description}"生成的审批流程`,
    bpmnXml: `<?xml version="1.0"?>
<bpmn:definitions>
  <bpmn:process id="generic-approval">
    <bpmn:startEvent id="start"/>
    <bpmn:userTask id="review" name="审批"/>
    <bpmn:endEvent id="end"/>
  </bpmn:process>
</bpmn:definitions>`,
    nodes: [
      { id: 'start', name: '开始', type: 'startEvent' },
      { id: 'review', name: '审批', type: 'userTask' },
      { id: 'end', name: '结束', type: 'endEvent' },
    ],
  };
}

function mockGenerateCode(description: string, language: string): CodeGenResult {
  const lang = language.toLowerCase();

  if (lang === 'python' || lang === 'py') {
    return {
      language: 'python',
      code: `import requests

def call_mate_platform_api(api_key: str, endpoint: str, params: dict) -> dict:
    """调用 Mate Platform API
    
    Args:
        api_key: API 密钥
        endpoint: API 端点路径
        params: 请求参数
    
    Returns:
        API 响应数据
    """
    url = f"https://api.mate-platform.com/api/v1/{endpoint}"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    response = requests.post(url, json=params, headers=headers)
    response.raise_for_status()
    return response.json()["data"]

# 使用示例
if __name__ == "__main__":
    result = call_mate_platform_api(
        api_key="your-api-key",
        endpoint="llmgw/chat/completions",
        params={"model": "doubao-pro", "messages": [{"role": "user", "content": "你好"}]}
    )
    print(result)`,
      description: `基于"${description}"生成的 Python API 调用代码`,
      dependencies: ['requests'],
    };
  }

  if (lang === 'curl' || lang === 'bash') {
    return {
      language: 'bash',
      code: `# 调用 Mate Platform LLM Gateway API
curl -X POST https://api.mate-platform.com/api/v1/llmgw/chat/completions \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "doubao-pro-32k",
    "messages": [
      {"role": "user", "content": "${description}"}
    ],
    "temperature": 0.7,
    "maxTokens": 2048
  }'`,
      description: `基于"${description}"生成的 curl 调用示例`,
    };
  }

  return {
    language: 'typescript',
    code: `import axios from 'axios';

const API_BASE = 'https://api.mate-platform.com/api/v1';

export async function callMateApi(
  apiKey: string,
  endpoint: string,
  params: Record<string, unknown>,
): Promise<unknown> {
  const response = await axios.post(\`\${API_BASE}/\${endpoint}\`, params, {
    headers: {
      Authorization: \`Bearer \${apiKey}\`,
      'Content-Type': 'application/json',
    },
  });
  return response.data.data;
}

// 使用示例
const result = await callMateApi('your-api-key', 'llmgw/chat/completions', {
  model: 'doubao-pro',
  messages: [{ role: 'user', content: '${description}' }],
});`,
    description: `基于"${description}"生成的 TypeScript API 调用代码`,
    dependencies: ['axios'],
  };
}

function mockExplainCode(code: string): GeneratedConfig {
  const lines = code.split('\n');
  const lineCount = lines.length;
  const hasClass = /class\s+\w+/.test(code);
  const hasFunction = /function\s+\w+|def\s+\w+/.test(code);
  const hasAsync = /async|await/.test(code);
  const hasImport = /import|require|from/.test(code);
  const hasApi = /fetch|axios|requests|http/.test(code);

  const parts: string[] = [];
  parts.push('**代码解析**\n');
  parts.push(`该代码共 ${lineCount} 行，包含以下结构：\n`);

  if (hasImport) parts.push('- **导入模块**：代码导入了必要的依赖模块');
  if (hasClass) parts.push('- **类定义**：定义了一个类，封装了相关功能');
  if (hasFunction) parts.push('- **函数定义**：包含一个或多个函数，实现具体逻辑');
  if (hasAsync) parts.push('- **异步处理**：使用了 async/await 进行异步操作');
  if (hasApi) parts.push('- **API 调用**：通过 HTTP 客户端发起网络请求');

  parts.push('\n**执行流程**：');
  parts.push('1. 初始化配置和参数');
  parts.push('2. 构建请求参数');
  parts.push('3. 发送请求并处理响应');
  parts.push('4. 返回处理结果');

  parts.push('\n**注意事项**：');
  parts.push('- 请确保 API Key 安全存储，不要硬编码在代码中');
  parts.push('- 建议添加错误处理和重试机制');
  parts.push('- 生产环境建议使用环境变量管理配置');

  return {
    type: 'explain',
    title: '代码解析结果',
    content: parts.join('\n'),
    language: 'markdown',
  };
}

function mockReviewCode(code: string): CodeReviewResult {
  const securityIssues: CodeReviewResult['securityIssues'] = [];
  const qualityIssues: CodeReviewResult['qualityIssues'] = [];
  const suggestions: string[] = [];

  const lines = code.split('\n');
  lines.forEach((line, index) => {
    const lineNum = index + 1;
    const trimmed = line.trim();

    if (/api[_-]?key|password|secret|token/i.test(trimmed) && /["']/.test(trimmed)) {
      securityIssues.push({
        line: lineNum,
        severity: 'critical',
        message: '检测到硬编码的敏感信息（API Key/密码/Token）',
        rule: 'no-hardcoded-secrets',
      });
    }
    if (/eval\(|exec\(/.test(trimmed)) {
      securityIssues.push({
        line: lineNum,
        severity: 'critical',
        message: '使用 eval/exec 存在代码注入风险',
        rule: 'no-eval',
      });
    }
    if (/http:\/\//.test(trimmed)) {
      securityIssues.push({
        line: lineNum,
        severity: 'warning',
        message: '使用 HTTP 而非 HTTPS，数据传输不安全',
        rule: 'use-https',
      });
    }
    if (/console\.(log|debug)/.test(trimmed)) {
      qualityIssues.push({
        line: lineNum,
        severity: 'info',
        message: '存在 console.log 调试语句，生产环境建议移除',
        rule: 'no-console-log',
      });
    }
    if (trimmed.length > 120) {
      qualityIssues.push({
        line: lineNum,
        severity: 'info',
        message: '行长度超过 120 字符，建议换行',
        rule: 'max-line-length',
      });
    }
  });

  if (!/try|catch|error|exception/i.test(code)) {
    suggestions.push('建议添加 try-catch 错误处理机制');
  }
  if (!/comment|\/\*|\/\//.test(code)) {
    suggestions.push('建议添加代码注释，提高可维护性');
  }
  if (code.length > 500 && !/type|interface|class/.test(code)) {
    suggestions.push('建议将代码拆分为更小的函数或模块');
  }

  const criticalCount = securityIssues.filter((i) => i.severity === 'critical').length;
  const overallScore = Math.max(0, 100 - criticalCount * 25 - securityIssues.filter((i) => i.severity === 'warning').length * 10 - qualityIssues.length * 2);

  return { overallScore, securityIssues, qualityIssues, suggestions };
}

function mockGenerateDashboard(description: string): DashboardGenResult {
  const lower = description.toLowerCase();

  if (lower.includes('销售') || lower.includes('sales')) {
    return {
      title: '销售数据分析仪表盘',
      description: '展示销售关键指标、趋势和分布',
      widgets: [
        { id: 'w1', title: '本月销售总额', type: 'statistic', dataSource: 'sales_total', apiExample: '/api/v1/analysis/execute-sql' },
        { id: 'w2', title: '各部门销售对比', type: 'bar', dataSource: 'sales_by_department', apiExample: '/api/v1/analysis/execute-sql' },
        { id: 'w3', title: '销售趋势', type: 'line', dataSource: 'sales_trend', apiExample: '/api/v1/analysis/execute-sql' },
        { id: 'w4', title: '客户等级分布', type: 'pie', dataSource: 'customer_distribution', apiExample: '/api/v1/analysis/execute-sql' },
      ],
      apiExamples: [
        { method: 'GET', url: '/api/v1/analysis/sales/summary', description: '获取销售汇总数据', curl: 'curl -H "Authorization: Bearer TOKEN" https://api.mate-platform.com/api/v1/analysis/sales/summary' },
        { method: 'POST', url: '/api/v1/analysis/execute-sql', description: '执行自定义 SQL 查询', curl: 'curl -X POST -H "Content-Type: application/json" -d \'{"sql":"SELECT * FROM sales"}\' https://api.mate-platform.com/api/v1/analysis/execute-sql' },
      ],
    };
  }

  return {
    title: '通用数据仪表盘',
    description: `基于"${description}"生成的仪表盘配置`,
    widgets: [
      { id: 'w1', title: '数据概览', type: 'statistic', dataSource: 'overview', apiExample: '/api/v1/data/overview' },
      { id: 'w2', title: '趋势图', type: 'line', dataSource: 'trend', apiExample: '/api/v1/data/trend' },
    ],
    apiExamples: [
      { method: 'GET', url: '/api/v1/data/overview', description: '获取数据概览', curl: 'curl -H "Authorization: Bearer TOKEN" https://api.mate-platform.com/api/v1/data/overview' },
    ],
  };
}
