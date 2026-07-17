package com.metaplatform.ea.mapping.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.ea.capability.service.BusinessCapabilityService;
import com.metaplatform.ea.common.TenantContext;
import com.metaplatform.ea.mapping.dto.ConsistencyCheckResponse;
import com.metaplatform.ea.mapping.dto.MappingFilterRequest;
import com.metaplatform.ea.mapping.dto.MappingResponse;
import com.metaplatform.ea.mapping.dto.SyncResultResponse;
import com.metaplatform.ea.mapping.entity.CapabilityConceptMappingEntity;
import com.metaplatform.ea.mapping.repository.CapabilityConceptMappingRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CapabilityConceptMappingEnhancementTest {

    @Mock
    private CapabilityConceptMappingRepository mappingRepository;

    @Mock
    private BusinessCapabilityService capabilityService;

    @Mock
    private OntIntegrationService ontIntegrationService;

    @Spy
    private ObjectMapper objectMapper = new ObjectMapper();

    @InjectMocks
    private CapabilityConceptMappingService mappingService;

    private UUID capabilityId;

    @BeforeEach
    void setUp() {
        TenantContext.set("tenant-default");
        capabilityId = UUID.randomUUID();
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void listWithFilters_shouldFilterByMappingType() {
        CapabilityConceptMappingEntity direct = buildEntity(UUID.randomUUID(), capabilityId, "concept-001", "DIRECT");
        when(mappingRepository.findByTenantIdAndMappingTypeAndDeletedAtIsNull("tenant-default", "DIRECT"))
                .thenReturn(List.of(direct));

        MappingFilterRequest filter = new MappingFilterRequest();
        filter.setMappingType("DIRECT");

        List<MappingResponse> result = mappingService.listWithFilters(filter);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getMappingType()).isEqualTo("DIRECT");
    }

    @Test
    void listWithFilters_shouldFilterByKeyword() {
        CapabilityConceptMappingEntity entity = buildEntity(UUID.randomUUID(), capabilityId, "concept-customer-001", "DIRECT");
        entity.setConceptCode("CUSTOMER");
        when(mappingRepository.findByTenantIdAndDeletedAtIsNull("tenant-default"))
                .thenReturn(List.of(entity));

        MappingFilterRequest filter = new MappingFilterRequest();
        filter.setKeyword("customer");

        List<MappingResponse> result = mappingService.listWithFilters(filter);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getConceptCode()).isEqualTo("CUSTOMER");
    }

    @Test
    void listWithFilters_shouldReturnEmpty_whenKeywordNoMatch() {
        CapabilityConceptMappingEntity entity = buildEntity(UUID.randomUUID(), capabilityId, "concept-001", "DIRECT");
        when(mappingRepository.findByTenantIdAndDeletedAtIsNull("tenant-default"))
                .thenReturn(List.of(entity));

        MappingFilterRequest filter = new MappingFilterRequest();
        filter.setKeyword("zzz-no-match");

        List<MappingResponse> result = mappingService.listWithFilters(filter);

        assertThat(result).isEmpty();
    }

    @Test
    void checkConsistency_shouldReportCountByType() {
        CapabilityConceptMappingEntity direct = buildEntity(UUID.randomUUID(), capabilityId, "concept-1", "DIRECT");
        CapabilityConceptMappingEntity derived = buildEntity(UUID.randomUUID(), capabilityId, "concept-2", "DERIVED");
        when(mappingRepository.findByTenantIdAndDeletedAtIsNull("tenant-default"))
                .thenReturn(List.of(direct, derived));

        ConsistencyCheckResponse response = mappingService.checkConsistency();

        assertThat(response.getTotalMappings()).isEqualTo(2);
        assertThat(response.getDirectMappings()).isEqualTo(1);
        assertThat(response.getDerivedMappings()).isEqualTo(1);
        assertThat(response.getAbstractMappings()).isEqualTo(0);
        assertThat(response.isConsistent()).isTrue();
    }

    @Test
    void checkConsistency_shouldWarn_whenAbstractHasCode() {
        CapabilityConceptMappingEntity entity = buildEntity(UUID.randomUUID(), capabilityId, "concept-x", "ABSTRACT");
        entity.setConceptCode("CODE_X");
        when(mappingRepository.findByTenantIdAndDeletedAtIsNull("tenant-default"))
                .thenReturn(List.of(entity));

        ConsistencyCheckResponse response = mappingService.checkConsistency();

        assertThat(response.getIssues()).hasSize(1);
        assertThat(response.getIssues().get(0).getCode()).isEqualTo("ABSTRACT_HAS_CODE");
    }

    @Test
    void syncFromOntology_shouldSkip_whenConceptsNull() {
        SyncResultResponse response = mappingService.syncFromOntology(null);

        assertThat(response.getCreatedCount()).isEqualTo(0);
        assertThat(response.getSkippedCount()).isEqualTo(0);
        assertThat(response.getSummary()).contains("跳过同步");
    }

    @Test
    void syncFromOntology_shouldCreate_whenNewConcept() {
        when(mappingRepository.findByTenantIdAndDeletedAtIsNull("tenant-default")).thenReturn(List.of());

        CapabilityConceptMappingService.OntConceptSnapshot snapshot = new CapabilityConceptMappingService.OntConceptSnapshot();
        snapshot.setConceptId("concept-new");
        snapshot.setConceptCode("NEW_CODE");
        snapshot.setCapabilityId(capabilityId.toString());

        org.mockito.Mockito.lenient().when(capabilityService.findById(capabilityId)).thenReturn(null);
        ArgumentCaptor<CapabilityConceptMappingEntity> captor = ArgumentCaptor.forClass(CapabilityConceptMappingEntity.class);
        when(mappingRepository.save(captor.capture())).thenAnswer(i -> i.getArgument(0));

        SyncResultResponse response = mappingService.syncFromOntology(List.of(snapshot));

        assertThat(response.getCreatedCount()).isEqualTo(1);
        assertThat(response.getSkippedCount()).isEqualTo(0);
        assertThat(response.getSyncedConceptIds()).contains("concept-new");
        assertThat(captor.getValue().getMappingType()).isEqualTo("DIRECT");
    }

    @Test
    void syncFromOntology_shouldUpdate_whenCodeChanged() {
        UUID id = UUID.randomUUID();
        CapabilityConceptMappingEntity existing = buildEntity(id, capabilityId, "concept-1", "DIRECT");
        existing.setConceptCode("OLD_CODE");
        when(mappingRepository.findByTenantIdAndDeletedAtIsNull("tenant-default")).thenReturn(List.of(existing));

        CapabilityConceptMappingService.OntConceptSnapshot snapshot = new CapabilityConceptMappingService.OntConceptSnapshot();
        snapshot.setConceptId("concept-1");
        snapshot.setConceptCode("NEW_CODE");
        snapshot.setCapabilityId(capabilityId.toString());

        ArgumentCaptor<CapabilityConceptMappingEntity> captor = ArgumentCaptor.forClass(CapabilityConceptMappingEntity.class);
        when(mappingRepository.save(captor.capture())).thenAnswer(i -> i.getArgument(0));

        SyncResultResponse response = mappingService.syncFromOntology(List.of(snapshot));

        assertThat(response.getUpdatedCount()).isEqualTo(1);
        assertThat(captor.getValue().getConceptCode()).isEqualTo("NEW_CODE");
    }

    @Test
    void syncFromOntology_shouldSkip_whenNoCapabilityId() {
        when(mappingRepository.findByTenantIdAndDeletedAtIsNull("tenant-default")).thenReturn(List.of());

        CapabilityConceptMappingService.OntConceptSnapshot snapshot = new CapabilityConceptMappingService.OntConceptSnapshot();
        snapshot.setConceptId("concept-new");
        snapshot.setConceptCode("CODE");
        // capabilityId intentionally null

        SyncResultResponse response = mappingService.syncFromOntology(List.of(snapshot));

        assertThat(response.getCreatedCount()).isEqualTo(0);
        assertThat(response.getSkippedCount()).isEqualTo(1);
    }

    private CapabilityConceptMappingEntity buildEntity(UUID id, UUID capId, String conceptId, String mappingType) {
        return CapabilityConceptMappingEntity.builder()
                .id(id)
                .tenantId("tenant-default")
                .capabilityId(capId)
                .conceptId(conceptId)
                .conceptCode("CODE_" + conceptId)
                .mappingType(mappingType)
                .metadata("{}")
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();
    }
}