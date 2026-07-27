package com.metaplatform.ea.role.repository;

import com.metaplatform.ea.role.entity.CapabilityRoleEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface CapabilityRoleRepository extends JpaRepository<CapabilityRoleEntity, UUID> {

    List<CapabilityRoleEntity> findByTenantIdAndCapabilityId(String tenantId, UUID capabilityId);

    List<CapabilityRoleEntity> findByTenantIdAndRoleId(String tenantId, UUID roleId);

    Optional<CapabilityRoleEntity> findByTenantIdAndCapabilityIdAndRoleId(String tenantId, UUID capabilityId, UUID roleId);

    boolean existsByTenantIdAndCapabilityIdAndRoleId(String tenantId, UUID capabilityId, UUID roleId);

    void deleteByTenantIdAndCapabilityIdAndRoleId(String tenantId, UUID capabilityId, UUID roleId);
}
