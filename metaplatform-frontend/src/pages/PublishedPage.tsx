import { useState, useEffect } from "react";
import { Loader2, AlertCircle, FileText, Table, FormInput, LayoutGrid } from "lucide-react";

/* ─── Types ─────────────────────────────────────────────── */

interface AppPage {
  id: string;
  name: string;
  icon?: string;
  path?: string;
  schema?: Record<string, unknown>;
  type?: string;
}

interface PublishedAppData {
  id: string;
  name: string;
  description?: string;
  pages?: AppPage[];
}

interface PublishedPageProps {
  page: AppPage;
  app: PublishedAppData;
}

/* ─── Helpers ───────────────────────────────────────────── */

/**
 * Get an appropriate icon for the page type
 */
function getPageIcon(type?: string) {
  switch (type) {
    case "table":
    case "list":
      return Table;
    case "form":
      return FormInput;
    case "dashboard":
    case "grid":
      return LayoutGrid;
    default:
      return FileText;
  }
}

/* ─── Schema-based renderer ─────────────────────────────── */

/**
 * Renders page content based on the page schema.
 * This is a simplified version of the platform's SchemaRenderer
 * for published/public apps.
 */
function SchemaRenderer({ schema }: { schema: Record<string, unknown> }) {
  if (!schema) return null;

  const renderNode = (node: Record<string, unknown>, index: number): React.ReactNode => {
    const type = node.type as string;
    const props = (node.props || {}) as Record<string, unknown>;
    const children = node.children as Record<string, unknown>[] | undefined;
    const key = (node.id as string) || index;

    switch (type) {
      case "container":
      case "div":
        return (
          <div key={key} className="p-4" style={(props.style as React.CSSProperties) || {}}>
            {children?.map(renderNode)}
          </div>
        );

      case "card":
        return (
          <div
            key={key}
            className="bg-white rounded-lg border border-gray-200 p-4 mb-4"
            style={(props.style as React.CSSProperties) || {}}
          >
            {props.title && (
              <h3 className="text-base font-semibold text-gray-900 mb-3">
                {props.title as string}
              </h3>
            )}
            {children?.map(renderNode)}
          </div>
        );

      case "heading":
      case "title":
        return (
          <h2 key={key} className="text-xl font-semibold text-gray-900 mb-2">
            {(props.text as string) || ""}
          </h2>
        );

      case "paragraph":
      case "text":
        return (
          <p key={key} className="text-sm text-gray-600 mb-3">
            {(props.text as string) || (props.content as string) || ""}
          </p>
        );

      case "table":
        return <TableWidget key={key} props={props} />;

      case "form":
        return <FormWidget key={key} props={props} />;

      case "button":
        return (
          <button
            key={key}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
            style={(props.style as React.CSSProperties) || {}}
          >
            {(props.label as string) || (props.text as string) || "Button"}
          </button>
        );

      case "divider":
        return <hr key={key} className="my-4 border-gray-200" />;

      case "image":
        return (
          <img
            key={key}
            src={(props.src as string) || ""}
            alt={(props.alt as string) || ""}
            className="max-w-full rounded-md mb-3"
          />
        );

      case "chart":
        return (
          <div
            key={key}
            className="bg-gray-50 rounded-lg border border-dashed border-gray-300 p-8 mb-4 text-center"
          >
            <LayoutGrid className="size-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-400">Chart Widget</p>
          </div>
        );

      default:
        return (
          <div
            key={key}
            className="bg-gray-50 rounded-md p-4 mb-3 text-sm text-gray-500"
          >
            Unsupported component: {type}
            {children && children.length > 0 && <div className="mt-2">{children.map(renderNode)}</div>}
          </div>
        );
    }
  };

  // Handle schema that is a root node vs array of nodes
  if (Array.isArray(schema)) {
    return <>{schema.map((node, i) => renderNode(node as Record<string, unknown>, i))}</>;
  }

  if (schema.type) {
    return <>{renderNode(schema as Record<string, unknown>, 0)}</>;
  }

  // Schema with children array
  if (schema.children && Array.isArray(schema.children)) {
    return <>{(schema.children as Record<string, unknown>[]).map((node, i) => renderNode(node, i))}</>;
  }

  return null;
}

/* ─── Table Widget ──────────────────────────────────────── */

function TableWidget({ props }: { props: Record<string, unknown> }) {
  const columns = (props.columns || []) as Array<{ key: string; title: string; width?: number }>;
  const data = (props.data || props.dataSource || []) as Array<Record<string, unknown>>;

  if (columns.length === 0) {
    return (
      <div className="bg-gray-50 rounded-lg border border-dashed border-gray-300 p-6 mb-4 text-center">
        <Table className="size-6 text-gray-300 mx-auto mb-2" />
        <p className="text-sm text-gray-400">No data configured</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto mb-4">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            {columns.map((col) => (
              <th
                key={col.key}
                className="text-left px-4 py-2.5 font-medium text-gray-600"
                style={col.width ? { width: col.width } : undefined}
              >
                {col.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="text-center py-8 text-gray-400">
                No data available
              </td>
            </tr>
          ) : (
            data.map((row, i) => (
              <tr key={i} className="border-b border-gray-100 hover:bg-gray-50/50">
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-2.5 text-gray-700">
                    {String(row[col.key] ?? "")}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Form Widget ───────────────────────────────────────── */

function FormWidget({ props }: { props: Record<string, unknown> }) {
  const fields = (props.fields || []) as Array<{
    name: string;
    label: string;
    type: string;
    required?: boolean;
    placeholder?: string;
  }>;

  const [formData, setFormData] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const initial: Record<string, string> = {};
    for (const field of fields) {
      initial[field.name] = "";
    }
    setFormData(initial);
  }, [fields]);

  if (fields.length === 0) {
    return (
      <div className="bg-gray-50 rounded-lg border border-dashed border-gray-300 p-6 mb-4 text-center">
        <FormInput className="size-6 text-gray-300 mx-auto mb-2" />
        <p className="text-sm text-gray-400">No form fields configured</p>
      </div>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 3000);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 mb-4">
      {fields.map((field) => (
        <div key={field.name}>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {field.label}
            {field.required && <span className="text-red-400 ml-0.5">*</span>}
          </label>
          {field.type === "textarea" ? (
            <textarea
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder={field.placeholder || ""}
              value={formData[field.name] || ""}
              onChange={(e) => setFormData((prev) => ({ ...prev, [field.name]: e.target.value }))}
              rows={3}
            />
          ) : (
            <input
              type={field.type === "password" ? "password" : field.type === "number" ? "number" : "text"}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder={field.placeholder || ""}
              value={formData[field.name] || ""}
              onChange={(e) => setFormData((prev) => ({ ...prev, [field.name]: e.target.value }))}
              required={field.required}
            />
          )}
        </div>
      ))}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
        >
          Submit
        </button>
        {submitted && (
          <span className="text-sm text-green-600">Submitted successfully</span>
        )}
      </div>
    </form>
  );
}

/* ─── Main Component ────────────────────────────────────── */

export default function PublishedPage({ page, app }: PublishedPageProps) {
  const PageIcon = getPageIcon(page.type);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Page header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <PageIcon className="size-5 text-gray-400" />
          <h1 className="text-lg font-semibold text-gray-900">{page.name || page.id}</h1>
        </div>
        <p className="text-xs text-gray-400">
          {app.name} - {page.name}
        </p>
      </div>

      {/* Page content */}
      <div>
        {page.schema ? (
          <SchemaRenderer schema={page.schema as Record<string, unknown>} />
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <FileText className="size-10 text-gray-200 mx-auto mb-3" />
            <h3 className="text-sm font-medium text-gray-500 mb-1">Page Under Construction</h3>
            <p className="text-xs text-gray-400">This page has not been configured yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
