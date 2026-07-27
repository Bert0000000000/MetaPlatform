package com.metaplatform.ea.ontmapping.repository;

import com.metaplatform.ea.ontmapping.entity.OntologyChangeEventEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface OntologyChangeEventRepository extends JpaRepository<OntologyChangeEventEntity, UUID> {

    Optional<OntologyChangeEventEntity> findByIdAndTenantId(UUID id, String tenantId);

    List<OntologyChangeEventEntity> findByTenantIdAndStatusOrderByCreatedAtDesc(String tenantId, String status);

    List<OntologyChangeEventEntity> findByTenantIdAndConceptIdAndStatusOrderByCreatedAtDesc(
            String tenantId, String conceptId, String status);

    List<OntologyChangeEventEntity> findByTenantIdOrderByCreatedAtDesc(String tenantId);
}
