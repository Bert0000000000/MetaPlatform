package com.metaplatform.gw.api.repository;

import com.metaplatform.gw.api.entity.GwApiEntity;
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
public interface GwApiRepository extends JpaRepository<GwApiEntity, UUID> {

    Optional<GwApiEntity> findByIdAndDeletedAtIsNull(UUID id);

    boolean existsByTenantIdAndPathAndMethodAndVersionAndDeletedAtIsNull(
            String tenantId, String path, String method, String version);

    Page<GwApiEntity> findByTenantIdAndDeletedAtIsNullOrderByCreatedAtDesc(
            String tenantId, Pageable pageable);

    Page<GwApiEntity> findByTenantIdAndGroupNameAndDeletedAtIsNullOrderByCreatedAtDesc(
            String tenantId, String groupName, Pageable pageable);

    Page<GwApiEntity> findByTenantIdAndVersionAndDeletedAtIsNullOrderByCreatedAtDesc(
            String tenantId, String version, Pageable pageable);

    @Query("SELECT a FROM GwApiEntity a " +
           "WHERE a.tenantId = :tenantId AND a.deletedAt IS NULL " +
           "AND (:groupName IS NULL OR a.groupName = :groupName) " +
           "AND (:version IS NULL OR a.version = :version) " +
           "AND (:keyword IS NULL OR LOWER(a.name) LIKE LOWER(CONCAT('%', :keyword, '%')) " +
           "     OR LOWER(a.path) LIKE LOWER(CONCAT('%', :keyword, '%')))")
    Page<GwApiEntity> searchApis(
            @Param("tenantId") String tenantId,
            @Param("groupName") String groupName,
            @Param("version") String version,
            @Param("keyword") String keyword,
            Pageable pageable);

    List<GwApiEntity> findByTenantIdAndGroupNameAndDeletedAtIsNull(String tenantId, String groupName);
}
