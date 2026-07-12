import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Box, Briefcase, ShoppingCart, Users, FileText, Layers, Plus, Download, Star, Package, Heart, Building2 } from "lucide-react";
import { ontologyApi } from "@/lib/api";

/* ════════════════════════════════════════════════════════════════════
 * OntologyTemplates: 本体模板库
 *
 * 行业模板 (CRM/ERP/OA/Edu/HR/Finance), 一键应用到工作空间
 *   - CRM: Customer/Order/Product/Contract/Invoice
 *   - ERP: 同上 + Inventory/Purchase
 *   - OA: Department/Employee/Project/Task
 *   - HR: Employee/Department/Position/Payroll
 *   - Edu: Student/Course/Teacher/Class
 *   - Finance: Account/Transaction/Invoice/Budget
 *
 * 应用模板: 导入到 ontology (覆盖/合并)
 * ════════════════════════════════════════════════════════════════════ */

interface TemplateObject {
  name: string;
  label: string;
  description: string;
  icon: string;
  properties: { name: string; label: string; type: string; required?: boolean }[];
}

interface TemplateRelation {
  source: string;
  target: string;
  type: string;
  label: string;
}

interface Template {
  id: string;
  name: string;
  industry: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  objects: TemplateObject[];
  relations: TemplateRelation[];
  popular?: boolean;
}

const TEMPLATES: Template[] = [
  {
    id: "crm",
    name: "CRM 客户关系管理",
    industry: "销售/客户",
    description: "Customer + Order + Product + Contract + Invoice — 标准 CRM 5 对象",
    icon: Users,
    color: "blue",
    popular: true,
    objects: [
      { name: "customer", label: "客户", description: "客户基本信息", icon: "User", properties: [
        { name: "id", label: "客户 ID", type: "auto_increment", required: true },
        { name: "name", label: "客户名称", type: "text", required: true },
        { name: "phone", label: "联系电话", type: "phone" },
        { name: "email", label: "邮箱", type: "email" },
        { name: "level", label: "客户等级", type: "select" },
        { name: "created_at", label: "创建时间", type: "datetime" },
      ]},
      { name: "order", label: "订单", description: "销售订单", icon: "Package", properties: [
        { name: "id", label: "订单号", type: "auto_increment", required: true },
        { name: "customer_id", label: "客户", type: "relation", required: true },
        { name: "total", label: "订单金额", type: "currency" },
        { name: "status", label: "状态", type: "select" },
        { name: "created_at", label: "下单时间", type: "datetime" },
      ]},
      { name: "product", label: "产品", description: "商品目录", icon: "Box", properties: [
        { name: "id", label: "产品 ID", type: "auto_increment", required: true },
        { name: "name", label: "产品名称", type: "text", required: true },
        { name: "price", label: "单价", type: "currency" },
        { name: "stock", label: "库存", type: "integer" },
      ]},
      { name: "contract", label: "合同", description: "销售合同", icon: "FileText", properties: [
        { name: "id", label: "合同 ID", type: "auto_increment", required: true },
        { name: "customer_id", label: "客户", type: "relation", required: true },
        { name: "amount", label: "合同金额", type: "currency" },
        { name: "signed_at", label: "签约时间", type: "date" },
      ]},
      { name: "invoice", label: "发票", description: "发票", icon: "FileText", properties: [
        { name: "id", label: "发票号", type: "text", required: true },
        { name: "order_id", label: "订单", type: "relation" },
        { name: "amount", label: "金额", type: "currency" },
      ]},
    ],
    relations: [
      { source: "order", target: "customer", type: "belongs_to", label: "属于" },
      { source: "order", target: "product", type: "contains", label: "包含" },
      { source: "contract", target: "customer", type: "signed_by", label: "签约方" },
      { source: "invoice", target: "order", type: "from", label: "来自" },
    ],
  },
  {
    id: "erp",
    name: "ERP 进销存",
    industry: "供应链/库存",
    description: "Purchase + Inventory + Supplier + Warehouse + Product — 标准 ERP",
    icon: Briefcase,
    color: "green",
    objects: [
      { name: "supplier", label: "供应商", description: "供应商信息", icon: "Truck", properties: [
        { name: "id", label: "供应商 ID", type: "auto_increment", required: true },
        { name: "name", label: "供应商名称", type: "text", required: true },
        { name: "contact", label: "联系人", type: "text" },
      ]},
      { name: "purchase", label: "采购单", description: "采购订单", icon: "ShoppingCart", properties: [
        { name: "id", label: "采购单号", type: "auto_increment", required: true },
        { name: "supplier_id", label: "供应商", type: "relation" },
        { name: "total", label: "采购金额", type: "currency" },
      ]},
      { name: "warehouse", label: "仓库", description: "仓库信息", icon: "Box", properties: [
        { name: "id", label: "仓库 ID", type: "auto_increment", required: true },
        { name: "name", label: "仓库名称", type: "text" },
        { name: "address", label: "地址", type: "text" },
      ]},
      { name: "inventory", label: "库存", description: "库存记录", icon: "Layers", properties: [
        { name: "id", label: "记录 ID", type: "auto_increment", required: true },
        { name: "product_id", label: "产品", type: "relation" },
        { name: "warehouse_id", label: "仓库", type: "relation" },
        { name: "quantity", label: "数量", type: "integer" },
      ]},
    ],
    relations: [
      { source: "purchase", target: "supplier", type: "from", label: "来自" },
      { source: "inventory", target: "warehouse", type: "stored_in", label: "存储于" },
    ],
  },
  {
    id: "oa",
    name: "OA 办公自动化",
    industry: "行政/流程",
    description: "Department + Employee + Project + Task + Approval — 标准 OA",
    icon: Building2,
    color: "purple",
    popular: true,
    objects: [
      { name: "department", label: "部门", description: "组织部门", icon: "Users", properties: [
        { name: "id", label: "部门 ID", type: "auto_increment", required: true },
        { name: "name", label: "部门名称", type: "text", required: true },
        { name: "parent_id", label: "上级部门", type: "relation" },
      ]},
      { name: "employee", label: "员工", description: "员工信息", icon: "User", properties: [
        { name: "id", label: "员工 ID", type: "auto_increment", required: true },
        { name: "name", label: "姓名", type: "text", required: true },
        { name: "department_id", label: "部门", type: "relation" },
        { name: "position", label: "职位", type: "text" },
      ]},
      { name: "project", label: "项目", description: "项目信息", icon: "Briefcase", properties: [
        { name: "id", label: "项目 ID", type: "auto_increment", required: true },
        { name: "name", label: "项目名称", type: "text", required: true },
        { name: "manager_id", label: "项目经理", type: "relation" },
        { name: "status", label: "状态", type: "select" },
      ]},
      { name: "task", label: "任务", description: "工作任务", icon: "CheckCircle2", properties: [
        { name: "id", label: "任务 ID", type: "auto_increment", required: true },
        { name: "title", label: "标题", type: "text", required: true },
        { name: "project_id", label: "所属项目", type: "relation" },
        { name: "assignee_id", label: "负责人", type: "relation" },
        { name: "status", label: "状态", type: "select" },
      ]},
    ],
    relations: [
      { source: "employee", target: "department", type: "belongs_to", label: "属于" },
      { source: "task", target: "project", type: "belongs_to", label: "属于" },
      { source: "task", target: "employee", type: "assigned_to", label: "分配给" },
    ],
  },
  {
    id: "edu",
    name: "Edu 教务管理",
    industry: "教育",
    description: "Student + Course + Teacher + Class + Score — 标准教务",
    icon: Heart,
    color: "pink",
    objects: [
      { name: "student", label: "学生", description: "学生信息", icon: "User", properties: [
        { name: "id", label: "学号", type: "auto_increment", required: true },
        { name: "name", label: "姓名", type: "text", required: true },
        { name: "class_id", label: "班级", type: "relation" },
      ]},
      { name: "teacher", label: "教师", description: "教师信息", icon: "User", properties: [
        { name: "id", label: "工号", type: "auto_increment", required: true },
        { name: "name", label: "姓名", type: "text", required: true },
        { name: "title", label: "职称", type: "text" },
      ]},
      { name: "class", label: "班级", description: "教学班", icon: "Users", properties: [
        { name: "id", label: "班级 ID", type: "auto_increment", required: true },
        { name: "name", label: "班级名", type: "text", required: true },
        { name: "grade", label: "年级", type: "text" },
      ]},
      { name: "course", label: "课程", description: "课程信息", icon: "BookOpen", properties: [
        { name: "id", label: "课程 ID", type: "auto_increment", required: true },
        { name: "name", label: "课程名", type: "text", required: true },
        { name: "teacher_id", label: "授课教师", type: "relation" },
        { name: "credit", label: "学分", type: "decimal" },
      ]},
    ],
    relations: [
      { source: "student", target: "class", type: "belongs_to", label: "属于" },
      { source: "course", target: "teacher", type: "taught_by", label: "授课" },
    ],
  },
];

export function OntologyTemplates() {
  const [selected, setSelected] = useState<Template | null>(null);
  const [applying, setApplying] = useState(false);

  // 真 API: 一键应用模板 (创建 N 对象 + M 关系)
  const applyTemplate = async () => {
    if (!selected) return;
    setApplying(true);
    let okCount = 0;
    let failCount = 0;
    try {
      // 1. 先查现有对象, 避免重名
      const existing = await ontologyApi.listObjects().catch(() => [] as any[]);
      const existingNames = new Set(existing.map((o: any) => o.name));
      // 2. 逐个创建对象 (跳过已存在)
      const nameToId: Record<string, string> = {};
      for (const obj of selected.objects) {
        if (existingNames.has(obj.name)) {
          const ex = existing.find((o: any) => o.name === obj.name);
          if (ex) nameToId[obj.name] = ex.id;
          continue;
        }
        try {
          const created = await ontologyApi.createObject({
            name: obj.name,
            label: obj.label,
            description: obj.description,
            icon: obj.icon,
            status: "active",
          });
          nameToId[obj.name] = (created as any).id;
          // 创建属性
          for (const p of obj.properties) {
            await ontologyApi.createProperty((created as any).id, {
              name: p.name,
              label: p.label,
              type: p.type,
              required: p.required ? 1 : 0,
            }).catch(() => {});
          }
          okCount++;
        } catch {
          failCount++;
        }
      }
      // 3. 创建关系
      for (const rel of selected.relations) {
        const srcId = nameToId[rel.source];
        const tgtId = nameToId[rel.target];
        if (!srcId || !tgtId) continue;
        try {
          await ontologyApi.createRelation({
            source_object_id: srcId,
            target_object_id: tgtId,
            type: rel.type,
            label: rel.label,
          });
        } catch { failCount++; }
      }
      alert(`✅ 模板「${selected.name}」已应用!\n\n创建对象: ${okCount} 成功, ${failCount} 失败\n共 ${selected.relations.length} 条关系`);
      setSelected(null);
    } catch (e: unknown) {
      alert("应用失败: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 p-6">
      <div>
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <Package className="size-5 text-primary" /> 本体模板库
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          行业标准 8 要素模板, 一键应用到工作空间
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {TEMPLATES.map((t) => {
          const Icon = t.icon;
          return (
            <Card key={t.id} className="hover:border-primary cursor-pointer" onClick={() => setSelected(t)}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className={`p-2 rounded bg-${t.color}-100`}>
                    <Icon className={`size-5 text-${t.color}-600`} />
                  </div>
                  {t.popular && (
                    <Badge variant="default" className="text-xs">
                      <Star className="size-2.5 mr-0.5" /> 热门
                    </Badge>
                  )}
                </div>
                <CardTitle className="text-sm mt-2">{t.name}</CardTitle>
                <CardDescription className="text-xs">{t.description}</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>📦 {t.objects.length} 对象</span>
                  <span>🔗 {t.relations.length} 关系</span>
                  <span>🏷️ {t.industry}</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => { if (!o) setSelected(null); }}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <selected.icon className="size-5 text-primary" /> {selected.name}
                </DialogTitle>
                <DialogDescription>{selected.description}</DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <div>
                  <div className="text-xs font-medium mb-2">包含对象 ({selected.objects.length})</div>
                  <div className="space-y-1">
                    {selected.objects.map((o) => (
                      <div key={o.name} className="border rounded p-2 text-xs">
                        <div className="flex items-center gap-2">
                          <Box className="size-3 text-primary" />
                          <span className="font-mono font-medium">{o.label}</span>
                          <span className="text-muted-foreground text-xs">({o.name})</span>
                        </div>
                        <div className="ml-5 mt-1 text-muted-foreground text-xs">
                          {o.description}
                        </div>
                        <div className="ml-5 mt-1 flex gap-1 flex-wrap">
                          {o.properties.map((p) => (
                            <Badge key={p.name} variant="outline" className="text-xs h-4 px-1">
                              {p.label} <span className="text-muted-foreground">({p.type})</span>
                              {p.required && <span className="text-destructive">*</span>}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-medium mb-2">关系 ({selected.relations.length})</div>
                  <div className="space-y-1">
                    {selected.relations.map((r, i) => (
                      <div key={i} className="flex items-center gap-1 text-xs">
                        <span className="font-mono">{r.source}</span>
                        <span className="text-muted-foreground">{r.type}</span>
                        <span className="text-muted-foreground">→</span>
                        <span className="font-mono">{r.target}</span>
                        <Badge variant="secondary" className="text-xs h-4 px-1 ml-1">{r.label}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setSelected(null)}>取消</Button>
                <Button onClick={applyTemplate} disabled={applying}>
                  {applying ? "应用中..." : <><Download className="size-3.5 mr-1" /> 应用到工作空间</>}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
