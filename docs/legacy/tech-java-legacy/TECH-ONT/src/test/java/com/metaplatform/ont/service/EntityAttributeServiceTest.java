package com.metaplatform.ont.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.ont.common.TenantContext;
import com.metaplatform.ont.dto.EntityAttributeSetRequest;
import com.metaplatform.ont.entity.AttributeEntity;
import com.metaplatform.ont.entity.EntityAttributeValueEntity;
import com.metaplatform.ont.entity.EntityEntity;
import com.metaplatform.ont.exception.OntException;
import com.metaplatform.ont.repository.AttributeRepository;
import com.metaplatform.ont.repository.ConceptAttributeRepository;
import com.metaplatform.ont.repository.ConceptRepository;
import com.metaplatform.ont.repository.EntityAttributeValueRepository;
import com.metaplatform.ont.repository.EntityRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class EntityAttributeServiceTest {

    @Mock
    private EntityRepository entityRepository;

    @Mock
    private ConceptRepository conceptRepository;

    @Mock
    private AttributeRepository attributeRepository;

    @Mock
    private ConceptAttributeRepository conceptAttributeRepository;

    @Mock
    private EntityAttributeValueRepository valueRepository;

    @Mock
    private OntSyncService ontSyncService;

    @Spy
    private ObjectMapper objectMapper = new ObjectMapper();

    @InjectMocks
    private EntityService entityService;

    @BeforeEach
    void setUp() {
        TenantContext.clear();
        TenantContext.set(TenantContext.DEFAULT_TENANT_ID);
    }

    @Test
    void setSingleAttribute_shouldThrow_whenAttributeNotFound() {
        EntityEntity entity = EntityEntity.builder()
                .entityId("e1").tenantId(TenantContext.DEFAULT_TENANT_ID)
                .conceptId("c1").name("E").build();
        when(entityRepository.findById("e1")).thenReturn(Optional.of(entity));
        when(attributeRepository.findById("a-x")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> entityService.setSingleAttribute("e1", "a-x", "v"))
                .isInstanceOf(OntException.class)
                .hasMessageContaining("属性");
    }

    @Test
    void setSingleAttribute_shouldThrow_whenAttributeNotAssociated() {
        EntityEntity entity = EntityEntity.builder()
                .entityId("e1").tenantId(TenantContext.DEFAULT_TENANT_ID)
                .conceptId("c1").name("E").build();
        AttributeEntity attr = AttributeEntity.builder()
                .attributeId("a1").tenantId(TenantContext.DEFAULT_TENANT_ID)
                .code("X").name("x").dataType("STRING").build();

        when(entityRepository.findById("e1")).thenReturn(Optional.of(entity));
        when(attributeRepository.findById("a1")).thenReturn(Optional.of(attr));
        when(conceptAttributeRepository.existsByTenantIdAndConceptIdAndAttributeId(
                TenantContext.DEFAULT_TENANT_ID, "c1", "a1")).thenReturn(false);

        assertThatThrownBy(() -> entityService.setSingleAttribute("e1", "a1", "v"))
                .isInstanceOf(OntException.class)
                .hasMessageContaining("未关联");
    }

    @Test
    void setSingleAttribute_shouldSucceed_whenValid() {
        EntityEntity entity = EntityEntity.builder()
                .entityId("e1").tenantId(TenantContext.DEFAULT_TENANT_ID)
                .conceptId("c1").name("E").updatedAt(java.time.Instant.now()).build();
        AttributeEntity attr = AttributeEntity.builder()
                .attributeId("a1").tenantId(TenantContext.DEFAULT_TENANT_ID)
                .code("X").name("x").dataType("STRING").build();

        when(entityRepository.findById("e1")).thenReturn(Optional.of(entity));
        when(attributeRepository.findById("a1")).thenReturn(Optional.of(attr));
        when(conceptAttributeRepository.existsByTenantIdAndConceptIdAndAttributeId(
                TenantContext.DEFAULT_TENANT_ID, "c1", "a1")).thenReturn(true);
        when(valueRepository.findByTenantIdAndEntityIdAndAttributeId(any(), any(), any()))
                .thenReturn(Optional.empty());
        when(valueRepository.save(any(EntityAttributeValueEntity.class))).thenAnswer(i -> i.getArgument(0));

        Map<String, Object> result = entityService.setSingleAttribute("e1", "a1", "hello");
        assertThat(result.get("attributeCode")).isEqualTo("X");
        assertThat(result.get("value")).isEqualTo("hello");
    }

    @Test
    void batchSetAttributes_shouldCollectErrors_andUpdateValid() {
        EntityEntity entity = EntityEntity.builder()
                .entityId("e1").tenantId(TenantContext.DEFAULT_TENANT_ID)
                .conceptId("c1").name("E").build();
        AttributeEntity attr1 = AttributeEntity.builder()
                .attributeId("a1").tenantId(TenantContext.DEFAULT_TENANT_ID)
                .code("X").name("x").dataType("STRING").build();
        AttributeEntity attr2 = AttributeEntity.builder()
                .attributeId("a2").tenantId(TenantContext.DEFAULT_TENANT_ID)
                .code("Y").name("y").dataType("STRING").build();

        when(entityRepository.findById("e1")).thenReturn(Optional.of(entity));
        when(attributeRepository.findById("a1")).thenReturn(Optional.of(attr1));
        when(attributeRepository.findById("a2")).thenReturn(Optional.of(attr2));
        when(conceptAttributeRepository.existsByTenantIdAndConceptIdAndAttributeId(
                TenantContext.DEFAULT_TENANT_ID, "c1", "a1")).thenReturn(true);
        when(conceptAttributeRepository.existsByTenantIdAndConceptIdAndAttributeId(
                TenantContext.DEFAULT_TENANT_ID, "c1", "a2")).thenReturn(false);
        when(valueRepository.findByTenantIdAndEntityIdAndAttributeId(any(), any(), any()))
                .thenReturn(Optional.empty());
        when(valueRepository.save(any(EntityAttributeValueEntity.class))).thenAnswer(i -> i.getArgument(0));

        EntityAttributeSetRequest req1 = new EntityAttributeSetRequest();
        req1.setAttributeId("a1");
        req1.setValue("hello");
        EntityAttributeSetRequest req2 = new EntityAttributeSetRequest();
        req2.setAttributeId("a2");
        req2.setValue("world");

        Map<String, Object> result = entityService.batchSetAttributes("e1", List.of(req1, req2));
        assertThat(((List<?>) result.get("updated"))).hasSize(1);
        assertThat(((List<?>) result.get("errors"))).hasSize(1);
    }
}