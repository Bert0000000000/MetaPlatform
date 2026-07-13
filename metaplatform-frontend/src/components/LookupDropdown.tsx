import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { appServiceApi } from "@/lib/api";

/**
 * v1.0.2 Sprint 2 F1.4: 公开表单 lookup 字段下拉框.
 *
 * <p>渲染逻辑:
 * <ul>
 *   <li>从表单 schema 提取所有 lookup 字段 (boundObject + boundProperty/lookup.displayField)</li>
 *   <li>调用 GET /api/public/forms/{formId}/lookup-options 拿到所有 lookup 字段的选项</li>
 *   <li>每个 lookup 字段渲染为 <select>, 选项为 [{id, label}]</li>
 *   <li>value 为 FK ID (number), 显示为 label</li>
 * </ul>
 *
 * <p>组件本身可独立测试; 同时也暴露纯函数供单测.
 */
export interface LookupOption {
  id: number;
  label: string;
}

export interface LookupFieldConfig {
  field: string;
  label: string;
  required?: boolean;
  objectId: string | number;
  displayField: string;
  placeholder?: string;
  value: unknown;
  onChange: (value: string) => void;
  editable?: boolean;
}

/** 纯函数: 把 lookup-options API 响应转成 field -> options Map */
export function indexLookupOptions(
  response: Array<{ field: string; options: LookupOption[] }>,
): Map<string, LookupOption[]> {
  const map = new Map<string, LookupOption[]>();
  for (const item of response) {
    map.set(item.field, item.options);
  }
  return map;
}

/** 纯函数: 从 schema 提取所有 lookup 字段配置 */
export function extractLookupFields(
  schema: any,
): Array<{ field: string; objectId: string; displayField: string }> {
  const result: Array<{ field: string; objectId: string; displayField: string }> = [];
  if (!schema || typeof schema !== "object") return result;
  const sections: any[] = Array.isArray(schema)
    ? schema
    : Array.isArray(schema?.sections)
      ? schema.sections
      : [];
  for (const sec of sections) {
    if (!sec || typeof sec !== "object") continue;
    const fields: any[] = Array.isArray(sec.fields) ? sec.fields : [];
    for (const f of fields) {
      if (!f || typeof f !== "object") continue;
      const type = String(f.widget || f.type || "");
      if (type.toLowerCase() !== "lookup") continue;
      const fieldKey = String(f.field || f.key || f.name || "");
      const lookupObj = f.lookup && typeof f.lookup === "object" ? f.lookup : null;
      const objectId = lookupObj ? String(lookupObj.objectId ?? "") : String(f.boundObject ?? "");
      const displayField = lookupObj ? String(lookupObj.displayField ?? "") : String(f.boundProperty ?? "");
      if (!fieldKey || !objectId || !displayField) continue;
      result.push({ field: fieldKey, objectId, displayField });
    }
  }
  return result;
}

interface LookupDropdownProps {
  config: LookupFieldConfig;
  options: LookupOption[];
  loading: boolean;
}

const LookupDropdown: React.FC<LookupDropdownProps> = ({ config, options, loading }) => {
  const value = config.value == null ? "" : String(config.value);
  return (
    <select
      data-testid={`lookup-select-${config.field}`}
      data-object-id={config.objectId}
      data-display-field={config.displayField}
      value={value}
      onChange={(e) => config.onChange(e.target.value)}
      required={config.required}
      disabled={!config.editable || loading}
      className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:border-violet-400 focus:ring-2 focus:ring-violet-100 outline-none transition w-full"
    >
      <option value="">{config.placeholder || "— 请选择 —"}</option>
      {loading ? (
        <option value="" disabled>加载中...</option>
      ) : options.length === 0 ? (
        <option value="" disabled>暂无数据</option>
      ) : (
        options.map((opt) => (
          <option key={String(opt.id)} value={String(opt.id)}>
            {opt.label || `(无显示字段值 #${opt.id})`}
          </option>
        ))
      )}
    </select>
  );
};

export default LookupDropdown;