import Editor from "@monaco-editor/react";

interface CodeEditorProps {
  language: string; // "javascript" | "typescript" | "html" | "css" | "json" | "sql" | "python" | "java"
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  height?: string;
  theme?: "light" | "dark";
}

export function CodeEditor({ language, value, onChange, readOnly, height = "400px", theme = "dark" }: CodeEditorProps) {
  return (
    <div className="border rounded-md overflow-hidden">
      <Editor
        height={height}
        language={language}
        value={value}
        onChange={(v) => onChange(v || "")}
        theme={theme === "dark" ? "vs-dark" : "light"}
        options={{
          readOnly,
          minimap: { enabled: false },
          fontSize: 13,
          lineNumbers: "on",
          scrollBeyondLastLine: false,
          wordWrap: "on",
          tabSize: 2,
        }}
      />
    </div>
  );
}
