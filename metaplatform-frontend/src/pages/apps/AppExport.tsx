import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/stat";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Code2, Database, Server, Smartphone, Download, FileCode, Container, Loader2, CheckCircle2, FileDown, X } from "lucide-react";
import { useState, useEffect } from "react";

/* ── Export targets with initial checked state ── */
const INITIAL_FRONTEND = [
  { id: "vue", name: "VUE 工程", desc: "Vue 3 + Vite + Element Plus", checked: true, size: "~1.2MB" },
  { id: "react", name: "React 工程", desc: "React 19 + Vite + Ant Design", checked: false, size: "~1.4MB" },
  { id: "html", name: "静态 HTML", desc: "纯 HTML/CSS/JS 部署包", checked: false, size: "~200KB" },
];

const INITIAL_BACKEND = [
  { id: "java", name: "Java Spring Boot", desc: "Java 21 + Spring Boot 3", checked: true, size: "~850KB" },
  { id: "python", name: "Python FastAPI", desc: "Python 3.12 + FastAPI + SQLAlchemy", checked: false, size: "~620KB" },
  { id: "node", name: "Node.js", desc: "Node.js 20 + Express + TypeScript", checked: false, size: "~480KB" },
];

const INITIAL_DB = [
  { id: "ddl", name: "DDL（建表语句）", desc: "PostgreSQL/MySQL 兼容", checked: true, size: "~12KB" },
  { id: "dml", name: "DML（初始化数据）", desc: "包含种子数据", checked: true, size: "~8KB" },
  { id: "flyway", name: "Flyway 迁移脚本", desc: "V1__init.sql ... V2__...", checked: false, size: "~4KB" },
];

const INITIAL_DEPLOY = [
  { id: "docker", name: "Docker 镜像", desc: "Dockerfile + docker build", checked: true, size: "~5KB" },
  { id: "compose", name: "Docker Compose", desc: "docker-compose.yml 多服务编排", checked: false, size: "~3KB" },
  { id: "helm", name: "Helm Chart", desc: "Kubernetes 部署包", checked: true, size: "~8KB" },
];

export default function AppExport() {
  const [activeTab, setActiveTab] = useState("frontend");
  const [frontendTargets, setFrontendTargets] = useState(INITIAL_FRONTEND);
  const [backendTargets, setBackendTargets] = useState(INITIAL_BACKEND);
  const [dbTargets, setDbTargets] = useState(INITIAL_DB);
  const [deployTargets, setDeployTargets] = useState(INITIAL_DEPLOY);

  /* ── Export dialog state ── */
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportStep, setExportStep] = useState("");
  const [exportDone, setExportDone] = useState(false);

  /* ── Toggle checkbox helper ── */
  function toggleItem(
    setter: React.Dispatch<React.SetStateAction<typeof INITIAL_FRONTEND>>,
    id: string,
  ) {
    setter((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, checked: !item.checked } : item,
      ),
    );
  }

  /* ── Count selected items ── */
  const selectedCount = [...frontendTargets, ...backendTargets, ...dbTargets, ...deployTargets].filter((t) => t.checked).length;

  /* ── Start export ── */
  async function handleExport() {
    setExportDialogOpen(true);
    setExporting(true);
    setExportDone(false);
    setExportProgress(0);

    const steps = [
      { label: "生成前端源码...", progress: 15 },
      { label: "生成后端源码...", progress: 35 },
      { label: "导出数据库脚本...", progress: 55 },
      { label: "打包部署配置...", progress: 75 },
      { label: "压缩归档...", progress: 90 },
      { label: "完成", progress: 100 },
    ];

    for (const step of steps) {
      setExportStep(step.label);
      setExportProgress(step.progress);
      await new Promise((r) => setTimeout(r, 600 + Math.random() * 400));
    }

    setExporting(false);
    setExportDone(true);
  }

  /* ── Reset export dialog ── */
  function handleCloseExport() {
    setExportDialogOpen(false);
    setExportDone(false);
    setExportProgress(0);
    setExportStep("");
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="应用导出（CODE EXPORT）"
        description="将应用导出为可独立部署的完整工程（前端 + 后端 + 数据库 + 部署）"
        action={
          <Button className="gap-2" size="lg" onClick={handleExport} disabled={exporting || selectedCount === 0}>
            {exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            一键导出 {selectedCount > 0 && `(${selectedCount} 项)`}
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
            <Card key={t.id} className={t.checked ? "border-primary/50" : ""}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={t.checked}
                    onCheckedChange={() => toggleItem(setFrontendTargets, t.id)}
                    id={`fe-${t.id}`}
                  />
                  <div className="flex-1">
                    <label htmlFor={`fe-${t.id}`} className="font-medium text-sm cursor-pointer">
                      {t.name}
                    </label>
                    <p className="text-xs text-muted-foreground">{t.desc}</p>
                  </div>
                  <Badge variant="outline">{t.size}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="backend" className="mt-4 space-y-3">
          {backendTargets.map((t) => (
            <Card key={t.id} className={t.checked ? "border-primary/50" : ""}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={t.checked}
                    onCheckedChange={() => toggleItem(setBackendTargets, t.id)}
                    id={`be-${t.id}`}
                  />
                  <div className="flex-1">
                    <label htmlFor={`be-${t.id}`} className="font-medium text-sm cursor-pointer">
                      {t.name}
                    </label>
                    <p className="text-xs text-muted-foreground">{t.desc}</p>
                  </div>
                  <Badge variant="outline">{t.size}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="database" className="mt-4 space-y-3">
          {dbTargets.map((t) => (
            <Card key={t.id} className={t.checked ? "border-primary/50" : ""}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={t.checked}
                    onCheckedChange={() => toggleItem(setDbTargets, t.id)}
                    id={`db-${t.id}`}
                  />
                  <div className="flex-1">
                    <label htmlFor={`db-${t.id}`} className="font-medium text-sm cursor-pointer">
                      {t.name}
                    </label>
                    <p className="text-xs text-muted-foreground">{t.desc}</p>
                  </div>
                  <Badge variant="outline">{t.size}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="deploy" className="mt-4 space-y-3">
          {deployTargets.map((t) => (
            <Card key={t.id} className={t.checked ? "border-primary/50" : ""}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={t.checked}
                    onCheckedChange={() => toggleItem(setDeployTargets, t.id)}
                    id={`dp-${t.id}`}
                  />
                  <div className="flex-1">
                    <label htmlFor={`dp-${t.id}`} className="font-medium text-sm cursor-pointer">
                      {t.name}
                    </label>
                    <p className="text-xs text-muted-foreground">{t.desc}</p>
                  </div>
                  <Badge variant="outline">{t.size}</Badge>
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
            <div className="flex items-center justify-between p-2 hover:bg-muted rounded cursor-pointer">
              <code>kubectl apply -f k8s/</code>
              <Badge variant="outline">Kubernetes</Badge>
            </div>
            <div className="flex items-center justify-between p-2 hover:bg-muted rounded cursor-pointer">
              <code>docker compose up -d</code>
              <Badge variant="outline">Docker</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Export Progress Dialog ── */}
      <Dialog open={exportDialogOpen} onOpenChange={exporting ? undefined : handleCloseExport}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {exportDone ? (
                <><CheckCircle2 className="size-5 text-green-500" /> 导出完成</>
              ) : (
                <><Loader2 className="size-5 animate-spin" /> 正在导出...</>
              )}
            </DialogTitle>
            <DialogDescription>
              {exportDone
                ? "所有选中的模块已成功导出"
                : `正在生成 ${selectedCount} 个导出模块，请稍候`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Progress bar */}
            <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-500 ease-out rounded-full"
                style={{ width: `${exportProgress}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{exportStep}</span>
              <span>{exportProgress}%</span>
            </div>

            {/* Export summary */}
            {exportDone && (
              <div className="space-y-2">
                <div className="text-sm font-medium mt-2">导出内容：</div>
                <div className="space-y-1">
                  {[...frontendTargets, ...backendTargets, ...dbTargets, ...deployTargets]
                    .filter((t) => t.checked)
                    .map((t) => (
                      <div key={t.id} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <CheckCircle2 className="size-3 text-green-500" />
                        <span>{t.name}</span>
                        <Badge variant="outline" className="text-xs ml-auto">{t.size}</Badge>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            {exporting ? (
              <Button variant="outline" disabled>请稍候...</Button>
            ) : exportDone ? (
              <>
                <Button variant="outline" onClick={handleCloseExport}>
                  关闭
                </Button>
                <Button onClick={() => {
                  // Simulate download
                  const link = document.createElement("a");
                  link.href = "#";
                  link.download = "metaplatform-export.zip";
                  // In a real app, this would be a real file URL
                  handleCloseExport();
                  // Show a brief toast-like message
                  alert("下载已开始：metaplatform-export.zip（演示模式，文件将由后端生成）");
                }}>
                  <FileDown className="size-4 mr-1" />
                  下载导出包
                </Button>
              </>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}