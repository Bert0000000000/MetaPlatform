// ObjectTypeDetailPage — 单个 ObjectType 详情：属性表 + 关联 Action + 加 property 表单。
// GOVERN-12-04 A 路径：完整 ontology 模型编辑器（Detail 子页）。
// 数据源：mate-tech-ont v2 kernel GET /ont/v2/object-types/{rid}。

import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Zap } from 'lucide-react';
import {
  getObjectType,
  listActionTypes,
  slugAndVersionOfProperty,
  type KernelObjectType,
  type KernelActionType,
} from '@/api/ont/kernel';
import { apiClient } from '@/api/client';

export default function ObjectTypeDetailPage() {
  const { rid: rawRid } = useParams<{ rid: string }>();
  const navigate = useNavigate();
  const rid = rawRid ? decodeURIComponent(rawRid) : '';

  const [objectType, setObjectType] = useState<KernelObjectType | null>(null);
  const [actionTypes, setActionTypes] = useState<KernelActionType[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [propName, setPropName] = useState('');
  const [propType, setPropType] = useState('STRING');
  const [propTitle, setPropTitle] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!rid) return;
    let active = true;
    (async () => {
      try {
        const [ot, ats] = await Promise.all([getObjectType(rid), listActionTypes()]);
        if (!active) return;
        setObjectType(ot);
        setActionTypes(ats);
      } catch (e) {
        console.warn('ObjectType 详情加载失败', e);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [rid]);

  const linkedActions = useMemo(() => {
    if (!objectType) return [];
    return actionTypes.filter((at) => at.on.includes(objectType.rid));
  }, [actionTypes, objectType]);

  const submitAddProperty = async () => {
    if (!objectType || !propName.trim()) return;
    setSubmitting(true);
    try {
      await apiClient.post(
        `/ont/v2/object-types/${encodeURIComponent(objectType.rid)}/properties`,
        {
          rid: propName.trim(),
          type_id: propType,
          nullable: true,
          primary_key: false,
          title: propTitle.trim() || propName.trim(),
          format: '',
        },
      );
      // 重新拉详情
      const fresh = await getObjectType(objectType.rid);
      setObjectType(fresh);
      setAddOpen(false);
      setPropName('');
      setPropTitle('');
    } catch (e) {
      console.warn('新增 property 失败', e);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingBottom: 24 }}>
        <div style={{ marginTop: 24, marginBottom: 16 }}>
          <button
            className="v-btn"
            onClick={() => navigate('/ontology/object-types')}
            style={{ height: 28, padding: '0 10px', fontSize: 12 }}
          >
            <ArrowLeft style={{ width: 14, height: 14 }} />返回列表
          </button>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 13 }}>加载中…</div>
        ) : !objectType ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 13 }}>未找到 ObjectType</div>
        ) : (
          <>
            <div style={{ marginBottom: 24 }}>
              <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em' }}>{objectType.display_name}</h1>
              <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 4 }}>{objectType.rid}</div>
            </div>

            <div className="v-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
                <h4 style={{ fontSize: 14, fontWeight: 600 }}>{objectType.display_name} · 属性定义</h4>
                <button className="v-btn" style={{ height: 28, padding: '0 10px', fontSize: 12 }} onClick={() => setAddOpen(true)}>
                  <Plus style={{ width: 14, height: 14 }} />新增属性
                </button>
              </div>
              {addOpen && (
                <div style={{ padding: 16, borderBottom: '1px solid var(--border)', background: 'var(--muted)' }}>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <div>
                      <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 4 }}>属性名</div>
                      <input
                        value={propName}
                        onChange={(e) => setPropName(e.target.value)}
                        placeholder="例如 dept_name"
                        style={{ height: 30, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '0 10px', fontSize: 12, color: 'var(--foreground)', outline: 'none', width: 160 }}
                      />
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 4 }}>类型</div>
                      <select
                        value={propType}
                        onChange={(e) => setPropType(e.target.value)}
                        style={{ height: 30, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '0 10px', fontSize: 12, color: 'var(--foreground)', outline: 'none' }}
                      >
                        <option value="STRING">STRING</option>
                        <option value="INTEGER">INTEGER</option>
                        <option value="DECIMAL">DECIMAL</option>
                        <option value="BOOLEAN">BOOLEAN</option>
                        <option value="DATETIME">DATETIME</option>
                        <option value="ENUM">ENUM</option>
                      </select>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 4 }}>描述</div>
                      <input
                        value={propTitle}
                        onChange={(e) => setPropTitle(e.target.value)}
                        placeholder="可选"
                        style={{ height: 30, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '0 10px', fontSize: 12, color: 'var(--foreground)', outline: 'none', width: 200 }}
                      />
                    </div>
                    <button
                      className="v-btn-primary"
                      disabled={submitting || !propName.trim()}
                      onClick={submitAddProperty}
                      style={{ height: 30, padding: '0 14px', fontSize: 12, opacity: submitting || !propName.trim() ? 0.6 : 1 }}
                    >
                      {submitting ? '提交中…' : '保存'}
                    </button>
                    <button
                      className="v-btn"
                      onClick={() => setAddOpen(false)}
                      style={{ height: 30, padding: '0 10px', fontSize: 12 }}
                    >
                      取消
                    </button>
                  </div>
                </div>
              )}
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--muted)' }}>
                    <th style={{ padding: '10px 16px', fontSize: 12, fontWeight: 500, color: 'var(--muted-foreground)', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>属性名</th>
                    <th style={{ padding: '10px 16px', fontSize: 12, fontWeight: 500, color: 'var(--muted-foreground)', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>版本</th>
                    <th style={{ padding: '10px 16px', fontSize: 12, fontWeight: 500, color: 'var(--muted-foreground)', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>类型</th>
                    <th style={{ padding: '10px 16px', fontSize: 12, fontWeight: 500, color: 'var(--muted-foreground)', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>必填</th>
                    <th style={{ padding: '10px 16px', fontSize: 12, fontWeight: 500, color: 'var(--muted-foreground)', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>主键</th>
                    <th style={{ padding: '10px 16px', fontSize: 12, fontWeight: 500, color: 'var(--muted-foreground)', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>描述</th>
                  </tr>
                </thead>
                <tbody>
                  {objectType.properties.map((p) => {
                    const { slug, version } = slugAndVersionOfProperty(p.rid);
                    // 砍掉 kind 段（prop / prp）—— 后端用 'prop'，统一兼容
                    const propSlug = slug.replace(/^(prop|prp)\./, '');
                    return (
                      <tr key={p.rid}>
                        <td style={{ padding: '10px 16px', fontSize: 13, fontWeight: 500, borderBottom: '1px solid var(--border)' }}>{propSlug}</td>
                        <td style={{ padding: '10px 16px', fontSize: 12, color: 'var(--muted-foreground)', borderBottom: '1px solid var(--border)' }}>{version || '—'}</td>
                        <td style={{ padding: '10px 16px', fontSize: 13, borderBottom: '1px solid var(--border)' }}>{p.type_id}</td>
                        <td style={{ padding: '10px 16px', fontSize: 13, borderBottom: '1px solid var(--border)', color: p.nullable ? 'var(--muted-foreground)' : 'var(--success)' }}>{p.nullable ? '否' : '是'}</td>
                        <td style={{ padding: '10px 16px', fontSize: 13, borderBottom: '1px solid var(--border)', color: p.primary_key ? 'var(--success)' : 'var(--muted-foreground)' }}>{p.primary_key ? '是' : '否'}</td>
                        <td style={{ padding: '10px 16px', fontSize: 13, borderBottom: '1px solid var(--border)', color: 'var(--muted-foreground)' }}>{p.title}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="v-card" style={{ padding: 0, overflow: 'hidden', marginTop: 16 }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
                <h4 style={{ fontSize: 14, fontWeight: 600 }}>关联 Action（{linkedActions.length}）</h4>
              </div>
              {linkedActions.length === 0 ? (
                <div style={{ padding: 20, color: 'var(--muted-foreground)', fontSize: 12 }}>暂无关联 Action</div>
              ) : (
                linkedActions.map((at) => (
                  <div key={at.rid} style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                    <Zap style={{ width: 14, height: 14, color: 'var(--muted-foreground)' }} />
                    <span style={{ fontWeight: 500 }}>{at.rid}</span>
                    <span style={{ color: 'var(--muted-foreground)' }}>·</span>
                    <span style={{ color: 'var(--muted-foreground)' }}>side_effects: {at.side_effects.join(', ')}</span>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
