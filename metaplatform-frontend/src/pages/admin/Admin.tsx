import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader, StatCard } from "@/components/ui/stat";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { mockUsers } from "@/lib/mock-data";
import { Users, Shield, Server, Cpu, Database, Activity, Plus, MoreHorizontal, BarChart3, AlertTriangle } from "lucide-react";

const roleLabels: Record<string, string> = {
  executive: "领导",
  business: "业务",
  developer: "开发",
  architect: "架构师",
  ops: "运维",
};

export function UserList() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="size-4" /> 用户列表
        </CardTitle>
        <CardDescription>系统所有用户</CardDescription>
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
                    <MoreHorizontal className="size-4" />
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

export function AdminDashboard() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <StatCard label="用户总数" value={1284} icon="👥" />
        <StatCard label="在线服务" value="32/32" icon="🟢" />
        <StatCard label="今日 API 调用" value={486000} trend={12.4} icon="📡" />
        <StatCard label="本月账单" value="¥ 12,840" icon="💰" />
      </div>
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
    </div>
  );
}