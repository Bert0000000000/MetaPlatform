package com.metaplatform.ea.capabilitymap.repository;

import com.metaplatform.ea.capabilitymap.entity.CapabilityMapEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface CapabilityMapRepository extends JpaRepository<CapabilityMapEntity, UUID> {

    Optional<CapabilityMapEntity> findByIdAndTenantIdAndDeletedAtIsNull(UUID id, String tenantId);

    Optional<CapabilityMapEntity> findByTenantIdAndMapIdAndDeletedAtIsNull(String tenantId, String mapId);

    Optional<CapabilityMapEntity> findByTenantIdAndCodeAndDeletedAtIsNull(String tenantId, String code);

    boolean existsByTenantIdAndCodeAndDeletedAtIsNull(String tenantId, String code);

    boolean existsByTenantIdAndMapIdAndDeletedAtIsNull(String tenantId, String mapId);

    List<CapabilityMapEntity> findByTenantIdAndDeletedAtIsNull(String tenantId);

    List<CapabilityMapEntity> findByTenantIdAndBusinessDomainAndDeletedAtIsNull(String tenantId, String businessDomain);
}
