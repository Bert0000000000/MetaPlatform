import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Input, InputNumber, Select, Switch, Toast } from '@douyinfe/semi-ui';
import { Play } from 'lucide-react';
import {
  listActionTypes,
  proposeEditSet,
  propSlug,
  type KernelActionType,
  type KernelIndividual,
  type KernelProperty,
} from '@/api/ont/kernel';
import { EmptyState, SheetDetail } from '@/components/skeleton';
import { ridTail } from '../rid';
import '../ontology.css';

/**
 * 人工执行动作表单（DESIGN-SPEC §5：新建/编辑一律右侧抽屉）。
 *
 * 动线：对象主页 →「执行动作」→ 选动作类型 → 按 ActionType.parameters 动态渲染表单
 *       → 提交 → 走与 AI 提案**同一条** HITL 管道（propose → confirm → execute，审计不旁路）。
 *
 * 这里只负责「收集参数 + 建提案」，确认与执行交给 ProposalConfirmDrawer，
 * 避免出现第二条写路径。
 */
export interface ActionFormDrawerProps {
  open: boolean;
  target: KernelIndividual | null;
  onClose: () => void;
  /** 提案已建立，交由上层打开确认抽屉 */
  onProposed: (proposalId: string) => void;
}

/** 按 type_id 渲染一个参数控件（内核目前只产出 string，其余为向后兼容的防御分支）。 */
function ParamField({
  param,
  value,
  onChange,
}: {
  param: KernelProperty;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const label = param.title || propSlug(param.rid);
  const type = (param.type_id || '').toLowerCase();

  if (type === 'boolean' || type === 'bool') {
    return (
      <label className="mp-onto-field">
        <span className="mp-onto-field-label">{label}</span>
        <Switch checked={Boolean(value)} onChange={(v) => onChange(v)} />
      </label>
    );
  }

  if (['number', 'int', 'integer', 'long', 'float', 'double', 'decimal'].includes(type)) {
    return (
      <label className="mp-onto-field">
        <span className="mp-onto-field-label">
          {label}
          {param.nullable ? null : <span className="mp-onto-field-req">必填</span>}
        </span>
        <InputNumber
          value={value === undefined || value === null ? undefined : Number(value)}
          onChange={(v) => onChange(v)}
          placeholder={label}
        />
      </label>
    );
  }

  return (
    <label className="mp-onto-field">
      <span className="mp-onto-field-label">
        {label}
        {param.nullable ? null : <span className="mp-onto-field-req">必填</span>}
      </span>
      <Input
        value={value === undefined || value === null ? '' : String(value)}
        onChange={(v) => onChange(v)}
        placeholder={label}
      />
    </label>
  );
}

export default function ActionFormDrawer({
  open,
  target,
  onClose,
  onProposed,
}: ActionFormDrawerProps) {
  const [actions, setActions] = useState<KernelActionType[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [actionRid, setActionRid] = useState('');
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoading(true);
    setError('');
    setActionRid('');
    setValues({});
    (async () => {
      try {
        const all = await listActionTypes();
        if (!alive) return;
        setActions(all);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [open]);

  /** 只保留绑定到该对象类型的动作（`on` 为空视为全局可用）。 */
  const applicable = useMemo(() => {
    if (!target) return [];
    return actions.filter((a) => {
      const on = a.on ?? [];
      return on.length === 0 || on.includes(target.class_rid);
    });
  }, [actions, target]);

  const selected = useMemo(
    () => applicable.find((a) => a.rid === actionRid) ?? null,
    [applicable, actionRid],
  );

  // 选中动作后初始化参数默认值
  useEffect(() => {
    if (!selected) return;
    const next: Record<string, unknown> = {};
    for (const p of selected.parameters ?? []) next[p.rid] = '';
    setValues(next);
  }, [selected]);

  const submit = useCallback(async () => {
    if (!selected || !target) return;
    const missing = (selected.parameters ?? []).filter(
      (p) => !p.nullable && !String(values[p.rid] ?? '').trim(),
    );
    if (missing.length > 0) {
      Toast.warning(`请填写：${missing.map((p) => p.title || propSlug(p.rid)).join('、')}`);
      return;
    }
    setSubmitting(true);
    try {
      const res = await proposeEditSet(selected.rid, {
        parameters: values,
        target_iid: target.rid,
      });
      Toast.success('已生成提案，请确认后执行');
      onClose();
      onProposed(res.proposal_id);
    } catch (e) {
      Toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }, [selected, target, values, onClose, onProposed]);

  return (
    <SheetDetail
      title="执行动作"
      open={open}
      width={520}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>取消</Button>
          <Button
            theme="solid"
            type="primary"
            icon={<Play size={15} strokeWidth={1.5} />}
            disabled={!selected}
            loading={submitting}
            onClick={() => void submit()}
          >
            下一步：确认
          </Button>
        </>
      }
    >
      {target ? (
        <div className="mp-onto-action-target">
          <span className="mp-onto-field-label">目标对象</span>
          <span className="mp-onto-strong">{target.primary_key || target.rid}</span>
          <span className="mp-onto-mono">{target.class_rid}</span>
        </div>
      ) : null}

      <div className="mp-onto-form">
        {error ? (
        <EmptyState illustration="failure" title="动作类型加载失败" desc={error} />
      ) : loading ? (
        <div className="mp-onto-muted mp-py-6">加载动作类型…</div>
      ) : applicable.length === 0 ? (
        <EmptyState
          illustration="no-content"
          title="该类型没有可执行的动作"
          desc="动作类型通过 ActionType.on 绑定到对象类型；请先在「概念建模 · 动作类型」里定义。"
        />
      ) : (
        <>
          <label className="mp-onto-field">
            <span className="mp-onto-field-label">动作类型</span>
            <Select
              value={actionRid || undefined}
              placeholder="选择要执行的动作"
              filter
              onChange={(v) => setActionRid(String(v))}
              optionList={applicable.map((a) => ({
                value: a.rid,
                label: `${a.title || ridTail(a.rid)} · ${ridTail(a.rid)}`,
              }))}
            />
          </label>

          {selected ? (
            <>
              {selected.description ? (
                <p className="mp-onto-muted mp-m-0">{selected.description}</p>
              ) : null}
              {(selected.parameters ?? []).length === 0 ? (
                <div className="mp-onto-muted">该动作没有参数，确认后直接执行。</div>
              ) : (
                (selected.parameters ?? []).map((p) => (
                  <ParamField
                    key={p.rid}
                    param={p}
                    value={values[p.rid]}
                    onChange={(v) => setValues((prev) => ({ ...prev, [p.rid]: v }))}
                  />
                ))
              )}
            </>
          ) : (
            <div className="mp-onto-muted">先选一个动作类型。</div>
          )}
        </>
      )}
      </div>
    </SheetDetail>
  );
}
