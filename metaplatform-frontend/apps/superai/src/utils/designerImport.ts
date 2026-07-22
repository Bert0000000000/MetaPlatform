import { message } from 'antd';
import type { GenerateType, GeneratedConfig } from '@/types';

const STORAGE_KEY = 'metaplatform:designer:import';

type DesignerModuleType = 'form' | 'flow' | 'page';

const TYPE_TO_MODULE: Partial<Record<GenerateType, DesignerModuleType>> = {
  form: 'form',
  process: 'flow',
  dashboard: 'page',
};

const URL_BY_MODULE: Record<DesignerModuleType, string> = {
  form: '/apphub/form-designer',
  flow: '/apphub/flow-designer',
  page: '/apphub/page-designer',
};

const MODULE_LABEL: Record<DesignerModuleType, string> = {
  form: '表单',
  flow: '流程',
  page: '页面',
};

/**
 * 把生成结果写入 localStorage 并在新标签页打开对应设计器，
 * 设计器挂载时会读取并消费该数据。
 */
export function importToDesigner(config: GeneratedConfig): void {
  const targetModuleType = TYPE_TO_MODULE[config.type];
  if (!targetModuleType) {
    message.warning('当前生成类型暂不支持导入到设计器');
    return;
  }

  const payload = {
    type: config.type,
    content: config.content,
    targetModuleType,
    timestamp: Date.now(),
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    message.error('写入本地存储失败，请检查浏览器存储权限');
    return;
  }

  const url = URL_BY_MODULE[targetModuleType];
  window.open(url, '_blank');
  message.success(`已跳转到${MODULE_LABEL[targetModuleType]}设计器`);
}
