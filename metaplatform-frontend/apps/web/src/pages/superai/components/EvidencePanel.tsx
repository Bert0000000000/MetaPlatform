import type { Claim, Evidence } from '@/api/superai/types';

/**
 * 结构化证据展示面板（SuperAI 聊天卡片）。
 *
 * 展示 AI 回答的「关键论断」（Claims）与「支撑证据」（Evidence）：
 * - Claims：事实 / 推断 / 建议，带置信度。
 * - Evidence：知识库文档（DOCUMENT）与本体关系（ONTOLOGY_OBJECT）等。
 *
 * 配色跟随主题（深浅色自动切换）。
 */

const CLAIM_META: Record<Claim['type'], { color: string; label: string }> = {
  FACT: { color: '#3b82f6', label: '事实' },
  INFERENCE: { color: '#a855f7', label: '推断' },
  RECOMMENDATION: { color: '#f97316', label: '建议' },
};

const EVIDENCE_META: Record<Evidence['type'], { color: string; label: string }> = {
  ONTOLOGY_OBJECT: { color: '#06b6d4', label: '本体对象' },
  ONTOLOGY_METRIC: { color: '#6366f1', label: '本体指标' },
  DOCUMENT: { color: '#22c55e', label: '文档' },
  EXTERNAL: { color: '#f97316', label: '外部' },
  MODEL_DERIVED: { color: '#a855f7', label: '模型推导' },
};

export default function EvidencePanel({
  claims,
  evidence,
}: {
  claims?: Claim[];
  evidence?: Evidence[];
}) {
  if ((!claims || claims.length === 0) && (!evidence || evidence.length === 0)) {
    return null;
  }
  return (
    <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* 关键论断 */}
      {claims && claims.length > 0 && (
        <div
          style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            padding: 10,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted-foreground)', marginBottom: 8 }}>
            关键论断
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {claims.map((c, i) => {
              const meta = CLAIM_META[c.type] ?? CLAIM_META.INFERENCE;
              return (
                <div key={c.claimId ?? i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <span
                    style={{
                      flexShrink: 0,
                      fontSize: 11,
                      lineHeight: '20px',
                      padding: '0 8px',
                      borderRadius: 4,
                      color: '#fafafa',
                      background: meta.color,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {meta.label}
                  </span>
                  <span style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--foreground)' }}>
                    {c.content}
                    {c.confidence != null && (
                      <span style={{ marginLeft: 6, color: 'var(--muted-foreground)', fontSize: 11 }}>
                        · {(c.confidence * 100).toFixed(0)}%
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 证据 */}
      {evidence && evidence.length > 0 && (
        <div
          style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            padding: 10,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted-foreground)', marginBottom: 8 }}>
            证据
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {evidence.map((e, i) => {
              const meta = EVIDENCE_META[e.type] ?? EVIDENCE_META.DOCUMENT;
              return (
                <div
                  key={e.evidenceId ?? i}
                  style={{
                    border: '1px solid var(--border)',
                    borderRadius: 4,
                    padding: '4px 10px',
                    fontSize: 12,
                    color: 'var(--muted-foreground)',
                    background: 'var(--muted)',
                    maxWidth: 320,
                  }}
                >
                  <span style={{ color: meta.color, fontWeight: 600, marginRight: 6 }}>
                    {meta.label}
                  </span>
                  <span style={{ color: 'var(--foreground)' }}>{e.title ?? e.ref}</span>
                  {e.score != null && (
                    <span style={{ marginLeft: 6, color: 'var(--muted-foreground)', fontSize: 11 }}>
                      {Math.round(e.score * 100)}%
                    </span>
                  )}
                  {e.fragment && (
                    <div
                      style={{
                        color: 'var(--muted-foreground)',
                        fontSize: 11,
                        marginTop: 2,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={e.fragment}
                    >
                      {e.fragment}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
