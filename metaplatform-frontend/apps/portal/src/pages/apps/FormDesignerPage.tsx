import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText, Undo2, Redo2, Eye, Upload, Save, X,
  Search, Type, AlignLeft, Hash, Calendar, ChevronDown,
  CircleDot, CheckSquare, Paperclip, UserCheck, Building2, Table, Minus,
  CreditCard, Smartphone, Users, CalendarRange, BarChart3, Tag,
  Table2, MapPin, Map, Banknote, FileSignature, GitBranch, Link,
  TableProperties, Star, PenTool, ScanLine, Sparkles,
  Copy, Trash2, FunctionSquare, Check, ShieldCheck, Plus,
  LayoutGrid, Layers, Monitor, Tablet, Smartphone as PhoneIcon,
  ZoomIn, ZoomOut, Component, Navigation, Locate,
} from 'lucide-react';
import AppHeader from '@/components/AppHeader';
import { useAppTabs } from '@/store/appTabs';

const APP_SUB_TABS = [
  { label: '应用详情', path: '/apps/detail' },
  { label: '数据建模', path: '/apps/modeling' },
  { label: '表单设计器', path: '/apps/formdesigner' },
  { label: '流程设计器', path: '/apps/processdesigner' },
  { label: '应用配置', path: '/apps/config' },
  { label: '发布管理', path: '/apps/publish' },
  { label: '版本管理', path: '/apps/version' },
];

// MOCK: 组件面板数据
const PALETTE_GROUPS = [
  { title: '基础组件', items: [
    { icon: Type, name: '单行文本', tag: 'T' },
    { icon: AlignLeft, name: '多行文本', tag: 'T+' },
    { icon: Hash, name: '数字', tag: '#' },
    { icon: Calendar, name: '日期', tag: 'D' },
  ]},
  { title: '选择组件', items: [
    { icon: ChevronDown, name: '下拉选择', tag: 'v' },
    { icon: CircleDot, name: '单选', tag: 'R' },
    { icon: CheckSquare, name: '多选', tag: 'C' },
  ]},
  { title: '高级组件', items: [
    { icon: Paperclip, name: '附件上传', tag: 'F' },
    { icon: UserCheck, name: '人员选择', tag: 'P' },
    { icon: Building2, name: '部门选择', tag: 'D' },
    { icon: Table, name: '子表格', tag: 'G' },
    { icon: Minus, name: '分割线', tag: '--' },
  ]},
  { title: '业务组件', items: [
    { icon: CreditCard, name: '身份证号', tag: 'ID' },
    { icon: Smartphone, name: '手机号', tag: 'PH' },
    { icon: Users, name: '人员选择(头像)', tag: 'PA' },
    { icon: CalendarRange, name: '日期范围', tag: 'DR' },
    { icon: BarChart3, name: '甘特图', tag: 'GT' },
    { icon: Hash, name: '统计卡片', tag: 'SC' },
    { icon: Tag, name: '标签/徽章', tag: 'TG' },
    { icon: Table2, name: '数据表格', tag: 'DT' },
    { icon: MapPin, name: '地址选择', tag: 'AD' },
    { icon: Map, name: '地图定位', tag: 'MP' },
    { icon: Banknote, name: '金额输入', tag: 'AM' },
    { icon: FileSignature, name: '大写金额', tag: 'UC' },
    { icon: Building2, name: '部门选择', tag: 'DP' },
    { icon: GitBranch, name: '级联选择', tag: 'CC' },
    { icon: Link, name: '关联记录', tag: 'RF' },
    { icon: TableProperties, name: '子表单', tag: 'ST' },
    { icon: Star, name: '评分组件', tag: 'RT' },
    { icon: PenTool, name: '手写签名', tag: 'SG' },
    { icon: FileText, name: '富文本编辑', tag: 'RE' },
    { icon: Hash, name: '自动编号', tag: 'AN' },
    { icon: ScanLine, name: 'OCR 识别', tag: 'OC' },
    { icon: Sparkles, name: 'AI 对话', tag: 'AI' },
  ]},
];

// MOCK: 选项列表
const OPTIONS = [
  { label: '年假', value: 'annual', default: true },
  { label: '事假', value: 'personal', default: false },
  { label: '病假', value: 'sick', default: false },
  { label: '婚假', value: 'marriage', default: false },
  { label: '产假', value: 'maternity', default: false },
  { label: '陪产假', value: 'paternity', default: false },
];

export default function FormDesignerPage() {
  const navigate = useNavigate();
  const [device, setDevice] = useState('desktop');
  const [selectedField, setSelectedField] = useState('leave_type');
  const { tabs, activeId } = useAppTabs();
  const active = tabs.find((t) => t.id === activeId) ?? tabs[0];
  const appId = active?.id ?? 'order-mgmt';
  const appName = active?.name ?? '订单管理系统';

  const canvasMaxWidth = device === 'mobile' ? 375 : device === 'tablet' ? 768 : '100%';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <AppHeader appId={appId} appName={appName} subTabs={APP_SUB_TABS} />

      {/* Top Bar */}
      <div style={{ padding: '12px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileText style={{ width: 16, height: 16, color: 'var(--muted-foreground)' }} />
            <h2 style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.02em' }}>请假申请表</h2>
            <span className="v-eyebrow" style={{ background: 'var(--muted)', padding: '2px 8px', borderRadius: 'var(--radius)' }}>编辑中</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="v-btn" style={{ height: 32, width: 32, padding: 0, justifyContent: 'center' }}><Undo2 style={{ width: 14, height: 14 }} /></button>
          <button className="v-btn" style={{ height: 32, width: 32, padding: 0, justifyContent: 'center' }}><Redo2 style={{ width: 14, height: 14 }} /></button>
          <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 4px' }} />
          <button className="v-btn"><Eye style={{ width: 14, height: 14 }} />预览</button>
          <button className="v-btn"><Upload style={{ width: 14, height: 14 }} />发布</button>
          <button className="v-btn-primary"><Save style={{ width: 14, height: 14 }} />保存</button>
        </div>
      </div>

      {/* Designer Area */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left: Palette */}
        <div style={{ width: 200, minWidth: 200, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', background: 'var(--background)' }}>
          <div style={{ padding: '14px 16px 10px', fontSize: 12, fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>组件面板</div>
          <div style={{ margin: '10px 12px 6px', position: 'relative' }}>
            <Search style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: 'var(--muted-foreground)' }} />
            <input type="text" placeholder="搜索组件..." style={{ width: '100%', background: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--foreground)', fontSize: 12, padding: '6px 8px 6px 30px', outline: 'none', fontFamily: 'var(--font-sans)' }} />
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 12px', display: 'flex', flexDirection: 'column', gap: 3 }}>
            {PALETTE_GROUPS.map((group, gi) => (
              <div key={gi}>
                <div style={{ padding: '8px 12px 4px', fontSize: 10, fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{group.title}</div>
                {group.items.map((item, ii) => {
                  const PIcon = item.icon;
                  return (
                    <div key={ii} style={{ padding: '7px 10px', border: '1px solid transparent', borderRadius: 'var(--radius)', display: 'flex', alignItems: 'center', gap: 8, cursor: 'grab', fontSize: 12, color: 'var(--foreground)', userSelect: 'none' }}>
                      <PIcon style={{ width: 15, height: 15, color: 'var(--muted-foreground)', flexShrink: 0 }} />
                      {item.name}
                      <span style={{ fontSize: 10, color: 'var(--muted-foreground)', marginLeft: 'auto', opacity: 0.6, fontWeight: 500 }}>{item.tag}</span>
                    </div>
                  );
                })}
                {gi < PALETTE_GROUPS.length - 1 && <div style={{ height: 1, background: 'var(--border)', margin: '6px 12px' }} />}
              </div>
            ))}
          </div>
        </div>

        {/* Center: Canvas */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--background)' }}>
          <div style={{ height: 40, borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', flexShrink: 0 }}>
            <h3 style={{ fontSize: 13, fontWeight: 600 }}>表单画布</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ fontSize: 11, color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Layers style={{ width: 13, height: 13 }} />字段 12
              </div>
              <div style={{ width: 1, height: 16, background: 'var(--border)' }} />
              <button className="v-btn" style={{ height: 28, width: 28, padding: 0, justifyContent: 'center' }}><ZoomOut style={{ width: 13, height: 13 }} /></button>
              <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>100%</span>
              <button className="v-btn" style={{ height: 28, width: 28, padding: 0, justifyContent: 'center' }}><ZoomIn style={{ width: 13, height: 13 }} /></button>
              <div style={{ width: 1, height: 16, background: 'var(--border)' }} />
              <div style={{ display: 'flex', alignItems: 'center', background: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
                {[
                  { mode: 'desktop', icon: Monitor, label: '桌面' },
                  { mode: 'tablet', icon: Tablet, label: '平板' },
                  { mode: 'mobile', icon: PhoneIcon, label: '手机' },
                ].map(d => {
                  const DIcon = d.icon;
                  return (
                    <button key={d.mode} onClick={() => setDevice(d.mode)} style={{ height: 28, padding: '0 8px', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, background: device === d.mode ? 'var(--card)' : 'transparent', border: 'none', color: device === d.mode ? 'var(--foreground)' : 'var(--muted-foreground)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      <DIcon style={{ width: 13, height: 13 }} />{d.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '24px 0' }}>
            <div style={{ width: '100%', maxWidth: canvasMaxWidth, margin: device === 'desktop' ? '0' : '0 auto' }}>
              <div className="v-card" style={{ padding: '28px 32px' }}>
                {/* Form Header */}
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.01em', marginBottom: 4 }}>请假申请表</div>
                  <div style={{ fontSize: 12, color: 'var(--muted-foreground)', lineHeight: 1.5 }}>请填写请假信息，带 <span style={{ color: 'var(--destructive)' }}>*</span> 为必填项。提交后将进入审批流程。</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 12, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 11, color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center', gap: 5 }}><UserCheck style={{ width: 13, height: 13 }} />创建者：张三</div>
                    <div style={{ fontSize: 11, color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center', gap: 5 }}><Calendar style={{ width: 13, height: 13 }} />更新于 2 分钟前</div>
                    <div style={{ fontSize: 11, color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center', gap: 5 }}><Copy style={{ width: 13, height: 13 }} />v1.2</div>
                  </div>
                </div>

                {/* Row 1: 请假类型 + 紧急程度 */}
                <div style={{ display: 'grid', gridTemplateColumns: device === 'mobile' ? '1fr' : '1fr 1fr', gap: 16, marginBottom: 16 }}>
                  {/* 请假类型 - selected */}
                  <div onClick={() => setSelectedField('leave_type')} style={{ border: '1px solid', borderColor: selectedField === 'leave_type' ? 'var(--foreground)' : 'var(--border)', borderRadius: 'var(--radius)', padding: '14px 16px', cursor: 'pointer', position: 'relative' }}>
                    <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                      请假类型
                      <span style={{ color: 'var(--destructive)', fontWeight: 400 }}>*</span>
                      <span style={{ fontSize: 10, color: 'var(--muted-foreground)', background: 'var(--muted)', padding: '1px 6px', borderRadius: 'var(--radius)', marginLeft: 'auto', fontWeight: 500 }}>下拉选择</span>
                    </div>
                    <div style={{ width: '100%', background: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '7px 10px', fontSize: 12, color: 'var(--muted-foreground)', opacity: 0.5, minHeight: 34, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      请选择请假类型
                      <ChevronDown style={{ width: 14, height: 14, color: 'var(--muted-foreground)' }} />
                    </div>
                  </div>
                  {/* 紧急程度 */}
                  <div onClick={() => setSelectedField('urgency')} style={{ border: '1px solid', borderColor: selectedField === 'urgency' ? 'var(--foreground)' : 'var(--border)', borderRadius: 'var(--radius)', padding: '14px 16px', cursor: 'pointer', position: 'relative' }}>
                    <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                      紧急程度
                      <span style={{ color: 'var(--destructive)', fontWeight: 400 }}>*</span>
                      <span style={{ fontSize: 10, color: 'var(--muted-foreground)', background: 'var(--muted)', padding: '1px 6px', borderRadius: 'var(--radius)', marginLeft: 'auto', fontWeight: 500 }}>单选</span>
                    </div>
                    <div style={{ display: 'flex', gap: 16, padding: '4px 0' }}>
                      {['普通', '紧急', '非常紧急'].map((label, i) => (
                        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--foreground)' }}>
                          <div style={{ width: 14, height: 14, border: '1px solid', borderColor: i === 0 ? 'var(--foreground)' : 'var(--border)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            {i === 0 && <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--foreground)' }} />}
                          </div>
                          {label}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Row 2: 日期 */}
                <div style={{ display: 'grid', gridTemplateColumns: device === 'mobile' ? '1fr' : '1fr 1fr', gap: 16, marginBottom: 16 }}>
                  {['开始日期', '结束日期'].map((label, i) => (
                    <div key={label} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '14px 16px', cursor: 'pointer', position: 'relative' }}>
                      <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                        {label}
                        <span style={{ color: 'var(--destructive)', fontWeight: 400 }}>*</span>
                        <span style={{ fontSize: 10, color: 'var(--muted-foreground)', background: 'var(--muted)', padding: '1px 6px', borderRadius: 'var(--radius)', marginLeft: 'auto', fontWeight: 500 }}>日期</span>
                      </div>
                      <div style={{ width: '100%', background: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '7px 10px', fontSize: 12, minHeight: 34, display: 'flex', alignItems: 'center', justifyContent: 'space-between', ...(i === 0 ? { color: 'var(--foreground)', opacity: 0.5 } : { color: 'var(--muted-foreground)' }) }}>
                        {i === 0 ? '2026-07-22' : '请选择结束日期'}
                        <Calendar style={{ width: 14, height: 14, color: 'var(--muted-foreground)' }} />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Row 3: 请假天数 (auto) */}
                <div style={{ display: 'grid', gridTemplateColumns: device === 'mobile' ? '1fr' : '1fr 1fr', gap: 16, marginBottom: 16 }}>
                  <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '14px 16px', cursor: 'pointer', maxWidth: 'calc(50% - 8px)' }}>
                    <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                      请假天数
                      <span style={{ fontSize: 10, color: 'var(--muted-foreground)', background: 'var(--muted)', padding: '1px 6px', borderRadius: 'var(--radius)', marginLeft: 'auto', fontWeight: 500 }}>数字 · 自动计算</span>
                    </div>
                    <div style={{ width: '100%', background: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '7px 10px', fontSize: 12, color: 'var(--muted-foreground)', fontStyle: 'italic', minHeight: 34, display: 'flex', alignItems: 'center' }}>自动计算</div>
                    <div style={{ fontSize: 10, color: 'var(--muted-foreground)', marginTop: 3, display: 'flex', alignItems: 'center', gap: 3 }}>
                      <FunctionSquare style={{ width: 11, height: 11 }} />结束日期 - 开始日期
                    </div>
                  </div>
                  <div style={{ maxWidth: 'calc(50% - 8px)' }} />
                </div>

                <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '8px 0 24px' }} />

                {/* Row 4: 请假事由 */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '14px 16px', cursor: 'pointer', position: 'relative' }}>
                    <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                      请假事由
                      <span style={{ color: 'var(--destructive)', fontWeight: 400 }}>*</span>
                      <span style={{ fontSize: 10, color: 'var(--muted-foreground)', background: 'var(--muted)', padding: '1px 6px', borderRadius: 'var(--radius)', marginLeft: 'auto', fontWeight: 500 }}>多行文本</span>
                    </div>
                    <div style={{ width: '100%', background: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '8px 10px', fontSize: 12, color: 'var(--muted-foreground)', opacity: 0.5, minHeight: 80, alignItems: 'flex-start' }}>请详细描述请假原因...</div>
                  </div>
                </div>

                {/* Row 5: 附件上传 */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '14px 16px', cursor: 'pointer', position: 'relative' }}>
                    <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                      附件
                      <span style={{ fontSize: 10, color: 'var(--muted-foreground)', background: 'var(--muted)', padding: '1px 6px', borderRadius: 'var(--radius)', marginLeft: 'auto', fontWeight: 500 }}>附件上传</span>
                    </div>
                    <div style={{ border: '1px dashed var(--border)', borderRadius: 'var(--radius)', padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, background: 'var(--muted)', minHeight: 80 }}>
                      <Upload style={{ width: 24, height: 24, color: 'var(--muted-foreground)' }} />
                      <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>点击或拖拽文件到此处上传</span>
                      <span style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>支持 PDF、Word、Excel、图片，单文件不超过 20MB</span>
                    </div>
                  </div>
                </div>

                <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '8px 0 24px' }} />

                {/* Row 6: 审批人 */}
                <div>
                  <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '14px 16px', cursor: 'pointer', position: 'relative' }}>
                    <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                      审批人
                      <span style={{ color: 'var(--destructive)', fontWeight: 400 }}>*</span>
                      <span style={{ fontSize: 10, color: 'var(--muted-foreground)', background: 'var(--muted)', padding: '1px 6px', borderRadius: 'var(--radius)', marginLeft: 'auto', fontWeight: 500 }}>人员选择</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minHeight: 34 }}>
                      {[
                        { name: '李四', avatar: '李', bg: 'var(--accent)' },
                        { name: '王五', avatar: '王', bg: '#2a1f00' },
                      ].map(p => (
                        <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '3px 8px 3px 4px', fontSize: 11 }}>
                          <div style={{ width: 20, height: 20, borderRadius: '50%', background: p.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 600, color: 'var(--foreground)' }}>{p.avatar}</div>
                          <span>{p.name}</span>
                          <X style={{ width: 12, height: 12, color: 'var(--muted-foreground)', marginLeft: 2 }} />
                        </div>
                      ))}
                      <div style={{ width: 20, height: 20, border: '1px dashed var(--border)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', marginLeft: 4 }}>
                        <Plus style={{ width: 12, height: 12, color: 'var(--muted-foreground)' }} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Business Component Preview Section */}
                <div style={{ marginTop: 32, paddingTop: 24, borderTop: '2px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Component style={{ width: 18, height: 18, color: 'var(--muted-foreground)' }} />业务组件预览
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 600, color: '#60a5fa', background: 'rgba(37,99,235,0.12)', padding: '3px 10px', borderRadius: 'var(--radius)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Preview</span>
                    <span style={{ fontSize: 12, color: 'var(--muted-foreground)', marginLeft: 'auto' }}>拖拽组件到表单后的渲染效果</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {/* 身份证号 */}
                    <div style={{ position: 'relative', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px 20px', background: 'var(--card)' }}>
                      <div style={{ position: 'absolute', top: -9, left: 16, background: 'var(--card)', padding: '0 8px', fontSize: 10, fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>身份证号</div>
                      <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 6 }}>身份证号 <span style={{ color: 'var(--destructive)' }}>*</span></div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, background: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '7px 10px' }}>
                          <CreditCard style={{ width: 14, height: 14, color: 'var(--muted-foreground)' }} />
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--foreground)' }}>310</span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--muted-foreground)', letterSpacing: 1 }}>***********</span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--foreground)' }}>1234</span>
                        </div>
                        <button className="v-btn" style={{ height: 34, fontSize: 11 }}>验证</button>
                        <span style={{ fontSize: 11, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 3 }}><Check style={{ width: 13, height: 13 }} />格式正确</span>
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--muted-foreground)', marginTop: 4 }}>支持 18 位中国大陆居民身份证号</div>
                    </div>

                    {/* 手机号 */}
                    <div style={{ position: 'relative', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px 20px', background: 'var(--card)' }}>
                      <div style={{ position: 'absolute', top: -9, left: 16, background: 'var(--card)', padding: '0 8px', fontSize: 10, fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>手机号</div>
                      <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 6 }}>手机号</div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <div style={{ background: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '7px 10px', fontSize: 12, color: 'var(--foreground)', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                          +86 <ChevronDown style={{ width: 12, height: 12, color: 'var(--muted-foreground)' }} />
                        </div>
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, background: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '7px 10px' }}>
                          <Smartphone style={{ width: 14, height: 14, color: 'var(--muted-foreground)' }} />
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--foreground)' }}>138</span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--muted-foreground)' }}>****</span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--foreground)' }}>5678</span>
                        </div>
                        <button className="v-btn" style={{ height: 34, fontSize: 11, color: 'var(--muted-foreground)' }}>发送验证码</button>
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--success)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 3 }}><Check style={{ width: 11, height: 11 }} />已验证</div>
                    </div>

                    {/* 评分组件 */}
                    <div style={{ position: 'relative', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px 20px', background: 'var(--card)' }}>
                      <div style={{ position: 'absolute', top: -9, left: 16, background: 'var(--card)', padding: '0 8px', fontSize: 10, fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>评分组件</div>
                      <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 6 }}>满意度评分</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ display: 'flex', gap: 3 }}>
                          {[0, 1, 2, 3, 4].map(i => (
                            <Star key={i} style={{ width: 20, height: 20, color: i < 4 ? 'var(--warning)' : 'var(--border)', fill: i < 4 ? 'var(--warning)' : 'none' }} />
                          ))}
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--warning)' }}>4.0</span>
                        <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>/ 5.0</span>
                      </div>
                    </div>

                    {/* 金额输入 */}
                    <div style={{ position: 'relative', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px 20px', background: 'var(--card)' }}>
                      <div style={{ position: 'absolute', top: -9, left: 16, background: 'var(--card)', padding: '0 8px', fontSize: 10, fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>金额输入</div>
                      <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 6 }}>合同金额 <span style={{ color: 'var(--destructive)' }}>*</span></div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, background: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '7px 10px' }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--warning)' }}>¥</span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 500, color: 'var(--foreground)', letterSpacing: 0.5 }}>1,285,000.00</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '7px 10px', width: 100, cursor: 'pointer' }}>
                          <span style={{ fontSize: 12, color: 'var(--foreground)' }}>CNY</span>
                          <ChevronDown style={{ width: 12, height: 12, color: 'var(--muted-foreground)', marginLeft: 'auto' }} />
                        </div>
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--muted-foreground)', marginTop: 4 }}>大写：<span style={{ color: 'var(--foreground)' }}>壹佰贰拾捌万伍仟元整</span></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Properties Panel */}
        <div style={{ width: 280, minWidth: 280, borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', background: 'var(--background)' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <h3 style={{ fontSize: 13, fontWeight: 600 }}>字段属性</h3>
            <button className="v-btn" style={{ height: 32, width: 32, padding: 0, justifyContent: 'center', border: '1px solid transparent', color: 'var(--muted-foreground)' }}><X style={{ width: 16, height: 16 }} /></button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
            {/* Basic Info */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>基本信息</div>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 4 }}>字段标识</div>
                <input className="v-input" value="leave_type" readOnly style={{ width: '100%', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted-foreground)', cursor: 'default' }} />
              </div>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 4 }}>字段名称</div>
                <input className="v-input" defaultValue="请假类型" style={{ width: '100%' }} />
              </div>
              <div style={{ marginBottom: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 4 }}>字段类型</div>
                <select className="v-input" style={{ width: '100%', cursor: 'pointer' }} defaultValue="下拉选择">
                  <option>下拉选择</option>
                  <option>单行文本</option>
                  <option>多行文本</option>
                  <option>数字</option>
                  <option>日期</option>
                  <option>单选</option>
                  <option>多选</option>
                </select>
              </div>
            </div>

            <div style={{ height: 1, background: 'var(--border)', margin: '16px 0' }} />

            {/* Validation */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>校验规则</div>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 8 }}>必填</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer' }}>
                  <div style={{ width: 32, height: 18, border: '1px solid var(--foreground)', borderRadius: 9, display: 'flex', alignItems: 'center', padding: 2, background: 'var(--foreground)' }}>
                    <div style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--primary)', transform: 'translateX(14px)' }} />
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--foreground)' }}>是</span>
                </div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 4 }}>占位提示</div>
                <input className="v-input" defaultValue="请选择请假类型" style={{ width: '100%' }} />
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 8 }}>校验规则</div>
                <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', border: '1px solid var(--foreground)', borderRadius: 'var(--radius)', fontSize: 11, color: 'var(--foreground)', background: 'var(--accent)', marginRight: 4, marginBottom: 4 }}><Check style={{ width: 11, height: 11 }} />必填</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 11, color: 'var(--muted-foreground)', background: 'var(--muted)', marginRight: 4, marginBottom: 4 }}><ShieldCheck style={{ width: 11, height: 11 }} />枚举校验</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 11, color: 'var(--muted-foreground)', background: 'var(--muted)', marginRight: 4, marginBottom: 4 }}>正则</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 11, color: 'var(--muted-foreground)', background: 'var(--muted)', marginRight: 4, marginBottom: 4 }}><Link style={{ width: 11, height: 11 }} />自定义</span>
                </div>
              </div>
            </div>

            <div style={{ height: 1, background: 'var(--border)', margin: '16px 0' }} />

            {/* Options */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>选项列表</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {OPTIONS.map((opt, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 12, background: 'var(--muted)' }}>
                    <Star style={{ width: 12, height: 12, color: opt.default ? 'var(--warning)' : 'var(--muted-foreground)', fill: opt.default ? 'var(--warning)' : 'none', flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 12, color: 'var(--foreground)' }}>{opt.label}</span>
                    <span style={{ fontSize: 11, color: 'var(--muted-foreground)', fontFamily: 'var(--font-mono)' }}>{opt.value}</span>
                    <X style={{ width: 12, height: 12, color: 'var(--muted-foreground)', cursor: 'pointer', flexShrink: 0 }} />
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '6px 8px', border: '1px dashed var(--border)', borderRadius: 'var(--radius)', fontSize: 11, color: 'var(--muted-foreground)', cursor: 'pointer', marginTop: 4 }}>
                <Plus style={{ width: 12, height: 12 }} />添加选项
              </div>
            </div>

            <div style={{ height: 1, background: 'var(--border)', margin: '16px 0' }} />

            {/* Default Value */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>默认值</div>
              <select className="v-input" style={{ width: '100%', cursor: 'pointer' }} defaultValue="年假">
                <option>无</option>
                <option>年假</option>
                <option>事假</option>
                <option>病假</option>
                <option>婚假</option>
                <option>产假</option>
                <option>陪产假</option>
              </select>
            </div>

            <div style={{ height: 1, background: 'var(--border)', margin: '16px 0' }} />

            {/* Advanced */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>高级设置</div>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 8 }}>可见性</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer' }}>
                  <div style={{ width: 32, height: 18, border: '1px solid var(--foreground)', borderRadius: 9, display: 'flex', alignItems: 'center', padding: 2, background: 'var(--foreground)' }}>
                    <div style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--primary)', transform: 'translateX(14px)' }} />
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--foreground)' }}>始终显示</span>
                </div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 8 }}>只读</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer' }}>
                  <div style={{ width: 32, height: 18, border: '1px solid var(--border)', borderRadius: 9, display: 'flex', alignItems: 'center', padding: 2, background: 'var(--muted)' }}>
                    <div style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--primary)' }} />
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>否</span>
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 4 }}>字段描述</div>
                <input className="v-input" placeholder="选填，用于提示填写说明" style={{ width: '100%' }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
