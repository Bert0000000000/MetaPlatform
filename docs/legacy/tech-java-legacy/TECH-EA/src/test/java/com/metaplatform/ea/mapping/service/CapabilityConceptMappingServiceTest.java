package com.metaplatform.ea.mapping.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.ea.capability.service.BusinessCapabilityService;
import com.metaplatform.ea.common.TenantContext;
import com.metaplatform.ea.exception.EaException;
import com.metaplatform.ea.mapping.dto.CreateMappingRequest;
import com.metaplatform.ea.mapping.dto.MapConceptRequest;
import com.metaplatform.ea.mapping.dto.MappingResponse;
import com.metaplatform.ea.mapping.dto.UpdateMappingRequest;
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
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CapabilityConceptMappingServiceTest {

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

    private UUID mappingId;
    private UUID capabilityId;

    @BeforeEach
    void setUp() {
        TenantContext.set("tenant-default");
        mappingId = UUID.randomUUID();
        capabilityId = UUID.randomUUID();
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void create_shouldReturnResponse_whenValid() {
        CreateMappingRequest request = new CreateMappingRequest();
        request.setCapabilityId(capabilityId);
        request.setConceptId("concept-001");
        request.setConceptCode("CUSTOMER");
        request.setMappingType("DIRECT");

        when(mappingRepository.existsByTenantIdAndCapabilityIdAndConceptIdAndDeletedAtIsNull(
                "tenant-default", capabilityId, "concept-001")).thenReturn(false);
        when(mappingRepository.save(any(CapabilityConceptMappingEntity.class))).thenAnswer(i -> i.getArgument(0));

        MappingResponse response = mappingService.create(request);

        assertThat(response.getConceptId()).isEqualTo("concept-001");
        assertThat(response.getMappingType()).isEqualTo("DIRECT");
        assertThat(response.getConceptCode()).isEqualTo("CUSTOMER");
    }

    @Test
    void create_shouldValidateConceptExists() {
        CreateMappingRequest request = new CreateMappingRequest();
        request.setCapabilityId(capabilityId);
        request.setConceptId("concept-001");
        request.setMappingType("DIRECT");

        doThrow(new EaException(com.metaplatform.ea.common.ErrorCode.NOT_FOUND, "Ontology 概念不存在: concept-001"))
                .when(ontIntegrationService).validateConceptExists("concept-001");

        assertThatThrownBy(() -> mappingService.create(request))
                .isInstanceOf(EaException.class)
                .hasMessageContaining("Ontology 概念不存在");
    }

    @Test
    void create_shouldThrow_whenAlreadyExists() {
        CreateMappingRequest request = new CreateMappingRequest();
        request.setCapabilityId(capabilityId);
        request.setConceptId("concept-001");
        request.setMappingType("DIRECT");

        when(mappingRepository.existsByTenantIdAndCapabilityIdAndConceptIdAndDeletedAtIsNull(
                "tenant-default", capabilityId, "concept-001")).thenReturn(true);

        assertThatThrownBy(() -> mappingService.create(request))
                .isInstanceOf(EaException.class)
                .hasMessageContaining("该能力已映射到此概念");
    }

    @Test
    void create_shouldThrow_whenInvalidMappingType() {
        CreateMappingRequest request = new CreateMappingRequest();
        request.setCapabilityId(capabilityId);
        request.setConceptId("concept-001");
        request.setMappingType("INVALID");

        assertThatThrownBy(() -> mappingService.create(request))
                .isInstanceOf(EaException.class)
                .hasMessageContaining("mappingType 必须为 DIRECT、DERIVED 或 ABSTRACT");
    }

    @Test
    void mapConcept_shouldCreateMapping() {
        MapConceptRequest request = new MapConceptRequest();
        request.setConceptId("concept-002");
        request.setConceptCode("ORDER");
        request.setMappingType("DERIVED");

        when(mappingRepository.existsByTenantIdAndCapabilityIdAndConceptIdAndDeletedAtIsNull(
                "tenant-default", capabilityId, "concept-002")).thenReturn(false);
        when(mappingRepository.save(any(CapabilityConceptMappingEntity.class))).thenAnswer(i -> i.getArgument(0));

        MappingResponse response = mappingService.mapConcept(capabilityId, request);

        assertThat(response.getCapabilityId()).isEqualTo(capabilityId);
        assertThat(response.getConceptId()).isEqualTo("concept-002");
        assertThat(response.getMappingType()).isEqualTo("DERIVED");
    }

    @Test
    void getConceptsForCapability_shouldReturnMappings() {
        CapabilityConceptMappingEntity entity = buildEntity(mappingId, capabilityId, "concept-001", "DIRECT");
        when(mappingRepository.findByTenantIdAndCapabilityIdAndDeletedAtIsNull("tenant-default", capabilityId))
                .thenReturn(List.of(entity));

        List<MappingResponse> result = mappingService.getConceptsForCapability(capabilityId);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getConceptId()).isEqualTo("concept-001");
    }

    @Test
    void getCapabilitiesForConcept_shouldReturnMappings() {
        CapabilityConceptMappingEntity entity = buildEntity(mappingId, capabilityId, "concept-001", "DIRECT");
        when(mappingRepository.findByTenantIdAndConceptIdAndDeletedAtIsNull("tenant-default", "concept-001"))
                .thenReturn(List.of(entity));

        List<MappingResponse> result = mappingService.getCapabilitiesForConcept("concept-001");

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getCapabilityId()).isEqualTo(capabilityId);
    }

    @Test
    void delete_shouldSoftDelete() {
        CapabilityConceptMappingEntity entity = buildEntity(mappingId, capabilityId, "concept-001", "DIRECT");
        when(mappingRepository.findByIdAndTenantIdAndDeletedAtIsNull(mappingId, "tenant-default"))
                .thenReturn(Optional.of(entity));
        ArgumentCaptor<CapabilityConceptMappingEntity> captor = ArgumentCaptor.forClass(CapabilityConceptMappingEntity.class);
        when(mappingRepository.save(captor.capture())).thenAnswer(i -> i.getArgument(0));

        mappingService.delete(mappingId);

        assertThat(captor.getValue().getDeletedAt()).isNotNull();
    }

    @Test
    void update_shouldUpdateFields() {
        CapabilityConceptMappingEntity entity = buildEntity(mappingId, capabilityId, "concept-001", "DIRECT");
        when(mappingRepository.findByIdAndTenantIdAndDeletedAtIsNull(mappingId, "tenant-default"))
                .thenReturn(Optional.of(entity));
        when(mappingRepository.save(any(CapabilityConceptMappingEntity.class))).thenAnswer(i -> i.getArgument(0));

        UpdateMappingRequest request = new UpdateMappingRequest();
        request.setMappingType("DERIVED");
        request.setConceptCode("UPDATED_CODE");

        MappingResponse response = mappingService.update(mappingId, request);

        assertThat(response.getMappingType()).isEqualTo("DERIVED");
        assertThat(response.getConceptCode()).isEqualTo("UPDATED_CODE");
    }

    private CapabilityConceptMappingEntity buildEntity(UUID id, UUID capId, String conceptId, String mappingType) {
        return CapabilityConceptMappingEntity.builder()
                .id(id)
                .tenantId("tenant-default")
                .capabilityId(capId)
                .conceptId(conceptId)
                .conceptCode("CODE")
                .mappingType(mappingType)
                .metadata("{}")
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();
    }
}
