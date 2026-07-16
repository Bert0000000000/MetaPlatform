package com.metaplatform.ont.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.ont.common.TenantContext;
import com.metaplatform.ont.dto.RelationTypeCreateRequest;
import com.metaplatform.ont.dto.RelationTypeResponse;
import com.metaplatform.ont.dto.RelationTypeUpdateRequest;
import com.metaplatform.ont.entity.ConceptEntity;
import com.metaplatform.ont.entity.RelationTypeEntity;
import com.metaplatform.ont.exception.OntException;
import com.metaplatform.ont.repository.ConceptRepository;
import com.metaplatform.ont.repository.RelationInstanceRepository;
import com.metaplatform.ont.repository.RelationTypeRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Collections;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RelationTypeServiceTest {

    @Mock
    private RelationTypeRepository relationTypeRepository;

    @Mock
    private RelationInstanceRepository relationInstanceRepository;

    @Mock
    private ConceptRepository conceptRepository;

    @Spy
    private ObjectMapper objectMapper = new ObjectMapper();

    @InjectMocks
    private RelationTypeService relationTypeService;

    @BeforeEach
    void setUp() {
        TenantContext.clear();
        TenantContext.set(TenantContext.DEFAULT_TENANT_ID);
    }

    @Test
    void create_shouldReturnRelationType_whenCodeAvailable() {
        RelationTypeCreateRequest request = new RelationTypeCreateRequest();
        request.setCode("SUPPLIES_TO");
        request.setName("供货");
        request.setSourceConceptId("concept-supplier");
        request.setTargetConceptId("concept-customer");
        request.setCardinality("MANY_TO_MANY");

        ConceptEntity source = ConceptEntity.builder().conceptId("concept-supplier")
                .tenantId(TenantContext.DEFAULT_TENANT_ID).name("供应商").build();
        ConceptEntity target = ConceptEntity.builder().conceptId("concept-customer")
                .tenantId(TenantContext.DEFAULT_TENANT_ID).name("客户").build();

        when(relationTypeRepository.existsByTenantIdAndCode(TenantContext.DEFAULT_TENANT_ID, "SUPPLIES_TO"))
                .thenReturn(false);
        when(conceptRepository.findById("concept-supplier")).thenReturn(Optional.of(source));
        when(conceptRepository.findById("concept-customer")).thenReturn(Optional.of(target));
        when(relationTypeRepository.save(any(RelationTypeEntity.class))).thenAnswer(i -> {
            RelationTypeEntity arg = i.getArgument(0);
            arg.setCreatedAt(java.time.Instant.now());
            arg.setUpdatedAt(java.time.Instant.now());
            return arg;
        });

        RelationTypeResponse response = relationTypeService.create(request);

        assertThat(response.getCode()).isEqualTo("SUPPLIES_TO");
        assertThat(response.getSourceConceptName()).isEqualTo("供应商");
        assertThat(response.getTargetConceptName()).isEqualTo("客户");
        assertThat(response.getCardinality()).isEqualTo("MANY_TO_MANY");
    }

    @Test
    void create_shouldThrow_whenCodeExists() {
        RelationTypeCreateRequest request = new RelationTypeCreateRequest();
        request.setCode("SUPPLIES_TO");
        request.setName("供货");
        request.setSourceConceptId("concept-supplier");
        request.setTargetConceptId("concept-customer");

        when(relationTypeRepository.existsByTenantIdAndCode(TenantContext.DEFAULT_TENANT_ID, "SUPPLIES_TO"))
                .thenReturn(true);

        assertThatThrownBy(() -> relationTypeService.create(request))
                .isInstanceOf(OntException.class)
                .hasMessageContaining("已存在");
    }

    @Test
    void create_shouldThrow_whenInvalidCardinality() {
        RelationTypeCreateRequest request = new RelationTypeCreateRequest();
        request.setCode("X");
        request.setName("X");
        request.setSourceConceptId("c1");
        request.setTargetConceptId("c2");
        request.setCardinality("WRONG");

        assertThatThrownBy(() -> relationTypeService.create(request))
                .isInstanceOf(OntException.class)
                .hasMessageContaining("基数");
    }

    @Test
    void update_shouldChangeCardinality_whenValid() {
        RelationTypeEntity entity = RelationTypeEntity.builder()
                .relationTypeId("rt-1")
                .tenantId(TenantContext.DEFAULT_TENANT_ID)
                .code("X")
                .name("x")
                .sourceConceptId("cs")
                .targetConceptId("ct")
                .direction("DIRECTED")
                .cardinality("MANY_TO_MANY")
                .minCardinality(0)
                .maxCardinality(0)
                .build();
        when(relationTypeRepository.findById("rt-1")).thenReturn(Optional.of(entity));
        when(relationTypeRepository.save(any(RelationTypeEntity.class))).thenAnswer(i -> i.getArgument(0));
        when(relationInstanceRepository.countByTenantIdAndRelationTypeId(any(), any())).thenReturn(0L);

        RelationTypeUpdateRequest req = new RelationTypeUpdateRequest();
        req.setCardinality("ONE_TO_ONE");
        req.setMaxCardinality(1);

        RelationTypeResponse resp = relationTypeService.update("rt-1", req);
        assertThat(resp.getCardinality()).isEqualTo("ONE_TO_ONE");
        assertThat(resp.getMaxCardinality()).isEqualTo(1);
    }

    @Test
    void update_shouldThrow_whenMinGreaterThanMax() {
        RelationTypeEntity entity = RelationTypeEntity.builder()
                .relationTypeId("rt-1")
                .tenantId(TenantContext.DEFAULT_TENANT_ID)
                .code("X")
                .name("x")
                .sourceConceptId("cs")
                .targetConceptId("ct")
                .cardinality("MANY_TO_MANY")
                .minCardinality(0)
                .maxCardinality(0)
                .build();
        when(relationTypeRepository.findById("rt-1")).thenReturn(Optional.of(entity));

        RelationTypeUpdateRequest req = new RelationTypeUpdateRequest();
        req.setMinCardinality(5);
        req.setMaxCardinality(2);

        assertThatThrownBy(() -> relationTypeService.update("rt-1", req))
                .isInstanceOf(OntException.class)
                .hasMessageContaining("基数");
    }

    @Test
    void delete_shouldThrow_whenInstancesExistAndNoCascade() {
        RelationTypeEntity entity = RelationTypeEntity.builder()
                .relationTypeId("rt-1")
                .tenantId(TenantContext.DEFAULT_TENANT_ID)
                .code("X")
                .name("x")
                .build();
        when(relationTypeRepository.findById("rt-1")).thenReturn(Optional.of(entity));
        when(relationInstanceRepository.countByTenantIdAndRelationTypeId(TenantContext.DEFAULT_TENANT_ID, "rt-1"))
                .thenReturn(3L);

        assertThatThrownBy(() -> relationTypeService.delete("rt-1", false))
                .isInstanceOf(OntException.class)
                .hasMessageContaining("级联");
    }

    @Test
    void delete_shouldSucceed_whenCascade() {
        RelationTypeEntity entity = RelationTypeEntity.builder()
                .relationTypeId("rt-1")
                .tenantId(TenantContext.DEFAULT_TENANT_ID)
                .code("X")
                .name("x")
                .build();
        when(relationTypeRepository.findById("rt-1")).thenReturn(Optional.of(entity));
        when(relationInstanceRepository.countByTenantIdAndRelationTypeId(TenantContext.DEFAULT_TENANT_ID, "rt-1"))
                .thenReturn(3L);

        long count = relationTypeService.delete("rt-1", true);
        assertThat(count).isEqualTo(3L);
    }
}