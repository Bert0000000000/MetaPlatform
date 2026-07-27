package com.metaplatform.kb.repository;

import com.metaplatform.kb.entity.KbDocumentEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface KbDocumentRepository extends JpaRepository<KbDocumentEntity, String> {
    Optional<KbDocumentEntity> findByIdAndDeletedFalse(String id);
    List<KbDocumentEntity> findByKbIdAndDeletedFalse(String kbId);
    List<KbDocumentEntity> findByTenantIdAndKbIdAndStatusAndDeletedFalse(String tenantId, String kbId, String status);
}
