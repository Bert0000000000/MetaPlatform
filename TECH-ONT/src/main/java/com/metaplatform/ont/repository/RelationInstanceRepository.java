package com.metaplatform.ont.repository;

import com.metaplatform.ont.entity.RelationInstanceEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface RelationInstanceRepository extends JpaRepository<RelationInstanceEntity, String> {

    List<RelationInstanceEntity> findByTenantIdAndRelationTypeId(String tenantId, String relationTypeId);

    List<RelationInstanceEntity> findByTenantIdAndSourceEntityId(String tenantId, String sourceEntityId);

    List<RelationInstanceEntity> findByTenantIdAndTargetEntityId(String tenantId, String targetEntityId);

    List<RelationInstanceEntity> findByTenantId(String tenantId);

    long countByTenantIdAndRelationTypeId(String tenantId, String relationTypeId);

    long countByTenantIdAndRelationTypeIdAndSourceEntityId(String tenantId, String relationTypeId, String sourceEntityId);

    Optional<RelationInstanceEntity> findByTenantIdAndRelationTypeIdAndSourceEntityIdAndTargetEntityId(
            String tenantId, String relationTypeId, String sourceEntityId, String targetEntityId);

    void deleteByTenantIdAndRelationTypeId(String tenantId, String relationTypeId);
}