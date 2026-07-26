// =============================================================================
// MetaPlatform 多租户压测脚本（P8.2）
// -----------------------------------------------------------------------------
// 目标：1000 并发 / 50 租户 / 5 分钟
// 用法：k6 run tests/perf/multi-tenant.js
// =============================================================================
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';

const successCount = new Counter('success_count');
const failCount = new Counter('fail_count');

export const options = {
  scenarios: {
    multi_tenant: {
      executor: 'constant-arrival-rate',
      rate: 1000,
      timeUnit: '1s',
      duration: '5m',
      preAllocatedVUs: 200,
      maxVUs: 500,
    },
  },
  thresholds: {
    http_req_duration: ['p(99)<5000'],     // P99 < 5s
    http_req_failed:   ['rate<0.01'],        // 错误率 < 1%
  },
};

const TENANTS = Array.from({ length: 50 }, (_, i) => `TENANT-${String(i+1).padStart(2, '0')}`);

export default function () {
  const tenantId = TENANTS[Math.floor(Math.random() * TENANTS.length)];
  const customerId = `CUST-${tenantId}-${Math.floor(Math.random() * 1000)}`;
  const url = 'http://localhost:8201/api/v1/ont/context/build';
  const payload = JSON.stringify({
    userId: `USER-${Math.floor(Math.random() * 100)}`,
    subject: { conceptCode: 'Customer', objectId: customerId },
    properties: ['name', 'customerLevel', 'revenue12m'],
    relationships: ['HAS_ORDER'],
    viewState: { activeTab: 'orders' },
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'X-Tenant-Id': tenantId,
    },
  };

  const res = http.post(url, payload, params);
  const ok = check(res, { 'status is 200': (r) => r.status === 200 });
  if (ok) successCount.add(1); else failCount.add(1);
  sleep(0.1);
}
