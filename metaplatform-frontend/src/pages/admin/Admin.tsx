import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/stat";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { mockUsers } from "@/lib/mock-data";
import { Users, Shield, Server, Cpu, Database, Activity, Plus, MoreHorizontal, BarChart3, AlertTriangle, Building2, Settings2, BookText, FileText, Clock, Edit, Trash2, Search, Filter, KeyRound, Lock, Eye, Monitor, Package, Handshake, Megaphone, Settings, DollarSign, Palette, Wrench, TestTube, Home, Bot, Smartphone, RefreshCw, Dna, CheckCircle2, BookOpen, Cloud, Circle, Radio } from "lucide-react";

const roleLabels: Record<string, string> = {
  executive: "领导",
  business: "业务",
  developer: "开发",
  architect: "架构师",
  ops: "运维",
};

// 角色管理
const ROLES = [
  { id: 1, name: "超级管理员", code: "super_admin", userCount: 3, permissionCount: 248, desc: "拥有所有权限", builtin: true },
  { id: 2, name: "业务管理员", code: "business_admin", userCount: 8, permissionCount: 156, desc: "应用、流程、数据管理", builtin: true },
  { id: 3, name: "开发者", code: "developer", userCount: 24, permissionCount: 84, desc: "应用开发与部署", builtin: true },
  { id: 4, name: "业务人员", code: "business_user", userCount: 286, permissionCount: 32, desc: "业务操作与查询", builtin: true },
  { id: 5, name: "只读用户", code: "readonly", userCount: 142, permissionCount: 18, desc: "仅查看", builtin: true },
  { id: 6, name: "销售经理", code: "sales_manager", userCount: 12, permissionCount: 64, desc: "CRM 业务主管", builtin: false },
];

// 部门
const DEPARTMENTS = [
  { id: 1, name: "技术中心", parent: "—", count: 86, leader: "陈志远", icon: Monitor },
  { id: 2, name: "产品中心", parent: "—", count: 18, leader: "李娜", icon: Package },
  { id: 3, name: "销售中心", parent: "—", count: 142, leader: "张伟", icon: Handshake },
  { id: 4, name: "市场中心", parent: "—", count: 24, leader: "王强", icon: Megaphone },
  { id: 5, name: "运营中心", parent: "—", count: 38, leader: "刘敏", icon: Settings },
  { id: 6, name: "财务中心", parent: "—", count: 12, leader: "陈红", icon: DollarSign },
  { id: 7, name: "人力资源中心", parent: "—", count: 8, leader: "李俊", icon: Users },
  { id: 8, name: "前端开发组", parent: "技术中心", count: 18, leader: "杨俊", icon: Palette },
  { id: 9, name: "后端开发组", parent: "技术中心", count: 36, leader: "张浩", icon: Wrench },
  { id: 10, name: "测试组", parent: "技术中心", count: 12, leader: "刘华", icon: TestTube },
];

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

// 操作日志
const OPERATION_LOGS = [
  { time: "12:48:32", user: "张伟", ip: "10.0.1.5", module: "客户管理", action: "编辑客户 #C8392 等级", result: "成功" },
  { time: "12:48:18", user: "李娜", ip: "10.0.1.8", module: "应用发布", action: "部署 CRM v2.3 → 测试", result: "成功" },
  { time: "12:48:05", user: "王强", ip: "10.0.1.12", module: "数据建模", action: "删除冗余字段", result: "成功" },
  { time: "12:47:55", user: "刘敏", ip: "10.0.2.5", module: "流程中心", action: "修改采购流程节点", result: "成功" },
  { time: "12:47:42", user: "陈红", ip: "10.0.3.8", module: "权限管理", action: "新增角色：销售主管", result: "成功" },
  { time: "12:47:30", user: "系统", ip: "127.0.0.1", module: "系统", action: "自动备份数据库", result: "成功" },
  { time: "12:47:15", user: "未知", ip: "10.0.99.99", module: "登录", action: "失败: 密码错误", result: "失败" },
];

export function UserList() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="size-4" /> 用户列表
          </CardTitle>
          <CardDescription>系统所有用户（{mockUsers.length} 个）</CardDescription>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Filter className="size-3 mr-1" />
            筛选
          </Button>
          <Button size="sm">
            <Plus className="size-3 mr-1" />
            新建用户
          </Button>
        </div>
      </CardHeader>
      <CardContent>
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
            {mockUsers.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">{u.name}</TableCell>
                <TableCell className="font-mono text-xs">{u.email}</TableCell>
                <TableCell>
                  <Badge variant="outline">{roleLabels[u.role]}</Badge>
                </TableCell>
                <TableCell>{u.department}</TableCell>
                <TableCell>
                  <Badge variant={u.status === "active" ? "default" : "secondary"}>
                    {u.status === "active" ? "活跃" : "禁用"}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs">{u.lastLogin}</TableCell>
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
    </Card>
  );
}

export function RoleList() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="size-4" /> 角色管理
          </CardTitle>
          <CardDescription>RBAC 角色（{ROLES.length} 个）</CardDescription>
        </div>
        <Button size="sm">
          <Plus className="size-3 mr-1" />
          新建角色
        </Button>
      </CardHeader>
      <CardContent>
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
            {ROLES.map((r) => (
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
      </CardContent>
    </Card>
  );
}

export function DepartmentList() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="size-4" /> 部门管理
          </CardTitle>
          <CardDescription>组织架构（{DEPARTMENTS.length} 个）</CardDescription>
        </div>
        <Button size="sm">
          <Plus className="size-3 mr-1" />
          新建部门
        </Button>
      </CardHeader>
      <CardContent className="p-0">
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
            {DEPARTMENTS.map((d) => (
              <TableRow key={d.id}>
                <TableCell>
                  <span className="mr-2"><d.icon className="size-4" /></span>
                  <span className="font-medium">{d.name}</span>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{d.parent}</TableCell>
                <TableCell>{d.count}</TableCell>
                <TableCell>{d.leader}</TableCell>
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
    </Card>
  );
}

export function MenuConfig() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <Settings2 className="size-4" /> 菜单配置
          </CardTitle>
          <CardDescription>平台菜单与权限点</CardDescription>
        </div>
        <Button size="sm">
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
    </Card>
  );
}

export function DictionaryList() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <BookText className="size-4" /> 数据字典
          </CardTitle>
          <CardDescription>系统级业务字典（{DICTIONARIES.length} 个）</CardDescription>
        </div>
        <Button size="sm">
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
    </Card>
  );
}

export function OperationLog() {
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
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>时间</TableHead>
              <TableHead>操作人</TableHead>
              <TableHead>IP</TableHead>
              <TableHead>模块</TableHead>
              <TableHead>操作</TableHead>
              <TableHead>结果</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {OPERATION_LOGS.map((l, i) => (
              <TableRow key={i}>
                <TableCell className="font-mono text-xs">{l.time}</TableCell>
                <TableCell className="font-medium">{l.user}</TableCell>
                <TableCell className="font-mono text-xs">{l.ip}</TableCell>
                <TableCell>{l.module}</TableCell>
                <TableCell className="text-xs">{l.action}</TableCell>
                <TableCell>
                  <Badge variant={l.result === "成功" ? "secondary" : "destructive"} className={l.result === "成功" ? "text-green-600" : ""}>
                    {l.result}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export function SystemSettings() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">平台信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: "平台名称", value: "MetaPlatform 企业版" },
              { label: "版本", value: "v1.3.0" },
              { label: "License", value: "Enterprise" },
              { label: "部署模式", value: "Kubernetes 多集群" },
              { label: "运行环境", value: "Production" },
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
              { label: "密码强度", value: "高（8 位 + 数字 + 字母）", icon: KeyRound },
              { label: "登录失败锁定", value: "5 次 / 30 分钟", icon: Lock },
              { label: "会话超时", value: "60 分钟", icon: Clock },
              { label: "MFA 双因素", value: "开启", icon: Shield },
              { label: "数据加密", value: "AES-256", icon: Lock },
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

export function AdminDashboard() {
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
        <StatCard label="用户总数" value={1284} icon={Users} />
        <StatCard label="在线服务" value="32/32" icon={Circle} />
        <StatCard label="今日 API 调用" value={486000} trend={12.4} icon={Radio} />
        <StatCard label="本月账单" value="¥ 12,840" icon={DollarSign} />
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