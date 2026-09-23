import { useCallback, useEffect, useState, type ChangeEvent } from 'react';
import { Download, Upload } from 'lucide-react';
import { toast } from '@mate/shared';
import {
  exportObjectType,
  importObjectTypes,
  listObjectTypes,
  slugAndVersionOfObjectType,
  type KernelObjectType,
} from '@/api/ont/kernel';
import { EmptyState, PageHeader } from '@/components/skeleton';
import '../governance.css';

/** 从 axios 错误中取 FastAPI detail。 */
function verErrText(e: unknown, fallback: string): string {
  const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
  return detail ?? (e instanceof Error ? e.message : fallback);
}

/**
 * 导入导出（IA2-6 自 GovernancePage 的导入导出区块拆出）：
 * 正式路由 /ontology/governance/import-export。JSON 导出 / 文件导入回灌。
 */
export default function ImportExportPage() {
  const [types, setTypes] = useState<KernelObjectType[]>([]);
  const [verRid, setVerRid] = useState('');
  const [verBusy, setVerBusy] = useState('');
  const [verMsg, setVerMsg] = useState('');
  const [verErr, setVerErr] = useState('');
  const [importResult, setImportResult] = useState<{ ok: boolean; text: string } | null>(null);

  const reloadTypes = useCallback(() => {
    listObjectTypes().then((ts) => {
      setTypes(ts);
      setVerRid((cur) => (cur && ts.some((t) => t.rid === cur) ? cur : (ts[0]?.rid ?? '')));
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    reloadTypes();
  }, [reloadTypes]);

  const doExport = async () => {
    if (!verRid) { setVerErr('请先选择类型'); return; }
    setVerBusy('export'); setVerErr(''); setVerMsg('');
    try {
      const data = await exportObjectType(verRid);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${verRid}.export.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setVerMsg(`已导出 ${verRid}（JSON-LD）`);
    } catch (e) {
      setVerErr(verErrText(e, '导出失败'));
    } finally {
      setVerBusy('');
    }
  };

  const onImportFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = ''; // 允许重复选择同一文件
    if (!f) return;
    setVerBusy('import'); setVerErr(''); setVerMsg(''); setImportResult(null);
    try {
      const text = await f.text();
      let payload: Record<string, unknown>;
      try {
        payload = JSON.parse(text) as Record<string, unknown>;
      } catch (se) {
        setImportResult({ ok: false, text: `文件不是合法 JSON：${se instanceof Error ? se.message : String(se)}` });
        return;
      }
      const ot = await importObjectTypes(payload);
      setImportResult({ ok: true, text: `导入成功：${ot.rid}（${ot.display_name} · ${ot.properties.length} 属性）` });
      toast('导入成功', 'success');
      reloadTypes();
    } catch (er) {
      setImportResult({ ok: false, text: verErrText(er, '导入失败') });
    } finally {
      setVerBusy('');
    }
  };

  return (
    <>
      <PageHeader
        title="导入导出"
        desc="类型 JSON 导出（JSON-LD）· 文件导入回灌"
      />
      <div className="mp-gov-card">
        <div className="mp-flex-center mp-gap-2">
          <span className="mp-text-sm mp-text-2 mp-shrink-0">目标类型</span>
          <select
            value={verRid}
            onChange={(e) => setVerRid(e.target.value)}
            className="mp-clickable mp-onto-input mp-onto-input--lg mp-onto-ver-input"
          >
            {types.length === 0 && <option value="">（暂无类型）</option>}
            {types.map((ot) => {
              const sv = slugAndVersionOfObjectType(ot.rid);
              return (
                <option key={ot.rid} value={ot.rid}>
                  {ot.display_name || ot.rid}{sv.version ? `（${sv.version}）` : ''}
                </option>
              );
            })}
          </select>
        </div>

        <div className="mp-flex mp-border mp-gap-2 mp-py-3 mp-px-3 mp-flex-col mp-rounded">
          <div className="mp-fw-600 mp-text-sm">导入 / 导出</div>
          <div className="mp-gap-2 mp-flex-center mp-wrap">
            <button type="button" onClick={() => void doExport()} disabled={verBusy === 'export'} className="mp-onto-btn mp-onto-btn--lg">
              <span className="mp-inline-flex mp-items-center mp-gap-1">
                <Download className="mp-icon-12" />
                {verBusy === 'export' ? '导出中…' : `导出当前类型（${verRid ? verRid.split('.')[3] ?? verRid : '—'}）`}
              </span>
            </button>
            <span className="mp-inline-flex mp-items-center mp-text-sm mp-gap-1">
              <Upload className="mp-icon-12 mp-text-2" />
              <input
                type="file"
                accept="application/json,.json"
                onChange={(e) => void onImportFile(e)}
                disabled={verBusy === 'import'}
                className="mp-text-sm mp-text-2"
              />
            </span>
          </div>
          {importResult && (
            <div className={`mp-break-all mp-text-sm mp-py-2 mp-px-3 mp-rounded ${importResult.ok ? 'mp-onto-note-success' : 'mp-onto-note-danger'}`}>
              {importResult.text}
            </div>
          )}
        </div>

        {verMsg && (
          <div className="mp-text-sm mp-text-success mp-py-2 mp-px-3 mp-rounded mp-onto-note-success">{verMsg}</div>
        )}
        {verErr && (
          <div className="mp-break-all mp-text-sm mp-text-danger mp-py-2 mp-px-3 mp-rounded mp-onto-note-danger">{verErr}</div>
        )}

        {types.length === 0 && (
          <EmptyState illustration="no-content" title="还没有对象类型" desc="先在语义模型里创建类型。" />
        )}
      </div>
    </>
  );
}
