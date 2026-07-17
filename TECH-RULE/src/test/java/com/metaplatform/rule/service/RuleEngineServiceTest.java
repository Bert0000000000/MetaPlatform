package com.metaplatform.rule.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.rule.common.TenantContext;
import com.metaplatform.rule.dto.RuleExecutionResponse;
import com.metaplatform.rule.dto.RuleExecutionResult;
import com.metaplatform.rule.entity.ActionType;
import com.metaplatform.rule.entity.RuleDefinitionEntity;
import com.metaplatform.rule.entity.RuleSetEntity;
import com.metaplatform.rule.entity.RuleStatus;
import com.metaplatform.rule.exception.RuleException;
import com.metaplatform.rule.repository.RuleDefinitionRepository;
import com.metaplatform.rule.repository.RuleSetRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

/**
 * P1-RULE-02: 规则集同步执行引擎 测试。
 */
@ExtendWith(MockitoExtension.class)
class RuleEngineServiceTest {

    @Mock
    private RuleSetRepository ruleSetRepository;

    @Mock
    private RuleDefinitionRepository ruleDefinitionRepository;

    @Mock
    private RuleOutboxService ruleOutboxService;

    @Spy
    private ObjectMapper objectMapper = new ObjectMapper();

    @InjectMocks
    private RuleEngineService ruleEngineService;

    @BeforeEach
    void setUp() {
        TenantContext.clear();
        TenantContext.set(TenantContext.DEFAULT_TENANT_ID);
    }

    @Test
    void executeRuleset_shouldReturnResultsOrderedByPriority() {
        RuleSetEntity ruleSet = buildEnabledRuleset("rs-001", "customer_tier");

        RuleDefinitionEntity rule1 = buildRule("rule-001", "vip_upgrade", "amount >= 100000", 10);
        RuleDefinitionEntity rule2 = buildRule("rule-002", "svip_upgrade", "amount >= 500000", 5);

        when(ruleSetRepository.findByIdAndDeletedFalse("rs-001")).thenReturn(Optional.of(ruleSet));
        when(ruleDefinitionRepository.findByTenantIdAndRulesetIdAndDeletedFalseAndEnabledTrueOrderByPriorityAscCreatedAtAsc(
                TenantContext.DEFAULT_TENANT_ID, "rs-001")).thenReturn(List.of(rule2, rule1));

        RuleExecutionResponse response = ruleEngineService.executeRuleset("rs-001", Map.of("amount", 600000));

        assertThat(response.getResults()).hasSize(2);
        // priority=5 的规则先执行
        assertThat(response.getResults().get(0).getRuleCode()).isEqualTo("svip_upgrade");
        assertThat(response.getResults().get(0).isMatched()).isTrue();
        // priority=10 的规则后执行
        assertThat(response.getResults().get(1).getRuleCode()).isEqualTo("vip_upgrade");
        assertThat(response.getResults().get(1).isMatched()).isTrue();
        // 执行时间应大于等于 0
        assertThat(response.getExecutionTimeMs()).isGreaterThanOrEqualTo(0);
    }

    @Test
    void executeRuleset_shouldReturnEmptyWhenRulesetDisabled() {
        RuleSetEntity ruleSet = RuleSetEntity.builder()
                .id("rs-001")
                .tenantId(TenantContext.DEFAULT_TENANT_ID)
                .code("customer_tier")
                .name("客户分级")
                .status(RuleStatus.DISABLED)
                .enabled(false)
                .build();

        when(ruleSetRepository.findByIdAndDeletedFalse("rs-001")).thenReturn(Optional.of(ruleSet));

        RuleExecutionResponse response = ruleEngineService.executeRuleset("rs-001", Map.of("amount", 120000));

        assertThat(response.getResults()).isEmpty();
        assertThat(response.getExecutionTimeMs()).isGreaterThanOrEqualTo(0);
    }

    @Test
    void executeRuleset_shouldEvaluateConditionMatch() {
        RuleSetEntity ruleSet = buildEnabledRuleset("rs-001", "customer_tier");
        RuleDefinitionEntity rule = buildRule("rule-001", "vip_upgrade", "amount >= 100000", 10);

        when(ruleSetRepository.findByIdAndDeletedFalse("rs-001")).thenReturn(Optional.of(ruleSet));
        when(ruleDefinitionRepository.findByTenantIdAndRulesetIdAndDeletedFalseAndEnabledTrueOrderByPriorityAscCreatedAtAsc(
                TenantContext.DEFAULT_TENANT_ID, "rs-001")).thenReturn(List.of(rule));

        RuleExecutionResponse response = ruleEngineService.executeRuleset("rs-001", Map.of("amount", 120000));

        assertThat(response.getResults()).hasSize(1);
        assertThat(response.getResults().get(0).isMatched()).isTrue();
        assertThat(response.getResults().get(0).getAction().getType()).isEqualTo("SET_TAG");
        assertThat(response.getResults().get(0).getAction().getConfig()).containsEntry("tag", "VIP");
    }

    @Test
    void executeRuleset_shouldEvaluateConditionNotMatch() {
        RuleSetEntity ruleSet = buildEnabledRuleset("rs-001", "customer_tier");
        RuleDefinitionEntity rule = buildRule("rule-001", "vip_upgrade", "amount >= 100000", 10);

        when(ruleSetRepository.findByIdAndDeletedFalse("rs-001")).thenReturn(Optional.of(ruleSet));
        when(ruleDefinitionRepository.findByTenantIdAndRulesetIdAndDeletedFalseAndEnabledTrueOrderByPriorityAscCreatedAtAsc(
                TenantContext.DEFAULT_TENANT_ID, "rs-001")).thenReturn(List.of(rule));

        RuleExecutionResponse response = ruleEngineService.executeRuleset("rs-001", Map.of("amount", 50000));

        assertThat(response.getResults()).hasSize(1);
        assertThat(response.getResults().get(0).isMatched()).isFalse();
    }

    @Test
    void executeRuleset_shouldThrowWhenRulesetNotFound() {
        when(ruleSetRepository.findByIdAndDeletedFalse("nonexistent")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> ruleEngineService.executeRuleset("nonexistent", Map.of("amount", 100)))
                .isInstanceOf(RuleException.class)
                .hasMessageContaining("规则集不存在");
    }

    @Test
    void executeRulesetByCode_shouldExecuteByCode() {
        RuleSetEntity ruleSet = buildEnabledRuleset("rs-001", "customer_tier");
        RuleDefinitionEntity rule = buildRule("rule-001", "vip_upgrade", "tier == 'VIP'", 10);

        when(ruleSetRepository.findByTenantIdAndCodeAndDeletedFalse(
                TenantContext.DEFAULT_TENANT_ID, "customer_tier")).thenReturn(Optional.of(ruleSet));
        when(ruleSetRepository.findByIdAndDeletedFalse("rs-001")).thenReturn(Optional.of(ruleSet));
        when(ruleDefinitionRepository.findByTenantIdAndRulesetIdAndDeletedFalseAndEnabledTrueOrderByPriorityAscCreatedAtAsc(
                TenantContext.DEFAULT_TENANT_ID, "rs-001")).thenReturn(List.of(rule));

        RuleExecutionResponse response = ruleEngineService.executeRulesetByCode("customer_tier", Map.of("tier", "VIP"));

        assertThat(response.getResults()).hasSize(1);
        assertThat(response.getResults().get(0).isMatched()).isTrue();
        assertThat(response.getResults().get(0).getRuleCode()).isEqualTo("vip_upgrade");
    }

    @Test
    void executeRuleset_shouldHandleComplexExpression() {
        RuleSetEntity ruleSet = buildEnabledRuleset("rs-001", "customer_tier");
        RuleDefinitionEntity rule = buildRule("rule-001", "vip_upgrade",
                "amount >= 100000 && tier == 'VIP'", 10);

        when(ruleSetRepository.findByIdAndDeletedFalse("rs-001")).thenReturn(Optional.of(ruleSet));
        when(ruleDefinitionRepository.findByTenantIdAndRulesetIdAndDeletedFalseAndEnabledTrueOrderByPriorityAscCreatedAtAsc(
                TenantContext.DEFAULT_TENANT_ID, "rs-001")).thenReturn(List.of(rule));

        // 金额够但 tier 不匹配
        RuleExecutionResponse resp1 = ruleEngineService.executeRuleset("rs-001",
                Map.of("amount", 120000, "tier", "NORMAL"));
        assertThat(resp1.getResults().get(0).isMatched()).isFalse();

        // 金额够且 tier 匹配
        RuleExecutionResponse resp2 = ruleEngineService.executeRuleset("rs-001",
                Map.of("amount", 120000, "tier", "VIP"));
        assertThat(resp2.getResults().get(0).isMatched()).isTrue();
    }

    private RuleSetEntity buildEnabledRuleset(String id, String code) {
        return RuleSetEntity.builder()
                .id(id)
                .tenantId(TenantContext.DEFAULT_TENANT_ID)
                .code(code)
                .name("客户分级")
                .status(RuleStatus.ENABLED)
                .enabled(true)
                .build();
    }

    private RuleDefinitionEntity buildRule(String id, String code, String conditionExpr, int priority) {
        return RuleDefinitionEntity.builder()
                .id(id)
                .tenantId(TenantContext.DEFAULT_TENANT_ID)
                .rulesetId("rs-001")
                .code(code)
                .name(code)
                .conditionExpr(conditionExpr)
                .actionType(ActionType.SET_TAG)
                .actionConfig(objectMapper.valueToTree(Map.of("tag", "VIP")))
                .priority(priority)
                .enabled(true)
                .build();
    }
}
