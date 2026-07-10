/**
 * Ontology Engine 客户端 —— Sprint 0 主线程接入（HTTP 实现）
 * ────────────────────────────────────────────────────────────
 * v1.0.1 调整（详见 db/migrations/001_init.sql 末尾 ARCHITECTURE_NOTE）：
 *   ontology-engine 用作语义层（创建 ObjectType + 字段校验 + 生命周期）
 *   DDL（动态数据表）由 app-service 自身管理（见 db/connection.ts）。
 *
 * 接口签名必须稳定，由 Sprint 1 业务调用。
 */

import { config } from "../config";

// ---------- 类型定义（与 ontology-engine 接口对齐） ----------

export type OntologyFieldType =
  | "string"
  | "number"
  | "boolean"
  | "date"
  | "enum"
  | "ref"
  | "longtext"
  | "datetime";

export interface OntologyFieldSpec {
  /** 字段英文代号，作为 form submit / object instance 的 key */
  code: string;
  /** 中文显示名 */
  name: string;
  /** 字段类型（映射 ontology-engine 的 String/Number/...） */
  type: OntologyFieldType;
  required?: boolean;
  /** enum 选项 */
  options?: { value: string; label: string }[];
  /** ref 类型指向另一个对象的 code */
  refObjectTypeCode?: string;
}

export interface CreateObjectTypeInput {
  code: string;
  name: string;
  description?: string;
  fields: OntologyFieldSpec[];
}

export interface CreatedObjectType {
  /** ontology-engine 返回的 ObjectType ID（字符串） */
  id: string;
  code: string;
  /** 物理数据表名（v1.0.1 由 app-service 自己建，外部接口只透传 code 即可） */
  tableName?: string;
}

export interface OntologyClient {
  createObjectType(input: CreateObjectTypeInput): Promise<CreatedObjectType>;
  getObjectType(id: string): Promise<CreatedObjectType | null>;
  getObjectTypeByCode(code: string): Promise<CreatedObjectType | null>;
  updateObjectType(
    id: string,
    input: Partial<CreateObjectTypeInput>,
  ): Promise<CreatedObjectType>;
  dropObjectType(id: string): Promise<void>;
  validateFieldValue(input: {
    type: OntologyFieldType | string;
    value: unknown;
  }): Promise<{ valid: boolean; message?: string }>;
  createObjectInstance(input: {
    objectTypeId: string;
    tenantId: string;
    payload: Record<string, unknown>;
  }): Promise<{ id: string }>;
}

// ---------- HTTP 客户端实现 ----------

const FIELD_TYPE_TO_ONTOLOGY: Record<OntologyFieldType, string> = {
  string: "String",
  longtext: "String",
  number: "Number",
  boolean: "Boolean",
  date: "Date",
  datetime: "Date",
  enum: "Enum",
  ref: "Ref",
};

class HttpOntologyClient implements OntologyClient {
  private baseUrl: string;
  private fetchImpl: typeof fetch;

  constructor(baseUrl: string, fetchImpl?: typeof fetch) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.fetchImpl = fetchImpl ?? globalThis.fetch.bind(globalThis);
  }

  private async req<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const res = await this.fetchImpl(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (res.status === 404) {
      return null as unknown as T;
    }

    const text = await res.text();
    let parsed: unknown = null;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }
    }

    if (!res.ok) {
      throw new OntologyClientError(
        `ontology-engine ${method} ${path} -> ${res.status}: ${
          typeof parsed === "string" ? parsed : JSON.stringify(parsed)
        }`,
        res.status,
      );
    }

    return parsed as T;
  }

  async createObjectType(input: CreateObjectTypeInput): Promise<CreatedObjectType> {
    const body = {
      code: input.code,
      displayName: input.name,
      description: input.description ?? "",
      entityTypeId: "metaplatform-app-default", // v1.0.1 默认实体类型
      fieldDefinitions: input.fields.map((f) => ({
        name: f.code,
        displayName: f.name,
        fieldType: FIELD_TYPE_TO_ONTOLOGY[f.type] ?? "String",
        required: !!f.required,
        editable: true,
        defaultValue: "",
        description: "",
      })),
      validationRules: [],
      lifecycleTransitions: [],
      lifecycleStates: ["draft", "submitted"],
      initialState: "draft",
    };
    const result = await this.req<any>(
      "POST",
      "/api/v1/object-types",
      body,
    );
    return { id: result.id, code: result.code ?? input.code };
  }

  async getObjectType(id: string): Promise<CreatedObjectType | null> {
    const result = await this.req<any>("GET", `/api/v1/object-types/${id}`);
    return result ? { id: result.id, code: result.code } : null;
  }

  async getObjectTypeByCode(code: string): Promise<CreatedObjectType | null> {
    const result = await this.req<any>("GET", `/api/v1/object-types/code/${encodeURIComponent(code)}`);
    return result ? { id: result.id, code: result.code } : null;
  }

  async updateObjectType(
    id: string,
    input: Partial<CreateObjectTypeInput>,
  ): Promise<CreatedObjectType> {
    const body = {
      code: input.code ?? "",
      displayName: input.name ?? "",
      description: input.description ?? "",
      entityTypeId: "metaplatform-app-default",
      fieldDefinitions: (input.fields ?? []).map((f) => ({
        name: f.code,
        displayName: f.name,
        fieldType: FIELD_TYPE_TO_ONTOLOGY[f.type] ?? "String",
        required: !!f.required,
        editable: true,
        defaultValue: "",
        description: "",
      })),
    };
    const result = await this.req<any>("PUT", `/api/v1/object-types/${id}`, body);
    return { id: result.id, code: result.code };
  }

  async dropObjectType(id: string): Promise<void> {
    await this.req<any>("DELETE", `/api/v1/object-types/${id}`);
  }

  async validateFieldValue(input: {
    type: OntologyFieldType | string;
    value: unknown;
  }): Promise<{ valid: boolean; message?: string }> {
    // 本地优先做基础校验，避免每次都打 HTTP
    const v = input.value;
    switch (input.type) {
      case "number":
        if (typeof v !== "number" && !(typeof v === "string" && v.trim() !== "" && !isNaN(Number(v)))) {
          return { valid: false, message: "字段必须为数字" };
        }
        return { valid: true };
      case "boolean":
        return { valid: typeof v === "boolean" || v === "true" || v === "false" };
      case "date":
      case "datetime":
        if (typeof v !== "string") return { valid: false };
        return { valid: !isNaN(Date.parse(v)) };
      default:
        return { valid: v === null || v === undefined || typeof v === "string" };
    }
  }

  async createObjectInstance(input: {
    objectTypeId: string;
    tenantId: string;
    payload: Record<string, unknown>;
  }): Promise<{ id: string }> {
    const url = `/api/v1/object-instances?objectTypeId=${encodeURIComponent(
      input.objectTypeId,
    )}&tenantId=${encodeURIComponent(input.tenantId)}`;
    const result = await this.req<any>("POST", url, {
      fieldValues: input.payload,
    });
    return { id: result.id };
  }
}

export class OntologyClientError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "OntologyClientError";
  }
}

// 单例
export const ontologyClient: OntologyClient = new HttpOntologyClient(
  config.ontologyEngineUrl,
);

// 测试用：注入 mock
export function createOntologyClientForTest(
  fetchImpl: typeof fetch,
): OntologyClient {
  return new HttpOntologyClient(config.ontologyEngineUrl, fetchImpl);
}
