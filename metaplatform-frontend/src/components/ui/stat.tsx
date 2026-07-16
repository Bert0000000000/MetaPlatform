import * as React from "react";
import { TrendingUp, TrendingDown, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface StatCardProps {
  label: string;
  value: string | number;
  unit?: string;
  trend?: number;
  icon?: React.ElementType | React.ReactNode;
  className?: string;
  sub?: string;            // 副标题/补充说明 (e.g. "3 条待审批")
}

export function StatCard({
  label,
  value,
  unit,
  trend,
  icon,
  className,
  sub,
}: StatCardProps) {
  const isPositive = trend !== undefined && trend >= 0;
  // Support both React.ElementType (Lucide component) and React.ReactNode (JSX)
  const iconElement = icon
    ? React.isValidElement(icon)
      ? icon
      : React.createElement(icon as React.ElementType, { className: "size-4" })
    : null;
  return (
    <Card className={cn("py-1 gap-0.5", className)}>
      <CardContent className="p-1.5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] text-muted-foreground leading-tight">{label}</p>
            <div className="flex items-baseline gap-1 mt-0">
              <span className="text-sm font-semibold">
                {typeof value === "number" ? value.toLocaleString() : value}
              </span>
              {unit && <span className="text-[10px] text-muted-foreground">{unit}</span>}
            </div>
            {sub && (
              <p className="text-[10px] text-muted-foreground/80 mt-0">{sub}</p>
            )}
            {trend !== undefined && (
              <div
                className={cn(
                  "flex items-center gap-1 mt-0.5 text-[10px]",
                  isPositive ? "text-green-600" : "text-red-600",
                )}
              >
                {isPositive ? (
                  <TrendingUp className="size-3" />
                ) : (
                  <TrendingDown className="size-3" />
                )}
                <span>{isPositive ? "+" : ""}{trend}%</span>
              </div>
            )}
          </div>
          {iconElement && <span className="text-sm">{iconElement}</span>}
        </div>
      </CardContent>
    </Card>
  );
}

interface PageHeaderProps {
  title: React.ReactNode;
  description?: string;
  action?: React.ReactNode;
  onBack?: () => void;
}

export function PageHeader({ title, description, action, onBack }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-1 min-h-0">
      <div className="flex items-center gap-2">
        {onBack && (
          <Button variant="ghost" size="icon" className="size-7 -ml-2" onClick={onBack} title="返回">
            <ChevronLeft className="size-4" />
          </Button>
        )}
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          {description && (
            <p className="text-xs text-muted-foreground mt-0">{description}</p>
          )}
        </div>
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
