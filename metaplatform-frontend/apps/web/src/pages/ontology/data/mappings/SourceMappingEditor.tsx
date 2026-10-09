import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Button, Input, InputNumber } from '@douyinfe/semi-ui';
import {
  upsertBackingDatasource,
  type KernelBackingDatasource,
  type KernelObjectType,
} from '@/api/ont/kernel';
import {
  discardEditorInput,
  readEditorInput,
  retainEditorInput,
} from '../../hooks/editorSession';
import { resourceError } from '../../hooks/resourceErrors';
import { ridTail } from '../../rid';

type SourceForm = {
  name: string;
  kind: string;
  dsnEnv: string;
  table: string;
  pkColumn: string;
  priority: number;
  mapping: Record<string, string>;
};
type RetainedMapping = {
  form: SourceForm;
  baseline: string;
  definition: string;
  uncertain: boolean;
};
export function mappingInputKey(
  identity: string,
  typeRid: string,
  sourceKey: string,
) {
  return JSON.stringify([identity, 'source-mapping', typeRid, sourceKey]);
}
export function mappingIsDirty(
  identity: string,
  typeRid: string,
  sourceKey: string,
): boolean {
  const input = readEditorInput<RetainedMapping>(
    identity,
    mappingInputKey(identity, typeRid, sourceKey),
  );
  return (
    !!input &&
    (input.uncertain || JSON.stringify(input.form) !== input.baseline)
  );
}
function formFor(source?: KernelBackingDatasource): SourceForm {
  return {
    name: source?.name || '',
    kind: source?.kind || 'pg_table',
    dsnEnv: source?.dsn_env || 'ONT_SOURCE_DSN',
    table: source?.table_name || '',
    pkColumn: source?.pk_column || '',
    priority: source?.priority ?? 100,
    mapping: { ...source?.field_mapping },
  };
}
export default function SourceMappingEditor({
  type,
  identity,
  source,
  sourceKey,
  sources,
  canSave,
  externalBusy,
  sourceFooter,
  mappingFooter,
  onState,
  onSaved,
  onComplete,
}: {
  type: KernelObjectType;
  identity: string;
  source?: KernelBackingDatasource;
  sourceKey: string;
  sources: KernelBackingDatasource[];
  canSave: boolean;
  externalBusy: boolean;
  sourceFooter: ReactNode;
  mappingFooter: ReactNode;
  onState: (dirty: boolean, busy: boolean) => void;
  onSaved: (name: string) => Promise<KernelBackingDatasource>;
  onComplete: (source: KernelBackingDatasource) => void;
}) {
  const key = mappingInputKey(identity, type.rid, sourceKey);
  const definition = JSON.stringify(type.properties);
  const [initial] = useState(() =>
    readEditorInput<RetainedMapping>(identity, key),
  );
  const [form, setForm] = useState(() => initial?.form || formFor(source));
  const [baseline, setBaseline] = useState(
    () => initial?.baseline || JSON.stringify(formFor(source)),
  );
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const locked = busy || externalBusy;
  const [uncertain, setUncertain] = useState(initial?.uncertain || false);
  const alive = useRef(true);
  const identityRef = useRef(identity);
  identityRef.current = identity;
  const dirty = JSON.stringify(form) !== baseline;
  const currentSource = JSON.stringify(source);
  const previousSource = useRef(currentSource);
  const customWatermark =
    !!source?.ts_column && source.ts_column !== 'updated_at';
  const unsupportedKind = form.kind !== 'pg_table';
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    if (dirty || uncertain)
      retainEditorInput(identity, key, {
        form,
        baseline,
        definition,
        uncertain,
      });
    else discardEditorInput(key);
    onState(dirty || uncertain, busy);
  }, [
    form,
    baseline,
    definition,
    identity,
    key,
    dirty,
    uncertain,
    busy,
    onState,
  ]);
  useEffect(() => {
    if (previousSource.current === currentSource) return;
    previousSource.current = currentSource;
    if (dirty || uncertain)
      setNotice(
        'stale · 来源配置已重新读取；未保存输入保留，请核对或丢弃后重载',
      );
    else {
      const actual = formFor(source);
      setForm(actual);
      setBaseline(JSON.stringify(actual));
    }
  }, [currentSource, source, dirty, uncertain]);
  const change = (
    field: keyof Omit<SourceForm, 'mapping'>,
    value: string | number,
  ) => {
    setForm((old) => ({ ...old, [field]: value }));
    setError('');
    setNotice('');
  };
  const changeColumn = (rid: string, value: string) => {
    setForm((old) => ({ ...old, mapping: { ...old.mapping, [rid]: value } }));
    setError('');
    setNotice('');
  };
  const unexpected = Object.keys(form.mapping).filter(
    (rid) => !type.properties.some((p) => p.rid === rid),
  );
  const submit = async () => {
    if (locked || !identity || customWatermark || unsupportedKind || !canSave)
      return;
    const seen = new Set<string>();
    for (const property of type.properties) {
      if (seen.has(property.rid)) {
        setError(`重复目标属性：${property.rid}`);
        return;
      }
      seen.add(property.rid);
    }
    if (unexpected.length) {
      setError('存在不属于当前类型的映射，请先核对并显式移除');
      return;
    }
    if (!form.name.trim() || !form.table.trim() || !form.pkColumn.trim()) {
      setError('源名、表名、主键列为必填');
      return;
    }
    if (!source && sources.some((row) => row.name === form.name.trim())) {
      setError('源名已存在，请选择已有来源或填写独立的新源名');
      return;
    }
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(form.dsnEnv.trim())) {
      setError('连接环境键只能填写服务端环境变量名称');
      return;
    }
    if (!Number.isInteger(form.priority)) {
      setError('优先级必须是整数');
      return;
    }
    const fieldMapping: Record<string, string> = {};
    for (const property of type.properties) {
      const required =
        property.primary_key ||
        type.primary_key.includes(property.rid) ||
        !property.nullable;
      const column = form.mapping[property.rid]?.trim();
      if (
        !column &&
        (required ||
          Object.prototype.hasOwnProperty.call(form.mapping, property.rid))
      ) {
        setError(`${property.title || ridTail(property.rid)} 来源列不能为空`);
        return;
      }
      if (column) fieldMapping[property.rid] = column;
    }
    setBusy(true);
    setError('');
    setNotice('');
    const capturedIdentity = identity;
    const active = () =>
      alive.current && identityRef.current === capturedIdentity;
    try {
      await upsertBackingDatasource(type.rid, {
        class_rid: type.rid,
        name: form.name.trim(),
        kind: 'pg_table',
        dsn_env: form.dsnEnv.trim(),
        table: form.table.trim(),
        pk_column: form.pkColumn.trim(),
        priority: form.priority,
        field_mapping: fieldMapping,
      });
      if (!active()) return;
      // A successful command is not a verified declaration until it has been read back.
      setUncertain(true);
      const saved = await onSaved(form.name.trim());
      if (!active()) return;
      const actual = formFor(saved);
      setForm(actual);
      setBaseline(JSON.stringify(actual));
      setUncertain(false);
      discardEditorInput(key);
      setNotice('');
      onComplete(saved);
    } catch (cause) {
      if (active())
        setError(
          `${resourceError(cause)} · 输入已保留；若保存已受理，请先重载核对`,
        );
    } finally {
      if (active()) setBusy(false);
    }
  };
  const discard = () => {
    if (locked || !window.confirm('丢弃此来源未保存输入并恢复已读取配置？'))
      return;
    const actual = formFor(source);
    setForm(actual);
    setBaseline(JSON.stringify(actual));
    setUncertain(false);
    setError('');
    setNotice('');
    discardEditorInput(key);
  };
  return (
    <div className="mp-mapping-layout">
      <aside className="mp-mapping-source">
        <section className="mp-mapping-card">
          <h3>来源与同步配置</h3>
          <fieldset disabled={locked} className="mp-mapping-fields">
            <label>
              <span>源名</span>
              <Input
                aria-label="源名"
                value={form.name}
                disabled={!!source}
                onChange={(v) => change('name', v)}
              />
            </label>
            <label>
              <span>来源类型</span>
              <Input aria-label="来源类型" value={form.kind} disabled />
            </label>
            <label>
              <span>连接环境键</span>
              <Input
                aria-label="连接环境键"
                value={form.dsnEnv}
                onChange={(v) => change('dsnEnv', v)}
              />
            </label>
            <p className="mp-mapping-muted">
              引用服务端环境键，连接凭据由服务端管理。
            </p>
            <label>
              <span>来源表／资源</span>
              <Input
                aria-label="来源表"
                value={form.table}
                onChange={(v) => change('table', v)}
              />
            </label>
            <label>
              <span>源主键列</span>
              <Input
                aria-label="源主键列"
                value={form.pkColumn}
                onChange={(v) => change('pkColumn', v)}
              />
            </label>
            <label>
              <span>来源优先级</span>
              <InputNumber
                aria-label="来源优先级"
                value={form.priority}
                onChange={(v) => change('priority', Number(v))}
              />
            </label>
          </fieldset>
        </section>
        <section className="mp-mapping-card">
          <h3>绑定状态</h3>
          <p>{source ? '已声明来源' : '尚未声明'}</p>
          <dl>
            <dt>服务端水位列（只读）</dt>
            <dd>{source?.ts_column || '未返回'}</dd>
            <dt>已处理水位</dt>
            <dd>
              {source?.last_synced_at || '未返回'}
              {source?.last_synced_pk ? ` · ${source.last_synced_pk}` : ''}
            </dd>
          </dl>
          {source?.last_error && (
            <p role="alert">
              {source.last_error} · 失败 {source.last_failed ?? '未返回'}
            </p>
          )}
          {customWatermark && (
            <p role="alert">
              当前保存接口无法保留自定义水位列 {source?.ts_column}
              ，此来源禁止保存编辑；可读取、同步已保存配置，或创建独立新来源。
            </p>
          )}
          {unsupportedKind && (
            <p role="alert">
              当前声明接口仅支持 pg_table；此来源类型不可编辑保存。
            </p>
          )}
        </section>
        {sourceFooter}
      </aside>
      <div className="mp-mapping-target">
        <section className="mp-mapping-card mp-mapping-properties">
          <h3>
            字段映射 {form.table || '未配置来源'} →{' '}
            {type.display_name || ridTail(type.rid)}
          </h3>
          <p className="mp-mapping-muted">
            来源列按声明填写；当前接口未提供源字段清单。目标使用完整属性 RID。
          </p>
          {!identity && (
            <p role="alert">
              身份或租户不可用，不能保存映射；未保存输入无法保留在个人会话。
            </p>
          )}
          {(dirty || uncertain) && (
            <p role="status">
              未保存输入已保留在当前会话；当前输入尚未完成保存回读，返回后请核对。此副本不是服务端草稿。
            </p>
          )}
          {initial && initial.definition !== definition && (
            <p role="alert">stale · 类型定义已变化，保留输入请重新核对。</p>
          )}
          {notice && <p role="status">{notice}</p>}
          {error && <p role="alert">{error}</p>}
          <div className="mp-mapping-table-scroll">
            <table className="mp-mapping-table">
              <thead>
                <tr>
                  <th>来源列</th>
                  <th>目标属性</th>
                  <th>约束</th>
                </tr>
              </thead>
              <tbody>
                {type.properties.map((property, index) => {
                  const primary =
                    property.primary_key ||
                    type.primary_key.includes(property.rid);
                  const required = primary || !property.nullable;
                  const enabled =
                    required ||
                    Object.prototype.hasOwnProperty.call(
                      form.mapping,
                      property.rid,
                    );
                  return (
                    <tr key={`${property.rid}:${index}`}>
                      <td>
                        {!required && (
                          <label className="mp-mapping-optional">
                            <input
                              type="checkbox"
                              aria-label={`映射 ${property.title || ridTail(property.rid)}`}
                              checked={enabled}
                              disabled={locked}
                              onChange={(event) => {
                                setForm((old) => {
                                  const mapping = { ...old.mapping };
                                  if (event.target.checked)
                                    mapping[property.rid] = '';
                                  else delete mapping[property.rid];
                                  return { ...old, mapping };
                                });
                                setError('');
                              }}
                            />
                            映射此属性
                          </label>
                        )}
                        <Input
                          aria-label={`${property.title || ridTail(property.rid)} 来源列`}
                          value={form.mapping[property.rid] || ''}
                          disabled={locked || !enabled}
                          onChange={(value) =>
                            changeColumn(property.rid, value)
                          }
                          placeholder={required ? '填写来源列' : '可选'}
                        />
                      </td>
                      <td>
                        <strong>
                          {property.title || ridTail(property.rid)}
                        </strong>
                        <code>{property.rid}</code>
                        <span>
                          {property.format} · {property.type_id}
                        </span>
                      </td>
                      <td>
                        {primary ? '业务主键' : required ? '必填' : '可选'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {unexpected.map((rid) => (
            <div className="mp-mapping-unknown" key={rid} role="alert">
              不属于当前类型的已保存映射：<code>{rid}</code> →{' '}
              {form.mapping[rid]}
              <Button
                disabled={locked}
                type="danger"
                onClick={() => {
                  if (
                    !window.confirm(`移除已保存映射 ${rid}？保存后才写入后端。`)
                  )
                    return;
                  setForm((old) => {
                    const mapping = { ...old.mapping };
                    delete mapping[rid];
                    return { ...old, mapping };
                  });
                  setError('');
                }}
              >
                移除此映射
              </Button>
            </div>
          ))}
          <div className="mp-mapping-actions">
            <Button
              theme="solid"
              type="primary"
              disabled={
                !identity ||
                customWatermark ||
                unsupportedKind ||
                locked ||
                !canSave
              }
              loading={busy}
              onClick={() => void submit()}
            >
              保存映射
            </Button>
            <Button
              disabled={locked || !(dirty || uncertain)}
              onClick={discard}
            >
              丢弃未保存输入
            </Button>
          </div>
        </section>
        {mappingFooter}
      </div>
    </div>
  );
}
