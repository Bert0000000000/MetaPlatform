import { post } from './client';
import type {
  SqlGenerationResult,
  SqlExecutionResult,
  SqlAuditResult,
  ChartDataSet,
  ChartType,
} from '@/types';

export async function generateSql(
  query: string,
  ontologyConcepts?: string[],
): Promise<SqlGenerationResult> {
  try {
    return await post<SqlGenerationResult>('/v1/analysis/generate-sql', {
      query,
      ontologyConcepts,
    });
  } catch {
    return mockGenerateSql(query);
  }
}

export async function executeSql(sql: string): Promise<SqlExecutionResult> {
  try {
    return await post<SqlExecutionResult>('/v1/analysis/execute-sql', { sql });
  } catch {
    return mockExecuteSql(sql);
  }
}

export async function explainSql(sql: string): Promise<string> {
  try {
    return await post<string>('/v1/analysis/explain-sql', { sql });
  } catch {
    return mockExplainSql(sql);
  }
}

export async function auditSql(sql: string): Promise<SqlAuditResult> {
  try {
    return await post<SqlAuditResult>('/v1/analysis/audit-sql', { sql });
  } catch {
    return mockAuditSql(sql);
  }
}

export async function autoDetectChartType(
  columns: string[],
  rows: Record<string, unknown>[],
): Promise<ChartType> {
  if (rows.length === 0) return 'table';
  if (columns.length >= 2) {
    const firstCol = columns[0];
    const secondCol = columns[1];
    const firstValues = rows.map((r) => r[firstCol]);
    const secondValues = rows.map((r) => r[secondCol]);

    const firstIsCategory = firstValues.every((v) => typeof v === 'string');
    const secondIsNumeric = secondValues.every((v) => typeof v === 'number');

    if (firstIsCategory && secondIsNumeric) {
      if (firstValues.length <= 8) return 'pie';
      return 'bar';
    }

    const hasDate = firstValues.some((v) => typeof v === 'string' && /\d{4}-\d{2}/.test(v as string));
    if (hasDate && secondIsNumeric) return 'line';

    if (columns.length >= 3) {
      const thirdIsNumeric = rows.every((r) => typeof r[columns[2]] === 'number');
      if (thirdIsNumeric) return 'scatter';
    }

    return 'bar';
  }
  return 'table';
}

export async function buildChartDataSet(
  result: SqlExecutionResult,
  chartType?: ChartType,
): Promise<ChartDataSet> {
  const type = chartType || (await autoDetectChartType(result.columns, result.rows));
  return {
    type,
    title: '查询结果可视化',
    columns: result.columns,
    data: result.rows,
  };
}

function mockGenerateSql(query: string): SqlGenerationResult {
  const lowerQuery = query.toLowerCase();

  if (lowerQuery.includes('部门') && (lowerQuery.includes('销售') || lowerQuery.includes('统计'))) {
    return {
      sql: `SELECT d.department_name, SUM(o.amount) AS total_sales\nFROM orders o\nJOIN departments d ON o.department_id = d.id\nWHERE o.created_at >= DATE_TRUNC('month', CURRENT_DATE)\nGROUP BY d.department_name\nORDER BY total_sales DESC;`,
      explanation: '该 SQL 按部门统计本月销售总额，连接订单表和部门表，按部门名称分组汇总。',
      referencedTables: ['orders', 'departments'],
      referencedConcepts: ['部门', '订单', '销售额'],
    };
  }

  if (lowerQuery.includes('客户') && lowerQuery.includes('流失')) {
    return {
      sql: `SELECT c.customer_name, c.last_order_date, COUNT(o.id) AS order_count\nFROM customers c\nLEFT JOIN orders o ON c.id = o.customer_id\nWHERE c.last_order_date < CURRENT_DATE - INTERVAL '90 days'\nGROUP BY c.customer_name, c.last_order_date\nORDER BY c.last_order_date ASC;`,
      explanation: '查找超过 90 天未下单的客户，视为潜在流失客户。',
      referencedTables: ['customers', 'orders'],
      referencedConcepts: ['客户', '订单'],
    };
  }

  return {
    sql: `SELECT * FROM ${lowerQuery.includes('用户') || lowerQuery.includes('员工') ? 'employees' : 'business_objects'}\nLIMIT 100;`,
    explanation: `根据您的查询"${query}"，生成了一个基础查询。请根据实际需求调整。`,
    referencedTables: ['business_objects'],
    referencedConcepts: ['业务对象'],
  };
}

function mockExecuteSql(sql: string): SqlExecutionResult {
  const lowerSql = sql.toLowerCase();

  if (lowerSql.includes('department_name') && lowerSql.includes('total_sales')) {
    return {
      columns: ['department_name', 'total_sales'],
      rows: [
        { department_name: '销售一部', total_sales: 1250000 },
        { department_name: '销售二部', total_sales: 980000 },
        { department_name: '销售三部', total_sales: 1560000 },
        { department_name: '大客户部', total_sales: 2100000 },
        { department_name: '电商部', total_sales: 890000 },
      ],
      rowCount: 5,
      executionTime: 32,
    };
  }

  if (lowerSql.includes('customer_name') && lowerSql.includes('order_count')) {
    return {
      columns: ['customer_name', 'last_order_date', 'order_count'],
      rows: [
        { customer_name: '上海科技有限公司', last_order_date: '2026-03-15', order_count: 3 },
        { customer_name: '北京制造集团', last_order_date: '2026-02-20', order_count: 5 },
        { customer_name: '深圳贸易公司', last_order_date: '2026-04-01', order_count: 2 },
      ],
      rowCount: 3,
      executionTime: 45,
    };
  }

  return {
    columns: ['id', 'name', 'created_at'],
    rows: [
      { id: 1, name: '示例记录 1', created_at: '2026-07-01' },
      { id: 2, name: '示例记录 2', created_at: '2026-07-02' },
      { id: 3, name: '示例记录 3', created_at: '2026-07-03' },
    ],
    rowCount: 3,
    executionTime: 12,
  };
}

function mockExplainSql(sql: string): string {
  return `**SQL 解释**\n\n该查询语句执行以下操作：\n1. 从相关表中检索数据\n2. 使用 JOIN 连接多个表\n3. 使用 GROUP BY 进行分组聚合\n4. 使用 ORDER BY 对结果排序\n\n执行的 SQL：\n\`\`\`sql\n${sql}\n\`\`\``;
}

function mockAuditSql(sql: string): SqlAuditResult {
  const lowerSql = sql.toLowerCase();
  const warnings: string[] = [];
  const risks: string[] = [];

  if (lowerSql.includes('delete') || lowerSql.includes('drop') || lowerSql.includes('truncate')) {
    risks.push('检测到危险操作（DELETE/DROP/TRUNCATE），可能导致数据丢失');
  }
  if (lowerSql.includes('update') && !lowerSql.includes('where')) {
    risks.push('UPDATE 语句缺少 WHERE 条件，将更新全表数据');
  }
  if (lowerSql.includes('select') && !lowerSql.includes('where') && !lowerSql.includes('limit')) {
    warnings.push('SELECT 语句无 WHERE 条件且无 LIMIT，可能返回大量数据');
  }
  if (lowerSql.includes('--') || lowerSql.includes('/*')) {
    warnings.push('SQL 中包含注释，请确认非 SQL 注入');
  }
  if (lowerSql.includes(';') && lowerSql.indexOf(';') < lowerSql.length - 1) {
    risks.push('检测到多条 SQL 语句拼接，可能存在 SQL 注入风险');
  }
  if (!lowerSql.includes('select') && !lowerSql.includes('insert') && !lowerSql.includes('update') && !lowerSql.includes('delete')) {
    warnings.push('未识别到标准 SQL 操作关键字');
  }

  const level: SqlAuditResult['level'] = risks.length > 0 ? 'danger' : warnings.length > 0 ? 'warning' : 'safe';
  return { safe: risks.length === 0, warnings, risks, level };
}
