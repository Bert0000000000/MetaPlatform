package com.metaplatform.ont.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.ont.common.TenantContext;
import com.metaplatform.ont.dto.BatchEntityCreateRequest;
import com.metaplatform.ont.dto.BatchEntityCreateResponse;
import com.metaplatform.ont.dto.BatchEntityItem;
import com.metaplatform.ont.dto.EntityCreateRequest;
import com.metaplatform.ont.dto.EntityResponse;
import com.metaplatform.ont.entity.AttributeEntity;
import com.metaplatform.ont.entity.ConceptAttributeEntity;
import com.metaplatform.ont.entity.ConceptEntity;
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

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class EntityServiceTest {

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
    void create_shouldReturnEntityWithValues() {
        String conceptId = "concept-001";
        String attributeId = "attr-001";
        String entityId = "entity-001";

        EntityCreateRequest request = new EntityCreateRequest();
        request.setConceptId(conceptId);
        request.setCode("C001");
        request.setName("客户一号");
        Map<String, Object> values = new HashMap<>();
        values.put("TAGS", "VIP");
        request.setAttributes(values);

        ConceptEntity concept = ConceptEntity.builder()
                .conceptId(conceptId)
                .tenantId(TenantContext.DEFAULT_TENANT_ID)
                .code("CUSTOMER")
                .name("客户")
                .build();

        AttributeEntity attribute = AttributeEntity.builder()
                .attributeId(attributeId)
                .tenantId(TenantContext.DEFAULT_TENANT_ID)
                .code("TAGS")
                .name("标签")
                .dataType("STRING")
                .required(false)
                .build();

        ConceptAttributeEntity association = ConceptAttributeEntity.builder()
                .tenantId(TenantContext.DEFAULT_TENANT_ID)
                .conceptId(conceptId)
                .attributeId(attributeId)
                .build();

        EntityEntity saved = EntityEntity.builder()
                .entityId(entityId)
                .tenantId(TenantContext.DEFAULT_TENANT_ID)
                .conceptId(conceptId)
                .code("C001")
                .name("客户一号")
                .build();

        when(conceptRepository.findById(conceptId)).thenReturn(Optional.of(concept));
        when(entityRepository.existsByTenantIdAndConceptIdAndCode(TenantContext.DEFAULT_TENANT_ID, conceptId, "C001")).thenReturn(false);
        when(entityRepository.save(any(EntityEntity.class))).thenReturn(saved);
        when(conceptAttributeRepository.findByTenantIdAndConceptId(TenantContext.DEFAULT_TENANT_ID, conceptId))
                .thenReturn(Collections.singletonList(association));
        when(attributeRepository.findById(attributeId)).thenReturn(Optional.of(attribute));
        when(valueRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        EntityResponse response = entityService.create(request);

        assertThat(response.getCode()).isEqualTo("C001");
        assertThat(response.getAttributes()).containsKey("TAGS");
        assertThat(response.getAttributes().get("TAGS").getAttributeId()).isEqualTo(attributeId);
        assertThat(response.getAttributes().get("TAGS").getValue()).isEqualTo("VIP");
    }

    // ==================== 批量创建测试 ====================

    @Test
    void batchCreate_shouldCreateAll_whenAllValid() {
        String conceptId = "concept-001";

        ConceptEntity concept = ConceptEntity.builder()
                .conceptId(conceptId)
                .tenantId(TenantContext.DEFAULT_TENANT_ID)
                .code("CUSTOMER")
                .name("客户")
                .build();

        BatchEntityItem item1 = new BatchEntityItem();
        item1.setCode("E001");
        item1.setName("实体1");

        BatchEntityItem item2 = new BatchEntityItem();
        item2.setCode("E002");
        item2.setName("实体2");

        BatchEntityCreateRequest request = new BatchEntityCreateRequest();
        request.setConceptId(conceptId);
        request.setEntities(List.of(item1, item2));

        when(conceptRepository.findById(conceptId)).thenReturn(Optional.of(concept));
        when(entityRepository.existsByTenantIdAndConceptIdAndCode(
                TenantContext.DEFAULT_TENANT_ID, conceptId, "E001")).thenReturn(false);
        when(entityRepository.existsByTenantIdAndConceptIdAndCode(
                TenantContext.DEFAULT_TENANT_ID, conceptId, "E002")).thenReturn(false);
        when(entityRepository.save(any(EntityEntity.class))).thenAnswer(i -> {
            EntityEntity e = i.getArgument(0);
            e.setEntityId(UUID.randomUUID().toString());
            return e;
        });
        when(conceptAttributeRepository.findByTenantIdAndConceptId(
                TenantContext.DEFAULT_TENANT_ID, conceptId))
                .thenReturn(Collections.emptyList());

        BatchEntityCreateResponse response = entityService.batchCreate(request);

        assertThat(response.getCreated()).isEqualTo(2);
        assertThat(response.getFailed()).isEqualTo(0);
        assertThat(response.getResults()).hasSize(2);
        assertThat(response.getResults().get(0).getCode()).isEqualTo("E001");
        assertThat(response.getResults().get(0).isSuccess()).isTrue();
        assertThat(response.getResults().get(1).getCode()).isEqualTo("E002");
        assertThat(response.getResults().get(1).isSuccess()).isTrue();
    }

    @Test
    void batchCreate_shouldThrow_whenCodeAlreadyExists() {
        String conceptId = "concept-001";

        ConceptEntity concept = ConceptEntity.builder()
                .conceptId(conceptId)
                .tenantId(TenantContext.DEFAULT_TENANT_ID)
                .build();

        BatchEntityItem item = new BatchEntityItem();
        item.setCode("E001");
        item.setName("实体1");

        BatchEntityCreateRequest request = new BatchEntityCreateRequest();
        request.setConceptId(conceptId);
        request.setEntities(List.of(item));

        when(conceptRepository.findById(conceptId)).thenReturn(Optional.of(concept));
        when(entityRepository.existsByTenantIdAndConceptIdAndCode(
                TenantContext.DEFAULT_TENANT_ID, conceptId, "E001")).thenReturn(true);

        assertThatThrownBy(() -> entityService.batchCreate(request))
                .isInstanceOf(OntException.class)
                .hasMessageContaining("实体编码已存在");
    }

    @Test
    void batchCreate_shouldThrow_whenExceedsLimit() {
        String conceptId = "concept-001";

        ConceptEntity concept = ConceptEntity.builder()
                .conceptId(conceptId)
                .tenantId(TenantContext.DEFAULT_TENANT_ID)
                .build();

        List<BatchEntityItem> items = new ArrayList<>();
        for (int i = 0; i < 101; i++) {
            BatchEntityItem item = new BatchEntityItem();
            item.setCode(String.format("E%03d", i));
            item.setName("实体" + i);
            items.add(item);
        }

        BatchEntityCreateRequest request = new BatchEntityCreateRequest();
        request.setConceptId(conceptId);
        request.setEntities(items);

        when(conceptRepository.findById(conceptId)).thenReturn(Optional.of(concept));

        assertThatThrownBy(() -> entityService.batchCreate(request))
                .isInstanceOf(OntException.class)
                .hasMessageContaining("单次最多创建 100 条实体");
    }

    @Test
    void batchCreate_shouldThrow_whenDuplicateCodeInBatch() {
        String conceptId = "concept-001";

        ConceptEntity concept = ConceptEntity.builder()
                .conceptId(conceptId)
                .tenantId(TenantContext.DEFAULT_TENANT_ID)
                .build();

        BatchEntityItem item1 = new BatchEntityItem();
        item1.setCode("E001");
        item1.setName("实体1");

        BatchEntityItem item2 = new BatchEntityItem();
        item2.setCode("E001");
        item2.setName("实体2");

        BatchEntityCreateRequest request = new BatchEntityCreateRequest();
        request.setConceptId(conceptId);
        request.setEntities(List.of(item1, item2));

        when(conceptRepository.findById(conceptId)).thenReturn(Optional.of(concept));
        when(entityRepository.existsByTenantIdAndConceptIdAndCode(
                TenantContext.DEFAULT_TENANT_ID, conceptId, "E001")).thenReturn(false);

        assertThatThrownBy(() -> entityService.batchCreate(request))
                .isInstanceOf(OntException.class)
                .hasMessageContaining("批次内实体编码重复");
    }

    @Test
    void batchCreate_shouldThrow_whenConceptNotFound() {
        BatchEntityItem item = new BatchEntityItem();
        item.setCode("E001");
        item.setName("实体1");

        BatchEntityCreateRequest request = new BatchEntityCreateRequest();
        request.setConceptId("non-existent");
        request.setEntities(List.of(item));

        when(conceptRepository.findById("non-existent")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> entityService.batchCreate(request))
                .isInstanceOf(OntException.class)
                .hasMessageContaining("概念不存在");
    }
}
