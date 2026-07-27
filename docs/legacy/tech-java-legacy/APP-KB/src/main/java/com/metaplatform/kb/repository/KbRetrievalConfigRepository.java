package com.metaplatform.kb.repository;

import com.metaplatform.kb.entity.KbRetrievalConfigEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface KbRetrievalConfigRepository extends JpaRepository<KbRetrievalConfigEntity, String> {
    Optional<KbRetrievalConfigEntity> findByTenantIdAndKbId(String tenantId, String kbId);
}
