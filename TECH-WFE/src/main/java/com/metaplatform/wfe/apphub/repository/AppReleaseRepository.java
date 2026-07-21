package com.metaplatform.wfe.apphub.repository;

import com.metaplatform.wfe.apphub.entity.AppReleaseEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface AppReleaseRepository extends JpaRepository<AppReleaseEntity, String> {

    Page<AppReleaseEntity> findByTenantIdAndAppIdOrderByCreatedAtDesc(
            String tenantId, String appId, Pageable pageable);

    Optional<AppReleaseEntity> findByIdAndTenantId(String id, String tenantId);

    Optional<AppReleaseEntity> findByProcessInstanceId(String processInstanceId);

    boolean existsByTenantIdAndAppIdAndVersion(String tenantId, String appId, String version);
}
