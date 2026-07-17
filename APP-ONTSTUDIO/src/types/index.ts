export interface ApiResponse<T> {
  code: string;
  message: string;
  data: T;
  traceId?: string;
}

export interface PageResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface Concept {
  conceptId: string;
  tenantId: string;
  code: string;
  name: string;
  description?: string;
  parentConceptId?: string;
  parentConceptName?: string;
  icon?: string;
  metadata?: Record<string, unknown>;
  depth?: number;
  level?: number;
  path?: string;
  status: string;
  attributeIds?: string[];
  attributeCount?: number;
  entityCount?: number;
  childCount?: number;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
}

export interface ConceptCreateRequest {
  code: string;
  name: string;
  description?: string;
  parentConceptId?: string;
  icon?: string;
  metadata?: Record<string, unknown>;
  attributeIds?: string[];
}

export interface ConceptUpdateRequest extends ConceptCreateRequest {}

export interface ConceptHierarchyNode {
  conceptId: string;
  code: string;
  name: string;
  level: number;
  children?: ConceptHierarchyNode[];
}

export interface ConceptHierarchyResponse {
  rootConceptId?: string;
  nodes: ConceptHierarchyNode[];
}

export interface Attribute {
  attributeId: string;
  tenantId: string;
  code: string;
  name: string;
  description?: string;
  dataType: string;
  required?: boolean;
  unique?: boolean;
  defaultValue?: unknown;
  enumValues?: Array<Record<string, string>>;
  constraints?: Record<string, unknown>;
  unit?: string;
  conceptCount?: number;
  concepts?: Array<{ conceptId: string; conceptName: string }>;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
}

export interface AttributeCreateRequest {
  code: string;
  name: string;
  description?: string;
  dataType: string;
  required?: boolean;
  unique?: boolean;
  defaultValue?: unknown;
  enumValues?: Array<Record<string, string>>;
  constraints?: Record<string, unknown>;
  unit?: string;
}

export interface AttributeUpdateRequest extends AttributeCreateRequest {}

export interface EntityAttributeValue {
  attributeId: string;
  attributeName?: string;
  attributeCode?: string;
  dataType?: string;
  value?: unknown;
}

export interface Entity {
  entityId: string;
  tenantId: string;
  conceptId: string;
  conceptName?: string;
  code?: string;
  name: string;
  description?: string;
  attributes?: Record<string, EntityAttributeValue>;
  metadata?: Record<string, unknown>;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
}

export interface EntityCreateRequest {
  conceptId: string;
  name: string;
  code?: string;
  description?: string;
  attributes?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface EntityUpdateRequest extends EntityCreateRequest {}

export interface SearchResult {
  type: 'concept' | 'entity';
  id: string;
  code?: string;
  name: string;
  description?: string;
  conceptName?: string;
}

export const DATA_TYPES = [
  { label: '字符串', value: 'String' },
  { label: '整数', value: 'Integer' },
  { label: '长整数', value: 'Long' },
  { label: '浮点数', value: 'Double' },
  { label: '布尔', value: 'Boolean' },
  { label: '日期', value: 'Date' },
  { label: '日期时间', value: 'DateTime' },
  { label: 'Decimal', value: 'Decimal' },
  { label: 'JSON', value: 'JSON' },
  { label: '引用', value: 'Reference' },
];
