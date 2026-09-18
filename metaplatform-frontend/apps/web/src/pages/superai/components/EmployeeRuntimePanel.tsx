import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, Tag, Toast, Typography } from '@douyinfe/semi-ui';
import {
  RUNTIME_KINDS,
  RUNTIME_LABELS,
  listProfiles,
  updateProfileRuntimes,
  type EmployeeProfile,
  type RuntimeKind,
} from '@/api/agentTeam';

/**
 * 数字员工的**执行面**配置（C-5 / `MP-AGENT-PROFILE-MGMT-01`）。
 *
 * 「角色」与「运行时」是正交两轴（ADR-0066 §5.8）：`base_role` 决定它是谁，
 * `runtimes` 决定它能在哪跑。这个面板只管后者。
 *
 * 两条来自本批锁死决策的行为，写在这里免得被当成 bug：
 *
 * 1. **不做静默切换**。后端对非法取值是**拒绝**（400），不是悄悄回落到默认值。
 *    所以这里的错误提示把后端的话**原样**显示出来——"你配的值没生效"必须看得见。
 * 2. **改一个字段要回传整份定义**。`PUT /profiles/{id}` 是 upsert 不是 patch：
 *    只发 `runtimes` 会把提示词、技能、工具白名单、权限包络全清空。所以先把
 *    `listProfiles()` 拿到的那一份原样带上，只换 `runtimes`（见 `updateProfileRuntimes`）。
 *
 * 交互按钮一律**原生 `<button>`**：dev 预览窗里 Semi `Button` 的 `onClick` 会被
 * React 18 事件委托截成 noop（本仓反复踩到的环境怪癖）。
 */
export default function EmployeeRuntimePanel() {
  const [profiles, setProfiles] = useState<EmployeeProfile[]>([]);
  const [draft, setDraft] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState('');
  const [loadError, setLoadError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const rows = await listProfiles();
      setProfiles(rows);
      setDraft({});
    } catch (e) {
      // 读不到就**说读不到**，不画一份空名单冒充"没有员工"
      setLoadError(e instanceof Error ? e.message : String(e));
      setProfiles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /** 后端回的 `runtimes` 缺省即默认那一档（老数据没有这个字段）。 */
  const effective = useCallback(
    (profile: EmployeeProfile): string[] => profile.runtimes ?? ['superai'],
    [],
  );

  const dirty = useMemo(
    () =>
      profiles.some((profile) => {
        const next = draft[profile.profile_id];
        if (!next) return false;
        const current = effective(profile);
        return [...next].sort().join(',') !== [...current].sort().join(',');
      }),
    [draft, profiles, effective],
  );

  const toggle = (profile: EmployeeProfile, kind: RuntimeKind) => {
    setDraft((prev) => {
      const current = prev[profile.profile_id] ?? effective(profile);
      const next = current.includes(kind)
        ? current.filter((item) => item !== kind)
        : [...current, kind];
      return { ...prev, [profile.profile_id]: next };
    });
  };

  const save = async (profile: EmployeeProfile) => {
    const next = draft[profile.profile_id] ?? effective(profile);
    setSavingId(profile.profile_id);
    try {
      const saved = await updateProfileRuntimes(profile, next);
      setProfiles((prev) =>
        prev.map((row) => (row.profile_id === saved.profile_id ? saved : row)),
      );
      setDraft((prev) => {
        const copy = { ...prev };
        delete copy[profile.profile_id];
        return copy;
      });
      Toast.success(`${saved.name || saved.profile_id} 的执行面已落库`);
    } catch (e) {
      // 后端的拒绝理由原样带出来（"不许静默切换"靠的就是它可见）
      Toast.error(`保存失败：${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSavingId('');
    }
  };

  return (
    <Card
      className="mp-team-gap"
      title="数字员工 · 执行面（Runtime）"
      headerExtraContent={
        <button
          type="button"
          className="mp-proposal-btn"
          onClick={() => void load()}
          disabled={loading}
          data-testid="employee-runtime-reload"
        >
          重新读取
        </button>
      }
    >
      <Typography.Text type="tertiary" size="small">
        改了要保存才落库；落库后重启服务仍在。不允许的执行面会被后端拒绝，不会静默回落到默认值。
      </Typography.Text>

      {loadError ? (
        <div className="mp-runtime-error" data-testid="employee-runtime-error">
          读取员工名册失败：{loadError}
        </div>
      ) : null}

      {loading && profiles.length === 0 ? (
        <Typography.Text type="tertiary" size="small">
          正在读取员工名册…
        </Typography.Text>
      ) : null}

      {profiles.map((profile) => {
        const selected = draft[profile.profile_id] ?? effective(profile);
        const changed = draft[profile.profile_id] !== undefined;
        return (
          <div
            className="mp-runtime-row"
            key={profile.profile_id}
            data-testid={`employee-runtime-row-${profile.profile_id}`}
          >
            <div className="mp-runtime-head">
              <span className="mp-runtime-name">{profile.name || profile.profile_id}</span>
              <Typography.Text type="tertiary" size="small">
                {profile.profile_id} · {profile.base_role}
              </Typography.Text>
            </div>
            <div className="mp-runtime-chips">
              {RUNTIME_KINDS.map((kind) => {
                const on = selected.includes(kind);
                return (
                  <button
                    type="button"
                    key={kind}
                    className={`mp-runtime-chip${on ? ' mp-runtime-chip--on' : ''}`}
                    aria-pressed={on}
                    onClick={() => toggle(profile, kind)}
                    data-testid={`employee-runtime-${profile.profile_id}-${kind}`}
                  >
                    {RUNTIME_LABELS[kind]}
                  </button>
                );
              })}
            </div>
            <div className="mp-runtime-actions">
              {selected.length === 0 ? (
                <Tag color="orange" type="light" size="small">
                  至少留一个执行面
                </Tag>
              ) : null}
              <button
                type="button"
                className="mp-proposal-btn mp-proposal-btn--primary"
                disabled={!changed || selected.length === 0 || savingId === profile.profile_id}
                onClick={() => void save(profile)}
                data-testid={`employee-runtime-save-${profile.profile_id}`}
              >
                {savingId === profile.profile_id ? '保存中…' : '保存'}
              </button>
            </div>
          </div>
        );
      })}

      {!loading && !loadError && profiles.length === 0 ? (
        <Typography.Text type="tertiary" size="small">
          这个租户下没有可配置的员工。
        </Typography.Text>
      ) : null}

      {dirty ? (
        <Typography.Text type="warning" size="small" data-testid="employee-runtime-unsaved">
          有未保存的改动
        </Typography.Text>
      ) : null}
    </Card>
  );
}
