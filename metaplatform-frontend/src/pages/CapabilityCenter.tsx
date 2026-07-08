import React, { useState, useEffect, useCallback } from "react";
import {
  listCapabilities,
  getCapability,
  executeCapability,
} from "../api/capabilityApi";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

/* ---- Types ---- */
interface Capability {
  id: string;
  name: string;
  code: string;
  category: string;
  description?: string;
  icon?: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
}

interface CapabilityDetail extends Capability {
  inputFields?: Array<{
    name: string;
    type: string;
    required?: boolean;
    description?: string;
  }>;
}

/* ---- Constants ---- */
const CATEGORIES = [
  { key: "", label: "全部" },
  { key: "AI", label: "AI", icon: "[AI]" },
  { key: "数据", label: "数据", icon: "[D]" },
  { key: "工具", label: "工具", icon: "[T]" },
];

const CATEGORY_ICONS: Record<string, string> = {
  AI: "[AI]",
  数据: "[D]",
  工具: "[T]",
};

/* ---- Component ---- */
const CapabilityCenter: React.FC = () => {
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [activeCategory, setActiveCategory] = useState("");
  const [expandedCode, setExpandedCode] = useState<string | null>(null);
  const [detail, setDetail] = useState<CapabilityDetail | null>(null);
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const [executing, setExecuting] = useState(false);
  const [execResult, setExecResult] = useState<unknown>(null);
  const [execError, setExecError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCapabilities = useCallback(async (category?: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await listCapabilities(category || undefined);
      setCapabilities(Array.isArray(data) ? data : []);
    } catch {
      setError("加载能力列表失败");
      setCapabilities([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCapabilities(activeCategory);
  }, [activeCategory, loadCapabilities]);

  async function handleExpand(code: string) {
    if (expandedCode === code) {
      setExpandedCode(null);
      setDetail(null);
      setInputValues({});
      setExecResult(null);
      setExecError(null);
      return;
    }

    setExpandedCode(code);
    setExecResult(null);
    setExecError(null);
    setInputValues({});

    try {
      const data = await getCapability(code);
      setDetail(data);
    } catch {
      setDetail(null);
    }
  }

  async function handleExecute() {
    if (!expandedCode) return;
    setExecuting(true);
    setExecResult(null);
    setExecError(null);

    try {
      const input: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(inputValues)) {
        if (val.trim()) {
          try {
            input[key] = JSON.parse(val);
          } catch {
            input[key] = val;
          }
        }
      }
      const result = await executeCapability(expandedCode, input);
      setExecResult(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "执行失败";
      setExecError(msg);
    } finally {
      setExecuting(false);
    }
  }

  function handleInputChange(fieldName: string, value: string) {
    setInputValues((prev) => ({ ...prev, [fieldName]: value }));
  }

  function getSchemaSummary(schema?: Record<string, unknown>): string {
    if (!schema) return "无";
    const props = schema.properties as Record<string, unknown> | undefined;
    if (!props) return "无";
    const keys = Object.keys(props);
    if (keys.length === 0) return "无";
    return keys.slice(0, 4).join(", ") + (keys.length > 4 ? "..." : "");
  }

  return (
    <div className="p-6 w-full space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">能力中心</h1>
          <p className="text-sm text-muted-foreground mt-1">
            查看和执行已注册的能力服务
          </p>
        </div>
      </div>

      {/* Category filter tabs */}
      <div className="flex gap-2">
        {CATEGORIES.map((cat) => (
          <Button
            key={cat.key}
            variant={activeCategory === cat.key ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveCategory(cat.key)}
          >
            {cat.icon && <span className="mr-1">{cat.icon}</span>}
            {cat.label}
          </Button>
        ))}
      </div>

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          加载中...
        </div>
      ) : capabilities.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <p>暂无可用能力</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {capabilities.map((cap) => (
            <Card
              key={cap.code}
              className={cn(
                "transition-shadow",
                expandedCode === cap.code && "ring-2 ring-primary"
              )}
            >
              <CardHeader
                className="cursor-pointer pb-3"
                onClick={() => handleExpand(cap.code)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="text-2xl">
                      {cap.icon || CATEGORY_ICONS[cap.category] || "[ ]"}
                    </div>
                    <div>
                      <CardTitle className="text-base">{cap.name}</CardTitle>
                      <p className="text-xs text-muted-foreground font-mono">
                        {cap.code}
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary">{cap.category}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {cap.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {cap.description}
                  </p>
                )}

                <div className="flex gap-4 text-xs text-muted-foreground">
                  <div>
                    <span className="font-medium">输入:</span>{" "}
                    {getSchemaSummary(cap.inputSchema)}
                  </div>
                  <div>
                    <span className="font-medium">输出:</span>{" "}
                    {getSchemaSummary(cap.outputSchema)}
                  </div>
                </div>

                {/* Expanded: input form + execute */}
                {expandedCode === cap.code && (
                  <>
                    <Separator />
                    <div className="space-y-3">
                      {detail?.inputFields && detail.inputFields.length > 0 ? (
                        <div className="space-y-3">
                          {detail.inputFields.map((field) => (
                            <div key={field.name} className="space-y-1">
                              <Label>
                                {field.name}
                                {field.required && (
                                  <span className="text-destructive ml-1">*</span>
                                )}
                              </Label>
                              {field.description && (
                                <p className="text-xs text-muted-foreground">
                                  {field.description}
                                </p>
                              )}
                              <Input
                                placeholder={`${field.type}`}
                                value={inputValues[field.name] || ""}
                                onChange={(e) =>
                                  handleInputChange(field.name, e.target.value)
                                }
                              />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <Label>输入参数 (JSON)</Label>
                          <textarea
                            className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            placeholder='{"key": "value"}'
                            value={inputValues["__json__"] || ""}
                            onChange={(e) =>
                              handleInputChange("__json__", e.target.value)
                            }
                            rows={3}
                          />
                        </div>
                      )}

                      <Button
                        className="w-full"
                        onClick={handleExecute}
                        disabled={executing}
                      >
                        {executing ? "执行中..." : "执行"}
                      </Button>

                      {/* Result area */}
                      {(execResult !== null || execError) && (
                        <div className="rounded-md border p-3">
                          {execError ? (
                            <div className="text-sm text-destructive">
                              {execError}
                            </div>
                          ) : (
                            <pre className="text-xs font-mono whitespace-pre-wrap break-all max-h-48 overflow-auto">
                              {typeof execResult === "string"
                                ? execResult
                                : JSON.stringify(execResult, null, 2)}
                            </pre>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default CapabilityCenter;
