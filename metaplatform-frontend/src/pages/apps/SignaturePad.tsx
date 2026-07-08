import { useState, useRef, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  PenTool, Undo2, Trash2, Save, CheckCircle, Download,
  Circle, Square, Stamp, User, Palette, Sliders
} from "lucide-react";

// Seal template types
type SealTemplate = "round-company" | "rect-stamp" | "personal-signature" | "custom";

interface SealPreset {
  id: SealTemplate;
  name: string;
  icon: typeof Circle;
  description: string;
  color: string;
  size: number;
}

const SEAL_PRESETS: SealPreset[] = [
  { id: "round-company", name: "圆形公章", icon: Circle, description: "公司圆形印章", color: "#DC2626", size: 120 },
  { id: "rect-stamp", name: "方形印章", icon: Square, description: "方形业务章", color: "#DC2626", size: 100 },
  { id: "personal-signature", name: "个人签名", icon: User, description: "个人手写签名", color: "#2563EB", size: 80 },
  { id: "custom", name: "自定义", icon: Stamp, description: "自定义签章", color: "#16A34A", size: 100 },
];

interface SignaturePadProps {
  onSave?: (data: { dataUrl: string; template: SealTemplate; color: string }) => void;
  onApply?: (data: { dataUrl: string; template: SealTemplate }) => void;
  initialTemplate?: SealTemplate;
}

export default function SignaturePad({ onSave, onApply, initialTemplate = "personal-signature" }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [template, setTemplate] = useState<SealTemplate>(initialTemplate);
  const [color, setColor] = useState("#2563EB");
  const [lineWidth, setLineWidth] = useState(3);
  const [undoStack, setUndoStack] = useState<ImageData[]>([]);
  const [hasContent, setHasContent] = useState(false);
  const [savedDataUrl, setSavedDataUrl] = useState<string | null>(null);

  const currentPreset = SEAL_PRESETS.find((p) => p.id === template) || SEAL_PRESETS[0];

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = 500;
    canvas.height = 300;
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawSealPreview(ctx, canvas.width, canvas.height);
  }, [template, color]);

  const drawSealPreview = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2;

    const cx = w / 2;
    const cy = h / 2;
    const size = Math.min(w, h) * 0.35;

    if (template === "round-company") {
      // Round company seal
      ctx.beginPath();
      ctx.arc(cx, cy, size, 0, Math.PI * 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(cx, cy, size * 0.85, 0, Math.PI * 2);
      ctx.stroke();

      // Star in center
      drawStar(ctx, cx, cy, size * 0.3, 5);

      // Text around
      ctx.font = `bold ${size * 0.15}px serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("公司印章", cx, cy + size * 0.55);
    } else if (template === "rect-stamp") {
      // Rectangular stamp
      const rw = size * 1.8;
      const rh = size * 0.8;
      ctx.strokeRect(cx - rw / 2, cy - rh / 2, rw, rh);
      ctx.font = `bold ${size * 0.25}px serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("业务专用章", cx, cy);
    } else if (template === "personal-signature") {
      // Signature line
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(cx - size, cy + size * 0.3);
      ctx.lineTo(cx + size, cy + size * 0.3);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.font = `italic ${size * 0.3}px cursive`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("签名区", cx, cy);
    } else {
      // Custom stamp
      ctx.beginPath();
      ctx.arc(cx, cy, size, 0, Math.PI * 2);
      ctx.stroke();
      ctx.font = `bold ${size * 0.2}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("自定义", cx, cy);
    }

    ctx.restore();
  }, [template, color]);

  const drawStar = (ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, points: number) => {
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const radius = i % 2 === 0 ? r : r * 0.4;
      const angle = (Math.PI * i) / points - Math.PI / 2;
      const x = cx + radius * Math.cos(angle);
      const y = cy + radius * Math.sin(angle);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  };

  const saveToUndoStack = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setUndoStack((prev) => [...prev.slice(-20), imageData]);
  }, []);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    saveToUndoStack();
    setIsDrawing(true);
    setHasContent(true);

    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const handleUndo = () => {
    const canvas = canvasRef.current;
    if (!canvas || undoStack.length === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const lastState = undoStack[undoStack.length - 1];
    ctx.putImageData(lastState, 0, 0);
    setUndoStack((prev) => prev.slice(0, -1));
    if (undoStack.length <= 1) setHasContent(false);
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    saveToUndoStack();
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawSealPreview(ctx, canvas.width, canvas.height);
    setHasContent(false);
    setSavedDataUrl(null);
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    setSavedDataUrl(dataUrl);
    onSave?.({ dataUrl, template, color });
  };

  const handleApply = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    onApply?.({ dataUrl, template });
  };

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.download = `签章_${template}_${Date.now()}.png`;
    link.href = dataUrl;
    link.click();
  };

  return (
    <div className="p-6 w-full space-y-4">
      {/* Seal Template Selection */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Stamp className="size-4" /> 签章模板
          </CardTitle>
          <CardDescription>选择签章类型或自定义</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-3">
            {SEAL_PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => setTemplate(preset.id)}
                className={`p-3 border rounded-lg text-center transition-all ${
                  template === preset.id
                    ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                    : "hover:border-primary/50"
                }`}
              >
                <preset.icon className="size-8 mx-auto mb-2" style={{ color: preset.color }} />
                <div className="text-sm font-medium">{preset.name}</div>
                <div className="text-xs text-muted-foreground">{preset.description}</div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Canvas Area */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <PenTool className="size-4" /> 签章画布
          </CardTitle>
          <CardDescription>在画布上绘制签章或手写签名</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            {/* Tools Panel */}
            <div className="w-48 space-y-4">
              {/* Color Picker */}
              <div>
                <Label className="text-xs flex items-center gap-1 mb-2">
                  <Palette className="size-3" /> 签章颜色
                </Label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { name: "红色(公章)", value: "#DC2626" },
                    { name: "蓝色(签名)", value: "#2563EB" },
                    { name: "黑色", value: "#1F2937" },
                    { name: "绿色", value: "#16A34A" },
                  ].map((c) => (
                    <button
                      key={c.value}
                      onClick={() => setColor(c.value)}
                      className={`size-8 rounded-full border-2 transition-all ${
                        color === c.value ? "border-gray-800 scale-110" : "border-gray-200"
                      }`}
                      style={{ backgroundColor: c.value }}
                      title={c.name}
                    />
                  ))}
                </div>
                <div className="mt-2">
                  <Input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="h-8 w-full cursor-pointer"
                  />
                </div>
              </div>

              {/* Line Width */}
              <div>
                <Label className="text-xs flex items-center gap-1 mb-2">
                  <Sliders className="size-3" /> 笔画粗细: {lineWidth}px
                </Label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={lineWidth}
                  onChange={(e) => setLineWidth(parseInt(e.target.value))}
                  className="w-full"
                />
              </div>

              {/* Actions */}
              <div className="space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={handleUndo}
                  disabled={undoStack.length === 0}
                >
                  <Undo2 className="size-3 mr-1" />
                  撤销
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={handleClear}
                >
                  <Trash2 className="size-3 mr-1" />
                  清除
                </Button>
              </div>
            </div>

            {/* Canvas */}
            <div className="flex-1">
              <div className="border-2 border-dashed rounded-lg p-2 bg-gray-50">
                <canvas
                  ref={canvasRef}
                  className="w-full cursor-crosshair rounded"
                  style={{ aspectRatio: "5/3" }}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                />
              </div>
              <div className="flex items-center justify-between mt-2">
                <div className="text-xs text-muted-foreground">
                  {hasContent ? "已有签章内容" : "请在画布上绘制"}
                </div>
                {savedDataUrl && (
                  <Badge variant="secondary" className="text-green-600">
                    <CheckCircle className="size-3 mr-1" /> 已保存
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Preview & Actions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">签章预览与操作</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            {/* Preview */}
            <div className="w-48 h-28 border rounded-lg flex items-center justify-center bg-white">
              {savedDataUrl ? (
                <img src={savedDataUrl} alt="签章预览" className="max-w-full max-h-full object-contain" />
              ) : (
                <div className="text-sm text-muted-foreground">保存后预览</div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline">{currentPreset.name}</Badge>
                <Badge variant="secondary">{color}</Badge>
                <Badge variant="secondary">笔画: {lineWidth}px</Badge>
              </div>
              <div className="text-sm text-muted-foreground">
                当前模板: {currentPreset.description}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-2">
              <Button size="sm" onClick={handleSave}>
                <Save className="size-3 mr-1" />
                保存签章
              </Button>
              <Button size="sm" variant="outline" onClick={handleDownload}>
                <Download className="size-3 mr-1" />
                下载
              </Button>
              <Button
                size="sm"
                variant="default"
                onClick={handleApply}
                disabled={!savedDataUrl}
              >
                <CheckCircle className="size-3 mr-1" />
                应用到页面
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Export helper for generating seal SVG
export function generateSealSVG(template: SealTemplate, color: string = "#DC2626", text: string = "公司印章"): string {
  const size = 200;
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.4;

  if (template === "round-company") {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="3"/>
      <circle cx="${cx}" cy="${cy}" r="${r * 0.85}" fill="none" stroke="${color}" stroke-width="1.5"/>
      <polygon points="${Array.from({ length: 10 }, (_, i) => {
        const radius = i % 2 === 0 ? r * 0.3 : r * 0.12;
        const angle = (Math.PI * i) / 5 - Math.PI / 2;
        return `${cx + radius * Math.cos(angle)},${cy + radius * Math.sin(angle)}`;
      }).join(" ")}" fill="${color}"/>
      <text x="${cx}" y="${cy + r * 0.6}" text-anchor="middle" font-size="${r * 0.15}" font-weight="bold" fill="${color}">${text}</text>
    </svg>`;
  }

  if (template === "rect-stamp") {
    const w = r * 2;
    const h = r * 0.8;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size * 0.5}" viewBox="0 0 ${size} ${size * 0.5}">
      <rect x="${(size - w) / 2}" y="${(size * 0.5 - h) / 2}" width="${w}" height="${h}" fill="none" stroke="${color}" stroke-width="3" rx="4"/>
      <text x="${cx}" y="${size * 0.25}" text-anchor="middle" dominant-baseline="middle" font-size="${r * 0.25}" font-weight="bold" fill="${color}">${text}</text>
    </svg>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size * 0.5}" viewBox="0 0 ${size} ${size * 0.5}">
    <line x1="${size * 0.15}" y1="${size * 0.35}" x2="${size * 0.85}" y2="${size * 0.35}" stroke="${color}" stroke-width="1.5" stroke-dasharray="5,5"/>
    <text x="${cx}" y="${size * 0.25}" text-anchor="middle" dominant-baseline="middle" font-size="${r * 0.3}" font-style="italic" fill="${color}">签名</text>
  </svg>`;
}