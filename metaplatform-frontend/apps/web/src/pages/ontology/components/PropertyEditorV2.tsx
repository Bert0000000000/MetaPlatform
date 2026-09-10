// PropertyEditorV2 - 属性编辑器 v2（EXP-02 语义表达力升级，Palantir property editor 对位）。
//
// 覆盖后端 PropertyDTO 全量字段：
//   基础：属性名（slug） / 显示名 / 描述 / 值类型（注册表联动 format）/ 允许为空 / 主键
//   v2 ：array + reducer（first/latest）/ derived（fn + over_link + field）/
//        struct_fields（format=struct 时的嵌套字段，至少 1 项，可增删）/ shared
//
// 联动与互斥（客户端校验集中在 validatePropertyDraft）：
//   - type_id 下拉选项来自 GET /ont/v2/value-types；选中后 format 随注册表联动，
//     format=struct 时才显示嵌套字段编辑区
//   - derived 与 primary_key 互斥：勾选派生时自动取消并锁定主键勾选
//   - array 勾选后必须选择 reducer（first / latest）
//   - derived fn=sum/avg 时 field 须为对端类型属性完整 rid；count 时可空
//
// dev 模式 Semi 交互组件 onClick 被截 noop —— 全部原生元素 + 内联样式。

import type { CSSProperties } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
  propSlug,
  type KernelLinkType, type KernelObjectType, type KernelProperty,
  type KernelValueType,
} from '@/api/ont/kernel';

// ─────────────────── 样式（与 ActionFormDrawer / OntologyModelingPage 对齐） ───────────────────

const inputStyle: CSSProperties = {
  height: 30, width: '100%', boxSizing: 'border-box',
  background: 'var(--card)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius)', padding: '0 10px', fontSize: 12,
  color: 'var(--foreground)', outline: 'none',
};

const textareaStyle: CSSProperties = {
  ...inputStyle, height: 'auto', minHeight: 56, padding: '6px 10px',
  resize: 'vertical', lineHeight: 1.5,
};

const labelStyle: CSSProperties = {
  fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 4,
};

const sectionBoxStyle: CSSProperties = {
  border: '1px solid var(--border)', borderRadius: 'var(--radius)',
  padding: 12, background: 'var(--muted)',
};

const smallBtnStyle: CSSProperties = {
  height: 26, padding: '0 8px', fontSize: 12,
  background: 'var(--card)', color: 'var(--foreground)',
  border: '1px solid var(--border)', borderRadius: 'var(--radius)',
  cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0,
};

const hintStyle: CSSProperties = {
  fontSize: 11, color: 'var(--muted-foreground)', lineHeight: 1.6,
};

// ─────────────────── 草稿模型（draft） ───────────────────

/** struct 嵌套字段草稿：title + format（已有字段保留原 rid）。 */
export interface StructFieldDraft {
  key: string;
  title: string;
  format: string;
  /** 编辑已有嵌套字段时保留原 rid；新建时提交前由 structFieldRid 生成。 */
  rid?: string;
}

/** 单个属性的可编辑草稿。rid 由父级（ObjectTypeEditorV2Drawer）按属性名联动重算。 */
export interface PropertyDraft {
  uid: string;
  /** 完整 rid（新建时为预览，随属性名/概念 slug 联动）。 */
  rid: string;
  /** slug 段（新建可编辑；已有属性只读）。 */
  name: string;
  isNew: boolean;
  title: string;
  description: string;
  typeId: string;
  /** typeId 不在注册表（legacy 数据）时的兜底 format。 */
  fallbackFormat: string;
  nullable: boolean;
  primaryKey: boolean;
  shared: boolean;
  array: boolean;
  reducer: '' | 'first' | 'latest';
  derivedEnabled: boolean;
  derivedFn: 'count' | 'sum' | 'avg';
  derivedOverLink: string;
  derivedField: string;
  structFields: StructFieldDraft[];
}

/** 新建属性草稿工厂。 */
export function emptyPropertyDraft(name = ''): PropertyDraft {
  return {
    uid: crypto.randomUUID(),
    rid: '',
    name,
    isNew: true,
    title: '',
    description: '',
    typeId: 'string',
    fallbackFormat: 'string',
    nullable: true,
    primaryKey: false,
    shared: false,
    array: false,
    reducer: '',
    derivedEnabled: false,
    derivedFn: 'count',
    derivedOverLink: '',
    derivedField: '',
    structFields: [],
  };
}

/** 从后端 PropertyDTO 构造编辑草稿。 */
export function draftFromProperty(p: KernelProperty): PropertyDraft {
  return {
    uid: crypto.randomUUID(),
    rid: p.rid,
    name: propSlug(p.rid),
    isNew: false,
    title: p.title ?? '',
    description: p.description ?? '',
    typeId: p.type_id,
    fallbackFormat: p.format,
    nullable: p.nullable,
    primaryKey: p.primary_key,
    shared: p.shared ?? false,
    array: p.array ?? false,
    reducer: p.reducer === 'first' || p.reducer === 'latest' ? p.reducer : '',
    derivedEnabled: p.derived != null,
    derivedFn: p.derived?.fn === 'sum' || p.derived?.fn === 'avg' ? p.derived.fn : 'count',
    derivedOverLink: p.derived?.over_link ?? '',
    derivedField: p.derived?.field ?? '',
    structFields: (p.struct_fields ?? []).map((sf, i) => ({
      key: `${sf.rid}#${i}`,
      title: sf.title,
      format: sf.format,
      rid: sf.rid,
    })),
  };
}

/** 当前 format：优先取值类型注册表声明（type_id → format 一致性），legacy 兜底。 */
export function draftFormat(d: PropertyDraft, valueTypes: KernelValueType[]): string {
  return valueTypes.find((vt) => vt.type_id === d.typeId)?.format ?? d.fallbackFormat;
}

/** 嵌套字段 rid：与内核 ai_metadata_struct 同规则 —— 父 rid 去 .v<N> 后追加 .<slug>.v1。 */
export function structFieldRid(parentRid: string, title: string): string {
  const stem = parentRid.replace(/\.v\d+$/, '');
  const slug = title.trim().toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'field';
  return `${stem}.${slug}.v1`;
}

/** 客户端校验：返回中文错误清单（空 = 通过）。 */
export function validatePropertyDraft(d: PropertyDraft, valueTypes: KernelValueType[]): string[] {
  const errs: string[] = [];
  const fmt = draftFormat(d, valueTypes);
  if (d.isNew && !/^[a-z0-9_-]+$/.test(d.name.trim())) {
    errs.push('属性名（slug）必填，仅限小写字母 / 数字 / 下划线 / 连字符');
  }
  if (d.primaryKey && d.derivedEnabled) {
    errs.push('派生属性与主键互斥，请取消其一');
  }
  if (d.array && d.reducer !== 'first' && d.reducer !== 'latest') {
    errs.push('数组属性必须选择归约方式（first / latest）');
  }
  if (fmt === 'struct') {
    if (d.structFields.length === 0) errs.push('struct 属性至少需要 1 个嵌套字段');
    if (d.structFields.some((f) => !f.title.trim())) errs.push('struct 嵌套字段的字段名不能为空');
  }
  if (d.derivedEnabled) {
    if (!d.derivedOverLink) errs.push('派生属性必须选择 over_link（关系类型）');
    if (d.derivedFn !== 'count') {
      const f = d.derivedField.trim();
      if (!f) {
        errs.push(`派生函数 ${d.derivedFn} 必须填写对端属性完整 rid（field）`);
      } else if (!/^ont\.[a-z0-9_-]+\.[a-z]+\.[-\w:.-]+$/.test(f)) {
        errs.push('field 须为完整属性 rid（形如 ont.<租户>.prop.<slug>.v1）');
      }
    }
  }
  return errs;
}

/** 草稿 → 后端 PropertyDTO（非 struct 时 struct_fields 恒为空数组）。 */
export function draftToPropertyDTO(d: PropertyDraft, valueTypes: KernelValueType[]): KernelProperty {
  const fmt = draftFormat(d, valueTypes);
  // 嵌套字段 type_id：优先取与 format 同名的注册值类型（string/integer/… 内置全部同名）
  const nestedTypeId = (format: string) =>
    valueTypes.find((vt) => vt.type_id === format)?.type_id ?? format;
  return {
    rid: d.rid,
    type_id: d.typeId,
    nullable: d.nullable,
    primary_key: d.primaryKey,
    title: d.title.trim() || d.name,
    format: fmt,
    description: d.description.trim(),
    struct_fields: fmt === 'struct'
      ? d.structFields.map((f) => ({
        rid: f.rid ?? structFieldRid(d.rid, f.title),
        type_id: nestedTypeId(f.format),
        nullable: true,
        primary_key: false,
        title: f.title.trim(),
        format: f.format,
      }))
      : [],
    array: d.array,
    reducer: d.array && (d.reducer === 'first' || d.reducer === 'latest') ? d.reducer : null,
    derived: d.derivedEnabled
      ? {
        fn: d.derivedFn,
        over_link: d.derivedOverLink,
        field: d.derivedFn === 'count' ? null : d.derivedField.trim(),
      }
      : null,
    shared: d.shared,
  };
}

/** /value-types 拉取失败时的兜底注册表（与内核 value_types._BUILTINS 对齐）。 */
export const FALLBACK_VALUE_TYPES: KernelValueType[] = [
  { type_id: 'string', format: 'string', description: 'UTF-8 字符串' },
  { type_id: 'integer', format: 'integer', description: '64 位整数' },
  { type_id: 'double', format: 'double', description: 'IEEE754 双精度' },
  { type_id: 'boolean', format: 'boolean', description: '布尔' },
  { type_id: 'date', format: 'date', description: 'ISO 日期（无时间）' },
  { type_id: 'timestamp', format: 'timestamp', description: 'ISO 时间戳（TZ）' },
  { type_id: 'decimal', format: 'double', description: '十进制金额' },
  { type_id: 'marking', format: 'marking', description: '安全标记引用' },
  { type_id: 'geojson', format: 'geojson', description: 'GeoJSON geometry' },
  { type_id: 'latlon', format: 'latlon', description: '(纬, 经) 二元组' },
  { type_id: 'timeseries', format: 'timeseries', description: '时序引用（series rid）' },
  { type_id: 'image', format: 'image', description: '媒体：图片' },
  { type_id: 'audio', format: 'audio', description: '媒体：音频' },
  { type_id: 'video', format: 'video', description: '媒体：视频' },
  { type_id: 'struct', format: 'struct', description: '嵌套结构（struct_fields 定义）' },
  { type_id: 'vector', format: 'vector', description: 'embedding 向量' },
];

// ─────────────────── 组件 ───────────────────

export interface PropertyEditorV2Props {
  draft: PropertyDraft;
  onChange: (next: PropertyDraft) => void;
  /** GET /ont/v2/value-types 结果（空时用 FALLBACK_VALUE_TYPES 兜底）。 */
  valueTypes: KernelValueType[];
  /** derived.over_link 选项来源（GET /ont/v2/link-types）。 */
  linkTypes: KernelLinkType[];
  /** 同租户 ObjectType 清单（用于 derived.field 对端属性提示）。 */
  objectTypes: KernelObjectType[];
  /** 当前所属 ObjectType rid（判断 over_link 遍历方向 → 对端类型）。 */
  currentTypeRid: string;
}

const ridTail = (rid: string): string => rid.split('.').slice(3).join('.') || rid;

export default function PropertyEditorV2({
  draft, onChange, valueTypes, linkTypes, objectTypes, currentTypeRid,
}: PropertyEditorV2Props) {
  const vts = valueTypes.length > 0 ? valueTypes : FALLBACK_VALUE_TYPES;
  const format = draftFormat(draft, vts);
  const set = (patch: Partial<PropertyDraft>) => onChange({ ...draft, ...patch });

  // 值类型选中 → format 随注册表联动
  const setType = (typeId: string) => {
    const vt = vts.find((v) => v.type_id === typeId);
    set({ typeId, fallbackFormat: vt?.format ?? draft.fallbackFormat });
  };

  // derived 与 primary_key 互斥：勾选派生 → 取消主键（且主键勾选锁定）；勾选主键 → 取消派生
  const setDerivedEnabled = (v: boolean) => onChange({ ...draft, derivedEnabled: v, ...(v ? { primaryKey: false } : {}) });
  const setPrimaryKey = (v: boolean) => onChange({ ...draft, primaryKey: v, ...(v ? { derivedEnabled: false } : {}) });

  // derived 对端提示：over_link 端点决定方向（本类是 src → 对端 dst，反之亦然）
  const overLink = linkTypes.find((lt) => lt.rid === draft.derivedOverLink) ?? null;
  const peerRid = overLink
    ? (overLink.src === currentTypeRid ? overLink.dst : overLink.src)
    : '';
  const peerType = objectTypes.find((ot) => ot.rid === peerRid) ?? null;

  // struct 嵌套字段的 format 选项：注册表去重（string/integer/…）
  const nestedFormats = Array.from(new Set(vts.map((vt) => vt.format))).sort();
  const typeKnown = vts.some((v) => v.type_id === draft.typeId);

  const checkboxLabelStyle: CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12,
    color: 'var(--foreground)', cursor: 'pointer',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* 行 1：属性名（slug）+ 显示名 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <div style={labelStyle}>属性名（slug）{draft.isNew ? '' : '（已有属性不可改）'}</div>
          <input
            type="text"
            value={draft.name}
            disabled={!draft.isNew}
            placeholder="例如 dept_name"
            onChange={(e) => set({ name: e.target.value })}
            style={{ ...inputStyle, ...(draft.isNew ? {} : { opacity: 0.6 }) }}
          />
        </div>
        <div>
          <div style={labelStyle}>显示名（title）</div>
          <input
            type="text"
            value={draft.title}
            placeholder="例如 部门名称"
            onChange={(e) => set({ title: e.target.value })}
            style={inputStyle}
          />
        </div>
      </div>
      <div style={{ ...hintStyle, fontFamily: 'monospace' }}>
        rid：<code>{draft.rid || '（待填属性名）'}</code>
      </div>

      {/* 行 2：值类型（注册表联动 format） */}
      <div>
        <div style={labelStyle}>值类型（type_id → format 联动）</div>
        <select
          value={draft.typeId}
          onChange={(e) => setType(e.target.value)}
          style={inputStyle}
        >
          {!typeKnown && draft.typeId && (
            <option value={draft.typeId}>{draft.typeId}（未注册 legacy）</option>
          )}
          {vts.map((vt) => (
            <option key={vt.type_id} value={vt.type_id}>
              {vt.type_id} · {vt.format}{vt.description ? ` · ${vt.description}` : ''}
            </option>
          ))}
        </select>
        <div style={{ ...hintStyle, marginTop: 4 }}>
          当前 format：<code>{format}</code>
          {format === 'struct' && '（在下方编辑嵌套字段，至少 1 项）'}
        </div>
      </div>

      {/* 行 3：布尔项 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18 }}>
        <label style={checkboxLabelStyle}>
          <input
            type="checkbox"
            checked={draft.nullable}
            onChange={(e) => set({ nullable: e.target.checked })}
          />
          允许为空（nullable）
        </label>
        <label style={{ ...checkboxLabelStyle, ...(draft.derivedEnabled ? { opacity: 0.5 } : {}) }} title={draft.derivedEnabled ? '派生属性不可作为主键（互斥）' : undefined}>
          <input
            type="checkbox"
            checked={draft.primaryKey}
            disabled={draft.derivedEnabled}
            onChange={(e) => setPrimaryKey(e.target.checked)}
          />
          主键（primary_key）
        </label>
        <label style={checkboxLabelStyle}>
          <input
            type="checkbox"
            checked={draft.array}
            onChange={(e) => set({ array: e.target.checked })}
          />
          数组（array）
        </label>
        <label style={checkboxLabelStyle}>
          <input
            type="checkbox"
            checked={draft.shared}
            onChange={(e) => set({ shared: e.target.checked })}
          />
          共享属性（shared）
        </label>
      </div>
      {draft.derivedEnabled && (
        <div style={{ ...hintStyle, color: '#fbbf24' }}>
          派生属性不可作为主键：已自动取消并锁定主键勾选。
        </div>
      )}

      {/* 行 4：数组归约（仅 array 勾选时显示） */}
      {draft.array && (
        <div>
          <div style={labelStyle}>多值归约（reducer）——数组属性必选</div>
          <select
            value={draft.reducer}
            onChange={(e) => set({ reducer: e.target.value === 'latest' ? 'latest' : e.target.value === 'first' ? 'first' : '' })}
            style={{ ...inputStyle, width: 220 }}
          >
            <option value="">请选择…</option>
            <option value="first">first（取首值）</option>
            <option value="latest">latest（取最新）</option>
          </select>
        </div>
      )}

      {/* 行 5：派生属性配置 */}
      <div style={sectionBoxStyle}>
        <label style={{ ...checkboxLabelStyle, marginBottom: draft.derivedEnabled ? 10 : 0 }}>
          <input
            type="checkbox"
            checked={draft.derivedEnabled}
            onChange={(e) => setDerivedEnabled(e.target.checked)}
          />
          派生属性（derived：跨关系声明式聚合，与主键互斥）
        </label>
        {draft.derivedEnabled && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 10 }}>
              <div>
                <div style={labelStyle}>聚合函数（fn）</div>
                <select
                  value={draft.derivedFn}
                  onChange={(e) => set({
                    derivedFn: e.target.value === 'sum' || e.target.value === 'avg' ? e.target.value : 'count',
                  })}
                  style={inputStyle}
                >
                  <option value="count">count（计数）</option>
                  <option value="sum">sum（求和）</option>
                  <option value="avg">avg（平均）</option>
                </select>
              </div>
              <div>
                <div style={labelStyle}>聚合关系（over_link）</div>
                <select
                  value={draft.derivedOverLink}
                  onChange={(e) => set({ derivedOverLink: e.target.value })}
                  style={inputStyle}
                >
                  <option value="">请选择关系类型…</option>
                  {linkTypes.map((lt) => (
                    <option key={lt.rid} value={lt.rid} title={lt.rid}>
                      {ridTail(lt.rid)}（{ridTail(lt.src)} → {ridTail(lt.dst)}）
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <div style={labelStyle}>
                对端属性完整 rid（field）
                {draft.derivedFn === 'count' ? ' —— count 无需 field，可留空' : ' —— 必填'}
              </div>
              <input
                type="text"
                value={draft.derivedField}
                placeholder="ont.<租户>.prop.<对端类型slug>.<属性名>.v1"
                onChange={(e) => set({ derivedField: e.target.value })}
                style={{ ...inputStyle, fontFamily: 'monospace' }}
                disabled={draft.derivedFn === 'count'}
              />
              {overLink && (
                <div style={{ ...hintStyle, marginTop: 6 }}>
                  对端类型：{peerType ? `${peerType.display_name}（${ridTail(peerRid)}）` : ridTail(peerRid) || '—'}
                  {draft.derivedFn !== 'count' && (
                    peerType && peerType.properties.length > 0 ? (
                      <>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                          {peerType.properties.map((pp) => (
                            <button
                              key={pp.rid}
                              type="button"
                              title={pp.rid}
                              onClick={() => set({ derivedField: pp.rid })}
                              style={{
                                ...smallBtnStyle, height: 22, fontSize: 11,
                                fontFamily: 'monospace', maxWidth: 300, overflow: 'hidden',
                                textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                              }}
                            >
                              {propSlug(pp.rid)}
                            </button>
                          ))}
                        </div>
                        <span>点击填入（{peerType.properties.length} 个可选）</span>
                      </>
                    ) : '（对端类型暂无属性，请手工填写完整 rid）'
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 行 6：struct 嵌套字段（仅 format=struct 时显示） */}
      {format === 'struct' && (
        <div style={sectionBoxStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ ...labelStyle, marginBottom: 0 }}>嵌套字段（struct_fields，至少 1 项）</span>
            <button type="button" onClick={() => set({
              structFields: [...draft.structFields, { key: crypto.randomUUID(), title: '', format: 'string' }],
            })} style={smallBtnStyle}>
              <Plus style={{ width: 12, height: 12 }} />添加嵌套字段
            </button>
          </div>
          {draft.structFields.length === 0 && (
            <div style={{ ...hintStyle, color: 'var(--destructive)' }}>
              struct 属性至少需要 1 个嵌套字段，否则无法保存。
            </div>
          )}
          {draft.structFields.map((f) => (
            <div key={f.key} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
              <input
                type="text"
                value={f.title}
                placeholder="字段名，例如 confidence"
                onChange={(e) => set({
                  structFields: draft.structFields.map((x) => (x.key === f.key ? { ...x, title: e.target.value } : x)),
                })}
                style={{ ...inputStyle, flex: 1 }}
              />
              <select
                value={f.format}
                onChange={(e) => set({
                  structFields: draft.structFields.map((x) => (x.key === f.key ? { ...x, format: e.target.value } : x)),
                })}
                style={{ ...inputStyle, width: 150 }}
                title={f.rid}
              >
                {!nestedFormats.includes(f.format) && (
                  <option value={f.format}>{f.format}（legacy）</option>
                )}
                {nestedFormats.map((fmt) => (
                  <option key={fmt} value={fmt}>{fmt}</option>
                ))}
              </select>
              <button
                type="button"
                aria-label="删除嵌套字段"
                onClick={() => set({ structFields: draft.structFields.filter((x) => x.key !== f.key) })}
                style={{ ...smallBtnStyle, color: 'var(--destructive)' }}
              >
                <Trash2 style={{ width: 12, height: 12 }} />
              </button>
            </div>
          ))}
          {draft.structFields.length > 0 && (
            <div style={hintStyle}>
              嵌套字段 rid 自动生成：<code>{draft.rid ? `${draft.rid.replace(/\.v\d+$/, '')}.<字段名>.v1` : '（待填属性名）'}</code>
            </div>
          )}
        </div>
      )}

      {/* 行 7：描述 */}
      <div>
        <div style={labelStyle}>描述（description）</div>
        <textarea
          value={draft.description}
          placeholder="可选；说明属性的语义与用途"
          onChange={(e) => set({ description: e.target.value })}
          style={textareaStyle}
        />
      </div>
    </div>
  );
}
