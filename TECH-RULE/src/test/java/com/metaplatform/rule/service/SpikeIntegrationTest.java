package com.metaplatform.rule.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.rule.common.TenantContext;
import com.metaplatform.rule.dto.RuleDefinitionCreateRequest;
import com.metaplatform.rule.dto.RuleDefinitionResponse;
import com.metaplatform.rule.dto.RuleExecutionResult;
import com.metaplatform.rule.dto.RuleSetCreateRequest;
import com.metaplatform.rule.dto.RuleSetResponse;
import com.metaplatform.rule.entity.ActionType;
import com.metaplatform.rule.entity.RuleDefinitionEntity;
import com.metaplatform.rule.entity.RuleSetEntity;
import com.metaplatform.rule.entity.RuleStatus;
import com.metaplatform.rule.repository.RuleDefinitionRepository;
import com.metaplatform.rule.repository.RuleSetRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.when;

/**
 * S-RULE-07 Spike 联调验证：定义"订单总额≥10万->VIP"规则并执行。
 *
 * 测试完整链路：
 * 1. 创建 Ruleset "customer-tier"
 * 2. 创建 Rule "vip-upgrade"，condition: amount >= 100000，action: SET_TAG:VIP
 * 3. 执行规则集，输入 {amount: 120000}，验证 matched=true
 * 4. 执行规则集，输入 {amount: 50000}，验证 matched=false
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class SpikeIntegrationTest {

    @Mock
    private RuleSetRepository ruleSetRepository;

    @Mock
    private RuleDefinitionRepository ruleDefinitionRepository;

    @Mock
    private OntologyReferenceValidator ontologyReferenceValidator;

    @Spy
    private ObjectMapper objectMapper = new ObjectMapper();

    @InjectMocks
    private RuleSetService ruleSetService;

    @InjectMocks
    private RuleDefinitionService ruleDefinitionService;

    @InjectMocks
    private RuleExecutionService ruleExecutionService;

    private RuleSetEntity rulesetEntity;
    private RuleDefinitionEntity ruleEntity;

    @BeforeEach
    void setUp() {
        TenantContext.clear();
        TenantContext.set(TenantContext.DEFAULT_TENANT_ID);

        // 预构建实体
        rulesetEntity = RuleSetEntity.builder()
                .id("rs-001")
                .tenantId(TenantContext.DEFAULT_TENANT_ID)
                .code("customer_tier")
                .name("客户分级规则集")
                .status(RuleStatus.ENABLED)
                .priority(0)
                .version(1)
                .deleted(false)
                .build();

        ruleEntity = RuleDefinitionEntity.builder()
                .id("rule-001")
                .tenantId(TenantContext.DEFAULT_TENANT_ID)
                .rulesetId("rs-001")
                .code("vip_upgrade")
                .name("VIP升级规则")
                .conditionExpr("amount >= 100000")
                .actionType(ActionType.SET_TAG)
                .actionConfig(objectMapper.valueToTree(Map.of("tag", "VIP")))
                .priority(0)
                .enabled(true)
                .deleted(false)
                .build();

        // 公共 Mock 设置
        when(ruleSetRepository.existsByTenantIdAndCodeAndDeletedFalse(
                TenantContext.DEFAULT_TENANT_ID, "customer_tier")).thenReturn(false);
        when(ruleSetRepository.save(any(RuleSetEntity.class))).thenReturn(rulesetEntity);
        when(ruleSetRepository.findByIdAndDeletedFalse("rs-001")).thenReturn(Optional.of(rulesetEntity));

        when(ruleDefinitionRepository.existsByTenantIdAndRulesetIdAndCodeAndDeletedFalse(
                TenantContext.DEFAULT_TENANT_ID, "rs-001", "vip_upgrade")).thenReturn(false);
        doNothing().when(ontologyReferenceValidator).validate(anyString());
        when(ruleDefinitionRepository.save(any(RuleDefinitionEntity.class))).thenReturn(ruleEntity);

        when(ruleDefinitionRepository.findByTenantIdAndRulesetIdAndDeletedFalseAndEnabledTrueOrderByPriorityAscCreatedAtAsc(
                TenantContext.DEFAULT_TENANT_ID, "rs-001")).thenReturn(List.of(ruleEntity));
    }

    @Test
    void spike_createRulesetAndRule_thenExecute_matchedWhenAmountOver100k() {
        // Step 1: 创建 Ruleset "customer-tier"
        RuleSetCreateRequest rulesetRequest = new RuleSetCreateRequest();
        rulesetRequest.setCode("customer_tier");
        rulesetRequest.setName("客户分级规则集");
        rulesetRequest.setDescription("根据订单金额自动客户分级");

        RuleSetResponse rulesetResponse = ruleSetService.create(rulesetRequest);
        assertThat(rulesetResponse.getCode()).isEqualTo("customer_tier");
        assertThat(rulesetResponse.getStatus()).isEqualTo("ENABLED");

        // Step 2: 创建 Rule "vip-upgrade"
        RuleDefinitionCreateRequest ruleRequest = new RuleDefinitionCreateRequest();
        ruleRequest.setRulesetId("rs-001");
        ruleRequest.setCode("vip_upgrade");
        ruleRequest.setName("VIP升级规则");
        ruleRequest.setConditionExpr("amount >= 100000");
        ruleRequest.setActionType(ActionType.SET_TAG);
        ruleRequest.setActionConfig(Map.of("tag", "VIP"));

        RuleDefinitionResponse ruleResponse = ruleDefinitionService.create(ruleRequest);
        assertThat(ruleResponse.getCode()).isEqualTo("vip_upgrade");
        assertThat(ruleResponse.getConditionExpr()).isEqualTo("amount >= 100000");
        assertThat(ruleResponse.getActionType()).isEqualTo("SET_TAG");

        // Step 3: 执行规则集，输入 {amount: 120000}，验证 matched=true
        List<RuleExecutionResult> results = ruleExecutionService.execute("rs-001", Map.of("amount", 120000));

        assertThat(results).hasSize(1);
        RuleExecutionResult result = results.get(0);
        assertThat(result.getRuleCode()).isEqualTo("vip_upgrade");
        assertThat(result.isMatched()).isTrue();
        assertThat(result.getAction().getType()).isEqualTo("SET_TAG");
        assertThat(result.getAction().getConfig()).containsEntry("tag", "VIP");
    }

    @Test
    void spike_execute_notMatchedWhenAmountBelow100k() {
        // 执行规则集，输入 {amount: 50000}，验证 matched=false
        List<RuleExecutionResult> results = ruleExecutionService.execute("rs-001", Map.of("amount", 50000));

        assertThat(results).hasSize(1);
        RuleExecutionResult result = results.get(0);
        assertThat(result.getRuleCode()).isEqualTo("vip_upgrade");
        assertThat(result.isMatched()).isFalse();
        assertThat(result.getAction().getType()).isEqualTo("SET_TAG");
    }

    @Test
    void spike_execute_multipleInputs_boundaryCheck() {
        // 边界值测试：amount 恰好等于 100000，应该 matched=true
        List<RuleExecutionResult> exactResults = ruleExecutionService.execute("rs-001", Map.of("amount", 100000));
        assertThat(exactResults.get(0).isMatched()).isTrue();

        // amount 99999，应该 matched=false
        List<RuleExecutionResult> belowResults = ruleExecutionService.execute("rs-001", Map.of("amount", 99999));
        assertThat(belowResults.get(0).isMatched()).isFalse();
    }
}
