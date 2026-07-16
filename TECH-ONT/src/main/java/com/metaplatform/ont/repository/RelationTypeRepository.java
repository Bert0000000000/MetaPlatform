package com.metaplatform.ont.repository;

import com.metaplatform.ont.entity.RelationTypeEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface RelationTypeRepository extends JpaRepository<RelationTypeEntity, String> {

    Optional<RelationTypeEntity> findByTenantIdAndCode(String tenantId, String code);

    boolean existsByTenantIdAndCode(String tenantId, String code);

    List<RelationTypeEntity> findByTenantId(String tenantId);

    List<RelationTypeEntity> findByTenantIdAndSourceConceptId(String tenantId, String sourceConceptId);

    List<RelationTypeEntity> findByTenantIdAndTargetConceptId(String tenantId, String targetConceptId);

    List<RelationTypeEntity> findByTenantIdAndDirection(String tenantId, String direction);
}