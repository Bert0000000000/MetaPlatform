package com.metaplatform.rule.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.rule.common.TenantContext;
import com.metaplatform.rule.dto.RuleDefinitionResponse;
import com.metaplatform.rule.dto.RuleSetResponse;
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

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

/**
 * P1-RULE-01: 规则优先级与启用/禁用管理 测试。
 */
@ExtendWith(MockitoExtension.class)
class RulePriorityAndEnableTest {

    @Mock
    private RuleDefinitionRepository ruleDefinitionRepository;

    @Mock
    private RuleSetRepository ruleSetRepository;

    @Mock
    private OntologyReferenceValidator ontologyReferenceValidator;

    @Spy
    private ObjectMapper objectMapper = new ObjectMapper();

    @InjectMocks
    private RuleDefinitionService ruleDefinitionService;

    @InjectMocks
    private RuleSetService ruleSetService;

    @BeforeEach
    void setUp() {
        TenantContext.clear();
        TenantContext.set(TenantContext.DEFAULT_TENANT_ID);
    }

    @Test
    void updatePriority_shouldUpdatePriority_whenValid() {
        RuleDefinitionEntity entity = RuleDefinitionEntity.builder()
                .id("rule-001")
                .tenantId(TenantContext.DEFAULT_TENANT_ID)
                .rulesetId("rs-001")
                .code("vip_upgrade")
                .name("VIP升级规则")
                .conditionExpr("amount >= 100000")
                .actionType(ActionType.SET_TAG)
                .priority(0)
                .enabled(true)
                .build();

        when(ruleDefinitionRepository.findByIdAndDeletedFalse("rule-001")).thenReturn(Optional.of(entity));
        when(ruleDefinitionRepository.save(any(RuleDefinitionEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));

        RuleDefinitionResponse response = ruleDefinitionService.updatePriority("rule-001", 50);

        assertThat(response.getPriority()).isEqualTo(50);
        assertThat(entity.getPriority()).isEqualTo(50);
    }

    @Test
    void enable_shouldSetEnabledTrue_whenRuleDisabled() {
        RuleDefinitionEntity entity = RuleDefinitionEntity.builder()
                .id("rule-001")
                .tenantId(TenantContext.DEFAULT_TENANT_ID)
                .rulesetId("rs-001")
                .code("vip_upgrade")
                .name("VIP升级规则")
                .conditionExpr("amount >= 100000")
                .actionType(ActionType.SET_TAG)
                .priority(0)
                .enabled(false)
                .build();

        when(ruleDefinitionRepository.findByIdAndDeletedFalse("rule-001")).thenReturn(Optional.of(entity));
        when(ruleDefinitionRepository.save(any(RuleDefinitionEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));

        RuleDefinitionResponse response = ruleDefinitionService.enable("rule-001");

        assertThat(response.getEnabled()).isTrue();
        assertThat(entity.getEnabled()).isTrue();
    }

    @Test
    void disable_shouldSetEnabledFalse_whenRuleEnabled() {
        RuleDefinitionEntity entity = RuleDefinitionEntity.builder()
                .id("rule-001")
                .tenantId(TenantContext.DEFAULT_TENANT_ID)
                .rulesetId("rs-001")
                .code("vip_upgrade")
                .name("VIP升级规则")
                .conditionExpr("amount >= 100000")
                .actionType(ActionType.SET_TAG)
                .priority(0)
                .enabled(true)
                .build();

        when(ruleDefinitionRepository.findByIdAndDeletedFalse("rule-001")).thenReturn(Optional.of(entity));
        when(ruleDefinitionRepository.save(any(RuleDefinitionEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));

        RuleDefinitionResponse response = ruleDefinitionService.disable("rule-001");

        assertThat(response.getEnabled()).isFalse();
        assertThat(entity.getEnabled()).isFalse();
    }

    @Test
    void updatePriority_shouldThrow_whenRuleNotFound() {
        when(ruleDefinitionRepository.findByIdAndDeletedFalse("nonexistent")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> ruleDefinitionService.updatePriority("nonexistent", 50))
                .isInstanceOf(RuleException.class)
                .hasMessageContaining("规则不存在");
    }

    @Test
    void enableRuleset_shouldSetEnabledTrue() {
        RuleSetEntity entity = RuleSetEntity.builder()
                .id("rs-001")
                .tenantId(TenantContext.DEFAULT_TENANT_ID)
                .code("customer_tier")
                .name("客户分级规则集")
                .status(RuleStatus.DISABLED)
                .priority(0)
                .version(1)
                .enabled(false)
                .build();

        when(ruleSetRepository.findByIdAndDeletedFalse("rs-001")).thenReturn(Optional.of(entity));
        when(ruleSetRepository.save(any(RuleSetEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));

        RuleSetResponse response = ruleSetService.enable("rs-001");

        assertThat(response.getEnabled()).isTrue();
        assertThat(entity.getEnabled()).isTrue();
    }

    @Test
    void disableRuleset_shouldSetEnabledFalse() {
        RuleSetEntity entity = RuleSetEntity.builder()
                .id("rs-001")
                .tenantId(TenantContext.DEFAULT_TENANT_ID)
                .code("customer_tier")
                .name("客户分级规则集")
                .status(RuleStatus.ENABLED)
                .priority(0)
                .version(1)
                .enabled(true)
                .build();

        when(ruleSetRepository.findByIdAndDeletedFalse("rs-001")).thenReturn(Optional.of(entity));
        when(ruleSetRepository.save(any(RuleSetEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));

        RuleSetResponse response = ruleSetService.disable("rs-001");

        assertThat(response.getEnabled()).isFalse();
        assertThat(entity.getEnabled()).isFalse();
    }
}
