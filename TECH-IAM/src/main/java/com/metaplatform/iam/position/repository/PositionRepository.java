package com.metaplatform.iam.position.repository;

import com.metaplatform.iam.position.entity.PositionEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface PositionRepository extends JpaRepository<PositionEntity, String> {

    Optional<PositionEntity> findByIdAndDeletedFalse(String id);

    boolean existsByTenantIdAndCodeAndDeletedFalse(String tenantId, String code);

    Page<PositionEntity> findByTenantIdAndDeletedFalse(String tenantId, Pageable pageable);

    @Query("SELECT p FROM PositionEntity p WHERE p.tenantId = :tenantId AND p.deleted = false " +
            "AND (LOWER(p.name) LIKE LOWER(CONCAT('%', :keyword, '%')) " +
            "OR LOWER(p.code) LIKE LOWER(CONCAT('%', :keyword, '%')))")
    Page<PositionEntity> searchByKeyword(@Param("tenantId") String tenantId,
                                        @Param("keyword") String keyword,
                                        Pageable pageable);
}