package com.metaplatform.rule.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.rule.common.TenantContext;
import com.metaplatform.rule.dto.RuleDefinitionCreateRequest;
import com.metaplatform.rule.dto.RuleDefinitionResponse;
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
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RuleDefinitionServiceTest {

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

    @BeforeEach
    void setUp() {
        TenantContext.clear();
        TenantContext.set(TenantContext.DEFAULT_TENANT_ID);
    }

    @Test
    void create_shouldReturnRule_whenValid() {
        RuleSetEntity ruleSet = RuleSetEntity.builder()
                .id("rs-001")
                .tenantId(TenantContext.DEFAULT_TENANT_ID)
                .code("customer_tier")
                .name("客户分级")
                .status(RuleStatus.ENABLED)
                .build();

        RuleDefinitionCreateRequest request = new RuleDefinitionCreateRequest();
        request.setRulesetId("rs-001");
        request.setCode("vip_upgrade");
        request.setName("VIP升级规则");
        request.setConditionExpr("amount >= 100000");
        request.setActionType(ActionType.SET_TAG);
        request.setActionConfig(java.util.Map.of("tag", "VIP"));

        RuleDefinitionEntity saved = RuleDefinitionEntity.builder()
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

        when(ruleSetRepository.findByIdAndDeletedFalse("rs-001")).thenReturn(Optional.of(ruleSet));
        when(ruleDefinitionRepository.existsByTenantIdAndRulesetIdAndCodeAndDeletedFalse(
                TenantContext.DEFAULT_TENANT_ID, "rs-001", "vip_upgrade")).thenReturn(false);
        doNothing().when(ontologyReferenceValidator).validate(anyString());
        when(ruleDefinitionRepository.save(any(RuleDefinitionEntity.class))).thenReturn(saved);

        RuleDefinitionResponse response = ruleDefinitionService.create(request);

        assertThat(response.getId()).isEqualTo("rule-001");
        assertThat(response.getCode()).isEqualTo("vip_upgrade");
        assertThat(response.getConditionExpr()).isEqualTo("amount >= 100000");
        assertThat(response.getActionType()).isEqualTo("SET_TAG");
    }

    @Test
    void create_shouldThrow_whenRulesetNotFound() {
        RuleDefinitionCreateRequest request = new RuleDefinitionCreateRequest();
        request.setRulesetId("nonexistent");
        request.setCode("vip_upgrade");
        request.setName("VIP升级");
        request.setConditionExpr("amount >= 100000");
        request.setActionType(ActionType.SET_TAG);

        when(ruleSetRepository.findByIdAndDeletedFalse("nonexistent")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> ruleDefinitionService.create(request))
                .isInstanceOf(RuleException.class)
                .hasMessageContaining("规则集不存在");
    }

    @Test
    void create_shouldThrow_whenCodeExists() {
        RuleSetEntity ruleSet = RuleSetEntity.builder()
                .id("rs-001")
                .tenantId(TenantContext.DEFAULT_TENANT_ID)
                .build();

        RuleDefinitionCreateRequest request = new RuleDefinitionCreateRequest();
        request.setRulesetId("rs-001");
        request.setCode("vip_upgrade");
        request.setName("VIP升级");
        request.setConditionExpr("amount >= 100000");
        request.setActionType(ActionType.SET_TAG);

        when(ruleSetRepository.findByIdAndDeletedFalse("rs-001")).thenReturn(Optional.of(ruleSet));
        when(ruleDefinitionRepository.existsByTenantIdAndRulesetIdAndCodeAndDeletedFalse(
                TenantContext.DEFAULT_TENANT_ID, "rs-001", "vip_upgrade")).thenReturn(true);

        assertThatThrownBy(() -> ruleDefinitionService.create(request))
                .isInstanceOf(RuleException.class)
                .hasMessageContaining("规则已存在");
    }

    @Test
    void getById_shouldReturnRule_whenExists() {
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

        RuleDefinitionResponse response = ruleDefinitionService.getById("rule-001");

        assertThat(response.getId()).isEqualTo("rule-001");
        assertThat(response.getCode()).isEqualTo("vip_upgrade");
        assertThat(response.getConditionExpr()).isEqualTo("amount >= 100000");
    }

    @Test
    void getById_shouldThrow_whenNotFound() {
        when(ruleDefinitionRepository.findByIdAndDeletedFalse("nonexistent")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> ruleDefinitionService.getById("nonexistent"))
                .isInstanceOf(RuleException.class)
                .hasMessageContaining("规则不存在");
    }
}
