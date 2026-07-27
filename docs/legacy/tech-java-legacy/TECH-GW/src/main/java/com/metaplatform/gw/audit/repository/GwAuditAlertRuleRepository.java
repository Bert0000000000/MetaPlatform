package com.metaplatform.gw.audit.repository;

import com.metaplatform.gw.audit.entity.GwAuditAlertRuleEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface GwAuditAlertRuleRepository extends JpaRepository<GwAuditAlertRuleEntity, UUID> {

    Optional<GwAuditAlertRuleEntity> findByIdAndDeletedAtIsNull(UUID id);

    Page<GwAuditAlertRuleEntity> findByTenantIdAndDeletedAtIsNullOrderByCreatedAtDesc(
            String tenantId, Pageable pageable);

    List<GwAuditAlertRuleEntity> findByEnabledAndDeletedAtIsNull(Boolean enabled);
}
