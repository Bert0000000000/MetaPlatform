package com.metaplatform.rule.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.rule.common.TenantContext;
import com.metaplatform.rule.dto.RuleExecutionResult;
import com.metaplatform.rule.entity.ActionType;
import com.metaplatform.rule.exception.RuleException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

/**
 * P1-3：RuleExecutionService 已重构为薄包装，委托给 {@link RuleEngineService#executeReadOnly}。
 *
 * <p>本测试仅验证委托链路正确，原 SpEL 求值逻辑由 {@link RuleEngineServiceTest} 覆盖。</p>
 */
@ExtendWith(MockitoExtension.class)
class RuleExecutionServiceTest {

    @Mock
    private RuleEngineService ruleEngineService;

    @Spy
    private ObjectMapper objectMapper = new ObjectMapper();

    @InjectMocks
    private RuleExecutionService ruleExecutionService;

    @BeforeEach
    void setUp() {
        TenantContext.clear();
        TenantContext.set(TenantContext.DEFAULT_TENANT_ID);
    }

    @Test
    void execute_shouldDelegateToRuleEngineService() {
        RuleExecutionResult expected = RuleExecutionResult.builder()
                .ruleId("rule-001")
                .ruleCode("vip_upgrade")
                .ruleName("VIP升级规则")
                .matched(true)
                .action(RuleExecutionResult.ActionInfo.builder()
                        .type(ActionType.SET_TAG.name())
                        .config(Map.of("tag", "VIP"))
                        .build())
                .build();
        when(ruleEngineService.executeReadOnly(eq("rs-001"), eq(Map.of("amount", 120000))))
                .thenReturn(List.of(expected));

        List<RuleExecutionResult> results = ruleExecutionService.execute("rs-001", Map.of("amount", 120000));

        assertThat(results).hasSize(1);
        assertThat(results.get(0).isMatched()).isTrue();
        assertThat(results.get(0).getRuleCode()).isEqualTo("vip_upgrade");
        assertThat(results.get(0).getAction().getType()).isEqualTo("SET_TAG");
    }

    @Test
    void execute_shouldPropagateException() {
        when(ruleEngineService.executeReadOnly(eq("nonexistent"), eq(Map.of("amount", 100))))
                .thenThrow(new RuleException(com.metaplatform.rule.common.ErrorCode.RULESET_NOT_FOUND));

        org.assertj.core.api.Assertions.assertThatThrownBy(() ->
                        ruleExecutionService.execute("nonexistent", Map.of("amount", 100)))
                .isInstanceOf(RuleException.class)
                .hasMessageContaining("规则集不存在");
    }
}
