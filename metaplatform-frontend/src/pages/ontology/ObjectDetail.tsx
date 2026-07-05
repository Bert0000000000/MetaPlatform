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
  Calculator, CheckCircle2, Loader2, AlertCircle, Edit, Regex, Ruler,
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
    regex: "",
    minLength: "",
    maxLength: "",
  });

  // Actions tab state & mock data
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [actionForm, setActionForm] = useState({ name: "", type: "CRUD", trigger: "" });
  const MOCK_ACTIONS = [
    { id: "act-1", name: "创建记录", type: "CRUD", trigger: "表单提交", status: "active" },
    { id: "act-2", name: "更新记录", type: "CRUD", trigger: "表单提交", status: "active" },
    { id: "act-3", name: "删除记录", type: "CRUD", trigger: "按钮点击", status: "active" },
    { id: "act-4", name: "查询记录", type: "CRUD", trigger: "页面加载", status: "active" },
    { id: "act-5", name: "批量导入", type: "Custom", trigger: "手动执行", status: "draft" },
  ];
  const [actions] = useState(MOCK_ACTIONS);

  // Rules tab state & mock data
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false);
  const [ruleForm, setRuleForm] = useState({ name: "", type: "Validation", condition: "" });
  const MOCK_RULES = [
    { id: "rule-1", name: "数据校验", type: "Validation", condition: "字段非空且格式正确", status: "active" },
    { id: "rule-2", name: "自动计算", type: "Calculation", condition: "金额 = 单价 * 数量", status: "active" },
    { id: "rule-3", name: "状态流转", type: "Trigger", condition: "审批通过后状态变为已完成", status: "active" },
    { id: "rule-4", name: "通知触发", type: "Trigger", condition: "创建记录后通知相关人", status: "draft" },
  ];
  const [rules] = useState(MOCK_RULES);

  // Relations tab state & mock data
  const [relationDialogOpen, setRelationDialogOpen] = useState(false);
  const [relationForm, setRelationForm] = useState({ target: "", type: "1:N", description: "" });
  const MOCK_RELATIONS = [
    { id: "rel-1", target: "订单", type: "1:N", description: "一个客户拥有多个订单" },
    { id: "rel-2", target: "联系人", type: "1:N", description: "一个客户拥有多个联系人" },
    { id: "rel-3", target: "合同", type: "N:N", description: "客户与合同多对多关系" },
    { id: "rel-4", target: "地址", type: "1:1", description: "一个客户对应一个主地址" },
  ];
  const [relations] = useState(MOCK_RELATIONS);

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
      setPropForm({ name: "", label: "", type: "短文本", required: false, regex: "", minLength: "", maxLength: "" });
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
            本体对象详情 · {properties.length} 个属性 · {actions.length} 个动作 · {rules.length} 个规则
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
          <TabsTrigger value="actions"><Zap className="size-3 mr-1" />动作 ({actions.length})</TabsTrigger>
          <TabsTrigger value="rules"><Calculator className="size-3 mr-1" />规则 ({rules.length})</TabsTrigger>
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

        {/* Actions Tab */}
        <TabsContent value="actions" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-base">动作</CardTitle>
                <CardDescription>CRUD 动作 + 自定义动作（{actions.length} 个）</CardDescription>
              </div>
              <Button size="sm" onClick={() => setActionDialogOpen(true)}>
                <Plus className="size-3 mr-1" />
                新建动作
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {actions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Zap className="size-8 mb-2 opacity-40" />
                  <p className="text-sm">暂无动作，点击「新建动作」添加</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>名称</TableHead>
                      <TableHead>类型</TableHead>
                      <TableHead>触发方式</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {actions.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium">{a.name}</TableCell>
                        <TableCell>
                          <Badge variant={a.type === "CRUD" ? "default" : "secondary"}>{a.type}</Badge>
                        </TableCell>
                        <TableCell>{a.trigger}</TableCell>
                        <TableCell>
                          <Badge variant={a.status === "active" ? "default" : "outline"}>
                            {a.status === "active" ? "已启用" : "草稿"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" className="size-8">
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

        {/* Rules Tab */}
        <TabsContent value="rules" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-base">业务规则</CardTitle>
                <CardDescription>Drools + DMN + 服务编排（{rules.length} 个）</CardDescription>
              </div>
              <Button size="sm" onClick={() => setRuleDialogOpen(true)}>
                <Plus className="size-3 mr-1" />
                新建规则
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {rules.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Calculator className="size-8 mb-2 opacity-40" />
                  <p className="text-sm">暂无规则，点击「新建规则」添加</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>名称</TableHead>
                      <TableHead>类型</TableHead>
                      <TableHead>条件</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rules.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.name}</TableCell>
                        <TableCell>
                          <Badge variant={r.type === "Validation" ? "default" : r.type === "Calculation" ? "secondary" : "outline"}>
                            {r.type === "Validation" ? "校验" : r.type === "Calculation" ? "计算" : "触发"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[300px] truncate">{r.condition}</TableCell>
                        <TableCell>
                          <Badge variant={r.status === "active" ? "default" : "outline"}>
                            {r.status === "active" ? "已启用" : "草稿"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" className="size-8">
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

        {/* Relations Tab */}
        <TabsContent value="links" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-base">关系</CardTitle>
                <CardDescription>对象间的关系建模（Neo4j 存储）· {relations.length} 个关系</CardDescription>
              </div>
              <Button size="sm" onClick={() => setRelationDialogOpen(true)}>
                <Plus className="size-3 mr-1" />
                新建关系
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {relations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Box className="size-8 mb-2 opacity-40" />
                  <p className="text-sm">暂无关系，点击「新建关系」添加</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>目标对象</TableHead>
                      <TableHead>关系类型</TableHead>
                      <TableHead>描述</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {relations.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.target}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{r.type}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{r.description}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" className="size-8">
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
            {/* F7.2.10 Validation Rules */}
            <div className="border-t pt-3 space-y-3">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                <Regex className="size-4" /> 格式校验规则
              </Label>
              <div className="space-y-2">
                <Label className="text-xs">正则表达式</Label>
                <Input
                  placeholder="e.g. ^[A-Z]{2}\d{6}$"
                  value={propForm.regex}
                  onChange={(e) => setPropForm({ ...propForm, regex: e.target.value })}
                  className="font-mono text-xs"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs">最小长度</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={propForm.minLength}
                    onChange={(e) => setPropForm({ ...propForm, minLength: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">最大长度</Label>
                  <Input
                    type="number"
                    placeholder="255"
                    value={propForm.maxLength}
                    onChange={(e) => setPropForm({ ...propForm, maxLength: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                {[
                  { label: "邮箱", regex: "^[\\w.-]+@[\\w.-]+\\.\\w+$" },
                  { label: "手机号", regex: "^1[3-9]\\d{9}$" },
                  { label: "身份证", regex: "^[1-9]\\d{5}(19|20)\\d{2}(0[1-9]|1[0-2])\\d{3}[\\dXx]$" },
                ].map((tpl) => (
                  <Button key={tpl.label} variant="outline" size="sm" className="text-xs" onClick={() => setPropForm({ ...propForm, regex: tpl.regex })}>
                    {tpl.label}
                  </Button>
                ))}
              </div>
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

      {/* New Action Dialog */}
      <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建动作</DialogTitle>
            <DialogDescription>为「{obj.label}」对象添加新动作</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>动作名称</Label>
              <Input placeholder="如：发送通知" value={actionForm.name} onChange={(e) => setActionForm({ ...actionForm, name: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>类型</Label>
              <Select value={actionForm.type} onValueChange={(val) => setActionForm({ ...actionForm, type: val })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CRUD">CRUD</SelectItem>
                  <SelectItem value="Custom">Custom（自定义）</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>触发方式</Label>
              <Input placeholder="如：表单提交、定时任务" value={actionForm.trigger} onChange={(e) => setActionForm({ ...actionForm, trigger: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialogOpen(false)}>取消</Button>
            <Button onClick={() => setActionDialogOpen(false)} disabled={!actionForm.name}>创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Rule Dialog */}
      <Dialog open={ruleDialogOpen} onOpenChange={setRuleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建规则</DialogTitle>
            <DialogDescription>为「{obj.label}」对象添加新业务规则</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>规则名称</Label>
              <Input placeholder="如：金额上限校验" value={ruleForm.name} onChange={(e) => setRuleForm({ ...ruleForm, name: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>类型</Label>
              <Select value={ruleForm.type} onValueChange={(val) => setRuleForm({ ...ruleForm, type: val })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Validation">Validation（校验）</SelectItem>
                  <SelectItem value="Calculation">Calculation（计算）</SelectItem>
                  <SelectItem value="Trigger">Trigger（触发）</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>条件表达式</Label>
              <Input placeholder="如：amount > 0 AND amount <= 10000" value={ruleForm.condition} onChange={(e) => setRuleForm({ ...ruleForm, condition: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRuleDialogOpen(false)}>取消</Button>
            <Button onClick={() => setRuleDialogOpen(false)} disabled={!ruleForm.name}>创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Relation Dialog */}
      <Dialog open={relationDialogOpen} onOpenChange={setRelationDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建关系</DialogTitle>
            <DialogDescription>为「{obj.label}」对象添加新的对象关系</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>目标对象</Label>
              <Input placeholder="如：订单" value={relationForm.target} onChange={(e) => setRelationForm({ ...relationForm, target: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>关系类型</Label>
              <Select value={relationForm.type} onValueChange={(val) => setRelationForm({ ...relationForm, type: val })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1:N">1:N（一对多）</SelectItem>
                  <SelectItem value="N:N">N:N（多对多）</SelectItem>
                  <SelectItem value="1:1">1:1（一对一）</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>描述</Label>
              <Input placeholder="如：一个客户拥有多个订单" value={relationForm.description} onChange={(e) => setRelationForm({ ...relationForm, description: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRelationDialogOpen(false)}>取消</Button>
            <Button onClick={() => setRelationDialogOpen(false)} disabled={!relationForm.target}>创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
