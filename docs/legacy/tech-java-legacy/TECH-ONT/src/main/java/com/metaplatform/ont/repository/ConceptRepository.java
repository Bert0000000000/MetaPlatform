package com.metaplatform.ont.repository;

import com.metaplatform.ont.entity.ConceptEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ConceptRepository extends JpaRepository<ConceptEntity, String> {

    Optional<ConceptEntity> findByTenantIdAndCode(String tenantId, String code);

    boolean existsByTenantIdAndCode(String tenantId, String code);

    boolean existsByTenantIdAndNameAndParentConceptId(String tenantId, String name, String parentConceptId);

    boolean existsByTenantIdAndNameAndParentConceptIdAndConceptIdNot(String tenantId, String name, String parentConceptId, String conceptId);

    List<ConceptEntity> findByTenantIdAndParentConceptId(String tenantId, String parentConceptId);

    List<ConceptEntity> findByTenantId(String tenantId);

    boolean existsByTenantIdAndParentConceptId(String tenantId, String parentConceptId);

    long countByTenantIdAndParentConceptId(String tenantId, String parentConceptId);
}
