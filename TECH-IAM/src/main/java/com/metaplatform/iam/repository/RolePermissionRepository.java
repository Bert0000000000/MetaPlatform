package com.metaplatform.iam.repository;

import com.metaplatform.iam.entity.RolePermissionEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface RolePermissionRepository extends JpaRepository<RolePermissionEntity, String> {

    List<RolePermissionEntity> findByRoleIdAndDeletedFalse(String roleId);

    Optional<RolePermissionEntity> findByRoleIdAndPermissionIdAndDeletedFalse(String roleId, String permissionId);

    long countByRoleIdAndDeletedFalse(String roleId);

    @Modifying
    @Query("UPDATE RolePermissionEntity rp SET rp.deleted = true, rp.deletedAt = CURRENT_TIMESTAMP " +
            "WHERE rp.roleId = :roleId AND rp.deleted = false")
    int softDeleteByRoleId(@Param("roleId") String roleId);
}