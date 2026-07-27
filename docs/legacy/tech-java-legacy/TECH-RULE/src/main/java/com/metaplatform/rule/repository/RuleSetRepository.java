package com.metaplatform.rule.repository;

import com.metaplatform.rule.entity.RuleSetEntity;
import com.metaplatform.rule.entity.RuleStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface RuleSetRepository extends JpaRepository<RuleSetEntity, String> {

    Optional<RuleSetEntity> findByIdAndDeletedFalse(String id);

    boolean existsByTenantIdAndCodeAndDeletedFalse(String tenantId, String code);

    Page<RuleSetEntity> findByTenantIdAndDeletedFalse(String tenantId, Pageable pageable);

    Page<RuleSetEntity> findByTenantIdAndDeletedFalseAndStatus(String tenantId, RuleStatus status, Pageable pageable);

    Optional<RuleSetEntity> findByTenantIdAndCodeAndDeletedFalse(String tenantId, String code);
}
