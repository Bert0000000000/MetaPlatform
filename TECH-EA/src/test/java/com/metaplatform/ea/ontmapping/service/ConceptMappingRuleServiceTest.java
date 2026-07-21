package com.metaplatform.ea.ontmapping.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.ea.common.TenantContext;
import com.metaplatform.ea.exception.EaException;
import com.metaplatform.ea.mapping.service.OntIntegrationService;
import com.metaplatform.ea.ontmapping.dto.CreateConceptMappingRuleRequest;
import com.metaplatform.ea.ontmapping.dto.UpdateConceptMappingRuleRequest;
import com.metaplatform.ea.ontmapping.entity.ConceptMappingRuleEntity;
import com.metaplatform.ea.ontmapping.repository.ConceptMappingRuleRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ConceptMappingRuleServiceTest {

    @Mock
    private ConceptMappingRuleRepository ruleRepository;

    @Mock
    private OntIntegrationService ontIntegrationService;

    @Spy
    private ObjectMapper objectMapper = new ObjectMapper();

    @InjectMocks
    private ConceptMappingRuleService ruleService;

    private UUID ruleId;
    private UUID assetId;

    @BeforeEach
    void setUp() {
        TenantContext.set("tenant-default");
        ruleId = UUID.randomUUID();
        assetId = UUID.randomUUID();
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void create_shouldReturnResponse_whenValid() {
        CreateConceptMappingRuleRequest request = new CreateConceptMappingRuleRequest();
        request.setAssetType("CAPABILITY");
        request.setAssetId(assetId);
        request.setAssetName("客户管理");
        request.setConceptId("concept-001");
        request.setConceptCode("CUSTOMER");
        request.setMappingType("DIRECT");

        when(ruleRepository.existsByTenantIdAndAssetTypeAndAssetIdAndConceptIdAndDeletedAtIsNull(
                "tenant-default", "CAPABILITY", assetId, "concept-001")).thenReturn(false);
        when(ruleRepository.save(any(ConceptMappingRuleEntity.class))).thenAnswer(i -> i.getArgument(0));

        var response = ruleService.create(request);

        assertThat(response.getAssetType()).isEqualTo("CAPABILITY");
        assertThat(response.getConceptId()).isEqualTo("concept-001");
        assertThat(response.getMappingType()).isEqualTo("DIRECT");
    }

    @Test
    void create_shouldThrow_whenAlreadyExists() {
        CreateConceptMappingRuleRequest request = new CreateConceptMappingRuleRequest();
        request.setAssetType("CAPABILITY");
        request.setAssetId(assetId);
        request.setConceptId("concept-001");
        request.setMappingType("DIRECT");

        when(ruleRepository.existsByTenantIdAndAssetTypeAndAssetIdAndConceptIdAndDeletedAtIsNull(
                "tenant-default", "CAPABILITY", assetId, "concept-001")).thenReturn(true);

        assertThatThrownBy(() -> ruleService.create(request))
                .isInstanceOf(EaException.class)
                .hasMessageContaining("该架构资产已映射到此 Ontology 概念");
    }

    @Test
    void create_shouldThrow_whenInvalidMappingType() {
        CreateConceptMappingRuleRequest request = new CreateConceptMappingRuleRequest();
        request.setAssetType("CAPABILITY");
        request.setAssetId(assetId);
        request.setConceptId("concept-001");
        request.setMappingType("INVALID");

        assertThatThrownBy(() -> ruleService.create(request))
                .isInstanceOf(EaException.class)
                .hasMessageContaining("mappingType 必须为 DIRECT、DERIVED 或 ABSTRACT");
    }

    @Test
    void list_shouldReturnRules() {
        ConceptMappingRuleEntity entity = buildEntity(ruleId, assetId, "concept-001", "DIRECT");
        when(ruleRepository.findByTenantIdAndDeletedAtIsNull("tenant-default"))
                .thenReturn(List.of(entity));

        var result = ruleService.list(null);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getConceptId()).isEqualTo("concept-001");
    }

    @Test
    void update_shouldUpdateFields() {
        ConceptMappingRuleEntity entity = buildEntity(ruleId, assetId, "concept-001", "DIRECT");
        when(ruleRepository.findByIdAndTenantIdAndDeletedAtIsNull(ruleId, "tenant-default"))
                .thenReturn(Optional.of(entity));
        when(ruleRepository.save(any(ConceptMappingRuleEntity.class))).thenAnswer(i -> i.getArgument(0));

        UpdateConceptMappingRuleRequest request = new UpdateConceptMappingRuleRequest();
        request.setMappingType("DERIVED");
        request.setConceptCode("UPDATED_CODE");

        var response = ruleService.update(ruleId, request);

        assertThat(response.getMappingType()).isEqualTo("DERIVED");
        assertThat(response.getConceptCode()).isEqualTo("UPDATED_CODE");
    }

    @Test
    void delete_shouldSoftDelete() {
        ConceptMappingRuleEntity entity = buildEntity(ruleId, assetId, "concept-001", "DIRECT");
        when(ruleRepository.findByIdAndTenantIdAndDeletedAtIsNull(ruleId, "tenant-default"))
                .thenReturn(Optional.of(entity));
        when(ruleRepository.save(any(ConceptMappingRuleEntity.class))).thenAnswer(i -> i.getArgument(0));

        ruleService.delete(ruleId);

        assertThat(entity.getDeletedAt()).isNotNull();
    }

    private ConceptMappingRuleEntity buildEntity(UUID id, UUID assetId, String conceptId, String mappingType) {
        return ConceptMappingRuleEntity.builder()
                .id(id)
                .tenantId("tenant-default")
                .assetType("CAPABILITY")
                .assetId(assetId)
                .assetName("客户管理")
                .conceptId(conceptId)
                .conceptCode("CODE")
                .mappingType(mappingType)
                .metadata("{}")
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();
    }
}
