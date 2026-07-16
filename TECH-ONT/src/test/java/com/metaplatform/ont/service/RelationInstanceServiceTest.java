package com.metaplatform.ont.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.ont.common.TenantContext;
import com.metaplatform.ont.dto.RelationInstanceCreateRequest;
import com.metaplatform.ont.dto.RelationInstanceResponse;
import com.metaplatform.ont.entity.EntityEntity;
import com.metaplatform.ont.entity.RelationInstanceEntity;
import com.metaplatform.ont.entity.RelationTypeEntity;
import com.metaplatform.ont.exception.OntException;
import com.metaplatform.ont.repository.EntityRepository;
import com.metaplatform.ont.repository.RelationInstanceRepository;
import com.metaplatform.ont.repository.RelationTypeRepository;
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

@ExtendWith(MockitoExtension.class)
class RelationInstanceServiceTest {

    @Mock
    private RelationInstanceRepository relationInstanceRepository;

    @Mock
    private RelationTypeRepository relationTypeRepository;

    @Mock
    private EntityRepository entityRepository;

    @Mock
    private OntSyncService ontSyncService;

    @Spy
    private ObjectMapper objectMapper = new ObjectMapper();

    @InjectMocks
    private RelationInstanceService relationInstanceService;

    @BeforeEach
    void setUp() {
        TenantContext.clear();
        TenantContext.set(TenantContext.DEFAULT_TENANT_ID);
    }

    @Test
    void create_shouldReturnRelationInstance_whenValid() {
        RelationInstanceCreateRequest req = new RelationInstanceCreateRequest();
        req.setRelationTypeId("rt-1");
        req.setSourceEntityId("e-src");
        req.setTargetEntityId("e-tgt");

        RelationTypeEntity type = RelationTypeEntity.builder()
                .relationTypeId("rt-1")
                .tenantId(TenantContext.DEFAULT_TENANT_ID)
                .code("SUPPLIES_TO")
                .name("供货")
                .sourceConceptId("cs")
                .targetConceptId("ct")
                .cardinality("MANY_TO_MANY")
                .build();
        EntityEntity source = EntityEntity.builder().entityId("e-src")
                .tenantId(TenantContext.DEFAULT_TENANT_ID).conceptId("cs").name("供应商A").build();
        EntityEntity target = EntityEntity.builder().entityId("e-tgt")
                .tenantId(TenantContext.DEFAULT_TENANT_ID).conceptId("ct").name("客户A").build();

        when(relationTypeRepository.findById("rt-1")).thenReturn(Optional.of(type));
        when(entityRepository.findById("e-src")).thenReturn(Optional.of(source));
        when(entityRepository.findById("e-tgt")).thenReturn(Optional.of(target));
        when(relationInstanceRepository.findByTenantIdAndRelationTypeIdAndSourceEntityIdAndTargetEntityId(
                any(), any(), any(), any())).thenReturn(Optional.empty());
        when(relationInstanceRepository.save(any(RelationInstanceEntity.class))).thenAnswer(i -> {
            RelationInstanceEntity arg = i.getArgument(0);
            arg.setCreatedAt(java.time.Instant.now());
            arg.setUpdatedAt(java.time.Instant.now());
            return arg;
        });

        RelationInstanceResponse resp = relationInstanceService.create(req);
        assertThat(resp.getSourceEntityName()).isEqualTo("供应商A");
        assertThat(resp.getTargetEntityName()).isEqualTo("客户A");
        assertThat(resp.getRelationTypeCode()).isEqualTo("SUPPLIES_TO");
    }

    @Test
    void create_shouldThrow_whenRelationTypeNotFound() {
        RelationInstanceCreateRequest req = new RelationInstanceCreateRequest();
        req.setRelationTypeId("rt-x");
        req.setSourceEntityId("e-src");
        req.setTargetEntityId("e-tgt");

        when(relationTypeRepository.findById("rt-x")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> relationInstanceService.create(req))
                .isInstanceOf(OntException.class)
                .hasMessageContaining("关系类型");
    }

    @Test
    void create_shouldThrow_whenSourceConceptMismatch() {
        RelationInstanceCreateRequest req = new RelationInstanceCreateRequest();
        req.setRelationTypeId("rt-1");
        req.setSourceEntityId("e-src");
        req.setTargetEntityId("e-tgt");

        RelationTypeEntity type = RelationTypeEntity.builder()
                .relationTypeId("rt-1")
                .tenantId(TenantContext.DEFAULT_TENANT_ID)
                .code("X").name("x")
                .sourceConceptId("cs-expected")
                .targetConceptId("ct")
                .build();
        EntityEntity source = EntityEntity.builder().entityId("e-src")
                .tenantId(TenantContext.DEFAULT_TENANT_ID).conceptId("cs-different").build();
        EntityEntity target = EntityEntity.builder().entityId("e-tgt")
                .tenantId(TenantContext.DEFAULT_TENANT_ID).conceptId("ct").build();

        when(relationTypeRepository.findById("rt-1")).thenReturn(Optional.of(type));
        when(entityRepository.findById("e-src")).thenReturn(Optional.of(source));
        when(entityRepository.findById("e-tgt")).thenReturn(Optional.of(target));

        assertThatThrownBy(() -> relationInstanceService.create(req))
                .isInstanceOf(OntException.class)
                .hasMessageContaining("源实体概念");
    }

    @Test
    void create_shouldThrow_whenDuplicateInstance() {
        RelationInstanceCreateRequest req = new RelationInstanceCreateRequest();
        req.setRelationTypeId("rt-1");
        req.setSourceEntityId("e-src");
        req.setTargetEntityId("e-tgt");

        RelationTypeEntity type = RelationTypeEntity.builder()
                .relationTypeId("rt-1").tenantId(TenantContext.DEFAULT_TENANT_ID)
                .code("X").name("x").sourceConceptId("cs").targetConceptId("ct").build();
        EntityEntity source = EntityEntity.builder().entityId("e-src")
                .tenantId(TenantContext.DEFAULT_TENANT_ID).conceptId("cs").build();
        EntityEntity target = EntityEntity.builder().entityId("e-tgt")
                .tenantId(TenantContext.DEFAULT_TENANT_ID).conceptId("ct").build();
        RelationInstanceEntity existing = RelationInstanceEntity.builder()
                .relationInstanceId("dup").tenantId(TenantContext.DEFAULT_TENANT_ID).build();

        when(relationTypeRepository.findById("rt-1")).thenReturn(Optional.of(type));
        when(entityRepository.findById("e-src")).thenReturn(Optional.of(source));
        when(entityRepository.findById("e-tgt")).thenReturn(Optional.of(target));
        when(relationInstanceRepository.findByTenantIdAndRelationTypeIdAndSourceEntityIdAndTargetEntityId(
                any(), any(), any(), any())).thenReturn(Optional.of(existing));

        assertThatThrownBy(() -> relationInstanceService.create(req))
                .isInstanceOf(OntException.class)
                .hasMessageContaining("已存在");
    }

    @Test
    void delete_shouldRemoveInstance() {
        RelationInstanceEntity entity = RelationInstanceEntity.builder()
                .relationInstanceId("ri-1").tenantId(TenantContext.DEFAULT_TENANT_ID)
                .relationTypeId("rt-1").sourceEntityId("e1").targetEntityId("e2").build();
        when(relationInstanceRepository.findById("ri-1")).thenReturn(Optional.of(entity));

        relationInstanceService.delete("ri-1");
    }

    @Test
    void create_shouldThrow_whenCardinalityExceeded() {
        RelationInstanceCreateRequest req = new RelationInstanceCreateRequest();
        req.setRelationTypeId("rt-1");
        req.setSourceEntityId("e-src");
        req.setTargetEntityId("e-tgt");

        RelationTypeEntity type = RelationTypeEntity.builder()
                .relationTypeId("rt-1").tenantId(TenantContext.DEFAULT_TENANT_ID)
                .code("ONE_TO_ONE").name("x").sourceConceptId("cs").targetConceptId("ct")
                .cardinality("ONE_TO_ONE").maxCardinality(1).build();
        EntityEntity source = EntityEntity.builder().entityId("e-src")
                .tenantId(TenantContext.DEFAULT_TENANT_ID).conceptId("cs").build();
        EntityEntity target = EntityEntity.builder().entityId("e-tgt")
                .tenantId(TenantContext.DEFAULT_TENANT_ID).conceptId("ct").build();

        when(relationTypeRepository.findById("rt-1")).thenReturn(Optional.of(type));
        when(entityRepository.findById("e-src")).thenReturn(Optional.of(source));
        when(entityRepository.findById("e-tgt")).thenReturn(Optional.of(target));
        when(relationInstanceRepository.findByTenantIdAndRelationTypeIdAndSourceEntityIdAndTargetEntityId(
                any(), any(), any(), any())).thenReturn(Optional.empty());
        when(relationInstanceRepository.countByTenantIdAndRelationTypeIdAndSourceEntityId(
                TenantContext.DEFAULT_TENANT_ID, "rt-1", "e-src")).thenReturn(1L);

        assertThatThrownBy(() -> relationInstanceService.create(req))
                .isInstanceOf(OntException.class)
                .hasMessageContaining("基数");
    }
}