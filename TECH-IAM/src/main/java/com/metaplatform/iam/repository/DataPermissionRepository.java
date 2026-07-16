package com.metaplatform.iam.repository;

import com.metaplatform.iam.entity.DataPermissionEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DataPermissionRepository extends JpaRepository<DataPermissionEntity, String> {

    Optional<DataPermissionEntity> findByIdAndDeletedFalse(String id);

    List<DataPermissionEntity> findByTenantIdAndDeletedFalse(String tenantId);

    List<DataPermissionEntity> findByTenantIdAndRoleIdAndDeletedFalse(String tenantId, String roleId);

    List<DataPermissionEntity> findByTenantIdAndResourceTypeAndDeletedFalse(String tenantId, String resourceType);

    List<DataPermissionEntity> findByTenantIdAndRoleIdAndResourceTypeAndDeletedFalse(String tenantId,
                                                                                     String roleId,
                                                                                     String resourceType);

    boolean existsByTenantIdAndRoleIdAndResourceTypeAndResourceIdAndDeletedFalse(String tenantId,
                                                                                  String roleId,
                                                                                  String resourceType,
                                                                                  String resourceId);
}
