package com.metaplatform.agent.memory;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MemoryRepository extends JpaRepository<MemoryEntity, String> {
    List<MemoryEntity> findByTenantIdAndScopeAndMemoryKindOrderByCreatedAtDesc(
            String tenantId, String scope, String memoryKind);
    List<MemoryEntity> findByTenantIdAndScope(String tenantId, String scope);
}
