import type { ComponentDefinition } from '@/types';

export const APP_ICONS = [
  'AppstoreOutlined',
  'FileTextOutlined',
  'ShoppingCartOutlined',
  'TeamOutlined',
  'ProjectOutlined',
  'CalendarOutlined',
  'MailOutlined',
  'SettingOutlined',
  'BarChartOutlined',
  'FundOutlined',
  'CloudOutlined',
  'ContainerOutlined',
];

export const MODULE_ICONS: Record<string, string> = {
  FORM: 'FileTextOutlined',
  FLOW: 'NodeIndexOutlined',
  BOARD: 'DashboardOutlined',
  PAGE: 'LayoutOutlined',
};

export const MODULE_TYPE_LABELS: Record<string, string> = {
  FORM: '表单',
  FLOW: '流程',
  BOARD: '看板',
  PAGE: '页面',
};

export const COMPONENT_DEFINITIONS: ComponentDefinition[] = [
  {
    type: 'text',
    label: '单行文本',
    category: 'basic',
    defaultProps: { label: '单行文本', fieldKey: 'field_text', width: '100%' },
  },
  {
    type: 'textarea',
    label: '多行文本',
    category: 'basic',
    defaultProps: { label: '多行文本', fieldKey: 'field_textarea', width: '100%' },
  },
  {
    type: 'number',
    label: '数字',
    category: 'basic',
    defaultProps: { label: '数字', fieldKey: 'field_number', width: '100%', precision: 0 },
  },
  {
    type: 'radio',
    label: '单选框组',
    category: 'basic',
    defaultProps: {
      label: '单选框组',
      fieldKey: 'field_radio',
      width: '100%',
      options: [
        { label: '选项1', value: '1' },
        { label: '选项2', value: '2' },
      ],
    },
  },
  {
    type: 'checkbox',
    label: '多选框组',
    category: 'basic',
    defaultProps: {
      label: '多选框组',
      fieldKey: 'field_checkbox',
      width: '100%',
      options: [
        { label: '选项1', value: '1' },
        { label: '选项2', value: '2' },
      ],
    },
  },
  {
    type: 'select',
    label: '下拉选择',
    category: 'basic',
    defaultProps: {
      label: '下拉选择',
      fieldKey: 'field_select',
      width: '100%',
      options: [
        { label: '选项1', value: '1' },
        { label: '选项2', value: '2' },
      ],
    },
  },
  {
    type: 'date',
    label: '日期',
    category: 'basic',
    defaultProps: { label: '日期', fieldKey: 'field_date', width: '100%' },
  },
  {
    type: 'switch',
    label: '开关',
    category: 'basic',
    defaultProps: { label: '开关', fieldKey: 'field_switch', width: '100%' },
  },
  {
    type: 'upload',
    label: '附件上传',
    category: 'basic',
    defaultProps: {
      label: '附件上传',
      fieldKey: 'field_upload',
      width: '100%',
      accept: 'all',
      maxFileSize: 10,
      maxFileCount: 5,
    },
  },
  {
    type: 'divider',
    label: '分隔线',
    category: 'layout',
    defaultProps: { label: '分隔线', fieldKey: 'field_divider', width: '100%' },
  },
  {
    type: 'group',
    label: '分组容器',
    category: 'layout',
    defaultProps: { label: '分组', fieldKey: 'field_group', width: '100%' },
  },
];
