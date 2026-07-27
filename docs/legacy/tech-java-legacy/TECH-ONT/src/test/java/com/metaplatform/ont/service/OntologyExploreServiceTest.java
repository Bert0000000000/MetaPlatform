package com.metaplatform.ont.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.ont.common.TenantContext;
import com.metaplatform.ont.dto.OntologyConceptDto;
import com.metaplatform.ont.entity.AttributeEntity;
import com.metaplatform.ont.entity.ConceptAttributeEntity;
import com.metaplatform.ont.entity.ConceptEntity;
import com.metaplatform.ont.entity.EntityAttributeValueEntity;
import com.metaplatform.ont.entity.EntityEntity;
import com.metaplatform.ont.entity.RelationTypeEntity;
import com.metaplatform.ont.exception.OntException;
import com.metaplatform.ont.repository.AttributeRepository;
import com.metaplatform.ont.repository.ConceptAttributeRepository;
import com.metaplatform.ont.repository.ConceptRepository;
import com.metaplatform.ont.repository.EntityAttributeValueRepository;
import com.metaplatform.ont.repository.EntityRepository;
import com.metaplatform.ont.repository.RelationTypeRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

/**
 * V12-01 测试：OntologyExploreService（REQ-030 / REQ-031）。
 */
@ExtendWith(MockitoExtension.class)
class OntologyExploreServiceTest {

    private static final String TENANT_ID = TenantContext.DEFAULT_TENANT_ID;
    private static final String CONCEPT_ID = "concept-customer";
    private static final String ATTRIBUTE_ID = "attr-customer-id";
    private static final String ENTITY_ID = "entity-001";
    private static final String RELATION_TYPE_ID = "rt-customer-contract";
    private static final String TARGET_CONCEPT_ID = "concept-contract";

    @Mock
    private ConceptRepository conceptRepository;
    @Mock
    private ConceptAttributeRepository conceptAttributeRepository;
    @Mock
    private AttributeRepository attributeRepository;
    @Mock
    private EntityRepository entityRepository;
    @Mock
    private EntityAttributeValueRepository entityAttributeValueRepository;
    @Mock
    private RelationTypeRepository relationTypeRepository;

    @Spy
    private ObjectMapper objectMapper = new ObjectMapper();

    @InjectMocks
    private OntologyExploreService exploreService;

    @BeforeEach
    void setUp() {
        TenantContext.clear();
        TenantContext.set(TENANT_ID);
    }

    @Test
    void search_byKeyword_shouldMatchConceptName() {
        ConceptEntity customer = buildConcept("客户", "客户概念");
        ConceptEntity product = buildConcept("产品", "产品概念");
        when(conceptRepository.findByTenantId(TENANT_ID)).thenReturn(List.of(customer, product));

        List<OntologyConceptDto> results = exploreService.search("客户", null, null);

        assertThat(results).hasSize(1);
        assertThat(results.get(0).getName()).isEqualTo("客户");
    }

    @Test
    void search_byAttribute_shouldReturnConceptsWithMatchingAttribute() {
        ConceptEntity customer = buildConcept("客户", "客户概念");
        when(conceptRepository.findByTenantId(TENANT_ID)).thenReturn(List.of(customer));

        AttributeEntity attrEntity = AttributeEntity.builder()
                .attributeId(ATTRIBUTE_ID)
                .tenantId(TENANT_ID)
                .code("customerId")
                .name("客户编号")
                .dataType("STRING")
                .required(true)
                .description("客户唯一标识")
                .build();
        when(attributeRepository.findByTenantId(TENANT_ID)).thenReturn(List.of(attrEntity));

        ConceptAttributeEntity assoc = ConceptAttributeEntity.builder()
                .tenantId(TENANT_ID)
                .conceptId(CONCEPT_ID)
                .attributeId(ATTRIBUTE_ID)
                .inherited(false)
                .build();
        when(conceptAttributeRepository.findByTenantIdAndAttributeId(TENANT_ID, ATTRIBUTE_ID))
                .thenReturn(List.of(assoc));
        when(conceptAttributeRepository.findByTenantIdAndConceptId(TENANT_ID, CONCEPT_ID))
                .thenReturn(List.of(assoc));
        when(attributeRepository.findById(ATTRIBUTE_ID)).thenReturn(Optional.of(attrEntity));

        List<OntologyConceptDto> results = exploreService.search(null, "客户编号", null);

        assertThat(results).hasSize(1);
        assertThat(results.get(0).getAttributes()).hasSize(1);
        assertThat(results.get(0).getAttributes().get(0).getName()).isEqualTo("客户编号");
        assertThat(results.get(0).getAttributes().get(0).isRequired()).isTrue();
    }

    @Test
    void search_byTag_shouldMatchMetadataTags() throws Exception {
        JsonNode metadata = objectMapper.readTree("{\"tags\": [\"core\", \"sales\"]}");
        ConceptEntity customer = ConceptEntity.builder()
                .conceptId(CONCEPT_ID)
                .tenantId(TENANT_ID)
                .code("CUSTOMER")
                .name("客户")
                .description("客户概念")
                .metadata(metadata)
                .depth(0)
                .path("/" + CONCEPT_ID)
                .build();
        when(conceptRepository.findByTenantId(TENANT_ID)).thenReturn(List.of(customer));

        List<OntologyConceptDto> results = exploreService.search(null, null, "core");

        assertThat(results).hasSize(1);
        assertThat(results.get(0).getTags()).containsExactly("core", "sales");
    }

    @Test
    void search_withNoFilters_shouldReturnAllConcepts() {
        ConceptEntity customer = buildConcept("客户", "客户概念");
        ConceptEntity product = buildConcept("产品", "产品概念");
        when(conceptRepository.findByTenantId(TENANT_ID)).thenReturn(List.of(customer, product));
        when(conceptAttributeRepository.findByTenantIdAndConceptId(eq(TENANT_ID), any()))
                .thenReturn(Collections.emptyList());
        when(relationTypeRepository.findByTenantIdAndSourceConceptId(eq(TENANT_ID), any()))
                .thenReturn(Collections.emptyList());
        when(relationTypeRepository.findByTenantIdAndTargetConceptId(eq(TENANT_ID), any()))
                .thenReturn(Collections.emptyList());
        when(conceptRepository.findByTenantIdAndParentConceptId(TENANT_ID, CONCEPT_ID))
                .thenReturn(Collections.emptyList());

        List<OntologyConceptDto> results = exploreService.search(null, null, null);

        assertThat(results).hasSize(2);
    }

    @Test
    void getDetail_shouldReturnFullConceptWithAttributesAndInstances() {
        ConceptEntity customer = buildConcept("客户", "客户概念");
        when(conceptRepository.findById(CONCEPT_ID)).thenReturn(Optional.of(customer));

        ConceptAttributeEntity assoc = ConceptAttributeEntity.builder()
                .tenantId(TENANT_ID)
                .conceptId(CONCEPT_ID)
                .attributeId(ATTRIBUTE_ID)
                .inherited(false)
                .build();
        when(conceptAttributeRepository.findByTenantIdAndConceptId(TENANT_ID, CONCEPT_ID))
                .thenReturn(List.of(assoc));

        AttributeEntity attrEntity = AttributeEntity.builder()
                .attributeId(ATTRIBUTE_ID)
                .tenantId(TENANT_ID)
                .code("customerId")
                .name("客户编号")
                .dataType("STRING")
                .required(true)
                .description("客户唯一标识")
                .build();
        when(attributeRepository.findById(ATTRIBUTE_ID)).thenReturn(Optional.of(attrEntity));

        EntityEntity entity = EntityEntity.builder()
                .entityId(ENTITY_ID)
                .tenantId(TENANT_ID)
                .conceptId(CONCEPT_ID)
                .code("C001")
                .name("北京华夏科技")
                .build();
        when(entityRepository.findByTenantIdAndConceptId(TENANT_ID, CONCEPT_ID)).thenReturn(List.of(entity));

        EntityAttributeValueEntity value = EntityAttributeValueEntity.builder()
                .tenantId(TENANT_ID)
                .entityId(ENTITY_ID)
                .attributeId(ATTRIBUTE_ID)
                .value(objectMapper.valueToTree("C001"))
                .valid(true)
                .build();
        when(entityAttributeValueRepository.findByTenantIdAndEntityId(TENANT_ID, ENTITY_ID))
                .thenReturn(List.of(value));

        RelationTypeEntity relationType = RelationTypeEntity.builder()
                .relationTypeId(RELATION_TYPE_ID)
                .tenantId(TENANT_ID)
                .code("CUSTOMER_HAS_CONTRACT")
                .name("客户签订合同")
                .sourceConceptId(CONCEPT_ID)
                .targetConceptId(TARGET_CONCEPT_ID)
                .build();
        when(relationTypeRepository.findByTenantIdAndSourceConceptId(TENANT_ID, CONCEPT_ID))
                .thenReturn(List.of(relationType));
        when(relationTypeRepository.findByTenantIdAndTargetConceptId(TENANT_ID, CONCEPT_ID))
                .thenReturn(Collections.emptyList());
        when(conceptRepository.findByTenantIdAndParentConceptId(TENANT_ID, CONCEPT_ID))
                .thenReturn(Collections.emptyList());

        OntologyConceptDto detail = exploreService.getDetail(CONCEPT_ID);

        assertThat(detail.getId()).isEqualTo(CONCEPT_ID);
        assertThat(detail.getName()).isEqualTo("客户");
        assertThat(detail.getDefinition()).isEqualTo("客户概念");
        assertThat(detail.getAttributes()).hasSize(1);
        assertThat(detail.getAttributes().get(0).getName()).isEqualTo("客户编号");
        assertThat(detail.getInstances()).hasSize(1);
        assertThat(detail.getInstances().get(0).getName()).isEqualTo("北京华夏科技");
        assertThat(detail.getInstances().get(0).getValues()).containsEntry("customerId", "C001");
        assertThat(detail.getRelatedConcepts()).containsExactly(TARGET_CONCEPT_ID);
    }

    @Test
    void getDetail_shouldThrow_whenConceptNotFound() {
        when(conceptRepository.findById("non-existent")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> exploreService.getDetail("non-existent"))
                .isInstanceOf(OntException.class)
                .hasMessageContaining("概念不存在");
    }

    @Test
    void getDetail_shouldThrow_whenTenantMismatch() {
        ConceptEntity otherTenantConcept = ConceptEntity.builder()
                .conceptId("concept-X")
                .tenantId("tenant-other")
                .code("X")
                .name("X")
                .depth(0)
                .path("/X")
                .build();
        when(conceptRepository.findById("concept-X")).thenReturn(Optional.of(otherTenantConcept));

        assertThatThrownBy(() -> exploreService.getDetail("concept-X"))
                .isInstanceOf(OntException.class)
                .hasMessageContaining("租户不匹配");
    }

    private ConceptEntity buildConcept(String name, String description) {
        return ConceptEntity.builder()
                .conceptId(CONCEPT_ID)
                .tenantId(TENANT_ID)
                .code(name.toUpperCase())
                .name(name)
                .description(description)
                .depth(0)
                .path("/" + CONCEPT_ID)
                .build();
    }
}
