package com.metaplatform.ont.repository;

import com.metaplatform.ont.entity.EntityEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface EntityRepository extends JpaRepository<EntityEntity, String> {

    List<EntityEntity> findByTenantIdAndConceptId(String tenantId, String conceptId);

    Optional<EntityEntity> findByTenantIdAndConceptIdAndCode(String tenantId, String conceptId, String code);

    boolean existsByTenantIdAndConceptIdAndCode(String tenantId, String conceptId, String code);

    List<EntityEntity> findByTenantId(String tenantId);

    long countByTenantIdAndConceptId(String tenantId, String conceptId);
}
