import React, { useEffect, useState } from "react";
import { listPlans, getSubscription, getUsageStats, subscribe } from "../api/billingApi";

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
    return <div className="mp-loading">加载中...</div>;
  }

  return (
    <div className="mp-billing">
      <div className="mp-billing-header">
        <h1>计费中心</h1>
        <p>管理订阅套餐、查看使用量统计</p>
      </div>

      {error && <div className="mp-alert mp-alert-error">{error}</div>}

      {/* 当前订阅 */}
      <div className="mp-billing-section">
        <h2>当前订阅</h2>
        {subscription ? (
          <div className="mp-billing-current">
            <div className="mp-billing-current-plan">
              <span className="mp-billing-plan-name">
                {plans.find(p => p.id === subscription.planId)?.name || subscription.planId}
              </span>
              <span className={`mp-billing-status ${subscription.status}`}>
                {subscription.status === "active" ? "生效中" : subscription.status}
              </span>
            </div>
            <div className="mp-billing-current-meta">
              <span>开始时间: {new Date(subscription.startedAt).toLocaleDateString()}</span>
              {subscription.expiresAt && (
                <span>到期时间: {new Date(subscription.expiresAt).toLocaleDateString()}</span>
              )}
            </div>
          </div>
        ) : (
          <div className="mp-billing-no-sub">暂无订阅，请选择套餐</div>
        )}
      </div>

      {/* 使用量统计 */}
      <div className="mp-billing-section">
        <h2>使用量统计</h2>
        {usage ? (
          <div className="mp-billing-stats-grid">
            <div className="mp-billing-stat-card">
              <div className="mp-billing-stat-label">今日</div>
              <div className="mp-billing-stat-value">{formatTokens(usage.today?.totalTokens || 0)}</div>
              <div className="mp-billing-stat-sub">Token</div>
              <div className="mp-billing-stat-cost">{formatCost(usage.today?.costCents || 0)}</div>
              <div className="mp-billing-stat-count">{usage.today?.requestCount || 0} 次请求</div>
            </div>
            <div className="mp-billing-stat-card">
              <div className="mp-billing-stat-label">本月</div>
              <div className="mp-billing-stat-value">{formatTokens(usage.thisMonth?.totalTokens || 0)}</div>
              <div className="mp-billing-stat-sub">Token</div>
              <div className="mp-billing-stat-cost">{formatCost(usage.thisMonth?.costCents || 0)}</div>
              <div className="mp-billing-stat-count">{usage.thisMonth?.requestCount || 0} 次请求</div>
            </div>
            <div className="mp-billing-stat-card">
              <div className="mp-billing-stat-label">累计</div>
              <div className="mp-billing-stat-value">{formatTokens(usage.total?.totalTokens || 0)}</div>
              <div className="mp-billing-stat-sub">Token</div>
              <div className="mp-billing-stat-cost">{formatCost(usage.total?.costCents || 0)}</div>
              <div className="mp-billing-stat-count">{usage.total?.requestCount || 0} 次请求</div>
            </div>
          </div>
        ) : (
          <div className="mp-billing-no-sub">暂无使用数据</div>
        )}
      </div>

      {/* 套餐列表 */}
      <div className="mp-billing-section">
        <h2>套餐选择</h2>
        <div className="mp-billing-plans-grid">
          {plans.map(plan => (
            <div key={plan.id} className={`mp-billing-plan-card ${subscription?.planId === plan.id ? "current" : ""}`}>
              <div className="mp-billing-plan-card-header">
                <div className="mp-billing-plan-card-name">{plan.name}</div>
                <div className="mp-billing-plan-card-price">{getPlanPrice(plan.priceCentsMonthly)}</div>
              </div>
              <div className="mp-billing-plan-card-desc">{plan.description}</div>
              <div className="mp-billing-plan-card-limit">
                月度限额: {formatTokens(plan.monthlyTokenLimit)} Token
              </div>
              <div className="mp-billing-plan-card-action">
                {subscription?.planId === plan.id ? (
                  <span className="mp-billing-current-badge">当前套餐</span>
                ) : (
                  <button
                    className="mp-btn mp-btn-primary mp-btn-sm"
                    onClick={() => handleSubscribe(plan.id)}
                  >
                    订阅
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default BillingDashboard;
