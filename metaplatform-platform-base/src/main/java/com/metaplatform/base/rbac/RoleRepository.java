package com.metaplatform.base.rbac;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.UUID;

public interface RoleRepository extends JpaRepository<Role, UUID> {

    List<Role> findByTenantId(UUID tenantId);

    @Query("SELECT r FROM UserRole ur JOIN ur.role r WHERE ur.tenantId = :tenantId AND ur.userId = :userId")
    List<Role> findRolesByUser(@Param("tenantId") UUID tenantId, @Param("userId") UUID userId);
}
