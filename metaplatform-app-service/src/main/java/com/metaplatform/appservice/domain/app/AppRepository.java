package com.metaplatform.appservice.domain.app;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface AppRepository extends JpaRepository<AppEntity, Long> {
    List<AppEntity> findByTenantIdAndStatus(String tenantId, String status);
    Optional<AppEntity> findByIdAndTenantId(Long id, String tenantId);
    Optional<AppEntity> findByTenantIdAndCode(String tenantId, String code);
}
