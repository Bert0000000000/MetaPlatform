import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ProcessDesignerV2, type ProcessDesignerV2Ref } from "@/components/flow-designer/ProcessDesignerV2";
import { appServiceApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/lib/toast";
import { ArrowLeft, Save, Rocket } from "lucide-react";

function pickFormFields(schema: any): { key: string; label: string }[] {
  const target = schema?.schema ?? schema;
  let fields: any[] = [];
  if (Array.isArray(target?.sections)) {
    fields = target.sections.flatMap((s: any) => s.fields || []);
  } else if (Array.isArray(target?.fields)) {
    fields = target.fields;
  }
  return fields
    .map((f: any) => ({
      key: f?.fieldKey || f?.key || f?.name || f?.field || "",
      label: f?.label || f?.title || f?.fieldKey || f?.key || f?.name || f?.field || "",
    }))
    .filter((f) => f.key);
}

export default function WorkflowDesignerPage() {
  const { appId } = useParams<{ appId: string }>();
  const [searchParams] = useSearchParams();
  const formId = searchParams.get("formId");
  const navigate = useNavigate();
  const designerRef = useRef<ProcessDesignerV2Ref>(null);

  const [definitionId, setDefinitionId] = useState<number | undefined>(undefined);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [bpmnXml, setBpmnXml] = useState<string | undefined>(undefined);
  const [formFields, setFormFields] = useState<{ key: string; label: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    if (!appId || !formId) return;
    // 加载表单字段供字段权限配置使用
    appServiceApi.public.getFormSchema(formId).then((schema) => {
      setFormFields(pickFormFields(schema));
    }).catch(() => {
      setFormFields([]);
    });
    // 查看表单是否已绑定流程定义
    appServiceApi.formWorkflow.get(appId, formId).then((binding) => {
      if (binding?.workflowDefinitionId) {
        appServiceApi.workflows.get(appId, binding.workflowDefinitionId).then((def) => {
          setDefinitionId(def.id);
          setName(def.name);
          setCode(def.code);
          setBpmnXml(def.bpmnXml);
        });
      }
    });
  }, [appId, formId]);

  const handleDeploy = async (xml: string) => {
    if (!appId || !formId) return;
    if (!name || !code) {
      toast.error("请填写流程名称和编码");
      return;
    }
    setSaving(true);
    try {
      let def;
      if (definitionId) {
        def = await appServiceApi.workflows.update(appId, definitionId, {
          name,
          formId: Number(formId),
          bpmnXml: xml,
        });
      } else {
        def = await appServiceApi.workflows.create(appId, {
          name,
          code,
          formId: Number(formId),
          bpmnXml: xml,
        });
        setDefinitionId(def.id);
      }
      toast.success("流程定义已保存");
    } catch (e: any) {
      toast.error(`保存失败：${e.message || "未知错误"}`);
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!appId || !definitionId) return;
    setPublishing(true);
    try {
      await appServiceApi.workflows.publish(appId, definitionId);
      await appServiceApi.formWorkflow.bind(appId, Number(formId), definitionId);
      toast.success("流程已发布并绑定到表单");
    } catch (e: any) {
      toast.error(`发布失败：${e.message || "未知错误"}`);
    } finally {
      setPublishing(false);
    }
  };

  if (!appId) return null;

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      <div className="flex items-center justify-between px-4 py-2 border-b bg-card">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="size-4" />
          </Button>
          <h1 className="text-sm font-semibold">流程设计器</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">名称</Label>
            <Input
              className="w-40 h-8 text-xs"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="流程名称"
            />
          </div>
          {!definitionId && (
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">编码</Label>
              <Input
                className="w-32 h-8 text-xs"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="唯一编码"
              />
            </div>
          )}
          <Button
            size="sm"
            variant="outline"
            disabled={saving}
            onClick={() => {
              const xml = designerRef.current?.getBpmnXml();
              if (xml) handleDeploy(xml);
            }}
          >
            <Save className="size-3.5 mr-1" />
            {saving ? "保存中" : "保存"}
          </Button>
          <Button size="sm" disabled={publishing || !definitionId} onClick={handlePublish}>
            <Rocket className="size-3.5 mr-1" />
            {publishing ? "发布中" : "发布并绑定"}
          </Button>
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <ProcessDesignerV2
          ref={designerRef}
          initialBpmnXml={bpmnXml}
          definitionId={definitionId ? String(definitionId) : undefined}
          onDeploy={handleDeploy}
          formFields={formFields}
        />
      </div>
    </div>
  );
}
