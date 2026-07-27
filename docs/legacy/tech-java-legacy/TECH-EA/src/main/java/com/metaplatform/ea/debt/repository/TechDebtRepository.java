package com.metaplatform.ea.debt.repository;

import com.metaplatform.ea.debt.entity.TechDebtEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface TechDebtRepository extends JpaRepository<TechDebtEntity, UUID> {

    Optional<TechDebtEntity> findByIdAndDeletedAtIsNull(UUID id);

    List<TechDebtEntity> findByTenantIdAndDeletedAtIsNull(String tenantId);

    List<TechDebtEntity> findByTenantIdAndSeverityAndDeletedAtIsNull(String tenantId, String severity);

    List<TechDebtEntity> findByTenantIdAndScopeTypeAndScopeIdAndDeletedAtIsNull(
            String tenantId, String scopeType, UUID scopeId);

    boolean existsByTenantIdAndCodeAndDeletedAtIsNull(String tenantId, String code);
}