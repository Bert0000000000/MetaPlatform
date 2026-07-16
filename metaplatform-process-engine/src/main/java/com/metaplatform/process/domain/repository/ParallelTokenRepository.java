package com.metaplatform.process.domain.repository;

import com.metaplatform.process.domain.ParallelToken;
import com.metaplatform.process.domain.ParallelToken.TokenStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ParallelTokenRepository extends JpaRepository<ParallelToken, Long> {

    List<ParallelToken> findByInstanceIdAndGatewayNodeId(Long instanceId, String gatewayNodeId);

    List<ParallelToken> findByInstanceId(Long instanceId);

    List<ParallelToken> findByInstanceIdAndStatus(Long instanceId, TokenStatus status);

    long countByInstanceIdAndGatewayNodeIdAndStatus(Long instanceId, String gatewayNodeId, TokenStatus status);

    long countByInstanceIdAndGatewayNodeId(Long instanceId, String gatewayNodeId);
}
