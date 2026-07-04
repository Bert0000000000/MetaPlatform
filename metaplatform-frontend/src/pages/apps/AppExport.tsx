import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/stat";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Code2, Database, Server, Smartphone, Download, FileCode, Container, Loader2, CheckCircle2, FileDown, X, ChevronDown, ChevronRight, Copy, ExternalLink } from "lucide-react";
import { useState, useEffect } from "react";
import { exportApi } from "@/lib/api";
import { useSearchParams } from "react-router-dom";

/* ── Export targets with initial checked state ── */
const INITIAL_FRONTEND = [
  { id: "vue", name: "VUE 工程", desc: "Vue 3 + Vite + Element Plus", checked: true, size: "~1.2MB" },
  { id: "react", name: "React 工程", desc: "React 19 + Vite + Ant Design", checked: false, size: "~1.4MB" },
  { id: "html", name: "静态 HTML", desc: "纯 HTML/CSS/JS 部署包", checked: false, size: "~200KB" },
];

const INITIAL_BACKEND = [
  { id: "java-spring", name: "Java Spring Boot", desc: "Java 21 + Spring Boot 3", checked: true, size: "~850KB" },
  { id: "python", name: "Python FastAPI", desc: "Python 3.12 + FastAPI + SQLAlchemy", checked: false, size: "~620KB" },
  { id: "node", name: "Node.js", desc: "Node.js 20 + Express + TypeScript", checked: false, size: "~480KB" },
];

const INITIAL_DB = [
  { id: "java-ddl", name: "DDL（建表语句）", desc: "PostgreSQL/MySQL 兼容", checked: true, size: "~12KB" },
  { id: "dml", name: "DML（初始化数据）", desc: "包含种子数据", checked: true, size: "~8KB" },
  { id: "flyway", name: "Flyway 迁移脚本", desc: "V1__init.sql ... V2__...", checked: false, size: "~4KB" },
];

const INITIAL_DEPLOY = [
  { id: "docker", name: "Docker 镜像", desc: "Dockerfile + docker build", checked: true, size: "~5KB" },
  { id: "compose", name: "Docker Compose", desc: "docker-compose.yml 多服务编排", checked: false, size: "~3KB" },
  { id: "helm", name: "Helm Chart", desc: "Kubernetes 部署包", checked: true, size: "~8KB" },
];

interface ExportFile {
  name: string;
  content: string;
  type: string;
}

interface ExportResult {
  exportId: string;
  files: ExportFile[];
  status: string;
  app: { id: string; name: string; version: string };
  generatedAt: string;
}

export default function AppExport() {
  const [searchParams] = useSearchParams();
  const appId = searchParams.get("appId") || "";

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
  const [exportError, setExportError] = useState<string | null>(null);

  /* ── Export result ── */
  const [exportResult, setExportResult] = useState<ExportResult | null>(null);

  /* ── File viewer state ── */
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  const [fileFilter, setFileFilter] = useState("");
  const [copiedFile, setCopiedFile] = useState<string | null>(null);

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

  /* ── Get active backend targets that the API supports ── */
  function getApiTargets(): string[] {
    const allTargets = [...frontendTargets, ...backendTargets, ...dbTargets, ...deployTargets];
    return allTargets.filter((t) => t.checked).map((t) => t.id);
  }

  /* ── Toggle file expansion ── */
  function toggleFileExpand(fileName: string) {
    setExpandedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(fileName)) {
        next.delete(fileName);
      } else {
        next.add(fileName);
      }
      return next;
    });
  }

  /* ── Copy file content ── */
  async function copyFileContent(file: ExportFile) {
    try {
      await navigator.clipboard.writeText(file.content);
      setCopiedFile(file.name);
      setTimeout(() => setCopiedFile(null), 2000);
    } catch {
      // Fallback
      const ta = document.createElement("textarea");
      ta.value = file.content;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopiedFile(file.name);
      setTimeout(() => setCopiedFile(null), 2000);
    }
  }

  /* ── Download single file ── */
  function downloadFile(file: ExportFile) {
    const blob = new Blob([file.content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = file.name.split("/").pop() || file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /* ── Download all files as combined text (browser-side) ── */
  function downloadAllFiles() {
    if (!exportResult || exportResult.files.length === 0) return;

    // Create a concatenated file with all source code
    const separator = "\n" + "=".repeat(80) + "\n";
    const combined = exportResult.files.map((f) => {
      return `// ─── File: ${f.name} ${"─".repeat(Math.max(0, 60 - f.name.length))}\n${f.content}`;
    }).join(separator);

    const blob = new Blob([combined], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${exportResult.app.name || "export"}-all-files.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /* ── Filter files ── */
  const filteredFiles = exportResult
    ? exportResult.files.filter(
        (f) => !fileFilter || f.name.toLowerCase().includes(fileFilter.toLowerCase()),
      )
    : [];

  /* ── Get file icon based on type ── */
  function getFileIcon(type: string) {
    switch (type) {
      case "java": return <FileCode className="size-4 text-orange-500" />;
      case "typescript":
      case "vue": return <Code2 className="size-4 text-blue-500" />;
      case "sql": return <Database className="size-4 text-green-500" />;
      case "yaml":
      case "json": return <FileCode className="size-4 text-purple-500" />;
      case "dockerfile":
      case "nginx":
      case "shell": return <Container className="size-4 text-cyan-500" />;
      default: return <FileCode className="size-4 text-muted-foreground" />;
    }
  }

  /* ── Start export (real API call) ── */
  async function handleExport() {
    if (!appId) {
      setExportError("请先选择一个应用（URL 中需要 appId 参数）");
      setExportDialogOpen(true);
      return;
    }

    setExportDialogOpen(true);
    setExporting(true);
    setExportDone(false);
    setExportError(null);
    setExportResult(null);
    setExportProgress(0);
    setExpandedFiles(new Set());

    const targets = getApiTargets();
    const steps = [
      { label: "读取应用配置...", progress: 10 },
      { label: "读取本体模型...", progress: 25 },
      { label: "生成代码文件...", progress: 50 },
      { label: "处理导出结果...", progress: 80 },
      { label: "完成", progress: 100 },
    ];

    // Animate progress steps while waiting for API
    let stepIdx = 0;
    const progressTimer = setInterval(() => {
      if (stepIdx < steps.length - 1) {
        stepIdx++;
        setExportStep(steps[stepIdx].label);
        setExportProgress(steps[stepIdx].progress);
      }
    }, 400);

    setExportStep(steps[0].label);
    setExportProgress(steps[0].progress);

    try {
      const result = await exportApi.generate(appId, targets);
      clearInterval(progressTimer);
      setExportProgress(100);
      setExportStep("完成");
      setExportResult(result);
      setExporting(false);
      setExportDone(true);
    } catch (err: any) {
      clearInterval(progressTimer);
      setExporting(false);
      setExportError(err.message || "导出失败，请稍后重试");
    }
  }

  /* ── Reset export dialog ── */
  function handleCloseExport() {
    setExportDialogOpen(false);
    setExportDone(false);
    setExportProgress(0);
    setExportStep("");
    setExportError(null);
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="应用导出（CODE EXPORT）"
        description={appId ? `正在导出应用: ${appId}` : "将应用导出为可独立部署的完整工程（前端 + 后端 + 数据库 + 部署）"}
        action={
          <Button className="gap-2" size="lg" onClick={handleExport} disabled={exporting || selectedCount === 0}>
            {exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            一键导出 {selectedCount > 0 && `(${selectedCount} 项)`}
          </Button>
        }
      />

      {!appId && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4">
            <p className="text-sm text-amber-800">
              请通过 URL 参数 <code>appId</code> 指定要导出的应用。例如: <code>/apps/export?appId=your-app-id</code>
            </p>
          </CardContent>
        </Card>
      )}

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
          {/* F4.4.8.5 组件封装 Tab */}
          <TabsTrigger value="component-encap" className="gap-2">
            <FileCode className="size-4" /> 组件封装
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

        {/* F4.4.8.5 组件封装 */}
        <TabsContent value="component-encap" className="mt-4 space-y-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileCode className="size-4" /> 自定义组件封装
              </CardTitle>
              <CardDescription>将应用中的自定义组件导出为可复用的 npm 包</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { name: "CustomerCard", desc: "客户信息卡片组件", lines: 86, deps: 3 },
                { name: "OrderTable", desc: "订单数据表格组件", lines: 142, deps: 5 },
                { name: "SalesChart", desc: "销售图表组件", lines: 64, deps: 2 },
                { name: "ApprovalFlow", desc: "审批流程可视化组件", lines: 210, deps: 4 },
              ].map((comp) => (
                <div key={comp.name} className="flex items-center gap-3 p-3 border rounded-lg">
                  <FileCode className="size-4 text-blue-500" />
                  <div className="flex-1">
                    <div className="font-mono text-sm font-medium">{comp.name}</div>
                    <div className="text-xs text-muted-foreground">{comp.desc}</div>
                  </div>
                  <Badge variant="secondary" className="text-xs">{comp.lines} 行</Badge>
                  <Badge variant="outline" className="text-xs">{comp.deps} 依赖</Badge>
                  <Button variant="ghost" size="icon" className="size-8" title="复制组件代码">
                    <Copy className="size-4" />
                  </Button>
                </div>
              ))}
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" size="sm">
                  <ExternalLink className="size-3 mr-1" /> 预览文档
                </Button>
                <Button size="sm">
                  <Download className="size-3 mr-1" /> 导出组件包
                </Button>
              </div>
            </CardContent>
          </Card>
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

      {/* ── Export Progress & Results Dialog ── */}
      <Dialog open={exportDialogOpen} onOpenChange={exporting ? undefined : handleCloseExport}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {exportError ? (
                <><X className="size-5 text-red-500" /> 导出失败</>
              ) : exportDone ? (
                <><CheckCircle2 className="size-5 text-green-500" /> 导出完成</>
              ) : (
                <><Loader2 className="size-5 animate-spin" /> 正在导出...</>
              )}
            </DialogTitle>
            <DialogDescription>
              {exportError
                ? exportError
                : exportDone && exportResult
                  ? `已生成 ${exportResult.files.length} 个文件`
                  : `正在生成 ${selectedCount} 个导出模块，请稍候`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 flex-1 overflow-y-auto min-h-0">
            {/* Progress bar */}
            <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ease-out rounded-full ${exportError ? "bg-red-500" : "bg-primary"}`}
                style={{ width: `${exportProgress}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{exportStep}</span>
              <span>{exportProgress}%</span>
            </div>

            {/* Error message */}
            {exportError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                {exportError}
              </div>
            )}

            {/* Export result: file list */}
            {exportDone && exportResult && (
              <div className="space-y-3">
                {/* Filter & actions bar */}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="搜索文件..."
                    value={fileFilter}
                    onChange={(e) => setFileFilter(e.target.value)}
                    className="flex-1 px-3 py-1.5 text-sm border rounded-md bg-background"
                  />
                  <Button variant="outline" size="sm" onClick={downloadAllFiles} className="gap-1">
                    <FileDown className="size-3.5" />
                    下载全部
                  </Button>
                </div>

                {/* File tree */}
                <div className="border rounded-md divide-y max-h-[400px] overflow-y-auto">
                  {filteredFiles.length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      {fileFilter ? "没有匹配的文件" : "暂无文件"}
                    </div>
                  ) : (
                    filteredFiles.map((file) => (
                      <div key={file.name} className="text-sm">
                        {/* File header */}
                        <div
                          className="flex items-center gap-2 px-3 py-2 hover:bg-muted/50 cursor-pointer select-none"
                          onClick={() => toggleFileExpand(file.name)}
                        >
                          {expandedFiles.has(file.name) ? (
                            <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
                          )}
                          {getFileIcon(file.type)}
                          <span className="flex-1 font-mono text-xs truncate">{file.name}</span>
                          <Badge variant="outline" className="text-[10px] shrink-0">{file.type}</Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 shrink-0"
                            onClick={(e) => { e.stopPropagation(); copyFileContent(file); }}
                            title="复制内容"
                          >
                            <Copy className="size-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 shrink-0"
                            onClick={(e) => { e.stopPropagation(); downloadFile(file); }}
                            title="下载文件"
                          >
                            <FileDown className="size-3" />
                          </Button>
                        </div>
                        {/* File content (expandable) */}
                        {expandedFiles.has(file.name) && (
                          <div className="border-t bg-muted/30">
                            <pre className="p-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all max-h-[300px] overflow-y-auto">
                              {file.content}
                            </pre>
                          </div>
                        )}
                        {/* Copied toast */}
                        {copiedFile === file.name && (
                          <div className="absolute right-12 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded">
                            已复制
                          </div>
                        )}
                      </div>
                    ))
                  )}
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
                <Button onClick={downloadAllFiles} disabled={!exportResult || exportResult.files.length === 0}>
                  <FileDown className="size-4 mr-1" />
                  下载全部 ({exportResult?.files.length || 0} 个文件)
                </Button>
              </>
            ) : exportError ? (
              <>
                <Button variant="outline" onClick={handleCloseExport}>
                  关闭
                </Button>
                <Button onClick={handleExport}>
                  重试
                </Button>
              </>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
