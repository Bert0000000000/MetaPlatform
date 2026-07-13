/**
 * IframePreview — AC-201.7 表单编辑器 iframe 预览组件
 *
 * 设计要点:
 * - 完全隔离的运行时: 通过 srcdoc 嵌入独立 HTML document, 不受父页面
 *   shadcn/Tailwind/主题 CSS 影响, 模拟真实"打开表单" 的环境.
 * - 同步 schema: 父组件 state 变化时, 把序列化后的 state 通过 postMessage
 *   推给 iframe, iframe 内重新渲染 (避免每次重建 iframe 导致闪烁).
 * - 内置渲染函数: 直接根据 DesignerState 渲染精简 DOM (input/label/textarea),
 *   不依赖任何 React, 体积小, 加载快.
 * - 设备适配: width 跟随 device (desktop/tablet/mobile) 模拟不同视口.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import type { DesignerState, DesignerField, DesignerSection } from "./DesignerTypes";

interface IframePreviewProps {
  state: DesignerState;
  /** 设备视口宽度 (px). 默认 1024 (desktop). */
  deviceWidth?: number;
  /** 设备视口高度 (px). 默认 720. */
  deviceHeight?: number;
}

const escapeHtml = (raw: unknown): string =>
  String(raw ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/** 把单个 field 渲染为简洁 HTML 控件 (input/textarea/select). */
function renderFieldHtml(field: DesignerField): string {
  const id = "f_" + field.id;
  const labelText = field.label || field.name || field.id;
  const required = field.required ? '<span style="color:#ef4444;margin-left:2px">*</span>' : "";
  const placeholder = field.placeholder ? ` placeholder="${escapeHtml(field.placeholder)}"` : "";
  const help = field.help ? `<div class="hint">${escapeHtml(field.help)}</div>` : "";

  let body = "";
  switch (field.type) {
    case "textarea":
    case "richtext":
      body = `<textarea id="${id}" ${placeholder} rows="3" disabled></textarea>`;
      break;
    case "number":
    case "currency":
    case "percent":
      body = `<input id="${id}" type="number" ${placeholder} disabled>`;
      break;
    case "datepicker":
      body = `<input id="${id}" type="date" ${placeholder} disabled>`;
      break;
    case "datetime":
      body = `<input id="${id}" type="datetime-local" ${placeholder} disabled>`;
      break;
    case "select":
      body = `<select id="${id}" disabled><option value="">-- 请选择 --</option>${(field.options || [])
        .map((o) => `<option value="${escapeHtml(o.value)}">${escapeHtml(o.label)}</option>`)
        .join("")}</select>`;
      break;
    case "radio":
      body = `<div class="options">${(field.options || [])
        .map(
          (o) =>
            `<label><input type="radio" name="${id}" disabled> ${escapeHtml(o.label)}</label>`,
        )
        .join("")}</div>`;
      break;
    case "checkbox":
      body = `<div class="options">${(field.options || [])
        .map(
          (o) =>
            `<label><input type="checkbox" disabled> ${escapeHtml(o.label)}</label>`,
        )
        .join("")}</div>`;
      break;
    case "switch":
      body = `<label class="switch"><input type="checkbox" disabled><span class="slider"></span></label>`;
      break;
    case "rate":
      body = `<div class="rate">★★★★★</div>`;
      break;
    case "file":
      body = `<div class="upload">📎 点击上传</div>`;
      break;
    case "image":
      body = `<div class="upload">🖼️ 点击上传</div>`;
      break;
    case "signature":
      body = `<div class="upload">✍️ 点击签名</div>`;
      break;
    case "heading":
      body = `<h3>${escapeHtml(field.text || labelText)}</h3>`;
      break;
    case "divider":
      body = `<hr>`;
      break;
    default:
      body = `<input id="${id}" type="text" ${placeholder} disabled>`;
  }

  // 布局型字段直接显示 body, 不需要 label 包裹
  if (field.type === "heading" || field.type === "divider") {
    return `<div class="field field-layout">${body}</div>`;
  }

  return `<div class="field"><label for="${id}">${escapeHtml(labelText)}${required}</label>${body}${help}</div>`;
}

function renderSectionHtml(section: DesignerSection): string {
  const title = section.collapsed
    ? ""
    : `<div class="section-title">${escapeHtml(section.title)}</div>`;
  const cols = section.columns ?? 2;
  const fields = (section.fields || []).map(renderFieldHtml).join("");
  return `<div class="section" style="--cols:${cols}">${title}<div class="fields-grid" style="grid-template-columns:repeat(${cols},minmax(0,1fr))">${fields}</div></div>`;
}

function buildHtml(state: DesignerState): string {
  const pageName = state.pageName || "表单预览";
  const sections = (state.sections || []).map(renderSectionHtml).join("");
  const sectionsCount = (state.sections || []).length;
  const fieldsCount = (state.sections || []).reduce(
    (n, s) => n + (s.fields || []).length,
    0,
  );
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<title>${escapeHtml(pageName)} - 预览</title>
<style>
:root { color-scheme: light; }
* { box-sizing: border-box; }
body { margin:0; font:14px/1.55 -apple-system,"Segoe UI","PingFang SC",Helvetica,Arial,sans-serif; background:#f8fafc; color:#0f172a; }
.container { max-width:720px; margin:0 auto; padding:24px 16px 80px; }
.page-header { background:#fff; border:1px solid #e2e8f0; border-radius:8px; padding:16px 20px; margin-bottom:16px; }
.page-header h1 { margin:0 0 4px; font-size:18px; }
.page-header .meta { font-size:12px; color:#64748b; }
.badge { display:inline-block; background:#dbeafe; color:#1e40af; font-size:11px; padding:2px 8px; border-radius:999px; margin-right:8px; }
.section { background:#fff; border:1px solid #e2e8f0; border-radius:8px; padding:16px; margin-bottom:12px; }
.section-title { font-size:13px; font-weight:600; color:#475569; margin-bottom:12px; padding-bottom:8px; border-bottom:1px solid #f1f5f9; }
.fields-grid { display:grid; gap:12px; }
.field { display:flex; flex-direction:column; gap:4px; min-width:0; }
.field label { font-size:12px; color:#475569; font-weight:500; }
.field input, .field textarea, .field select {
  font: inherit; padding:6px 10px; border:1px solid #cbd5e1; border-radius:6px;
  background:#f8fafc; color:#94a3b8; cursor:not-allowed; width:100%;
}
.field textarea { resize:vertical; min-height:60px; }
.field .hint { font-size:11px; color:#94a3b8; }
.options { display:flex; flex-wrap:wrap; gap:12px; padding:6px 0; }
.options label { display:flex; align-items:center; gap:4px; font-weight:normal; color:#475569; }
.switch { position:relative; display:inline-block; width:36px; height:20px; }
.switch input { opacity:0; width:0; height:0; }
.switch .slider { position:absolute; cursor:not-allowed; inset:0; background:#cbd5e1; border-radius:999px; }
.switch .slider::before { content:""; position:absolute; height:14px; width:14px; left:3px; top:3px; background:#fff; border-radius:50%; }
.rate { font-size:18px; color:#cbd5e1; letter-spacing:2px; padding:4px 0; }
.upload { padding:14px; border:1px dashed #cbd5e1; border-radius:6px; text-align:center; color:#94a3b8; font-size:12px; }
hr { border:none; border-top:1px solid #e2e8f0; margin:8px 0; }
.empty { text-align:center; padding:48px 16px; color:#94a3b8; font-size:13px; }
</style></head>
<body>
<div class="container">
  <div class="page-header">
    <span class="badge">表单预览</span>
    <h1>${escapeHtml(pageName)}</h1>
    <div class="meta">${sectionsCount} 个分区 · ${fieldsCount} 个字段</div>
  </div>
  ${sections || '<div class="empty">尚未添加任何字段</div>'}
</div>
<script>
  // 接收父页面 postMessage 推送新 state
  window.addEventListener("message", function (event) {
    var data = event.data;
    if (!data || data.type !== "preview-state" || !data.html) return;
    var doc = document.open("text/html", "replace");
    doc.write(data.html);
    doc.close();
  });
  // 通知父页面 iframe 已就绪
  parent.postMessage({ type: "preview-ready" }, "*");
</script>
</body></html>`;
}

export const IframePreview: React.FC<IframePreviewProps> = ({
  state,
  deviceWidth = 1024,
  deviceHeight = 720,
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);

  const html = useMemo(() => buildHtml(state), [state]);

  // 接收 iframe "ready" 信号
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === "preview-ready") {
        setReady(true);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // state 变化时, 通过 postMessage 推送新 HTML 触发 iframe 局部刷新
  useEffect(() => {
    if (!ready) return;
    iframeRef.current?.contentWindow?.postMessage(
      { type: "preview-state", html },
      "*",
    );
  }, [html, ready]);

  // 首次加载使用 srcDoc 完整构建 (避免 ready 等待期空白)
  return (
    <div className="flex h-full w-full flex-col items-center justify-center bg-muted/30 p-4">
      <div
        className="border bg-background shadow-sm transition-all"
        style={{ width: deviceWidth, maxWidth: "100%", height: deviceHeight }}
      >
        <iframe
          ref={iframeRef}
          title="form-preview-iframe"
          srcDoc={html}
          className="h-full w-full"
          sandbox="allow-same-origin allow-scripts"
          data-testid="preview-iframe"
        />
      </div>
      <div className="mt-2 text-xs text-muted-foreground">
        iframe 预览 · {deviceWidth}×{deviceHeight} ·{" "}
        {state.sections?.length ?? 0} 个分区 ·{" "}
        {(state.sections || []).reduce((n, s) => n + (s.fields || []).length, 0)} 个字段
      </div>
    </div>
  );
};

export default IframePreview;