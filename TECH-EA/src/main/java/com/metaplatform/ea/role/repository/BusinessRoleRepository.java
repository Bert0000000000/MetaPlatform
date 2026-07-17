package com.metaplatform.ea.role.repository;

import com.metaplatform.ea.role.entity.BusinessRoleEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface BusinessRoleRepository extends JpaRepository<BusinessRoleEntity, UUID> {

    Optional<BusinessRoleEntity> findByIdAndTenantIdAndDeletedAtIsNull(UUID id, String tenantId);

    Optional<BusinessRoleEntity> findByTenantIdAndCodeAndDeletedAtIsNull(String tenantId, String code);

    boolean existsByTenantIdAndCodeAndDeletedAtIsNull(String tenantId, String code);

    @Query("SELECT r FROM BusinessRoleEntity r " +
           "WHERE r.tenantId = :tenantId AND r.deletedAt IS NULL " +
           "AND (:keyword IS NULL OR LOWER(r.name) LIKE LOWER(CONCAT('%', :keyword, '%')) " +
           "OR LOWER(r.code) LIKE LOWER(CONCAT('%', :keyword, '%')))")
    Page<BusinessRoleEntity> search(@Param("tenantId") String tenantId,
                                    @Param("keyword") String keyword,
                                    Pageable pageable);
}
