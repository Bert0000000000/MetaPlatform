package com.metaplatform.iam.repository;

import com.metaplatform.iam.entity.RoleEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface RoleRepository extends JpaRepository<RoleEntity, String> {

    Optional<RoleEntity> findByIdAndDeletedFalse(String id);

    boolean existsByTenantIdAndRoleCodeAndDeletedFalse(String tenantId, String roleCode);

    Page<RoleEntity> findByTenantIdAndDeletedFalse(String tenantId, Pageable pageable);

    @Query("SELECT r FROM RoleEntity r WHERE r.tenantId = :tenantId AND r.deleted = false " +
            "AND (LOWER(r.roleName) LIKE LOWER(CONCAT('%', :keyword, '%')) " +
            "OR LOWER(r.roleCode) LIKE LOWER(CONCAT('%', :keyword, '%')))")
    Page<RoleEntity> searchByKeyword(@Param("tenantId") String tenantId,
                                     @Param("keyword") String keyword,
                                     Pageable pageable);
}