package com.metaplatform.agent.action;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface ActionProposalRepository extends JpaRepository<ActionProposalEntity, String> {

    /**
     * 幂等键查询：Agent 端重试 / 审批回放时使用。
     */
    Optional<ActionProposalEntity> findByIdempotencyKey(String key);

    /**
     * 扫描已过期但仍 PROPOSED 的 Action 提案，触发自动 EXPIRED。
     */
    @Query("select a from ActionProposalEntity a where a.status = :status and a.expiresAt < :before")
    List<ActionProposalEntity> findByStatusAndExpiresAtBefore(@Param("status") ActionProposalStatus status, @Param("before") Instant before);
}
