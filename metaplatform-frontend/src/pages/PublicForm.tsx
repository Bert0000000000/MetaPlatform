/**
 * PublicForm.tsx — v1.0.2 Sprint 2 全量 Formily 2 驱动公开表单.
 *
 * <p>v1.0.2 起完全 Formily 2 渲染:
 * <ul>
 *   <li>Formily FormProvider + SchemaField (JSON Schema 驱动)</li>
 *   <li>LookupField (复用 /components/LookupDropdown)</li>
 *   <li>x-reactions 联动显隐 (visibleWhen)</li>
 *   <li>草稿持久化 (localStorage, loadDraft/saveDraft/clearDraft)</li>
 *   <li>提交后保留已填值 (computeResubmitValues / computeResetValues)</li>
 *   <li>联系信息 (_name/_email) 作为额外 schema-less 字段</li>
 *   <li>品牌 Hero + Badges (字段数/必填数/类型)</li>
 * </ul>
 */
import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { appServiceApi } from "@/lib/api";
import {
  Loader2, Check, AlertCircle, ArrowLeft, Send, Sparkles, Globe,
  ShieldCheck, User, Mail, Calendar, RotateCcw, RotateCw, Link2,
} from "lucide-react";
import { createForm } from "@formily/core";
import { FormProvider, createSchemaField } from "@formily/react";
import { ISchema } from "@formily/json-schema";
import {
  FormilyComponents,
  FormItem,
} from "@/components/formily/fields";
import {
  sectionsToFormilySchema,
  extractInitialValues,
  extractLookupConfigs,
  type MetaSection,
} from "@/components/formily/schemaAdapter";
import {
  computeResubmitValues, computeResetValues,
  loadDraft, saveDraft, clearDraft,
} from "./preserveFormValues";
import { extractLookupFields, indexLookupOptions } from "@/components/LookupDropdown";

/**
 * SchemaField 是 factory. 静态创建一次即可.
 */
const SchemaField = createSchemaField({
  components: FormilyComponents as any,
});

function pickFields(schema: any): any[] {
  const target = schema?.schema ?? schema;
  if (Array.isArray(target?.sections)) {
    return target.sections.flatMap((s: any) => s.fields || []);
  }
  if (Array.isArray(target?.fields)) return target.fields;
  return [];
}

function fieldKey(f: any): string {
  return f?.fieldKey || f?.key || f?.name || f?.field || "";
}

function fieldType(f: any): string {
  return String(f?.widget || f?.type || "input").toLowerCase();
}

function fieldIcon(type: string) {
  if (type === "email") return <Mail className="size-3.5" />;
  if (type === "date" || type === "datepicker") return <Calendar className="size-3.5" />;
  if (type === "textarea" || type === "richtext") return <Sparkles className="size-3.5" />;
  if (type === "select" || type === "radio") return <Globe className="size-3.5" />;
  if (type === "checkbox" || type === "switch" || type === "boolean") return <Check className="size-3.5" />;
  if (type === "number" || type === "currency" || type === "percent") return <Sparkles className="size-3.5" />;
  if (type === "lookup") return <Link2 className="size-3.5" />;
  return <User className="size-3.5" />;
}

/**
 * 联系信息 (schema-less 字段). V1 的 _name/_email 通过 Formily 独立字段实现.
 */
const contactSectionSchema: ISchema = {
  type: "object",
  properties: {
    _name: {
      type: "string",
      title: "姓名 (选填)",
      "x-component": "TextField",
      "x-decorator": "FormItem",
      "x-component-props": { placeholder: "用于通知" },
    },
    _email: {
      type: "string",
      title: "邮箱 (选填)",
      "x-component": "TextField",
      "x-decorator": "FormItem",
      "x-component-props": { placeholder: "用于通知" },
      "x-validator": {
        format: "email",
        message: "邮箱格式不正确",
      },
    },
  },
};

export default function PublicForm() {
  const { appId } = useParams<{ appId: string }>();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const formId = params.get("formId");

  const [schema, setSchema] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [lastSubmittedValues, setLastSubmittedValues] = useState<Record<string, any> | null>(null);

  const form = useMemo(() => createForm(), []);

  const sections = useMemo<MetaSection[]>(() => {
    if (!schema) return [];
    const target = schema?.schema ?? schema;
    if (Array.isArray(target?.sections)) return target.sections as MetaSection[];
    if (Array.isArray(target?.fields)) return [{ fields: target.fields }];
    return [];
  }, [schema]);

  const formilySchema: ISchema = useMemo(
    () => sectionsToFormilySchema(sections),
    [sections],
  );

  // contact schema (always include)
  const fullSchema: ISchema = useMemo(() => ({
    type: "object",
    properties: {
      ...formilySchema.properties,
      __contact: contactSectionSchema,
    },
  }), [formilySchema]);

  // lookup-options 加载
  const [lookupLoaded, setLookupLoaded] = useState(false);
  useEffect(() => {
    if (!formId) return;
    const lookups = extractLookupConfigs(sections);
    if (lookups.length === 0) { setLookupLoaded(true); return; }
    (async () => {
      try {
        const opts = await appServiceApi.public.getLookupOptions(formId);
        const map = indexLookupOptions(opts); // Map<fieldKey, LookupOption[]>
        for (const f of lookups) {
          const fieldKey = f.field;
          const options = map.get(fieldKey) ?? [];
          form.setFieldState(fieldKey, (state) => {
            state.dataSource = options;
          });
        }
      } catch (e) {
        console.warn("lookup-options failed", e);
      } finally {
        setLookupLoaded(true);
      }
    })();
  }, [formId, sections, form]);

  // 初次加载: 拉 schema + 草稿
  useEffect(() => {
    if (!appId || !formId) { setError("Missing formId"); setLoading(false); return; }
    (async () => {
      try {
        const data = await appServiceApi.public.getFormSchema(formId);
        setSchema(data);
        // 草稿恢复 (跨刷新)
        const draft = loadDraft(formId);
        const activeKeys = pickFields(data).map(fieldKey).filter(Boolean);
        const activeSet = new Set(activeKeys);
        if (draft) {
          const safeDraft: Record<string, any> = {};
          for (const [k, v] of Object.entries(draft)) {
            if (activeSet.has(k) || k === "_name" || k === "_email") safeDraft[k] = v;
          }
          form.setValues(safeDraft);
        } else {
          // schema defaults
          const init = extractInitialValues(sections);
          form.setValues(init);
        }
      } catch (e) {
        setError((e as Error).message);
      } finally { setLoading(false); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appId, formId]);

  // 草稿自动保存
  const valuesRef = useRef<Record<string, any>>({});
  useEffect(() => {
    const unsub = form.subscribe(({ values }) => {
      valuesRef.current = values as Record<string, any>;
      if (schema && formId && !submitted) {
        saveDraft(formId, values as Record<string, string>);
      }
    });
    return () => unsub();
  }, [form, schema, formId, submitted]);

  const onSubmit = useCallback(async () => {
    if (!formId) return;
    const errs = await form.validate();
    if (errs.length > 0) return;
    const values = form.values as Record<string, any>;
    setSubmitting(true);
    setError(null);
    try {
      await appServiceApi.public.submitForm(formId, values, values._email, values._name);
      setLastSubmittedValues({ ...values });
      setSubmitted(true);
      clearDraft(formId);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }, [form, formId]);

  // ──────── render states ────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-8 animate-spin text-primary" />
          <div className="text-sm text-muted-foreground">正在加载表单…</div>
        </div>
      </div>
    );
  }
  if (error && !schema) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-primary p-8">
        <Card className="max-w-md shadow-xl border-rose-200">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-rose-700">
              <AlertCircle className="size-5" /> 加载失败
            </CardTitle>
            <CardDescription className="text-rose-600">{error}</CardDescription>
          </CardHeader>
          <CardFooter>
            <Button variant="outline" onClick={() => navigate(-1)}>
              <ArrowLeft className="size-3 mr-1" /> 返回
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }
  if (!schema) {
    return null;
  }

  const fields = pickFields(schema);
  const formTitle = schema?.name || "公开表单";
  const formDescription = schema?.description || "请填写以下表单，提交后系统会自动记录。";
  const requiredCount = fields.filter((f: any) => f.required).length;
  const fieldTypes = Array.from(new Set<string>(fields.map(fieldType).filter(Boolean)));

  // ──────── success state ────────
  if (submitted) {
    const activeKeys = fields.map(fieldKey).filter(Boolean);
    return (
      <div className="min-h-screen flex items-center justify-center bg-primary p-8">
        <Card className="max-w-md shadow-xl border-emerald-200">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto size-16 rounded-full bg-primary flex items-center justify-center mb-3 shadow-lg">
              <Check className="size-9 text-white" strokeWidth={3} />
            </div>
            <CardTitle className="text-xl">提交成功 🎉</CardTitle>
            <CardDescription>感谢您的填写，表单已成功提交。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-xs text-muted-foreground text-center">
            <div className="flex items-center justify-center gap-1.5">
              <ShieldCheck className="size-3.5" />
              数据已加密存储
            </div>
            <div className="flex items-center justify-center gap-1.5">
              <Sparkles className="size-3.5" />
              提交时间: {new Date().toLocaleString("zh-CN")}
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-2">
            <div className="flex gap-2 justify-center flex-wrap">
              <Button
                data-testid="resubmit-preserve"
                onClick={() => {
                  const newValues = lastSubmittedValues
                    ? computeResubmitValues(
                        Object.fromEntries(
                          Object.entries(lastSubmittedValues).map(([k, v]) => [k, String(v ?? "")]),
                        ),
                        [...activeKeys, "_name", "_email"],
                      )
                    : {};
                  form.setValues(newValues);
                  setSubmitted(false);
                }}
                variant="default"
                disabled={!lastSubmittedValues}
              >
                <RotateCw className="size-3.5 mr-1" />
                再提交一份（保留已填值）
              </Button>
              <Button
                data-testid="resubmit-reset"
                onClick={() => {
                  form.setValues(computeResetValues([...activeKeys, "_name", "_email"]));
                  setSubmitted(false);
                }}
                variant="outline"
              >
                <RotateCcw className="size-3.5 mr-1" />
                重新填写
              </Button>
            </div>
            {lastSubmittedValues && (
              <p className="text-xs text-muted-foreground text-center" data-testid="preserved-count">
                ✨ AC-202.4: 已为您保留 {Object.keys(lastSubmittedValues).filter((k) => !["_name", "_email"].includes(k)).length} 个字段的填写记录
              </p>
            )}
            <div className="flex gap-2 justify-center mt-2">
              <Button variant="outline" onClick={() => navigate(`/public/forms/${formId}/submissions`)}>
                查看提交记录
              </Button>
              <Button onClick={() => navigate("/apps")}>
                返回应用中心
              </Button>
            </div>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // ──────── form state ────────
  return (
    <div className="min-h-screen bg-primary py-10 px-4">
      <div className="mx-auto max-w-2xl space-y-5">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-2xl bg-primary p-6 text-white shadow-xl">
          <div className="absolute -top-12 -right-12 size-48 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-12 -left-12 size-48 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-white/80 mb-2">
              <Globe className="size-3.5" />
              公开访问 · 来自 MetaPlatform · Formily 驱动
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{formTitle}</h1>
            <p className="text-sm text-white/85 mt-1 max-w-prose">{formDescription}</p>
            <div className="flex flex-wrap gap-1.5 mt-3">
              <Badge variant="secondary" className="bg-white/20 text-white border-white/30 hover:bg-white/30" data-testid="badge-fields">
                {fields.length} 个字段
              </Badge>
              {requiredCount > 0 && (
                <Badge variant="secondary" className="bg-white/20 text-white border-white/30 hover:bg-white/30" data-testid="badge-required">
                  {requiredCount} 个必填
                </Badge>
              )}
              {fieldTypes.slice(0, 4).map((t) => (
                <Badge key={t} variant="secondary" className="bg-white/15 text-white border-white/25 hover:bg-white/25">
                  {t}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        <Card className="shadow-lg border-violet-100">
          <CardHeader className="border-b bg-primary/30">
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="size-4 text-violet-500" />
              填写表单
            </CardTitle>
            <CardDescription>带 * 为必填项 · 由 Formily 2 渲染</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            {fields.length === 0 ? (
              <div className="text-sm text-muted-foreground py-6 text-center">此表单暂未配置字段。</div>
            ) : (
              <FormProvider form={form}>
                <SchemaField schema={fullSchema} />
                {/* 联系信息通过 __contact 子对象, 但平铺到外层.
                    用 onChange in FormProvider 不能直传, 故平铺渲染 */}
                <div className="border-t border-slate-200 pt-4 mt-4">
                  <div className="text-xs font-medium text-slate-600 mb-2 flex items-center gap-1">
                    <User className="size-3.5" /> 联系信息（可选，用于系统通知）
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Input
                      placeholder="姓名 (选填)"
                      value={form.values._name ?? ""}
                      onChange={(e) => form.setValues({ ...form.values, _name: e.target.value })}
                      className="border-slate-200 focus:border-violet-400 focus:ring-violet-100"
                      data-testid="contact-name"
                    />
                    <Input
                      type="email"
                      placeholder="邮箱 (选填)"
                      value={form.values._email ?? ""}
                      onChange={(e) => form.setValues({ ...form.values, _email: e.target.value })}
                      className="border-slate-200 focus:border-violet-400 focus:ring-violet-100"
                      data-testid="contact-email"
                    />
                  </div>
                </div>
              </FormProvider>
            )}
            {error && (
              <div className="mt-4 p-3 rounded bg-rose-50 text-rose-700 text-sm flex items-center gap-2" data-testid="submit-error">
                <AlertCircle className="size-4" />
                <span>{error}</span>
              </div>
            )}
          </CardContent>
          <CardFooter className="border-t bg-slate-50/50 flex flex-col gap-2">
            <Button
              type="button"
              onClick={onSubmit}
              disabled={submitting || !lookupLoaded}
              data-testid="submit-button"
              className="w-full bg-primary hover:from-violet-700 hover:to-blue-700 text-white shadow-md hover:shadow-lg transition-all"
              size="lg"
            >
              {submitting ? (
                <><Loader2 className="size-4 animate-spin mr-2" />提交中…</>
              ) : (
                <><Send className="size-4 mr-2" />立即提交</>
              )}
            </Button>
            <div className="text-xs text-muted-foreground text-center">
              <ShieldCheck className="inline-block size-3 mr-1" />
              提交即表示您同意数据用于本次表单的目的。Powered by MetaPlatform · Formily 2
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}