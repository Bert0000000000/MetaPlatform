import { useNavigate } from "react-router-dom";
import { Search, Bell } from "lucide-react";
import { RoleSwitcher } from "@/components/RoleSwitcher";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function Topbar() {
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur">
      <div className="flex flex-1 items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="hidden md:flex w-64 justify-start gap-2 text-muted-foreground"
              onClick={() => navigate("/superai")}
            >
              <Search className="size-4" />
              <span>搜索或 AI 助手</span>
              <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                <span className="text-xs">⌘</span>K
              </kbd>
            </Button>
          </TooltipTrigger>
          <TooltipContent>唤起全局 AI 助手 ⌘K</TooltipContent>
        </Tooltip>
      </div>

      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="通知">
              <Bell className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>通知</TooltipContent>
        </Tooltip>
        <RoleSwitcher />
      </div>
    </header>
  );
}