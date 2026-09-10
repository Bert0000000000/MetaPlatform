// BackingDatasourcePanel - B5 / DATA-14/15 数据源绑定卡（OntologyDatacenterPage 顶部区块）。
//
// 类型选择（listObjectTypes）→ GET  /object-types/{rid}/datasources 声明表
// 同步 / 增量同步             → POST /object-types/{rid}/datasources/sync[?incremental=true]
// 物化视图                    → GET  /object-types/{rid}/materialization
// 新建声明                    → POST /object-types/{rid}/datasources
//   （name/table/pk_column/priority + field_mapping：属性 rid → 列名；body.class_rid 用所选类型）
//
// 语义：同步尊重用户编辑覆盖层（writeback 双流合并）；增量按 ts_column > 水位。
// dev 模式 Semi 交互组件 onClick 被截 noop —— 交互元素全部原生 + 内联样式。

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { Card, Table } from '@douyinfe/semi-ui';
import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';
import { Database, Plus } from 'lucide-react';
import { toast } from '@mate/shared';
import {
  errDetailText, getMaterialization, listBackingDatasources, listObjectTypes,
  syncBackingDatasources, upsertBackingDatasource,
  type KernelBackingDatasource, type KernelObjectType, type MaterializationResult,
} from '@/api/ont/kernel';

const inputStyle: CSSProperties = {
  height: 30, minWidth: 0, flex: 1, boxSizing: 'border-box',
  background: 'var(--card)', border: '1px solid var(--border)',
  borderRadius: 6, padding: '0 10px', fontSize: 12,
  color: 'var(--foreground)', outline: 'none',
};

const monoInputStyle: CSSProperties = { ...inputStyle, fontFamily: 'monospace' };

const btnStyle: CSSProperties = {
  height: 28, padding: '0 12px', fontSize: 12, borderRadius: 6,
  border: '1px solid var(--border)', background: 'var(--card)',
  color: 'var(--foreground)', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
};

const labelStyle: CSSProperties = {
  fontSize: 12, color: 'var(--muted-foreground)', flexShrink: 0,
};

interface MappingRow {
  key: string;
  prop: string;
  col: string;
}

export default function BackingDatasourcePanel() {
  const [types, setTypes] = useState<KernelObjectType[]>([]);
  const [selRid, setSelRid] = useState('');
  const [decls, setDecls] = useState<KernelBackingDatasource[]>([]);
  const [loadingTypes, setLoadingTypes] = useState(true);
  const [loadingDecls, setLoadingDecls] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [opBusy, setOpBusy] = useState(''); // 'sync' | 'incr' | 'mat' | 'decl'
  const [syncResult, setSyncResult] = useState<Record<string, number> | null>(null);
  const [mat, setMat] = useState<MaterializationResult | null>(null);
  // 新建声明表单
  const [fName, setFName] = useState('');
  const [fTable, setFTable] = useState('');
  const [fPk, setFPk] = useState('');
  const [fPrio, setFPrio] = useState('100');
  const [fMap, setFMap] = useState<MappingRow[]>([]);

  const loadDecls = useCallback(async (rid: string, silent = false) => {
    setLoadingDecls(true);
    if (!silent) setErr('');
    try {
      setDecls(await listBackingDatasources(rid));
    } catch (e) {
      setDecls([]);
      if (!silent) setErr(errDetailText(e, '数据源声明加载失败'));
    } finally {
      setLoadingDecls(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const ts = await listObjectTypes();
        if (!active) return;
        setTypes(ts);
        const first = ts[0]?.rid ?? '';
        setSelRid(first);
        if (first) void loadDecls(first);
      } catch (e) {
        if (active) setErr(errDetailText(e, '类型清单加载失败'));
      } finally {
        if (active) setLoadingTypes(false);
      }
    })();
    return () => { active = false; };
  }, [loadDecls]);

  const pickType = (rid: string) => {
    setSelRid(rid);
    setSyncResult(null);
    setMat(null);
    setMsg('');
    setErr('');
    void loadDecls(rid);
  };

  /** 全量 / 增量同步 → {源名: 同步行数}。 */
  const doSync = async (incremental: boolean) => {
    if (!selRid) { setErr('请先选择类型'); return; }
    setOpBusy(incremental ? 'incr' : 'sync'); setErr(''); setMsg('');
    try {
      const stats = await syncBackingDatasources(selRid, incremental);
      setSyncResult(stats);
      setMat(null);
      const total = Object.values(stats).reduce((a, b) => a + (b || 0), 0);
      const bySrc = Object.entries(stats).map(([s, n]) => `${s}: ${n}`).join('、');
      setMsg(`${incremental ? '增量' : '全量'}同步完成：共 ${total} 行${bySrc ? `（${bySrc}）` : '（无源）'}`);
      await loadDecls(selRid, true);
    } catch (e) {
      setErr(errDetailText(e, `${incremental ? '增量' : '全量'}同步失败`));
    } finally {
      setOpBusy('');
    }
  };

  /** 物化视图：count + schema 属性数 + 前 5 行 JSON 折叠展示。 */
  const doMaterialize = async () => {
    if (!selRid) { setErr('请先选择类型'); return; }
    setOpBusy('mat'); setErr(''); setMsg('');
    try {
      setMat(await getMaterialization(selRid));
    } catch (e) {
      setErr(errDetailText(e, '读取物化视图失败'));
    } finally {
      setOpBusy('');
    }
  };

  const doCreateDecl = async () => {
    if (!selRid) { setErr('请先选择类型'); return; }
    if (!fName.trim() || !fTable.trim() || !fPk.trim()) {
      setErr('声明需要 name / table / pk_column'); return;
    }
    const mapping: Record<string, string> = {};
    for (const r of fMap) {
      if (r.prop.trim() && r.col.trim()) mapping[r.prop.trim()] = r.col.trim();
    }
    if (Object.keys(mapping).length === 0) {
      setErr('field_mapping 至少需要一行完整映射（属性 rid → 列名）'); return;
    }
    const prio = Number(fPrio);
    setOpBusy('decl'); setErr(''); setMsg('');
    try {
      await upsertBackingDatasource(selRid, {
        class_rid: selRid,
        name: fName.trim(),
        table: fTable.trim(),
        pk_column: fPk.trim(),
        field_mapping: mapping,
        priority: fPrio.trim() !== '' && Number.isFinite(prio) ? prio : 100,
      });
      setMsg(`数据源声明已保存：${fName.trim()}（${Object.keys(mapping).length} 个字段映射）`);
      toast('数据源声明已保存', 'success');
      setFName(''); setFTable(''); setFPk(''); setFPrio('100'); setFMap([]);
      await loadDecls(selRid, true);
    } catch (e) {
      setErr(errDetailText(e, '保存数据源声明失败'));
    } finally {
      setOpBusy('');
    }
  };

  const declCols: ColumnProps<KernelBackingDatasource>[] = [
    { title: '名称', dataIndex: 'name', render: (v: string) => (
      <span style={{ fontSize: 12, fontWeight: 500 }}>{v}</span>) },
    { title: '类型', dataIndex: 'kind', width: 90, render: (v: string) => (
      <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{v || 'pg_table'}</span>) },
    { title: '源表', dataIndex: 'table_name', render: (v: string) => (
      <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{v}</span>) },
    { title: '主键列', dataIndex: 'pk_column', width: 100, render: (v: string) => (
      <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{v}</span>) },
    { title: '优先级', dataIndex: 'priority', width: 70 },
    { title: '时间戳列', dataIndex: 'ts_column', width: 100, render: (v: string) => (
      <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{v || 'updated_at'}</span>) },
    { title: '上次同步', dataIndex: 'last_synced_at', width: 150, render: (v: string | null | undefined) => (
      <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
        {v ? new Date(v).toLocaleString() : '—'}
      </span>) },
  ];

  return (
    <Card bodyStyle={{ padding: 0, marginBottom: 16 }}>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 8, alignItems: 'center' }}>
        <Database style={{ width: 15, height: 15 }} />
        <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>数据源绑定（Ontology 对象索引）</h4>
        <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>DATA-14/15 · backing datasources 声明 / 同步 / 物化</span>
      </div>
      <div style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {msg && (
          <div style={{
            padding: '8px 14px', fontSize: 12, borderRadius: 6,
            border: '1px solid var(--success)', color: 'var(--success)',
            wordBreak: 'break-all',
          }}>{msg}</div>
        )}
        {err && (
          <div style={{
            padding: '8px 14px', fontSize: 12, borderRadius: 6,
            border: '1px solid var(--destructive)', color: 'var(--destructive)',
            wordBreak: 'break-all',
          }}>{err}</div>
        )}

        {/* 类型选择 + 操作 */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={labelStyle}>目标类型</span>
          <select
            value={selRid}
            onChange={(e) => pickType(e.target.value)}
            disabled={loadingTypes}
            style={{
              ...monoInputStyle, flex: '1 1 280px', cursor: 'pointer',
              maxWidth: 420,
            }}
          >
            {loadingTypes && <option value="">（类型加载中…）</option>}
            {!loadingTypes && types.length === 0 && <option value="">（暂无类型）</option>}
            {types.map((ot) => (
              <option key={ot.rid} value={ot.rid} title={ot.rid}>
                {ot.display_name || ot.rid}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void doSync(false)}
            disabled={!selRid || opBusy !== ''}
            style={{ ...btnStyle, cursor: opBusy !== '' ? 'wait' : 'pointer' }}
          >
            {opBusy === 'sync' ? '同步中…' : '同步'}
          </button>
          <button
            type="button"
            onClick={() => void doSync(true)}
            disabled={!selRid || opBusy !== ''}
            style={{ ...btnStyle, cursor: opBusy !== '' ? 'wait' : 'pointer' }}
          >
            {opBusy === 'incr' ? '增量中…' : '增量同步'}
          </button>
          <button
            type="button"
            onClick={() => void doMaterialize()}
            disabled={!selRid || opBusy !== ''}
            style={{ ...btnStyle, cursor: opBusy !== '' ? 'wait' : 'pointer' }}
          >
            {opBusy === 'mat' ? '读取中…' : '物化视图'}
          </button>
        </div>

        {/* 同步结果 {src: n} */}
        {syncResult && (
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'baseline' }}>
            <span style={{ fontSize: 12, fontWeight: 600 }}>同步统计</span>
            {Object.keys(syncResult).length === 0 ? (
              <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>无源（未声明数据源）</span>
            ) : Object.entries(syncResult).map(([src, n]) => (
              <span key={src} style={{ fontSize: 12 }}>
                <span style={{ fontFamily: 'monospace', color: 'var(--muted-foreground)' }}>{src}</span>
                {' → '}
                <span style={{ fontWeight: 600 }}>{n}</span> 行
              </span>
            ))}
          </div>
        )}

        {/* 物化视图结果 */}
        {mat && (
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
              物化视图 · {mat.count} 行 · schema {Object.keys(mat.schema).length} 个属性
              {mat.generated_at && (
                <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 400, color: 'var(--muted-foreground)' }}>
                  生成于 {new Date(mat.generated_at).toLocaleString()}
                </span>
              )}
            </div>
            {mat.rows.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>暂无实例行</div>
            ) : (
              <details>
                <summary style={{ fontSize: 12, cursor: 'pointer', color: 'var(--muted-foreground)' }}>
                  前 5 行 JSON（共 {mat.rows.length} 行）
                </summary>
                <pre style={{
                  margin: '8px 0 0', padding: 10, background: 'var(--card)',
                  border: '1px solid var(--border)', borderRadius: 6, fontSize: 11,
                  lineHeight: 1.5, overflow: 'auto', maxHeight: 260,
                }}>
                  {JSON.stringify(mat.rows.slice(0, 5), null, 2)}
                </pre>
              </details>
            )}
          </div>
        )}

        {/* 声明表 */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>
            数据源声明{selRid ? `（${selRid}）` : ''}
          </div>
          <Table<KernelBackingDatasource>
            columns={declCols}
            dataSource={decls}
            rowKey="rid"
            pagination={false}
            size="small"
            loading={loadingDecls}
            empty="该类型尚无数据源声明 —— 用下方表单新建"
          />
        </div>

        {/* 新建声明表单（原生元素） */}
        <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 600 }}>新建声明</div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <span style={{ ...labelStyle, width: 60 }}>名称 *</span>
            <input type="text" placeholder="声明名（同类型下唯一，如 crm_db）" value={fName}
              onChange={(e) => setFName(e.target.value)} style={inputStyle} />
            <span style={{ ...labelStyle, width: 60 }}>源表 *</span>
            <input type="text" placeholder="schema.table（同实例 PG 表）" value={fTable}
              onChange={(e) => setFTable(e.target.value)} style={monoInputStyle} />
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <span style={{ ...labelStyle, width: 60 }}>主键列 *</span>
            <input type="text" placeholder="pk_column（如 id）" value={fPk}
              onChange={(e) => setFPk(e.target.value)} style={monoInputStyle} />
            <span style={{ ...labelStyle, width: 60 }}>优先级</span>
            <input type="number" value={fPrio} placeholder="100"
              onChange={(e) => setFPrio(e.target.value)}
              style={{ ...inputStyle, flex: '0 1 130px' }} />
          </div>
          <div>
            <div style={{ ...labelStyle, marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>字段映射（field_mapping：属性 rid → 源表列名）</span>
              <button
                type="button"
                onClick={() => setFMap((rs) => [...rs, { key: crypto.randomUUID(), prop: '', col: '' }])}
                style={{ ...btnStyle, height: 24, padding: '0 8px', fontSize: 11 }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Plus style={{ width: 11, height: 11 }} />添加映射
                </span>
              </button>
            </div>
            {fMap.map((r) => (
              <div key={r.key} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                <input type="text" placeholder="属性 rid（ont.…prop…v1）" value={r.prop}
                  onChange={(e) => setFMap((rs) => rs.map((x) => (x.key === r.key ? { ...x, prop: e.target.value } : x)))}
                  style={monoInputStyle} />
                <span style={{ fontSize: 12, color: 'var(--muted-foreground)', flexShrink: 0 }}>→</span>
                <input type="text" placeholder="源表列名" value={r.col}
                  onChange={(e) => setFMap((rs) => rs.map((x) => (x.key === r.key ? { ...x, col: e.target.value } : x)))}
                  style={inputStyle} />
                <button
                  type="button"
                  aria-label="删除此映射"
                  onClick={() => setFMap((rs) => rs.filter((x) => x.key !== r.key))}
                  style={{
                    ...btnStyle, height: 24, padding: '0 8px', fontSize: 11,
                    color: 'var(--destructive)', flexShrink: 0,
                  }}
                >删除</button>
              </div>
            ))}
            {fMap.length === 0 && (
              <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
                尚未添加映射；至少一行完整映射（属性 rid → 列名）才能保存声明。
              </div>
            )}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => void doCreateDecl()} disabled={!selRid || opBusy === 'decl'}
              style={{ ...btnStyle, cursor: opBusy === 'decl' ? 'wait' : 'pointer' }}>
              {opBusy === 'decl' ? '保存中…' : '保存声明'}
            </button>
          </div>
        </div>

        {/* 提示行 */}
        <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
          同步尊重用户编辑覆盖层（writeback 双流合并）；增量按 ts_column &gt; 水位。
        </div>
      </div>
    </Card>
  );
}
