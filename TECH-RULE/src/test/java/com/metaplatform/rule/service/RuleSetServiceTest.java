package com.metaplatform.rule.service;

import com.metaplatform.rule.common.TenantContext;
import com.metaplatform.rule.dto.RuleSetCreateRequest;
import com.metaplatform.rule.dto.RuleSetResponse;
import com.metaplatform.rule.dto.RuleSetUpdateRequest;
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
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RuleSetServiceTest {

    @Mock
    private RuleSetRepository ruleSetRepository;

    @Mock
    private RuleDefinitionRepository ruleDefinitionRepository;

    @InjectMocks
    private RuleSetService ruleSetService;

    @BeforeEach
    void setUp() {
        TenantContext.clear();
        TenantContext.set(TenantContext.DEFAULT_TENANT_ID);
    }

    @Test
    void create_shouldReturnRuleset_whenCodeIsAvailable() {
        RuleSetCreateRequest request = new RuleSetCreateRequest();
        request.setCode("customer_tier");
        request.setName("客户分级规则集");
        request.setDescription("根据订单金额自动分级");
        request.setPriority(10);

        RuleSetEntity saved = RuleSetEntity.builder()
                .id("rs-001")
                .tenantId(TenantContext.DEFAULT_TENANT_ID)
                .code("customer_tier")
                .name("客户分级规则集")
                .description("根据订单金额自动分级")
                .status(RuleStatus.ENABLED)
                .priority(10)
                .version(1)
                .build();

        when(ruleSetRepository.existsByTenantIdAndCodeAndDeletedFalse(
                TenantContext.DEFAULT_TENANT_ID, "customer_tier")).thenReturn(false);
        when(ruleSetRepository.save(any(RuleSetEntity.class))).thenReturn(saved);

        RuleSetResponse response = ruleSetService.create(request);

        assertThat(response.getId()).isEqualTo("rs-001");
        assertThat(response.getCode()).isEqualTo("customer_tier");
        assertThat(response.getName()).isEqualTo("客户分级规则集");
        assertThat(response.getStatus()).isEqualTo("ENABLED");
        assertThat(response.getPriority()).isEqualTo(10);
    }

    @Test
    void create_shouldThrow_whenCodeExists() {
        RuleSetCreateRequest request = new RuleSetCreateRequest();
        request.setCode("customer_tier");
        request.setName("客户分级规则集");

        when(ruleSetRepository.existsByTenantIdAndCodeAndDeletedFalse(
                TenantContext.DEFAULT_TENANT_ID, "customer_tier")).thenReturn(true);

        assertThatThrownBy(() -> ruleSetService.create(request))
                .isInstanceOf(RuleException.class)
                .hasMessageContaining("规则集已存在");
    }

    @Test
    void getById_shouldReturnRuleset_whenExists() {
        RuleSetEntity entity = RuleSetEntity.builder()
                .id("rs-001")
                .tenantId(TenantContext.DEFAULT_TENANT_ID)
                .code("customer_tier")
                .name("客户分级规则集")
                .status(RuleStatus.ENABLED)
                .priority(0)
                .version(1)
                .build();

        when(ruleSetRepository.findByIdAndDeletedFalse("rs-001")).thenReturn(Optional.of(entity));

        RuleSetResponse response = ruleSetService.getById("rs-001");

        assertThat(response.getId()).isEqualTo("rs-001");
        assertThat(response.getCode()).isEqualTo("customer_tier");
    }

    @Test
    void getById_shouldThrow_whenNotFound() {
        when(ruleSetRepository.findByIdAndDeletedFalse("nonexistent")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> ruleSetService.getById("nonexistent"))
                .isInstanceOf(RuleException.class)
                .hasMessageContaining("规则集不存在");
    }

    @Test
    void update_shouldUpdateFields_whenValid() {
        RuleSetEntity entity = RuleSetEntity.builder()
                .id("rs-001")
                .tenantId(TenantContext.DEFAULT_TENANT_ID)
                .code("customer_tier")
                .name("旧名称")
                .status(RuleStatus.ENABLED)
                .priority(0)
                .version(1)
                .build();

        RuleSetUpdateRequest request = new RuleSetUpdateRequest();
        request.setName("新名称");
        request.setStatus(RuleStatus.DISABLED);
        request.setPriority(99);

        when(ruleSetRepository.findByIdAndDeletedFalse("rs-001")).thenReturn(Optional.of(entity));
        when(ruleSetRepository.save(any(RuleSetEntity.class))).thenReturn(entity);

        RuleSetResponse response = ruleSetService.update("rs-001", request);

        assertThat(response.getName()).isEqualTo("新名称");
        assertThat(response.getStatus()).isEqualTo("DISABLED");
        assertThat(response.getPriority()).isEqualTo(99);
    }

    @Test
    void delete_shouldSoftDelete_whenNoRules() {
        RuleSetEntity entity = RuleSetEntity.builder()
                .id("rs-001")
                .tenantId(TenantContext.DEFAULT_TENANT_ID)
                .code("customer_tier")
                .name("客户分级规则集")
                .deleted(false)
                .build();

        when(ruleSetRepository.findByIdAndDeletedFalse("rs-001")).thenReturn(Optional.of(entity));
        when(ruleDefinitionRepository.countByTenantIdAndRulesetIdAndDeletedFalse(
                TenantContext.DEFAULT_TENANT_ID, "rs-001")).thenReturn(0L);
        when(ruleSetRepository.save(any(RuleSetEntity.class))).thenReturn(entity);

        ruleSetService.delete("rs-001");

        assertThat(entity.getDeleted()).isTrue();
        verify(ruleSetRepository).save(entity);
    }
}
