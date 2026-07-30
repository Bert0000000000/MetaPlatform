/**
 * Action 编排的领域数据。
 *
 * 临时从原 OntologyActionPage 提取的 seed；未来由 /api/v1/superai/actions
 * (已存在 listActions) 替换。允许 us 业务层先按现有 UI 排版，把 controller
 * 抽成独立 hook。
 */
import {
  Search,
  Calculator,
  Bell,
  GitBranch,
  Plug,
  Webhook,
  type LucideIcon,
} from 'lucide-react';

export type ActionType =
  | 'search'
  | 'compute'
  | 'notification'
  | 'approval'
  | 'erp_sync'
  | 'webhook';

export interface SeedAction {
  id: string;
  name: string;
  type: ActionType;
  iconName: 'Search' | 'Calculator' | 'Bell' | 'GitBranch' | 'Plug' | 'Webhook';
  enabled: boolean;
}

export const SEED_ACTIONS: readonly SeedAction[] = [
  { id: 'act-1', name: '涓诲姟璇婃棭', type: 'search', iconName: 'Search', enabled: true },
  { id: 'act-2', name: '椋庨櫓璇勪及璁＄畻', type: 'compute', iconName: 'Calculator', enabled: true },
  { id: 'act-3', name: '鍙戦€佸鎵归€氱煡', type: 'notification', iconName: 'Bell', enabled: true },
  { id: 'act-4', name: '鍚堝悓瀹℃壒娴佺▼', type: 'approval', iconName: 'GitBranch', enabled: true },
  { id: 'act-5', name: 'ERP 鏁版嵁鍚屾', type: 'erp_sync', iconName: 'Plug', enabled: true },
  { id: 'act-6', name: 'Webhook 澶栭儴闆嗘垚', type: 'webhook', iconName: 'Webhook', enabled: false },
];

export const ICON_REGISTRY: Record<SeedAction['iconName'], LucideIcon> = {
  Search,
  Calculator,
  Bell,
  GitBranch,
  Plug,
  Webhook,
};

export interface SeedInputParam {
  name: string;
  type: 'String' | 'Object' | 'Enum';
  required: boolean;
  desc: string;
}

export const SEED_INPUT_PARAMS: readonly SeedInputParam[] = [
  { name: 'recipient_id', type: 'String', required: true, desc: '??? ID' },
  { name: 'approval_data', type: 'Object', required: true, desc: '????' },
  { name: 'channel', type: 'Enum', required: false, desc: '???? (im/email/sms)' },
];

export const SEED_RELATED_CONCEPTS: readonly string[] = ['閫氱煡', '瀹℃壒', '鐢ㄦ埛', '缁勭粐'];
export const SEED_RELATED_TRIGGERS: readonly string[] = [
  '瀹℃壒娴佺▼ - 鎻愪氦鑺傜偣',
  '瀹℃壒娴佺▼ - 鍌姙鑺傜偣',
];
