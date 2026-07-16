package com.metaplatform.ont.service;

import com.metaplatform.ont.entity.ConceptEntity;
import com.metaplatform.ont.entity.EntityEntity;
import com.metaplatform.ont.entity.RelationInstanceEntity;
import com.metaplatform.ont.entity.RelationTypeEntity;
import com.metaplatform.ont.graph.node.ConceptNode;
import com.metaplatform.ont.graph.node.EntityNode;
import com.metaplatform.ont.graph.repository.ConceptNodeRepository;
import com.metaplatform.ont.graph.repository.EntityNodeRepository;
import com.metaplatform.ont.repository.ConceptRepository;
import com.metaplatform.ont.repository.EntityRepository;
import com.metaplatform.ont.repository.RelationInstanceRepository;
import com.metaplatform.ont.repository.RelationTypeRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.neo4j.core.Neo4jClient;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

/**
 * P1-ONT-03 / P1-ONT-04 测试：Neo4j 节点模型与 PG->Neo4j 同步。
 * 所有 Neo4j 组件均 mock，不连接真实 Neo4j。
 */
@ExtendWith(MockitoExtension.class)
class OntSyncServiceTest {

    @Mock
    private ConceptNodeRepository conceptNodeRepository;

    @Mock
    private EntityNodeRepository entityNodeRepository;

    @Mock
    private Neo4jClient neo4jClient;

    @Mock
    private ConceptRepository conceptRepository;

    @Mock
    private EntityRepository entityRepository;

    @Mock
    private RelationInstanceRepository relationInstanceRepository;

    @Mock
    private RelationTypeRepository relationTypeRepository;

    @InjectMocks
    private OntSyncService ontSyncService;

    @Test
    void syncConcept_shouldSaveConceptNode_whenConceptExists() {
        String conceptId = "concept-001";
        ConceptEntity concept = ConceptEntity.builder()
                .conceptId(conceptId)
                .tenantId("tenant-default")
                .code("CUSTOMER")
                .name("客户")
                .description("客户概念")
                .build();

        when(conceptRepository.findById(conceptId)).thenReturn(Optional.of(concept));

        ontSyncService.syncConcept(conceptId);

        verify(conceptNodeRepository).save(any(ConceptNode.class));
    }

    @Test
    void syncEntity_shouldSaveEntityNode_withConceptCode() {
        String entityId = "entity-001";
        String conceptId = "concept-001";
        EntityEntity entity = EntityEntity.builder()
                .entityId(entityId)
                .tenantId("tenant-default")
                .conceptId(conceptId)
                .code("C001")
                .name("客户一号")
                .build();
        ConceptEntity concept = ConceptEntity.builder()
                .conceptId(conceptId)
                .code("CUSTOMER")
                .build();

        when(entityRepository.findById(entityId)).thenReturn(Optional.of(entity));
        when(conceptRepository.findById(conceptId)).thenReturn(Optional.of(concept));

        ontSyncService.syncEntity(entityId);

        verify(entityNodeRepository).save(argThat(node ->
                "CUSTOMER".equals(((EntityNode) node).getConceptCode())));
    }

    @Test
    void syncConcept_shouldDeleteFromNeo4j_whenConceptNotInPG() {
        String conceptId = "concept-gone";

        when(conceptRepository.findById(conceptId)).thenReturn(Optional.empty());

        ontSyncService.syncConcept(conceptId);

        verify(conceptNodeRepository).deleteById(conceptId);
        verify(conceptNodeRepository, never()).save(any());
    }

    @Test
    void syncRelation_shouldCreateRelation_whenInstanceExists() {
        String riId = "ri-001";
        RelationInstanceEntity instance = RelationInstanceEntity.builder()
                .relationInstanceId(riId)
                .tenantId("tenant-default")
                .relationTypeId("rt-1")
                .sourceEntityId("e-src")
                .targetEntityId("e-tgt")
                .build();
        RelationTypeEntity type = RelationTypeEntity.builder()
                .relationTypeId("rt-1")
                .code("SUPPLIES_TO")
                .build();

        when(relationInstanceRepository.findById(riId)).thenReturn(Optional.of(instance));
        when(relationTypeRepository.findById("rt-1")).thenReturn(Optional.of(type));

        Neo4jClient.UnboundRunnableSpec unboundSpec = mock(Neo4jClient.UnboundRunnableSpec.class);
        Neo4jClient.RunnableSpec runnableSpec = mock(Neo4jClient.RunnableSpec.class);
        @SuppressWarnings("unchecked")
        Neo4jClient.OngoingBindSpec<Object, Neo4jClient.RunnableSpec> bindSpec =
                mock(Neo4jClient.OngoingBindSpec.class);

        when(neo4jClient.query(anyString())).thenReturn(unboundSpec);
        when(unboundSpec.bind(any())).thenReturn(bindSpec);
        when(bindSpec.to(anyString())).thenReturn(runnableSpec);
        when(runnableSpec.bind(any())).thenReturn(bindSpec);

        ontSyncService.syncRelation(riId);

        verify(neo4jClient).query(anyString());
        verify(runnableSpec, atLeast(1)).run();
    }

    @Test
    void syncConcept_shouldNotThrow_whenNeo4jFails() {
        String conceptId = "concept-001";
        ConceptEntity concept = ConceptEntity.builder()
                .conceptId(conceptId)
                .tenantId("tenant-default")
                .code("CUSTOMER")
                .name("客户")
                .build();

        when(conceptRepository.findById(conceptId)).thenReturn(Optional.of(concept));
        when(conceptNodeRepository.save(any(ConceptNode.class)))
                .thenThrow(new RuntimeException("Neo4j connection refused"));

        assertThatCode(() -> ontSyncService.syncConcept(conceptId))
                .doesNotThrowAnyException();
    }
}
