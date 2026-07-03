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
    name: "\u5236\u9020\u7BA1\u7406",
    description: "\u751F\u4EA7\u8BA2\u5355\u3001\u7269\u6599\u6E05\u5355\u3001\u8D28\u68C0\u8BB0\u5F55\u3001\u8BBE\u5907\u7EF4\u62A4",
    category: "\u5236\u9020",
    icon: "\u{1F3ED}",
    objectTypes: ["\u751F\u4EA7\u8BA2\u5355", "\u7269\u6599\u6E05\u5355", "\u8D28\u68C0\u8BB0\u5F55", "\u8BBE\u5907\u7EF4\u62A4"],
    fields: {
      "\u751F\u4EA7\u8BA2\u5355": ["\u8BA2\u5355\u7F16\u53F7", "\u4EA7\u54C1\u540D\u79F0", "\u6570\u91CF", "\u8BA1\u5212\u5F00\u59CB", "\u8BA1\u5212\u7ED3\u675F", "\u72B6\u6001"],
      "\u7269\u6599\u6E05\u5355": ["\u7269\u6599\u7F16\u7801", "\u7269\u6599\u540D\u79F0", "\u89C4\u683C", "\u5355\u4F4D", "\u5E93\u5B58\u6570\u91CF", "\u5B89\u5168\u5E93\u5B58"],
      "\u8D28\u68C0\u8BB0\u5F55": ["\u8D28\u68C0\u7F16\u53F7", "\u6279\u6B21\u53F7", "\u68C0\u9A8C\u9879\u76EE", "\u68C0\u9A8C\u7ED3\u679C", "\u68C0\u9A8C\u5458", "\u68C0\u9A8C\u65E5\u671F"],
      "\u8BBE\u5907\u7EF4\u62A4": ["\u8BBE\u5907\u7F16\u53F7", "\u8BBE\u5907\u540D\u79F0", "\u7EF4\u62A4\u7C7B\u578B", "\u7EF4\u62A4\u65E5\u671F", "\u7EF4\u62A4\u4EBA\u5458", "\u4E0B\u6B21\u7EF4\u62A4"],
    },
    installed: false,
  },
  {
    id: "tpl-healthcare",
    name: "\u533B\u7597\u5065\u5EB7",
    description: "\u60A3\u8005\u6863\u6848\u3001\u8BCA\u7597\u8BB0\u5F55\u3001\u836F\u54C1\u7BA1\u7406\u3001\u9884\u7EA6\u6392\u73ED",
    category: "\u533B\u7597",
    icon: "\u{1F3E5}",
    objectTypes: ["\u60A3\u8005\u6863\u6848", "\u8BCA\u7597\u8BB0\u5F55", "\u836F\u54C1\u7BA1\u7406", "\u9884\u7EA6\u6392\u73ED"],
    fields: {
      "\u60A3\u8005\u6863\u6848": ["\u59D3\u540D", "\u8EAB\u4EFD\u8BC1\u53F7", "\u6027\u522B", "\u51FA\u751F\u65E5\u671F", "\u8054\u7CFB\u7535\u8BDD", "\u8FC7\u654F\u53F2"],
      "\u8BCA\u7597\u8BB0\u5F55": ["\u75C5\u5386\u53F7", "\u60A3\u8005", "\u8BCA\u65AD", "\u5904\u65B9", "\u533B\u751F", "\u5C31\u8BCA\u65E5\u671F"],
      "\u836F\u54C1\u7BA1\u7406": ["\u836F\u54C1\u7F16\u7801", "\u836F\u54C1\u540D\u79F0", "\u89C4\u683C", "\u5E93\u5B58", "\u6709\u6548\u671F", "\u4F9B\u5E94\u5546"],
      "\u9884\u7EA6\u6392\u73ED": ["\u9884\u7EA6\u7F16\u53F7", "\u60A3\u8005", "\u533B\u751F", "\u79D1\u5BA4", "\u9884\u7EA6\u65F6\u95F4", "\u72B6\u6001"],
    },
    installed: false,
  },
  {
    id: "tpl-finance",
    name: "\u91D1\u878D\u670D\u52A1",
    description: "\u5BA2\u6237KYC\u3001\u8D37\u6B3E\u7533\u8BF7\u3001\u98CE\u9669\u8BC4\u4F30\u3001\u5408\u89C4\u5BA1\u67E5",
    category: "\u91D1\u878D",
    icon: "\u{1F4B0}",
    objectTypes: ["\u5BA2\u6237KYC", "\u8D37\u6B3E\u7533\u8BF7", "\u98CE\u9669\u8BC4\u4F30", "\u5408\u89C4\u5BA1\u67E5"],
    fields: {
      "\u5BA2\u6237KYC": ["\u5BA2\u6237\u59D3\u540D", "\u8BC1\u4EF6\u7C7B\u578B", "\u8BC1\u4EF6\u53F7", "\u98CE\u9669\u7B49\u7EA7", "KYC\u72B6\u6001", "\u66F4\u65B0\u65E5\u671F"],
      "\u8D37\u6B3E\u7533\u8BF7": ["\u7533\u8BF7\u7F16\u53F7", "\u7533\u8BF7\u4EBA", "\u8D37\u6B3E\u91D1\u989D", "\u8D37\u6B3E\u671F\u9650", "\u5229\u7387", "\u5BA1\u6279\u72B6\u6001"],
      "\u98CE\u9669\u8BC4\u4F30": ["\u8BC4\u4F30\u7F16\u53F7", "\u8BC4\u4F30\u5BF9\u8C61", "\u98CE\u9669\u7C7B\u578B", "\u98CE\u9669\u7B49\u7EA7", "\u8BC4\u4F30\u5F97\u5206", "\u8BC4\u4F30\u65E5\u671F"],
      "\u5408\u89C4\u5BA1\u67E5": ["\u5BA1\u67E5\u7F16\u53F7", "\u5BA1\u67E5\u7C7B\u578B", "\u5BA1\u67E5\u5BF9\u8C61", "\u5BA1\u67E5\u7ED3\u679C", "\u5BA1\u67E5\u5458", "\u5BA1\u67E5\u65E5\u671F"],
    },
    installed: false,
  },
  {
    id: "tpl-retail",
    name: "\u96F6\u552E\u7535\u5546",
    description: "\u5546\u54C1\u7BA1\u7406\u3001\u8BA2\u5355\u5904\u7406\u3001\u4F1A\u5458\u7BA1\u7406\u3001\u4FC3\u9500\u6D3B\u52A8",
    category: "\u96F6\u552E",
    icon: "\u{1F6D2}",
    objectTypes: ["\u5546\u54C1\u7BA1\u7406", "\u8BA2\u5355\u5904\u7406", "\u4F1A\u5458\u7BA1\u7406", "\u4FC3\u9500\u6D3B\u52A8"],
    fields: {
      "\u5546\u54C1\u7BA1\u7406": ["\u5546\u54C1\u7F16\u7801", "\u5546\u54C1\u540D\u79F0", "\u5206\u7C7B", "\u4EF7\u683C", "\u5E93\u5B58", "\u4E0A\u67B6\u72B6\u6001"],
      "\u8BA2\u5355\u5904\u7406": ["\u8BA2\u5355\u7F16\u53F7", "\u5BA2\u6237", "\u5546\u54C1", "\u91D1\u989D", "\u652F\u4ED8\u72B6\u6001", "\u7269\u6D41\u72B6\u6001"],
      "\u4F1A\u5458\u7BA1\u7406": ["\u4F1A\u5458\u53F7", "\u59D3\u540D", "\u7B49\u7EA7", "\u79EF\u5206", "\u6CE8\u518C\u65E5\u671F", "\u6D88\u8D39\u603B\u989D"],
      "\u4FC3\u9500\u6D3B\u52A8": ["\u6D3B\u52A8\u540D\u79F0", "\u5F00\u59CB\u65E5\u671F", "\u7ED3\u675F\u65E5\u671F", "\u6298\u6263\u7387", "\u9002\u7528\u5546\u54C1", "\u72B6\u6001"],
    },
    installed: false,
  },
  {
    id: "tpl-project",
    name: "\u9879\u76EE\u7BA1\u7406",
    description: "\u9879\u76EE\u7ACB\u9879\u3001\u4EFB\u52A1\u5206\u89E3\u3001\u91CC\u7A0B\u7891\u3001\u8D44\u6E90\u5206\u914D",
    category: "\u901A\u7528",
    icon: "\u{1F4CB}",
    objectTypes: ["\u9879\u76EE\u7ACB\u9879", "\u4EFB\u52A1\u7BA1\u7406", "\u91CC\u7A0B\u7891", "\u8D44\u6E90\u5206\u914D"],
    fields: {
      "\u9879\u76EE\u7ACB\u9879": ["\u9879\u76EE\u540D\u79F0", "\u9879\u76EE\u7ECF\u7406", "\u5F00\u59CB\u65E5\u671F", "\u7ED3\u675F\u65E5\u671F", "\u9884\u7B97", "\u72B6\u6001"],
      "\u4EFB\u52A1\u7BA1\u7406": ["\u4EFB\u52A1\u540D\u79F0", "\u8D1F\u8D23\u4EBA", "\u4F18\u5148\u7EA7", "\u9884\u8BA1\u5DE5\u65F6", "\u5B8C\u6210\u767E\u5206\u6BD4", "\u622A\u6B62\u65E5\u671F"],
      "\u91CC\u7A0B\u7891": ["\u91CC\u7A0B\u7891\u540D\u79F0", "\u5173\u8054\u9879\u76EE", "\u76EE\u6807\u65E5\u671F", "\u5B9E\u9645\u65E5\u671F", "\u72B6\u6001"],
      "\u8D44\u6E90\u5206\u914D": ["\u8D44\u6E90\u540D\u79F0", "\u7C7B\u578B", "\u5206\u914D\u9879\u76EE", "\u5F00\u59CB\u65E5\u671F", "\u7ED3\u675F\u65E5\u671F", "\u5229\u7528\u7387"],
    },
    installed: false,
  },
  {
    id: "tpl-hr",
    name: "\u4EBA\u529B\u8D44\u6E90",
    description: "\u5458\u5DE5\u6863\u6848\u3001\u8003\u52E4\u7BA1\u7406\u3001\u85AA\u8D44\u7BA1\u7406\u3001\u57F9\u8BAD\u53D1\u5C55",
    category: "\u901A\u7528",
    icon: "\u{1F465}",
    objectTypes: ["\u5458\u5DE5\u6863\u6848", "\u8003\u52E4\u7BA1\u7406", "\u85AA\u8D44\u7BA1\u7406", "\u57F9\u8BAD\u53D1\u5C55"],
    fields: {
      "\u5458\u5DE5\u6863\u6848": ["\u59D3\u540D", "\u5DE5\u53F7", "\u90E8\u95E8", "\u804C\u4F4D", "\u5165\u804C\u65E5\u671F", "\u8054\u7CFB\u7535\u8BDD"],
      "\u8003\u52E4\u7BA1\u7406": ["\u5458\u5DE5", "\u65E5\u671F", "\u4E0A\u73ED\u65F6\u95F4", "\u4E0B\u73ED\u65F6\u95F4", "\u52A0\u73ED\u65F6\u957F", "\u72B6\u6001"],
      "\u85AA\u8D44\u7BA1\u7406": ["\u5458\u5DE5", "\u57FA\u672C\u5DE5\u8D44", "\u7EE9\u6548\u5956\u91D1", "\u793E\u4FDD\u6263\u9664", "\u5B9E\u53D1\u5DE5\u8D44", "\u53D1\u653E\u6708\u4EFD"],
      "\u57F9\u8BAD\u53D1\u5C55": ["\u57F9\u8BAD\u540D\u79F0", "\u8BB2\u5E08", "\u5F00\u59CB\u65E5\u671F", "\u7ED3\u675F\u65E5\u671F", "\u53C2\u8BAD\u4EBA\u6570", "\u57F9\u8BAD\u6548\u679C"],
    },
    installed: false,
  },
];

const CATEGORIES = ["\u5168\u90E8", "\u5236\u9020", "\u533B\u7597", "\u91D1\u878D", "\u96F6\u552E", "\u901A\u7528"];

/* -- main page -- */
const AppMarket: React.FC = () => {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<Template[]>(TEMPLATES);
  const [selectedCategory, setSelectedCategory] = useState("\u5168\u90E8");
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [installing, setInstalling] = useState<string | null>(null);
  const [objectTypes, setObjectTypes] = useState<ObjectTypeSummary[]>([]);

  useEffect(() => {
    listObjectTypes().then(setObjectTypes).catch(() => {});
  }, []);

  const filtered = selectedCategory === "\u5168\u90E8"
    ? templates
    : templates.filter(t => t.category === selectedCategory);

  const handleInstall = useCallback(async (tpl: Template) => {
    setInstalling(tpl.id);
    // Simulate installation by checking if object types already exist
    await new Promise(r => setTimeout(r, 1000));
    setTemplates(prev => prev.map(t => t.id === tpl.id ? { ...t, installed: true } : t));
    setInstalling(null);
  }, []);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">应用市场</h1>
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
