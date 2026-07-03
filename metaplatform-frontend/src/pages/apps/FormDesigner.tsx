import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/stat";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save, Eye, Smartphone, Monitor, Tablet, Settings, Trash2, Copy, Plus, Type, Hash, Calendar, Mail, Phone, ListChecks, FileText, Upload, Star, Sliders, ToggleLeft, Sparkles, FileEdit, Clock, ClipboardList, Circle, CheckSquare, Paperclip, Image, PenTool, MapPin, TreeDeciduous } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface FieldDef {
  id: string;
  type: string;
  label: string;
  placeholder?: string;
  required: boolean;
  icon: LucideIcon;
  color: string;
}

const FIELD_LIBRARY: FieldDef[] = [
  { id: "single-text", type: "单行文本", label: "单行文本", required: false, icon: Type, color: "bg-blue-500" },
  { id: "multi-text", type: "多行文本", label: "多行文本", required: false, icon: FileEdit, color: "bg-green-500" },
  { id: "number", type: "数字", label: "数字", required: false, icon: Hash, color: "bg-purple-500" },
  { id: "date", type: "日期", label: "日期", required: false, icon: Calendar, color: "bg-orange-500" },
  { id: "datetime", type: "日期时间", label: "日期时间", required: false, icon: Clock, color: "bg-amber-500" },
  { id: "email", type: "邮箱", label: "邮箱", required: false, icon: Mail, color: "bg-cyan-500" },
  { id: "phone", type: "手机号", label: "手机号", required: false, icon: Smartphone, color: "bg-pink-500" },
  { id: "select", type: "下拉选择", label: "下拉选择", required: false, icon: ClipboardList, color: "bg-indigo-500" },
  { id: "radio", type: "单选", label: "单选", required: false, icon: Circle, color: "bg-red-500" },
  { id: "checkbox", type: "多选", label: "多选", required: false, icon: CheckSquare, color: "bg-emerald-500" },
  { id: "switch", type: "开关", label: "开关", required: false, icon: ToggleLeft, color: "bg-yellow-500" },
  { id: "slider", type: "滑块", label: "滑块", required: false, icon: Sliders, color: "bg-violet-500" },
  { id: "rating", type: "评分", label: "评分", required: false, icon: Star, color: "bg-rose-500" },
  { id: "file", type: "文件上传", label: "文件上传", required: false, icon: Paperclip, color: "bg-slate-500" },
  { id: "image", type: "图片上传", label: "图片上传", required: false, icon: Image, color: "bg-teal-500" },
  { id: "richtext", type: "富文本", label: "富文本", required: false, icon: PenTool, color: "bg-fuchsia-500" },
  { id: "address", type: "地址", label: "地址", required: false, icon: MapPin, color: "bg-sky-500" },
  { id: "cascader", type: "级联选择", label: "级联选择", required: false, icon: TreeDeciduous, color: "bg-lime-500" },
];

const INITIAL_FORM: { id: string; label: string; type: string; icon: LucideIcon }[] = [
  { id: "f1", label: "客户名称", type: "单行文本", icon: Type },
  { id: "f2", label: "客户编号", type: "单行文本", icon: Type },
  { id: "f3", label: "行业类型", type: "下拉选择", icon: ClipboardList },
  { id: "f4", label: "联系电话", type: "手机号", icon: Smartphone },
  { id: "f5", label: "邮箱", type: "邮箱", icon: Mail },
  { id: "f6", label: "客户等级", type: "单选", icon: Circle },
  { id: "f7", label: "重要程度", type: "评分", icon: Star },
  { id: "f8", label: "备注", type: "多行文本", icon: FileEdit },
];

export default function FormDesigner() {
  const [device, setDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [selectedField, setSelectedField] = useState<string | null>("f3");

  return (
    <div className="flex flex-col gap-4 h-[calc(100vh-180px)]">
      <PageHeader
        title="表单设计器"
        description="LowCode 拖拽式表单设计 · 客户管理表单"
        action={
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <Sparkles className="size-3 mr-1" />
              AI 生成
            </Button>
            <Button variant="outline" size="sm">
              <Eye className="size-3 mr-1" />
              预览
            </Button>
            <Button size="sm">
              <Save className="size-3 mr-1" />
              保存
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-12 gap-4 flex-1 min-h-0">
        {/* 字段库 */}
        <Card className="col-span-2 overflow-y-auto">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">字段库</CardTitle>
            <CardDescription className="text-xs">18 种字段类型</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {FIELD_LIBRARY.map((f) => (
                <div
                  key={f.id}
                  draggable
                  className="flex items-center gap-2 p-2 border rounded cursor-move hover:border-primary bg-white text-xs"
                >
                  <span className={`${f.color} size-6 rounded text-white flex items-center justify-center`}><f.icon className="size-3" /></span>
                  <span>{f.label}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 画布 */}
        <Card className="col-span-7 flex flex-col">
          <CardHeader className="border-b pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm">画布</CardTitle>
            <div className="flex items-center gap-2">
              <div className="flex gap-1 border rounded p-0.5">
                <button
                  onClick={() => setDevice("desktop")}
                  className={`p-1 rounded ${device === "desktop" ? "bg-primary text-primary-foreground" : ""}`}
                >
                  <Monitor className="size-3" />
                </button>
                <button
                  onClick={() => setDevice("tablet")}
                  className={`p-1 rounded ${device === "tablet" ? "bg-primary text-primary-foreground" : ""}`}
                >
                  <Tablet className="size-3" />
                </button>
                <button
                  onClick={() => setDevice("mobile")}
                  className={`p-1 rounded ${device === "mobile" ? "bg-primary text-primary-foreground" : ""}`}
                >
                  <Smartphone className="size-3" />
                </button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1 p-0 overflow-auto bg-muted/30">
            <div className={`mx-auto bg-white my-4 border rounded shadow-sm transition-all ${
              device === "desktop" ? "max-w-3xl" : device === "tablet" ? "max-w-md" : "max-w-xs"
            }`}>
              <div className="p-4 border-b">
                <h3 className="font-medium">客户档案表单</h3>
                <p className="text-xs text-muted-foreground">用于录入新客户基本信息</p>
              </div>
              <div className="p-4 space-y-3">
                {INITIAL_FORM.map((f) => (
                  <div
                    key={f.id}
                    onClick={() => setSelectedField(f.id)}
                    className={`p-3 border rounded cursor-pointer hover:border-primary ${
                      selectedField === f.id ? "border-primary bg-primary/5 ring-2 ring-primary/20" : ""
                    }`}
                  >
                    <Label className="flex items-center gap-1">
                      <f.icon className="size-4" />
                      <span>{f.label}</span>
                      {f.id === "f1" && <Badge variant="destructive" className="text-[10px] ml-1">必填</Badge>}
                    </Label>
                    {f.type === "单行文本" && <Input placeholder={`请输入${f.label}`} className="mt-1" />}
                    {f.type === "多行文本" && <textarea placeholder={`请输入${f.label}`} className="mt-1 w-full border rounded p-2 text-sm" rows={2} />}
                    {f.type === "下拉选择" && (
                      <select className="mt-1 w-full border rounded p-2 text-sm">
                        <option>请选择...</option>
                      </select>
                    )}
                    {f.type === "单选" && (
                      <div className="flex gap-2 mt-1">
                        {["普通", "重要", "战略"].map((o) => (
                          <label key={o} className="flex items-center gap-1 text-sm">
                            <input type="radio" name={f.id} /> {o}
                          </label>
                        ))}
                      </div>
                    )}
                    {f.type === "评分" && (
                      <div className="flex gap-1 mt-1">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Star key={n} className="size-5 text-yellow-500 fill-yellow-500" />
                        ))}
                      </div>
                    )}
                    {f.type === "手机号" && <Input placeholder="138 0013 8000" className="mt-1" />}
                    {f.type === "邮箱" && <Input type="email" placeholder="example@company.com" className="mt-1" />}
                  </div>
                ))}
                <Button variant="outline" className="w-full">
                  <Plus className="size-3 mr-1" />
                  添加字段
                </Button>
              </div>
              <div className="p-4 border-t flex justify-end gap-2">
                <Button variant="outline">取消</Button>
                <Button>保存</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 属性面板 */}
        <Card className="col-span-3 overflow-y-auto">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Settings className="size-3" /> 字段属性
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {selectedField ? (
              <>
                <div>
                  <Label className="text-xs">字段标签</Label>
                  <Input defaultValue={INITIAL_FORM.find((f) => f.id === selectedField)?.label} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">字段名</Label>
                  <Input defaultValue={selectedField} className="mt-1 font-mono text-xs" />
                </div>
                <div>
                  <Label className="text-xs">占位符</Label>
                  <Input placeholder="请输入占位符" className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">默认值</Label>
                  <Input placeholder="请输入默认值" className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">校验规则</Label>
                  <div className="space-y-1 mt-1">
                    {["必填", "唯一", "邮箱格式", "手机号格式", "数值范围"].map((r) => (
                      <label key={r} className="flex items-center gap-1 text-xs">
                        <input type="checkbox" /> {r}
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="text-xs">联动规则</Label>
                  <select className="mt-1 w-full border rounded p-2 text-xs">
                    <option>无</option>
                    <option>显示联动</option>
                    <option>数据联动</option>
                  </select>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button size="sm" variant="outline" className="flex-1">
                    <Copy className="size-3 mr-1" />
                    复制
                  </Button>
                  <Button size="sm" variant="outline">
                    <Trash2 className="size-3 text-red-500" />
                  </Button>
                </div>
              </>
            ) : (
              <div className="text-center text-muted-foreground text-xs py-8">
                点击左侧任意字段查看/编辑属性
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}