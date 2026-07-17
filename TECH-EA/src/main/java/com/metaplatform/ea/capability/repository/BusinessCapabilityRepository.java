package com.metaplatform.ea.capability.repository;

import com.metaplatform.ea.capability.entity.BusinessCapabilityEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface BusinessCapabilityRepository extends JpaRepository<BusinessCapabilityEntity, UUID> {

    Optional<BusinessCapabilityEntity> findByIdAndTenantIdAndDeletedAtIsNull(UUID id, String tenantId);

    Optional<BusinessCapabilityEntity> findByTenantIdAndCodeAndDeletedAtIsNull(String tenantId, String code);

    boolean existsByTenantIdAndCodeAndDeletedAtIsNull(String tenantId, String code);

    List<BusinessCapabilityEntity> findByTenantIdAndParentIdAndDeletedAtIsNullOrderBySortOrderAscNameAsc(String tenantId, UUID parentId);

    List<BusinessCapabilityEntity> findByTenantIdAndParentIdIsNullAndDeletedAtIsNullOrderBySortOrderAscNameAsc(String tenantId);

    List<BusinessCapabilityEntity> findByTenantIdAndDeletedAtIsNullOrderBySortOrderAscNameAsc(String tenantId);

    List<BusinessCapabilityEntity> findByTenantIdAndParentIdAndDeletedAtIsNull(String tenantId, UUID parentId);

    @Query("SELECT c FROM BusinessCapabilityEntity c " +
           "WHERE c.tenantId = :tenantId AND c.deletedAt IS NULL " +
           "AND (:status IS NULL OR c.status = :status) " +
           "AND (:keyword IS NULL OR LOWER(c.name) LIKE LOWER(CONCAT('%', :keyword, '%')) " +
           "OR LOWER(c.code) LIKE LOWER(CONCAT('%', :keyword, '%')))")
    Page<BusinessCapabilityEntity> search(@Param("tenantId") String tenantId,
                                          @Param("status") String status,
                                          @Param("keyword") String keyword,
                                          Pageable pageable);
}
