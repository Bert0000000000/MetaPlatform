import * as React from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

interface StatCardProps {
  label: string;
  value: string | number;
  unit?: string;
  trend?: number;
  icon?: React.ElementType | React.ReactNode;
  className?: string;
}

export function StatCard({
  label,
  value,
  unit,
  trend,
  icon,
  className,
}: StatCardProps) {
  const isPositive = trend !== undefined && trend >= 0;
  // Support both React.ElementType (Lucide component) and React.ReactNode (JSX)
  const iconElement = icon
    ? typeof icon === "function"
      ? React.createElement(icon as React.ElementType, { className: "size-4" })
      : icon
    : null;
  return (
    <Card className={className}>
      <CardContent className="p-3">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-xl font-semibold">
                {typeof value === "number" ? value.toLocaleString() : value}
              </span>
              {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
            </div>
            {trend !== undefined && (
              <div
                className={cn(
                  "flex items-center gap-1 mt-1 text-xs",
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
          {iconElement && <span className="text-xl">{iconElement}</span>}
        </div>
      </CardContent>
    </Card>
  );
}

interface PageHeaderProps {
  title: React.ReactNode;
  description?: string;
  action?: React.ReactNode;
}

export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between mb-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}