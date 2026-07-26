package com.metaplatform.ont.draft;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface OntologyDraftRepository extends JpaRepository<OntologyDraftEntity, String> {

    List<OntologyDraftEntity> findByTenantIdAndStatusOrderByUpdatedAtDesc(String tenantId, String status);

    List<OntologyDraftEntity> findByTenantIdOrderByUpdatedAtDesc(String tenantId);
}
