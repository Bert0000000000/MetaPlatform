import { useState } from "react";
import { Send, Bot, User, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const initialMessages: Message[] = [
  {
    role: "assistant",
    content:
      "你好，我是 SuperAI 🤖\n我可以帮你：\n• 建应用 / 建对象 / 建流程\n• 查数据 / 分析指标\n• 启动智能体 / 调度任务\n• 回答业务问题\n\n请告诉我你想做什么？",
  },
];

export function SuperAIPage() {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");

  function send() {
    if (!input.trim()) return;
    setMessages((m) => [
      ...m,
      { role: "user", content: input },
      {
        role: "assistant",
        content:
          "（这是占位响应）后端 AI Chat 服务接入后，将由 LLM Gateway 路由到合适的模型，返回流式响应。",
      },
    ]);
    setInput("");
  }

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">SuperAI</h1>
          <p className="text-xs text-muted-foreground">
            AI 对话入口 · ⌘K 全局唤起
          </p>
        </div>
        <Button variant="outline" size="sm">
          历史对话
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-3xl flex flex-col gap-4">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex gap-3 ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {m.role === "assistant" && (
                <div className="size-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                  <Bot className="size-4" />
                </div>
              )}
              <Card
                className={`max-w-[80%] ${m.role === "user" ? "bg-primary text-primary-foreground" : ""}`}
              >
                <CardContent className="p-3">
                  <p className="text-sm whitespace-pre-wrap">{m.content}</p>
                </CardContent>
              </Card>
              {m.role === "user" && (
                <div className="size-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <User className="size-4" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="border-t p-4">
        <div className="mx-auto max-w-3xl">
          <Card>
            <CardContent className="p-3">
              <div className="flex items-end gap-2">
                <textarea
                  className="flex-1 resize-none border-0 bg-transparent p-2 text-sm focus:outline-none placeholder:text-muted-foreground"
                  placeholder="问我任何问题…（按 Enter 发送）"
                  rows={2}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                />
                <Button onClick={send} size="icon" aria-label="发送">
                  <Send className="size-4" />
                </Button>
              </div>
              <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                <Sparkles className="size-3" />
                <span>智能建议：</span>
                <button
                  onClick={() => setInput("帮我建一个请假审批应用")}
                  className="hover:underline"
                >
                  帮我建一个请假审批应用
                </button>
                <span>·</span>
                <button
                  onClick={() => setInput("上个月的订单总额是多少？")}
                  className="hover:underline"
                >
                  上个月的订单总额是多少？
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}