package com.metaplatform.kb.repository;

import com.metaplatform.kb.entity.KbChunkStrategyEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface KbChunkStrategyRepository extends JpaRepository<KbChunkStrategyEntity, String> {
    Optional<KbChunkStrategyEntity> findByTenantIdAndStrategyCodeAndEnabledTrue(String tenantId, String strategyCode);
}
