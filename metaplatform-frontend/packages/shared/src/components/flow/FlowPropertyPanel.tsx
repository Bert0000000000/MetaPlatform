/**
 * FlowPropertyPanel
 * --------------------------------------------------
 * 右侧属性面板：通过 FlowEditorMetaContext 读取选中节点与节点编辑回调，
 * 让面板真正响应 FlowGram 内部的 SelectionService。
 */
import { useMemo } from 'react';
import { useFlowEditorMeta } from './FlowContext';
import type { FlowNodeMaterial } from './flow-types';

export interface FlowPropertyPanelProps {
  materialsByType?: Record<string, FlowNodeMaterial>;
}

export function FlowPropertyPanel({ materialsByType: extraMap }: FlowPropertyPanelProps) {
  const meta = useFlowEditorMeta();
  const selectedNode = meta.selectedNode ?? null;
  const onPatch = meta.onPatchNode;
  const onSelect = meta.onSelectNode;

  const materialsByType = useMemo<Record<string, FlowNodeMaterial>>(() => {
    if (extraMap) return extraMap;
    const m: Record<string, FlowNodeMaterial> = {};
    (meta.materials ?? []).forEach((mat) => {
      m[mat.type] = mat;
    });
    return m;
  }, [extraMap, meta.materials]);

  const material = useMemo(() => {
    if (!selectedNode) return null;
    return materialsByType[selectedNode.type] ?? null;
  }, [materialsByType, selectedNode]);

  if (!selectedNode) {
    return (
      <div className="flow-canvas__panel">
        <div
          style={{
            padding: '12px 14px 10px',
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--flow-node-subtext)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            borderBottom: '1px solid var(--flow-node-border)',
          }}
        >
          节点属性
        </div>
        <div
          style={{
            padding: '32px 16px',
            color: 'var(--flow-node-subtext)',
            fontSize: 12,
            textAlign: 'center',
          }}
        >
          请选择一个节点以编辑属性
        </div>
      </div>
    );
  }

  const updateNode = (patch: Record<string, unknown>) => {
    if (!onPatch) return;
    const merged = { ...patch };
    if (patch.data && typeof patch.data === 'object') {
      merged.data = { ...(selectedNode.data ?? {}), ...(patch.data as Record<string, unknown>) };
    }
    onPatch(selectedNode.id, merged);
  };

  const titleField = material?.fields?.find((f) => f.key === 'title');
  const otherFields = (material?.fields ?? []).filter((f) => f.key !== 'title');

  return (
    <div className="flow-canvas__panel">
      <div
        style={{
          padding: '12px 14px 10px',
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--flow-node-subtext)',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          borderBottom: '1px solid var(--flow-node-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span>节点属性</span>
        <span
          style={{
            fontSize: 11,
            color: 'var(--flow-node-text)',
            background: 'var(--flow-node-bg-hover)',
            border: '1px solid var(--flow-node-border)',
            padding: '1px 8px',
            borderRadius: 4,
            fontWeight: 500,
            textTransform: 'none',
          }}
        >
          {material?.name ?? selectedNode.type}
        </span>
      </div>

      <div
        style={{
          padding: '12px 14px',
          borderBottom: '1px solid var(--flow-node-border)',
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--flow-node-subtext)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            marginBottom: 10,
          }}
        >
          基本信息
        </div>
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 12, color: 'var(--flow-node-subtext)', marginBottom: 4 }}>
            节点 ID
          </div>
          <input
            className="v-input"
            value={selectedNode.id}
            readOnly
            style={{ width: '100%', fontFamily: 'var(--font-mono)', fontSize: 12 }}
          />
        </div>
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 12, color: 'var(--flow-node-subtext)', marginBottom: 4 }}>
            名称
          </div>
          <input
            className="v-input"
            value={selectedNode.name}
            onChange={(e) => updateNode({ name: e.target.value })}
            style={{ width: '100%' }}
            placeholder={titleField?.label ?? '名称'}
          />
        </div>
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 12, color: 'var(--flow-node-subtext)', marginBottom: 4 }}>
            类型
          </div>
          <input
            className="v-input"
            value={material?.name ?? selectedNode.type}
            readOnly
            style={{ width: '100%' }}
          />
        </div>
      </div>

      {otherFields.length > 0 && (
        <div style={{ padding: '12px 14px' }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--flow-node-subtext)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              marginBottom: 10,
            }}
          >
            节点配置
          </div>
          {otherFields.map((field) => {
            const value =
              (selectedNode.data as Record<string, unknown> | undefined)?.[field.key] ?? '';
            const onChangeField = (next: unknown) =>
              updateNode({ data: { [field.key]: next } as Record<string, unknown> });
            return (
              <div key={field.key} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 12, color: 'var(--flow-node-subtext)', marginBottom: 4 }}>
                  {field.label}
                </div>
                {field.type === 'select' ? (
                  <select
                    className="v-input"
                    value={String(value)}
                    onChange={(e) => onChangeField(e.target.value)}
                    style={{ width: '100%', cursor: 'pointer' }}
                  >
                    {field.options?.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                ) : field.type === 'textarea' ? (
                  <textarea
                    className="v-input"
                    value={String(value)}
                    onChange={(e) => onChangeField(e.target.value)}
                    style={{ width: '100%', minHeight: 60, fontFamily: 'var(--font-sans)' }}
                  />
                ) : (
                  <input
                    className="v-input"
                    type={field.type === 'number' ? 'number' : 'text'}
                    value={String(value)}
                    onChange={(e) =>
                      onChangeField(
                        field.type === 'number' ? Number(e.target.value) : e.target.value,
                      )
                    }
                    style={{ width: '100%' }}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 调试用：再次显示"取消选择"按钮便于用户理解上下文 */}
      <div style={{ padding: '12px 14px', borderTop: '1px solid var(--flow-node-border)' }}>
        <button
          className="v-btn"
          onClick={() => onSelect?.(null)}
          style={{ width: '100%' }}
        >
          取消选择
        </button>
      </div>
    </div>
  );
}
