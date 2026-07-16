package com.metaplatform.ai.billing;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TokenBillingServiceTest {

    private static final String TEST_TENANT = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

    @Mock
    private BillingRepository billingRepository;

    @Mock
    private StringRedisTemplate redisTemplate;

    @Mock
    private ValueOperations<String, String> valueOperations;

    private TokenBillingService billingService;

    @BeforeEach
    void setUp() {
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        billingService = new TokenBillingService(billingRepository, redisTemplate, 1000000);
    }

    @Test
    void shouldRecordUsage() {
        when(billingRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        billingService.recordUsage(TEST_TENANT, "gpt-4o", 100, 50);

        verify(billingRepository).save(any(TokenUsage.class));
        verify(valueOperations).increment(anyString(), eq(150L));
    }

    @Test
    void shouldTrackDailyUsageInMemory() {
        when(billingRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        billingService.recordUsage(TEST_TENANT, "gpt-4o", 100, 50);
        billingService.recordUsage(TEST_TENANT, "gpt-3.5-turbo", 200, 100);

        long usage = billingService.getDailyUsage(TEST_TENANT);
        assertEquals(450, usage); // 150 + 300
    }

    @Test
    void shouldCheckQuotaNotExceeded() {
        assertFalse(billingService.isQuotaExceeded("nonexistent-tenant"));
    }

    @Test
    void shouldCheckQuotaExceeded() {
        when(billingRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        // Record enough usage to exceed quota
        for (int i = 0; i < 100; i++) {
            billingService.recordUsage(TEST_TENANT, "gpt-4o", 10000, 0);
        }

        assertTrue(billingService.isQuotaExceeded(TEST_TENANT));
    }

    @Test
    void shouldReturnSummary() {
        when(billingRepository.sumTokensByModelAndDate(any(), any()))
                .thenReturn(List.of(
                        new Object[]{"gpt-4o", 5000},
                        new Object[]{"gpt-3.5-turbo", 3000}
                ));

        TokenBillingService.BillingSummary summary = billingService.getSummary(TEST_TENANT);

        assertEquals(TEST_TENANT, summary.tenantId());
        assertEquals(1000000, summary.dailyQuota());
        assertFalse(summary.usageByModel().isEmpty());
    }
}
