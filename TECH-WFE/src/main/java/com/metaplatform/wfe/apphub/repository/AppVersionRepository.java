package com.metaplatform.wfe.apphub.repository;

import com.metaplatform.wfe.apphub.entity.AppVersionEntity;
import com.metaplatform.wfe.apphub.entity.AppVersionStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface AppVersionRepository extends JpaRepository<AppVersionEntity, String> {

    Page<AppVersionEntity> findByTenantIdAndAppIdOrderByCreatedAtDesc(
            String tenantId, String appId, Pageable pageable);

    Optional<AppVersionEntity> findByIdAndTenantId(String id, String tenantId);

    Optional<AppVersionEntity> findFirstByTenantIdAndAppIdAndStatusOrderByCreatedAtDesc(
            String tenantId, String appId, AppVersionStatus status);

    boolean existsByTenantIdAndAppIdAndVersion(String tenantId, String appId, String version);
}
