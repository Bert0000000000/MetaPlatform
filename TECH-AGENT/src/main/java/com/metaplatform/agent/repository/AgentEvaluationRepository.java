package com.metaplatform.agent.repository;

import com.metaplatform.agent.entity.AgentEvaluationEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * AgentEvaluation 仓储（对应 agent_evaluations 表）。
 */
@Repository
public interface AgentEvaluationRepository extends JpaRepository<AgentEvaluationEntity, String> {

    /**
     * 按 executionId 查询所有评估。
     */
    List<AgentEvaluationEntity> findByTenantIdAndExecutionId(String tenantId, String executionId);
}
