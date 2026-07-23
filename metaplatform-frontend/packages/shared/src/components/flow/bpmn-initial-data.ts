/**
 * 请假审批流程初始数据
 * --------------------------------------------------
 * 用于替换 portal ProcessDesignerPage 的静态 SVG。
 * 数据是业务模型 { nodes, edges }，由 FlowCanvas 内部渲染。
 */
import type { FlowData } from './flow-types';

export const LEAVE_FLOW_INITIAL_DATA: FlowData = {
  nodes: [
    {
      id: 'start_1',
      type: 'bpmn.start',
      name: '开始',
      x: 60,
      y: 60,
      width: 40,
      height: 40,
    },
    {
      id: 'submit_1',
      type: 'bpmn.userTask',
      name: '提交申请',
      x: 165,
      y: 35,
      width: 130,
      height: 50,
      data: { assignee: '申请人', multiInstance: 'none' },
    },
    {
      id: 'mgr_1',
      type: 'bpmn.userTask',
      name: '主管审批',
      x: 355,
      y: 35,
      width: 140,
      height: 50,
      data: { assignee: '部门经理', multiInstance: 'none', timeoutHours: 24 },
    },
    {
      id: 'gw_1',
      type: 'bpmn.exclusiveGateway',
      name: '审批决策',
      x: 555,
      y: 60,
      width: 40,
      height: 40,
    },
    {
      id: 'hr_1',
      type: 'bpmn.serviceTask',
      name: 'HR 备案',
      x: 650,
      y: 155,
      width: 130,
      height: 50,
      data: { endpoint: 'hr.archive', retryTimes: 3 },
    },
    {
      id: 'notify_1',
      type: 'bpmn.serviceTask',
      name: '通知申请人',
      x: 255,
      y: 325,
      width: 150,
      height: 50,
      data: { endpoint: 'notify.user', retryTimes: 1 },
    },
    {
      id: 'end_1',
      type: 'bpmn.end',
      name: '结束',
      x: 460,
      y: 460,
      width: 40,
      height: 40,
    },
  ],
  edges: [
    { id: 'e1', source: 'start_1', target: 'submit_1' },
    { id: 'e2', source: 'submit_1', target: 'mgr_1' },
    { id: 'e3', source: 'mgr_1', target: 'gw_1', label: '提交审批' },
    { id: 'e4', source: 'gw_1', target: 'hr_1', label: '批准' },
    { id: 'e5', source: 'gw_1', target: 'notify_1', label: '驳回' },
    { id: 'e6', source: 'hr_1', target: 'end_1' },
    { id: 'e7', source: 'notify_1', target: 'submit_1', label: '重新提交' },
  ],
};
