// OntologyStagingPreview - 渲染 ProposalPreview 的可视化预览
// (MP-ONT-PROPOSAL-01)。
//
// 根据 preview.kind 走 4 个分支：
//   - model_type:        属性表 + 主键 + interfaces + 反向引用
//   - create_instance:   字段值 + class 关联 + 验证状态
//   - merge_suggestion:  source/target 对比 + 属性映射
//   - action:            target_objects + 参数预览
//
// 每个分支底部挂一份 ImpactSummary（受影响 Individual / LinkInstance / 跨 schema 引用）。
// 严格使用 CSS variables + 原生 <button> / <input> / <select>，不引 Semi Button（dev 模式 onClick 截 noop）。

import {
  AlertTriangle, ArrowRight, Box, Columns3, GitBranch, GitMerge, Hash,
  Layers, Link2, ListTree, Target, Zap,
} from 'lucide-react';
import type {
  ActionPreview, CreateInstancePreview, ImpactSummary, KernelProperty,
  MergeSuggestionPreview, ModelTypePreview, ProposalPreview,
} from '@/api/ont/kernel';

export interface OntologyStagingPreviewProps {
  preview: ProposalPreview;
}

// 从 property rid 取末段 slug（形如 ont.<tenant>.prop.<slug>.v<N>）。
function propSlug(prop: KernelProperty): string {
  const parts = prop.rid.split('.');
  return (parts[parts.length - 2] ?? prop.rid).replace(/^(prop|prp)\./, '');
}

const KIND_META: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  model_type:        { label: '新建概念 (model_type)',   color: 'var(--primary)', bg: 'rgba(99,102,241,0.12)',  icon: <Box /> },
  create_instance:   { label: '创建实例 (create_instance)', color: 'var(--success)', bg: 'rgba(16,185,129,0.12)', icon: <Columns3 /> },
  merge_suggestion:  { label: '合并建议 (merge_suggestion)', color: 'var(--warning)', bg: 'rgba(245,158,11,0.12)', icon: <GitMerge /> },
  action:            { label: '执行 Action (action)',    color: 'var(--destructive)', bg: 'rgba(239,68,68,0.12)',  icon: <Zap /> },
};

// 跨 schema 引用：rid → 简短的 rid 末段。返回 {rid, shortLabel, type}，type 推断 obj/at/lt/...
function shortRidLabel(rid: string): string {
  const parts = rid.split('.');
  if (parts.length >= 2) return parts[parts.length - 2] ?? rid;
  return rid;
}

function ridKind(rid: string): string {
  // ont.<tenant>.<kind>.<slug>.<ver> → kind 段（obj/at/lt/prp/...）
  const parts = rid.split('.');
  if (parts.length < 3) return '?';
  return parts[2] ?? '?';
}

export default function OntologyStagingPreview({ preview }: OntologyStagingPreviewProps) {
  const meta = KIND_META[preview.kind] ?? {
    label: preview.kind,
    color: 'var(--muted-foreground)',
    bg: 'var(--muted)',
    icon: <Layers />,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <style>{`
        .osp-table {
          width: 100%;
          border-collapse: collapse;
          border: 1px solid var(--border);
          border-radius: var(--radius);
          overflow: hidden;
          background: var(--card);
        }
        .osp-table thead { background: var(--muted); }
        .osp-table th {
          padding: 10px 14px;
          font-size: 12px;
          font-weight: 500;
          color: var(--muted-foreground);
          text-align: left;
          border-bottom: 1px solid var(--border);
          white-space: nowrap;
        }
        .osp-table td {
          padding: 10px 14px;
          font-size: 13px;
          border-bottom: 1px solid var(--border);
          vertical-align: middle;
        }
        .osp-table tbody tr:last-child td { border-bottom: none; }
        .osp-section { display: flex; flex-direction: column; gap: 4px; }
      `}</style>
      {/* Kind 标签 + 摘要 */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px',
        border: '1px solid var(--border)', borderRadius: 'var(--radius)',
        background: meta.bg,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: meta.color, display: 'inline-flex' }}>{meta.icon}</span>
          <span style={{ fontWeight: 600, color: meta.color, fontSize: 13 }}>{meta.label}</span>
          <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
            id：<code style={{ fontSize: 11 }}>{preview.id}</code>
          </span>
        </div>
        {preview.status && (
          <span style={{
            fontSize: 11, fontWeight: 500, padding: '2px 8px',
            background: 'var(--card)', border: '1px solid var(--border)',
            borderRadius: 4,
          }}>
            {preview.status}
          </span>
        )}
      </div>

      {preview.summary && (
        <div style={{
          padding: '10px 14px', borderRadius: 'var(--radius)',
          background: 'var(--muted)', fontSize: 13, color: 'var(--foreground)',
          borderLeft: `3px solid ${meta.color}`, lineHeight: 1.6,
        }}>
          {preview.summary}
        </div>
      )}

      {/* 按 kind 分支渲染 */}
      {preview.kind === 'model_type' && preview.model_type && (
        <ModelTypeSection preview={preview.model_type} />
      )}
      {preview.kind === 'create_instance' && preview.create_instance && (
        <CreateInstanceSection preview={preview.create_instance} />
      )}
      {preview.kind === 'merge_suggestion' && preview.merge_suggestion && (
        <MergeSuggestionSection preview={preview.merge_suggestion} />
      )}
      {preview.kind === 'action' && preview.action && (
        <ActionSection preview={preview.action} />
      )}

      {/* 通用影响说明（4 种 kind 都可能附带） */}
      {preview.impact && <ImpactSection impact={preview.impact} />}
    </div>
  );
}

// ────────── model_type 渲染 ──────────

function ModelTypeSection({ preview }: { preview: ModelTypePreview }) {
  return (
    <div className="osp-section">
      <SectionHeader icon={<Box />} title="概念定义" />
      <KV label="rid" value={preview.rid} />
      <KV label="display_name" value={preview.display_name} />
      {preview.domain && <KV label="domain" value={preview.domain} />}
      {preview.slug && <KV label="slug" value={preview.slug} />}
      <KV label="primary_key" value={preview.primary_key.join(', ')} />
      <KV label="interfaces" value={preview.interfaces.length > 0 ? preview.interfaces.join(', ') : '—'} />

      <h5 style={{ fontSize: 13, fontWeight: 600, marginTop: 14, marginBottom: 6 }}>
        属性列表（{preview.properties.length}）
      </h5>
      {preview.properties.length === 0 ? (
        <div style={{ padding: 14, color: 'var(--muted-foreground)', fontSize: 12, background: 'var(--muted)', borderRadius: 'var(--radius)' }}>
          此概念暂无属性定义
        </div>
      ) : (
        <table className="osp-table">
          <thead>
            <tr>
              <th>slug</th>
              <th>类型</th>
              <th>主键</th>
              <th>可空</th>
              <th>描述</th>
            </tr>
          </thead>
          <tbody>
            {preview.properties.map((p) => (
              <tr key={p.rid}>
                <td style={{ fontWeight: 500 }}>{propSlug(p)}</td>
                <td><span className="type-badge">{p.type_id}</span></td>
                <td>{p.primary_key ? '✓' : '—'}</td>
                <td>{p.nullable ? '✓' : '✗'}</td>
                <td style={{ color: 'var(--muted-foreground)' }}>{p.title}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ────────── create_instance 渲染 ──────────

function CreateInstanceSection({ preview }: { preview: CreateInstancePreview }) {
  return (
    <div className="osp-section">
      <SectionHeader icon={<Hash />} title="实例字段值" />
      <KV label="class_rid" value={preview.class_rid} />
      <KV label="primary_key" value={preview.primary_key} />

      {preview.validation_errors && preview.validation_errors.length > 0 && (
        <div style={{
          marginTop: 10, padding: '8px 12px',
          background: 'rgba(245,158,11,0.10)',
          border: '1px solid var(--warning)',
          borderRadius: 'var(--radius)', fontSize: 12, color: 'var(--warning)',
          display: 'flex', alignItems: 'flex-start', gap: 8,
        }}>
          <AlertTriangle style={{ width: 14, height: 14, flexShrink: 0, marginTop: 1 }} />
          <div>
            <strong style={{ display: 'block', marginBottom: 2 }}>校验未通过</strong>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {preview.validation_errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <h5 style={{ fontSize: 13, fontWeight: 600, marginTop: 14, marginBottom: 6 }}>
        字段值（{Object.keys(preview.props).length}）
      </h5>
      <div style={{
        border: '1px solid var(--border)', borderRadius: 'var(--radius)',
        background: 'var(--card)', overflow: 'hidden',
      }}>
        {Object.entries(preview.props).length === 0 ? (
          <div style={{ padding: 14, color: 'var(--muted-foreground)', fontSize: 12 }}>暂无字段值</div>
        ) : (
          <table className="osp-table">
            <thead>
              <tr><th>key</th><th>value</th></tr>
            </thead>
            <tbody>
              {Object.entries(preview.props).map(([k, v]) => (
                <tr key={k}>
                  <td style={{ fontWeight: 500 }}>{k}</td>
                  <td style={{ color: 'var(--muted-foreground)' }}>
                    <code style={{ fontSize: 12 }}>
                      {typeof v === 'string' ? v : JSON.stringify(v)}
                    </code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ────────── merge_suggestion 渲染 ──────────

function MergeSuggestionSection({ preview }: { preview: MergeSuggestionPreview }) {
  return (
    <div className="osp-section">
      <SectionHeader icon={<GitMerge />} title="合并对照" />
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 12, alignItems: 'center',
        padding: '12px 16px', background: 'var(--muted)', borderRadius: 'var(--radius)',
        border: '1px solid var(--border)',
      }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginBottom: 4 }}>source</div>
          <div style={{ fontWeight: 600 }}>{preview.source_display_name ?? shortRidLabel(preview.source_rid)}</div>
          <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 2 }}>
            <code>{preview.source_rid}</code>
          </div>
        </div>
        <ArrowRight style={{ width: 20, height: 20, color: 'var(--muted-foreground)' }} />
        <div>
          <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginBottom: 4 }}>target</div>
          <div style={{ fontWeight: 600 }}>{preview.target_display_name ?? shortRidLabel(preview.target_rid)}</div>
          <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 2 }}>
            <code>{preview.target_rid}</code>
          </div>
        </div>
      </div>
      {preview.similarity !== undefined && (
        <KV label="similarity" value={`${(preview.similarity * 100).toFixed(1)}%`} />
      )}

      <h5 style={{ fontSize: 13, fontWeight: 600, marginTop: 14, marginBottom: 6 }}>
        属性映射（{preview.mapping.length}）
      </h5>
      {preview.mapping.length === 0 ? (
        <div style={{ padding: 14, color: 'var(--muted-foreground)', fontSize: 12, background: 'var(--muted)', borderRadius: 'var(--radius)' }}>
          无属性映射，后端按 slug 兜底
        </div>
      ) : (
        <table className="osp-table">
          <thead>
            <tr>
              <th>source 属性</th>
              <th style={{ width: 40, textAlign: 'center' }}>→</th>
              <th>target 属性</th>
            </tr>
          </thead>
          <tbody>
            {preview.mapping.map((m, i) => (
              <tr key={`${m.source_rid}-${i}`}>
                <td><code style={{ fontSize: 11 }}>{shortRidLabel(m.source_rid)}</code></td>
                <td style={{ textAlign: 'center', color: 'var(--muted-foreground)' }}>→</td>
                <td><code style={{ fontSize: 11 }}>{shortRidLabel(m.target_rid)}</code></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ────────── action 渲染 ──────────

function ActionSection({ preview }: { preview: ActionPreview }) {
  return (
    <div className="osp-section">
      <SectionHeader icon={<Zap />} title="Action 预览" />
      <KV label="action_rid" value={preview.action_rid} />

      <h5 style={{ fontSize: 13, fontWeight: 600, marginTop: 14, marginBottom: 6 }}>
        target_objects（{preview.target_objects.length}）
      </h5>
      {preview.target_objects.length === 0 ? (
        <div style={{ padding: 14, color: 'var(--muted-foreground)', fontSize: 12, background: 'var(--muted)', borderRadius: 'var(--radius)' }}>
          无目标对象
        </div>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {preview.target_objects.map((o, i) => (
            <li key={`${o.rid}-${i}`} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 12px', border: '1px solid var(--border)',
              borderRadius: 'var(--radius)', background: 'var(--card)', fontSize: 12,
            }}>
              <Target style={{ width: 14, height: 14, color: 'var(--primary)' }} />
              <code style={{ fontSize: 11 }}>{o.rid}</code>
              <ArrowRight style={{ width: 12, height: 12, color: 'var(--muted-foreground)' }} />
              <span style={{ fontWeight: 500 }}>{o.primary_key}</span>
            </li>
          ))}
        </ul>
      )}

      <h5 style={{ fontSize: 13, fontWeight: 600, marginTop: 14, marginBottom: 6 }}>参数</h5>
      <pre style={{
        margin: 0, padding: 12,
        background: 'var(--muted)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        fontSize: 12, color: 'var(--foreground)',
        fontFamily: 'ui-monospace, SFMono-Regular, monospace',
        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        maxHeight: 240, overflowY: 'auto',
      }}>
        {JSON.stringify(preview.parameters, null, 2)}
      </pre>
    </div>
  );
}

// ────────── 影响说明 ──────────

function ImpactSection({ impact }: { impact: ImpactSummary }) {
  const total = impact.affected_individuals + impact.affected_link_instances;
  return (
    <div style={{
      padding: '14px 18px', borderRadius: 'var(--radius)',
      border: '1px dashed var(--border)',
      background: total > 0 ? 'rgba(239,68,68,0.05)' : 'var(--muted)',
      fontSize: 12, color: 'var(--foreground)', lineHeight: 1.7,
    }}>
      <div style={{ fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
        <AlertTriangle style={{ width: 14, height: 14, color: total > 0 ? 'var(--destructive)' : 'var(--muted-foreground)' }} />
        影响说明
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <ImpactMetric
          icon={<Box />}
          label="受影响 Individual"
          value={impact.affected_individuals}
          color="var(--primary)"
        />
        <ImpactMetric
          icon={<Link2 />}
          label="受影响 LinkInstance"
          value={impact.affected_link_instances}
          color="var(--warning)"
        />
      </div>
      {impact.cross_schema_refs && impact.cross_schema_refs.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginBottom: 6 }}>
            跨 schema 引用（{impact.cross_schema_refs.length}）
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {impact.cross_schema_refs.map((ref, i) => (
              <span
                key={`${ref}-${i}`}
                title={ref}
                style={{
                  fontSize: 11, padding: '2px 8px',
                  background: 'var(--card)', border: '1px solid var(--border)',
                  borderRadius: 4,
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                }}
              >
                <ListTree style={{ width: 10, height: 10, color: 'var(--muted-foreground)' }} />
                <code style={{ fontSize: 10 }}>{ridKind(ref)}:{shortRidLabel(ref)}</code>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ImpactMetric({
  icon, label, value, color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '8px 12px', background: 'var(--card)',
      border: '1px solid var(--border)', borderRadius: 'var(--radius)',
    }}>
      <span style={{ color, display: 'inline-flex' }}>{icon}</span>
      <div>
        <div style={{ fontSize: 18, fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 2 }}>{label}</div>
      </div>
    </div>
  );
}

// ────────── 通用小工具 ──────────

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      fontSize: 14, fontWeight: 600, marginBottom: 10,
      paddingBottom: 8, borderBottom: '1px solid var(--border)',
    }}>
      <span style={{ color: 'var(--primary)', display: 'inline-flex' }}>{icon}</span>
      {title}
    </div>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'baseline', gap: 12,
      padding: '4px 0', fontSize: 12,
    }}>
      <span style={{
        minWidth: 120, color: 'var(--muted-foreground)',
        fontWeight: 500,
      }}>
        {label}
      </span>
      <span style={{ color: 'var(--foreground)', fontFamily: 'ui-monospace, SFMono-Regular, monospace', wordBreak: 'break-all' }}>
        {value || '—'}
      </span>
    </div>
  );
}