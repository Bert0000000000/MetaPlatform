import React, { useCallback, useEffect, useState } from "react";
import {
  listObjectTypes,
  getObjectType,
  createObjectType,
  updateObjectType,
  deleteObjectType,
  nlModeling,
} from "../api/ontologyApi";
import { ObjectTypeSummary } from "../types/schema";

/* ── 常量 ── */
const FIELD_TYPES = [
  "STRING", "TEXT", "RICH_TEXT", "INTEGER", "LONG", "DOUBLE",
  "BOOLEAN", "DATE", "DATETIME", "ENUM", "REFERENCE", "JSON",
  "EMAIL", "PHONE", "URL", "IMAGE", "FILE", "CURRENCY",
  "PERCENTAGE", "COLOR", "LOCATION", "SIGNATURE",
  "AI_EXTRACT", "AI_GENERATE", "AI_CLASSIFY",
];

const TYPE_LABELS: Record<string, string> = {
  STRING: "文本", TEXT: "长文本", RICH_TEXT: "富文本",
  INTEGER: "整数", LONG: "长整数", DOUBLE: "小数",
  BOOLEAN: "布尔", DATE: "日期", DATETIME: "日期时间",
  ENUM: "枚举", REFERENCE: "引用", JSON: "JSON",
  EMAIL: "邮箱", PHONE: "电话", URL: "链接",
  IMAGE: "图片", FILE: "文件", CURRENCY: "货币",
  PERCENTAGE: "百分比", COLOR: "颜色", LOCATION: "位置",
  SIGNATURE: "签名", AI_EXTRACT: "AI提取", AI_GENERATE: "AI生成", AI_CLASSIFY: "AI分类",
};

type Tab = "info" | "fields" | "lifecycle" | "preview";

interface FieldDef {
  name: string;
  displayName: string;
  fieldType: string;
  required: boolean;
  editable: boolean;
  defaultValue?: string;
  description?: string;
}

interface Transition {
  fromState: string;
  toState: string;
  name: string;
  guardExpression?: string;
  description?: string;
}

/* ── 主页面 ── */
const ModelingWorkshop: React.FC = () => {
  const [objectTypes, setObjectTypes] = useState<ObjectTypeSummary[]>([]);
  const [selected, setSelected] = useState<ObjectTypeSummary | null>(null);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("fields");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* NL 建模 */
  const [nlInput, setNlInput] = useState("");
  const [nlLoading, setNlLoading] = useState(false);
  const [nlResult, setNlResult] = useState<Record<string, unknown> | null>(null);

  /* 创建表单 */
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    code: "", displayName: "", description: "",
    entityTypeId: "",
  });

  /* 字段编辑 */
  const [fields, setFields] = useState<FieldDef[]>([]);
  const [editingField, setEditingField] = useState<FieldDef | null>(null);

  /* 生命周期 */
  const [states, setStates] = useState<string[]>([]);
  const [transitions, setTransitions] = useState<Transition[]>([]);
  const [newState, setNewState] = useState("");
  const [newTransition, setNewTransition] = useState<Transition>({
    fromState: "", toState: "", name: "",
  });

  /* ── 加载 ── */
  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listObjectTypes();
      setObjectTypes(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  /* ── 选中 ObjectType ── */
  const handleSelect = async (ot: ObjectTypeSummary) => {
    setSelected(ot);
    setError(null);
    try {
      const d = await getObjectType(ot.id);
      setDetail(d as unknown as Record<string, unknown>);
      const fd = (d as unknown as Record<string, unknown>).fieldDefinitions as FieldDef[] | undefined;
      setFields(fd ?? []);
      const ls = (d as unknown as Record<string, unknown>).lifecycleStates as string[] | undefined;
      setStates(ls ?? []);
      const lt = (d as unknown as Record<string, unknown>).lifecycleTransitions as Transition[] | undefined;
      setTransitions(lt ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "加载详情失败");
    }
  };

  /* ── 保存 ObjectType ── */
  const handleSave = async () => {
    if (!selected || !detail) return;
    try {
      await updateObjectType(selected.id, {
        code: detail.code,
        displayName: detail.displayName,
        description: detail.description ?? "",
        entityTypeId: detail.entityTypeId ?? "",
        fieldDefinitions: fields,
        lifecycleStates: states,
        lifecycleTransitions: transitions,
        initialState: states[0] ?? "draft",
      });
      await reload();
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "保存失败");
    }
  };

  /* ── 创建 ObjectType ── */
  const handleCreate = async () => {
    if (!createForm.code || !createForm.displayName) {
      setError("编码和显示名称必填");
      return;
    }
    try {
      await createObjectType({
        ...createForm,
        fieldDefinitions: fields,
        lifecycleStates: states.length > 0 ? states : ["draft", "active", "archived"],
        lifecycleTransitions: transitions,
        initialState: states[0] ?? "draft",
      });
      setShowCreate(false);
      setCreateForm({ code: "", displayName: "", description: "", entityTypeId: "" });
      setFields([]);
      setStates([]);
      setTransitions([]);
      await reload();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "创建失败");
    }
  };

  /* ── 删除 ObjectType ── */
  const handleDelete = async (id: string) => {
    if (!window.confirm("确定删除此 ObjectType？")) return;
    try {
      await deleteObjectType(id);
      if (selected?.id === id) { setSelected(null); setDetail(null); }
      await reload();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "删除失败");
    }
  };

  /* ── NL 建模 ── */
  const handleNlModeling = async () => {
    if (!nlInput.trim()) return;
    setNlLoading(true);
    setError(null);
    try {
      const result = await nlModeling(nlInput);
      setNlResult(result);
      // 自动填充创建表单
      setCreateForm({
        code: (result.code as string) ?? "",
        displayName: (result.displayName as string) ?? "",
        description: (result.description as string) ?? "",
        entityTypeId: "",
      });
      const fd = result.fieldDefinitions as FieldDef[] | undefined;
      if (fd) setFields(fd);
      const ls = result.lifecycleStates as string[] | undefined;
      if (ls) setStates(ls);
      const lt = result.lifecycleTransitions as Transition[] | undefined;
      if (lt) setTransitions(lt);
      setShowCreate(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "NL 建模失败");
    } finally {
      setNlLoading(false);
    }
  };

  /* ── 字段操作 ── */
  const addField = () => {
    setEditingField({ name: "", displayName: "", fieldType: "STRING", required: false, editable: true });
  };
  const saveField = () => {
    if (!editingField || !editingField.name || !editingField.displayName) return;
    const idx = fields.findIndex(f => f.name === editingField.name);
    if (idx >= 0) {
      const next = [...fields]; next[idx] = editingField; setFields(next);
    } else {
      setFields([...fields, editingField]);
    }
    setEditingField(null);
  };
  const removeField = (name: string) => setFields(fields.filter(f => f.name !== name));

  /* ── 生命周期操作 ── */
  const addState = () => {
    if (newState && !states.includes(newState)) {
      setStates([...states, newState]); setNewState("");
    }
  };
  const removeState = (s: string) => {
    setStates(states.filter(st => st !== s));
    setTransitions(transitions.filter(t => t.fromState !== s && t.toState !== s));
  };
  const addTransition = () => {
    if (newTransition.fromState && newTransition.toState && newTransition.name) {
      setTransitions([...transitions, newTransition]);
      setNewTransition({ fromState: "", toState: "", name: "" });
    }
  };
  const removeTransition = (idx: number) => setTransitions(transitions.filter((_, i) => i !== idx));

  /* ── 渲染 ── */
  return (
    <div className="mp-workshop">
      <div className="mp-workshop-header">
        <h1>建模特工场</h1>
        <p>Schema 驱动的业务对象可视化管理</p>
        <div className="mp-workshop-actions">
          <button className="mp-btn mp-btn-primary" onClick={() => { setShowCreate(true); setFields([]); setStates(["draft","active","archived"]); setTransitions([{fromState:"draft",toState:"active",name:"激活"},{fromState:"active",toState:"archived",name:"归档"}]); setNlResult(null); }}>
            + 新建 ObjectType
          </button>
        </div>
      </div>

      {error && <div className="mp-alert mp-alert-error">{error}<button className="mp-alert-close" onClick={() => setError(null)}>×</button></div>}

      <div className="mp-workshop-body">
        {/* 左侧列表 */}
        <aside className="mp-workshop-sidebar">
          <div className="mp-workshop-sidebar-title">ObjectType 列表 ({objectTypes.length})</div>
          {loading ? (
            <p className="mp-loading">加载中...</p>
          ) : objectTypes.length === 0 ? (
            <p className="mp-empty-hint">暂无 ObjectType</p>
          ) : (
            <div className="mp-workshop-list">
              {objectTypes.map(ot => (
                <div
                  key={ot.id}
                  className={`mp-workshop-list-item ${selected?.id === ot.id ? "active" : ""}`}
                  onClick={() => handleSelect(ot)}
                >
                  <div className="mp-workshop-list-item-name">{ot.displayName || ot.code || ot.name}</div>
                  <div className="mp-workshop-list-item-meta">{ot.code || ot.name}</div>
                  <button
                    className="mp-workshop-list-item-delete"
                    onClick={(e) => { e.stopPropagation(); handleDelete(ot.id); }}
                    title="删除"
                  >×</button>
                </div>
              ))}
            </div>
          )}
        </aside>

        {/* 右侧详情 */}
        <main className="mp-workshop-main">
          {/* 创建表单 */}
          {showCreate && (
            <div className="mp-workshop-create">
              <h3>{nlResult ? "AI 建模结果（可编辑后保存）" : "新建 ObjectType"}</h3>
              <div className="mp-workshop-form-grid">
                <label>
                  <span>编码 *</span>
                  <input value={createForm.code} onChange={e => setCreateForm({...createForm, code: e.target.value})} placeholder="e.g. customer" />
                </label>
                <label>
                  <span>显示名称 *</span>
                  <input value={createForm.displayName} onChange={e => setCreateForm({...createForm, displayName: e.target.value})} placeholder="e.g. 客户" />
                </label>
                <label className="mp-span-2">
                  <span>描述</span>
                  <input value={createForm.description} onChange={e => setCreateForm({...createForm, description: e.target.value})} placeholder="对象描述" />
                </label>
              </div>

              {/* 字段编辑区 */}
              <FieldEditor fields={fields} editingField={editingField} setEditingField={setEditingField} addField={addField} saveField={saveField} removeField={removeField} />

              {/* 生命周期区 */}
              <LifecycleEditor states={states} transitions={transitions} newState={newState} setNewState={setNewState} newTransition={newTransition} setNewTransition={setNewTransition} addState={addState} removeState={removeState} addTransition={addTransition} removeTransition={removeTransition} />

              <div className="mp-workshop-form-actions">
                <button className="mp-btn mp-btn-primary" onClick={handleCreate}>创建</button>
                <button className="mp-btn" onClick={() => setShowCreate(false)}>取消</button>
              </div>
            </div>
          )}

          {/* 详情视图 */}
          {!showCreate && selected && detail && (
            <>
              <div className="mp-workshop-tabs">
                {(["fields", "lifecycle", "info", "preview"] as Tab[]).map(tab => (
                  <button key={tab} className={`mp-tab ${activeTab === tab ? "active" : ""}`} onClick={() => setActiveTab(tab)}>
                    {{ fields: "字段管理", lifecycle: "生命周期", info: "基本信息", preview: "预览" }[tab]}
                  </button>
                ))}
                <div className="mp-workshop-tabs-spacer" />
                <button className="mp-btn mp-btn-primary mp-btn-sm" onClick={handleSave}>保存</button>
              </div>

              {activeTab === "info" && (
                <div className="mp-workshop-info">
                  <div className="mp-workshop-form-grid">
                    <label>
                      <span>编码</span>
                      <input value={String(detail.code ?? "")} onChange={e => setDetail({...detail, code: e.target.value})} />
                    </label>
                    <label>
                      <span>显示名称</span>
                      <input value={String(detail.displayName ?? "")} onChange={e => setDetail({...detail, displayName: e.target.value})} />
                    </label>
                    <label className="mp-span-2">
                      <span>描述</span>
                      <textarea value={String(detail.description ?? "")} onChange={e => setDetail({...detail, description: e.target.value})} rows={3} />
                    </label>
                  </div>
                </div>
              )}

              {activeTab === "fields" && (
                <FieldEditor fields={fields} editingField={editingField} setEditingField={setEditingField} addField={addField} saveField={saveField} removeField={removeField} />
              )}

              {activeTab === "lifecycle" && (
                <LifecycleEditor states={states} transitions={transitions} newState={newState} setNewState={setNewState} newTransition={newTransition} setNewTransition={setNewTransition} addState={addState} removeState={removeState} addTransition={addTransition} removeTransition={removeTransition} />
              )}

              {activeTab === "preview" && (
                <div className="mp-workshop-preview">
                  <h3>字段预览</h3>
                  <table className="mp-table">
                    <thead>
                      <tr>
                        <th>字段名</th><th>显示名</th><th>类型</th><th>必填</th><th>可编辑</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fields.map(f => (
                        <tr key={f.name}>
                          <td><code>{f.name}</code></td>
                          <td>{f.displayName}</td>
                          <td><span className="mp-badge">{TYPE_LABELS[f.fieldType] ?? f.fieldType}</span></td>
                          <td>{f.required ? "✓" : ""}</td>
                          <td>{f.editable ? "✓" : ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <h3 style={{ marginTop: 24 }}>生命周期</h3>
                  <div className="mp-lifecycle-preview">
                    <div className="mp-lifecycle-states">
                      {states.map(s => (
                        <span key={s} className="mp-lifecycle-state">{s}</span>
                      ))}
                    </div>
                    <div className="mp-lifecycle-transitions">
                      {transitions.map((t, i) => (
                        <div key={i} className="mp-lifecycle-transition">
                          <span className="mp-lifecycle-from">{t.fromState}</span>
                          <span className="mp-lifecycle-arrow">→</span>
                          <span className="mp-lifecycle-to">{t.toState}</span>
                          <span className="mp-lifecycle-name">({t.name})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {!showCreate && !selected && (
            <div className="mp-workshop-empty">
              <div className="mp-workshop-empty-icon">🏗️</div>
              <h3>建模特工场</h3>
              <p>选择左侧 ObjectType 查看详情，或点击「新建 ObjectType」开始建模</p>
            </div>
          )}
        </main>
      </div>

      {/* NL 建模输入栏 */}
      <div className="mp-nl-bar">
        <div className="mp-nl-bar-icon">🤖</div>
        <input
          className="mp-nl-bar-input"
          placeholder="用自然语言描述你的业务对象，AI 自动生成 ObjectType... 例如：我需要一个客户管理对象，包含姓名、邮箱、电话、公司名称"
          value={nlInput}
          onChange={e => setNlInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleNlModeling()}
          disabled={nlLoading}
        />
        <button className="mp-btn mp-btn-primary" onClick={handleNlModeling} disabled={nlLoading || !nlInput.trim()}>
          {nlLoading ? "生成中..." : "AI 建模"}
        </button>
      </div>
    </div>
  );
};

/* ── 字段编辑器组件 ── */
const FieldEditor: React.FC<{
  fields: FieldDef[];
  editingField: FieldDef | null;
  setEditingField: (f: FieldDef | null) => void;
  addField: () => void;
  saveField: () => void;
  removeField: (name: string) => void;
}> = ({ fields, editingField, setEditingField, addField, saveField, removeField }) => (
  <div className="mp-field-editor">
    <div className="mp-field-editor-header">
      <h3>字段定义 ({fields.length})</h3>
      <button className="mp-btn mp-btn-sm" onClick={addField}>+ 添加字段</button>
    </div>

    <table className="mp-table mp-table-compact">
      <thead>
        <tr>
          <th>字段名</th><th>显示名</th><th>类型</th><th>必填</th><th>可编辑</th><th style={{width:60}}>操作</th>
        </tr>
      </thead>
      <tbody>
        {fields.map(f => (
          <tr key={f.name}>
            <td><code>{f.name}</code></td>
            <td>{f.displayName}</td>
            <td><span className="mp-badge">{TYPE_LABELS[f.fieldType] ?? f.fieldType}</span></td>
            <td>{f.required ? "✓" : ""}</td>
            <td>{f.editable ? "✓" : ""}</td>
            <td>
              <button className="mp-btn-icon" onClick={() => setEditingField({...f})} title="编辑">✎</button>
              <button className="mp-btn-icon mp-btn-icon-danger" onClick={() => removeField(f.name)} title="删除">✕</button>
            </td>
          </tr>
        ))}
        {fields.length === 0 && (
          <tr><td colSpan={6} className="mp-empty-hint">暂无字段，点击「添加字段」开始</td></tr>
        )}
      </tbody>
    </table>

    {/* 编辑行 */}
    {editingField && (
      <div className="mp-field-edit-row">
        <input placeholder="字段名 (英文)" value={editingField.name} onChange={e => setEditingField({...editingField, name: e.target.value})} />
        <input placeholder="显示名称" value={editingField.displayName} onChange={e => setEditingField({...editingField, displayName: e.target.value})} />
        <select value={editingField.fieldType} onChange={e => setEditingField({...editingField, fieldType: e.target.value})}>
          {FIELD_TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t] ?? t}</option>)}
        </select>
        <label className="mp-checkbox-label">
          <input type="checkbox" checked={editingField.required} onChange={e => setEditingField({...editingField, required: e.target.checked})} /> 必填
        </label>
        <label className="mp-checkbox-label">
          <input type="checkbox" checked={editingField.editable} onChange={e => setEditingField({...editingField, editable: e.target.checked})} /> 可编辑
        </label>
        <button className="mp-btn mp-btn-primary mp-btn-sm" onClick={saveField}>确定</button>
        <button className="mp-btn mp-btn-sm" onClick={() => setEditingField(null)}>取消</button>
      </div>
    )}
  </div>
);

/* ── 生命周期编辑器组件 ── */
const LifecycleEditor: React.FC<{
  states: string[];
  transitions: Transition[];
  newState: string;
  setNewState: (s: string) => void;
  newTransition: Transition;
  setNewTransition: (t: Transition) => void;
  addState: () => void;
  removeState: (s: string) => void;
  addTransition: () => void;
  removeTransition: (idx: number) => void;
}> = ({ states, transitions, newState, setNewState, newTransition, setNewTransition, addState, removeState, addTransition, removeTransition }) => (
  <div className="mp-lifecycle-editor">
    {/* 状态列表 */}
    <div className="mp-lifecycle-section">
      <h3>状态 ({states.length})</h3>
      <div className="mp-lifecycle-state-list">
        {states.map(s => (
          <span key={s} className="mp-lifecycle-state-chip">
            {s}
            <button onClick={() => removeState(s)} title="删除">×</button>
          </span>
        ))}
        <div className="mp-lifecycle-add-state">
          <input placeholder="新状态名" value={newState} onChange={e => setNewState(e.target.value)} onKeyDown={e => e.key === "Enter" && addState()} />
          <button className="mp-btn mp-btn-sm" onClick={addState}>添加</button>
        </div>
      </div>
    </div>

    {/* 状态流转图 */}
    <div className="mp-lifecycle-section">
      <h3>状态流转</h3>
      <div className="mp-lifecycle-diagram">
        {states.map((s, i) => (
          <React.Fragment key={s}>
            <div className="mp-lifecycle-node">{s}</div>
            {i < states.length - 1 && <div className="mp-lifecycle-arrow-h">→</div>}
          </React.Fragment>
        ))}
      </div>
    </div>

    {/* 流转列表 */}
    <div className="mp-lifecycle-section">
      <h3>流转规则 ({transitions.length})</h3>
      <table className="mp-table mp-table-compact">
        <thead>
          <tr><th>起始状态</th><th>目标状态</th><th>名称</th><th>守卫条件</th><th style={{width:50}}>操作</th></tr>
        </thead>
        <tbody>
          {transitions.map((t, i) => (
            <tr key={i}>
              <td><span className="mp-lifecycle-state-chip small">{t.fromState}</span></td>
              <td><span className="mp-lifecycle-state-chip small">{t.toState}</span></td>
              <td>{t.name}</td>
              <td><code>{t.guardExpression || "--"}</code></td>
              <td><button className="mp-btn-icon mp-btn-icon-danger" onClick={() => removeTransition(i)}>✕</button></td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* 添加流转 */}
      <div className="mp-lifecycle-add-transition">
        <select value={newTransition.fromState} onChange={e => setNewTransition({...newTransition, fromState: e.target.value})}>
          <option value="">起始状态</option>
          {states.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <span>→</span>
        <select value={newTransition.toState} onChange={e => setNewTransition({...newTransition, toState: e.target.value})}>
          <option value="">目标状态</option>
          {states.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <input placeholder="流转名称" value={newTransition.name} onChange={e => setNewTransition({...newTransition, name: e.target.value})} />
        <input placeholder="守卫条件 (可选)" value={newTransition.guardExpression ?? ""} onChange={e => setNewTransition({...newTransition, guardExpression: e.target.value})} />
        <button className="mp-btn mp-btn-sm" onClick={addTransition}>添加</button>
      </div>
    </div>
  </div>
);

export default ModelingWorkshop;
