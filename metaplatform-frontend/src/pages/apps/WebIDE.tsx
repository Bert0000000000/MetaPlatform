import { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CodeEditor } from "@/components/CodeEditor";
import { filesystemApi } from "@/lib/api";
import {
  FileCode, Folder, FolderOpen, Play, Terminal as TerminalIcon, Settings,
  ChevronRight, ChevronDown, Save, Wand2, X, Plus, Square,
  FileJson, FileText, File, Braces, Search, GitBranch, Maximize2, Minimize2,
  Copy, Download, RefreshCw,
} from "lucide-react";

/* ── File tree types ── */
interface FileNode {
  name: string;
  type: "file" | "folder";
  children?: FileNode[];
  language?: string;
  content?: string;
  expanded?: boolean;
}

/* ── Sample React project ── */
// TODO: Replace with real API when backend ready (no file system API endpoint exists for code editor)
const INITIAL_TREE: FileNode[] = [
  {
    name: "src",
    type: "folder",
    expanded: true,
    children: [
      {
        name: "components",
        type: "folder",
        expanded: false,
        children: [
          {
            name: "Button.tsx",
            type: "file",
            language: "typescript",
            content: `import React from "react";

interface ButtonProps {
  variant?: "primary" | "secondary" | "outline";
  size?: "sm" | "md" | "lg";
  children: React.ReactNode;
  onClick?: () => void;
}

export function Button({ variant = "primary", size = "md", children, onClick }: ButtonProps) {
  const base = "rounded-md font-medium transition-colors";
  const variants = {
    primary: "bg-blue-600 text-white hover:bg-blue-700",
    secondary: "bg-gray-200 text-gray-900 hover:bg-gray-300",
    outline: "border border-gray-300 hover:bg-gray-50",
  };
  const sizes = { sm: "px-3 py-1 text-sm", md: "px-4 py-2", lg: "px-6 py-3 text-lg" };

  return (
    <button className={\`\${base} \${variants[variant]} \${sizes[size]}\`} onClick={onClick}>
      {children}
    </button>
  );
}`,
          },
          {
            name: "Card.tsx",
            type: "file",
            language: "typescript",
            content: `import React from "react";

interface CardProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export function Card({ title, children, className = "" }: CardProps) {
  return (
    <div className={\`rounded-lg border bg-white shadow-sm \${className}\`}>
      {title && (
        <div className="border-b px-4 py-3">
          <h3 className="font-semibold text-sm">{title}</h3>
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
}`,
          },
        ],
      },
      {
        name: "pages",
        type: "folder",
        expanded: true,
        children: [
          {
            name: "App.tsx",
            type: "file",
            language: "typescript",
            content: `import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Home } from "./Home";
import { Dashboard } from "./Dashboard";

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50">
        <header className="border-b bg-white px-6 py-3">
          <h1 className="text-lg font-bold">My React App</h1>
        </header>
        <main className="container mx-auto p-6">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/dashboard" element={<Dashboard />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}`,
          },
          {
            name: "Home.tsx",
            type: "file",
            language: "typescript",
            content: `import { Card } from "../components/Card";
import { Button } from "../components/Button";

export function Home() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Welcome Home</h2>
      <div className="grid grid-cols-3 gap-4">
        <Card title="Stats">
          <p className="text-3xl font-bold text-blue-600">1,234</p>
          <p className="text-sm text-gray-500">Total Users</p>
        </Card>
        <Card title="Revenue">
          <p className="text-3xl font-bold text-green-600">$56,789</p>
          <p className="text-sm text-gray-500">This Month</p>
        </Card>
        <Card title="Orders">
          <p className="text-3xl font-bold text-purple-600">892</p>
          <p className="text-sm text-gray-500">Pending</p>
        </Card>
      </div>
      <Button variant="primary" onClick={() => navigate("/dashboard")}>
        Get Started
      </Button>
    </div>
  );
}`,
          },
          {
            name: "Dashboard.tsx",
            type: "file",
            language: "typescript",
            content: `export function Dashboard() {
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Dashboard</h2>
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border bg-white p-4">
          <h3 className="font-semibold mb-2">Activity</h3>
          <div className="h-40 bg-gradient-to-r from-blue-100 to-purple-100 rounded flex items-center justify-center text-gray-400">
            Chart Placeholder
          </div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <h3 className="font-semibold mb-2">Recent</h3>
          <ul className="space-y-2 text-sm">
            <li className="flex justify-between"><span>User signup</span><span className="text-gray-400">2m ago</span></li>
            <li className="flex justify-between"><span>Order #1234</span><span className="text-gray-400">5m ago</span></li>
            <li className="flex justify-between"><span>Payment received</span><span className="text-gray-400">10m ago</span></li>
          </ul>
        </div>
      </div>
    </div>
  );
}`,
          },
        ],
      },
      {
        name: "styles",
        type: "folder",
        expanded: false,
        children: [
          {
            name: "globals.css",
            type: "file",
            language: "css",
            content: `@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --primary: #3b82f6;
  --secondary: #6b7280;
  --background: #f9fafb;
}

body {
  font-family: 'Inter', system-ui, sans-serif;
  background: var(--background);
  color: #111827;
}`,
          },
        ],
      },
      {
        name: "index.tsx",
        type: "file",
        language: "typescript",
        content: `import React from "react";
import ReactDOM from "react-dom/client";
import App from "./pages/App";
import "./styles/globals.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`,
      },
    ],
  },
  {
    name: "package.json",
    type: "file",
    language: "json",
    content: `{
  "name": "my-react-app",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-router-dom": "^7.1.1"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "typescript": "~5.7.0",
    "vite": "^7.0.0",
    "tailwindcss": "^4.0.0"
  }
}`,
  },
  {
    name: "tsconfig.json",
    type: "file",
    language: "json",
    content: `{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["src"]
}`,
  },
  {
    name: "index.html",
    type: "file",
    language: "html",
    content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>My React App</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/index.tsx"></script>
</body>
</html>`,
  },
];

/* ── Build tree from flat filesystem API response ── */
function buildTreeFromFlat(files: any[]): FileNode[] {
  const nodeMap = new Map<string, FileNode>();
  const roots: FileNode[] = [];

  // First pass: create all nodes
  for (const f of files) {
    nodeMap.set(f.id, {
      name: f.name,
      type: f.is_dir ? "folder" : "file",
      children: f.is_dir ? [] : undefined,
      language: f.is_dir ? undefined : getLanguage(f.name),
      content: f.content || "",
      expanded: false,
    });
  }

  // Second pass: build parent-child relationships
  for (const f of files) {
    const node = nodeMap.get(f.id)!;
    if (f.parent_id && nodeMap.has(f.parent_id)) {
      nodeMap.get(f.parent_id)!.children!.push(node);
    } else if (!f.parent_id) {
      roots.push(node);
    }
  }

  // Expand top-level folders
  for (const root of roots) {
    if (root.type === "folder") root.expanded = true;
  }

  return roots;
}

/* ── Open file entry ── */
interface OpenFile {
  path: string;
  name: string;
  language: string;
  content: string;
  modified: boolean;
}

/* ── Flatten tree to get all files ── */
function flattenTree(nodes: FileNode[], prefix = ""): { path: string; node: FileNode }[] {
  const result: { path: string; node: FileNode }[] = [];
  for (const node of nodes) {
    const path = prefix ? `${prefix}/${node.name}` : node.name;
    if (node.type === "file") {
      result.push({ path, node });
    }
    if (node.children) {
      result.push(...flattenTree(node.children, path));
    }
  }
  return result;
}

/* ── File icon helper ── */
function getFileIcon(name: string) {
  if (name.endsWith(".tsx") || name.endsWith(".ts")) return <FileCode className="size-3.5 text-blue-500" />;
  if (name.endsWith(".json")) return <FileJson className="size-3.5 text-yellow-500" />;
  if (name.endsWith(".css")) return <Braces className="size-3.5 text-pink-500" />;
  if (name.endsWith(".html")) return <FileText className="size-3.5 text-orange-500" />;
  if (name.endsWith(".js")) return <FileCode className="size-3.5 text-yellow-400" />;
  return <File className="size-3.5 text-gray-400" />;
}

function getLanguage(name: string): string {
  if (name.endsWith(".tsx") || name.endsWith(".ts")) return "typescript";
  if (name.endsWith(".json")) return "json";
  if (name.endsWith(".css")) return "css";
  if (name.endsWith(".html")) return "html";
  if (name.endsWith(".js")) return "javascript";
  if (name.endsWith(".py")) return "python";
  if (name.endsWith(".java")) return "java";
  if (name.endsWith(".sql")) return "sql";
  return "plaintext";
}

/* ── FileTree component ── */
function FileTree({ nodes, onOpen, depth = 0 }: { nodes: FileNode[]; onOpen: (path: string, node: FileNode) => void; depth?: number }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {};
    function walk(nodes: FileNode[]) {
      for (const n of nodes) {
        if (n.type === "folder" && n.expanded) map[n.name] = true;
        if (n.children) walk(n.children);
      }
    }
    walk(nodes);
    return map;
  });

  function toggle(name: string) {
    setExpanded((e) => ({ ...e, [name]: !e[name] }));
  }

  return (
    <>
      {nodes.map((node) => {
        const isFolder = node.type === "folder";
        const isOpen = expanded[node.name];
        return (
          <div key={node.name}>
            <div
              className="flex items-center gap-1.5 py-0.5 px-1 rounded cursor-pointer hover:bg-accent text-xs select-none group"
              style={{ paddingLeft: `${depth * 12 + 4}px` }}
              onClick={() => {
                if (isFolder) toggle(node.name);
                else onOpen(node.name, node);
              }}
            >
              {isFolder ? (
                <>
                  {isOpen ? <ChevronDown className="size-3 shrink-0" /> : <ChevronRight className="size-3 shrink-0" />}
                  {isOpen ? <FolderOpen className="size-3.5 text-blue-500" /> : <Folder className="size-3.5 text-blue-500" />}
                </>
              ) : (
                <>
                  <span className="w-3" />
                  {getFileIcon(node.name)}
                </>
              )}
              <span className="truncate">{node.name}</span>
            </div>
            {isFolder && isOpen && node.children && (
              <FileTree nodes={node.children} onOpen={onOpen} depth={depth + 1} />
            )}
          </div>
        );
      })}
    </>
  );
}

/* ── Terminal component ── */
function TerminalPanel({ logs }: { logs: string[] }) {
  return (
    <div className="h-full font-mono text-xs bg-[#1e1e1e] text-green-400 p-3 overflow-auto">
      {logs.map((line, i) => (
        <div key={i} className="whitespace-pre">{line}</div>
      ))}
      <div className="flex items-center gap-1 mt-1">
        <span className="text-blue-400">$</span>
        <span className="animate-pulse">_</span>
      </div>
    </div>
  );
}

/* ── Main WebIDE ── */
export default function WebIDE() {
  const [tree, setTree] = useState<FileNode[]>(INITIAL_TREE);
  const [showTerminal, setShowTerminal] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  /* Fetch file tree from filesystem API */
  useEffect(() => {
    filesystemApi.listFiles({ app_id: "app-vibe" }).then((data) => {
      if (data && data.length > 0) {
        setTree(buildTreeFromFlat(data));
      }
    }).catch(() => {});
  }, []);

  const [openFiles, setOpenFiles] = useState<OpenFile[]>(() => {
    // Open App.tsx by default
    const allFiles = flattenTree(tree);
    const appFile = allFiles.find((f) => f.path === "App.tsx" || f.path.endsWith("/App.tsx"));
    if (appFile) {
      return [{
        path: appFile.path,
        name: appFile.node.name,
        language: appFile.node.language || getLanguage(appFile.node.name),
        content: appFile.node.content || "",
        modified: false,
      }];
    }
    return [];
  });
  const [activeTab, setActiveTab] = useState<string>("App.tsx");
  const [terminalLogs, setTerminalLogs] = useState<string[]>([
    "[info] WebIDE initialized",
    "[info] Project loaded: my-react-app",
    "[info] TypeScript 5.7.3",
    "[info] Vite 7.0.0 ready",
  ]);

  const openFile = useCallback((path: string, node: FileNode) => {
    const existing = openFiles.find((f) => f.name === node.name);
    if (existing) {
      setActiveTab(existing.name);
      return;
    }
    const lang = node.language || getLanguage(node.name);
    setOpenFiles((prev) => [...prev, {
      path,
      name: node.name,
      language: lang,
      content: node.content || "",
      modified: false,
    }]);
    setActiveTab(node.name);
  }, [openFiles]);

  const closeFile = useCallback((name: string) => {
    setOpenFiles((prev) => {
      const filtered = prev.filter((f) => f.name !== name);
      if (activeTab === name && filtered.length > 0) {
        setActiveTab(filtered[filtered.length - 1].name);
      }
      return filtered;
    });
  }, [activeTab]);

  const updateContent = useCallback((name: string, content: string) => {
    setOpenFiles((prev) => prev.map((f) => f.name === name ? { ...f, content, modified: true } : f));
  }, []);

  const activeFile = openFiles.find((f) => f.name === activeTab);

  function handleRun() {
    setTerminalLogs((prev) => [
      ...prev,
      `\n$ npm run dev`,
      "> vite v7.0.0 dev server starting...",
      "> Local:   http://localhost:5173/",
      "> Network: http://192.168.1.100:5173/",
      "> ready in 320ms",
      `[info] HMR updated ${openFiles.filter((f) => f.modified).length} module(s)`,
    ]);
  }

  function handleBuild() {
    setTerminalLogs((prev) => [
      ...prev,
      `\n$ npm run build`,
      "> tsc -b && vite build",
      "> vite v7.0.0 building for production...",
      "> transforming...",
      "> rendering chunks...",
      "> computing gzip size...",
      "> dist/index.html               0.45 kB | gzip: 0.30 kB",
      "> dist/assets/index-Bk2x1a.js  142.56 kB | gzip: 45.12 kB",
      "> built in 2.84s",
      "[success] Build complete!",
    ]);
  }

  function handleFormat() {
    if (activeFile) {
      setTerminalLogs((prev) => [
        ...prev,
        `\n[info] Formatted ${activeFile.name} with Prettier`,
      ]);
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-100px)]">
      {/* Top toolbar */}
      <div className="flex items-center justify-between border-b px-3 py-1.5 bg-background">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="h-7 gap-1" onClick={handleRun}>
            <Play className="size-3 text-green-500" /> Run
          </Button>
          <Button variant="ghost" size="sm" className="h-7 gap-1" onClick={handleBuild}>
            <Square className="size-3 text-orange-500" /> Build
          </Button>
          <div className="w-px h-4 bg-border mx-1" />
          <Button variant="ghost" size="sm" className="h-7 gap-1" onClick={handleFormat}>
            <Wand2 className="size-3" /> Format
          </Button>
          <Button variant="ghost" size="sm" className="h-7 gap-1" onClick={() => {
            setTerminalLogs((prev) => [...prev, `\n[info] Saving ${activeFile?.name || "all files"}...`]);
          }}>
            <Save className="size-3" /> Save
          </Button>
          <div className="w-px h-4 bg-border mx-1" />
          <Button variant="ghost" size="sm" className="h-7 gap-1">
            <Search className="size-3" /> Search
          </Button>
          <Button variant="ghost" size="sm" className="h-7 gap-1">
            <GitBranch className="size-3" /> main
          </Button>
        </div>
        <div className="flex items-center gap-1">
          <Badge variant="secondary" className="text-[10px]">TypeScript</Badge>
          <Badge variant="secondary" className="text-[10px]">Vite 7.0</Badge>
          <Button variant="ghost" size="icon" className="size-7">
            <Settings className="size-3" />
          </Button>
        </div>
      </div>

      {/* Main area */}
      <div className="flex flex-1 min-h-0">
        {/* Sidebar - File Explorer */}
        {!sidebarCollapsed && (
          <div className="w-60 border-r flex flex-col bg-background shrink-0">
            <div className="flex items-center justify-between px-3 py-2 border-b">
              <span className="text-xs font-semibold uppercase text-muted-foreground">Explorer</span>
              <div className="flex gap-0.5">
                <Button variant="ghost" size="icon" className="size-5">
                  <Plus className="size-3" />
                </Button>
                <Button variant="ghost" size="icon" className="size-5" onClick={() => setSidebarCollapsed(true)}>
                  <Minimize2 className="size-3" />
                </Button>
              </div>
            </div>
            <ScrollArea className="flex-1">
              <div className="py-1">
                <FileTree nodes={tree} onOpen={openFile} />
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Editor + Terminal */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Tabs */}
          <div className="flex items-center border-b bg-muted/30 overflow-x-auto">
            {sidebarCollapsed && (
              <Button variant="ghost" size="icon" className="size-7 shrink-0 ml-1" onClick={() => setSidebarCollapsed(false)}>
                <Maximize2 className="size-3" />
              </Button>
            )}
            {openFiles.map((f) => (
              <div
                key={f.name}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs border-r cursor-pointer shrink-0 transition-colors ${
                  f.name === activeTab ? "bg-background text-foreground" : "text-muted-foreground hover:bg-accent"
                }`}
                onClick={() => setActiveTab(f.name)}
              >
                {getFileIcon(f.name)}
                <span>{f.name}</span>
                {f.modified && <span className="size-1.5 rounded-full bg-orange-500" />}
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-4 ml-1 opacity-0 group-hover:opacity-100 hover:opacity-100"
                  onClick={(e) => { e.stopPropagation(); closeFile(f.name); }}
                >
                  <X className="size-2.5" />
                </Button>
              </div>
            ))}
          </div>

          {/* Code Editor */}
          <div className={`flex-1 min-h-0 ${showTerminal ? "h-1/2" : "h-full"}`}>
            {activeFile ? (
              <CodeEditor
                language={activeFile.language}
                value={activeFile.content}
                onChange={(v) => updateContent(activeFile.name, v)}
                height="100%"
                theme="dark"
              />
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <FileCode className="size-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Open a file to start editing</p>
                </div>
              </div>
            )}
          </div>

          {/* Terminal */}
          <div className={`border-t ${showTerminal ? "h-48" : "h-8"} flex flex-col shrink-0 transition-all`}>
            <div className="flex items-center justify-between px-3 py-1 border-b bg-muted/30">
              <div className="flex items-center gap-3">
                <button
                  className="flex items-center gap-1 text-xs font-medium"
                  onClick={() => setShowTerminal(!showTerminal)}
                >
                  <TerminalIcon className="size-3" /> Terminal
                </button>
                <button
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    setTerminalLogs([]);
                  }}
                >
                  <RefreshCw className="size-2.5" /> Clear
                </button>
              </div>
              <div className="flex gap-0.5">
                <Button variant="ghost" size="icon" className="size-5">
                  <Plus className="size-2.5" />
                </Button>
                <Button variant="ghost" size="icon" className="size-5" onClick={() => setShowTerminal(!showTerminal)}>
                  {showTerminal ? <Minimize2 className="size-2.5" /> : <Maximize2 className="size-2.5" />}
                </Button>
              </div>
            </div>
            {showTerminal && <TerminalPanel logs={terminalLogs} />}
          </div>
        </div>
      </div>
    </div>
  );
}
