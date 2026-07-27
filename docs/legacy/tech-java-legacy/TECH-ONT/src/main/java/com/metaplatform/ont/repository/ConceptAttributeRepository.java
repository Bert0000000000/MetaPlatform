package com.metaplatform.ont.repository;

import com.metaplatform.ont.entity.ConceptAttributeEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ConceptAttributeRepository extends JpaRepository<ConceptAttributeEntity, Long> {

    List<ConceptAttributeEntity> findByTenantId(String tenantId);

    List<ConceptAttributeEntity> findByTenantIdAndConceptId(String tenantId, String conceptId);

    List<ConceptAttributeEntity> findByTenantIdAndAttributeId(String tenantId, String attributeId);

    boolean existsByTenantIdAndConceptIdAndAttributeId(String tenantId, String conceptId, String attributeId);

    void deleteByTenantIdAndConceptId(String tenantId, String conceptId);

    void deleteByTenantIdAndConceptIdAndAttributeId(String tenantId, String conceptId, String attributeId);
}
