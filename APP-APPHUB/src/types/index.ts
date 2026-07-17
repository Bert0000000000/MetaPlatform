export type AppStatus = 'DESIGNING' | 'PUBLISHED' | 'OFFLINE';
export type ModuleType = 'FORM' | 'FLOW' | 'BOARD' | 'PAGE';

export interface AppItem {
  appId: string;
  name: string;
  code: string;
  description?: string;
  icon?: string;
  group?: string;
  status: AppStatus;
  moduleCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AppCreateRequest {
  name: string;
  code: string;
  description?: string;
  icon?: string;
  group?: string;
}

export interface AppUpdateRequest {
  name?: string;
  description?: string;
  icon?: string;
  group?: string;
  status?: AppStatus;
}

export interface ModuleItem {
  moduleId: string;
  appId: string;
  name: string;
  code: string;
  type: ModuleType;
  description?: string;
  icon?: string;
  config?: FormConfig;
  createdAt: string;
  updatedAt: string;
}

export interface ModuleCreateRequest {
  appId: string;
  name: string;
  code: string;
  type: ModuleType;
  description?: string;
  icon?: string;
}

export interface ModuleUpdateRequest {
  name?: string;
  description?: string;
  icon?: string;
  config?: FormConfig;
}

export interface PageResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface FormField {
  id: string;
  type: string;
  label: string;
  fieldKey: string;
  placeholder?: string;
  defaultValue?: unknown;
  width?: '100%' | '50%' | '33%';
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  patternMessage?: string;
  readonly?: boolean;
  hidden?: boolean;
  helpText?: string;
  options?: Array<{ label: string; value: string }>;
  precision?: number;
  min?: number;
  max?: number;
  unit?: string;
  accept?: string;
  maxFileSize?: number;
  maxFileCount?: number;
}

export interface FormConfig {
  name: string;
  description?: string;
  submitText?: string;
  submitAction?: 'toast' | 'redirect' | 'flow';
  allowWithdraw?: boolean;
  allowEdit?: boolean;
  fields: FormField[];
}

export interface ComponentDefinition {
  type: string;
  label: string;
  category: 'basic' | 'advanced' | 'layout';
  defaultProps: Partial<FormField>;
}

// ============ Flow Designer Types (P2-APPHUB-01~05) ============

export type FlowNodeType = 'start' | 'approval' | 'condition' | 'end';

export type AssigneeType = 'person' | 'role' | 'department';
export type ApprovalMode = 'sequential' | 'parallel' | 'countersign';

export interface ApprovalNodeConfig {
  assigneeType: AssigneeType;
  assigneeIds: string[];
  approvalMode: ApprovalMode;
  approvalLevels: number;
  timeoutHours?: number;
  allowReject?: boolean;
  allowTransfer?: boolean;
  ccList?: string[];
}

export interface ConditionBranch {
  id: string;
  label: string;
  condition: string;
  targetNodeId?: string;
}

export interface ConditionNodeConfig {
  branches: ConditionBranch[];
  defaultBranch?: string;
}

export interface FlowNode {
  id: string;
  type: FlowNodeType;
  name: string;
  position: { x: number; y: number };
  config?: ApprovalNodeConfig | ConditionNodeConfig;
  formBindings?: FormFieldBinding[];
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  conditionValue?: string;
}

export interface FlowConfig {
  name: string;
  description?: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  formModuleId?: string;
}

export interface FormFieldBinding {
  fieldKey: string;
  fieldLabel: string;
  visible: boolean;
  required: boolean;
  readonly: boolean;
  defaultValue?: unknown;
}

export interface FlowValidationResult {
  valid: boolean;
  errors: FlowValidationError[];
  warnings: FlowValidationWarning[];
}

export interface FlowValidationError {
  nodeId?: string;
  edgeId?: string;
  code: string;
  message: string;
}

export interface FlowValidationWarning {
  nodeId?: string;
  code: string;
  message: string;
}

export interface FlowTestStep {
  stepIndex: number;
  nodeId: string;
  nodeName: string;
  nodeType: FlowNodeType;
  assignee?: string;
  action: 'submit' | 'approve' | 'reject' | 'condition_check' | 'complete';
  actionLabel: string;
  timestamp: string;
  status: 'completed' | 'current' | 'pending';
}

export interface FlowTestResult {
  steps: FlowTestStep[];
  finalStatus: 'approved' | 'rejected' | 'error';
  duration: number;
}
