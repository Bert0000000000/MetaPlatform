package com.metaplatform.llmgw.repository;

import com.metaplatform.llmgw.entity.AuditLogEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface AuditLogEntityRepository extends JpaRepository<AuditLogEntity, Long> {

    List<AuditLogEntity> findByTraceId(String traceId);

    List<AuditLogEntity> findByUserId(String userId);

    List<AuditLogEntity> findByModelId(String modelId);

    List<AuditLogEntity> findByCreatedAtBetween(LocalDateTime start, LocalDateTime end);
}
