import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/stat";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { adminApi, type User, type Role, type Department, type AuditLog, type SystemConfig } from "@/lib/api";
import { Users, Shield, Server, Cpu, Database, Activity, Plus, MoreHorizontal, BarChart3, AlertTriangle, Building2, Settings2, BookText, FileText, Clock, Edit, Trash2, Search, Filter, KeyRound, Lock, Eye, Monitor, Package, Handshake, Megaphone, Settings, DollarSign, Palette, Wrench, TestTube, Home, Bot, Smartphone, RefreshCw, Dna, CheckCircle2, BookOpen, Cloud, Circle, Radio, Loader2, Download, Upload, HardDrive, GitBranch, Layers, Globe, Puzzle, Calendar } from "lucide-react";
import { PageHeader } from "@/components/ui/stat";

const roleLabels: Record<string, string> = {
  executive: "领导",
  business: "业务",
  developer: "开发",
  architect: "架构师",
  ops: "运维",
};

// 菜单配置
const MENU_CONFIG = [
  { id: 1, name: "工作台", path: "/dashboard", icon: Home, type: "菜单", perms: 1, sort: 1 },
  { id: 2, name: "SuperAI", path: "/superai", icon: Bot, type: "菜单", perms: 1, sort: 2 },
  { id: 3, name: "应用中心", path: "/apps", icon: Smartphone, type: "菜单", perms: 12, sort: 3 },
  { id: 4, name: "流程中心", path: "/process", icon: RefreshCw, type: "菜单", perms: 18, sort: 4 },
  { id: 5, name: "数据中心", path: "/data", icon: BarChart3, type: "菜单", perms: 14, sort: 5 },
  { id: 6, name: "本体引擎", path: "/ontology", icon: Dna, type: "菜单", perms: 8, sort: 6 },
  { id: 7, name: "质量中心", path: "/quality", icon: CheckCircle2, type: "菜单", perms: 6, sort: 7 },
  { id: 8, name: "知识库", path: "/knowledge", icon: BookOpen, type: "菜单", perms: 5, sort: 8 },
  { id: 9, name: "架构中心", path: "/architecture", icon: Building2, type: "菜单", perms: 4, sort: 9 },
  { id: 10, name: "云市场", path: "/market", icon: Cloud, type: "菜单", perms: 3, sort: 10 },
  { id: 11, name: "数字员工", path: "/agents", icon: Users, type: "菜单", perms: 7, sort: 11 },
  { id: 12, name: "设置", path: "/admin", icon: Settings, type: "菜单", perms: 16, sort: 12 },
];

// 数据字典
const DICTIONARIES = [
  { code: "industry_type", name: "行业类型", items: 24, category: "业务字典" },
  { code: "order_status", name: "订单状态", items: 8, category: "业务字典" },
  { code: "priority", name: "优先级", items: 4, category: "系统字典" },
  { code: "user_status", name: "用户状态", items: 3, category: "系统字典" },
  { code: "approval_type", name: "审批类型", items: 12, category: "业务字典" },
  { code: "currency", name: "币种", items: 18, category: "基础字典" },
  { code: "country", name: "国家/地区", items: 240, category: "基础字典" },
];

// ─── 部门图标映射 ──────────────────────────────────────────
const deptIconMap: Record<string, typeof Monitor> = {
  "技术中心": Monitor, "产品中心": Package, "销售中心": Handshake,
  "市场中心": Megaphone, "运营中心": Settings, "财务中心": DollarSign,
  "人力资源中心": Users, "前端开发组": Palette, "后端开发组": Wrench,
  "测试组": TestTube,
};

// ─── 用户表单对话框 ────────────────────────────────────────
function UserFormDialog({
  open,
  onOpenChange,
  user,
  roles,
  departments,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: User | null;
  roles: Role[];
  departments: Department[];
  onSubmit: (data: Partial<User>) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [department, setDepartment] = useState("");
  const [status, setStatus] = useState("active");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      if (user) {
        setName(user.name);
        setEmail(user.email);
        setRole(user.role);
        setDepartment(user.department || "");
        setStatus(user.status);
      } else {
        setName("");
        setEmail("");
        setRole("");
        setDepartment("");
        setStatus("active");
      }
    }
  }, [open, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit({ name, email, role, department, status });
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  const isEdit = !!user;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "编辑用户" : "新建用户"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "修改用户基本信息" : "创建一个新的系统用户"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="user-name">姓名</Label>
            <Input id="user-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="请输入姓名" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="user-email">邮箱</Label>
            <Input id="user-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="请输入邮箱" required />
          </div>
          <div className="space-y-2">
            <Label>角色</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger>
                <SelectValue placeholder="选择角色" />
              </SelectTrigger>
              <SelectContent>
                {roles.map((r) => (
                  <SelectItem key={r.code} value={r.code}>{r.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>部门</Label>
            <Select value={department} onValueChange={setDepartment}>
              <SelectTrigger>
                <SelectValue placeholder="选择部门" />
              </SelectTrigger>
              <SelectContent>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>状态</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue placeholder="选择状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">活跃</SelectItem>
                <SelectItem value="inactive">禁用</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="size-3 mr-1 animate-spin" />}
              {isEdit ? "保存" : "创建"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── 确认删除对话框 ────────────────────────────────────────
function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button variant="destructive" onClick={() => { onConfirm(); onOpenChange(false); }}>确认删除</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── UserList ──────────────────────────────────────────────
export function UserList() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminApi.listUsers();
      setUsers(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "加载用户失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // 预加载角色和部门列表供表单使用
  useEffect(() => {
    adminApi.listRoles().then(setRoles).catch(() => {});
    adminApi.listDepartments().then(setDepartments).catch(() => {});
  }, []);

  const handleCreate = async (data: Partial<User>) => {
    await adminApi.createUser(data);
    await fetchUsers();
  };

  const handleUpdate = async (data: Partial<User>) => {
    if (!editUser) return;
    await adminApi.updateUser(editUser.id, data);
    await fetchUsers();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await adminApi.deleteUser(deleteTarget.id);
    setDeleteTarget(null);
    await fetchUsers();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="size-4" /> 用户列表
          </CardTitle>
          <CardDescription>系统所有用户（{users.length} 个）</CardDescription>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Filter className="size-3 mr-1" />
            筛选
          </Button>
          <Button size="sm" onClick={() => { setEditUser(null); setDialogOpen(true); }}>
            <Plus className="size-3 mr-1" />
            新建用户
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">加载中...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2">
            <AlertTriangle className="size-6 text-destructive" />
            <span className="text-sm text-destructive">{error}</span>
            <Button variant="outline" size="sm" onClick={fetchUsers}>重试</Button>
          </div>
        ) : users.length === 0 ? (
          <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
            暂无用户数据
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>姓名</TableHead>
                <TableHead>邮箱</TableHead>
                <TableHead>角色</TableHead>
                <TableHead>部门</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>最后登录</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.name}</TableCell>
                  <TableCell className="font-mono text-xs">{u.email}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{roleLabels[u.role] || u.role}</Badge>
                  </TableCell>
                  <TableCell>{u.department}</TableCell>
                  <TableCell>
                    <Badge variant={u.status === "active" ? "default" : "secondary"}>
                      {u.status === "active" ? "活跃" : "禁用"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">{u.last_login || "—"}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" className="size-8" onClick={() => { setEditUser(u); setDialogOpen(true); }}>
                      <Edit className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="size-8" onClick={() => setDeleteTarget(u)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <UserFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        user={editUser}
        roles={roles}
        departments={departments}
        onSubmit={editUser ? handleUpdate : handleCreate}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title="确认删除用户"
        description={`确定要删除用户「${deleteTarget?.name}」吗？此操作不可撤销。`}
        onConfirm={handleDelete}
      />
    </Card>
  );
}

// ─── RoleList ──────────────────────────────────────────────
export function RoleList() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await adminApi.listRoles();
        if (!cancelled) setRoles(data);
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : "加载角色失败");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="size-4" /> 角色管理
          </CardTitle>
          <CardDescription>RBAC 角色（{roles.length} 个）</CardDescription>
        </div>
        <Button size="sm">
          <Plus className="size-3 mr-1" />
          新建角色
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">加载中...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2">
            <AlertTriangle className="size-6 text-destructive" />
            <span className="text-sm text-destructive">{error}</span>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>角色名</TableHead>
                <TableHead>角色代码</TableHead>
                <TableHead>用户数</TableHead>
                <TableHead>权限数</TableHead>
                <TableHead>描述</TableHead>
                <TableHead>类型</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {roles.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell className="font-mono text-xs">{r.code}</TableCell>
                  <TableCell>{r.userCount}</TableCell>
                  <TableCell>{r.permissionCount}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.desc}</TableCell>
                  <TableCell>
                    <Badge variant={r.builtin ? "secondary" : "outline"}>
                      {r.builtin ? "内置" : "自定义"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" className="size-8">
                      <Edit className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// ─── DepartmentList ────────────────────────────────────────
export function DepartmentList() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newDeptName, setNewDeptName] = useState("");
  const [newDeptLeader, setNewDeptLeader] = useState("");

  // Edit state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editDept, setEditDept] = useState<Department | null>(null);
  const [editName, setEditName] = useState("");
  const [editLeader, setEditLeader] = useState("");

  // Delete state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Department | null>(null);

  const fetchDepartments = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminApi.listDepartments();
      setDepartments(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "加载部门失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDepartments(); }, []);

  const handleEdit = (dept: Department) => {
    setEditDept(dept);
    setEditName(dept.name || "");
    setEditLeader(dept.leader || "");
    setEditDialogOpen(true);
  };

  const handleEditSubmit = async () => {
    if (!editDept || !editName.trim()) return;
    try {
      await adminApi.updateDepartment(editDept.id, { name: editName.trim(), leader: editLeader.trim() });
      await fetchDepartments();
    } catch (e) {
      console.error("更新部门失败:", e);
    }
    setEditDialogOpen(false);
    setEditDept(null);
  };

  const handleDelete = (dept: Department) => {
    setDeleteTarget(dept);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await adminApi.deleteDepartment(deleteTarget.id);
      setDepartments((prev) => prev.filter((d) => d.id !== deleteTarget.id));
    } catch (e) {
      console.error("删除部门失败:", e);
    }
    setDeleteDialogOpen(false);
    setDeleteTarget(null);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="size-4" /> 部门管理
          </CardTitle>
          <CardDescription>组织架构（{departments.length} 个）</CardDescription>
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="size-3 mr-1" />
          新建部门
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">加载中...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2">
            <AlertTriangle className="size-6 text-destructive" />
            <span className="text-sm text-destructive">{error}</span>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>部门名</TableHead>
                <TableHead>上级部门</TableHead>
                <TableHead>人数</TableHead>
                <TableHead>负责人</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {departments.map((d) => {
                const Icon = deptIconMap[d.name] || Building2;
                return (
                  <TableRow key={d.id}>
                    <TableCell>
                      <span className="mr-2"><Icon className="size-4" /></span>
                      <span className="font-medium">{d.name}</span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{d.parent || "—"}</TableCell>
                    <TableCell>{d.count}</TableCell>
                    <TableCell>{d.leader}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="size-8" onClick={() => handleEdit(d)}>
                        <Edit className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="size-8" onClick={() => handleDelete(d)}>
                        <Trash2 className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {/* 新建部门对话框 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建部门</DialogTitle>
            <DialogDescription>创建一个新的组织部门</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="dept-name">部门名称</Label>
              <Input id="dept-name" value={newDeptName} onChange={(e) => setNewDeptName(e.target.value)} placeholder="请输入部门名称" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dept-leader">负责人</Label>
              <Input id="dept-leader" value={newDeptLeader} onChange={(e) => setNewDeptLeader(e.target.value)} placeholder="请输入负责人姓名" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
            <Button onClick={async () => {
              if (!newDeptName.trim()) return;
              try {
                const newDept = await adminApi.createDepartment({ name: newDeptName.trim(), leader: newDeptLeader.trim() });
                setDepartments((prev) => [...prev, newDept]);
              } catch (e) {
                console.error("创建部门失败:", e);
              }
              setDialogOpen(false);
              setNewDeptName("");
              setNewDeptLeader("");
            }}>创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 编辑部门对话框 */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑部门</DialogTitle>
            <DialogDescription>修改部门信息</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-dept-name">部门名称</Label>
              <Input id="edit-dept-name" value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="请输入部门名称" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-dept-leader">负责人</Label>
              <Input id="edit-dept-leader" value={editLeader} onChange={(e) => setEditLeader(e.target.value)} placeholder="请输入负责人姓名" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>取消</Button>
            <Button onClick={handleEditSubmit}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除部门确认对话框 */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>确定要删除部门「{deleteTarget?.name}」吗？此操作不可撤销。</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>取消</Button>
            <Button variant="destructive" onClick={handleDeleteConfirm}>删除</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ─── MenuConfig ────────────────────────────────────────────
export function MenuConfig() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newMenuName, setNewMenuName] = useState("");
  const [newMenuPath, setNewMenuPath] = useState("");

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <Settings2 className="size-4" /> 菜单配置
          </CardTitle>
          <CardDescription>平台菜单与权限点</CardDescription>
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="size-3 mr-1" />
          新建菜单
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>菜单名</TableHead>
              <TableHead>路径</TableHead>
              <TableHead>图标</TableHead>
              <TableHead>权限点</TableHead>
              <TableHead className="text-right">排序</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {MENU_CONFIG.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="font-medium">{m.name}</TableCell>
                <TableCell className="font-mono text-xs">{m.path}</TableCell>
                <TableCell><m.icon className="size-4" /></TableCell>
                <TableCell>{m.perms}</TableCell>
                <TableCell className="text-right">{m.sort}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" className="size-8">
                    <Edit className="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      {/* 新建菜单对话框 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建菜单</DialogTitle>
            <DialogDescription>添加一个新的平台菜单项</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="menu-name">菜单名称</Label>
              <Input id="menu-name" value={newMenuName} onChange={(e) => setNewMenuName(e.target.value)} placeholder="请输入菜单名称" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="menu-path">路由路径</Label>
              <Input id="menu-path" value={newMenuPath} onChange={(e) => setNewMenuPath(e.target.value)} placeholder="/example" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
            <Button onClick={() => {
              setDialogOpen(false);
              setNewMenuName("");
              setNewMenuPath("");
            }}>创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ─── DictionaryList ────────────────────────────────────────
export function DictionaryList() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newDictName, setNewDictName] = useState("");
  const [newDictCode, setNewDictCode] = useState("");

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <BookText className="size-4" /> 数据字典
          </CardTitle>
          <CardDescription>系统级业务字典（{DICTIONARIES.length} 个）</CardDescription>
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="size-3 mr-1" />
          新建字典
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>字典名</TableHead>
              <TableHead>字典编码</TableHead>
              <TableHead>条目数</TableHead>
              <TableHead>分类</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {DICTIONARIES.map((d) => (
              <TableRow key={d.code}>
                <TableCell className="font-medium">{d.name}</TableCell>
                <TableCell className="font-mono text-xs">{d.code}</TableCell>
                <TableCell>{d.items}</TableCell>
                <TableCell>
                  <Badge variant="outline">{d.category}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" className="size-8">
                    <Eye className="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      {/* 新建字典对话框 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建字典</DialogTitle>
            <DialogDescription>添加一个新的数据字典</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="dict-name">字典名称</Label>
              <Input id="dict-name" value={newDictName} onChange={(e) => setNewDictName(e.target.value)} placeholder="请输入字典名称" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dict-code">字典编码</Label>
              <Input id="dict-code" value={newDictCode} onChange={(e) => setNewDictCode(e.target.value)} placeholder="e.g. order_type" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
            <Button onClick={() => {
              setDialogOpen(false);
              setNewDictName("");
              setNewDictCode("");
            }}>创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ─── OperationLog ──────────────────────────────────────────
const LOG_PAGE_SIZE = 10;

export function OperationLog() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  const fetchLogs = useCallback(async (offset: number) => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminApi.listLogs(LOG_PAGE_SIZE, offset);
      setLogs(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "加载日志失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs(page * LOG_PAGE_SIZE);
  }, [page, fetchLogs]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="size-4" /> 操作日志
          </CardTitle>
          <CardDescription>用户操作审计</CardDescription>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Search className="size-3 mr-1" />
            查询
          </Button>
          <Button variant="outline" size="sm">
            导出
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">加载中...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2">
            <AlertTriangle className="size-6 text-destructive" />
            <span className="text-sm text-destructive">{error}</span>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>时间</TableHead>
                  <TableHead>操作人</TableHead>
                  <TableHead>模块</TableHead>
                  <TableHead>操作</TableHead>
                  <TableHead>结果</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-6">暂无日志数据</TableCell>
                  </TableRow>
                ) : (
                  logs.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="font-mono text-xs">{l.created_at}</TableCell>
                      <TableCell className="font-medium">{l.user_name || "—"}</TableCell>
                      <TableCell>{l.module || "—"}</TableCell>
                      <TableCell className="text-xs">{l.action}</TableCell>
                      <TableCell>
                        <Badge variant={l.result === "成功" || l.result === "success" ? "secondary" : "destructive"} className={l.result === "成功" || l.result === "success" ? "text-green-600" : ""}>
                          {l.result === "success" ? "成功" : l.result === "fail" ? "失败" : l.result}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>

            {/* 分页控制 */}
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <span className="text-xs text-muted-foreground">
                第 {page + 1} 页
              </span>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  上一页
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={logs.length < LOG_PAGE_SIZE}
                  onClick={() => setPage((p) => p + 1)}
                >
                  下一页
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── SystemSettings ────────────────────────────────────────
export function SystemSettings() {
  const [config, setConfig] = useState<SystemConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await adminApi.listConfig();
        if (!cancelled) setConfig(data);
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : "加载配置失败");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // 从 API config 构建 key-value 映射
  const configMap = Object.fromEntries(config.map((c) => [c.key, c]));

  const getConfigValue = (key: string, fallback: string) => {
    return configMap[key]?.value || fallback;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Update each config entry via the API
      await Promise.all(
        config.map((c) => adminApi.updateConfig(c.key, { value: c.value }))
      );
    } catch (e: unknown) {
      console.error("保存配置失败:", e);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">加载配置...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-2">
        <AlertTriangle className="size-6 text-destructive" />
        <span className="text-sm text-destructive">{error}</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="size-3 mr-1 animate-spin" />}
          保存设置
        </Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">平台信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: "平台名称", value: getConfigValue("platform_name", "MetaPlatform 企业版") },
              { label: "版本", value: getConfigValue("version", "v1.3.0") },
              { label: "License", value: getConfigValue("license", "Enterprise") },
              { label: "部署模式", value: getConfigValue("deploy_mode", "Kubernetes 多集群") },
              { label: "运行环境", value: getConfigValue("env", "Production") },
            ].map((s) => (
              <div key={s.label} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{s.label}</span>
                <span className="font-medium">{s.value}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">安全策略</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: "密码强度", value: getConfigValue("password_policy", "高（8 位 + 数字 + 字母）"), icon: KeyRound },
              { label: "登录失败锁定", value: getConfigValue("lockout_policy", "5 次 / 30 分钟"), icon: Lock },
              { label: "会话超时", value: getConfigValue("session_timeout", "60 分钟"), icon: Clock },
              { label: "MFA 双因素", value: getConfigValue("mfa_enabled", "开启"), icon: Shield },
              { label: "数据加密", value: getConfigValue("encryption", "AES-256"), icon: Lock },
            ].map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.label} className="flex items-center gap-2 text-sm">
                  <Icon className="size-4 text-muted-foreground" />
                  <span className="text-muted-foreground flex-1">{s.label}</span>
                  <span className="font-medium">{s.value}</span>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">通知渠道</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              { name: "邮件", status: "已配置", host: "smtp.qiye.qq.com" },
              { name: "短信", status: "已配置", host: "阿里云通信" },
              { name: "钉钉", status: "已配置", host: "Webhook" },
              { name: "飞书", status: "已配置", host: "Webhook" },
              { name: "企业微信", status: "未配置", host: "—" },
            ].map((n) => (
              <div key={n.name} className="flex items-center justify-between p-2 border rounded">
                <div className="flex-1">
                  <div className="font-medium text-sm">{n.name}</div>
                  <div className="text-xs text-muted-foreground">{n.host}</div>
                </div>
                <Badge variant={n.status === "已配置" ? "default" : "outline"}>{n.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">备份策略</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              { name: "数据库每日全量备份", schedule: "每天 02:00", status: "normal" },
              { name: "每小时增量备份", schedule: "每小时", status: "normal" },
              { name: "30 天前备份自动归档", schedule: "每天 03:00", status: "normal" },
              { name: "跨可用区同步", schedule: "实时", status: "normal" },
              { name: "年度备份归档到 S3", schedule: "每年 12/31", status: "warning" },
            ].map((b) => (
              <div key={b.name} className="flex items-center justify-between p-2 border rounded">
                <div className="flex-1">
                  <div className="font-medium text-sm">{b.name}</div>
                  <div className="text-xs text-muted-foreground">{b.schedule}</div>
                </div>
                <Badge variant={b.status === "normal" ? "secondary" : "outline"} className={b.status === "normal" ? "text-green-600" : "text-orange-500"}>
                  {b.status === "normal" ? "正常" : "未运行"}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── AdminDashboard ────────────────────────────────────────
export function AdminDashboard() {
  const [userCount, setUserCount] = useState<number>(0);
  const [roleCount, setRoleCount] = useState<number>(0);
  const [deptCount, setDeptCount] = useState<number>(0);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setStatsLoading(true);
      try {
        const [users, roles, depts] = await Promise.all([
          adminApi.listUsers().catch(() => []),
          adminApi.listRoles().catch(() => []),
          adminApi.listDepartments().catch(() => []),
        ]);
        if (!cancelled) {
          setUserCount(users.length);
          setRoleCount(roles.length);
          setDeptCount(depts.length);
        }
      } finally {
        if (!cancelled) setStatsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
            <Settings2 className="size-5 text-primary" />
            系统设置 / 管理后台
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            用户、角色、权限、菜单、字典、日志与系统配置
          </p>
        </div>
        <Badge variant="secondary">仅管理员可见</Badge>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <StatCard label="用户总数" value={statsLoading ? "..." : userCount} icon={Users} />
        <StatCard label="角色数量" value={statsLoading ? "..." : roleCount} icon={Shield} />
        <StatCard label="部门数量" value={statsLoading ? "..." : deptCount} icon={Building2} />
        <StatCard label="系统配置项" value={statsLoading ? "..." : "已接入"} icon={Settings} />
      </div>

      <Tabs defaultValue="dashboard">
        <TabsList>
          <TabsTrigger value="dashboard">仪表盘</TabsTrigger>
          <TabsTrigger value="users">用户</TabsTrigger>
          <TabsTrigger value="roles">角色</TabsTrigger>
          <TabsTrigger value="departments">部门</TabsTrigger>
          <TabsTrigger value="menus">菜单</TabsTrigger>
          <TabsTrigger value="dictionary">字典</TabsTrigger>
          <TabsTrigger value="logs">日志</TabsTrigger>
          <TabsTrigger value="settings">设置</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="size-4" /> 系统健康
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { name: "API 网关", status: "正常", value: "99.99%" },
                  { name: "数据库", status: "正常", value: "85% 连接" },
                  { name: "LLM Gateway", status: "正常", value: "12 ms" },
                  { name: "搜索引擎", status: "正常", value: "98% 命中率" },
                ].map((s) => (
                  <div key={s.name} className="flex items-center justify-between text-sm">
                    <span>{s.name}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="default">{s.status}</Badge>
                      <span className="text-muted-foreground">{s.value}</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="size-4" /> 待处理告警
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between p-2 border rounded">
                    <span>PG 数据库连接数告警</span>
                    <Badge variant="destructive">高</Badge>
                  </div>
                  <div className="flex items-center justify-between p-2 border rounded">
                    <span>MinIO 磁盘使用 80%</span>
                    <Badge variant="secondary">中</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          <UserList />
        </TabsContent>

        <TabsContent value="users" className="mt-4">
          <UserList />
        </TabsContent>

        <TabsContent value="roles" className="mt-4">
          <RoleList />
        </TabsContent>

        <TabsContent value="departments" className="mt-4">
          <DepartmentList />
        </TabsContent>

        <TabsContent value="menus" className="mt-4">
          <MenuConfig />
        </TabsContent>

        <TabsContent value="dictionary" className="mt-4">
          <DictionaryList />
        </TabsContent>

        <TabsContent value="logs" className="mt-4">
          <OperationLog />
        </TabsContent>

        <TabsContent value="settings" className="mt-4">
          <SystemSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ─────────────────── OrgStructure ─────────────────── */
export function OrgStructure() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader title="组织架构" description="管理公司组织架构、部门层级和人员编制" action={<Button className="gap-2"><Plus className="size-4" /> 新建部门</Button>} />
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <StatCard label="部门总数" value={10} icon={Building2} />
        <StatCard label="员工总数" value={156} icon={Users} />
        <StatCard label="管理层" value={12} icon={Shield} />
        <StatCard label="待入职" value={3} icon={Users} />
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Building2 className="size-4" /> 组织树</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[
              { name: "总裁办", level: 0, count: 5, leader: "张总" },
              { name: "技术中心", level: 1, count: 48, leader: "王强" },
              { name: "前端开发组", level: 2, count: 12, leader: "赵敏" },
              { name: "后端开发组", level: 2, count: 18, leader: "李伟" },
              { name: "测试组", level: 2, count: 8, leader: "陈红" },
              { name: "产品中心", level: 1, count: 24, leader: "刘敏" },
              { name: "销售中心", level: 1, count: 36, leader: "周杰" },
              { name: "财务中心", level: 1, count: 12, leader: "吴芳" },
              { name: "人力资源中心", level: 1, count: 15, leader: "孙丽" },
              { name: "市场中心", level: 1, count: 16, leader: "黄磊" },
            ].map((d) => (
              <div key={d.name} className="flex items-center gap-3 p-2 border rounded hover:bg-muted/30" style={{ paddingLeft: `${d.level * 24 + 8}px` }}>
                {d.level === 0 ? <Building2 className="size-4 text-primary" /> : d.level === 1 ? <Building2 className="size-4" /> : <Users className="size-4 text-muted-foreground" />}
                <span className="font-medium text-sm flex-1">{d.name}</span>
                <span className="text-xs text-muted-foreground">{d.leader}</span>
                <Badge variant="secondary" className="text-xs">{d.count} 人</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ─────────────────── AdminMonitor ─────────────────── */
export function AdminMonitor() {
  const [healthData, setHealthData] = useState<{ name: string; status: string; latency: string }[]>([]);
  const [healthLoading, setHealthLoading] = useState(false);

  async function fetchHealth() {
    setHealthLoading(true);
    try {
      const resp = await fetch('/api/health');
      if (resp.ok) {
        const data = await resp.json();
        setHealthData(data.services || []);
      }
    } catch {
      // fallback mock
      setHealthData([
        { name: "API Gateway", status: "up", latency: "12ms" },
        { name: "PostgreSQL", status: "up", latency: "5ms" },
        { name: "Redis", status: "up", latency: "2ms" },
        { name: "Flowable", status: "up", latency: "18ms" },
        { name: "LLM Gateway", status: "up", latency: "120ms" },
        { name: "Elasticsearch", status: "down", latency: "-" },
        { name: "MinIO", status: "warning", latency: "45ms" },
      ]);
    } finally {
      setHealthLoading(false);
    }
  }

  useEffect(() => { fetchHealth(); }, []);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="统一监控" description="系统运行监控、性能指标和告警管理" action={<Button variant="outline" size="sm" onClick={fetchHealth} disabled={healthLoading}><RefreshCw className={'size-3 mr-1 ' + (healthLoading ? 'animate-spin' : '')} />刷新</Button>} />
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <StatCard label="CPU 使用率" value="42%" icon={Cpu} />
        <StatCard label="内存使用" value="68%" icon={Database} />
        <StatCard label="磁盘使用" value="56%" icon={HardDrive} />
        <StatCard label="API 响应" value="28ms" icon={Activity} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Activity className="size-4" /> 系统健康</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { name: "API 网关", status: "正常", value: "99.99%" },
                { name: "PostgreSQL", status: "正常", value: "85% 连接" },
                { name: "Redis", status: "正常", value: "2.1GB" },
                { name: "LLM Gateway", status: "正常", value: "12ms" },
                { name: "MinIO 存储", status: "警告", value: "80% 使用" },
                { name: "Flowable 引擎", status: "正常", value: "运行中" },
              ].map((s) => (
                <div key={s.name} className="flex items-center justify-between text-sm p-2 border rounded">
                  <span>{s.name}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant={s.status === "正常" ? "default" : "outline"} className={s.status === "警告" ? "text-orange-500" : ""}>{s.status}</Badge>
                    <span className="text-muted-foreground text-xs">{s.value}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="size-4" /> 告警列表</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[
                { title: "MinIO 磁盘使用超过 80%", severity: "中", time: "30 分钟前" },
                { title: "API 响应时间超过 500ms", severity: "低", time: "2 小时前" },
                { title: "Flowable 连接池使用率 90%", severity: "高", time: "昨天" },
              ].map((a, i) => (
                <div key={i} className="flex items-center justify-between p-2 border rounded">
                  <div>
                    <div className="text-sm font-medium">{a.title}</div>
                    <div className="text-xs text-muted-foreground">{a.time}</div>
                  </div>
                  <Badge variant={a.severity === "高" ? "destructive" : a.severity === "中" ? "outline" : "secondary"} className={a.severity === "中" ? "text-orange-500" : ""}>{a.severity}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ─────────────────── AdminBackup ─────────────────── */
export function AdminBackup() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader title="备份恢复" description="数据库备份策略、手动备份和数据恢复" action={<Button className="gap-2"><Download className="size-4" /> 立即备份</Button>} />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard label="最近备份" value="2 小时前" icon={Clock} />
        <StatCard label="备份大小" value="4.2 GB" icon={Database} />
        <StatCard label="保留天数" value="30 天" icon={Calendar} />
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Download className="size-4" /> 备份记录</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>备份时间</TableHead><TableHead>类型</TableHead><TableHead>大小</TableHead><TableHead>状态</TableHead><TableHead className="text-right">操作</TableHead></TableRow></TableHeader>
            <TableBody>
              {[
                { time: "2026-07-04 10:00", type: "全量", size: "4.2 GB", status: "成功" },
                { time: "2026-07-04 09:00", type: "增量", size: "128 MB", status: "成功" },
                { time: "2026-07-03 22:00", type: "全量", size: "4.1 GB", status: "成功" },
                { time: "2026-07-03 21:00", type: "增量", size: "96 MB", status: "成功" },
              ].map((b, i) => (
                <TableRow key={i}>
                  <TableCell className="font-mono text-xs">{b.time}</TableCell>
                  <TableCell><Badge variant="outline">{b.type}</Badge></TableCell>
                  <TableCell>{b.size}</TableCell>
                  <TableCell><Badge variant="secondary" className="text-green-600">{b.status}</Badge></TableCell>
                  <TableCell className="text-right"><Button variant="ghost" size="sm"><Upload className="size-3 mr-1" />恢复</Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

/* ─────────────────── AdminDeploy ─────────────────── */
export function AdminDeploy() {
  const [environments] = useState([
    { env: "开发环境 (dev)", version: "v1.3.1-dev", status: "运行中", deploy: "2 小时前", instances: 1, cluster: "dev-cluster", cpu: "32%", mem: "45%", url: "https://dev.metaplatform.io" },
    { env: "测试环境 (staging)", version: "v1.3.0-rc2", status: "运行中", deploy: "1 天前", instances: 2, cluster: "staging-cluster", cpu: "28%", mem: "38%", url: "https://staging.metaplatform.io" },
    { env: "生产环境 (prod)", version: "v1.2.3", status: "运行中", deploy: "1 周前", instances: 4, cluster: "prod-cluster", cpu: "52%", mem: "68%", url: "https://app.metaplatform.io" },
  ]);

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader title="集群部署" description="管理开发、测试和生产环境的集群部署" action={<Button className="gap-2"><Plus className="size-4" /> 新建环境</Button>} />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard label="环境总数" value={environments.length} icon={Server} />
        <StatCard label="总实例数" value={environments.reduce((s, e) => s + e.instances, 0)} icon={Layers} />
        <StatCard label="运行中" value={environments.filter((e) => e.status === "运行中").length} icon={CheckCircle2} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {environments.map((e) => (
          <Card key={e.env} className="hover:border-primary">
            <CardHeader>
              <div className="flex items-start justify-between">
                <CardTitle className="text-base">{e.env}</CardTitle>
                <Badge variant="default">{e.status}</Badge>
              </div>
              <CardDescription>版本: {e.version} / 集群: {e.cluster}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-xs">
                <div className="flex justify-between"><span className="text-muted-foreground">实例数</span><span className="font-medium">{e.instances}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">CPU</span><span>{e.cpu}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">内存</span><span>{e.mem}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">最近部署</span><span>{e.deploy}</span></div>
                <div className="text-muted-foreground truncate">URL: {e.url}</div>
              </div>
              <div className="flex gap-2 mt-3">
                <Button variant="outline" size="sm" className="flex-1">部署</Button>
                <Button variant="outline" size="sm" className="flex-1">回滚</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────── AdminBilling ─────────────────── */
const BILLING_PLANS = [
  { name: "基础版", price: "免费", features: ["5 个用户", "1 GB 存储", "基础 API"], active: false },
  { name: "专业版", price: "¥2,999/月", features: ["50 个用户", "50 GB 存储", "高级 API", "AI 助手"], active: true },
  { name: "企业版", price: "¥9,999/月", features: ["不限用户", "500 GB 存储", "全部功能", "专属支持"], active: false },
];

export function AdminBilling() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader title="计费订阅" description="平台资源使用计费、套餐和账单管理" />
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <StatCard label="本月费用" value="¥12,480" icon={DollarSign} />
        <StatCard label="计算资源" value="¥8,200" icon={Cpu} />
        <StatCard label="存储费用" value="¥2,880" icon={Database} />
        <StatCard label="API 调用" value="¥1,400" icon={Activity} />
      </div>

      {/* Plan Tiers */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {BILLING_PLANS.map((plan) => (
          <Card key={plan.name} className={plan.active ? "border-primary" : ""}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{plan.name}</CardTitle>
                {plan.active && <Badge>当前方案</Badge>}
              </div>
              <div className="text-2xl font-bold mt-2">{plan.price}</div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {plan.features.map((f) => (
                  <div key={f} className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="size-3 text-green-500" />
                    <span>{f}</span>
                  </div>
                ))}
              </div>
              <Button variant={plan.active ? "outline" : "default"} size="sm" className="w-full mt-4">
                {plan.active ? "管理方案" : "升级"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Usage Meters */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Activity className="size-4" /> 用量仪表</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { name: "API 调用", used: "12,480", limit: "100,000", percent: 12.5 },
              { name: "存储空间", used: "12.4 GB", limit: "50 GB", percent: 24.8 },
              { name: "LLM Token", used: "1.2M", limit: "10M", percent: 12 },
              { name: "数字员工", used: "5", limit: "20", percent: 25 },
            ].map((m) => (
              <div key={m.name} className="p-3 border rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span>{m.name}</span>
                  <span className="text-muted-foreground">{m.used} / {m.limit}</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div className="bg-primary rounded-full h-2 transition-all" style={{ width: `${m.percent}%` }} />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><DollarSign className="size-4" /> 费用明细</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>资源类型</TableHead><TableHead>用量</TableHead><TableHead>单价</TableHead><TableHead className="text-right">费用</TableHead></TableRow></TableHeader>
            <TableBody>
              {[
                { type: "计算实例 (K8s)", usage: "4 实例 x 30 天", price: "¥68/天/实例", cost: "¥8,160" },
                { type: "PostgreSQL", usage: "100GB SSD", price: "¥0.5/GB/月", cost: "¥50" },
                { type: "Redis", usage: "4GB", price: "¥200/GB/月", cost: "¥800" },
                { type: "MinIO 存储", usage: "200GB", price: "¥0.1/GB/月", cost: "¥20" },
                { type: "LLM API 调用", usage: "1,248,000 tokens", price: "¥0.001/token", cost: "¥1,248" },
                { type: "带宽", usage: "500GB", price: "¥0.5/GB", cost: "¥250" },
              ].map((b, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{b.type}</TableCell>
                  <TableCell className="text-xs">{b.usage}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{b.price}</TableCell>
                  <TableCell className="text-right font-medium">{b.cost}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

/* ─────────────────── AdminPlugins ─────────────────── */
const PLUGINS = [
  { id: 1, name: "飞书集成", version: "v2.1", status: "installed", desc: "飞书消息、审批、日历集成" },
  { id: 2, name: "钉钉集成", version: "v1.8", status: "installed", desc: "钉钉消息和审批集成" },
  { id: 3, name: "企业微信", version: "v1.5", status: "available", desc: "企业微信消息和通讯录" },
  { id: 4, name: "Flowable 引擎", version: "v6.8", status: "installed", desc: "BPMN 2.0 流程引擎" },
  { id: 5, name: "MinIO 存储", version: "v2024", status: "installed", desc: "对象存储服务" },
  { id: 6, name: "Elasticsearch", version: "v8.12", status: "available", desc: "全文搜索引擎" },
];

export function AdminPlugins() {
  const [plugins, setPlugins] = useState(PLUGINS);

  function togglePlugin(id: number) {
    setPlugins((prev) => prev.map((p) => p.id === id ? { ...p, status: p.status === "installed" ? "available" : "installed" } : p));
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader title="插件管理" description="管理平台扩展插件和第三方集成" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard label="已安装" value={plugins.filter((p) => p.status === "installed").length} icon={Package} />
        <StatCard label="可用插件" value={plugins.filter((p) => p.status === "available").length} icon={Layers} />
        <StatCard label="总插件" value={plugins.length} icon={Server} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {plugins.map((p) => (
          <Card key={p.id} className="hover:border-primary">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="size-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 text-white flex items-center justify-center"><Puzzle className="size-5" /></div>
                <Badge variant={p.status === "installed" ? "default" : "secondary"}>{p.status === "installed" ? "已安装" : "可安装"}</Badge>
              </div>
              <CardTitle className="text-base mt-2">{p.name}</CardTitle>
              <CardDescription>{p.desc}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">版本: {p.version}</span>
                <Button size="sm" variant={p.status === "installed" ? "outline" : "default"} onClick={() => togglePlugin(p.id)}>
                  {p.status === "installed" ? "卸载" : "安装"}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

