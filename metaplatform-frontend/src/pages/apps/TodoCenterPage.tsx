import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { appServiceApi, type TodoTask, type TodoTaskDetail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "@/lib/toast";
import { CheckCircle, XCircle, Clock, ArrowLeft, Loader2, Eye, FileText, ShieldOff } from "lucide-react";

/**
 * AC-302.6: 解析 BPMN 中任务级 fieldPermissions, 渲染表单时过滤 hidden 字段,
 * 按 editable 字段列表决定 input 是否可编辑, visible 字段列表决定是否展示.
 */
function parsePermissionEntry(entry: unknown): {
  hidden: Set<string>;
  visible: Set<string> | null;
  editable: Set<string> | null;
} {
  if (!entry || typeof entry !== "object") {
    return { hidden: new Set(), visible: null, editable: null };
  }
  const obj = entry as Record<string, unknown>;
  const toArr = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  return {
    hidden: new Set(toArr(obj.hidden)),
    visible: Array.isArray(obj.visible) ? new Set(toArr(obj.visible)) : null,
    editable: Array.isArray(obj.editable) ? new Set(toArr(obj.editable)) : null,
  };
}

/** 根据权限对象决定字段应不应该被渲染出来. */
function shouldRenderField(name: string, perm: ReturnType<typeof parsePermissionEntry>): boolean {
  if (perm.hidden.has(name)) return false;
  if (perm.visible && !perm.visible.has(name)) return false;
  return true;
}

/** 根据权限对象决定字段是否可编辑. */
function isFieldEditable(name: string, perm: ReturnType<typeof parsePermissionEntry>): boolean {
  if (perm.editable) return perm.editable.has(name);
  // editable 没设时: 默认隐藏字段只读, 其他字段按需
  return !perm.hidden.has(name);
}

export default function TodoCenterPage() {
  const { appId } = useParams<{ appId: string }>();
  const navigate = useNavigate();
  const [todos, setTodos] = useState<TodoTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("pending");
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);
  const [detail, setDetail] = useState<TodoTaskDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchTodos = async () => {
    if (!appId) return;
    setLoading(true);
    try {
      const list = await appServiceApi.todos.list(appId);
      setTodos(list);
    } catch (e: any) {
      toast.error(`加载待办失败：${e.message || "未知错误"}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTodos();
    const timer = setInterval(fetchTodos, 5000);
    return () => clearInterval(timer);
  }, [appId]);

  // 打开详情弹窗
  useEffect(() => {
    if (!detailTaskId || !appId) {
      setDetail(null);
      return;
    }
    setDetailLoading(true);
    appServiceApi.todos
      .get(appId, detailTaskId)
      .then(setDetail)
      .catch((e: any) => toast.error(`加载任务详情失败：${e.message || "未知错误"}`))
      .finally(() => setDetailLoading(false));
  }, [appId, detailTaskId]);

  const handleComplete = async (taskId: string) => {
    if (!appId) return;
    try {
      await appServiceApi.todos.complete(appId, taskId);
      toast.success("已通过");
      fetchTodos();
      if (detailTaskId === taskId) setDetailTaskId(null);
    } catch (e: any) {
      toast.error(`操作失败：${e.message || "未知错误"}`);
    }
  };

  const handleReject = async (taskId: string) => {
    if (!appId) return;
    const comment = window.prompt("请填写驳回意见（必填）：");
    if (!comment) return;
    try {
      await appServiceApi.todos.reject(appId, taskId, comment);
      toast.success("已驳回");
      fetchTodos();
      if (detailTaskId === taskId) setDetailTaskId(null);
    } catch (e: any) {
      toast.error(`操作失败：${e.message || "未知错误"}`);
    }
  };

  // 计算当前任务的字段权限
  const permission = useMemo(() => {
    if (!detail?.fieldPermissions) return parsePermissionEntry(null);
    // 后端会返回 { taskKey: {visible, editable, hidden} } 或扁平结构
    // 兼容两种 schema: 1) 嵌套 2) 扁平
    const fp = detail.fieldPermissions as Record<string, unknown>;
    const taskKey = detail.task?.taskDefinitionKey;
    if (taskKey && fp[taskKey]) return parsePermissionEntry(fp[taskKey]);
    // 扁平结构：直接是 {visible, editable, hidden}
    return parsePermissionEntry(fp);
  }, [detail]);

  const values = useMemo<Record<string, unknown>>(() => {
    if (!detail?.submission?.valuesJson) return {};
    try {
      return JSON.parse(detail.submission.valuesJson);
    } catch {
      return {};
    }
  }, [detail?.submission?.valuesJson]);

  const hiddenCount = permission.hidden.size;
  const totalFields = Object.keys(values).length;
  const renderedCount = useMemo(() => {
    return Object.keys(values).filter((k) => shouldRenderField(k, permission)).length;
  }, [values, permission]);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="size-4" />
        </Button>
        <h1 className="text-xl font-bold">待办中心</h1>
        {hiddenCount > 0 && (
          <Badge variant="outline" className="text-xs ml-2">
            <ShieldOff className="size-3 mr-1" />
            当前角色 {hiddenCount} 个字段已隐藏
          </Badge>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="pending">待处理</TabsTrigger>
          <TabsTrigger value="done">已处理</TabsTrigger>
        </TabsList>
        <TabsContent value="pending">
          {loading && todos.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : todos.length === 0 ? (
            <p className="text-sm text-muted-foreground py-12 text-center">暂无待办任务</p>
          ) : (
            <div className="grid gap-4">
              {todos.map((task) => (
                <Card key={task.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{task.name}</CardTitle>
                      <Badge variant="outline" className="text-xs">
                        <Clock className="size-3 mr-1" />
                        {new Date(task.createTime).toLocaleString("zh-CN")}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-muted-foreground">
                        提交人：{task.submitterId || "未知"} · 流程实例：{task.processInstanceId.slice(-8)}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setDetailTaskId(task.id)}
                        >
                          <FileText className="size-3.5 mr-1" />
                          查看表单
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => navigate(`/apps/${appId}/process-instances/${task.processInstanceId}`)}
                        >
                          <Eye className="size-3.5 mr-1" />
                          流程
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleReject(task.id)}>
                          <XCircle className="size-3.5 mr-1" />
                          驳回
                        </Button>
                        <Button size="sm" onClick={() => handleComplete(task.id)}>
                          <CheckCircle className="size-3.5 mr-1" />
                          通过
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
        <TabsContent value="done">
          <p className="text-sm text-muted-foreground py-12 text-center">已处理任务列表待实现</p>
        </TabsContent>
      </Tabs>

      {/* 任务详情弹窗：展示表单数据并按字段权限过滤 */}
      <Dialog open={!!detailTaskId} onOpenChange={(open) => !open && setDetailTaskId(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="size-4" />
              {detail?.task?.name || "任务详情"}
            </DialogTitle>
            <DialogDescription>
              {detail?.task?.taskDefinitionKey && (
                <span>任务节点：{detail.task.taskDefinitionKey} · </span>
              )}
              {permission.hidden.size > 0 ? (
                <span className="text-amber-600">
                  已按当前角色权限隐藏 {permission.hidden.size} 个字段（共 {totalFields} 个，渲染 {renderedCount} 个）
                </span>
              ) : (
                <span>共 {totalFields} 个字段</span>
              )}
            </DialogDescription>
          </DialogHeader>

          {detailLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : detail ? (
            <div className="space-y-3">
              {Object.keys(values).length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">表单无提交数据</p>
              ) : (
                Object.entries(values)
                  .filter(([key]) => shouldRenderField(key, permission))
                  .map(([key, value]) => {
                    const editable = isFieldEditable(key, permission);
                    return (
                      <div key={key} className="space-y-1">
                        <Label className="text-xs text-muted-foreground flex items-center gap-1">
                          {key}
                          {permission.hidden.has(key) && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0">hidden</Badge>
                          )}
                          {!editable && (
                            <Badge variant="secondary" className="text-[10px] px-1 py-0">只读</Badge>
                          )}
                        </Label>
                        {typeof value === "string" && value.length > 100 ? (
                          <Textarea
                            value={value}
                            readOnly={!editable}
                            disabled={!editable}
                            rows={3}
                          />
                        ) : (
                          <Input
                            value={String(value ?? "")}
                            readOnly={!editable}
                            disabled={!editable}
                          />
                        )}
                      </div>
                    );
                  })
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-8 text-center">加载失败</p>
          )}

          <DialogFooter className="gap-2 mt-2">
            {detail && detailTaskId && (
              <>
                <Button
                  variant="outline"
                  onClick={() => handleReject(detailTaskId)}
                >
                  <XCircle className="size-3.5 mr-1" />
                  驳回
                </Button>
                <Button onClick={() => handleComplete(detailTaskId)}>
                  <CheckCircle className="size-3.5 mr-1" />
                  通过
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
