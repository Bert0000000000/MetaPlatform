import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listObjectTypes } from "../api/ontologyApi";
import { ObjectTypeSummary } from "../types/schema";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

/* -- template definitions -- */
interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  objectTypes: string[];
  fields: Record<string, string[]>;
  installed: boolean;
}

const TEMPLATES: Template[] = [
  {
    id: "tpl-manufacturing",
    name: "制造管理",
    description: "生产订单、物料清单、质检记录、设备维护",
    category: "制造",
    icon: "\u{1F3ED}",
    objectTypes: ["生产订单", "物料清单", "质检记录", "设备维护"],
    fields: {
      "生产订单": ["订单编号", "产品名称", "数量", "计划开始", "计划结束", "状态"],
      "物料清单": ["物料编码", "物料名称", "规格", "单位", "库存数量", "安全库存"],
      "质检记录": ["质检编号", "批次号", "检验项目", "检验结果", "检验员", "检验日期"],
      "设备维护": ["设备编号", "设备名称", "维护类型", "维护日期", "维护人员", "下次维护"],
    },
    installed: false,
  },
  {
    id: "tpl-healthcare",
    name: "医疗健康",
    description: "患者档案、诊疗记录、药品管理、预约排班",
    category: "医疗",
    icon: "\u{1F3E5}",
    objectTypes: ["患者档案", "诊疗记录", "药品管理", "预约排班"],
    fields: {
      "患者档案": ["姓名", "身份证号", "性别", "出生日期", "联系电话", "过敏史"],
      "诊疗记录": ["病历号", "患者", "诊断", "处方", "医生", "就诊日期"],
      "药品管理": ["药品编码", "药品名称", "规格", "库存", "有效期", "供应商"],
      "预约排班": ["预约编号", "患者", "医生", "科室", "预约时间", "状态"],
    },
    installed: false,
  },
  {
    id: "tpl-finance",
    name: "金融服务",
    description: "客户KYC、贷款申请、风险评估、合规审查",
    category: "金融",
    icon: "\u{1F4B0}",
    objectTypes: ["客户KYC", "贷款申请", "风险评估", "合规审查"],
    fields: {
      "客户KYC": ["客户姓名", "证件类型", "证件号", "风险等级", "KYC状态", "更新日期"],
      "贷款申请": ["申请编号", "申请人", "贷款金额", "贷款期限", "利率", "审批状态"],
      "风险评估": ["评估编号", "评估对象", "风险类型", "风险等级", "评估得分", "评估日期"],
      "合规审查": ["审查编号", "审查类型", "审查对象", "审查结果", "审查员", "审查日期"],
    },
    installed: false,
  },
  {
    id: "tpl-retail",
    name: "零售电商",
    description: "商品管理、订单处理、会员管理、促销活动",
    category: "零售",
    icon: "\u{1F6D2}",
    objectTypes: ["商品管理", "订单处理", "会员管理", "促销活动"],
    fields: {
      "商品管理": ["商品编码", "商品名称", "分类", "价格", "库存", "上架状态"],
      "订单处理": ["订单编号", "客户", "商品", "金额", "支付状态", "物流状态"],
      "会员管理": ["会员号", "姓名", "等级", "积分", "注册日期", "消费总额"],
      "促销活动": ["活动名称", "开始日期", "结束日期", "折扣率", "适用商品", "状态"],
    },
    installed: false,
  },
  {
    id: "tpl-project",
    name: "项目管理",
    description: "项目立项、任务分解、里程碑、资源分配",
    category: "通用",
    icon: "\u{1F4CB}",
    objectTypes: ["项目立项", "任务管理", "里程碑", "资源分配"],
    fields: {
      "项目立项": ["项目名称", "项目经理", "开始日期", "结束日期", "预算", "状态"],
      "任务管理": ["任务名称", "负责人", "优先级", "预计工时", "完成百分比", "截止日期"],
      "里程碑": ["里程碑名称", "关联项目", "目标日期", "实际日期", "状态"],
      "资源分配": ["资源名称", "类型", "分配项目", "开始日期", "结束日期", "利用率"],
    },
    installed: false,
  },
  {
    id: "tpl-hr",
    name: "人力资源",
    description: "员工档案、考勤管理、薪资管理、培训发展",
    category: "通用",
    icon: "\u{1F465}",
    objectTypes: ["员工档案", "考勤管理", "薪资管理", "培训发展"],
    fields: {
      "员工档案": ["姓名", "工号", "部门", "职位", "入职日期", "联系电话"],
      "考勤管理": ["员工", "日期", "上班时间", "下班时间", "加班时长", "状态"],
      "薪资管理": ["员工", "基本工资", "绩效奖金", "社保扣除", "实发工资", "发放月份"],
      "培训发展": ["培训名称", "讲师", "开始日期", "结束日期", "参训人数", "培训效果"],
    },
    installed: false,
  },
];

const CATEGORIES = ["全部", "制造", "医疗", "金融", "零售", "通用"];

/* -- main page -- */
const AppMarket: React.FC = () => {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<Template[]>(TEMPLATES);
  const [selectedCategory, setSelectedCategory] = useState("全部");
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [installing, setInstalling] = useState<string | null>(null);
  const [objectTypes, setObjectTypes] = useState<ObjectTypeSummary[]>([]);

  useEffect(() => {
    listObjectTypes().then(setObjectTypes).catch(() => {});
  }, []);

  const filtered = selectedCategory === "全部"
    ? templates
    : templates.filter(t => t.category === selectedCategory);

  const handleInstall = useCallback(async (tpl: Template) => {
    setInstalling(tpl.id);
    // TODO: Replace with real marketplace API when available
    // e.g. await marketplaceApi.installTemplate(tpl.id);
    await new Promise(r => setTimeout(r, 1000));
    setTemplates(prev => prev.map(t => t.id === tpl.id ? { ...t, installed: true } : t));
    setInstalling(null);
  }, []);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">应用市场</h1>
          <p className="text-sm text-muted-foreground mt-1">行业模板与场景方案，一键安装快速启动</p>
        </div>
      </div>

      {/* Category filters */}
      <div className="flex gap-2 flex-wrap">
        {CATEGORIES.map(cat => (
          <Button
            key={cat}
            variant={selectedCategory === cat ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedCategory(cat)}
          >
            {cat}
          </Button>
        ))}
      </div>

      {/* Template grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(tpl => (
          <Card
            key={tpl.id}
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => setSelectedTemplate(tpl)}
          >
            <CardContent className="p-5">
              <div className="flex items-start gap-3 mb-3">
                <div className="text-3xl">{tpl.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-base">{tpl.name}</div>
                  <div className="text-sm text-muted-foreground mt-1">{tpl.description}</div>
                </div>
              </div>
              <div className="flex items-center justify-between mt-4">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{tpl.category}</Badge>
                  <span className="text-xs text-muted-foreground">{tpl.objectTypes.length} 个对象</span>
                </div>
                {tpl.installed ? (
                  <Badge variant="default">已安装</Badge>
                ) : (
                  <Button
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); handleInstall(tpl); }}
                    disabled={installing === tpl.id}
                  >
                    {installing === tpl.id ? "安装中..." : "安装"}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Template detail dialog */}
      <Dialog open={!!selectedTemplate} onOpenChange={(open) => { if (!open) setSelectedTemplate(null); }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          {selectedTemplate && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{selectedTemplate.icon}</span>
                  <div>
                    <DialogTitle>{selectedTemplate.name}</DialogTitle>
                    <DialogDescription>{selectedTemplate.description}</DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-4">
                <h3 className="text-sm font-semibold">包含的业务对象</h3>
                <div className="space-y-3">
                  {selectedTemplate.objectTypes.map(ot => (
                    <div key={ot} className="rounded-md border p-3">
                      <div className="font-medium mb-2">{ot}</div>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedTemplate.fields[ot]?.map(f => (
                          <Badge key={f} variant="outline" className="text-xs">{f}</Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <h3 className="text-sm font-semibold mt-4">安装说明</h3>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  <li>将自动创建 {selectedTemplate.objectTypes.length} 个 ObjectType</li>
                  <li>每个对象包含预定义的字段和生命周期</li>
                  <li>自动生成 TABLE 和 FORM 页面配置</li>
                  <li>安装后可在「建模特工场」中自定义修改</li>
                </ul>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setSelectedTemplate(null)}>关闭</Button>
                {selectedTemplate.installed ? (
                  <Button onClick={() => { setSelectedTemplate(null); navigate("/workshop"); }}>
                    前往建模特工场
                  </Button>
                ) : (
                  <Button
                    onClick={() => { handleInstall(selectedTemplate); }}
                    disabled={installing === selectedTemplate.id}
                  >
                    {installing === selectedTemplate.id ? "安装中..." : "立即安装"}
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AppMarket;
