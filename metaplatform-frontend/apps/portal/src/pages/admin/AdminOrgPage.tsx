/**
 * 组织管理页
 * 数据源：TECH-IAM /api/v1/iam/departments
 */
import { useEffect, useState, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Plus, Search, RefreshCw, ChevronRight, Building2, Users,
  Pencil, Trash2, Network,
} from 'lucide-react';
import {
  SubTabs, FormDrawer, FormSection, Field, TextInput, TextArea, Select,
  PageLoading, EmptyState, type SubTabItem,
  Api,
} from '@mate/shared';
import type { DepartmentResponse, UserResponse } from '@mate/shared/api';

const ADMIN_TABS: SubTabItem[] = [
  { label: '用户管理', path: '/admin' },
  { label: '权限管理', path: '/admin/permissions' },
  { label: '组织管理', path: '/admin/org' },
  { label: '日志管理', path: '/admin/logs' },
  { label: '系统配置', path: '/admin/config' },
  { label: '组件库', path: '/admin/components' },
  { label: '运营数据', path: '/admin/operations' },
];

interface TreeNode { node: DepartmentResponse; children: TreeNode[]; }

function buildTree(depts: DepartmentResponse[]): TreeNode[] {
  const byId = new Map<string, TreeNode>();
  depts.forEach((d) => byId.set(d.deptId, { node: d, children: [] }));
  const roots: TreeNode[] = [];
  byId.forEach((n) => {
    const pid = n.node.parentId;
    if (pid && byId.has(pid)) byId.get(pid)!.children.push(n);
    else roots.push(n);
  });
  const sortRec = (ns: TreeNode[]) => {
    ns.sort((a, b) => (a.node.sortOrder ?? 0) - (b.node.sortOrder ?? 0));
    ns.forEach((n) => sortRec(n.children));
  };
  sortRec(roots);
  return roots;
}

function TreeRow({ node, depth, selectedId, onSelect, expanded, onToggle }: {
  node: TreeNode; depth: number; selectedId: string | null; onSelect: (d: DepartmentResponse) => void; expanded: Set<string>; onToggle: (id: string) => void;
}) {
  const isOpen = expanded.has(node.node.deptId);
  const isSel = node.node.deptId === selectedId;
  const hasChild = node.children.length > 0;
  return (
    <>
      <div
        onClick={() => onSelect(node.node)}
        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', paddingLeft: 8 + depth * 16, cursor: 'pointer', borderRadius: 4, fontSize: 13, background: isSel ? 'var(--accent)' : 'transparent', color: isSel ? 'var(--accent-foreground)' : 'var(--foreground)' }}
      >
        <span onClick={(e) => { e.stopPropagation(); onToggle(node.node.deptId); }} style={{ width: 16, height: 16, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground)' }}>
          {hasChild ? (isOpen ? <ChevronRight size={12} style={{ transform: 'rotate(90deg)' }} /> : <ChevronRight size={12} />) : null}
        </span>
        <Building2 size={14} />
        <span style={{ flex: 1, fontWeight: isSel ? 500 : 400 }}>{node.node.deptName}</span>
        {node.node.memberCount != null && <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{node.node.memberCount}</span>}
      </div>
      {isOpen && node.children.map((c) => (
        <TreeRow key={c.node.deptId} node={c} depth={depth + 1} selectedId={selectedId} onSelect={onSelect} expanded={expanded} onToggle={onToggle} />
      ))}
    </>
  );
}

export default function AdminOrgPage() {
  const location = useLocation();
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [selected, setSelected] = useState<DepartmentResponse | null>(null);
  const [members, setMembers] = useState<UserResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [membersLoading, setMembersLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [keyword, setKeyword] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<DepartmentResponse | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ deptCode: '', deptName: '', parentId: '', description: '' });

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await Api.getDepartmentTree();
      const t = buildTree(resp);
      setTree(t);
      setExpanded((s) => {
        const next = new Set(s);
        t.forEach((n) => next.add(n.node.deptId));
        return next;
      });
      if (!selected && t.length > 0) setSelected(t[0].node);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  };

  const loadMembers = async (deptId: string) => {
    setMembersLoading(true);
    try {
      const r = await Api.listUsers({ departmentId: deptId, page: 1, size: 50 });
      setMembers(r.items);
    } catch {
      setMembers([]);
    } finally {
      setMembersLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);
  useEffect(() => { if (selected) loadMembers(selected.deptId); /* eslint-disable-next-line */ }, [selected?.deptId]);

  const filteredTree = useMemo(() => {
    if (!keyword) return tree;
    const k = keyword.toLowerCase();
    const filter = (nodes: TreeNode[]): TreeNode[] =>
      nodes.flatMap((n) => {
        const selfMatch = n.node.deptName.toLowerCase().includes(k) || n.node.deptCode.toLowerCase().includes(k);
        const kids = filter(n.children);
        if (selfMatch || kids.length) return [{ ...n, children: kids }];
        return [];
      });
    return filter(tree);
  }, [tree, keyword]);

  const submit = async () => {
    setSaving(true);
    try {
      if (editing) {
        await Api.updateDepartment(editing.deptId, { deptName: form.deptName, description: form.description, parentId: form.parentId || undefined });
      } else {
        await Api.createDepartment({ deptCode: form.deptCode, deptName: form.deptName, parentId: form.parentId || undefined, description: form.description });
      }
      setCreateOpen(false); setEditing(null);
      setForm({ deptCode: '', deptName: '', parentId: '', description: '' });
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (d: DepartmentResponse) => {
    if (!window.confirm('确定删除部门「' + d.deptName + '」？')) return;
    try {
      await Api.deleteDepartment(d.deptId);
      if (selected?.deptId === d.deptId) setSelected(null);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '删除失败');
    }
  };

  const flatten = (ns: TreeNode[]): DepartmentResponse[] => ns.flatMap((n) => [n.node, ...flatten(n.children)]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <SubTabs items={ADMIN_TABS} activePath={location.pathname} />
      <div style={{ padding: '24px 0', flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ marginBottom: 16 }}>
          <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 4 }}>组织管理</h1>
          <p style={{ fontSize: 14, color: 'var(--muted-foreground)' }}>维护部门层级与成员归属（数据源：TECH-IAM）</p>
        </div>
        {error && (
          <div style={{ marginBottom: 12, padding: '8px 12px', background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 6, fontSize: 13, color: 'var(--destructive)' }}>
            {error} <button onClick={() => setError(null)} style={{ float: 'right', background: 'none', border: 'none', color: 'var(--destructive)', cursor: 'pointer' }}>×</button>
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 16, flex: 1, minHeight: 0 }}>
          <div className="v-card" style={{ padding: 12, overflow: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <input className="v-input" style={{ width: '100%', paddingLeft: 30, height: 32 }} placeholder="搜索部门..." value={keyword} onChange={(e) => setKeyword(e.target.value)} />
                <Search style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: 'var(--muted-foreground)' }} />
              </div>
              <button className="v-btn" onClick={load} title="刷新"><RefreshCw style={{ width: 14, height: 14 }} /></button>
              <button className="v-btn-primary" onClick={() => { setEditing(null); setForm({ deptCode: '', deptName: '', parentId: '', description: '' }); setCreateOpen(true); }}><Plus style={{ width: 14, height: 14 }} /></button>
            </div>
            {loading ? <PageLoading /> : filteredTree.length === 0 ? <EmptyState description="暂无部门" /> : (
              <div>
                {filteredTree.map((n) => (
                  <TreeRow key={n.node.deptId} node={n} depth={0} selectedId={selected?.deptId ?? null} onSelect={setSelected} expanded={expanded} onToggle={(id) => setExpanded((s) => { const ns = new Set(s); if (ns.has(id)) ns.delete(id); else ns.add(id); return ns; })} />
                ))}
              </div>
            )}
          </div>
          <div style={{ overflow: 'auto' }}>
            {!selected ? <EmptyState description="请在左侧选择部门" /> : (
              <>
                <div className="v-card" style={{ padding: 20, marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                    <div style={{ width: 56, height: 56, borderRadius: 8, background: 'var(--accent)', color: 'var(--accent-foreground)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Network style={{ width: 24, height: 24 }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>{selected.deptName}</h2>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, fontSize: 13, color: 'var(--muted-foreground)' }}>
                        <span>编码：<span style={{ fontFamily: 'var(--font-mono)' }}>{selected.deptCode}</span></span>
                        <span>层级：L{selected.level}</span>
                        <span>路径：{selected.fullPath}</span>
                        <span>成员：{selected.memberCount ?? members.length}</span>
                        <span>子部门：{selected.childCount ?? 0}</span>
                      </div>
                      {selected.description && <p style={{ marginTop: 8, fontSize: 13, color: 'var(--muted-foreground)' }}>{selected.description}</p>}
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="v-btn" onClick={() => { setEditing(selected); setForm({ deptCode: selected.deptCode, deptName: selected.deptName, parentId: selected.parentId ?? '', description: selected.description ?? '' }); setCreateOpen(true); }}><Pencil style={{ width: 14, height: 14 }} />编辑</button>
                      <button className="v-btn" onClick={() => handleDelete(selected)} style={{ color: 'var(--destructive)' }}><Trash2 style={{ width: 14, height: 14 }} />删除</button>
                    </div>
                  </div>
                </div>
                <div className="v-card" style={{ overflow: 'hidden' }}>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Users style={{ width: 16, height: 16 }} />部门成员
                    <span style={{ fontSize: 12, color: 'var(--muted-foreground)', fontWeight: 400 }}>({members.length})</span>
                  </div>
                  {membersLoading ? <PageLoading /> : members.length === 0 ? <EmptyState description="该部门暂无成员" /> : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          {['姓名', '用户名', '邮箱', '状态', '创建时间'].map((h) => (
                            <th key={h} style={{ textAlign: 'left', padding: '10px 16px', fontSize: 11, fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {members.map((u) => (
                          <tr key={u.id}>
                            <td style={{ padding: '10px 16px', fontSize: 13, borderBottom: '1px solid var(--border)' }}>{u.realName || u.username}</td>
                            <td style={{ padding: '10px 16px', fontSize: 13, borderBottom: '1px solid var(--border)', fontFamily: 'var(--font-mono)', color: 'var(--muted-foreground)' }}>@{u.username}</td>
                            <td style={{ padding: '10px 16px', fontSize: 13, borderBottom: '1px solid var(--border)', color: 'var(--muted-foreground)' }}>{u.email}</td>
                            <td style={{ padding: '10px 16px', fontSize: 13, borderBottom: '1px solid var(--border)' }}><span className={u.status === 'ENABLED' ? 'v-badge v-badge-success' : 'v-badge v-badge-warning'}>{u.status === 'ENABLED' ? '活跃' : u.status}</span></td>
                            <td style={{ padding: '10px 16px', fontSize: 13, borderBottom: '1px solid var(--border)', color: 'var(--muted-foreground)' }}>{(u.createdAt ?? '').slice(0, 16).replace('T', ' ')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      <FormDrawer
        open={createOpen}
        title={editing ? '编辑部门' : '新建部门'}
        onCancel={() => { setCreateOpen(false); setEditing(null); }}
        onOk={submit}
        confirmLoading={saving}
        okText="保存"
      >
        <FormSection title="基本信息">
          <Field label="部门编码" required={!editing}>
            <TextInput value={form.deptCode} onChange={(e) => setForm({ ...form, deptCode: e.target.value })} disabled={!!editing} placeholder="如：TECH-DEV" />
          </Field>
          <Field label="部门名称" required>
            <TextInput value={form.deptName} onChange={(e) => setForm({ ...form, deptName: e.target.value })} placeholder="如：技术部" />
          </Field>
          <Field label="上级部门">
            <Select value={form.parentId} onChange={(e) => setForm({ ...form, parentId: e.target.value })}>
              <option value="">(无 - 根部门)</option>
              {flatten(tree).filter((d) => d.deptId !== editing?.deptId).map((d) => (
                <option key={d.deptId} value={d.deptId}>{d.fullPath}</option>
              ))}
            </Select>
          </Field>
          <Field label="描述">
            <TextArea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
          </Field>
        </FormSection>
      </FormDrawer>
    </div>
  );
}