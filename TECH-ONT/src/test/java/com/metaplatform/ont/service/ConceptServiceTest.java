package com.metaplatform.ont.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.ont.common.TenantContext;
import com.metaplatform.ont.dto.ConceptCreateRequest;
import com.metaplatform.ont.dto.ConceptResponse;
import com.metaplatform.ont.entity.ConceptEntity;
import com.metaplatform.ont.exception.OntException;
import com.metaplatform.ont.repository.ConceptAttributeRepository;
import com.metaplatform.ont.repository.ConceptRepository;
import com.metaplatform.ont.repository.EntityRepository;
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
class ConceptServiceTest {

    @Mock
    private ConceptRepository conceptRepository;

    @Mock
    private ConceptAttributeRepository conceptAttributeRepository;

    @Mock
    private EntityRepository entityRepository;

    @Mock
    private OntSyncService ontSyncService;

    @Spy
    private ObjectMapper objectMapper = new ObjectMapper();

    @InjectMocks
    private ConceptService conceptService;

    @BeforeEach
    void setUp() {
        TenantContext.clear();
        TenantContext.set(TenantContext.DEFAULT_TENANT_ID);
    }

    @Test
    void create_shouldReturnConcept_whenCodeIsAvailable() {
        ConceptCreateRequest request = new ConceptCreateRequest();
        request.setCode("CUSTOMER");
        request.setName("客户");
        request.setDescription("客户概念");

        String conceptId = "concept-001";
        ConceptEntity saved = ConceptEntity.builder()
                .conceptId(conceptId)
                .tenantId(TenantContext.DEFAULT_TENANT_ID)
                .code("CUSTOMER")
                .name("客户")
                .description("客户概念")
                .depth(0)
                .path("/" + conceptId)
                .build();

        when(conceptRepository.existsByTenantIdAndCode(TenantContext.DEFAULT_TENANT_ID, "CUSTOMER")).thenReturn(false);
        when(conceptRepository.existsByTenantIdAndNameAndParentConceptId(TenantContext.DEFAULT_TENANT_ID, "客户", null)).thenReturn(false);
        when(conceptRepository.save(any(ConceptEntity.class))).thenReturn(saved);
        when(conceptAttributeRepository.findByTenantIdAndConceptId(TenantContext.DEFAULT_TENANT_ID, conceptId))
                .thenReturn(Collections.emptyList());
        when(entityRepository.countByTenantIdAndConceptId(TenantContext.DEFAULT_TENANT_ID, conceptId)).thenReturn(0L);
        when(conceptRepository.countByTenantIdAndParentConceptId(TenantContext.DEFAULT_TENANT_ID, conceptId)).thenReturn(0L);

        ConceptResponse response = conceptService.create(request);

        assertThat(response.getCode()).isEqualTo("CUSTOMER");
        assertThat(response.getName()).isEqualTo("客户");
        assertThat(response.getConceptId()).isEqualTo(conceptId);
    }

    @Test
    void create_shouldThrow_whenCodeExists() {
        ConceptCreateRequest request = new ConceptCreateRequest();
        request.setCode("CUSTOMER");

        when(conceptRepository.existsByTenantIdAndCode(TenantContext.DEFAULT_TENANT_ID, "CUSTOMER")).thenReturn(true);

        assertThatThrownBy(() -> conceptService.create(request))
                .isInstanceOf(OntException.class)
                .hasMessageContaining("概念已存在");
    }

    @Test
    void getById_shouldReturnConcept_whenExists() {
        String conceptId = "concept-001";
        ConceptEntity concept = ConceptEntity.builder()
                .conceptId(conceptId)
                .tenantId(TenantContext.DEFAULT_TENANT_ID)
                .code("CUSTOMER")
                .name("客户")
                .depth(0)
                .path("/" + conceptId)
                .build();

        when(conceptRepository.findById(conceptId)).thenReturn(Optional.of(concept));
        when(conceptAttributeRepository.findByTenantIdAndConceptId(TenantContext.DEFAULT_TENANT_ID, conceptId))
                .thenReturn(Collections.emptyList());
        when(entityRepository.countByTenantIdAndConceptId(TenantContext.DEFAULT_TENANT_ID, conceptId)).thenReturn(0L);
        when(conceptRepository.countByTenantIdAndParentConceptId(TenantContext.DEFAULT_TENANT_ID, conceptId)).thenReturn(0L);

        ConceptResponse response = conceptService.getById(conceptId);
        assertThat(response.getConceptId()).isEqualTo(conceptId);
    }
}
