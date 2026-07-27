package com.metaplatform.ont.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.ont.common.TenantContext;
import com.metaplatform.ont.dto.ConceptCreateRequest;
import com.metaplatform.ont.dto.ConceptHierarchyResponse;
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
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ConceptHierarchyServiceTest {

    @Mock
    private ConceptRepository conceptRepository;

    @Mock
    private ConceptAttributeRepository conceptAttributeRepository;

    @Mock
    private EntityRepository entityRepository;

    @Mock
    private OntSyncService ontSyncService;

    @Mock
    private EaWebhookService eaWebhookService;

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
    void createSubConcept_shouldInheritParent() {
        ConceptEntity parent = ConceptEntity.builder()
                .conceptId("p1").tenantId(TenantContext.DEFAULT_TENANT_ID)
                .code("PARENT").name("父概念").depth(0).path("/p1").level(1).build();

        ConceptEntity saved = ConceptEntity.builder()
                .conceptId("c1").tenantId(TenantContext.DEFAULT_TENANT_ID)
                .code("CHILD").name("子概念").parentConceptId("p1")
                .depth(1).path("/p1/c1").level(2).build();

        when(conceptRepository.findById("p1")).thenReturn(Optional.of(parent));
        when(conceptRepository.existsByTenantIdAndCode(any(), any())).thenReturn(false);
        when(conceptRepository.existsByTenantIdAndNameAndParentConceptId(any(), any(), any())).thenReturn(false);
        when(conceptRepository.save(any(ConceptEntity.class))).thenReturn(saved);
        when(conceptAttributeRepository.findByTenantIdAndConceptId(any(), any())).thenReturn(Collections.emptyList());
        when(entityRepository.countByTenantIdAndConceptId(any(), any())).thenReturn(0L);
        when(conceptRepository.countByTenantIdAndParentConceptId(any(), any())).thenReturn(0L);

        ConceptCreateRequest req = new ConceptCreateRequest();
        req.setCode("CHILD");
        req.setName("子概念");
        ConceptResponse resp = conceptService.createSubConcept("p1", req);

        assertThat(resp.getParentConceptId()).isEqualTo("p1");
        assertThat(resp.getDepth()).isEqualTo(1);
        assertThat(resp.getLevel()).isEqualTo(2);
    }

    @Test
    void moveConcept_shouldThrow_whenMoveToSelf() {
        ConceptEntity self = ConceptEntity.builder()
                .conceptId("c1").tenantId(TenantContext.DEFAULT_TENANT_ID)
                .code("X").name("x").build();
        when(conceptRepository.findById("c1")).thenReturn(Optional.of(self));

        assertThatThrownBy(() -> conceptService.moveConcept("c1", "c1"))
                .isInstanceOf(OntException.class)
                .hasMessageContaining("自身");
    }

    @Test
    void moveConcept_shouldThrow_whenCyclicAncestor() {
        ConceptEntity self = ConceptEntity.builder()
                .conceptId("c1").tenantId(TenantContext.DEFAULT_TENANT_ID)
                .code("X").name("x").parentConceptId("p1").build();
        ConceptEntity newParent = ConceptEntity.builder()
                .conceptId("p1").tenantId(TenantContext.DEFAULT_TENANT_ID)
                .code("P").name("p").parentConceptId("c1").build();
        ConceptEntity ancestor = ConceptEntity.builder()
                .conceptId("a1").tenantId(TenantContext.DEFAULT_TENANT_ID)
                .code("A").name("a").parentConceptId(null).build();

        when(conceptRepository.findById("c1")).thenReturn(Optional.of(self));
        when(conceptRepository.findById("p1")).thenReturn(Optional.of(newParent));

        assertThatThrownBy(() -> conceptService.moveConcept("c1", "p1"))
                .isInstanceOf(OntException.class)
                .hasMessageContaining("循环");
    }

    @Test
    void moveConcept_shouldThrow_whenNewParentNotFound() {
        ConceptEntity self = ConceptEntity.builder()
                .conceptId("c1").tenantId(TenantContext.DEFAULT_TENANT_ID)
                .code("X").name("x").build();
        when(conceptRepository.findById("c1")).thenReturn(Optional.of(self));
        when(conceptRepository.findById("p-x")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> conceptService.moveConcept("c1", "p-x"))
                .isInstanceOf(OntException.class)
                .hasMessageContaining("新父概念");
    }

    @Test
    void moveConcept_shouldSucceed_whenNoCycle() {
        ConceptEntity self = ConceptEntity.builder()
                .conceptId("c1").tenantId(TenantContext.DEFAULT_TENANT_ID)
                .code("X").name("x").parentConceptId("p-old")
                .depth(1).path("/p-old/c1").level(2).build();
        ConceptEntity newParent = ConceptEntity.builder()
                .conceptId("p-new").tenantId(TenantContext.DEFAULT_TENANT_ID)
                .code("PN").name("pn").parentConceptId(null)
                .depth(0).path("/p-new").level(1).build();

        when(conceptRepository.findById("c1")).thenReturn(Optional.of(self));
        when(conceptRepository.findById("p-new")).thenReturn(Optional.of(newParent));
        when(conceptRepository.save(any(ConceptEntity.class))).thenAnswer(i -> i.getArgument(0));
        when(conceptRepository.findByTenantIdAndParentConceptId(any(), any())).thenReturn(Collections.emptyList());
        when(conceptAttributeRepository.findByTenantIdAndConceptId(any(), any())).thenReturn(Collections.emptyList());
        when(entityRepository.countByTenantIdAndConceptId(any(), any())).thenReturn(0L);
        when(conceptRepository.countByTenantIdAndParentConceptId(any(), any())).thenReturn(0L);

        ConceptResponse resp = conceptService.moveConcept("c1", "p-new");
        assertThat(resp.getParentConceptId()).isEqualTo("p-new");
        assertThat(resp.getDepth()).isEqualTo(1);
        assertThat(resp.getLevel()).isEqualTo(2);
    }

    @Test
    void getAncestors_shouldReturnChainInOrder() {
        ConceptEntity root = ConceptEntity.builder()
                .conceptId("root").tenantId(TenantContext.DEFAULT_TENANT_ID)
                .code("R").name("根").parentConceptId(null).depth(0).path("/root").build();
        ConceptEntity mid = ConceptEntity.builder()
                .conceptId("mid").tenantId(TenantContext.DEFAULT_TENANT_ID)
                .code("M").name("中间").parentConceptId("root").depth(1).path("/root/mid").build();
        ConceptEntity leaf = ConceptEntity.builder()
                .conceptId("leaf").tenantId(TenantContext.DEFAULT_TENANT_ID)
                .code("L").name("叶子").parentConceptId("mid").depth(2).path("/root/mid/leaf").build();

        when(conceptRepository.findById("leaf")).thenReturn(Optional.of(leaf));
        when(conceptRepository.findById("mid")).thenReturn(Optional.of(mid));
        when(conceptRepository.findById("root")).thenReturn(Optional.of(root));

        ConceptHierarchyResponse resp = conceptService.getAncestors("leaf");
        assertThat(resp.getItems()).hasSize(2);
        assertThat(resp.getItems().get(0).getConceptId()).isEqualTo("root");
        assertThat(resp.getItems().get(1).getConceptId()).isEqualTo("mid");
    }

    @Test
    void getDescendants_shouldReturnAllDescendants() {
        ConceptEntity root = ConceptEntity.builder()
                .conceptId("root").tenantId(TenantContext.DEFAULT_TENANT_ID)
                .code("R").name("根").parentConceptId(null).build();
        ConceptEntity mid = ConceptEntity.builder()
                .conceptId("mid").tenantId(TenantContext.DEFAULT_TENANT_ID)
                .code("M").name("中间").parentConceptId("root").build();
        ConceptEntity leaf = ConceptEntity.builder()
                .conceptId("leaf").tenantId(TenantContext.DEFAULT_TENANT_ID)
                .code("L").name("叶子").parentConceptId("mid").build();

        when(conceptRepository.findById("root")).thenReturn(Optional.of(root));
        when(conceptRepository.findByTenantId(TenantContext.DEFAULT_TENANT_ID))
                .thenReturn(List.of(root, mid, leaf));

        ConceptHierarchyResponse resp = conceptService.getDescendants("root");
        assertThat(resp.getItems()).hasSize(2);
        assertThat(resp.getItems().stream().map(n -> n.getConceptId()).toList())
                .containsExactlyInAnyOrder("mid", "leaf");
    }

    @Test
    void getHierarchy_shouldReturnRoots_whenRootIdNull() {
        ConceptEntity root1 = ConceptEntity.builder()
                .conceptId("r1").tenantId(TenantContext.DEFAULT_TENANT_ID)
                .code("R1").name("根1").parentConceptId(null).depth(0).path("/r1").level(1).build();
        ConceptEntity root2 = ConceptEntity.builder()
                .conceptId("r2").tenantId(TenantContext.DEFAULT_TENANT_ID)
                .code("R2").name("根2").parentConceptId(null).depth(0).path("/r2").level(1).build();
        ConceptEntity child = ConceptEntity.builder()
                .conceptId("c1").tenantId(TenantContext.DEFAULT_TENANT_ID)
                .code("C1").name("子").parentConceptId("r1").build();

        when(conceptRepository.findByTenantId(TenantContext.DEFAULT_TENANT_ID))
                .thenReturn(List.of(root1, root2, child));

        ConceptHierarchyResponse resp = conceptService.getHierarchy(null, 5);
        assertThat(resp.getItems()).hasSize(2);
    }
}