package com.metaplatform.iam.repository;

import com.metaplatform.iam.entity.PolicyEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PolicyRepository extends JpaRepository<PolicyEntity, String> {

    Optional<PolicyEntity> findByIdAndDeletedFalse(String id);

    Page<PolicyEntity> findByTenantIdAndDeletedFalse(String tenantId, Pageable pageable);

    @Query("SELECT p FROM PolicyEntity p WHERE p.tenantId = :tenantId AND p.deleted = false " +
            "AND (:subjectType IS NULL OR p.subjectType = :subjectType) " +
            "AND (:subjectId IS NULL OR p.subjectId = :subjectId) " +
            "AND (:resourceType IS NULL OR p.resourceType = :resourceType) " +
            "AND (:keyword IS NULL OR LOWER(p.name) LIKE LOWER(CONCAT('%', :keyword, '%'))) ")
    Page<PolicyEntity> search(@Param("tenantId") String tenantId,
                              @Param("keyword") String keyword,
                              @Param("subjectType") PolicyEntity.SubjectType subjectType,
                              @Param("subjectId") String subjectId,
                              @Param("resourceType") String resourceType,
                              Pageable pageable);

    List<PolicyEntity> findByTenantIdAndSubjectTypeAndResourceTypeAndDeletedFalse(
            String tenantId, PolicyEntity.SubjectType subjectType, String resourceType);

    List<PolicyEntity> findByTenantIdAndSubjectTypeAndSubjectIdAndResourceTypeAndDeletedFalse(
            String tenantId, PolicyEntity.SubjectType subjectType, String subjectId, String resourceType);
}
