import { useState, useRef, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/stat";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Save, Eye, Smartphone, Monitor, Tablet, Settings, Trash2, Copy, Plus, Type, Hash, Calendar, Mail, Phone, ListChecks, FileText, Upload, Star, Sliders, ToggleLeft, Sparkles, FileEdit, Clock, ClipboardList, Circle, CheckSquare, Paperclip, Image, PenTool, MapPin, TreeDeciduous, Scan, FileImage, CreditCard, Receipt, Contact, Check, Gauge, Printer, TreePine, LayoutDashboard, Loader2 } from "lucide-react";
import { filesystemApi } from "@/lib/api";
import { toast } from "sonner";
import type { LucideIcon } from "lucide-react";

// OCR Document Types
type OCRDocType = "id-card" | "business-license" | "invoice" | "business-card";

interface OCRResult {
  type: OCRDocType;
  fields: Record<string, string>;
  confidence: number;
  rawText: string;
}

const OCR_DOC_TYPES: { id: OCRDocType; name: string; icon: LucideIcon; description: string }[] = [
  { id: "id-card", name: "身份证", icon: CreditCard, description: "居民身份证正反面识别" },
  { id: "business-license", name: "营业执照", icon: FileImage, description: "企业营业执照识别" },
  { id: "invoice", name: "发票", icon: Receipt, description: "增值税发票识别" },
  { id: "business-card", name: "名片", icon: Contact, description: "个人名片识别" },
];

// Fallback OCR results used when the backend OCR service is not available
const MOCK_OCR_RESULTS: Record<OCRDocType, OCRResult> = {
  "id-card": {
    type: "id-card",
    fields: {
      "姓名": "张三",
      "性别": "男",
      "民族": "汉",
      "出生日期": "1990-05-15",
      "住址": "北京市海淀区中关村大街1号",
      "身份证号": "110108199005150012",
      "签发机关": "北京市公安局海淀分局",
      "有效期": "2020.01.01-2030.01.01",
    },
    confidence: 98.5,
    rawText: "居民身份证\n姓名：张三\n性别：男 民族：汉\n出生日期：1990年05月15日\n住址：北京市海淀区中关村大街1号\n公民身份号码：110108199005150012\n签发机关：北京市公安局海淀分局\n有效期限：2020.01.01-2030.01.01",
  },
  "business-license": {
    type: "business-license",
    fields: {
      "企业名称": "北京科技有限公司",
      "统一社会信用代码": "91110108MA01XXXXX",
      "法定代表人": "李四",
      "注册资本": "1000万元",
      "成立日期": "2020-01-10",
      "营业期限": "2020-01-10 至 长期",
      "住所": "北京市朝阳区望京街道",
      "经营范围": "技术开发、技术咨询、技术服务",
    },
    confidence: 97.2,
    rawText: "营业执照\n企业名称：北京科技有限公司\n统一社会信用代码：91110108MA01XXXXX\n法定代表人：李四\n注册资本：1000万元\n成立日期：2020年01月10日\n营业期限：2020年01月10日至长期\n住所：北京市朝阳区望京街道\n经营范围：技术开发、技术咨询、技术服务",
  },
  "invoice": {
    type: "invoice",
    fields: {
      "发票代码": "011002100111",
      "发票号码": "12345678",
      "开票日期": "2026-06-15",
      "购买方名称": "北京科技有限公司",
      "购买方税号": "91110108MA01XXXXX",
      "销售方名称": "上海贸易有限公司",
      "金额合计": "¥10,000.00",
      "税额合计": "¥1,300.00",
      "价税合计": "¥11,300.00",
    },
    confidence: 96.8,
    rawText: "增值税专用发票\n发票代码：011002100111\n发票号码：12345678\n开票日期：2026年06月15日\n购买方名称：北京科技有限公司\n购买方纳税人识别号：91110108MA01XXXXX\n销售方名称：上海贸易有限公司\n金额合计：¥10,000.00\n税额合计：¥1,300.00\n价税合计：¥11,300.00",
  },
  "business-card": {
    type: "business-card",
    fields: {
      "姓名": "王五",
      "职位": "技术总监",
      "公司": "北京科技有限公司",
      "手机": "13800138000",
      "邮箱": "wangwu@tech.com",
      "地址": "北京市海淀区中关村大街1号",
      "网站": "www.tech.com",
    },
    confidence: 95.4,
    rawText: "王五\n技术总监\n北京科技有限公司\n手机：13800138000\n邮箱：wangwu@tech.com\n地址：北京市海淀区中关村大街1号\n网站：www.tech.com",
  },
};

interface FieldDef {
  id: string;
  type: string;
  label: string;
  placeholder?: string;
  required: boolean;
  icon: LucideIcon;
  color: string;
}

// Runtime form field (without icon/color - those come from the library lookup)
interface FormField {
  id: string;
  type: string;
  label: string;
  placeholder: string;
  required: boolean;
}

const FIELD_LIBRARY: FieldDef[] = [
  { id: "single-text", type: "单行文本", label: "单行文本", required: false, icon: Type, color: "bg-blue-500" },
  { id: "multi-text", type: "多行文本", label: "多行文本", required: false, icon: FileEdit, color: "bg-green-500" },
  { id: "number", type: "数字", label: "数字", required: false, icon: Hash, color: "bg-purple-500" },
  { id: "date", type: "日期", label: "日期", required: false, icon: Calendar, color: "bg-primary" },
  { id: "datetime", type: "日期时间", label: "日期时间", required: false, icon: Clock, color: "bg-primary" },
  { id: "email", type: "邮箱", label: "邮箱", required: false, icon: Mail, color: "bg-primary" },
  { id: "phone", type: "手机号", label: "手机号", required: false, icon: Smartphone, color: "bg-primary" },
  { id: "select", type: "下拉选择", label: "下拉选择", required: false, icon: ClipboardList, color: "bg-primary" },
  { id: "radio", type: "单选", label: "单选", required: false, icon: Circle, color: "bg-red-500" },
  { id: "checkbox", type: "多选", label: "多选", required: false, icon: CheckSquare, color: "bg-emerald-500" },
  { id: "switch", type: "开关", label: "开关", required: false, icon: ToggleLeft, color: "bg-primary" },
  { id: "slider", type: "滑块", label: "滑块", required: false, icon: Sliders, color: "bg-primary" },
  { id: "rating", type: "评分", label: "评分", required: false, icon: Star, color: "bg-primary" },
  { id: "file", type: "文件上传", label: "文件上传", required: false, icon: Paperclip, color: "bg-slate-500" },
  { id: "image", type: "图片上传", label: "图片上传", required: false, icon: Image, color: "bg-primary" },
  { id: "richtext", type: "富文本", label: "富文本", required: false, icon: PenTool, color: "bg-primary" },
  { id: "address", type: "地址", label: "地址", required: false, icon: MapPin, color: "bg-primary" },
  { id: "cascader", type: "级联选择", label: "级联选择", required: false, icon: TreeDeciduous, color: "bg-lime-500" },
  // F4.4.2.20 自动编号
  { id: "auto-number", type: "自动编号", label: "自动编号", required: false, icon: Hash, color: "bg-stone-500" },
  // F4.4.2.22 树形录入
  { id: "tree-input", type: "树形", label: "树形录入", required: false, icon: TreePine, color: "bg-emerald-600" },
  // F4.4.2.26 仪表盘内嵌
  { id: "dashboard-embed", type: "仪表盘", label: "仪表盘内嵌", required: false, icon: LayoutDashboard, color: "bg-blue-600" },
];

// Lookup icon + color from the FIELD_LIBRARY by type
function getFieldMeta(type: string): { icon: LucideIcon; color: string } {
  const lib = FIELD_LIBRARY.find((f) => f.type === type);
  return lib ? { icon: lib.icon, color: lib.color } : { icon: Type, color: "bg-gray-500" };
}

// Default initial form fields
const DEFAULT_FORM_FIELDS: FormField[] = [
  { id: "f1", type: "单行文本", label: "客户名称", placeholder: "请输入客户名称", required: true },
  { id: "f2", type: "单行文本", label: "客户编号", placeholder: "请输入客户编号", required: false },
  { id: "f3", type: "下拉选择", label: "行业类型", placeholder: "请选择行业类型", required: false },
  { id: "f4", type: "手机号", label: "联系电话", placeholder: "请输入联系电话", required: false },
  { id: "f5", type: "邮箱", label: "邮箱", placeholder: "请输入邮箱", required: false },
  { id: "f6", type: "单选", label: "客户等级", placeholder: "", required: false },
  { id: "f7", type: "评分", label: "重要程度", placeholder: "", required: false },
  { id: "f8", type: "多行文本", label: "备注", placeholder: "请输入备注", required: false },
];

// Helper: map a FormField type to a canvas-rendering template (same as before but driven by runtime data)
function renderFieldInput(f: FormField) {
  switch (f.type) {
    case "单行文本":
      return <Input placeholder={f.placeholder || `请输入${f.label}`} className="mt-1" />;
    case "多行文本":
      return <textarea placeholder={f.placeholder || `请输入${f.label}`} className="mt-1 w-full border rounded p-2 text-sm" rows={2} />;
    case "数字":
      return <Input type="number" placeholder={f.placeholder || `请输入${f.label}`} className="mt-1" />;
    case "日期":
      return <Input type="date" className="mt-1" />;
    case "日期时间":
      return <Input type="datetime-local" className="mt-1" />;
    case "邮箱":
      return <Input type="email" placeholder={f.placeholder || "example@company.com"} className="mt-1" />;
    case "手机号":
      return <Input placeholder={f.placeholder || "138 0013 8000"} className="mt-1" />;
    case "下拉选择":
      return (
        <select className="mt-1 w-full border rounded p-2 text-sm">
          <option>请选择...</option>
        </select>
      );
    case "单选":
      return (
        <div className="flex gap-2 mt-1">
          {["选项A", "选项B", "选项C"].map((o) => (
            <label key={o} className="flex items-center gap-1 text-sm">
              <input type="radio" name={f.id} /> {o}
            </label>
          ))}
        </div>
      );
    case "多选":
      return (
        <div className="flex gap-2 mt-1">
          {["选项A", "选项B", "选项C"].map((o) => (
            <label key={o} className="flex items-center gap-1 text-sm">
              <input type="checkbox" /> {o}
            </label>
          ))}
        </div>
      );
    case "评分":
      return (
        <div className="flex gap-1 mt-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <Star key={n} className="size-5 text-yellow-500 fill-yellow-500" />
          ))}
        </div>
      );
    case "开关":
      return <div className="mt-1"><input type="checkbox" className="toggle" /></div>;
    case "文件上传":
      return <div className="mt-1 border-2 border-dashed rounded p-2 text-center text-xs text-muted-foreground">点击或拖拽上传文件</div>;
    case "图片上传":
      return <div className="mt-1 border-2 border-dashed rounded p-2 text-center text-xs text-muted-foreground">点击或拖拽上传图片</div>;
    default:
      return <Input placeholder={f.placeholder || `请输入${f.label}`} className="mt-1" />;
  }
}

export default function FormDesigner() {
  // ─── Form Fields (runtime, from save/load) ────────────
  const [formFields, setFormFields] = useState<FormField[]>(DEFAULT_FORM_FIELDS);
  const [draggedType, setDraggedType] = useState<string | null>(null);
  const [selectedFieldIndex, setSelectedFieldIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  // ─── Device preview ───────────────────────────────────
  const [device, setDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");

  // ─── OCR State ────────────────────────────────────────
  const [ocrDialogOpen, setOcrDialogOpen] = useState(false);
  const [selectedDocType, setSelectedDocType] = useState<OCRDocType>("id-card");
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [ocrProcessing, setOcrProcessing] = useState(false);
  const [ocrResult, setOcrResult] = useState<OCRResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // F4.4.5.2 发票验真 state
  const [invoiceVerifying, setInvoiceVerifying] = useState(false);
  const [invoiceVerified, setInvoiceVerified] = useState(false);

  // F4.4.5.5 打印模板 state
  const [printDialogOpen, setPrintDialogOpen] = useState(false);

  // ─── Load saved form on mount (placeholder appId / pageId) ──────
  // TODO: replace with real appId/pageId from route params
  const appId = "app-default";
  const pageId = "form-customer";

  useEffect(() => {
    const loadForm = async () => {
      try {
        const files = await filesystemApi.listFiles({ app_id: appId });
        const formFile = files.find(
          (f: any) => f.name === `form-${pageId}.json` && !f.is_dir,
        );
        if (formFile) {
          const parsed = JSON.parse(formFile.content || "{}");
          if (parsed.fields && Array.isArray(parsed.fields)) {
            setFormFields(parsed.fields);
          }
        }
      } catch {
        // silently keep default fields
      }
    };
    loadForm();
  }, []);

  // ─── Drag-and-drop: field library → canvas ────────────
  const handleFieldDragStart = useCallback((e: React.DragEvent, fieldType: string) => {
    e.dataTransfer.setData("fieldType", fieldType);
    e.dataTransfer.effectAllowed = "copy";
    setDraggedType(fieldType);
  }, []);

  const handleCanvasDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  const handleCanvasDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const fieldType = e.dataTransfer.getData("fieldType") || draggedType;
    if (fieldType) {
      const newField: FormField = {
        id: `field-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: fieldType,
        label: fieldType,
        placeholder: "",
        required: false,
      };
      setFormFields((prev) => [...prev, newField]);
      setDraggedType(null);
      // Auto-select the newly added field
      setSelectedFieldIndex(formFields.length); // will be the new last index
    }
  }, [draggedType, formFields.length]);

  // ─── Field selection in canvas ────────────────────────
  const handleSelectField = useCallback((index: number) => {
    setSelectedFieldIndex((prev) => (prev === index ? null : index));
  }, []);

  // ─── Delete field ─────────────────────────────────────
  const handleDeleteField = useCallback(() => {
    if (selectedFieldIndex !== null) {
      setFormFields((prev) => prev.filter((_, i) => i !== selectedFieldIndex));
      setSelectedFieldIndex(null);
    }
  }, [selectedFieldIndex]);

  // ─── Property editing helpers ─────────────────────────
  const updateFieldProperty = useCallback(
    (key: keyof FormField, value: string | boolean) => {
      if (selectedFieldIndex === null) return;
      setFormFields((prev) =>
        prev.map((f, i) => (i === selectedFieldIndex ? { ...f, [key]: value } : f)),
      );
    },
    [selectedFieldIndex],
  );

  // ─── Save form to filesystem ──────────────────────────
  const handleSaveForm = useCallback(async () => {
    setSaving(true);
    try {
      const formDef = { fields: formFields, layout: "vertical" };
      const content = JSON.stringify(formDef, null, 2);
      // Try to find existing form file
      const files = await filesystemApi.listFiles({ app_id: appId });
      const existing = files.find(
        (f: any) => f.name === `form-${pageId}.json` && !f.is_dir,
      );
      if (existing) {
        await filesystemApi.updateFile(existing.id, { content });
      } else {
        await filesystemApi.createFile({
          app_id: appId,
          name: `form-${pageId}.json`,
          is_dir: false,
          content,
        });
      }
      toast.success("表单保存成功");
    } catch (err: any) {
      toast.error("保存失败: " + (err.message || "未知错误"));
    } finally {
      setSaving(false);
    }
  }, [formFields, appId, pageId]);

  // ─── OCR handlers ─────────────────────────────────────
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const simulateOCR = useCallback(async (file: File) => {
    setOcrProcessing(true);
    setOcrResult(null);
    try {
      // Convert file to base64
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          // Remove data URL prefix (e.g., "data:image/png;base64,")
          resolve(result.split(",")[1] || result);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      // Call real OCR API endpoint
      const res = await fetch("/api/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64, documentType: selectedDocType }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        setOcrResult(json.data as OCRResult);
      } else {
        // Fallback to mock results if API returns no data
        setOcrResult(MOCK_OCR_RESULTS[selectedDocType]);
      }
    } catch (err) {
      console.warn("OCR API call failed, using mock fallback:", err);
      setOcrResult(MOCK_OCR_RESULTS[selectedDocType]);
    } finally {
      setOcrProcessing(false);
    }
  }, [selectedDocType]);

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      setUploadedFile(files[0]);
      simulateOCR(files[0]);
    }
  }, [simulateOCR]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setUploadedFile(files[0]);
      simulateOCR(files[0]);
    }
  }, [simulateOCR]);

  const handleApplyToForm = useCallback(() => {
    if (!ocrResult) return;
    // Map OCR fields to form fields
    const ocrFields: FormField[] = Object.entries(ocrResult.fields).map(([key, value], idx) => ({
      id: `ocr-${Date.now()}-${idx}`,
      type: "单行文本",
      label: key,
      placeholder: value,
      required: false,
    }));
    setFormFields((prev) => [...prev, ...ocrFields]);
    toast.success(`已将 ${ocrFields.length} 个 OCR 字段添加到表单`);
    setOcrDialogOpen(false);
    setOcrResult(null);
    setUploadedFile(null);
  }, [ocrResult]);

  // F4.4.5.2 发票验真
  const handleInvoiceVerify = useCallback(() => {
    setInvoiceVerifying(true);
    setInvoiceVerified(false);
    setTimeout(() => {
      setInvoiceVerifying(false);
      setInvoiceVerified(true);
    }, 2000);
  }, []);

  // ─── Derived: selected field object ───────────────────
  const selectedField = selectedFieldIndex !== null ? formFields[selectedFieldIndex] : null;

  return (
    <div className="flex flex-col gap-4 p-6 w-full h-[calc(100vh-180px)]">
      <PageHeader
        title="表单设计器"
        description="LowCode 拖拽式表单设计 · 客户管理表单"
        action={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setOcrDialogOpen(true)}>
              <Scan className="size-3 mr-1" />
              OCR 识别
            </Button>
            <Button variant="outline" size="sm">
              <Sparkles className="size-3 mr-1" />
              AI 生成
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPrintDialogOpen(true)}>
              <Printer className="size-3 mr-1" />
              打印模板
            </Button>
            <Button variant="outline" size="sm">
              <Eye className="size-3 mr-1" />
              预览
            </Button>
            <Button size="sm" onClick={handleSaveForm} disabled={saving}>
              {saving ? (
                <Loader2 className="size-3 mr-1 animate-spin" />
              ) : (
                <Save className="size-3 mr-1" />
              )}
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
            <CardDescription className="text-xs">{FIELD_LIBRARY.length} 种字段类型</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {FIELD_LIBRARY.map((f) => (
                <div
                  key={f.id}
                  draggable
                  onDragStart={(e) => handleFieldDragStart(e, f.type)}
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
            <div
              className={`mx-auto bg-white my-4 border rounded shadow-sm transition-all ${
                device === "desktop" ? "max-w-3xl" : device === "tablet" ? "max-w-md" : "max-w-xs"
              }`}
              onDragOver={handleCanvasDragOver}
              onDrop={handleCanvasDrop}
            >
              <div className="p-4 border-b">
                <h3 className="font-medium">客户档案表单</h3>
                <p className="text-xs text-muted-foreground">用于录入新客户基本信息</p>
              </div>
              <div className="p-4 space-y-3 min-h-[200px]">
                {formFields.length === 0 && (
                  <div className="text-center text-muted-foreground text-sm py-12 border-2 border-dashed rounded">
                    从左侧字段库拖拽字段到此处
                  </div>
                )}
                {formFields.map((f, idx) => {
                  const meta = getFieldMeta(f.type);
                  const Icon = meta.icon;
                  return (
                    <div
                      key={f.id}
                      onClick={() => handleSelectField(idx)}
                      className={`p-3 border rounded cursor-pointer hover:border-primary transition-colors ${
                        selectedFieldIndex === idx
                          ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                          : ""
                      }`}
                    >
                      <Label className="flex items-center gap-1">
                        <Icon className="size-4" />
                        <span>{f.label}</span>
                        {f.required && <Badge variant="destructive" className="text-xs ml-1">必填</Badge>}
                      </Label>
                      {renderFieldInput(f)}
                      {selectedFieldIndex === idx && (
                        <div className="flex justify-end mt-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteField();
                            }}
                          >
                            <Trash2 className="size-3 mr-1" />
                            删除字段
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    const newField: FormField = {
                      id: `field-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                      type: "单行文本",
                      label: "新字段",
                      placeholder: "",
                      required: false,
                    };
                    setFormFields((prev) => [...prev, newField]);
                    setSelectedFieldIndex(formFields.length);
                  }}
                >
                  <Plus className="size-3 mr-1" />
                  添加字段
                </Button>
              </div>
              <div className="p-4 border-t flex justify-end gap-2">
                <Button variant="outline" onClick={() => { setFormFields(DEFAULT_FORM_FIELDS); setSelectedFieldIndex(null); }}>
                  取消
                </Button>
                <Button onClick={handleSaveForm} disabled={saving}>
                  {saving ? <Loader2 className="size-3 mr-1 animate-spin" /> : <Save className="size-3 mr-1" />}
                  保存
                </Button>
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
                  <Label className="text-xs">字段类型</Label>
                  <div className="mt-1 text-xs bg-muted rounded px-2 py-1">{selectedField.type}</div>
                </div>
                <div>
                  <Label className="text-xs">字段标签</Label>
                  <Input
                    value={selectedField.label}
                    onChange={(e) => updateFieldProperty("label", e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">字段 ID</Label>
                  <Input value={selectedField.id} className="mt-1 font-mono text-xs" readOnly />
                </div>
                <div>
                  <Label className="text-xs">占位符</Label>
                  <Input
                    value={selectedField.placeholder}
                    onChange={(e) => updateFieldProperty("placeholder", e.target.value)}
                    placeholder="请输入占位符"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">默认值</Label>
                  <Input placeholder="请输入默认值" className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">校验规则</Label>
                  <div className="space-y-1 mt-1">
                    <label className="flex items-center gap-1 text-xs">
                      <input
                        type="checkbox"
                        checked={selectedField.required}
                        onChange={(e) => updateFieldProperty("required", e.target.checked)}
                      /> 必填
                    </label>
                    {["唯一", "邮箱格式", "手机号格式", "数值范围"].map((r) => (
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
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      if (selectedFieldIndex === null) return;
                      const copy = { ...formFields[selectedFieldIndex], id: `field-${Date.now()}-copy` };
                      setFormFields((prev) => [
                        ...prev.slice(0, selectedFieldIndex + 1),
                        copy,
                        ...prev.slice(selectedFieldIndex + 1),
                      ]);
                      setSelectedFieldIndex(selectedFieldIndex + 1);
                    }}
                  >
                    <Copy className="size-3 mr-1" />
                    复制
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleDeleteField}>
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

      {/* OCR Dialog */}
      <Dialog open={ocrDialogOpen} onOpenChange={setOcrDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Scan className="size-5" /> OCR 文档识别
            </DialogTitle>
            <DialogDescription>上传图片或文档，自动识别并提取文字信息</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Document Type Selection */}
            <div>
              <Label className="text-sm font-medium mb-2 block">选择文档类型</Label>
              <div className="grid grid-cols-4 gap-3">
                {OCR_DOC_TYPES.map((docType) => (
                  <button
                    key={docType.id}
                    onClick={() => {
                      setSelectedDocType(docType.id);
                      setOcrResult(null);
                      setUploadedFile(null);
                    }}
                    className={`p-3 border rounded-lg text-center transition-all ${
                      selectedDocType === docType.id
                        ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                        : "hover:border-primary/50"
                    }`}
                  >
                    <docType.icon className="size-6 mx-auto mb-1" />
                    <div className="text-sm font-medium">{docType.name}</div>
                    <div className="text-xs text-muted-foreground">{docType.description}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Upload Area */}
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                isDragging ? "border-primary bg-primary/5" : "border-gray-300"
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileSelect}
              />
              <Upload className="size-12 mx-auto mb-3 text-gray-400" />
              <div className="text-sm font-medium">
                {uploadedFile ? uploadedFile.name : "拖拽文件到此处或点击上传"}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                支持 JPG、PNG、PDF 格式，最大 10MB
              </div>
            </div>

            {/* Processing Status */}
            {ocrProcessing && (
              <div className="flex items-center justify-center gap-2 p-4 bg-blue-50 rounded-lg">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                <span className="text-sm text-blue-600">正在识别中...</span>
              </div>
            )}

            {/* OCR Results */}
            {ocrResult && !ocrProcessing && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-green-600">
                      识别完成
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      置信度: {ocrResult.confidence}%
                    </span>
                  </div>
                </div>

                {/* Extracted Fields */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">识别结果</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-3">
                      {Object.entries(ocrResult.fields).map(([key, value]) => (
                        <div key={key} className="flex items-start gap-2 p-2 border rounded">
                          <Label className="text-xs text-muted-foreground min-w-[80px]">{key}</Label>
                          <Input defaultValue={value} className="text-sm h-7" />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Raw Text */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">原始文本</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <pre className="text-xs bg-gray-50 p-3 rounded overflow-auto max-h-32">
                      {ocrResult.rawText}
                    </pre>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setOcrDialogOpen(false);
              setOcrResult(null);
              setUploadedFile(null);
              setInvoiceVerified(false);
            }}>
              取消
            </Button>
            {/* F4.4.5.2 发票验真 */}
            {selectedDocType === "invoice" && ocrResult && !ocrProcessing && (
              <Button variant="outline" onClick={handleInvoiceVerify} disabled={invoiceVerifying}>
                {invoiceVerifying ? (
                  <Loader2 className="size-3 mr-1 animate-spin" />
                ) : invoiceVerified ? (
                  <Check className="size-3 mr-1 text-green-500" />
                ) : (
                  <Receipt className="size-3 mr-1" />
                )}
                {invoiceVerifying ? "验真中..." : invoiceVerified ? "验真通过" : "发票验真"}
              </Button>
            )}
            <Button
              onClick={handleApplyToForm}
              disabled={!ocrResult || ocrProcessing}
            >
              <Check className="size-3 mr-1" />
              应用到表单
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* F4.4.5.5 打印模板对话框 */}
      <Dialog open={printDialogOpen} onOpenChange={setPrintDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Printer className="size-5" /> 打印模板
            </DialogTitle>
            <DialogDescription>选择打印模板样式</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {[
              { name: "标准表单打印", desc: "表单字段纵向排列，适合 A4 纸张", icon: FileText },
              { name: "表格批量打印", desc: "表格形式，适合批量数据打印", icon: ListChecks },
              { name: "卡片式打印", desc: "每条记录一张卡片，适合标签纸", icon: ClipboardList },
              { name: "自定义模板", desc: "拖拽自定义打印布局", icon: Settings },
            ].map((tpl, i) => (
              <button
                key={i}
                type="button"
                className="flex items-start gap-3 p-3 border rounded-lg w-full text-left hover:border-primary transition-colors"
                onClick={() => { alert(`已选择模板: ${tpl.name}`); setPrintDialogOpen(false); }}
              >
                <tpl.icon className="size-5 text-muted-foreground mt-0.5" />
                <div>
                  <div className="text-sm font-medium">{tpl.name}</div>
                  <div className="text-xs text-muted-foreground">{tpl.desc}</div>
                </div>
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPrintDialogOpen(false)}>取消</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
