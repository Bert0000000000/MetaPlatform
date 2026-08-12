import { useApiErrorBoundary } from '@mate/shared';
import React, { useState, useEffect } from 'react';
import { Modal, Toast, Card, Tag, Table } from '@douyinfe/semi-ui';
import {
  Database, Plus, Search, Settings2, Trash2, RefreshCw, CheckCircle2,
  XCircle, Loader2, AlertCircle, Play,
} from 'lucide-react';
import {
  listBigDataSources, createBigDataSource, deleteBigDataSource,
  testBigDataSourceConnection,
  BigDataSource, SourceType, BigDataSourceStatus, AuthType, SOURCE_TYPE_META,
} from '../../../api/ontology-bigdata';

const STATUS_META = {
  ACTIVE:   { label: '运行中', color: '#10b981', bg: 'rgba(16,185,129,0.12)',  icon: CheckCircle2 },
  INACTIVE: { label: '已停用', color: '#94a3b8', bg: 'rgba(148,163,184,0.12)', icon: XCircle },
  ERROR:    { label: '异常',   color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   icon: AlertCircle },
  DRAFT:    { label: '草稿',   color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  icon: Loader2 },
  DELETED:  { label: '已删除', color: '#6b7280', bg: 'rgba(107,114,128,0.12)', icon: Trash2 },
};

export default function BigDataSourceView() {
  const { report } = useApiErrorBoundary();
  return <InnerBody report={report} />;
}

function InnerBody({ report }: { report: any }) {
  const [sources, setSources] = useState<BigDataSource[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<{ keyword?: string; sourceType?: SourceType; status?: BigDataSourceStatus }>({});
  const [showCreate, setShowCreate] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data: any = await listBigDataSources(filter);
      setSources(Array.isArray(data) ? data : (data?.items || []));
    } catch (e) {
      report(e);
      setSources([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [filter.keyword, filter.sourceType, filter.status]);

  const handleTest = async (id: string) => {
    setTesting(id);
    try {
      const result: any = await testBigDataSourceConnection(id);
      if (result?.success) {
        Toast.success('连接成功! 延迟: ' + result.latency + 'ms');
      } else {
        Toast.error('连接失败: ' + (result?.message || 'unknown'));
      }
    } finally {
      setTesting(null);
    }
  };

  const handleDelete = async (id: string) => {
    Modal.confirm({
      title: '确认删除此数据源？',
      content: '相关 ETL/CDC 任务将失败。',
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await deleteBigDataSource(id);
          Toast.success('已删除数据源');
          await load();
        } catch (e) {
          report(e);
        }
      },
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Toolbar */}
      <Card style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search style={{ position: 'absolute', left: 10, top: 10, width: 14, height: 14, color: 'var(--muted-foreground)' }} />
          <input
            placeholder="搜索数据源名称或主机..."
            value={filter.keyword || ''}
            onChange={(e) => setFilter({ ...filter, keyword: e.target.value || undefined })}
            style={{ width: '100%', padding: '8px 12px 8px 32px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--background)', color: 'var(--foreground)', fontSize: 13 }}
          />
        </div>
        <select
          value={filter.sourceType || ''}
          onChange={(e) => setFilter({ ...filter, sourceType: (e.target.value || undefined) as SourceType })}
          style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--background)', color: 'var(--foreground)', fontSize: 13 }}
        >
          <option value="">全部类型</option>
          {Object.entries(SOURCE_TYPE_META).map(([k, v]) => (
            <option key={k} value={k}>{v.icon} {v.label}</option>
          ))}
        </select>
        <select
          value={filter.status || ''}
          onChange={(e) => setFilter({ ...filter, status: (e.target.value || undefined) as BigDataSourceStatus | undefined })}
          style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--background)', color: 'var(--foreground)', fontSize: 13 }}
        >
          <option value="">全部状态</option>
          <option value="ACTIVE">运行中</option>
          <option value="INACTIVE">已停用</option>
          <option value="ERROR">异常</option>
          <option value="DRAFT">草稿</option>
        </select>
        <button
          onClick={() => load()}
          style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--card)', color: 'var(--foreground)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
        >
          <RefreshCw style={{ width: 14, height: 14 }} />刷新
        </button>
        <button
          onClick={() => setShowCreate(true)}
          style={{ padding: '8px 16px', background: 'var(--primary)', color: 'var(--primary-foreground)', border: 'none', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
        >
          <Plus style={{ width: 14, height: 14 }} />新建数据源
        </button>
      </Card>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
        {[
          { label: '总数', value: sources.length, color: 'var(--foreground)' },
          { label: '运行中', value: sources.filter(s => s.status === 'ACTIVE').length, color: '#10b981' },
          { label: '已停用', value: sources.filter(s => s.status === 'INACTIVE').length, color: '#94a3b8' },
          { label: '异常', value: sources.filter(s => s.status === 'ERROR').length, color: '#ef4444' },
          { label: '类型数', value: new Set(sources.map(s => s.sourceType)).size, color: 'var(--primary)' },
        ].map(s => (
          <Card key={s.label}  style={{ padding: '12px 16px' }}>
            <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color, letterSpacing: '-0.02em' }}>{s.value}</div>
          </Card>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted-foreground)' }}>
          <Loader2 className="v-spin" style={{ width: 20, height: 20, display: 'inline-block', marginRight: 8 }} />
          加载中...
        </div>
      ) : sources.length === 0 ? (
        <Card style={{ padding: 60, textAlign: 'center', color: 'var(--muted-foreground)' }}>
          <Database style={{ width: 40, height: 40, margin: '0 auto 12px', opacity: 0.3 }} />
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>暂无数据源</div>
          <div style={{ fontSize: 12, marginBottom: 16 }}>点击右上角"新建数据源"开始接入</div>
          <button onClick={() => setShowCreate(true)} style={{ padding: '6px 12px', background: 'var(--primary)', color: 'var(--primary-foreground)', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
            <Plus style={{ width: 12, height: 12, display: 'inline', marginRight: 4 }} />新建
          </button>
        </Card>
      ) : (
        <Card>
          <Table
            rowKey="sourceId"
            dataSource={sources}
            pagination={false}
            columns={[
              {
                title: '名称', dataIndex: 'name',
                render: (_v: string, r: BigDataSource) => {
                  const tm = SOURCE_TYPE_META[r.sourceType] || { label: r.sourceType, color: '#666', icon: '?' };
                  return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minWidth: 32,
                        height: 24,
                        padding: '0 6px',
                        borderRadius: 4,
                        background: tm.color + '20',
                        color: tm.color,
                        fontFamily: 'var(--font-mono)',
                        fontSize: 11,
                        fontWeight: 600,
                        letterSpacing: '0.02em',
                      }}>{tm.icon}</span>
                      <div>
                        <div style={{ fontWeight: 500 }}>{r.name}</div>
                        {r.description && <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{r.description}</div>}
                      </div>
                    </div>
                  );
                },
              },
              {
                title: '类型', dataIndex: 'sourceType',
                render: (v: SourceType) => {
                  const tm = SOURCE_TYPE_META[v] || { label: v, color: '#666', icon: '?' };
                  return <Tag style={{ background: tm.color + '20', color: tm.color }}>{tm.label}</Tag>;
                },
              },
              { title: '主机:端口', dataIndex: 'host', render: (_v: string, r: BigDataSource) => <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{r.host}:{r.port}</span> },
              {
                title: '状态', dataIndex: 'status',
                render: (v: BigDataSourceStatus) => {
                  const sm = STATUS_META[v] || STATUS_META.ACTIVE;
                  const SmIcon = sm.icon;
                  return (
                    <Tag style={{ background: sm.bg, color: sm.color }}>
                      <SmIcon style={{ width: 10, height: 10, display: 'inline', marginRight: 4 }} />
                      {sm.label}
                    </Tag>
                  );
                },
              },
              { title: '认证', dataIndex: 'authType', render: (v: AuthType) => <span style={{ fontSize: 12 }}>{v === 'NONE' ? '无' : v}</span> },
              { title: '连接池', dataIndex: 'poolSize', render: (v: number) => <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{v}</span> },
              { title: '最近测试', dataIndex: 'lastTestedAt', render: (v?: string) => <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{v ? new Date(v).toLocaleString('zh-CN') : '-'}</span> },
              {
                title: '操作', dataIndex: 'sourceId',
                render: (id: string) => (
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button
                      onClick={() => handleTest(id)}
                      disabled={testing === id}
                      title="测试连接"
                      style={{ padding: 4, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--primary)' }}
                    >
                      {testing === id ? <Loader2 className="v-spin" style={{ width: 14, height: 14 }} /> : <Play style={{ width: 14, height: 14 }} />}
                    </button>
                    <button title="配置" style={{ padding: 4, border: 'none', background: 'transparent', cursor: 'pointer' }}>
                      <Settings2 style={{ width: 14, height: 14 }} />
                    </button>
                    <button
                      onClick={() => handleDelete(id)}
                      title="删除"
                      style={{ padding: 4, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--destructive)' }}
                    >
                      <Trash2 style={{ width: 14, height: 14 }} />
                    </button>
                  </div>
                ),
              },
            ]}
          />
        </Card>
      )}

      {showCreate && <CreateSourceModal onClose={() => setShowCreate(false)} onSuccess={() => { setShowCreate(false); load(); }} report={report} />}
    </div>
  );
}

function CreateSourceModal({ onClose, onSuccess, report }: { onClose: () => void; onSuccess: () => void; report: any }) {
  const [form, setForm] = useState<Partial<BigDataSource>>({
    sourceType: 'CLICKHOUSE',
    authType: 'NONE',
    sslEnabled: false,
    poolSize: 10,
    queryTimeout: 60,
    batchSize: 1000,
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!form.name || !form.host || !form.port) {
      Toast.warning('请填写必填字段：名称、主机、端口');
      return;
    }
    setSubmitting(true);
    try {
      await createBigDataSource(form);
      Toast.success('已创建数据源');
      onSuccess();
    } catch (e) {
      report(e);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--semi-color-overlay-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <Card style={{ width: 640, maxHeight: '90vh', overflow: 'auto' }}>
        <div style={{ padding: 20, borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 600 }}>新建大数据源</div>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 20 }}>×</button>
        </div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Field label="数据源名 *" required>
            <input value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} style={inputStyle} />
          </Field>
          <Field label="类型 *" required>
            <select value={form.sourceType} onChange={(e) => setForm({ ...form, sourceType: e.target.value as SourceType })} style={inputStyle}>
              {Object.entries(SOURCE_TYPE_META).map(([k, v]) => (
                <option key={k} value={k}>{v.icon} {v.label}</option>
              ))}
            </select>
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
            <Field label="主机 *" required>
              <input value={form.host || ''} onChange={(e) => setForm({ ...form, host: e.target.value })} style={inputStyle} placeholder="host.example.com" />
            </Field>
            <Field label="端口 *" required>
              <input type="number" value={form.port || ''} onChange={(e) => setForm({ ...form, port: parseInt(e.target.value) })} style={inputStyle} />
            </Field>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="数据库">
              <input value={form.database || ''} onChange={(e) => setForm({ ...form, database: e.target.value })} style={inputStyle} />
            </Field>
            <Field label="Schema">
              <input value={form.schema || ''} onChange={(e) => setForm({ ...form, schema: e.target.value })} style={inputStyle} />
            </Field>
          </div>
          <Field label="认证类型">
            <select value={form.authType} onChange={(e) => setForm({ ...form, authType: e.target.value as AuthType })} style={inputStyle}>
              <option value="NONE">无</option>
              <option value="USER_PASSWORD">用户名密码</option>
              <option value="KERBERY">Kerberos</option>
              <option value="LDAP">LDAP</option>
            </select>
          </Field>
          {form.authType !== 'NONE' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="用户名">
                <input style={inputStyle} />
              </Field>
              <Field label="密码">
                <input type="password" style={inputStyle} />
              </Field>
            </div>
          )}
        </div>
        <div style={{ padding: 16, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={{ padding: '8px 16px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--background)', cursor: 'pointer' }}>取消</button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            style={{ padding: '8px 16px', background: 'var(--primary)', color: 'var(--primary-foreground)', border: 'none', borderRadius: 6, cursor: 'pointer', opacity: submitting ? 0.5 : 1 }}
          >
            {submitting ? '创建中...' : '创建'}
          </button>
        </div>
      </Card>
    </div>
  );
}

const inputStyle = {
  width: '100%', padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 4,
  background: 'var(--background)', color: 'var(--foreground)', fontSize: 13,
};

function Field({ label, children, required = false }: { label: React.ReactNode; children: React.ReactNode; required?: boolean }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4, color: 'var(--muted-foreground)' }}>
        {label}{required && <span style={{ color: 'var(--destructive)' }}> *</span>}
      </label>
      {children}
    </div>
  );
}
