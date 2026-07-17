export interface PageResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ============ Capability (P3-ARCH-01~03) ============
export interface Capability {
  capabilityId: string;
  name: string;
  code: string;
  description?: string;
  level: number;
  parentCapabilityId?: string;
  parentName?: string;
  status: 'active' | 'deprecated' | 'planned';
  children?: Capability[];
  createdAt?: string;
  updatedAt?: string;
}

export interface CapabilityCreateRequest {
  name: string;
  code: string;
  description?: string;
  parentCapabilityId?: string;
  status?: string;
}

// ============ Application (P3-ARCH-04, 05) ============
export interface ArchApplication {
  appId: string;
  name: string;
  code: string;
  description?: string;
  status: 'active' | 'deprecated' | 'planned';
  technologyStack?: string;
  owner?: string;
  capabilityIds: string[];
  dependencyAppIds: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface ArchAppCreateRequest {
  name: string;
  code: string;
  description?: string;
  status?: string;
  technologyStack?: string;
  owner?: string;
  capabilityIds?: string[];
  dependencyAppIds?: string[];
}

// ============ Value Stream (P3-ARCH-06) ============
export interface ValueStream {
  id: string;
  name: string;
  description?: string;
  stages: ValueStreamStage[];
  status: 'active' | 'draft';
  createdAt?: string;
}

export interface ValueStreamStage {
  id: string;
  name: string;
  description?: string;
  capabilityIds: string[];
  order: number;
}

// ============ Business Process (P3-ARCH-07) ============
export interface BusinessProcess {
  id: string;
  name: string;
  code: string;
  description?: string;
  capabilityIds: string[];
  valueStreamId?: string;
  status: 'active' | 'draft' | 'deprecated';
  steps?: string[];
  createdAt?: string;
}

// ============ Org & Role (P3-ARCH-08) ============
export interface OrgUnit {
  id: string;
  name: string;
  parentId?: string;
  parentName?: string;
  level: number;
  head?: string;
  description?: string;
  children?: OrgUnit[];
}

export interface ArchRole {
  id: string;
  name: string;
  code: string;
  description?: string;
  orgUnitId?: string;
  orgUnitName?: string;
  permissions: string[];
  userCount?: number;
}

// ============ Data Architecture (P3-ARCH-09) ============
export interface DataDomain {
  id: string;
  name: string;
  code: string;
  description?: string;
  parentId?: string;
}

export interface DataEntity {
  id: string;
  name: string;
  code: string;
  domainId?: string;
  description?: string;
  fields: DataField[];
}

export interface DataField {
  name: string;
  type: string;
  required: boolean;
  description?: string;
}

export interface DataFlow {
  id: string;
  name: string;
  sourceEntityId: string;
  targetEntityId: string;
  description?: string;
}

// ============ Tech Architecture (P3-ARCH-10) ============
export interface TechStack {
  id: string;
  name: string;
  category: string;
  version?: string;
  description?: string;
  status: 'adopted' | 'trial' | 'deprecated';
}

export interface Infrastructure {
  id: string;
  name: string;
  type: string;
  spec?: string;
  description?: string;
  status: 'active' | 'maintenance' | 'offline';
}

// ============ Governance (P3-ARCH-11~13) ============
export interface Principle {
  id: string;
  name: string;
  code: string;
  description?: string;
  category: string;
  priority: 'high' | 'medium' | 'low';
  standards: string[];
}

export interface ReviewItem {
  id: string;
  title: string;
  type: 'architecture' | 'design' | 'change';
  status: 'pending' | 'approved' | 'rejected' | 'revision';
  applicant: string;
  reviewer?: string;
  description?: string;
  comments: ReviewComment[];
  createdAt?: string;
  reviewedAt?: string;
}

export interface ReviewComment {
  id: string;
  author: string;
  content: string;
  type: 'comment' | 'approve' | 'reject';
  createdAt: string;
}

export interface TechDebt {
  id: string;
  name: string;
  description?: string;
  category: 'code' | 'architecture' | 'infrastructure' | 'dependency';
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'open' | 'in_progress' | 'resolved';
  owner?: string;
  dueDate?: string;
  complianceScore?: number;
}

// ============ Ontology Mapping (P3-ARCH-14) ============
export interface OntologyMapping {
  capabilityId: string;
  capabilityName: string;
  conceptId: string;
  conceptName: string;
  mappingType: 'direct' | 'partial' | 'planned';
  confidence: number;
}

export interface ImpactAnalysisResult {
  affectedCapabilities: string[];
  affectedApplications: string[];
  affectedProcesses: string[];
  riskLevel: 'high' | 'medium' | 'low';
}
