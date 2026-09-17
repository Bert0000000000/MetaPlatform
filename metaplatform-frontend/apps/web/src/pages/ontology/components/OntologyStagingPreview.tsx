// OntologyStagingPreview - 渲染 ProposalPreview 的可视化预览
// (MP-ONT-PROPOSAL-01)。
//
// 根据 preview.kind 走分支：
//   - model_type:        属性表 + 主键 + interfaces + 反向引用
//   - create_instance:   字段值 + class 关联 + 验证状态
//   - merge_suggestion:  source/target 对比 + 属性映射
//   - action:            target_objects + 参数预览
//   - edit_set:          人工 Action 表单的即时提案（字段平铺在 preview 顶层）
//
// 每个分支底部挂一份 ImpactSummary（受影响 Individual / LinkInstance / 跨 schema 引用）。
// 严格使用 CSS variables + 原生 <button> / <input> / <select>，不引 Semi Button（dev 模式 onClick 截 noop）。

import {
  AlertTriangle, ArrowRight, Box, Columns3, GitBranch, GitMerge, Hash,
  Layers, Link2, ListTree, Target, Zap,
} from 'lucide-react';
import type {
  ActionPreview, CreateInstancePreview, EditSetDiff, ImpactSummary, KernelProperty,
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

const KIND_META: Record<string, { label: string; tone: string; icon: React.ReactNode }> = {
  model_type:        { label: '新建概念 (model_type)',   tone: 'primary', icon: <Box /> },
  create_instance:   { label: '创建实例 (create_instance)', tone: 'success', icon: <Columns3 /> },
  merge_suggestion:  { label: '合并建议 (merge_suggestion)', tone: 'warning', icon: <GitMerge /> },
  action:            { label: '执行 Action (action)',    tone: 'danger',  icon: <Zap /> },
  edit_set:          { label: '执行动作 (edit_set)',     tone: 'danger',  icon: <Zap /> },
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
    tone: 'muted',
    icon: <Layers />,
  };

  return (
    <div className="mp-flex mp-gap-4 mp-flex-col" >
      {/* Kind 标签 + 摘要 */}
      <div className={`mp-justify-between mp-border mp-rounded mp-flex-center mp-py-3 mp-px-4 mp-onto-kind--${meta.tone}`}>
        <div className="mp-flex-center mp-gap-2" >
          <span className="mp-inline-flex">{meta.icon}</span>
          <span className="mp-fw-600 mp-text-body">{meta.label}</span>
          <span className="mp-text-sm mp-text-2">
            id：<code className="mp-text-xs">{preview.id ?? preview.proposal_id}</code>
          </span>
        </div>
        {preview.status && (
          <span className="mp-fw-500 mp-border mp-text-xs mp-py-1 mp-px-2 mp-bg-1 mp-rounded-sm" >
            {preview.status}
          </span>
        )}
      </div>

      {preview.summary && (
        <div className={`mp-rounded mp-text-body mp-text-1 mp-py-2 mp-px-3 mp-bg-fill-0 mp-lh-16 mp-onto-kind-accent--${meta.tone}`}>
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
      {preview.kind === 'edit_set' && <EditSetSection preview={preview} />}

      {/* 通用影响说明（4 种 kind 都可能附带） */}
      {preview.impact && <ImpactSection impact={preview.impact} />}
    </div>
  );
}

// ────────── model_type 渲染 ──────────

function ModelTypeSection({ preview }: { preview: ModelTypePreview }) {
  return (
    <div className="mp-onto-preview-section">
      <SectionHeader icon={<Box />} title="概念定义" />
      <KV label="rid" value={preview.rid} />
      <KV label="display_name" value={preview.display_name} />
      {preview.domain && <KV label="domain" value={preview.domain} />}
      {preview.slug && <KV label="slug" value={preview.slug} />}
      <KV label="primary_key" value={preview.primary_key.join(', ')} />
      <KV label="interfaces" value={preview.interfaces.length > 0 ? preview.interfaces.join(', ') : '—'} />

      <h5 className="mp-fw-600 mp-text-body mp-mt-3 mp-mb-1" >
        属性列表（{preview.properties.length}）
      </h5>
      {preview.properties.length === 0 ? (
        <div className="mp-text-sm mp-text-2 mp-rounded mp-p-3 mp-bg-fill-0" >
          此概念暂无属性定义
        </div>
      ) : (
        <table className="mp-onto-preview-table">
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
                <td className="mp-fw-500">{propSlug(p)}</td>
                <td><span className="type-badge">{p.type_id}</span></td>
                <td>{p.primary_key ? '✓' : '—'}</td>
                <td>{p.nullable ? '✓' : '✗'}</td>
                <td className="mp-text-2">{p.title}</td>
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
    <div className="mp-onto-preview-section">
      <SectionHeader icon={<Hash />} title="实例字段值" />
      <KV label="class_rid" value={preview.class_rid} />
      <KV label="primary_key" value={preview.primary_key} />

      {preview.validation_errors && preview.validation_errors.length > 0 && (
        <div className="mp-flex mp-rounded mp-mt-2 mp-gap-2 mp-text-sm mp-text-warning mp-py-2 mp-px-3 mp-items-start mp-onto-banner-warning">
          <AlertTriangle className="mp-icon-14 mp-shrink-0 mp-mt-1"  />
          <div>
            <strong className="mp-block mp-mb-1">校验未通过</strong>
            <ul className="mp-onto-list-indent">
              {preview.validation_errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <h5 className="mp-fw-600 mp-text-body mp-mt-3 mp-mb-1" >
        字段值（{Object.keys(preview.props).length}）
      </h5>
      <div className="mp-hidden mp-border mp-rounded mp-bg-1" >
        {Object.entries(preview.props).length === 0 ? (
          <div className="mp-text-sm mp-text-2 mp-p-3" >暂无字段值</div>
        ) : (
          <table className="mp-onto-preview-table">
            <thead>
              <tr><th>key</th><th>value</th></tr>
            </thead>
            <tbody>
              {Object.entries(preview.props).map(([k, v]) => (
                <tr key={k}>
                  <td className="mp-fw-500">{k}</td>
                  <td className="mp-text-2">
                    <code className="mp-text-sm">
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
    <div className="mp-onto-preview-section">
      <SectionHeader icon={<GitMerge />} title="合并对照" />
      <div className="mp-grid mp-items-center mp-border mp-rounded mp-gap-3 mp-py-3 mp-px-4 mp-bg-fill-0 mp-onto-grid-merge">
        <div>
          <div className="mp-mb-1 mp-text-xs mp-text-2">source</div>
          <div className="mp-fw-600">{preview.source_display_name ?? shortRidLabel(preview.source_rid)}</div>
          <div className="mp-text-xs mp-text-2 mp-mt-1" >
            <code>{preview.source_rid}</code>
          </div>
        </div>
        <ArrowRight className="mp-icon-20 mp-text-2" />
        <div>
          <div className="mp-mb-1 mp-text-xs mp-text-2">target</div>
          <div className="mp-fw-600">{preview.target_display_name ?? shortRidLabel(preview.target_rid)}</div>
          <div className="mp-text-xs mp-text-2 mp-mt-1" >
            <code>{preview.target_rid}</code>
          </div>
        </div>
      </div>
      {preview.similarity !== undefined && (
        <KV label="similarity" value={`${(preview.similarity * 100).toFixed(1)}%`} />
      )}

      <h5 className="mp-fw-600 mp-text-body mp-mt-3 mp-mb-1" >
        属性映射（{preview.mapping.length}）
      </h5>
      {preview.mapping.length === 0 ? (
        <div className="mp-text-sm mp-text-2 mp-rounded mp-p-3 mp-bg-fill-0" >
          无属性映射，后端按 slug 兜底
        </div>
      ) : (
        <table className="mp-onto-preview-table">
          <thead>
            <tr>
              <th>source 属性</th>
              <th className="mp-text-center mp-onto-col-40">→</th>
              <th>target 属性</th>
            </tr>
          </thead>
          <tbody>
            {preview.mapping.map((m, i) => (
              <tr key={`${m.source_rid}-${i}`}>
                <td><code className="mp-text-xs">{shortRidLabel(m.source_rid)}</code></td>
                <td className="mp-text-center mp-text-2">→</td>
                <td><code className="mp-text-xs">{shortRidLabel(m.target_rid)}</code></td>
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
    <div className="mp-onto-preview-section">
      <SectionHeader icon={<Zap />} title="Action 预览" />
      <KV label="action_rid" value={preview.action_rid} />

      <h5 className="mp-fw-600 mp-text-body mp-mt-3 mp-mb-1" >
        target_objects（{preview.target_objects.length}）
      </h5>
      {preview.target_objects.length === 0 ? (
        <div className="mp-text-sm mp-text-2 mp-rounded mp-p-3 mp-bg-fill-0" >
          无目标对象
        </div>
      ) : (
        <ul className="mp-flex mp-m-0 mp-gap-1 mp-p-1 mp-flex-col mp-onto-list-plain">
          {preview.target_objects.map((o, i) => (
            <li key={`${o.rid}-${i}`} className="mp-border mp-rounded mp-gap-2 mp-text-sm mp-flex-center mp-py-2 mp-px-3 mp-bg-1" >
              <Target className="mp-icon-14 mp-text-primary" />
              <code className="mp-text-xs">{o.rid}</code>
              <ArrowRight className="mp-icon-12 mp-text-2" />
              <span className="mp-fw-500">{o.primary_key}</span>
            </li>
          ))}
        </ul>
      )}

      <h5 className="mp-fw-600 mp-text-body mp-mt-3 mp-mb-1" >参数</h5>
      <pre className="mp-overflow-y-auto mp-border mp-rounded mp-p-3 mp-m-0 mp-text-sm mp-text-1 mp-bg-fill-0 mp-onto-code-block">
        {JSON.stringify(preview.parameters, null, 2)}
      </pre>
    </div>
  );
}

// ────────── edit_set（人工 Action 表单） ──────────
//
// 后端把 edit_set 的字段**平铺**在 preview 顶层（不像前四种套在子对象里），
// 且 expected_diff 通常是 deferred —— 真正的操作集由函数在执行时决定。

function EditSetSection({ preview }: { preview: ProposalPreview }) {
  const params =
    preview.parameters && typeof preview.parameters === 'object'
      ? ((preview.parameters as { parameters?: Record<string, unknown> }).parameters ?? {})
      : {};
  const paramEntries = Object.entries(params);
  const diff: EditSetDiff | undefined = preview.expected_diff;
  const impact =
    preview.impact_summary && typeof preview.impact_summary === 'object'
      ? preview.impact_summary
      : undefined;
  const opsCount = diff?.ops?.length ?? 0;
  const deferred = diff?.preview_source?.includes('deferred') ?? false;

  return (
    <div className="mp-onto-preview-section">
      <SectionHeader icon={<Zap />} title="执行动作" />
      <KV label="目标动作" value={preview.target_rid ? shortRidLabel(preview.target_rid) : '—'} />
      {preview.action_type ? <KV label="apply 方式" value={preview.action_type} /> : null}

      <h5 className="mp-fw-600 mp-text-body mp-mt-3 mp-mb-1">输入参数</h5>
      {paramEntries.length === 0 ? (
        <div className="mp-text-sm mp-text-2 mp-rounded mp-p-3 mp-bg-fill-0">该动作没有参数</div>
      ) : (
        <div className="mp-flex mp-gap-1 mp-flex-col">
          {paramEntries.map(([k, v]) => (
            <div
              key={k}
              className="mp-border mp-rounded mp-gap-2 mp-text-sm mp-flex-center mp-py-2 mp-px-3 mp-bg-1"
            >
              <code className="mp-text-xs mp-text-2">{shortRidLabel(k)}</code>
              <ArrowRight className="mp-icon-12 mp-text-2" />
              <span className="mp-fw-500">{String(v)}</span>
            </div>
          ))}
        </div>
      )}

      <h5 className="mp-fw-600 mp-text-body mp-mt-3 mp-mb-1">变更预览</h5>
      <div className="mp-text-sm mp-text-2 mp-rounded mp-p-3 mp-bg-fill-0">
        {deferred || opsCount === 0 ? (
          <>
            具体变更由动作函数在执行时决定（<code className="mp-text-xs">preview_source=deferred</code>），
            确认前无法逐条列出。
          </>
        ) : (
          <>待执行操作 {opsCount} 条</>
        )}
      </div>

      {impact ? (
        <>
          <h5 className="mp-fw-600 mp-text-body mp-mt-3 mp-mb-1">影响预估</h5>
          <div className="mp-text-sm mp-text-2 mp-rounded mp-p-3 mp-bg-fill-0">
            预计影响 Individual：{impact.affected_individuals_estimate ?? '未知'}
            {(impact.warnings ?? []).length > 0 ? (
              <ul className="mp-mt-2">
                {(impact.warnings ?? []).map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}

// ────────── 影响说明 ──────────

function ImpactSection({ impact }: { impact: ImpactSummary }) {
  const total = impact.affected_individuals + impact.affected_link_instances;
  return (
    <div className={`mp-rounded mp-text-sm mp-text-1 mp-py-3 mp-px-4 mp-onto-impact ${total > 0 ? 'mp-onto-impact--alert' : 'mp-onto-impact--calm'}`}>
      <div className="mp-fw-600 mp-mb-2 mp-flex-center mp-gap-1" >
        <AlertTriangle className={`mp-icon-14 ${total > 0 ? 'mp-text-danger' : 'mp-text-2'}`} />
        影响说明
      </div>
      <div className="mp-grid mp-gap-2 mp-grid-2" >
        <ImpactMetric
          icon={<Box />}
          label="受影响 Individual"
          value={impact.affected_individuals}
          tone="primary"
        />
        <ImpactMetric
          icon={<Link2 />}
          label="受影响 LinkInstance"
          value={impact.affected_link_instances}
          tone="warning"
        />
      </div>
      {impact.cross_schema_refs && impact.cross_schema_refs.length > 0 && (
        <div className="mp-mt-3">
          <div className="mp-text-xs mp-text-2 mp-mb-1" >
            跨 schema 引用（{impact.cross_schema_refs.length}）
          </div>
          <div className="mp-flex mp-wrap mp-gap-1" >
            {impact.cross_schema_refs.map((ref, i) => (
              <span
                key={`${ref}-${i}`}
                title={ref}
                className="mp-inline-flex mp-items-center mp-border mp-gap-1 mp-text-xs mp-py-1 mp-px-2 mp-bg-1 mp-rounded-sm"
              >
                <ListTree className="mp-text-2 mp-icon-12"  />
                <code className="mp-text-xs">{ridKind(ref)}:{shortRidLabel(ref)}</code>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ImpactMetric({
  icon, label, value, tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: 'primary' | 'warning';
}) {
  return (
    <div className="mp-border mp-rounded mp-gap-2 mp-flex-center mp-py-2 mp-px-3 mp-bg-1" >
      <span className={`mp-inline-flex mp-text-${tone}`}>{icon}</span>
      <div>
        <div className={`mp-text-lg mp-onto-metric-value mp-text-${tone}`}>{value}</div>
        <div className="mp-text-xs mp-text-2 mp-mt-1" >{label}</div>
      </div>
    </div>
  );
}

// ────────── 通用小工具 ──────────

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="mp-fw-600 mp-border mp-mb-2 mp-gap-2 mp-text-md mp-flex-center mp-pb-2" >
      <span className="mp-inline-flex mp-text-primary">{icon}</span>
      {title}
    </div>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div className="mp-flex mp-gap-3 mp-text-sm mp-onto-kv">
      <span className="mp-fw-500 mp-text-2 mp-onto-kv-label">
        {label}
      </span>
      <span className="mp-text-1 mp-break-all mp-mono">
        {value || '—'}
      </span>
    </div>
  );
}
