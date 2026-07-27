package com.metaplatform.kb.repository;

import com.metaplatform.kb.entity.KbEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface KbRepository extends JpaRepository<KbEntity, String> {
    Optional<KbEntity> findByTenantIdAndKbCodeAndDeletedFalse(String tenantId, String kbCode);
    List<KbEntity> findByTenantIdAndDeletedFalse(String tenantId);
}
