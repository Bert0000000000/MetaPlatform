import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/stat";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Code2, Database, Server, Smartphone, Download, FileCode, Container } from "lucide-react";
import { useState } from "react";

const frontendTargets = [
  { id: "vue", name: "VUE 工程", desc: "Vue 3 + Vite + Element Plus", checked: true },
  { id: "react", name: "React 工程", desc: "React 19 + Vite + Ant Design", checked: false },
  { id: "html", name: "静态 HTML", desc: "纯 HTML/CSS/JS 部署包", checked: false },
];

const backendTargets = [
  { id: "java", name: "Java Spring Boot", desc: "Java 21 + Spring Boot 3", checked: true },
  { id: "python", name: "Python FastAPI", desc: "Python 3.12 + FastAPI + SQLAlchemy", checked: false },
  { id: "node", name: "Node.js", desc: "Node.js 20 + Express + TypeScript", checked: false },
];

const dbTargets = [
  { id: "ddl", name: "DDL（建表语句）", desc: "PostgreSQL/MySQL 兼容", checked: true },
  { id: "dml", name: "DML（初始化数据）", desc: "包含种子数据", checked: true },
  { id: "flyway", name: "Flyway 迁移脚本", desc: "V1__init.sql ... V2__...", checked: false },
];

const deployTargets = [
  { id: "docker", name: "Docker 镜像", desc: "Dockerfile + docker build", checked: true },
  { id: "compose", name: "Docker Compose", desc: "docker-compose.yml 多服务编排", checked: false },
  { id: "helm", name: "Helm Chart", desc: "Kubernetes 部署包", checked: true },
];

export default function AppExport() {
  const [activeTab, setActiveTab] = useState("frontend");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="应用导出（CODE EXPORT）"
        description="将应用导出为可独立部署的完整工程（前端 + 后端 + 数据库 + 部署）"
        action={
          <Button className="gap-2" size="lg">
            <Download className="size-4" /> 一键导出
          </Button>
        }
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="frontend" className="gap-2">
            <Code2 className="size-4" /> 前端源码
          </TabsTrigger>
          <TabsTrigger value="backend" className="gap-2">
            <Server className="size-4" /> 后端源码
          </TabsTrigger>
          <TabsTrigger value="database" className="gap-2">
            <Database className="size-4" /> 数据库脚本
          </TabsTrigger>
          <TabsTrigger value="deploy" className="gap-2">
            <Container className="size-4" /> 部署包
          </TabsTrigger>
        </TabsList>

        <TabsContent value="frontend" className="mt-4 space-y-3">
          {frontendTargets.map((t) => (
            <Card key={t.id}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Checkbox defaultChecked={t.checked} id={`fe-${t.id}`} />
                  <div className="flex-1">
                    <label htmlFor={`fe-${t.id}`} className="font-medium text-sm cursor-pointer">
                      {t.name}
                    </label>
                    <p className="text-xs text-muted-foreground">{t.desc}</p>
                  </div>
                  <Badge variant="outline">~ 1.2MB</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="backend" className="mt-4 space-y-3">
          {backendTargets.map((t) => (
            <Card key={t.id}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Checkbox defaultChecked={t.checked} id={`be-${t.id}`} />
                  <div className="flex-1">
                    <label htmlFor={`be-${t.id}`} className="font-medium text-sm cursor-pointer">
                      {t.name}
                    </label>
                    <p className="text-xs text-muted-foreground">{t.desc}</p>
                  </div>
                  <Badge variant="outline">~ 850KB</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="database" className="mt-4 space-y-3">
          {dbTargets.map((t) => (
            <Card key={t.id}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Checkbox defaultChecked={t.checked} id={`db-${t.id}`} />
                  <div className="flex-1">
                    <label htmlFor={`db-${t.id}`} className="font-medium text-sm cursor-pointer">
                      {t.name}
                    </label>
                    <p className="text-xs text-muted-foreground">{t.desc}</p>
                  </div>
                  <Badge variant="outline">~ 12KB</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="deploy" className="mt-4 space-y-3">
          {deployTargets.map((t) => (
            <Card key={t.id}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Checkbox defaultChecked={t.checked} id={`dp-${t.id}`} />
                  <div className="flex-1">
                    <label htmlFor={`dp-${t.id}`} className="font-medium text-sm cursor-pointer">
                      {t.name}
                    </label>
                    <p className="text-xs text-muted-foreground">{t.desc}</p>
                  </div>
                  <Badge variant="outline">~ 5KB</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Smartphone className="size-4" /> 一键部署到私有环境
          </CardTitle>
          <CardDescription>导出后可一键部署到你的私有服务器/集群</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex items-center justify-between p-2 hover:bg-muted rounded">
              <code>kubectl apply -f k8s/</code>
              <Badge variant="outline">Kubernetes</Badge>
            </div>
            <div className="flex items-center justify-between p-2 hover:bg-muted rounded">
              <code>docker compose up -d</code>
              <Badge variant="outline">Docker</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}