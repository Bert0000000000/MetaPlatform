package com.metaplatform.agent.repository;

import com.metaplatform.agent.entity.AgentOperationLogEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

/**
 * AgentOperationLog 仓储。
 */
@Repository
public interface AgentOperationLogRepository extends JpaRepository<AgentOperationLogEntity, String> {

    /**
     * 按 agentId 分页查询操作日志。
     */
    Page<AgentOperationLogEntity> findByTenantIdAndAgentId(String tenantId, String agentId, Pageable pageable);

    /**
     * 按 traceId 查询。
     */
    Iterable<AgentOperationLogEntity> findByTenantIdAndTraceId(String tenantId, String traceId);
}
