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
  tenantId?: string;
  name: string;
  code: string;
  description?: string;
  triggerEvent?: string;
  terminationEvent?: string;
  stages: ValueStreamStage[];
  status: 'ACTIVE' | 'DRAFT' | 'active' | 'draft';
  createdAt?: string;
  updatedAt?: string;
}

export interface ValueStreamStage {
  id: string;
  valueStreamId?: string;
  tenantId?: string;
  name: string;
  description?: string;
  capabilityIds: string[];
  outputs: string[];
  participantRoleIds: string[];
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ValueStreamCreateRequest {
  name: string;
  code: string;
  description?: string;
  triggerEvent?: string;
  terminationEvent?: string;
  stages?: string[];
}

export interface ValueStreamStageCreateRequest {
  name: string;
  description?: string;
  capabilityIds?: string[];
  outputs?: string[];
  participantRoleIds?: string[];
  sortOrder?: number;
}

export interface ValueStreamStageUpdateRequest {
  name?: string;
  description?: string;
  capabilityIds?: string[];
  outputs?: string[];
  participantRoleIds?: string[];
  sortOrder?: number;
}

// ============ Business Process (P3-ARCH-07) ============
export interface BusinessProcess {
  id: string;
  tenantId?: string;
  name: string;
  code: string;
  description?: string;
  valueStreamId?: string;
  processType?: 'MAIN' | 'SUB' | 'main' | 'sub';
  frequency?: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY' | 'ONCE' | 'CONTINUOUS';
  capabilities?: string[];
  capabilityIds?: string[];
  applicationIds: string[];
  responsibleRoleIds: string[];
  processSteps: Record<string, unknown>[];
  steps?: string[];
  bpmnXml?: string;
  version?: number;
  status: 'ACTIVE' | 'DRAFT' | 'DEPRECATED' | 'active' | 'draft' | 'deprecated';
  createdAt?: string;
  updatedAt?: string;
}

export interface BusinessProcessCreateRequest {
  name: string;
  code: string;
  description?: string;
  valueStreamId?: string;
  processType?: string;
  frequency?: string;
  capabilities?: string[];
  applicationIds?: string[];
  responsibleRoleIds?: string[];
  processSteps?: Record<string, unknown>[];
  bpmnXml?: string;
}

export interface BusinessProcessUpdateRequest {
  name?: string;
  description?: string;
  valueStreamId?: string;
  processType?: string;
  frequency?: string;
  capabilities?: string[];
  applicationIds?: string[];
  responsibleRoleIds?: string[];
  processSteps?: Record<string, unknown>[];
  bpmnXml?: string;
  status?: string;
}

export interface LinkProcessRoleRequest {
  roleIds: string[];
  relationship?: string;
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
  tenantId?: string;
  name: string;
  code: string;
  description?: string;
  responsibility?: string;
  orgUnitId?: string;
  orgUnitName?: string;
  domain?: string;
  iamRoleIds: string[];
  permissions?: string[];
  userCount?: number;
  processCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateRoleRequest {
  name: string;
  code: string;
  description?: string;
  responsibility?: string;
  orgUnitId?: string;
  domain?: string;
  iamRoleIds?: string[];
}

export interface UpdateRoleRequest {
  name?: string;
  description?: string;
  responsibility?: string;
  orgUnitId?: string;
  domain?: string;
  iamRoleIds?: string[];
}

// ============ Data Architecture (P3-ARCH-09) ============
export interface DataDomain {
  id: string;
  name: string;
  code: string;
  description?: string;
  parentId?: string;
}

export interface DataField {
  name: string;
  type: string;
  length?: number;
  required?: boolean;
  defaultValue?: string;
  description?: string;
}

export interface DataEntity {
  id: string;
  name: string;
  code: string;
  domainId?: string;
  description?: string;
  entityType?: string;
  fields: DataField[];
}

export interface DataFlow {
  id: string;
  name: string;
  sourceEntityId: string;
  targetEntityId: string;
  flowType?: string;
  description?: string;
  schedule?: string;
}

export interface DataStandard {
  id: string;
  code: string;
  name: string;
  standardType: string;
  rule?: string;
  description?: string;
}

export interface DataAsset {
  id: string;
  name: string;
  code: string;
  assetType: string;
  description?: string;
  entityId?: string;
  classification?: string;
  metadata?: string;
  tags?: string[];
}

export interface DataAssetCatalog {
  groupBy: string;
  groups: {
    key: string;
    label: string;
    assets: DataAsset[];
  }[];
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

// ============ Governance (V13-10) ============
export interface PrincipleCategory {
  id: string;
  tenantId?: string;
  name: string;
  code: string;
  parentId?: string;
  description?: string;
  sortOrder?: number;
  metadata?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Principle {
  id: string;
  tenantId?: string;
  name: string;
  code: string;
  description?: string;
  categoryId?: string;
  categoryName?: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'ACTIVE' | 'INACTIVE';
  standards: string[];
  metadata?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ReviewDimension {
  name: string;
  weight?: number;
  maxScore?: number;
  description?: string;
}

export interface ReviewExpert {
  userId: string;
  name: string;
  role?: string;
}

export interface ReviewTemplate {
  id: string;
  tenantId?: string;
  name: string;
  code: string;
  description?: string;
  dimensions: ReviewDimension[];
  experts: ReviewExpert[];
  metadata?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ReviewScoreItem {
  dimension: string;
  score?: number;
  comment?: string;
}

export interface ReviewComment {
  action: 'COMMENT' | 'APPROVE' | 'REJECT';
  author?: string;
  content: string;
  createdAt: string;
}

export interface ReviewTicket {
  id: string;
  tenantId?: string;
  title: string;
  templateId?: string;
  templateName?: string;
  targetType?: string;
  targetId?: string;
  applicant?: string;
  reviewer?: string;
  status: 'CREATED' | 'REVIEWING' | 'APPROVED' | 'REJECTED';
  scores: ReviewScoreItem[];
  comments: ReviewComment[];
  decision?: string;
  submittedAt?: string;
  decidedAt?: string;
  metadata?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface TechDebt {
  id: string;
  tenantId?: string;
  title: string;
  code: string;
  description?: string;
  category?: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'WONT_FIX';
  scopeType?: 'APPLICATION' | 'TECH_STACK' | 'INFRASTRUCTURE' | 'DATA_ENTITY';
  scopeId?: string;
  impactScore?: number;
  remediation?: string;
  estimatedEffort?: string;
  owner?: string;
  debtLevel: 'FATAL' | 'SERIOUS' | 'GENERAL' | 'MINOR';
  repaymentPlan: RepaymentPlan;
  metadata?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface RepaymentPlan {
  targetDate?: string;
  milestones?: RepaymentMilestone[];
  budget?: string;
  owner?: string;
  notes?: string;
}

export interface RepaymentMilestone {
  name: string;
  targetDate?: string;
  status?: 'PENDING' | 'DONE';
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

export interface ConceptMappingRule {
  id: string;
  tenantId?: string;
  assetType: 'CAPABILITY' | 'APPLICATION';
  assetId: string;
  assetName?: string;
  conceptId: string;
  conceptCode?: string;
  mappingType: 'DIRECT' | 'DERIVED' | 'ABSTRACT';
  description?: string;
  metadata?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateMappingRuleRequest {
  assetType: string;
  assetId: string;
  assetName?: string;
  conceptId: string;
  conceptCode?: string;
  mappingType: string;
  description?: string;
  metadata?: string;
}

export type UpdateMappingRuleRequest = Partial<CreateMappingRuleRequest>;

export interface SyncResult {
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  failedCount: number;
  syncedConceptIds: string[];
  failedAssetIds: string[];
  summary: string;
}

export interface OntologyChangeEvent {
  id: string;
  tenantId?: string;
  conceptId: string;
  conceptCode?: string;
  conceptName?: string;
  changeType: string;
  ruleId?: string;
  assetType?: string;
  assetId?: string;
  status: 'PENDING' | 'PROCESSED';
  reviewTicketId?: string;
  payload?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface OntologyConcept {
  id: string;
  name: string;
  definition?: string;
  tags?: string[];
}

// ============ Technology Architecture Depth (V13-09) ============
export interface TechnologyComponent {
  id: string;
  name: string;
  type: 'database' | 'framework' | 'middleware' | 'language' | 'tool' | 'infrastructure' | 'other';
  version?: string;
  description?: string;
  owner?: string;
  status: 'active' | 'deprecated' | 'planned';
  createdAt?: string;
  updatedAt?: string;
}

export interface TechnologyStackComponentRef {
  componentId: string;
  componentName?: string;
  version?: string;
  type?: string;
}

export interface TechnologyStack {
  id: string;
  applicationId?: string;
  applicationName?: string;
  name: string;
  description?: string;
  components: TechnologyStackComponentRef[];
  status: 'active' | 'draft' | 'archived';
  createdAt?: string;
  updatedAt?: string;
}

export interface DeploymentNode {
  id: string;
  name: string;
  type: string;
  x?: number;
  y?: number;
  status?: string;
  metadata?: Record<string, unknown>;
}

export interface DeploymentEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  status?: string;
}

export interface DeploymentTopology {
  id: string;
  name: string;
  environment: 'dev' | 'test' | 'staging' | 'prod';
  nodes: DeploymentNode[];
  edges: DeploymentEdge[];
  healthStatus: 'healthy' | 'warning' | 'critical';
  createdAt?: string;
  updatedAt?: string;
}

export interface TechnologyRadarItem {
  id: string;
  name: string;
  quadrant: string;
  ring: string;
  trend?: 'up' | 'down' | 'stable';
  description?: string;
}

export interface TechnologyRadar {
  id: string;
  name: string;
  quadrants: string[];
  rings: string[];
  items: TechnologyRadarItem[];
  status: 'active' | 'draft' | 'archived';
  createdAt?: string;
  updatedAt?: string;
}
