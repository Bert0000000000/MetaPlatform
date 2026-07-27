package com.metaplatform.ont.repository;

import com.metaplatform.ont.entity.OntologyVersionEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface OntologyVersionRepository extends JpaRepository<OntologyVersionEntity, String> {

    List<OntologyVersionEntity> findByTenantIdOrderByVersionNumberDesc(String tenantId);

    Optional<OntologyVersionEntity> findByVersionIdAndTenantId(String versionId, String tenantId);

    Optional<OntologyVersionEntity> findByTenantIdAndCurrentTrue(String tenantId);

    Optional<OntologyVersionEntity> findTopByTenantIdOrderByVersionNumberDesc(String tenantId);
}
