package com.metaplatform.rule.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.rule.common.TenantContext;
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
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RuleExecutionServiceTest {

    @Mock
    private RuleSetRepository ruleSetRepository;

    @Mock
    private RuleDefinitionRepository ruleDefinitionRepository;

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
    void execute_shouldReturnMatched_whenConditionMet() {
        setupRulesetAndRule("amount >= 100000");

        List<RuleExecutionResult> results = ruleExecutionService.execute("rs-001", Map.of("amount", 120000));

        assertThat(results).hasSize(1);
        assertThat(results.get(0).isMatched()).isTrue();
        assertThat(results.get(0).getRuleCode()).isEqualTo("vip_upgrade");
        assertThat(results.get(0).getAction().getType()).isEqualTo("SET_TAG");
    }

    @Test
    void execute_shouldReturnNotMatched_whenConditionNotMet() {
        setupRulesetAndRule("amount >= 100000");

        List<RuleExecutionResult> results = ruleExecutionService.execute("rs-001", Map.of("amount", 50000));

        assertThat(results).hasSize(1);
        assertThat(results.get(0).isMatched()).isFalse();
    }

    @Test
    void execute_shouldHandleInvalidExpression_gracefully() {
        setupRulesetAndRule("invalid expression !!!");

        List<RuleExecutionResult> results = ruleExecutionService.execute("rs-001", Map.of("amount", 120000));

        assertThat(results).hasSize(1);
        assertThat(results.get(0).isMatched()).isFalse();
    }

    @Test
    void execute_shouldThrow_whenRulesetNotFound() {
        when(ruleSetRepository.findByIdAndDeletedFalse("nonexistent")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> ruleExecutionService.execute("nonexistent", Map.of("amount", 100)))
                .isInstanceOf(RuleException.class)
                .hasMessageContaining("规则集不存在");
    }

    @Test
    void execute_shouldEvaluateStringCondition() {
        setupRulesetAndRule("tier == 'VIP'");

        List<RuleExecutionResult> results = ruleExecutionService.execute("rs-001", Map.of("tier", "VIP"));

        assertThat(results).hasSize(1);
        assertThat(results.get(0).isMatched()).isTrue();
    }

    private void setupRulesetAndRule(String conditionExpr) {
        RuleSetEntity ruleSet = RuleSetEntity.builder()
                .id("rs-001")
                .tenantId(TenantContext.DEFAULT_TENANT_ID)
                .code("customer_tier")
                .name("客户分级")
                .status(RuleStatus.ENABLED)
                .build();

        RuleDefinitionEntity rule = RuleDefinitionEntity.builder()
                .id("rule-001")
                .tenantId(TenantContext.DEFAULT_TENANT_ID)
                .rulesetId("rs-001")
                .code("vip_upgrade")
                .name("VIP升级规则")
                .conditionExpr(conditionExpr)
                .actionType(ActionType.SET_TAG)
                .actionConfig(objectMapper.valueToTree(Map.of("tag", "VIP")))
                .priority(0)
                .enabled(true)
                .build();

        when(ruleSetRepository.findByIdAndDeletedFalse("rs-001")).thenReturn(Optional.of(ruleSet));
        when(ruleDefinitionRepository.findByTenantIdAndRulesetIdAndDeletedFalseAndEnabledTrueOrderByPriorityAscCreatedAtAsc(
                TenantContext.DEFAULT_TENANT_ID, "rs-001")).thenReturn(List.of(rule));
    }
}
