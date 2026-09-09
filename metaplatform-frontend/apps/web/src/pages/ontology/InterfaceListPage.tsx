// InterfaceListPage - Interface 管理（ONT-UI-03 之一，Palantir Interface 视图对位）。
//
// 列出全部 Interface：属性签名（多态契约）+ required_links + 实现类型数
// （GET /interfaces + /interfaces/{rid}/implementations）。点击展开实现清单。

import { useEffect, useState } from 'react';
import { Card, Tag } from '@douyinfe/semi-ui';
import { ChevronDown, ChevronRight, Layers, Loader2 } from 'lucide-react';
import {
  listInterfaceImplementations, listInterfaces, propSlug,
  type KernelInterface,
} from '@/api/ont/kernel';

interface Row extends KernelInterface {
  implementations?: string[];
  expanded?: boolean;
}

export default function InterfaceListPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const ifcs = await listInterfaces();
        if (!active) return;
        setRows(ifcs.map((i) => ({ ...i })));
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const toggle = async (rid: string) => {
    const row = rows.find((r) => r.rid === rid);
    if (!row) return;
    if (row.expanded) {
      setRows((rs) => rs.map((r) => (r.rid === rid ? { ...r, expanded: false } : r)));
      return;
    }
    if (!row.implementations) {
      try {
        const impls = await listInterfaceImplementations(rid);
        setRows((rs) => rs.map((r) => (
          r.rid === rid ? { ...r, implementations: impls, expanded: true } : r)));
        return;
      } catch {
        setRows((rs) => rs.map((r) => (
          r.rid === rid ? { ...r, implementations: [], expanded: true } : r)));
      }
    }
    setRows((rs) => rs.map((r) => (r.rid === rid ? { ...r, expanded: true } : r)));
  };

  return (
    <Card bodyStyle={{ padding: 0 }}>
      <div style={{
        padding: '14px 20px', borderBottom: '1px solid var(--border)',
        display: 'flex', gap: 8, alignItems: 'center',
      }}>
        <Layers style={{ width: 15, height: 15, color: '#c084fc' }} />
        <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Interface（多态契约）</h4>
        <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
          组合优于深层次级 —— 接口是跨类型能力契约，可作多态查询源
        </span>
      </div>
      {loading ? (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: 40, justifyContent: 'center', color: 'var(--muted-foreground)', fontSize: 13 }}>
          <Loader2 style={{ width: 14, height: 14, animation: 'osp-spin 1s linear infinite' }} /> 加载 Interface…
        </div>
      ) : error ? (
        <div style={{ padding: 20, fontSize: 12, color: 'var(--destructive)' }}>{error}</div>
      ) : rows.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', fontSize: 13, color: 'var(--muted-foreground)' }}>
          暂无 Interface —— 通过 POST /ont/v2/interfaces 注册（属性签名 + required_links）
        </div>
      ) : (
        <div>
          {rows.map((r) => (
            <div key={r.rid} style={{ borderBottom: '1px solid var(--border)' }}>
              <button
                type="button"
                onClick={() => void toggle(r.rid)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                  padding: '12px 20px', background: 'transparent', border: 'none',
                  cursor: 'pointer', textAlign: 'left',
                }}
              >
                {r.expanded
                  ? <ChevronDown style={{ width: 14, height: 14, color: 'var(--muted-foreground)' }} />
                  : <ChevronRight style={{ width: 14, height: 14, color: 'var(--muted-foreground)' }} />}
                <span style={{ fontSize: 13, fontWeight: 600 }}>{r.rid.split('.')[3] ?? r.rid}</span>
                <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--muted-foreground)' }}>{r.rid}</span>
                <span style={{ flex: 1 }} />
                <Tag size="small">{r.properties.length} 属性</Tag>
                {r.implementations !== undefined && (
                  <Tag size="small" color="purple">{r.implementations.length} 实现</Tag>
                )}
              </button>
              {r.expanded && (
                <div style={{ padding: '0 20px 16px 48px' }}>
                  <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 6 }}>属性签名</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                    {r.properties.map((p) => (
                      <Tag key={p.rid} size="small">
                        {p.title || propSlug(p.rid)}: {p.format}
                      </Tag>
                    ))}
                  </div>
                  {r.required_links.length > 0 && (
                    <>
                      <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 6 }}>必需 Link</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                        {r.required_links.map((l) => <Tag key={l} size="small" color="cyan">{l}</Tag>)}
                      </div>
                    </>
                  )}
                  <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 6 }}>实现类型</div>
                  {(r.implementations ?? []).length === 0 ? (
                    <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>暂无实现</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {(r.implementations ?? []).map((impl) => (
                        <span key={impl} style={{ fontFamily: 'monospace', fontSize: 11 }}>{impl}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
