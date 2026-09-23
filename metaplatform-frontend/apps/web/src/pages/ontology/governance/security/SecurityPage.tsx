import SecurityPolicyCard from '../../components/SecurityPolicyCard';
import { PageHeader } from '@/components/skeleton';
import '../governance.css';
import '../../ontology.css';

/**
 * 安全策略（IA2-6 自 GovernancePage 拆出）：正式路由 /ontology/governance/security。
 *
 * <p>行/列级安全策略（SEC-12）——策略清单 + 新建 + 删除。
 * SecurityPolicyCard 原样承载（只移动不复制）。
 */
export default function SecurityPage() {
  return (
    <>
      <PageHeader
        title="安全策略"
        desc="行 / 列级安全策略（SEC-12）· 策略清单 + 新建 + 删除"
      />
      <div className="mp-gov-card">
        <SecurityPolicyCard />
      </div>
    </>
  );
}
