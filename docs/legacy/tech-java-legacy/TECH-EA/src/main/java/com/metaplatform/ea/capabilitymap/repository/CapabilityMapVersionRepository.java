package com.metaplatform.ea.capabilitymap.repository;

import com.metaplatform.ea.capabilitymap.entity.CapabilityMapVersionEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface CapabilityMapVersionRepository extends JpaRepository<CapabilityMapVersionEntity, UUID> {

    List<CapabilityMapVersionEntity> findByTenantIdAndMapIdOrderByCreatedAtDesc(String tenantId, String mapId);

    Optional<CapabilityMapVersionEntity> findByIdAndTenantIdAndMapId(UUID id, String tenantId, String mapId);

    Optional<CapabilityMapVersionEntity> findByTenantIdAndMapIdAndVersion(String tenantId, String mapId, String version);

    boolean existsByTenantIdAndMapIdAndVersion(String tenantId, String mapId, String version);

    Optional<CapabilityMapVersionEntity> findFirstByTenantIdAndMapIdAndStatusOrderByCreatedAtDesc(
            String tenantId, String mapId, String status);
}
