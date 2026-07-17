package com.metaplatform.iam.sso.repository;

import com.metaplatform.iam.sso.entity.SsoConfigEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface SsoConfigRepository extends JpaRepository<SsoConfigEntity, String> {

    Optional<SsoConfigEntity> findByIdAndDeletedFalse(String id);

    boolean existsByTenantIdAndProviderNameAndDeletedFalse(String tenantId, String providerName);

    Optional<SsoConfigEntity> findByTenantIdAndProviderNameAndDeletedFalse(String tenantId, String providerName);

    Page<SsoConfigEntity> findByTenantIdAndDeletedFalse(String tenantId, Pageable pageable);

    @Query("SELECT s FROM SsoConfigEntity s WHERE s.tenantId = :tenantId AND s.deleted = false " +
            "AND (LOWER(s.providerName) LIKE LOWER(CONCAT('%', :keyword, '%')))")
    Page<SsoConfigEntity> searchByKeyword(@Param("tenantId") String tenantId,
                                          @Param("keyword") String keyword,
                                          Pageable pageable);
}
