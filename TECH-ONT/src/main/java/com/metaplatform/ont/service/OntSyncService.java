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
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.neo4j.core.Neo4jClient;
import org.springframework.stereotype.Service;

import java.util.Optional;

/**
 * PG -> Neo4j 同步服务（Outbox 模式简化版）。
 * <p>
 * 同步策略：实时同步（在 CRUD 操作后调用 sync 方法）。
 * 错误处理：Neo4j 写入失败仅记日志，不影响 PG 事务。
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class OntSyncService {

    private final ConceptNodeRepository conceptNodeRepository;
    private final EntityNodeRepository entityNodeRepository;
    private final Neo4jClient neo4jClient;
    private final ConceptRepository conceptRepository;
    private final EntityRepository entityRepository;
    private final RelationInstanceRepository relationInstanceRepository;
    private final RelationTypeRepository relationTypeRepository;

    /**
     * 同步概念到 Neo4j。
     * PG 中存在则 upsert ConceptNode；不存在则从 Neo4j 删除。
     */
    public void syncConcept(String conceptId) {
        try {
            Optional<ConceptEntity> opt = conceptRepository.findById(conceptId);
            if (opt.isEmpty()) {
                conceptNodeRepository.deleteById(conceptId);
                log.debug("syncConcept: deleted ConceptNode [{}]", conceptId);
                return;
            }
            ConceptEntity concept = opt.get();
            ConceptNode node = ConceptNode.builder()
                    .id(concept.getConceptId())
                    .tenantId(concept.getTenantId())
                    .code(concept.getCode())
                    .name(concept.getName())
                    .description(concept.getDescription())
                    .build();
            conceptNodeRepository.save(node);
            log.debug("syncConcept: upserted ConceptNode [{}]", conceptId);
        } catch (Exception e) {
            log.warn("syncConcept failed [{}]: {}", conceptId, e.getMessage());
        }
    }

    /**
     * 同步实体到 Neo4j。
     * PG 中存在则 upsert EntityNode；不存在则从 Neo4j 删除。
     */
    public void syncEntity(String entityId) {
        try {
            Optional<EntityEntity> opt = entityRepository.findById(entityId);
            if (opt.isEmpty()) {
                entityNodeRepository.deleteById(entityId);
                log.debug("syncEntity: deleted EntityNode [{}]", entityId);
                return;
            }
            EntityEntity entity = opt.get();
            String conceptCode = conceptRepository.findById(entity.getConceptId())
                    .map(ConceptEntity::getCode).orElse(null);
            EntityNode node = EntityNode.builder()
                    .id(entity.getEntityId())
                    .tenantId(entity.getTenantId())
                    .conceptId(entity.getConceptId())
                    .conceptCode(conceptCode)
                    .code(entity.getCode())
                    .name(entity.getName())
                    .build();
            entityNodeRepository.save(node);
            log.debug("syncEntity: upserted EntityNode [{}]", entityId);
        } catch (Exception e) {
            log.warn("syncEntity failed [{}]: {}", entityId, e.getMessage());
        }
    }

    /**
     * 同步关系实例到 Neo4j。
     * PG 中存在则 upsert RELATES_TO 关系边；不存在则从 Neo4j 删除。
     * 关系类型代码存储为关系属性 relationTypeCode，Neo4j 关系类型统一为 RELATES_TO。
     */
    public void syncRelation(String relationInstanceId) {
        try {
            Optional<RelationInstanceEntity> opt = relationInstanceRepository.findById(relationInstanceId);
            if (opt.isEmpty()) {
                neo4jClient.query(
                                "MATCH ()-[r {relationId: $relationId}]-() DELETE r")
                        .bind(relationInstanceId).to("relationId")
                        .run();
                log.debug("syncRelation: deleted relation [{}]", relationInstanceId);
                return;
            }
            RelationInstanceEntity instance = opt.get();
            RelationTypeEntity type = relationTypeRepository.findById(instance.getRelationTypeId()).orElse(null);
            String relationTypeCode = type != null ? type.getCode() : "RELATES_TO";

            neo4jClient.query(
                            "MATCH (s {id: $sourceId}), (t {id: $targetId}) " +
                            "MERGE (s)-[r:RELATES_TO {relationId: $relationId}]->(t) " +
                            "SET r.tenantId = $tenantId, " +
                            "    r.relationTypeCode = $relationTypeCode, " +
                            "    r.sourceId = $sourceId, " +
                            "    r.targetId = $targetId")
                    .bind(instance.getSourceEntityId()).to("sourceId")
                    .bind(instance.getTargetEntityId()).to("targetId")
                    .bind(relationInstanceId).to("relationId")
                    .bind(instance.getTenantId()).to("tenantId")
                    .bind(relationTypeCode).to("relationTypeCode")
                    .run();
            log.debug("syncRelation: upserted relation [{}]", relationInstanceId);
        } catch (Exception e) {
            log.warn("syncRelation failed [{}]: {}", relationInstanceId, e.getMessage());
        }
    }
}
