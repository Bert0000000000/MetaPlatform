package com.metaplatform.kb.entity;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface KbRetrievalConfigRepository extends JpaRepository<KbRetrievalConfigEntity, String> {
    List<KbRetrievalConfigEntity> findByTenantId(String tenantId);
    Optional<KbRetrievalConfigEntity> findByTenantIdAndKbId(String tenantId, String kbId);
}
