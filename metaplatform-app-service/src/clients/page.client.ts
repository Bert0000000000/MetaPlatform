/**
 * Page Generator 客户端 —— Sprint 0 骨架（待主线程接入）
 * ────────────────────────────────────────────────────────────
 * 后端服务地址：默认 http://localhost:8083（参考 05-architecture.md §3.2）
 *
 * 主线程后续要接入的方法：
 *  1) validateSchema({ formCode, schemaJson })
 *        POST {pageGeneratorUrl}/api/v1/forms/validate
 *        用途：表单保存前校验 schema 是否合法（控件引用、字段类型一致等）；
 *  2) renderForm({ formCode, schemaJson, mode: 'preview' | 'runtime' })
 *        POST {pageGeneratorUrl}/api/v1/forms/render
 *        用途：返回 HTML / JSON AST 给前端嵌入预览 iframe；
 *  3) renderListPage({ objectTypeId, columns, filters })
 *        POST {pageGeneratorUrl}/api/v1/list-pages/render
 *        用途：根据对象字段动态生成列表页配置（列定义、过滤项、默认排序）。
 *
 * 调用约定：
 *  - 单向弱耦合（仅校验），失败仅记录日志，不阻断主流程；
 *  - 但 renderForm 失败应抛 BadRequestError（schema 不合法）。
 */
import { config } from "../config";

export interface FormSchemaJson {
  version: number;
  widgets: unknown[];
  layout?: unknown;
}

export interface PageClient {
  validateSchema(input: { formCode: string; schema: FormSchemaJson }): Promise<{ ok: boolean; errors?: string[] }>;
  renderForm(input: { formCode: string; schema: FormSchemaJson; mode: "preview" | "runtime" }): Promise<{ html?: string; ast?: unknown }>;
  renderListPage(input: { objectTypeId: number; columns?: string[]; filters?: unknown }): Promise<unknown>;
}

/**
 * Sprint 0 占位实现：所有方法抛错，提示尚未接入。
 * 主线程在 T0-5 任务里把它替换成真实的 HTTP 客户端。
 */
export class StubPageClient implements PageClient {
  async validateSchema(): Promise<{ ok: boolean; errors?: string[] }> {
    throw new Error(
      `[page.client] validateSchema not implemented. ` +
        `Will call POST ${config.pageGeneratorUrl}/api/v1/forms/validate`,
    );
  }
  async renderForm(): Promise<{ html?: string; ast?: unknown }> {
    throw new Error(
      `[page.client] renderForm not implemented. ` +
        `Will call POST ${config.pageGeneratorUrl}/api/v1/forms/render`,
    );
  }
  async renderListPage(): Promise<unknown> {
    throw new Error(
      `[page.client] renderListPage not implemented. ` +
        `Will call POST ${config.pageGeneratorUrl}/api/v1/list-pages/render`,
    );
  }
}

export const pageClient: PageClient = new StubPageClient();
