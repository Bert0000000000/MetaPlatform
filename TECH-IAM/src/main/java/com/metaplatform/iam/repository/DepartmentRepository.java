package com.metaplatform.iam.repository;

import com.metaplatform.iam.entity.DepartmentEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DepartmentRepository extends JpaRepository<DepartmentEntity, String> {

    Optional<DepartmentEntity> findByIdAndDeletedFalse(String id);

    boolean existsByTenantIdAndDeptCodeAndDeletedFalse(String tenantId, String deptCode);

    Page<DepartmentEntity> findByTenantIdAndDeletedFalse(String tenantId, Pageable pageable);

    Page<DepartmentEntity> findByTenantIdAndParentIdAndDeletedFalse(String tenantId, String parentId, Pageable pageable);

    @Query("SELECT d FROM DepartmentEntity d WHERE d.tenantId = :tenantId AND d.deleted = false " +
            "AND (LOWER(d.deptName) LIKE LOWER(CONCAT('%', :keyword, '%')) " +
            "OR LOWER(d.deptCode) LIKE LOWER(CONCAT('%', :keyword, '%')))")
    Page<DepartmentEntity> searchByKeyword(@Param("tenantId") String tenantId,
                                           @Param("keyword") String keyword,
                                           Pageable pageable);

    @Query("SELECT d FROM DepartmentEntity d WHERE d.tenantId = :tenantId AND d.deleted = false " +
            "AND d.parentId = :parentId " +
            "AND (LOWER(d.deptName) LIKE LOWER(CONCAT('%', :keyword, '%')) " +
            "OR LOWER(d.deptCode) LIKE LOWER(CONCAT('%', :keyword, '%')))")
    Page<DepartmentEntity> searchByParentAndKeyword(@Param("tenantId") String tenantId,
                                                    @Param("parentId") String parentId,
                                                    @Param("keyword") String keyword,
                                                    Pageable pageable);

    List<DepartmentEntity> findByTenantIdAndParentIdAndDeletedFalse(String tenantId, String parentId);

    long countByParentIdAndDeletedFalse(String parentId);
}