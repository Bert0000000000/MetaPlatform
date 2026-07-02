import React, { useState, useEffect, useCallback } from "react";
import {
  listCapabilities,
  getCapability,
  executeCapability,
} from "../api/capabilityApi";

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
  { key: "AI", label: "AI", icon: "🤖" },
  { key: "数据", label: "数据", icon: "📊" },
  { key: "工具", label: "工具", icon: "🔧" },
];

const CATEGORY_ICONS: Record<string, string> = {
  AI: "🤖",
  数据: "📊",
  工具: "🔧",
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

  /* Load capabilities */
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

  /* Load detail when expanding */
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

  /* Execute capability */
  async function handleExecute() {
    if (!expandedCode) return;
    setExecuting(true);
    setExecResult(null);
    setExecError(null);

    try {
      // Build input object from form values
      const input: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(inputValues)) {
        if (val.trim()) {
          // Try to parse JSON values
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
    <div className="mp-capability-center">
      <div className="mp-capability-header">
        <h1>能力中心</h1>
        <p>查看和执行已注册的能力服务</p>
      </div>

      {/* Category filter tabs */}
      <div className="mp-capability-filters">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            className={`mp-capability-filter-tab${activeCategory === cat.key ? " active" : ""}`}
            onClick={() => setActiveCategory(cat.key)}
          >
            {cat.icon && <span className="mp-capability-filter-icon">{cat.icon}</span>}
            {cat.label}
          </button>
        ))}
      </div>

      {error && <div className="mp-alert mp-alert-error">{error}</div>}

      {loading ? (
        <div className="mp-loading">加载中...</div>
      ) : capabilities.length === 0 ? (
        <div className="mp-empty-hint">暂无可用能力</div>
      ) : (
        <div className="mp-capability-grid">
          {capabilities.map((cap) => (
            <div
              key={cap.code}
              className={`mp-capability-card${expandedCode === cap.code ? " expanded" : ""}`}
            >
              <div
                className="mp-capability-card-header"
                onClick={() => handleExpand(cap.code)}
              >
                <div className="mp-capability-card-icon">
                  {cap.icon || CATEGORY_ICONS[cap.category] || "⚙️"}
                </div>
                <div className="mp-capability-card-info">
                  <div className="mp-capability-card-name">{cap.name}</div>
                  <div className="mp-capability-card-code">{cap.code}</div>
                </div>
                <span className="mp-capability-card-category">
                  {cap.category}
                </span>
              </div>

              {cap.description && (
                <div className="mp-capability-card-desc">
                  {cap.description}
                </div>
              )}

              <div className="mp-capability-card-schemas">
                <div className="mp-capability-card-schema">
                  <span className="mp-capability-schema-label">输入:</span>
                  <span>{getSchemaSummary(cap.inputSchema)}</span>
                </div>
                <div className="mp-capability-card-schema">
                  <span className="mp-capability-schema-label">输出:</span>
                  <span>{getSchemaSummary(cap.outputSchema)}</span>
                </div>
              </div>

              {/* Expanded: input form + execute */}
              {expandedCode === cap.code && (
                <div className="mp-capability-execute">
                  {detail?.inputFields && detail.inputFields.length > 0 ? (
                    <div className="mp-capability-input-form">
                      {detail.inputFields.map((field) => (
                        <div key={field.name} className="mp-field">
                          <label className="mp-field-label">
                            {field.name}
                            {field.required && (
                              <span className="mp-field-required">*</span>
                            )}
                          </label>
                          {field.description && (
                            <span className="mp-capability-field-hint">
                              {field.description}
                            </span>
                          )}
                          <input
                            type="text"
                            className="mp-widget-input"
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
                    <div className="mp-capability-input-form">
                      <div className="mp-field">
                        <label className="mp-field-label">
                          输入参数 (JSON)
                        </label>
                        <textarea
                          className="mp-widget-textarea"
                          placeholder='{"key": "value"}'
                          value={inputValues["__json__"] || ""}
                          onChange={(e) =>
                            handleInputChange("__json__", e.target.value)
                          }
                          rows={3}
                        />
                      </div>
                    </div>
                  )}

                  <button
                    className="mp-btn mp-btn-primary mp-capability-execute-btn"
                    onClick={handleExecute}
                    disabled={executing}
                  >
                    {executing ? "执行中..." : "执行"}
                  </button>

                  {/* Result area */}
                  {(execResult !== null || execError) && (
                    <div className="mp-capability-result">
                      {execError ? (
                        <div className="mp-capability-result-error">
                          {execError}
                        </div>
                      ) : (
                        <pre className="mp-capability-result-content">
                          {typeof execResult === "string"
                            ? execResult
                            : JSON.stringify(execResult, null, 2)}
                        </pre>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CapabilityCenter;
