import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Download, Save, Box, Share2, Columns3, Key,
  Users, ShoppingCart, Package, FileText, Building2, UserCircle,
  GitBranch, Code2,
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

// MOCK: 实体列表
const ENTITIES = [
  { name: '客户', icon: Users, fields: 10 },
  { name: '订单', icon: ShoppingCart, fields: 12, active: true },
  { name: '产品', icon: Package, fields: 8 },
  { name: '合同', icon: FileText, fields: 7 },
  { name: '组织', icon: Building2, fields: 6 },
  { name: '人员', icon: UserCircle, fields: 5 },
];

// MOCK: ER 实体卡片
const ER_ENTITIES = [
  { name: '客户', en: 'Customer', col: 1, row: 1, fields: [
    { key: 'PK', name: 'id', type: 'UUID' },
    { key: '', name: 'name', type: 'String', req: true },
    { key: '', name: 'phone', type: 'String', req: true },
    { key: 'FK', name: 'org_id', type: 'UUID' },
  ]},
  { name: '产品', en: 'Product', col: 2, row: 1, fields: [
    { key: 'PK', name: 'id', type: 'UUID' },
    { key: '', name: 'name', type: 'String', req: true },
    { key: '', name: 'price', type: 'Decimal', req: true },
    { key: '', name: 'category', type: 'Enum' },
  ]},
  { name: '合同', en: 'Contract', col: 1, row: 2, fields: [
    { key: 'PK', name: 'id', type: 'UUID' },
    { key: 'FK', name: 'customer_id', type: 'UUID' },
    { key: '', name: 'amount', type: 'Decimal', req: true },
    { key: '', name: 'status', type: 'Enum' },
  ]},
  { name: '组织', en: 'Organization', col: 2, row: 2, fields: [
    { key: 'PK', name: 'id', type: 'UUID' },
    { key: '', name: 'name', type: 'String', req: true },
    { key: '', name: 'code', type: 'String', req: true },
    { key: 'FK', name: 'parent_id', type: 'UUID' },
  ]},
];

// MOCK: 订单字段
const ORDER_FIELDS = [
  { name: 'id', type: 'UUID', key: 'PK', req: true, desc: '订单唯一标识' },
  { name: 'order_no', type: 'String(32)', key: '', req: true, desc: '订单编号' },
  { name: 'customer_id', type: 'UUID', key: 'FK', req: true, desc: '关联客户' },
  { name: 'product_id', type: 'UUID', key: 'FK', req: true, desc: '关联产品' },
  { name: 'status', type: 'Enum', key: '', req: true, desc: '订单状态' },
  { name: 'total_amount', type: 'Decimal', key: '', req: true, desc: '订单总金额' },
  { name: 'discount', type: 'Decimal', key: '', req: false, desc: '折扣金额' },
  { name: 'payment_method', type: 'Enum', key: '', req: false, desc: '支付方式' },
  { name: 'shipping_addr', type: 'Text', key: '', req: false, desc: '收货地址' },
  { name: 'remark', type: 'Text', key: '', req: false, desc: '备注信息' },
  { name: 'created_at', type: 'DateTime', key: '', req: true, desc: '创建时间' },
  { name: 'updated_at', type: 'DateTime', key: '', req: false, desc: '更新时间' },
];

// MOCK: 索引配置
const INDEXES = [
  { name: 'idx_order_no', field: 'order_no', type: 'UNIQUE', typeColor: 'var(--success)', typeBg: 'var(--success-subtle)' },
  { name: 'idx_order_cust', field: 'customer_id', type: 'BTREE', typeColor: 'var(--muted-foreground)', typeBg: 'var(--muted)' },
  { name: 'idx_order_status', field: 'status, created_at', type: 'BTREE', typeColor: 'var(--muted-foreground)', typeBg: 'var(--muted)' },
];

export default function AppModelingPage() {
  const navigate = useNavigate();
  const [activeEntity, setActiveEntity] = useState('订单');
  const { tabs, activeId } = useAppTabs();
  const active = tabs.find((t) => t.id === activeId) ?? tabs[0];
  const appId = active?.id ?? 'order-mgmt';
  const appName = active?.name ?? '订单管理系统';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <AppHeader appId={appId} appName={appName} subTabs={APP_SUB_TABS} />

      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 24 }}>
        <button className="v-btn"><Plus style={{ width: 15, height: 15 }} />添加实体</button>
        <button className="v-btn"><Download style={{ width: 15, height: 15 }} />导出 DDL</button>
      </div>

      {/* Model Stats */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        {[
          { icon: Box, bg: '#141824', color: '#60a5fa', value: '6', label: '实体 Entity' },
          { icon: Share2, bg: '#1a1800', color: 'var(--warning)', value: '9', label: '关系 Relation' },
          { icon: Columns3, bg: '#14241a', color: 'var(--success)', value: '48', label: '字段 Field' },
          { icon: Key, bg: 'var(--muted)', color: 'var(--muted-foreground)', value: '12', label: '索引 Index' },
        ].map(s => {
          const SIcon = s.icon;
          return (
            <div key={s.label} className="v-card" style={{ flex: 1, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 'var(--radius)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: s.bg, color: s.color }}>
                <SIcon style={{ width: 18, height: 18 }} />
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>{s.value}</div>
                <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 1 }}>{s.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Three-panel Layout */}
      <div style={{ display: 'flex', gap: 16, flex: 1, minHeight: 0 }}>
        {/* Left: Entity Tree */}
        <div className="v-card" style={{ width: 200, flexShrink: 0, padding: 12, overflowY: 'auto', display: 'flex', flexDirection: 'column', alignSelf: 'stretch' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: 13, fontWeight: 600 }}>实体列表</h3>
            <span className="v-meta">6</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
            {ENTITIES.map(e => {
              const EIcon = e.icon;
              const isActive = e.name === activeEntity;
              return (
                <div
                  key={e.name}
                  onClick={() => setActiveEntity(e.name)}
                  style={{
                    padding: '8px 10px', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 8,
                    cursor: 'pointer', fontSize: 13, border: '1px solid transparent',
                    ...(isActive ? { background: 'var(--muted)', borderColor: 'var(--border)' } : {}),
                  }}
                >
                  <EIcon style={{ width: 15, height: 15, color: isActive ? 'var(--foreground)' : 'var(--muted-foreground)', flexShrink: 0 }} />
                  <span>{e.name}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--muted-foreground)', background: 'var(--muted)', padding: '1px 6px', borderRadius: 10 }}>{e.fields}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Center: ER Diagram + DDL */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* ER Canvas */}
          <div className="v-card" style={{ flex: 1, padding: 20, position: 'relative', minHeight: 380, overflow: 'hidden' }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <GitBranch style={{ width: 15, height: 15, color: 'var(--muted-foreground)' }} />ER 关系图
              <span className="v-meta" style={{ marginLeft: 'auto' }}>拖拽移动 / 滚轮缩放</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: '40px 60px', height: 'calc(100% - 36px)', position: 'relative' }}>
              {ER_ENTITIES.map(ent => (
                <div key={ent.name} style={{ gridColumn: ent.col, gridRow: ent.row, background: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ padding: '10px 14px', fontSize: 13, fontWeight: 600, borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8, background: 'var(--card)' }}>
                    {ent.name}
                    <span style={{ color: 'var(--muted-foreground)', fontWeight: 400, fontSize: 12, marginLeft: 'auto', fontFamily: 'var(--font-mono)' }}>{ent.en}</span>
                  </div>
                  <div style={{ padding: '8px 14px', flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {ent.fields.map((f, fi) => (
                      <div key={fi} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontFamily: 'var(--font-mono)', padding: '2px 0' }}>
                        {f.key ? (
                          <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 4px', borderRadius: 2, minWidth: 20, textAlign: 'center', ...(f.key === 'PK' ? { background: '#1a1800', color: 'var(--warning)' } : { background: '#141824', color: '#60a5fa' }) }}>{f.key}</span>
                        ) : (
                          <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 4px', borderRadius: 2, minWidth: 20, textAlign: 'center', visibility: 'hidden' }}>PK</span>
                        )}
                        <span style={{ color: 'var(--foreground)', fontWeight: 500 }}>{f.name}</span>
                        <span style={{ color: 'var(--muted-foreground)', fontSize: 11 }}>{f.type}</span>
                        {f.req && <span style={{ color: 'var(--destructive)', marginLeft: 'auto', fontSize: 10 }}>*</span>}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* DDL Preview */}
          <div className="v-card" style={{ padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Code2 style={{ width: 15, height: 15, color: 'var(--muted-foreground)' }} />DDL 预览
              <span className="v-meta" style={{ marginLeft: 'auto' }}>订单 Order</span>
            </div>
            <div style={{ background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 16, fontFamily: 'var(--font-mono)', fontSize: 12, lineHeight: 1.7, overflowX: 'auto', color: 'var(--muted-foreground)' }}>
              <span style={{ color: '#60a5fa', fontWeight: 500 }}>CREATE TABLE</span> <span style={{ color: 'var(--foreground)' }}>t_order</span> ({'\n'}
              {'  '}<span style={{ color: 'var(--foreground)' }}>id</span>          <span style={{ color: 'var(--warning)' }}>UUID</span>        <span style={{ color: 'var(--success)' }}>PRIMARY KEY DEFAULT uuid()</span>,{'\n'}
              {'  '}<span style={{ color: 'var(--foreground)' }}>order_no</span>    <span style={{ color: 'var(--warning)' }}>VARCHAR(32)</span>  <span style={{ color: 'var(--success)' }}>NOT NULL UNIQUE</span>,{'\n'}
              {'  '}<span style={{ color: 'var(--foreground)' }}>customer_id</span> <span style={{ color: 'var(--warning)' }}>UUID</span>        <span style={{ color: 'var(--success)' }}>NOT NULL REFERENCES t_customer(id)</span>,{'\n'}
              {'  '}<span style={{ color: 'var(--foreground)' }}>status</span>      <span style={{ color: 'var(--warning)' }}>VARCHAR(20)</span>  <span style={{ color: 'var(--success)' }}>NOT NULL DEFAULT 'pending'</span>,{'\n'}
              {'  '}<span style={{ color: 'var(--foreground)' }}>total_amount</span><span style={{ color: 'var(--warning)' }}>DECIMAL(12,2)</span><span style={{ color: 'var(--success)' }}>NOT NULL DEFAULT 0</span>,{'\n'}
              {'  '}<span style={{ color: 'var(--foreground)' }}>created_at</span>  <span style={{ color: 'var(--warning)' }}>TIMESTAMPTZ</span>  <span style={{ color: 'var(--success)' }}>NOT NULL DEFAULT now()</span>{'\n'}
              );
            </div>
          </div>
        </div>

        {/* Right: Field Detail Panel */}
        <div style={{ width: 300, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16, alignSelf: 'stretch' }}>
          <div className="v-card" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600 }}>订单 <span className="v-meta" style={{ fontWeight: 400, fontSize: 13 }}>Order</span></h3>
              <button className="v-btn" style={{ height: 28, padding: '0 10px', fontSize: 12 }}><Plus style={{ width: 13, height: 13 }} />添加</button>
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 12 }}>12 个字段</div>
            {ORDER_FIELDS.map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '8px 0', borderBottom: i < ORDER_FIELDS.length - 1 ? '1px solid var(--border)' : 'none', gap: 8 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 500, minWidth: 100 }}>{f.name}</span>
                <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 4, background: 'var(--muted)', color: 'var(--muted-foreground)', fontFamily: 'var(--font-mono)' }}>{f.type}</span>
                {f.key && (
                  <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 5px', borderRadius: 2, flexShrink: 0, ...(f.key === 'PK' ? { background: '#1a1800', color: 'var(--warning)' } : { background: '#141824', color: '#60a5fa' }) }}>{f.key}</span>
                )}
                {f.req && <span style={{ fontSize: 11, color: 'var(--destructive)', flexShrink: 0 }}>*</span>}
                <span style={{ fontSize: 12, color: 'var(--muted-foreground)', flex: 1, textAlign: 'right', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.desc}</span>
              </div>
            ))}
          </div>

          {/* Index Config */}
          <div className="v-card">
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Key style={{ width: 16, height: 16, color: 'var(--muted-foreground)' }} />索引配置
            </div>
            {INDEXES.map((idx, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: i < INDEXES.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 500, minWidth: 120 }}>{idx.name}</span>
                <span style={{ fontSize: 11, color: 'var(--muted-foreground)', fontFamily: 'var(--font-mono)', flex: 1 }}>{idx.field}</span>
                <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 4, background: idx.typeBg, color: idx.typeColor }}>{idx.type}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Action Bar */}
      <div style={{ padding: '16px 0 0', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
        <button className="v-btn">取消</button>
        <button className="v-btn-primary"><Save style={{ width: 15, height: 15 }} />保存模型</button>
      </div>
    </div>
  );
}
