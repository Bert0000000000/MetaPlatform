import type { RenderNode } from '@/api/apphub/types';

/**
 * 后端 render_tree 暂为空（种子应用未填充 pages）时的演示数据：
 * 覆盖 page / form / flow / board 四种 node_type + 一个分组（带 children）。
 * 后端补全 render_tree 后自动接通，此兜底仅在 tree 为空时启用。
 */
export const DEMO_RENDER_TREE: RenderNode[] = [
  {
    node_type: 'page',
    title: '工作台',
    layout: {},
    children: [],
    config: {
      name: '工作台',
      widgets: [
        { id: 's1', type: 'stat', title: '今日申请', config: { value: '128', caption: '较昨日 +12%' }, position: { x: 0, y: 0, w: 1, h: 1 } },
        { id: 's2', type: 'stat', title: '待审批', config: { value: '9', caption: '3 条加急' }, position: { x: 1, y: 0, w: 1, h: 1 } },
        {
          id: 't1',
          type: 'table',
          title: '最近申请',
          dataSource: {
            type: 'static',
            filter: {
              a: { id: 'A-001', name: '设备采购', value: 3 },
              b: { id: 'A-002', name: '出差报销', value: 1 },
              c: { id: 'A-003', name: '请假申请', value: 2 },
            },
          },
          position: { x: 0, y: 1, w: 2, h: 1 },
        },
      ],
    },
  },
  {
    node_type: 'form',
    title: '提交申请',
    layout: {},
    children: [],
    config: {
      name: '通用申请表',
      description: '应用壳演示表单',
      submitText: '提交申请',
      submitAction: 'toast',
      fields: [
        { id: 'f1', type: 'text', label: '申请人', fieldKey: 'applicant', required: true, width: '50%' },
        {
          id: 'f2', type: 'select', label: '申请类型', fieldKey: 'type', required: true, width: '50%',
          options: [{ label: '采购', value: 'buy' }, { label: '报销', value: 'expense' }, { label: '请假', value: 'leave' }],
        },
        { id: 'f3', type: 'date', label: '申请日期', fieldKey: 'applyDate', width: '50%' },
        { id: 'f4', type: 'number', label: '金额', fieldKey: 'amount', width: '50%' },
        { id: 'f5', type: 'textarea', label: '事由说明', fieldKey: 'reason', width: '100%' },
        { id: 'f6', type: 'switch', label: '需要加急', fieldKey: 'urgent', width: '100%' },
      ],
    },
  },
  { node_type: 'flow', title: '审批流程', layout: {}, children: [], config: {} },
  {
    node_type: 'page',
    title: '更多',
    layout: {},
    children: [
      {
        node_type: 'page', title: '说明页', layout: {}, children: [],
        config: { name: '说明页', widgets: [{ id: 'x1', type: 'text', title: '说明', config: { text: '这是应用壳演示的一个子页面。' }, position: { x: 0, y: 0, w: 1, h: 1 } }] },
      },
      { node_type: 'board', title: '数据看板', layout: {}, children: [], config: {} },
    ],
    config: {},
  },
];
