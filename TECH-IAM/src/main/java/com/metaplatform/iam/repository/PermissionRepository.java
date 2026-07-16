package com.metaplatform.iam.repository;

import com.metaplatform.iam.entity.PermissionEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface PermissionRepository extends JpaRepository<PermissionEntity, String> {

    Optional<PermissionEntity> findByIdAndDeletedFalse(String id);

    boolean existsByTenantIdAndPermissionCodeAndDeletedFalse(String tenantId, String permissionCode);

    Page<PermissionEntity> findByTenantIdAndDeletedFalse(String tenantId, Pageable pageable);

    @Query("SELECT p FROM PermissionEntity p WHERE p.tenantId = :tenantId AND p.deleted = false " +
            "AND (LOWER(p.permissionName) LIKE LOWER(CONCAT('%', :keyword, '%')) " +
            "OR LOWER(p.permissionCode) LIKE LOWER(CONCAT('%', :keyword, '%')))")
    Page<PermissionEntity> searchByKeyword(@Param("tenantId") String tenantId,
                                          @Param("keyword") String keyword,
                                          Pageable pageable);

    Page<PermissionEntity> findByTenantIdAndResourceTypeAndDeletedFalse(String tenantId,
                                                                       String resourceType,
                                                                       Pageable pageable);
}