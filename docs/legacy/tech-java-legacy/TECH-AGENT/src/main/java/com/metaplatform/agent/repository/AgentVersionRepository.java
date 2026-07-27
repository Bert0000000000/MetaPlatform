package com.metaplatform.agent.repository;

import com.metaplatform.agent.entity.AgentVersionEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * AgentVersion 仓储。
 */
@Repository
public interface AgentVersionRepository extends JpaRepository<AgentVersionEntity, String> {

    /**
     * 按 agentId 查询所有版本（按创建时间倒序需在 Service 层排序或追加 Pageable）。
     */
    List<AgentVersionEntity> findByTenantIdAndAgentId(String tenantId, String agentId);

    /**
     * 按 agentId + version 查询。
     */
    AgentVersionEntity findByTenantIdAndAgentIdAndVersion(String tenantId, String agentId, String version);
}
