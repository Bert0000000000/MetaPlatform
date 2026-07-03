import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { ontologyApi, type OntologyObject, type OntologyProperty } from "@/lib/api";
import {
  ChevronLeft, Plus, Hash, Settings, Sparkles, Save, Trash2, Shield, Box, Zap,
  Calculator, CheckCircle2, Loader2, AlertCircle, Edit,
  User, Package, Tag, Users, FileText, Receipt,
} from "lucide-react";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  User, Package, Tag, Users, FileText, Receipt, Box, Settings,
};

function DynamicIcon({ name, className }: { name?: string; className?: string }) {
  if (name && ICON_MAP[name]) {
    const Icon = ICON_MAP[name];
    return <Icon className={className} />;
  }
  return <Box className={className} />;
}

const PROPERTY_TYPES = [
  "短文本", "长文本", "数字", "整数", "小数", "百分比",
  "金额", "日期", "日期时间", "时间", "枚举", "布尔",
  "邮箱", "手机号", "电话", "地址", "URL", "自动编号",
  "人员", "部门", "附件", "评分", "颜色", "JSON",
];

export default function ObjectDetail() {
  const { objectId } = useParams<{ objectId: string }>();
  const [obj, setObj] = useState<(OntologyObject & { properties?: OntologyProperty[] }) | null>(null);
  const [properties, setProperties] = useState<OntologyProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New property dialog
  const [propDialogOpen, setPropDialogOpen] = useState(false);
  const [propCreating, setPropCreating] = useState(false);
  const [propForm, setPropForm] = useState({
    name: "",
    label: "",
    type: "短文本",
    required: false,
  });

  const fetchData = useCallback(async () => {
    if (!objectId) return;
    try {
      setLoading(true);
      setError(null);
      const data = await ontologyApi.getObject(objectId);
      setObj(data);
      setProperties(data.properties || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [objectId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreateProperty = async () => {
    if (!objectId || !propForm.name || !propForm.label) return;
    try {
      setPropCreating(true);
      await ontologyApi.createProperty(objectId, {
        name: propForm.name,
        label: propForm.label,
        type: propForm.type,
        required: propForm.required ? 1 : 0,
      });
      setPropDialogOpen(false);
      setPropForm({ name: "", label: "", type: "短文本", required: false });
      await fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "创建属性失败");
    } finally {
      setPropCreating(false);
    }
  };

  const handleDeleteProperty = async (propId: string, propLabel: string) => {
    if (!confirm(`确定删除属性「${propLabel}」？`)) return;
    try {
      await ontologyApi.deleteProperty(propId);
      await fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "删除属性失败");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="size-6 animate-spin mr-2" /> 加载对象详情...
      </div>
    );
  }

  if (error || !obj) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <AlertCircle className="size-10 text-destructive" />
        <p className="text-sm text-muted-foreground">{error || "未找到对象"}</p>
        <Link to="/ontology">
          <Button variant="outline" size="sm">返回列表</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Link to="/ontology">
          <Button variant="ghost" size="icon"><ChevronLeft className="size-4" /></Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <DynamicIcon name={obj.icon} className="size-5" />
            {obj.label} ({obj.name})
            <Badge variant={obj.status === "active" ? "default" : "secondary"}>
              {obj.status === "active" ? "已激活" : obj.status}
            </Badge>
          </h1>
          <p className="text-sm text-muted-foreground">
            本体对象详情 · {properties.length} 个属性 · {obj.actions_count ?? 0} 个动作 · {obj.rules_count ?? 0} 个规则
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled><Sparkles className="size-3 mr-1" />AI 优化</Button>
          <Button variant="outline" size="sm" disabled><Settings className="size-3 mr-1" />配置</Button>
          <Button size="sm" disabled><Save className="size-3 mr-1" />保存</Button>
        </div>
      </div>

      <Tabs defaultValue="properties">
        <TabsList>
          <TabsTrigger value="properties"><Hash className="size-3 mr-1" />属性 ({properties.length})</TabsTrigger>
          <TabsTrigger value="actions"><Zap className="size-3 mr-1" />动作 ({obj.actions_count ?? 0})</TabsTrigger>
          <TabsTrigger value="rules"><Calculator className="size-3 mr-1" />规则 ({obj.rules_count ?? 0})</TabsTrigger>
          <TabsTrigger value="links"><Box className="size-3 mr-1" />关系</TabsTrigger>
          <TabsTrigger value="security"><Shield className="size-3 mr-1" />安全</TabsTrigger>
        </TabsList>

        {/* Properties Tab */}
        <TabsContent value="properties" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-base">属性定义</CardTitle>
                <CardDescription>{properties.length} 个属性</CardDescription>
              </div>
              <Button size="sm" onClick={() => setPropDialogOpen(true)}>
                <Plus className="size-3 mr-1" />
                新增属性
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {properties.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Hash className="size-8 mb-2 opacity-40" />
                  <p className="text-sm">暂无属性，点击「新增属性」添加</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>属性名</TableHead>
                      <TableHead>中文标签</TableHead>
                      <TableHead>类型</TableHead>
                      <TableHead>必填</TableHead>
                      <TableHead>唯一</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {properties.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-mono text-xs">{p.name}</TableCell>
                        <TableCell className="font-medium">{p.label}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{p.type}</Badge>
                        </TableCell>
                        <TableCell>{p.required ? <CheckCircle2 className="size-4 text-green-500" /> : "—"}</TableCell>
                        <TableCell>{p.unique_field ? <CheckCircle2 className="size-4 text-green-500" /> : "—"}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            onClick={() => handleDeleteProperty(p.id, p.label)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Actions Tab - Placeholder */}
        <TabsContent value="actions" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-base">动作</CardTitle>
                <CardDescription>CRUD 动作 + 自定义动作</CardDescription>
              </div>
              <Button size="sm" disabled>
                <Plus className="size-3 mr-1" />
                新增动作
              </Button>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Zap className="size-8 mb-2 opacity-40" />
                <p className="text-sm font-medium">动作管理即将上线</p>
                <p className="text-xs mt-1">该功能将由 Java 后端提供，支持 CRUD 动作和自定义动作配置</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Rules Tab - Placeholder */}
        <TabsContent value="rules" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-base">业务规则</CardTitle>
                <CardDescription>Drools + DMN + 服务编排</CardDescription>
              </div>
              <Button size="sm" disabled>
                <Plus className="size-3 mr-1" />
                新增规则
              </Button>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Calculator className="size-8 mb-2 opacity-40" />
                <p className="text-sm font-medium">规则引擎即将上线</p>
                <p className="text-xs mt-1">该功能将由 Java 后端 Drools 规则引擎提供，支持业务规则配置</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Relations Tab - Placeholder */}
        <TabsContent value="links" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">关系</CardTitle>
              <CardDescription>对象间的关系建模（Neo4j 存储）</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Box className="size-8 mb-2 opacity-40" />
                <p className="text-sm font-medium">关系管理即将上线</p>
                <p className="text-xs mt-1">该功能将由 Java 后端提供，支持 Neo4j 图数据库关系建模</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab - Placeholder */}
        <TabsContent value="security" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">数据权限（行级）</CardTitle>
                <CardDescription>控制用户能看哪些数据</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <Shield className="size-6 mb-2 opacity-40" />
                  <p className="text-xs">行级权限配置即将由后端提供</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">字段级权限</CardTitle>
                <CardDescription>敏感字段脱敏</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <Shield className="size-6 mb-2 opacity-40" />
                  <p className="text-xs">字段级权限配置即将由后端提供</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* New Property Dialog */}
      <Dialog open={propDialogOpen} onOpenChange={setPropDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新增属性</DialogTitle>
            <DialogDescription>为「{obj.label}」对象添加新属性</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="prop-name">属性名（英文标识）</Label>
              <Input
                id="prop-name"
                placeholder="e.g. customer_code"
                value={propForm.name}
                onChange={(e) => setPropForm({ ...propForm, name: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="prop-label">中文标签</Label>
              <Input
                id="prop-label"
                placeholder="e.g. 客户编号"
                value={propForm.label}
                onChange={(e) => setPropForm({ ...propForm, label: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label>类型</Label>
              <Select
                value={propForm.type}
                onValueChange={(val) => setPropForm({ ...propForm, type: val })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择类型" />
                </SelectTrigger>
                <SelectContent>
                  {PROPERTY_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="prop-required"
                checked={propForm.required}
                onCheckedChange={(checked) =>
                  setPropForm({ ...propForm, required: checked === true })
                }
              />
              <Label htmlFor="prop-required" className="cursor-pointer">必填</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPropDialogOpen(false)}>取消</Button>
            <Button
              onClick={handleCreateProperty}
              disabled={!propForm.name || !propForm.label || propCreating}
            >
              {propCreating && <Loader2 className="size-4 animate-spin mr-1" />}
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
