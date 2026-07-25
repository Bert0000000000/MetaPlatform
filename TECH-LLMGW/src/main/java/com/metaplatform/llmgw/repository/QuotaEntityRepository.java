package com.metaplatform.llmgw.repository;

import com.metaplatform.llmgw.entity.QuotaEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface QuotaEntityRepository extends JpaRepository<QuotaEntity, Long> {

    List<QuotaEntity> findByScopeAndScopeKey(String scope, String scopeKey);

    Optional<QuotaEntity> findByScopeAndScopeKeyAndModelId(String scope, String scopeKey, String modelId);

    List<QuotaEntity> findByIsActive(Boolean isActive);
}
