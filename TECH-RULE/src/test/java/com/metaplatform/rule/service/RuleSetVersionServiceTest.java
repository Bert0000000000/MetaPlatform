package com.metaplatform.rule.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.metaplatform.rule.common.ErrorCode;
import com.metaplatform.rule.common.PageResponse;
import com.metaplatform.rule.common.TenantContext;
import com.metaplatform.rule.dto.RuleSetVersionCreateRequest;
import com.metaplatform.rule.dto.RuleSetVersionResponse;
import com.metaplatform.rule.entity.ActionType;
import com.metaplatform.rule.entity.RuleDefinitionEntity;
import com.metaplatform.rule.entity.RuleSetEntity;
import com.metaplatform.rule.entity.RuleStatus;
import com.metaplatform.rule.exception.RuleException;
import com.metaplatform.rule.repository.RuleDefinitionRepository;
import com.metaplatform.rule.repository.RuleSetRepository;
import com.metaplatform.rule.repository.RuleSetVersionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RuleSetVersionServiceTest {

    @Mock
    private RuleSetVersionRepository versionRepository;

    @Mock
    private RuleSetRepository ruleSetRepository;

    @Mock
    private RuleDefinitionRepository ruleDefinitionRepository;

    @Spy
    private ObjectMapper objectMapper = new ObjectMapper();

    @InjectMocks
    private RuleSetVersionService versionService;

    @BeforeEach
    void setUp() {
        TenantContext.clear();
        TenantContext.set(TenantContext.DEFAULT_TENANT_ID);
    }

    @Test
    void createVersion_shouldIncrementVersion_andUpdateRuleset() {
        String rulesetId = "rs-001";
        RuleSetEntity ruleset = RuleSetEntity.builder()
                .id(rulesetId)
                .tenantId(TenantContext.DEFAULT_TENANT_ID)
                .code("customer_tier")
                .name("客户分级")
                .version(1)
                .build();

        RuleDefinitionEntity rule = RuleDefinitionEntity.builder()
                .id("rule-001")
                .tenantId(TenantContext.DEFAULT_TENANT_ID)
                .rulesetId(rulesetId)
                .code("vip_rule")
                .name("VIP 规则")
                .conditionExpr("amount >= 100000")
                .actionType(ActionType.SET_FIELD)
                .priority(10)
                .enabled(true)
                .build();

        when(ruleSetRepository.findByIdAndDeletedFalse(rulesetId)).thenReturn(Optional.of(ruleset));
        when(versionRepository.findTopByTenantIdAndRulesetIdOrderByVersionNumberDesc(
                TenantContext.DEFAULT_TENANT_ID, rulesetId)).thenReturn(Optional.empty());
        when(ruleDefinitionRepository.findByTenantIdAndRulesetIdAndDeletedFalseAndEnabledTrueOrderByPriorityAscCreatedAtAsc(
                TenantContext.DEFAULT_TENANT_ID, rulesetId)).thenReturn(List.of(rule));
        when(versionRepository.save(any())).thenAnswer(inv -> {
            com.metaplatform.rule.entity.RuleSetVersionEntity v = inv.getArgument(0);
            v.setId(UUID.randomUUID().toString());
            return v;
        });
        when(ruleSetRepository.save(any())).thenReturn(ruleset);

        RuleSetVersionResponse response = versionService.createVersion(rulesetId, new RuleSetVersionCreateRequest());

        assertThat(response.getVersionNumber()).isEqualTo(2);
        assertThat(response.getRulesetId()).isEqualTo(rulesetId);
        assertThat(response.getSnapshot()).isNotNull();
        assertThat(response.getSnapshot().get("rules").size()).isEqualTo(1);
        assertThat(ruleset.getVersion()).isEqualTo(2);
    }

    @Test
    void createVersion_shouldThrow_whenRulesetNotFound() {
        when(ruleSetRepository.findByIdAndDeletedFalse("missing")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> versionService.createVersion("missing", new RuleSetVersionCreateRequest()))
                .isInstanceOf(RuleException.class)
                .extracting(ex -> ((RuleException) ex).getErrorCode())
                .isEqualTo(ErrorCode.RULESET_NOT_FOUND);
    }

    @Test
    void listVersions_shouldReturnPagedVersions() {
        String rulesetId = "rs-001";
        RuleSetEntity ruleset = RuleSetEntity.builder()
                .id(rulesetId)
                .tenantId(TenantContext.DEFAULT_TENANT_ID)
                .build();
        com.metaplatform.rule.entity.RuleSetVersionEntity v1 = version(rulesetId, 2);
        com.metaplatform.rule.entity.RuleSetVersionEntity v2 = version(rulesetId, 1);

        when(ruleSetRepository.findByIdAndDeletedFalse(rulesetId)).thenReturn(Optional.of(ruleset));
        when(versionRepository.findByTenantIdAndRulesetIdOrderByVersionNumberDesc(
                TenantContext.DEFAULT_TENANT_ID, rulesetId)).thenReturn(List.of(v1, v2));

        PageResponse<RuleSetVersionResponse> page = versionService.listVersions(rulesetId, 1, 10);

        assertThat(page.getTotal()).isEqualTo(2);
        assertThat(page.getItems()).hasSize(2);
        assertThat(page.getItems().get(0).getVersionNumber()).isEqualTo(2);
    }

    @Test
    void getVersion_shouldReturnSnapshot() {
        String versionId = "ver-001";
        com.metaplatform.rule.entity.RuleSetVersionEntity version =
                com.metaplatform.rule.entity.RuleSetVersionEntity.builder()
                        .id(versionId)
                        .tenantId(TenantContext.DEFAULT_TENANT_ID)
                        .rulesetId("rs-001")
                        .versionNumber(3)
                        .snapshot(objectMapper.createObjectNode())
                        .build();

        when(versionRepository.findByIdAndTenantId(versionId, TenantContext.DEFAULT_TENANT_ID))
                .thenReturn(Optional.of(version));

        RuleSetVersionResponse response = versionService.getVersion(versionId);
        assertThat(response.getVersionNumber()).isEqualTo(3);
    }

    @Test
    void getVersion_shouldThrow_whenNotFound() {
        when(versionRepository.findByIdAndTenantId("missing", TenantContext.DEFAULT_TENANT_ID))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> versionService.getVersion("missing"))
                .isInstanceOf(RuleException.class)
                .extracting(ex -> ((RuleException) ex).getErrorCode())
                .isEqualTo(ErrorCode.RULESET_VERSION_NOT_FOUND);
    }

    private com.metaplatform.rule.entity.RuleSetVersionEntity version(String rulesetId, int number) {
        ObjectNode snapshot = objectMapper.createObjectNode();
        snapshot.put("version", number);
        return com.metaplatform.rule.entity.RuleSetVersionEntity.builder()
                .id(UUID.randomUUID().toString())
                .tenantId(TenantContext.DEFAULT_TENANT_ID)
                .rulesetId(rulesetId)
                .versionNumber(number)
                .snapshot(snapshot)
                .build();
    }
}
