package com.metaplatform.agent.runs;

import com.metaplatform.agent.runs.dto.BudgetDto;
import org.springframework.stereotype.Component;

/**
 * P-NLB-01 TokenBudgetEnforcer - server-side budget enforcement (§17 item 9).
 *
 * <p>Reads the per-run {@link BudgetDto} (tokens / cost / wallTimeMs) and decides whether
 * a candidate attempt (LLM call, tool dispatch, or completion closure) is allowed. The
 * caller passes the resource amounts it intends to consume; this component only consults
 * the static budget stored with the run. Server-side enforcement means every consumer
 * must ask this enforcer before allocating more resources.</p>
 *
 * <p>Safe defaults:
 * <ul>
 *   <li>null or empty {@link BudgetDto} -> allowed (no budget configured)</li>
 *   <li>budget with only tokens set -> only token checks enforced</li>
 *   <li>budget with only wallTimeMs set -> only wall-time checks enforced</li>
 *   <li>attempted values <0 are treated as zero (defensive)</li>
 * </ul>
 */
@Component
public class TokenBudgetEnforcer {

    public EnforcementResult check(BudgetDto budget, int tokensAttempted, long elapsedMsAttempted) {
        if (budget == null) {
            return EnforcementResult.allowed();
        }
        int tokens = Math.max(0, tokensAttempted);
        long elapsed = Math.max(0L, elapsedMsAttempted);
        String tokensViolation = null;
        Long tokensOverBy = null;
        if (budget.getTokens() != null && tokens > budget.getTokens()) {
            tokensViolation = "TOKENS";
            tokensOverBy = (long) (tokens - budget.getTokens());
        }
        String wallViolation = null;
        Long wallOverBy = null;
        if (budget.getWallTimeMs() != null && elapsed > budget.getWallTimeMs()) {
            wallViolation = "WALL_TIME";
            wallOverBy = elapsed - budget.getWallTimeMs();
        }
        if (tokensViolation == null && wallViolation == null) {
            return EnforcementResult.allowed();
        }
        String violation = tokensViolation == null ? wallViolation
                : (wallViolation == null ? tokensViolation : tokensViolation + "+" + wallViolation);
        Long overBy = tokensOverBy == null ? wallOverBy
                : (wallOverBy == null ? tokensOverBy : tokensOverBy + wallOverBy);
        return EnforcementResult.denied(violation, overBy);
    }

    public boolean isAllowed(BudgetDto budget, int tokensAttempted, long elapsedMsAttempted) {
        return check(budget, tokensAttempted, elapsedMsAttempted).isAllowed();
    }

    /**
     * Server-side enforcement result. {@link #allowed} is the only field that matters for control flow;
     * the optional fields surface violation details for logging / metrics / events.
     */
    public static final class EnforcementResult {
        private final boolean allowed;
        private final String violation;
        private final Long overBy;

        private EnforcementResult(boolean allowed, String violation, Long overBy) {
            this.allowed = allowed;
            this.violation = violation;
            this.overBy = overBy;
        }

        public static EnforcementResult allowed() {
            return new EnforcementResult(true, null, null);
        }

        public static EnforcementResult denied(String violation, Long overBy) {
            return new EnforcementResult(false, violation, overBy);
        }

        public boolean isAllowed() { return allowed; }
        public String getViolation() { return violation; }
        public Long getOverBy() { return overBy; }
    }
}
