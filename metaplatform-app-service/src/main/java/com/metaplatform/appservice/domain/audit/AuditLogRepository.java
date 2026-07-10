package com.metaplatform.appservice.domain.audit;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AuditLogRepository extends JpaRepository<AuditLog, Long> {
    List<AuditLog> findByResourceTypeAndResourceId(String resourceType, Long resourceId);
}
