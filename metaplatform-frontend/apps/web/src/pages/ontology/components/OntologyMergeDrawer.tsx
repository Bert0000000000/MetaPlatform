// 本体合并 drawer（MP-DEDUP-01）：
// 把 source ObjectType 的属性并入 target ObjectType，
// 用户在表格里勾选 source 属性 → 目标 target 属性（Property 映射），
// 提交时调 POST /ont/v2/object-types/merge。
//
// - 必传：source / target（已 resolved 的 KernelObjectType）
// - onMerge 成功后关闭 drawer；onCancel 直接关闭
// - 表格中所有交互按钮用原生 <button>，绕开 dev 模式 Semi Button onClick 被截 noop 的坑
// - 风格与 OntologyModelingPage 一致：CSS variables、紧凑表格、原生 input/select

import { useMemo, useState } from 'react';
import { ArrowRight, GitMerge } from 'lucide-react';
import type { KernelObjectType, KernelProperty } from '@/api/ont/kernel';

interface OntologyMergeDrawerProps {
  open: boolean;
  source: KernelObjectType | null;
  target: KernelObjectType | null;
  /** 真实合并 API 调用，由父组件注入；返回是否成功。 */
  onMerge: (mapping: Record<string, string>) => Promise<boolean>;
  onCancel: () => void;
  /** 推断出的 source → target 默认映射（仅展示在 select 默认值上，不自动提交） */
  initialMapping?: Record<string, string>;
  submitting?: boolean;
}

// 从 property rid 取末段 slug（形如 ont.<tenant>.prop.<slug>.v<N>）。
function propSlug(prop: KernelProperty): string {
  const parts = prop.rid.split('.');
  // 砍掉 kind 段（prop / prp），后端用 'prop'，统一兼容
  return (parts[parts.length - 2] ?? prop.rid).replace(/^(prop|prp)\./, '');
}

// 按 slug 兜底生成初始映射：source prop rid → target prop rid（同名 slug）
function defaultMappingFor(
  source: KernelObjectType,
  target: KernelObjectType,
): Record<string, string> {
  const map: Record<string, string> = {};
  const targetBySlug = new Map(target.properties.map((p) => [propSlug(p), p.rid]));
  for (const sp of source.properties) {
    const slug = propSlug(sp);
    const tr = targetBySlug.get(slug);
    if (tr) map[sp.rid] = tr;
  }
  return map;
}

export default function OntologyMergeDrawer({
  open,
  source,
  target,
  onMerge,
  onCancel,
  initialMapping,
  submitting,
}: OntologyMergeDrawerProps) {
  const [mapping, setMapping] = useState<Record<string, string>>({});

  // source 或 target 变化时重置 mapping：用注入的初始值，否则按 slug 兜底
  const seedKey = `${source?.rid ?? ''}::${target?.rid ?? ''}`;
  const seed = useMemo(() => {
    if (!source || !target) return {} as Record<string, string>;
    if (initialMapping) return { ...initialMapping };
    return defaultMappingFor(source, target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedKey]);

  const activeMapping = Object.keys(mapping).length === 0 && seedKey
    ? seed
    : mapping;

  const setCell = (srcRid: string, tgtRid: string) => {
    setMapping((prev) => {
      const base = Object.keys(prev).length === 0 ? seed : prev;
      const next = { ...base };
      if (!tgtRid) delete next[srcRid];
      else next[srcRid] = tgtRid;
      return next;
    });
  };

  const submit = async () => {
    const ok = await onMerge(activeMapping);
    if (ok) setMapping({});
  };

  const cancel = () => {
    setMapping({});
    onCancel();
  };

  if (!open || !source || !target) return null;

  const targetSlugSet = new Set(target.properties.map((p) => p.rid));

  return (
    <div
      onClick={cancel}
      className="mp-flex mp-justify-end mp-onto-drawer-mask"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="mp-h-full mp-flex-col mp-onto-drawer-panel mp-onto-drawer-panel--fluid"
      >
        {/* Header */}
        <div className="mp-justify-between mp-border mp-flex-center mp-py-4 mp-px-6" >
          <div className="mp-flex-center mp-gap-2" >
            <GitMerge className="mp-icon-18 mp-text-primary" />
            <h3 className="mp-fw-600 mp-m-0 mp-text-lg">
              合并概念 · {source.display_name} → {target.display_name}
            </h3>
          </div>
          <button
            type="button"
            onClick={cancel}
            className="mp-border mp-text-md mp-text-2 mp-bg-1 mp-rounded-sm mp-onto-close-btn"
            aria-label="关闭合并 drawer"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="mp-flex-1 mp-overflow-y-auto mp-py-5 mp-px-6" >
          <div className="mp-mb-4 mp-text-sm mp-text-2 mp-lh-16" >
            <div>source rid：<code>{source.rid}</code></div>
            <div>target rid：<code>{target.rid}</code></div>
            <div className="mp-mt-1">
              下方表格中，为 source 的每个属性选择 target 中对应的属性；
              未勾选的 source 属性不会参与合并（数据迁移时被丢弃）。
              后端会按 Individual.props 的键名重映射到 target 的 Property rid。
            </div>
          </div>

          <table className="om-merge-table mp-w-full mp-hidden mp-border mp-rounded mp-onto-table">
            <thead>
              <tr className="mp-bg-fill-0">
                <th className="mp-onto-th">source 属性（slug）</th>
                <th className="mp-onto-th">类型</th>
                <th className="mp-text-center mp-onto-th mp-onto-col-64">映射</th>
                <th className="mp-onto-th">target 属性（slug）</th>
              </tr>
            </thead>
            <tbody>
              {source.properties.length === 0 ? (
                <tr>
                  <td colSpan={4} className="mp-text-center mp-text-2 mp-onto-td">
                    source 没有属性定义，无需映射
                  </td>
                </tr>
              ) : source.properties.map((sp) => {
                const srcSlug = propSlug(sp);
                const mapped = activeMapping[sp.rid] ?? '';
                const matchedTarget = target.properties.find((p) => p.rid === mapped);
                return (
                  <tr key={sp.rid}>
                    <td className="mp-onto-td">
                      <div className="mp-fw-500">{srcSlug}</div>
                      <div className="mp-text-xs mp-text-2">{sp.rid}</div>
                    </td>
                    <td className="mp-onto-td">
                      <span className="type-badge">{sp.type_id}</span>
                    </td>
                    <td className="mp-text-center mp-onto-td">
                      <button
                        type="button"
                        onClick={() => setCell(sp.rid, matchedTarget ? '' : (targetSlugSet.values().next().value ?? ''))}
                        title={matchedTarget ? '取消映射' : '映射到默认'}
                        disabled={target.properties.length === 0}
                        className={`mp-inline-flex mp-items-center mp-justify-center mp-border mp-rounded-sm mp-onto-map-btn${matchedTarget ? ' mp-onto-map-btn--on' : ''}`}
                        aria-label={matchedTarget ? '取消映射' : '勾选映射'}
                      >
                        <ArrowRight className="mp-icon-14" />
                      </button>
                    </td>
                    <td className="mp-onto-td">
                      <select
                        value={mapped}
                        onChange={(e) => setCell(sp.rid, e.target.value)}
                        disabled={target.properties.length === 0}
                        className="mp-w-full mp-onto-input mp-onto-input--lg"
                      >
                        <option value="">— 不映射（丢弃） —</option>
                        {target.properties.map((tp) => (
                          <option key={tp.rid} value={tp.rid}>
                            {propSlug(tp)} ({tp.type_id})
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="mp-rounded mp-mt-4 mp-p-3 mp-text-sm mp-text-2 mp-bg-fill-0 mp-lh-16 mp-onto-box-dashed">
            <strong className="mp-text-1">合并影响：</strong>
            source 的所有 Individual（实体）会被改写 class_rid 指向 target；
            LinkInstance 的 src/dst 引用同步替换；
            source ObjectType 本身会被软删（archived=true），slug 释放后可复用。
          </div>
        </div>

        {/* Footer */}
        <div className="mp-justify-end mp-border mp-gap-2 mp-flex-center mp-py-3 mp-px-6" >
          <button
            type="button"
            onClick={cancel}
            className="mp-onto-btn mp-onto-btn--lg"
          >
            取消
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!!submitting}
            className="mp-onto-btn mp-onto-btn--lg mp-onto-btn--primary"
          >
            {submitting ? '合并中…' : '确认合并'}
          </button>
        </div>
      </div>
    </div>
  );
}
