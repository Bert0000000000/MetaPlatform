import React, { useEffect, useState } from "react";
import { listPlans, getSubscription, getUsageStats, subscribe } from "../api/billingApi";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface Plan {
  id: string;
  name: string;
  description: string;
  monthlyTokenLimit: number;
  priceCentsMonthly: number;
  status: string;
}

interface Subscription {
  id: string;
  tenantId: string;
  planId: string;
  status: string;
  startedAt: string;
  expiresAt: string | null;
}

interface UsageStats {
  today: { totalTokens: number; costCents: number; requestCount: number };
  thisMonth: { totalTokens: number; costCents: number; requestCount: number };
  total: { totalTokens: number; costCents: number; requestCount: number };
}

const TENANT_ID = "00000000-0000-0000-0000-000000000001";

const BillingDashboard: React.FC = () => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [usage, setUsage] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [plansData, subData, usageData] = await Promise.allSettled([
        listPlans(),
        getSubscription(TENANT_ID),
        getUsageStats(TENANT_ID),
      ]);
      if (plansData.status === "fulfilled") setPlans(plansData.value);
      if (subData.status === "fulfilled") setSubscription(subData.value);
      if (usageData.status === "fulfilled") setUsage(usageData.value);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  };

  const formatTokens = (n: number) => {
    if (n >= 1000000000) return `${(n / 1000000000).toFixed(1)}B`;
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toString();
  };

  const formatCost = (cents: number) => `¥${(cents / 100).toFixed(2)}`;

  const getPlanPrice = (cents: number) => {
    if (cents === 0) return "免费";
    return `¥${(cents / 100).toFixed(0)}/月`;
  };

  const handleSubscribe = async (planId: string) => {
    try {
      await subscribe(TENANT_ID, planId);
      await loadData();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "订阅失败");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        加载中...
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">计费中心</h1>
        <p className="text-sm text-muted-foreground mt-1">管理订阅套餐、查看使用量统计</p>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Current subscription */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">当前订阅</CardTitle>
        </CardHeader>
        <CardContent>
          {subscription ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="font-medium text-base">
                  {plans.find(p => p.id === subscription.planId)?.name || subscription.planId}
                </span>
                <Badge variant={subscription.status === "active" ? "default" : "secondary"}>
                  {subscription.status === "active" ? "生效中" : subscription.status}
                </Badge>
              </div>
              <div className="flex gap-4 text-sm text-muted-foreground">
                <span>开始时间: {new Date(subscription.startedAt).toLocaleDateString()}</span>
                {subscription.expiresAt && (
                  <span>到期时间: {new Date(subscription.expiresAt).toLocaleDateString()}</span>
                )}
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">暂无订阅，请选择套餐</div>
          )}
        </CardContent>
      </Card>

      {/* Usage stats */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">使用量统计</CardTitle>
        </CardHeader>
        <CardContent>
          {usage ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { label: "今日", data: usage.today },
                { label: "本月", data: usage.thisMonth },
                { label: "累计", data: usage.total },
              ].map(({ label, data }) => (
                <div key={label} className="rounded-lg border p-4 text-center">
                  <div className="text-sm font-medium text-muted-foreground mb-2">{label}</div>
                  <div className="text-xl font-bold">{formatTokens(data?.totalTokens || 0)}</div>
                  <div className="text-xs text-muted-foreground mt-1">Token</div>
                  <Separator className="my-2" />
                  <div className="text-sm font-medium">{formatCost(data?.costCents || 0)}</div>
                  <div className="text-xs text-muted-foreground">{data?.requestCount || 0} 次请求</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">暂无使用数据</div>
          )}
        </CardContent>
      </Card>

      {/* Plan list */}
      <div>
        <h2 className="text-lg font-semibold mb-4">套餐选择</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {plans.map(plan => {
            const isCurrent = subscription?.planId === plan.id;
            return (
              <Card key={plan.id} className={cn(isCurrent && "ring-2 ring-primary")}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{plan.name}</CardTitle>
                    <span className="text-lg font-bold">{getPlanPrice(plan.priceCentsMonthly)}</span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">{plan.description}</p>
                  <div className="text-sm">
                    月度限额: {formatTokens(plan.monthlyTokenLimit)} Token
                  </div>
                  <div>
                    {isCurrent ? (
                      <Badge variant="default">当前套餐</Badge>
                    ) : (
                      <Button size="sm" onClick={() => handleSubscribe(plan.id)}>
                        订阅
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default BillingDashboard;
