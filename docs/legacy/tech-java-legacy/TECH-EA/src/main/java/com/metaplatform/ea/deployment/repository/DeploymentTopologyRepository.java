package com.metaplatform.ea.deployment.repository;

import com.metaplatform.ea.deployment.entity.DeploymentTopologyEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface DeploymentTopologyRepository extends JpaRepository<DeploymentTopologyEntity, UUID> {

    Optional<DeploymentTopologyEntity> findByIdAndDeletedAtIsNull(UUID id);

    List<DeploymentTopologyEntity> findByTenantIdAndDeletedAtIsNull(String tenantId);

    List<DeploymentTopologyEntity> findByTenantIdAndEnvironmentAndDeletedAtIsNull(String tenantId, String environment);

    boolean existsByTenantIdAndNameAndDeletedAtIsNull(String tenantId, String name);
}
