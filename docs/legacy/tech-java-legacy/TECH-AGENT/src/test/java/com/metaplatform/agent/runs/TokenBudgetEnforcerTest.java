package com.metaplatform.agent.runs;

import com.metaplatform.agent.runs.dto.BudgetDto;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("P-NLB-01 TokenBudgetEnforcer")
class TokenBudgetEnforcerTest {

    private TokenBudgetEnforcer enforcer;

    @BeforeEach
    void setUp() {
        enforcer = new TokenBudgetEnforcer();
    }

    @Test
    @DisplayName("null budget -> allowed, no violation surfaced")
    void nullBudgetAllowed() {
        TokenBudgetEnforcer.EnforcementResult er = enforcer.check(null, 100_000, 100_000L);
        assertTrue(er.isAllowed());
        assertNull(er.getViolation());
        assertNull(er.getOverBy());
    }

    @Test
    @DisplayName("tokens within budget -> allowed")
    void tokensWithinBudget() {
        BudgetDto b = BudgetDto.builder().tokens(1000).build();
        assertTrue(enforcer.check(b, 500, 0L).isAllowed());
        assertTrue(enforcer.check(b, 1000, 0L).isAllowed(), "exact equality must not exceed");
    }

    @Test
    @DisplayName("tokens exceed budget -> denied with TOKENS violation + overBy")
    void tokensOverBudgetDenied() {
        BudgetDto b = BudgetDto.builder().tokens(1000).build();
        TokenBudgetEnforcer.EnforcementResult er = enforcer.check(b, 1500, 0L);
        assertFalse(er.isAllowed());
        assertEquals("TOKENS", er.getViolation());
        assertEquals(500L, er.getOverBy());
    }

    @Test
    @DisplayName("wallTime exceeds -> denied with WALL_TIME violation")
    void wallTimeOverDenied() {
        BudgetDto b = BudgetDto.builder().wallTimeMs(60_000L).build();
        TokenBudgetEnforcer.EnforcementResult er = enforcer.check(b, 0, 90_000L);
        assertFalse(er.isAllowed());
        assertEquals("WALL_TIME", er.getViolation());
        assertEquals(30_000L, er.getOverBy());
    }

    @Test
    @DisplayName("both exceeded -> combined violation TOKENS+WALL_TIME, summed overBy")
    void bothExceeded() {
        BudgetDto b = BudgetDto.builder().tokens(1000).wallTimeMs(60_000L).build();
        TokenBudgetEnforcer.EnforcementResult er = enforcer.check(b, 1500, 75_000L);
        assertFalse(er.isAllowed());
        assertEquals("TOKENS+WALL_TIME", er.getViolation());
        assertEquals(500L + 15_000L, er.getOverBy());
    }

    @Test
    @DisplayName("attempted <0 -> treated as zero (defensive)")
    void negativeAttemptsTreatedAsZero() {
        BudgetDto b = BudgetDto.builder().tokens(1000).build();
        TokenBudgetEnforcer.EnforcementResult er = enforcer.check(b, -42, -1L);
        assertTrue(er.isAllowed());
    }

    @Test
    @DisplayName("isAllowed() helper matches check().isAllowed()")
    void isAllowedHelper() {
        BudgetDto b = BudgetDto.builder().tokens(100).build();
        assertTrue(enforcer.isAllowed(b, 50, 0L));
        assertFalse(enforcer.isAllowed(b, 200, 0L));
    }

    @Test
    @DisplayName("budget with cost set but no tokens/wallTime -> no enforcement even with huge attempts")
    void costOnlyBudgetAllowed() {
        // The enforcer only knows about tokens/wallTimeMs; cost is informational here.
        BudgetDto b = BudgetDto.builder().cost(new BigDecimal("0.05")).build();
        assertTrue(enforcer.check(b, 1_000_000, 9_999_999L).isAllowed());
    }
}
